import { sql } from "./index";
import type { AutoKind, FollowKind, FollowState } from "./writes";
import { readWhen, runSpan, type Precision } from "@/lib/format";
import { FRESH_DAYS } from "@/lib/metron";
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";
import { parseSort, type Dir, type Sort } from "@/lib/library-sort";
import { DEFAULT_SETTINGS, wordsPerYear, type ReadingSettings } from "@/lib/settings";

/* Raw SQL against the views in etl/views.sql. Drizzle's query builder is used
 * for writes; reads that join three or four views are clearer as SQL. */

export type RunRow = {
  id: string; title: string;
  // From the run_credit_line view: derived from issue credits, never typed.
  writers: string | null;
  // From the run_span view, never from runs: see etl/views.sql.
  series_issues: string | null; start_year: number | null; end_year: number | null;
  dated_issues: number;
  tier: number | null; why: string | null; spine: boolean; tracks: string[];
  total_issues: number; read_issues: number; pct: number;
  state: "empty" | "unread" | "reading" | "read";
  readiness: "blocked" | "ready_hard" | "ready_all";
  hard_left: number; soft_left: number;
  /** Its place in the Up next queue (task 1.10), or null when it isn't queued. */
  queued_ordinal: number | null;
};

/** A page of rows plus the size of the whole list, so a screen never prints its
 * LIMIT as if it were the count (R2-05). */
export type WithTotal<T> = T & { total: number };

/** Whether the database answers and etl/views.sql is applied: run_progress is
 * the first view it creates, and a migration that drops views drops it too. */
export async function healthCheck(): Promise<{ views: boolean }> {
  const [row] = await sql<{ views: boolean }[]>`
    SELECT to_regclass('public.run_progress') IS NOT NULL AS views`;
  return row;
}

export async function listRuns(userId: string, track?: string): Promise<RunRow[]> {
  return sql<RunRow[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine,
           COALESCE(ARRAY_AGG(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state,
           rd.readiness,
           rd.hard_total - rd.hard_done AS hard_left,
           rd.soft_total - rd.soft_done AS soft_left,
           q.ordinal AS queued_ordinal
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN run_queue q   ON q.run_id = r.id AND q.user_id = ${userId}
    LEFT JOIN run_tracks rt ON rt.run_id = r.id
    LEFT JOIN tracks t      ON t.id = rt.track_id
    LEFT JOIN blocks b      ON b.id = r.block_id
    WHERE NOT r.placeholder AND r.deleted_at IS NULL
      AND (${track ?? null}::text IS NULL OR t.id = ${track ?? null})
    GROUP BY r.id, b.number, rp.total_issues, rp.read_issues, rp.pct, rp.state,
             rd.readiness, rd.hard_total, rd.hard_done, rd.soft_total, rd.soft_done,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues, cl.writers, q.ordinal
    ORDER BY b.number NULLS LAST, r.sequence NULLS LAST, rs.start_year NULLS LAST
  `;
}

/** The "what can I start tonight" list. Replaces the DASHBOARD tab. With
 * `unqueued`, only the runs that aren't in the Up next queue (task 1.10). */
export async function readyToRead(userId: string, limit = 20, { unqueued = false } = {}) {
  return sql<WithTotal<RunRow>[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine,
           COALESCE(ARRAY_AGG(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
           rd.hard_total - rd.hard_done AS hard_left,
           rd.soft_total - rd.soft_done AS soft_left,
           q.ordinal AS queued_ordinal,
           COUNT(*) OVER ()::int AS total
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN run_queue q   ON q.run_id = r.id AND q.user_id = ${userId}
    LEFT JOIN run_tracks rt ON rt.run_id = r.id
    LEFT JOIN tracks t      ON t.id = rt.track_id
    WHERE NOT r.placeholder AND r.deleted_at IS NULL
      AND rp.state = 'unread'
      AND rd.readiness = 'ready_all'
      AND rp.total_issues > 0
      AND (NOT ${unqueued} OR q.run_id IS NULL)
    GROUP BY r.id, rp.total_issues, rp.read_issues, rp.pct, rp.state,
             rd.readiness, rd.hard_total, rd.hard_done, rd.soft_total, rd.soft_done,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues, cl.writers, q.ordinal
    ORDER BY r.tier NULLS LAST, rp.total_issues ASC
    LIMIT ${limit}
  `;
}

/** A row of the Up next queue (task 1.10): a queued run nothing of which is read. */
export type QueueRow = {
  id: string; title: string; writers: string | null;
  start_year: number | null; end_year: number | null; total_issues: number;
  ordinal: number; readiness: "blocked" | "ready_hard" | "ready_all";
  blocked_by: number; soft_left: number;
};

/**
 * The queue's unstarted runs, in queue order: the dashboard's shelf and the
 * status screen's Up next. Their state comes from run_queue_state, so a run
 * you start leaves this list with its row (and ordinal) intact, and comes back
 * to the same place when it is unmarked to zero (data model 2.16).
 */
export async function upNext(userId: string) {
  return sql<QueueRow[]>`
    SELECT r.id, r.title, cl.writers, rs.start_year, rs.end_year, qs.total_issues,
           qs.ordinal, qs.readiness, qs.blocked_by, qs.soft_left
    FROM run_queue_state qs
    JOIN runs r            ON r.id = qs.run_id
    JOIN run_span      rs  ON rs.run_id = qs.run_id
    JOIN run_credit_line cl ON cl.run_id = qs.run_id
    WHERE qs.user_id = ${userId} AND qs.state = 'unstarted'
    ORDER BY qs.ordinal
  `;
}

/**
 * *Ready, not queued* (task 1.10, 1.9): the unread runs the queue doesn't hold
 * that can be started, `ready_all` first and then `ready_hard`, each in track →
 * block → run order (design §11.2, D-79), with the count of all of them. `tracks`
 * has no order column, so a run sorts under the first of its tracks by name (its
 * block's track when it has no `run_tracks` row); a run in no block comes last.
 * A blocked run is in neither this list nor above it. The limit is far above the
 * catalog's 258 runs: the status tab's count is its rows (task 1.9).
 */
export function readyNotQueued(userId: string, limit = 500) {
  return sql<WithTotal<RunRow>[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine, '{}'::text[] AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
           rd.hard_total - rd.hard_done AS hard_left,
           rd.soft_total - rd.soft_done AS soft_left,
           NULL::int AS queued_ordinal,
           COUNT(*) OVER ()::int AS total
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN blocks b  ON b.id = r.block_id
    LEFT JOIN tracks bt ON bt.id = b.track_id
    WHERE NOT r.placeholder AND r.deleted_at IS NULL
      AND rp.state = 'unread'
      AND rd.readiness IN ('ready_all', 'ready_hard')
      AND rp.total_issues > 0
      AND NOT EXISTS (SELECT 1 FROM run_queue q WHERE q.run_id = r.id AND q.user_id = ${userId})
    ORDER BY (rd.readiness = 'ready_hard'), (b.id IS NULL),
             COALESCE((SELECT MIN(t.name) FROM run_tracks rt JOIN tracks t ON t.id = rt.track_id WHERE rt.run_id = r.id), bt.name),
             b.number, r.sequence, r.title, r.id
    LIMIT ${limit}
  `;
}

/** The resume pointer (task 1.6): the lowest sequence whose *placement* is
 * unread, so an issue read only in another run still stops it (data model
 * 2.14). Derived, never stored. `next_ordinal` is its position among the run's
 * live placements, the n of the spine row's `#p-n`. RunSpine applies the same
 * rule to its rows so a mark moves it; test/resume-pointer.test.ts holds the two
 * to one answer. */
export async function inProgressRuns(userId: string) {
  return sql<(RunRow & { next_label: string; next_notes: string | null; next_ordinal: number })[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine, '{}'::text[] AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state,
           'ready_all' AS readiness, 0 AS hard_left, 0 AS soft_left, NULL::int AS queued_ordinal,
           nx.label AS next_label, nx.notes AS next_notes, nx.ordinal AS next_ordinal
    FROM runs r
    JOIN run_progress rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_span     rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    JOIN LATERAL (
      SELECT i.label, ri.notes,
             (SELECT COUNT(*)::int FROM live_run_issues o
              WHERE o.run_id = ri.run_id AND o.sequence <= ri.sequence) AS ordinal
      FROM live_run_issues ri
      JOIN issues i ON i.id = ri.issue_id
      LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.placement_id IS NULL
      ORDER BY ri.sequence
      LIMIT 1
    ) nx ON true
    WHERE r.deleted_at IS NULL AND rp.state = 'reading'
    ORDER BY rp.pct DESC, r.id
  `;
}

/** A row of the status screen's *In flight* tab (task 1.9): a started run and its resume pointer. */
export type InFlightRun = RunRow & {
  next_label: string; next_notes: string | null; next_ordinal: number;
  last_read_at: Date | null; last_read_precision: Precision;
};

/**
 * Comics *In flight* (task 1.9): the runs with some placements read and some
 * not, most recently touched first (the latest dated read, an undated one last),
 * each with its resume pointer, by the rule `inProgressRuns` uses. Queued or
 * not: a started run leaves Up next through `run_queue_state`, never this list.
 */
export async function inFlightRuns(userId: string) {
  return sql<InFlightRun[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine, '{}'::text[] AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state,
           'ready_all' AS readiness, 0 AS hard_left, 0 AS soft_left, NULL::int AS queued_ordinal,
           nx.label AS next_label, nx.notes AS next_notes, nx.ordinal AS next_ordinal,
           lr.completed_at AS last_read_at, COALESCE(lr.completed_at_precision, 'none') AS last_read_precision
    FROM runs r
    JOIN run_progress rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_span     rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    JOIN LATERAL (
      SELECT i.label, ri.notes,
             (SELECT COUNT(*)::int FROM live_run_issues o
              WHERE o.run_id = ri.run_id AND o.sequence <= ri.sequence) AS ordinal
      FROM live_run_issues ri
      JOIN issues i ON i.id = ri.issue_id
      LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.placement_id IS NULL
      ORDER BY ri.sequence
      LIMIT 1
    ) nx ON true
    LEFT JOIN LATERAL (
      SELECT p.completed_at, p.completed_at_precision
      FROM live_run_issues ri
      JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.completed_at_precision <> 'none'
      ORDER BY p.completed_at DESC, (p.completed_at_precision = 'exact') DESC
      LIMIT 1
    ) lr ON true
    WHERE r.deleted_at IS NULL AND NOT r.placeholder AND rp.state = 'reading'
    ORDER BY lr.completed_at DESC NULLS LAST, r.id
  `;
}

/** A row of the status screen's *Done* tab (task 1.9): a run with every placement read. */
export type DoneRun = {
  id: string; title: string; writers: string | null;
  start_year: number | null; end_year: number | null; total_issues: number;
  finished_at: Date | null; finished_precision: Precision;
  /** The run's earliest dated read here (`run_state.started_at`, task 1.17) and its precision. */
  started_at: Date | null; started_precision: Precision;
};

/**
 * Comics *Done* (task 1.9): the runs whose own placements are all read, from
 * `run_state` (read elsewhere does not count, data model 2.14), the latest
 * finish first. A run read only with undated marks has no finish date and sorts
 * after every dated one. The start is the span's (task 1.17).
 */
export async function doneRuns(userId: string) {
  return sql<DoneRun[]>`
    SELECT r.id, r.title, cl.writers, rs.start_year, rs.end_year, st.total_issues::int AS total_issues,
           st.finished_at, COALESCE(fp.completed_at_precision, 'none') AS finished_precision,
           st.started_at, COALESCE(sp.completed_at_precision, 'none') AS started_precision
    FROM run_state st
    JOIN runs r ON r.id = st.run_id AND r.deleted_at IS NULL AND NOT r.placeholder
    JOIN run_span rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN LATERAL (
      SELECT p.completed_at_precision
      FROM live_run_issues ri
      JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.completed_at = st.finished_at
      ORDER BY (p.completed_at_precision = 'exact') DESC
      LIMIT 1
    ) fp ON true
    -- The precision of the run's start (task 1.17): the read at started_at among
    -- its own placements, an exact one winning a tie (as fp does for the finish).
    LEFT JOIN LATERAL (
      SELECT p.completed_at_precision
      FROM live_run_issues ri
      JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.completed_at = st.started_at
      ORDER BY (p.completed_at_precision = 'exact') DESC
      LIMIT 1
    ) sp ON true
    WHERE st.user_id = ${userId} AND st.state = 'read'
    ORDER BY st.finished_at DESC NULLS LAST, r.title, r.id
  `;
}

/** The thumb bar's reach (task 1.8b): a run's unread placements in reading order,
 * the first `limit` of them, with whether the whole run spans one series so the
 * mark verb can say `#141` alone (M-10). The first unread placement is the
 * resume pointer (`inProgressRuns`), by the same rule. With no `runId` it is the
 * dashboard's hero, the reading run furthest along (`inProgressRuns()[0]`), so
 * the dashboard asks for it in the same wave as the list instead of after it;
 * `run_id` says which run that was. The label parse is run_span's, written with
 * POSIX classes since a backslash does not survive the template, and
 * `singleSeries()` in src/lib/format.ts agrees with it. */
export async function nextUnread(userId: string, runId: string | null = null, limit = 50) {
  const rows = await sql<{
    run_id: string; placement_id: number; label: string; type: string; notes: string | null; single_series: boolean;
  }[]>`
    WITH target AS (
      SELECT COALESCE(${runId}::text, (
        SELECT r.id FROM runs r
        JOIN run_progress rp ON rp.run_id = r.id AND rp.user_id = ${userId}
        WHERE r.deleted_at IS NULL AND rp.state = 'reading'
        ORDER BY rp.pct DESC, r.id
        LIMIT 1
      )) AS id
    ),
    parsed AS (
      SELECT ri.run_id, ri.id, ri.sequence, ri.type, ri.notes, i.label,
             (p.placement_id IS NULL) AS unread,
             regexp_match(i.label, '^(.+?)[[:space:]]*#[[:space:]]*(-?[0-9]+([.][0-9]+)?)[[:space:]]*$') AS m
      FROM live_run_issues ri
      JOIN target t ON t.id = ri.run_id
      JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL
      JOIN issues i ON i.id = ri.issue_id
      LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
    )
    SELECT run_id, id AS placement_id, label, type, notes,
           (SELECT bool_and(m IS NOT NULL) AND COUNT(DISTINCT btrim(m[1])) = 1 FROM parsed) AS single_series
    FROM parsed
    WHERE unread
    ORDER BY sequence
    LIMIT ${limit}
  `;
  return {
    // With nothing unread there are no rows to say which run it was.
    run_id: rows[0]?.run_id ?? runId,
    issues: rows.map((r) => ({ placement_id: r.placement_id, label: r.label, type: r.type, notes: r.notes })),
    // With nothing unread there is nothing to name.
    single_series: rows[0]?.single_series ?? false,
  };
}

/** One wave, not three: the header, the spine and the prerequisites don't
 * depend on each other, so they go out together and a missing run is caught
 * after (task 0.9). An unknown id costs two empty queries; a known one saves
 * two round trips. */
export async function runDetail(userId: string, runId: string) {
  const [[run], rows, prereqs] = await Promise.all([runHeader(userId, runId),
    runSpine(userId, runId), runPrereqs(userId, runId)]);
  if (!run) return null;
  const issues = rows.map(({ first_read_at, first_read_precision, ...r }) => ({
    ...r, read_elsewhere_when: readWhen(first_read_at, first_read_precision),
  }));
  const { last_read_at, last_read_precision, started_at, started_precision, ...header } = run;
  return {
    run: {
      ...header,
      last_read_when: readWhen(last_read_at, last_read_precision),
      // The hero's span line (task 1.17): *Started Mar 2026*, and *Mar–Sep 2026* once read.
      started_when: runSpan(started_at, started_precision),
      span_when: header.state === "read" ? runSpan(started_at, started_precision, last_read_at, last_read_precision) : null,
    },
    issues, prereqs,
  };
}

function runHeader(userId: string, runId: string) {
  return sql<
    (RunRow & {
      notes: string | null; artists: string | null; why_source: "hand" | "claude"; placeholder: boolean;
      credited_issues: number; distinct_issues: number;
      last_read_at: Date | null; last_read_precision: Precision;
      started_at: Date | null; started_precision: Precision;
    })[]
  >`
    SELECT r.*, cl.writers, cl.artists, cl.credited_issues, cl.issue_count AS distinct_issues,
           rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues,
           rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
           COALESCE(ARRAY_AGG(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tracks,
           lr.completed_at AS last_read_at,
           COALESCE(lr.completed_at_precision, 'none') AS last_read_precision,
           st.started_at, COALESCE(sp.completed_at_precision, 'none') AS started_precision,
           q.ordinal AS queued_ordinal
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_state     st ON st.run_id = r.id AND st.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN run_queue q   ON q.run_id = r.id AND q.user_id = ${userId}
    LEFT JOIN run_tracks rt ON rt.run_id = r.id
    LEFT JOIN tracks t      ON t.id = rt.track_id
    -- The fully-read badge's date (task 1.6): the latest dated read here. An
    -- undated read has no date to show, so a run read only that way has none.
    LEFT JOIN LATERAL (
      SELECT p.completed_at, p.completed_at_precision
      FROM live_run_issues ri
      JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.completed_at_precision <> 'none'
      -- On a tie, an exact read wins over a guessed one.
      ORDER BY p.completed_at DESC, (p.completed_at_precision = 'exact') DESC
      LIMIT 1
    ) lr ON true
    -- The precision of the run's start (task 1.17): the read at started_at among
    -- its own placements, an exact one winning a tie (as fp does for the finish).
    LEFT JOIN LATERAL (
      SELECT p.completed_at_precision
      FROM live_run_issues ri
      JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
      WHERE ri.run_id = r.id AND p.completed_at = st.started_at
      ORDER BY (p.completed_at_precision = 'exact') DESC
      LIMIT 1
    ) sp ON true
    WHERE r.id = ${runId} AND r.deleted_at IS NULL
    GROUP BY r.id, rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues,
             cl.writers, cl.artists, cl.credited_issues, cl.issue_count,
             lr.completed_at, lr.completed_at_precision, st.started_at, sp.completed_at_precision, q.ordinal
  `;
}

function runSpine(userId: string, runId: string) {
  // Placements, not issues: type, notes and read state belong to where the issue
  // sits in this run (data model 2.14). `completed` is read *here*; a read in
  // another run does not tick it. An issue appears at most once per run (D-R2-1).
  // `read_elsewhere` is the other runs it is read in, earliest read first, from
  // issue_read_runs: the spine's grey hint (0.8b). It never includes this run, so
  // the hint can return after an untick. The date is only that of a read
  // elsewhere, so it is withheld while the row is read here.
  // `pending`: no Metron record yet, so *metadata pending* (task 1.4c) until 4.1 fills it.
  return sql<{
    id: string; placement_id: number; sequence: number; label: string; type: string;
    notes: string | null; completed: boolean; read_elsewhere: string[];
    first_read_at: Date | null; first_read_precision: Precision; pending: boolean;
  }[]>`
    SELECT ri.issue_id AS id, ri.id AS placement_id, ri.sequence, i.label, ri.type, ri.notes,
           (i.metron_id IS NULL) AS pending,
           (p.placement_id IS NOT NULL) AS completed,
           COALESCE(rr.titles, '{}') AS read_elsewhere,
           CASE WHEN p.placement_id IS NULL THEN irr.first_read_at END AS first_read_at,
           CASE WHEN p.placement_id IS NULL THEN COALESCE(irr.first_read_precision, 'none')
                ELSE 'none' END AS first_read_precision
    FROM live_run_issues ri
    JOIN issues i ON i.id = ri.issue_id
    LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
    LEFT JOIN issue_read_runs irr ON irr.issue_id = ri.issue_id AND irr.user_id = ${userId}
    LEFT JOIN LATERAL (
      SELECT array_agg(r2.title ORDER BY u.o) AS titles
      FROM unnest(irr.run_ids) WITH ORDINALITY u(id, o)
      JOIN runs r2 ON r2.id = u.id
      WHERE u.id <> ri.run_id
    ) rr ON true
    WHERE ri.run_id = ${runId}
    ORDER BY ri.sequence
  `;
}

function runPrereqs(userId: string, runId: string) {
  return sql<{
    id: string; title: string; type: string; pct: number; depth: number;
  }[]>`
    SELECT r.id, r.title, a.type, rp.pct, a.depth
    FROM run_ancestors(${runId}) a
    JOIN runs r          ON r.id = a.run_id AND r.deleted_at IS NULL
    JOIN run_progress rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    ORDER BY a.depth, a.type DESC, r.title
  `;
}

/** Distinct issues in the catalog and how many are read. A crossover placed in
 * three runs counts once, so this is not a sum of runs or tracks; it is read
 * once any of its live placements is (data model 2.14). */
export async function catalogTotals(userId: string) {
  const [row] = await sql<{ total: number; read: number }[]>`
    SELECT COUNT(DISTINCT ri.issue_id)::int AS total,
           (COUNT(DISTINCT ri.issue_id) FILTER (WHERE p.placement_id IS NOT NULL))::int AS read
    FROM live_run_issues ri
    JOIN runs r ON r.id = ri.run_id AND NOT r.placeholder AND r.deleted_at IS NULL
    LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = ${userId}
  `;
  return row;
}

export async function trackSummary(userId: string) {
  return sql<{
    track_id: string; track_name: string; total_runs: number; runs_read: number;
    total_issues: number; read_issues: number; ready_now: number;
  }[]>`
    SELECT * FROM track_progress WHERE user_id = ${userId} ORDER BY track_name
  `;
}

/* ---------------------------------------------------------------- books */

export type BookRow = {
  id: string; title: string; author: string | null; series: string | null;
  series_position: number | null; genre: string | null; word_count: number | null;
  /** `estimated` is pages × words per page, shown with a `~` (task 2.2b). */
  word_count_source: "stated" | "estimated" | null;
  status: string;
  /** The earliest year the book is planned in, from `plan_period` (task 1.7); null when none (On deck, Someday). */
  plan_year: number | null;
  /** The year a `read` book was finished, from `finished_on` (D-21); null otherwise. */
  read_year: number | null;
  /** The latest read's date and precision, for the finish-date control (task 1.5). */
  finished_on: string | null; finished_on_precision: "exact" | "approximate" | "none";
  /** The start shown (task 1.17): the read in progress's, or once Read the latest read's. */
  started_on: string | null; started_on_precision: Precision;
  /** The latest read's finish minus its start in days, when both are exact days; null otherwise. */
  days_taken: number | null;
  rating: number | null; cover_url: string | null;
  /** No external record yet (no Open Library or Hardcover id): *metadata pending* (task 1.4c). */
  pending: boolean;
  /** Its reads by eye and its listens (task 1.23, D-85), from book_reads: *Read 2× · Listened 1×*. */
  reads: number; listens: number;
};

/** `year` is a finished or planned year; `noYear` is the read books that have
 * an undated read (R2-08). A book is under every year it was read in, and under
 * No year if one of its reads has no date,
 * from book_reads, as books_by_year counts it (D-65): a reread doesn't move it
 * out of its first year. An Unlisted book (task 1.21, D-83) is listed only by a
 * search or `status: "unlisted"`, its own chip: *Everything*, the genre and the
 * year chips leave it out. */
export async function listBooks(
  userId: string,
  opts: {
    status?: string; genre?: string; year?: number; noYear?: boolean; q?: string; level?: ToReadLevel;
    /** The Library's order (task 2.2e, D-110): a name from `SORTS` and `asc` or `desc`; anything else is Series. */
    sort?: string; dir?: string;
  } = {},
): Promise<WithTotal<BookRow>[]> {
  const { status = null, genre = null, year = null, noYear = false, level = null } = opts;
  // An empty search box is no search: it must not bring the Unlisted books in.
  const q = opts.q?.trim() || null;
  const { sort, dir } = parseSort(opts.sort, opts.dir);
  return sql<WithTotal<BookRow>[]>`
    SELECT b.id, b.title, a.name AS author, s.name AS series, b.series_position,
           b.genre, b.word_count, b.word_count_source, b.cover_url,
           (b.open_library_id IS NULL AND b.hardcover_id IS NULL) AS pending,
           COALESCE(st.status, 'to_read') AS status,
           CASE WHEN st.status = 'read' THEN extract(year FROM st.finished_on)::int END AS read_year,
           st.finished_on::text AS finished_on, COALESCE(st.finished_on_precision, 'none') AS finished_on_precision,
           -- The start shown (task 1.17): the read in progress's, or once Read the
           -- latest read's, since finishing moves it off book_status (data model
           -- 2.18). Days taken is computed here, never stored (Hard rule 2), and
           -- only between two exact days.
           (CASE WHEN st.status = 'read' THEN lr.started_on ELSE st.started_on END)::text AS started_on,
           COALESCE(CASE WHEN st.status = 'read' THEN lr.started_on_precision ELSE st.started_on_precision END, 'none')
             AS started_on_precision,
           CASE WHEN lr.started_on_precision = 'exact' AND lr.finished_on_precision = 'exact'
                THEN lr.finished_on - lr.started_on END AS days_taken,
           st.rating,
           pl.plan_year,
           COALESCE(rc.reads, 0) AS reads, COALESCE(rc.listens, 0) AS listens,
           COUNT(*) OVER ()::int AS total
    FROM books b
    LEFT JOIN authors a      ON a.id = b.author_id
    LEFT JOIN book_series s  ON s.id = b.series_id
    LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
    -- Plan order reads where a to-read book sits, from the view, never by parsing the period (D-37).
    -- Joined for that sort only: any other, the parameter makes the join match nothing.
    LEFT JOIN to_read_level tl ON ${sort === "plan"}::boolean AND tl.book_id = b.id AND tl.user_id = ${userId}
    -- A Read book's latest read: its start and days taken (task 1.17).
    LEFT JOIN LATERAL (
      SELECT e.started_on, e.started_on_precision, e.finished_on, e.finished_on_precision
      FROM read_events e
      WHERE e.user_id = ${userId} AND e.book_id = b.id
      ORDER BY e.id DESC
      LIMIT 1
    ) lr ON st.status = 'read'
    -- Its reads and listens (task 1.23): derived from the log, never stored (Hard rule 2).
    LEFT JOIN LATERAL (
      SELECT (COUNT(*) FILTER (WHERE r.format = 'text'))::int AS reads,
             (COUNT(*) FILTER (WHERE r.format = 'audio'))::int AS listens
      FROM book_reads r
      WHERE r.user_id = ${userId} AND r.book_id = b.id
    ) rc ON true
    -- A book can be planned in two years (Light Bringer: 2026 and 2027), so
    -- collapse to the earliest to keep one row per book (R2-06). The year is
    -- plan_period's, never parsed from the period here (task 1.7).
    LEFT JOIN LATERAL (
      SELECT MIN(pp.year) AS plan_year FROM plan_period pp
      WHERE pp.book_id = b.id AND pp.user_id = ${userId}
    ) pl ON true
    WHERE b.deleted_at IS NULL
      -- The Reading chip is every read in progress, by eye or by ear (task 1.23).
      AND (${status}::text IS NULL OR COALESCE(st.status,'to_read') = ${status}
           OR (${status} = 'reading' AND st.status = 'listening'))
      AND (${status}::text IS NOT NULL OR ${q}::text IS NOT NULL OR st.status IS DISTINCT FROM 'unlisted')
      AND (${genre}::text  IS NULL OR b.genre = ${genre})
      AND (${year}::int    IS NULL
           OR EXISTS (SELECT 1 FROM book_reads r
                      WHERE r.user_id = ${userId} AND r.book_id = b.id
                        AND extract(year FROM r.finished_on) = ${year})
           OR EXISTS (SELECT 1 FROM plan_period p2
                      WHERE p2.book_id = b.id AND p2.user_id = ${userId}
                        AND p2.year = ${year}))
      AND (NOT ${noYear}::boolean
           OR EXISTS (SELECT 1 FROM book_reads r
                      WHERE r.user_id = ${userId} AND r.book_id = b.id AND r.finished_on IS NULL))
      AND (${q}::text      IS NULL OR b.title ILIKE '%' || ${q} || '%'
                                   OR a.name  ILIKE '%' || ${q} || '%')
      -- The To read filter's level (task 1.9): the level to_read_level assigns, Someday included.
      AND (${level}::text  IS NULL
           OR EXISTS (SELECT 1 FROM to_read_level l
                      WHERE l.user_id = ${userId} AND l.book_id = b.id AND l.level = ${level}))
    ORDER BY ${sql.unsafe(libraryOrder(sort, dir))}
    LIMIT 500
  `;
}

/**
 * The Library's ORDER BY (task 2.2e, D-110). Each key is `(key IS NULL), key
 * <dir>`, so a book with no value is last in either direction, and `b.id`
 * closes the order so a reversal is exact. The text is built from this table
 * and a two-valued direction: nothing the user typed reaches it.
 */
const LIBRARY_KEYS: Record<Sort, { lead?: string; keys: string[] }> = {
  series: { keys: ["s.name", "b.series_position", "b.title"] },
  title: { keys: ["b.title"] },
  author: { keys: ["a.name", "b.title"] },
  length: { keys: ["b.word_count", "b.title"] },
  published: { keys: ["b.published_year", "b.title"] },
  finished: { keys: ["st.finished_on", "b.title"] },
  // A book that is not to read is after every planned one whichever way it runs. Then year by
  // year (On deck and Someday have no year, so they close the list): a year's quarters by quarter
  // and ordinal, its bare-year books after Q4, then On deck before Someday (reversed with the
  // direction, so *Last to first* has Someday before On deck; both stay after every dated book).
  plan: {
    lead: "(tl.book_id IS NULL)",
    keys: ["tl.year", "COALESCE(tl.quarter, 5)", "tl.ordinal", "(tl.level = 'someday')", "b.title"],
  },
};

function libraryOrder(sort: Sort, dir: Dir): string {
  const { lead, keys } = LIBRARY_KEYS[sort];
  const d = dir === "asc" ? "ASC" : "DESC";
  return [...(lead ? [lead] : []), ...keys.map((k) => `(${k} IS NULL), ${k} ${d}`), `b.id ${d}`].join(", ");
}

/** The four places a to-read book sits (D-37): `to_read_level`'s `level`, Someday being no plan row. */
export const TO_READ_LEVELS = ["quarter", "year", "on_deck", "someday"] as const;
export type ToReadLevel = (typeof TO_READ_LEVELS)[number];

/** A book on a status tab (task 1.9). `listened`: it has an `audio` read in the log (task 1.23), for the glyph. */
export type StatusBook = {
  id: string; title: string; author: string | null; series: string | null;
  series_position: number | null; word_count: number | null; listened: boolean;
};

/** A book *In flight*: `status` says which group, Reading or Listening (task 1.23). */
export type FlyingBook = StatusBook & { status: "reading" | "listening" };

/** *In flight* for books (task 1.9): what you are reading, by eye and then by
 * ear (task 1.23). No reading position is stored, so the row shows the word count. */
export async function booksInFlight(userId: string) {
  return sql<FlyingBook[]>`
    SELECT b.id, b.title, a.name AS author, s.name AS series, b.series_position, b.word_count,
           st.status, EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = ${userId} AND e.book_id = b.id AND e.format = 'audio') AS listened
    FROM book_status st
    JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
    LEFT JOIN authors a     ON a.id = b.author_id
    LEFT JOIN book_series s ON s.id = b.series_id
    WHERE st.user_id = ${userId} AND st.status IN ('reading', 'listening')
    ORDER BY (st.status = 'listening'), b.title, b.id
  `;
}

/** A planned book on *Up next* (task 1.9). `ordinal` is its place in its quarter and null at every other level. */
export type PlannedBook = StatusBook & {
  period: string; level: "quarter" | "year" | "on_deck";
  year: number | null; quarter: number | null; ordinal: number | null;
};

/**
 * *Up next* for books (task 1.9): the plan by level, every `to_read` book with a
 * plan row. Quarters first by year and quarter, in the order you gave them; each
 * year's bare-year entries after its quarters, by title; On deck last, by title.
 * A book planned in two periods is in both. `someday` is how many `to_read` books
 * have no plan row: the closing row, never listed here (D-37). Hidden from the
 * tab, and not in either count: a planned book that is reading, read or DNF.
 */
export async function booksUpNext(userId: string) {
  const [planned, [someday]] = await Promise.all([
    sql<PlannedBook[]>`
      SELECT b.id, b.title, a.name AS author, s.name AS series, b.series_position, b.word_count,
             pp.period, pp.level, pp.year, pp.quarter, pp.ordinal, EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = ${userId} AND e.book_id = b.id AND e.format = 'audio') AS listened
      FROM plan_period pp
      JOIN book_status st ON st.book_id = pp.book_id AND st.user_id = pp.user_id AND st.status = 'to_read'
      JOIN books b ON b.id = pp.book_id AND b.deleted_at IS NULL
      LEFT JOIN authors a     ON a.id = b.author_id
      LEFT JOIN book_series s ON s.id = b.series_id
      WHERE pp.user_id = ${userId}
      ORDER BY (pp.level = 'on_deck'), pp.year, pp.quarter NULLS LAST, pp.ordinal, b.title, b.id
    `,
    sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM to_read_level WHERE user_id = ${userId} AND level = 'someday'`,
  ]);
  return { planned, someday: someday.n };
}

/** A finished or stopped book on *Done* (task 1.9). `year` is the finish year; null is *No year*.
 * The dates are the latest read's (task 1.17), for the row's dates line. */
export type DoneBook = StatusBook & {
  status: "read" | "dnf"; year: number | null;
  finished_on: string | null; finished_on_precision: Precision;
  started_on: string | null; started_on_precision: Precision; days_taken: number | null;
};

/**
 * *Done* for books (task 1.9): `read` books, newest finish first and the undated
 * last (S-14), plus the `dnf` ones the screen folds under *Stopped*. The year is
 * the finish year, `extract(year FROM finished_on)`, never a stored column (D-21).
 */
export async function booksDone(userId: string) {
  return sql<DoneBook[]>`
    SELECT b.id, b.title, a.name AS author, s.name AS series, b.series_position, b.word_count,
           st.status, extract(year FROM st.finished_on)::int AS year, EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = ${userId} AND e.book_id = b.id AND e.format = 'audio') AS listened,
           st.finished_on::text AS finished_on, st.finished_on_precision,
           -- The start shown (task 1.17): the read in progress's, or once Read the
           -- latest read's, since finishing moves it off book_status (data model
           -- 2.18). Days taken is computed here, never stored (Hard rule 2), and
           -- only between two exact days.
           (CASE WHEN st.status = 'read' THEN lr.started_on ELSE st.started_on END)::text AS started_on,
           COALESCE(CASE WHEN st.status = 'read' THEN lr.started_on_precision ELSE st.started_on_precision END, 'none')
             AS started_on_precision,
           CASE WHEN lr.started_on_precision = 'exact' AND lr.finished_on_precision = 'exact'
                THEN lr.finished_on - lr.started_on END AS days_taken
    FROM book_status st
    JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
    LEFT JOIN authors a     ON a.id = b.author_id
    LEFT JOIN book_series s ON s.id = b.series_id
    -- A Read book's latest read: its start and days taken (task 1.17).
    LEFT JOIN LATERAL (
      SELECT e.started_on, e.started_on_precision, e.finished_on, e.finished_on_precision
      FROM read_events e
      WHERE e.user_id = ${userId} AND e.book_id = b.id
      ORDER BY e.id DESC
      LIMIT 1
    ) lr ON st.status = 'read'
    WHERE st.user_id = ${userId} AND st.status IN ('read', 'dnf')
    ORDER BY (st.status = 'dnf'), st.finished_on DESC NULLS LAST, b.title, b.id
  `;
}

export async function yearSummary(userId: string) {
  return sql<{ year: number; genre: string | null; books: number; words: number }[]>`
    SELECT year, genre, books, words FROM books_by_year
    WHERE user_id = ${userId} ORDER BY year DESC, books DESC
  `;
}

/** Undated reads (precision `none`), from book_reads as the year chips count
 * theirs (D-65): the ones no year chip can reach. */
export async function readWithoutYear(userId: string): Promise<number> {
  return (await listCounts(userId)).unyeared;
}

/**
 * The master list's two chip counts, in one query (the page's budget, task 0.9):
 * `unyeared`, as `readWithoutYear`; `unlisted`, the live books that are
 * Unlisted (task 1.21), for the *Unlisted · N* chip, hidden at zero.
 */
export async function listCounts(userId: string): Promise<{ unyeared: number; unlisted: number }> {
  const [row] = await sql<{ unyeared: number; unlisted: number }[]>`
    SELECT
      (SELECT COUNT(*)::int
       FROM book_reads r
       JOIN books b ON b.id = r.book_id AND b.deleted_at IS NULL
       WHERE r.user_id = ${userId} AND r.finished_on IS NULL) AS unyeared,
      (SELECT COUNT(*)::int
       FROM book_status st
       JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
       WHERE st.user_id = ${userId} AND st.status = 'unlisted') AS unlisted
  `;
  return row;
}

export async function seriesProgress(userId: string) {
  return sql<{
    series_id: string; name: string; author: string | null;
    books_read: number; total_books: number; pct: number;
  }[]>`
    SELECT series_id, name, author, books_read, total_books, pct
    FROM series_progress
    WHERE user_id = ${userId} AND total_books > 1
    ORDER BY pct DESC NULLS LAST, name
  `;
}

export async function upcomingReleases() {
  return sql<{ id: string; title: string; author: string | null; release_date: string }[]>`
    SELECT b.id, b.title, a.name AS author, rl.release_date
    FROM releases rl
    JOIN books b        ON b.id = rl.book_id
    LEFT JOIN authors a ON a.id = b.author_id
    -- Today is the Eastern day (task 1.16), not the database's UTC one.
    WHERE b.deleted_at IS NULL AND rl.release_date >= (now() AT TIME ZONE 'America/New_York')::date::text
    ORDER BY rl.release_date
    LIMIT 12
  `;
}

/* ------------------------------------------------------------ add issues */

/** What the bulk-entry parser knows (task 1.3c): every series title in the
 * catalog with the volume years it is written with. Read from the labels, the
 * same grammar the parser speaks: `Title (Year) #N` and `Title (Year) Annual #N`.
 * The title is what is left when the volume, an annual marker and the number
 * are cut from the end; a freeform label (`Dark Reign: The Cabal`) names no series. */
export async function knownSeries() {
  return sql<{ title: string; years: number[] }[]>`
    SELECT title, COALESCE(array_agg(DISTINCT year ORDER BY year) FILTER (WHERE year IS NOT NULL), '{}') AS years
    FROM (
      SELECT regexp_replace(label, '( [(][0-9]{4}[)])?( Annual)? #[0-9]+([.][0-9]+)?$', '') AS title,
             substring(label from ' [(]([0-9]{4})[)](?: Annual)? #[0-9]+(?:[.][0-9]+)?$')::int AS year
      FROM issues
      WHERE deleted_at IS NULL AND label ~ ' #[0-9]+([.][0-9]+)?$'
    ) s
    WHERE title <> ''
    GROUP BY title
    ORDER BY title
  `;
}

/**
 * The approved volume rules (task 1.12): which year a bare series name means.
 * The bulk-entry parser reads them with the known series. `run_id` null is any
 * run, `issue_from` / `issue_to` null is any issue.
 */
export async function volumeRules() {
  return sql<{ series: string; runId: string | null; issueFrom: number | null; issueTo: number | null; year: number }[]>`
    SELECT series, run_id AS "runId", issue_from AS "issueFrom", issue_to AS "issueTo", year
    FROM volume_rules ORDER BY id`;
}

/** A run as Add issues sees it: its title and every placement, removed ones
 * too, in reading order. A removed placement is what a re-add restores (S-07). */
export async function addContext(runId: string) {
  const [[run], placements] = await Promise.all([
    sql<{ id: string; title: string }[]>`
      SELECT id, title FROM runs WHERE id = ${runId} AND deleted_at IS NULL AND NOT placeholder`,
    sql<{ id: number; sequence: number; label: string; removed: boolean }[]>`
      SELECT ri.id, ri.sequence, i.label, ri.deleted_at IS NOT NULL AS removed
      FROM run_issues ri
      JOIN issues i ON i.id = ri.issue_id
      WHERE ri.run_id = ${runId}
      ORDER BY ri.sequence`,
  ]);
  return run ? { run, placements } : null;
}

export type AddContext = NonNullable<Awaited<ReturnType<typeof addContext>>>;

/** The catalog rows these labels name, matched case-insensitively (D-54), and
 * how many live runs place each: the review's *already in 3 runs*. A label the
 * catalog doesn't have, or removed from it, is simply absent. */
export async function catalogMatches(labels: string[]) {
  return sql<{ key: string; issue_id: string; label: string; runs: number }[]>`
    SELECT lower(i.label) AS key, i.id AS issue_id, i.label,
           COUNT(DISTINCT r.id)::int AS runs
    FROM issues i
    LEFT JOIN run_issues ri ON ri.issue_id = i.id AND ri.deleted_at IS NULL
    LEFT JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL AND NOT r.placeholder
    WHERE i.deleted_at IS NULL AND lower(i.label) = ANY(${labels.map((l) => l.toLowerCase())}::text[])
    GROUP BY i.id
  `;
}

export type CatalogHit = {
  key: string; issue_id: string; label: string; metron_id: number | null;
  cover_date: string | null; cover_url: string | null; runs: number; in_this_run: boolean;
  /** The live runs placing it, by title: *in 1 run · Thor Tales*. */
  run_titles: string[];
};

/**
 * Add issues, *Search* (task 1.3b): the catalog's own rows for a search, before
 * Metron's. A row matches by series title (case-insensitive), volume year when
 * the query names one, and number when it names any; or because it is one of
 * the comics Metron answered with, by Metron id or by label. Each carries how
 * many live runs place it, which, and whether this run does. A broad search is
 * cut at 100 rows, Metron's matches kept first, so none is listed as only Metron's.
 */
export async function catalogSearch(
  runId: string,
  { title, year, numbers }: { title: string; year: number | null; numbers: string[] },
  also: { metronIds: number[]; labels: string[] },
) {
  const labels = also.labels.map((l) => l.toLowerCase());
  return sql<CatalogHit[]>`
    WITH hit AS (
      SELECT i.id, i.label, i.metron_id, i.cover_date, i.cover_url,
             substring(i.label from '#([^#]+)$') AS number,
             substring(i.label from ' [(]([0-9]{4})[)] #[^#]+$')::int AS year
      FROM issues i
      WHERE i.deleted_at IS NULL AND (
        (lower(regexp_replace(i.label, '( [(][0-9]{4}[)])? #[^#]+$', '')) = lower(${title})
          AND i.label !~ ' Annual #'
          AND (${year}::int IS NULL OR i.label ~ (' [(]' || ${year}::int || '[)] #[^#]+$'))
          AND (cardinality(${numbers}::text[]) = 0 OR substring(i.label from '#([^#]+)$') = ANY(${numbers}::text[])))
        OR i.metron_id = ANY(${also.metronIds}::int[])
        OR lower(i.label) = ANY(${labels}::text[]))
      ORDER BY (COALESCE(i.metron_id = ANY(${also.metronIds}::int[]), false) OR lower(i.label) = ANY(${labels}::text[])) DESC, i.label
      LIMIT 100
    )
    SELECT lower(h.label) AS key, h.id AS issue_id, h.label, h.metron_id,
           h.cover_date::text AS cover_date, h.cover_url,
           COUNT(DISTINCT r.id)::int AS runs,
           COALESCE(bool_or(r.id = ${runId}), false) AS in_this_run,
           COALESCE(array_agg(DISTINCT r.title ORDER BY r.title) FILTER (WHERE r.id IS NOT NULL), '{}') AS run_titles
    FROM hit h
    LEFT JOIN run_issues ri ON ri.issue_id = h.id AND ri.deleted_at IS NULL
    LEFT JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL AND NOT r.placeholder
    GROUP BY h.id, h.label, h.metron_id, h.cover_date, h.cover_url, h.number, h.year
    ORDER BY array_position(${numbers}::text[], h.number) NULLS LAST, h.year NULLS FIRST, h.label
  `;
}

/** Which of these ids `issues` already holds, removed rows included: the id is
 * the primary key either way (D-15). */
export async function takenIds(ids: string[]) {
  if (ids.length === 0) return new Set<string>();
  const rows = await sql<{ id: string }[]>`SELECT id FROM issues WHERE id = ANY(${ids}::text[])`;
  return new Set(rows.map((r) => r.id));
}

/** A real calendar date as `YYYY-MM-DD`: a `1983-02-30` from Metron would fail the insert. */
function isDate(s: string | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * What Metron said about these issues, from the search answers the add flow
 * cached (D-53), younger than 7 days: the insert writes a Metron result's
 * `metron_id`, cover date and cover from Metron's own answer, never from what the
 * browser sends back. An id with no fresh answer is absent.
 */
export async function metronFacts(metronIds: number[]) {
  if (metronIds.length === 0) return new Map<number, { coverDate: string | null; coverUrl: string | null }>();
  const rows = await sql<{ id: number; cover_date: string | null; image: string | null }[]>`
    SELECT DISTINCT ON ((e->>'id')::int) (e->>'id')::int AS id, e->>'cover_date' AS cover_date, e->>'image' AS image
    FROM metron_cache c, jsonb_array_elements(c.body->'results') e
    WHERE c.key LIKE 'issue/%' AND c.fetched_at > now() - make_interval(days => ${FRESH_DAYS})
      AND (e->>'id')::int = ANY(${metronIds}::int[])
    ORDER BY (e->>'id')::int, c.fetched_at DESC`;
  return new Map(rows.map((r) => [r.id, {
    coverDate: isDate(r.cover_date) ? r.cover_date : null,
    coverUrl: r.image || null,
  }]));
}

/** An open quick-capture note (task 1.4b). `kind` null is *Unsure*. */
export type InboxNote = { id: number; raw_text: string; kind: "books" | "comics" | "watch" | null; created_at: Date };

/** Your notes still waiting to be resolved, newest first (task 1.4b, `/inbox`). */
export async function unresolvedNotes(userId: string) {
  return sql<InboxNote[]>`
    SELECT id, raw_text, kind, created_at FROM inbox
    WHERE user_id = ${userId} AND resolved_at IS NULL
    ORDER BY created_at DESC, id DESC`;
}

/** How many notes are waiting: the dashboards' *N in inbox* chip (task 1.4b). */
export async function inboxCount(userId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM inbox WHERE user_id = ${userId} AND resolved_at IS NULL`;
  return row.n;
}

/**
 * Whether Add issues can add to `runId`: not soft-deleted and not a placeholder, as the insert
 * requires. Comics Add never lands on any other run (1.19).
 */
export async function liveRun(runId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM runs WHERE id = ${runId} AND deleted_at IS NULL AND NOT placeholder`;
  return rows.length > 0;
}

/**
 * The run a comics note resolves against (task 1.4b; owner, 2026-10-09): the
 * one holding your most recent dated read, else the first live run by title.
 * Null with no runs at all. The run chip on Add issues changes it.
 */
export async function lastTouchedRun(userId: string): Promise<string | null> {
  const [row] = await sql<{ id: string | null }[]>`
    SELECT COALESCE(
      (SELECT r.id FROM issue_progress p
       JOIN run_issues ri ON ri.id = p.placement_id AND ri.deleted_at IS NULL
       JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL AND NOT r.placeholder
       WHERE p.user_id = ${userId} AND p.completed_at IS NOT NULL
       ORDER BY p.completed_at DESC, r.id LIMIT 1),
      (SELECT id FROM runs WHERE deleted_at IS NULL AND NOT placeholder ORDER BY title, id LIMIT 1)
    ) AS id`;
  return row.id;
}

/** The runs Add issues can add to, for the *Change* picker. */
export async function runChoices() {
  return sql<{ id: string; title: string }[]>`
    SELECT id, title FROM runs WHERE deleted_at IS NULL AND NOT placeholder ORDER BY title`;
}

/** A library book Add books' *Search* lists (task 1.4c). */
export type LibraryHit = {
  id: string; title: string; author: string | null; series: string | null; series_position: number | null;
  published_year: number | null; page_count: number | null; word_count: number | null;
  word_count_source: "stated" | "estimated" | null; cover_url: string | null; hardcover_id: number | null;
  /** No external record yet: *metadata pending*. */
  pending: boolean;
  /** Your status for it, if any. */
  status: string | null;
  /** Where a to-read book sits (`to_read_level`, D-37), and its plan period; null for any other status. */
  level: ToReadLevel | null;
  period: string | null;
  /** Calibre has it (`calibre_id`, task 1.18b, D-90): an Unlisted book reads *Unlisted · Calibre* (task 1.22). */
  calibre: boolean;
  /** How many of your shelves hold it: *on 2 shelves*. */
  shelves: number;
  /** It has at least one listen (task 1.23): the glyph beside its tag. */
  listened: boolean;
};

/**
 * Add books, *Search* (task 1.4c, 1.4f): your library's books for a query,
 * before Hardcover's. A book matches when every word of the query is in its
 * title and author, or because it is one of the books Hardcover answered with,
 * by `hardcover_id` or by its title and one of its authors (`titles` and
 * `authors` are pairs; D-61). Exact titles first; at most 20. Each says where
 * it sits, read from `to_read_level` and never parsed here (task 1.22).
 */
export async function librarySearch(
  userId: string, q: string, also: { hardcoverIds: number[]; titles: string[]; authors: string[] },
) {
  // Each word, its LIKE wildcards escaped, must appear somewhere in title and author.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => `%${w.replace(/[\\%_]/g, "\\$&")}%`);
  return sql<LibraryHit[]>`
    SELECT b.id, b.title, a.name AS author, bs.name AS series, b.series_position,
           b.published_year, b.page_count, b.word_count, b.word_count_source, b.cover_url, b.hardcover_id,
           (b.open_library_id IS NULL AND b.hardcover_id IS NULL) AS pending,
           st.status, tl.level, tl.period, (b.calibre_id IS NOT NULL) AS calibre, EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = ${userId} AND e.book_id = b.id AND e.format = 'audio') AS listened,
           (SELECT COUNT(*) FROM shelf_books sb JOIN shelves sh ON sh.id = sb.shelf_id
            WHERE sb.book_id = b.id AND sh.user_id = ${userId})::int AS shelves
    FROM books b
    LEFT JOIN authors a ON a.id = b.author_id
    LEFT JOIN book_series bs ON bs.id = b.series_id
    LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
    LEFT JOIN to_read_level tl ON tl.book_id = b.id AND tl.user_id = ${userId}
    WHERE b.deleted_at IS NULL AND (
      (cardinality(${words}::text[]) > 0
        AND lower(b.title || ' ' || COALESCE(a.name, '')) LIKE ALL (${words}::text[]))
      OR b.hardcover_id = ANY(${also.hardcoverIds}::int[])
      OR (lower(b.title), lower(a.name)) IN (
        SELECT lower(t), lower(au) FROM unnest(${also.titles}::text[], ${also.authors}::text[]) AS o(t, au)))
    ORDER BY (lower(b.title) = lower(${q.trim()})) DESC, b.title, a.name, b.id
    LIMIT 20
  `;
}

/** Your words per page (architecture § Metadata sources), or the column's default when you have no settings yet. */
export async function wordsPerPage(userId: string): Promise<number> {
  const [row] = await sql<{ wpp: number }[]>`
    SELECT words_per_page AS wpp FROM reading_settings WHERE user_id = ${userId}`;
  return row?.wpp ?? DEFAULT_WORDS_PER_PAGE;
}

/**
 * Your reading pace (task 2.0): the row, or the column defaults when you have none yet. Never
 * cached: another screen reads an edit on its next render, with no redeploy.
 */
export async function readingSettings(userId: string): Promise<ReadingSettings> {
  const [row] = await sql<{ minutesPerDay: number; wordsPerMinute: number; wordsPerPage: number }[]>`
    SELECT minutes_per_day AS "minutesPerDay", words_per_minute AS "wordsPerMinute", words_per_page AS "wordsPerPage"
    FROM reading_settings WHERE user_id = ${userId}`;
  return row ?? DEFAULT_SETTINGS;
}

/** One `plan_capacity` row: a year (`quarter` null) or one of its quarters (task 2.1). */
export interface PeriodCapacity {
  period: string;
  year: number;
  quarter: number | null;
  /** Words you can read in the period at your settings; a quarter is a quarter of the year. */
  capacity: number;
  plannedWords: number;
  statedWords: number;
  estimatedWords: number;
  books: number;
  readBooks: number;
  /** Books with no word count and no plausible page count: in `books`, in no word total. */
  unknownBooks: number;
  /** plannedWords / capacity: 1.18 is 118%. */
  load: number;
  /** The share of plannedWords that rests on estimates; null when nothing is planned. */
  estimatedShare: number | null;
}

/**
 * How full a year and each of its quarters are against your capacity (task 2.1, F-21, D-115),
 * from `plan_capacity`, filtered to the year before it aggregates. A year nothing counts in has no
 * rows there, so it reads as empty at your settings' capacity. A page that reads your settings
 * anyway passes its read (`settings`), so that case costs no second round trip (task 2.2).
 */
export async function planCapacity(
  userId: string, year: number, settings?: Promise<ReadingSettings>,
): Promise<{ year: PeriodCapacity; quarters: PeriodCapacity[] }> {
  const rows = await sql<PeriodCapacity[]>`
    SELECT period, year, quarter, capacity, planned_words AS "plannedWords", stated_words AS "statedWords",
           estimated_words AS "estimatedWords", books, read_books AS "readBooks", unknown_books AS "unknownBooks",
           load, estimated_share AS "estimatedShare"
    FROM plan_capacity WHERE user_id = ${userId} AND year = ${year}
    ORDER BY quarter NULLS FIRST`;
  if (rows.length === 0) {
    const capacity = wordsPerYear(await (settings ?? readingSettings(userId)), year);
    const empty = (quarter: number | null): PeriodCapacity => ({
      period: quarter === null ? String(year) : `${year}-Q${quarter}`, year, quarter,
      capacity: quarter === null ? capacity : capacity / 4,
      plannedWords: 0, statedWords: 0, estimatedWords: 0, books: 0, readBooks: 0, unknownBooks: 0,
      load: 0, estimatedShare: null,
    });
    return { year: empty(null), quarters: [1, 2, 3, 4].map(empty) };
  }
  return { year: rows[0], quarters: rows.slice(1) };
}

/* ── The books dashboard (task 2.2, F-22, D-40) ─────────────────────────────────────────
 * Its five slots: the book in hand or the last finish (Now), the quarter's shelf (Up next),
 * the quarter's strip (This quarter), On deck, and the year so far. The year and the quarter
 * are the caller's, from the Eastern day, so a test can fix them. */

/** A book being read or listened to, for Now. `words` is the stated count, else its pages at
 * your words per page (as plan_book_words estimates), else null; never 0. */
export type InHandBook = {
  id: string; title: string; author: string | null; pages: number | null; words: number | null;
  cover_url: string | null; status: "reading" | "listening";
  started_on: string | null; started_on_precision: Precision;
};

/** What is in hand, the hero first: the most recently started, Reading before Listening on
 * the same day, an undated start last (task 2.2's rule). Empty is *Between books*. */
export async function booksInHand(userId: string) {
  return sql<InHandBook[]>`
    SELECT b.id, b.title, a.name AS author, b.page_count AS pages, b.cover_url,
           COALESCE(b.word_count, CASE WHEN b.page_count >= 50
                                       THEN b.page_count * COALESCE(rs.words_per_page, ${DEFAULT_WORDS_PER_PAGE}) END) AS words,
           st.status, st.started_on::text AS started_on, st.started_on_precision
    FROM book_status st
    JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
    LEFT JOIN authors a ON a.id = b.author_id
    LEFT JOIN reading_settings rs ON rs.user_id = st.user_id
    WHERE st.user_id = ${userId} AND st.status IN ('reading', 'listening')
    ORDER BY st.started_on DESC NULLS LAST, (st.status = 'listening'), b.title, b.id
  `;
}

/** A book on the dashboard's shelf or in On deck. */
export type ShelfBook = {
  id: string; title: string; author: string | null; pages: number | null; words: number | null;
  cover_url: string | null; ordinal: number | null;
};

/** *Up next in Qn* (task 2.2, D-37): the quarter's books still `to_read`, in your order. The
 * first is *Between books*' offer, so a read one is skipped. `period` is `2026-Q4`. */
export async function quarterShelf(userId: string, period: string) {
  return sql<ShelfBook[]>`
    SELECT b.id, b.title, a.name AS author, b.page_count AS pages, b.word_count AS words, b.cover_url, pp.ordinal
    FROM plan_period pp
    JOIN book_status st ON st.user_id = pp.user_id AND st.book_id = pp.book_id AND st.status = 'to_read'
    JOIN books b ON b.id = pp.book_id
    LEFT JOIN authors a ON a.id = b.author_id
    WHERE pp.user_id = ${userId} AND pp.period = ${period}
    ORDER BY pp.ordinal, b.title, b.id
  `;
}

/** One block of the quarter strip: a book that counts against the quarter, with its words. */
export type QuarterBlock = { id: string; title: string; words: number; status: "to_read" | "reading" | "read" };

/**
 * *This quarter*'s blocks (task 2.2, FP-D8): the books `plan_capacity` counts in that quarter,
 * read from the view it sums (`plan_book_words`), so their words add up to the strip's
 * planned total. A book with no word count is counted in `books` but draws no block.
 */
export async function quarterBlocks(userId: string, period: string) {
  return sql<QuarterBlock[]>`
    SELECT w.book_id AS id, b.title, w.words, w.status
    FROM plan_book_words w
    JOIN books b ON b.id = w.book_id
    JOIN reading_plan p ON p.user_id = w.user_id AND p.book_id = w.book_id AND p.period = w.period
    WHERE w.user_id = ${userId} AND w.period = ${period} AND w.words IS NOT NULL
    ORDER BY p.ordinal NULLS LAST, b.title, b.id
  `;
}

/** *On deck* (D-37): the `to_read` books with no year, by title, the first `limit`, and how many in all. */
export async function onDeck(userId: string, limit: number): Promise<{ rows: ShelfBook[]; total: number }> {
  const rows = await sql<(ShelfBook & { total: number })[]>`
    SELECT b.id, b.title, a.name AS author, b.page_count AS pages, b.word_count AS words, b.cover_url,
           NULL::int AS ordinal, COUNT(*) OVER ()::int AS total
    FROM to_read_level l
    JOIN books b ON b.id = l.book_id
    LEFT JOIN authors a ON a.id = b.author_id
    WHERE l.user_id = ${userId} AND l.level = 'on_deck'
    ORDER BY b.title, b.id
    LIMIT ${limit}
  `;
  const total = rows[0]?.total ?? 0;
  for (const r of rows) delete (r as Partial<typeof r>).total;
  return { rows, total };
}

/** The read *Between books* names. `days_taken` only between two exact days (task 1.17). */
export type LastFinish = {
  id: string; title: string; author: string | null; pages: number | null; cover_url: string | null;
  finished_on: string | null; finished_on_precision: Precision; days_taken: number | null; listened: boolean;
};

/** The last finish (task 2.2, §14.2): the latest dated read, else the latest undated one, over
 * every read `book_reads` counts (the log, and a `read` status with none). Null when nothing is
 * finished: *Between books* then omits its finished line. */
export async function lastFinish(userId: string): Promise<LastFinish | null> {
  const [row] = await sql<LastFinish[]>`
    SELECT b.id, b.title, a.name AS author, b.page_count AS pages, b.cover_url,
           r.finished_on::text AS finished_on, r.finished_on_precision,
           CASE WHEN r.started_on_precision = 'exact' AND r.finished_on_precision = 'exact'
                THEN r.finished_on - r.started_on END AS days_taken,
           r.format = 'audio' AS listened
    FROM (
      SELECT e.id, e.book_id, e.finished_on, e.finished_on_precision, e.started_on, e.started_on_precision, e.format
      FROM read_events e WHERE e.user_id = ${userId} AND e.book_id IS NOT NULL
      UNION ALL
      SELECT 0, s.book_id, s.finished_on, s.finished_on_precision, NULL, 'none', 'text'
      FROM book_status s
      WHERE s.user_id = ${userId} AND s.status = 'read'
        AND NOT EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = s.user_id AND e.book_id = s.book_id)
    ) r
    JOIN books b ON b.id = r.book_id AND b.deleted_at IS NULL
    LEFT JOIN authors a ON a.id = b.author_id
    ORDER BY r.finished_on DESC NULLS LAST, r.id DESC
    LIMIT 1
  `;
  return row ?? null;
}

/** *2026 so far*: three counts, all of one year. */
export type YearSoFar = { books: number; listened: number; pages: number; newAuthors: number };

/**
 * *2026 so far* (task 2.2, §14.1): the year's reads from `book_reads` (D-65: a reread counts
 * again), how many were listens (D-85), their pages summed, and the new authors: an author with a
 * read this year and none dated before it or undated. Nothing from another year counts.
 */
export async function yearSoFar(userId: string, year: number): Promise<YearSoFar> {
  const [row] = await sql<YearSoFar[]>`
    WITH r AS (
      SELECT r.finished_on, r.format, b.author_id, b.page_count
      FROM book_reads r JOIN books b ON b.id = r.book_id AND b.deleted_at IS NULL
      WHERE r.user_id = ${userId}
    ), y AS (
      SELECT r.*, NOT EXISTS (
        SELECT 1 FROM r o WHERE o.author_id = r.author_id
          AND (o.finished_on IS NULL OR o.finished_on < make_date(${year}, 1, 1))) AS fresh
      FROM r WHERE extract(year FROM r.finished_on) = ${year}
    )
    SELECT COUNT(*)::int AS books, COUNT(*) FILTER (WHERE format = 'audio')::int AS listened,
           COALESCE(SUM(page_count), 0)::int AS pages,
           COUNT(DISTINCT author_id) FILTER (WHERE fresh)::int AS "newAuthors"
    FROM y
  `;
  return row;
}

/** The volume map's size for Settings' *N rules · M series* (task 2.0): derived, never stored. */
export async function volumeMapCounts(): Promise<{ rules: number; series: number }> {
  const [row] = await sql<{ rules: number; series: number }[]>`
    SELECT count(*)::int AS rules, count(DISTINCT series)::int AS series FROM volume_rules`;
  return row;
}

/** One of your book shelves, for Add books opened from it (task 1.4c), or null. */
export async function shelfFor(userId: string, shelfId: string) {
  const [row] = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM shelves WHERE id = ${shelfId} AND user_id = ${userId} AND kind = 'books'`;
  return row ?? null;
}

/** Your book shelves, for *Add to*'s *Shelf…* (task 1.4c). */
export async function bookShelves(userId: string) {
  return sql<{ id: string; name: string }[]>`
    SELECT id, name FROM shelves WHERE user_id = ${userId} AND kind = 'books' ORDER BY lower(name), id`;
}

type BookMatchRow = {
  i: number;
  match_id: string | null; match_title: string | null; match_author: string | null; match_status: string | null;
  near_id: string | null; near_title: string | null; near_author: string | null; near_status: string | null;
  near_similarity: number | null;
};

/**
 * Add books, *Paste a list* (task 1.4): for each pasted title and author, the
 * live book with the same title and author (case-insensitive, D-25), else the
 * live book whose title is closest at `pg_trgm` similarity ≥ 0.4, each with
 * your status for it. `%` (pg_trgm's default 0.3) lets `books_title_gin_trgm`
 * find the candidates; the 0.4 is applied to them. Answers come back in the
 * order asked.
 */
export async function bookMatches(userId: string, lines: { title: string; author: string | null }[]) {
  if (lines.length === 0) return [];
  const rows = await sql<BookMatchRow[]>`
    WITH q AS (
      SELECT q.title, q.author, q.i::int AS i
      FROM unnest(${lines.map((l) => l.title)}::text[], ${lines.map((l) => l.author)}::text[])
           WITH ORDINALITY AS q(title, author, i)
    )
    SELECT q.i,
           m.id AS match_id, m.title AS match_title, m.author AS match_author, m.status AS match_status,
           n.id AS near_id, n.title AS near_title, n.author AS near_author, n.status AS near_status,
           n.similarity AS near_similarity
    FROM q
    LEFT JOIN LATERAL (
      SELECT b.id, b.title, a.name AS author, st.status
      FROM books b
      JOIN authors a ON a.id = b.author_id
      LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
      WHERE b.deleted_at IS NULL AND q.author IS NOT NULL
        AND lower(b.title) = lower(q.title) AND lower(a.name) = lower(q.author)
      ORDER BY b.id
      LIMIT 1
    ) m ON true
    LEFT JOIN LATERAL (
      SELECT b.id, b.title, a.name AS author, st.status, similarity(b.title, q.title)::float8 AS similarity
      FROM books b
      LEFT JOIN authors a ON a.id = b.author_id
      LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
      WHERE m.id IS NULL AND b.deleted_at IS NULL
        AND b.title % q.title AND similarity(b.title, q.title) >= 0.4
      ORDER BY similarity(b.title, q.title) DESC, b.title, b.id
      LIMIT 1
    ) n ON true
    ORDER BY q.i
  `;
  return rows.map((r) => ({
    match: r.match_id === null ? null
      : { bookId: r.match_id, title: r.match_title!, author: r.match_author, status: r.match_status },
    near: r.near_id === null ? null
      : { bookId: r.near_id, title: r.near_title!, author: r.near_author, status: r.near_status, similarity: r.near_similarity! },
  }));
}

/** One thing a book belongs to (task 2.2c): its series, subseries (2.2h), author, universe or a
 * books shelf it is on, with its progress view's counts and how you follow it (`null`: not
 * following, a stored `off` included). */
export type Grouping = {
  kind: FollowKind; id: string; name: string;
  /** `read / total` as the sheet shows it: a series' total is its stated `total_books`, the rest the books listed. */
  read: number; total: number;
  /** Its live books left: neither read nor DNF, whatever a series states (task 2.2h; 2.2d's
   * `follow_next` skips a DNF too). The offer, *Done with* and *On hold* read this. */
  unread: number;
  state: FollowState | null;
};

/**
 * What a live book belongs to (task 2.2c, the *Follow…* sheet): its series, its subseries
 * (2.2h), its author, its universe, then each books shelf of yours it is on, by name, read
 * from the five progress views (live books only). A book with no series has no series row, and
 * one with no subseries no subseries row. Null for a missing or removed book.
 */
export async function bookGroupings(userId: string, bookId: string): Promise<{ title: string; groupings: Grouping[] } | null> {
  const [book] = await sql<{ title: string }[]>`
    SELECT title FROM books WHERE id = ${bookId} AND deleted_at IS NULL
  `;
  if (!book) return null;
  const groupings = await sql<Grouping[]>`
    WITH b AS (SELECT series_id, subseries_id, author_id, universe_id FROM books WHERE id = ${bookId}),
    -- The live books left: neither read nor DNF (task 2.2h).
    left_ AS (
      SELECT k.id, k.series_id, k.subseries_id, k.author_id, k.universe_id
      FROM books k LEFT JOIN book_status st ON st.book_id = k.id AND st.user_id = ${userId}
      WHERE k.deleted_at IS NULL AND (st.status IS NULL OR st.status NOT IN ('read', 'dnf'))
    )
    SELECT kind, id, name, read, total, unread, state FROM (
      SELECT 'series' AS kind, p.series_id AS id, p.name, p.books_read::int AS read, p.total_books::int AS total,
             (SELECT count(*) FROM left_ l WHERE l.series_id = p.series_id)::int AS unread, p.follow_state AS state, 1 AS ord
      FROM b JOIN series_progress p ON p.series_id = b.series_id AND p.user_id = ${userId}
      UNION ALL
      SELECT 'subseries', p.subseries_id, p.name, p.books_read::int, p.books_listed::int,
             (SELECT count(*) FROM left_ l WHERE l.subseries_id = p.subseries_id)::int, p.follow_state, 2
      FROM b JOIN subseries_progress p ON p.subseries_id = b.subseries_id AND p.user_id = ${userId}
      UNION ALL
      SELECT 'author', p.author_id, p.name, p.books_read::int, p.books_listed::int,
             (SELECT count(*) FROM left_ l WHERE l.author_id = p.author_id)::int, p.follow_state, 3
      FROM b JOIN author_progress p ON p.author_id = b.author_id AND p.user_id = ${userId}
      UNION ALL
      SELECT 'universe', p.universe_id, p.name, p.books_read::int, p.books_listed::int,
             (SELECT count(*) FROM left_ l WHERE l.universe_id = p.universe_id)::int, p.follow_state, 4
      FROM b JOIN universe_progress p ON p.universe_id = b.universe_id AND p.user_id = ${userId}
      UNION ALL
      SELECT 'shelf', p.shelf_id, p.name, p.books_read::int, p.books_listed::int,
             (SELECT count(*) FROM left_ l JOIN shelf_books x ON x.book_id = l.id WHERE x.shelf_id = p.shelf_id)::int,
             p.follow_state, 5
      FROM shelf_books sb JOIN shelf_progress p ON p.shelf_id = sb.shelf_id AND p.user_id = ${userId}
      WHERE sb.book_id = ${bookId}
    ) g
    ORDER BY ord, name, id
  `;
  return { title: book.title, groupings: [...groupings] };
}

/** The book's column naming each kind a book belongs to through. */
const BOOK_COLUMN = { series: "series_id", subseries: "subseries_id", author: "author_id", universe: "universe_id" } as const;

/**
 * Whether you may follow it (task 2.2c, AC-2): a series, a subseries (2.2h), an author or a
 * universe with at least one live book, or a books shelf of yours. A series whose books are all
 * removed, an unknown subseries, or a titles shelf, is refused.
 */
export async function followable(userId: string, kind: FollowKind, id: string): Promise<boolean> {
  const [row] = kind === "shelf"
    ? await sql`SELECT 1 FROM shelves WHERE id = ${id} AND user_id = ${userId} AND kind = 'books'`
    : await sql`SELECT 1 FROM books WHERE deleted_at IS NULL AND ${sql(BOOK_COLUMN[kind])} = ${id} LIMIT 1`;
  return Boolean(row);
}

/**
 * Whether a series, subseries or universe exists at all (task 2.2h): *Not following* on one
 * is a stored `off` row, which needs its target even once every book in it is gone.
 */
export async function followTargetExists(kind: AutoKind, id: string): Promise<boolean> {
  const table = { series: "book_series", subseries: "book_subseries", universe: "book_universes" }[kind];
  const [row] = await sql`SELECT 1 FROM ${sql(table)} WHERE id = ${id}`;
  return Boolean(row);
}

/**
 * What a finish offers (task 2.2c, 2.2h): `now` is what the finish followed for you (*Now
 * reading*, each chip sets it `off`); `take` sets *Reading*; `done` (*Done with …*) sets *Tracking*.
 */
export type FinishOffer = { now: Grouping[]; take: Grouping[]; done: Grouping[] };

/**
 * What finishing a book offers to follow (task 2.2c, D-108; 2.2h, D-117), read after the finish
 * is saved. `followed` is what the finish itself set to *Reading* (`BookStatusChange.follows`):
 * those are `now`. A grouping already *Reading* with no live book left is `done`: the app asks,
 * it never sets it back itself (D-43). One not *Reading* is offered (`take`) when it is the
 * author, or still has a live book left, unless you set it to *Not following* (`off`), which
 * stays out. After a finish from Reading the series, subseries and universe are never in
 * `take`: each was followed, is already *Reading* or `off`, or has nothing left. A past read
 * logged from To read follows nothing, so they are offered as 2.2c did.
 */
export async function finishOffer(
  userId: string, bookId: string, followed: { kind: string; id: string }[] = [],
): Promise<FinishOffer> {
  const found = await bookGroupings(userId, bookId);
  const all = found?.groupings ?? [];
  const off = new Set((await sql<{ key: string }[]>`
    WITH b AS (SELECT series_id, subseries_id, universe_id FROM books WHERE id = ${bookId})
    SELECT 'series:' || f.series_id AS key FROM b JOIN series_follows f
      ON f.series_id = b.series_id AND f.user_id = ${userId} AND f.state = 'off'
    UNION ALL
    SELECT 'subseries:' || f.subseries_id FROM b JOIN subseries_follows f
      ON f.subseries_id = b.subseries_id AND f.state = 'off'
    UNION ALL
    SELECT 'universe:' || f.universe_id FROM b JOIN universe_follows f
      ON f.universe_id = b.universe_id AND f.user_id = ${userId} AND f.state = 'off'
  `).map((r) => r.key));
  const key = (g: { kind: string; id: string }) => `${g.kind}:${g.id}`;
  const now = new Set(followed.map(key));
  return {
    now: all.filter((g) => now.has(key(g))),
    take: all.filter((g) => !now.has(key(g)) && !off.has(key(g)) && g.state !== "reading"
      && (g.kind === "author" || g.unread > 0)),
    done: all.filter((g) => g.state === "reading" && g.unread === 0),
  };
}
