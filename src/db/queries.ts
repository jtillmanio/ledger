import { sql } from "./index";
import { readWhen, type Precision } from "@/lib/format";
import { FRESH_DAYS } from "@/lib/metron";
import { DEFAULT_WORDS_PER_PAGE } from "@/lib/book-add";

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
           rd.soft_total - rd.soft_done AS soft_left
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN run_tracks rt ON rt.run_id = r.id
    LEFT JOIN tracks t      ON t.id = rt.track_id
    LEFT JOIN blocks b      ON b.id = r.block_id
    WHERE NOT r.placeholder AND r.deleted_at IS NULL
      AND (${track ?? null}::text IS NULL OR t.id = ${track ?? null})
    GROUP BY r.id, b.number, rp.total_issues, rp.read_issues, rp.pct, rp.state,
             rd.readiness, rd.hard_total, rd.hard_done, rd.soft_total, rd.soft_done,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues, cl.writers
    ORDER BY b.number NULLS LAST, r.sequence NULLS LAST, rs.start_year NULLS LAST
  `;
}

/** The "what can I start tonight" list. Replaces the DASHBOARD tab. */
export async function readyToRead(userId: string, limit = 20) {
  return sql<WithTotal<RunRow>[]>`
    SELECT r.id, r.title, cl.writers, rs.series_issues, rs.start_year, rs.end_year,
           rs.dated_issues, r.tier, r.why, r.spine,
           COALESCE(ARRAY_AGG(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tracks,
           rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
           rd.hard_total - rd.hard_done AS hard_left,
           rd.soft_total - rd.soft_done AS soft_left,
           COUNT(*) OVER ()::int AS total
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
    LEFT JOIN run_tracks rt ON rt.run_id = r.id
    LEFT JOIN tracks t      ON t.id = rt.track_id
    WHERE NOT r.placeholder AND r.deleted_at IS NULL
      AND rp.state = 'unread'
      AND rd.readiness = 'ready_all'
      AND rp.total_issues > 0
    GROUP BY r.id, rp.total_issues, rp.read_issues, rp.pct, rp.state,
             rd.readiness, rd.hard_total, rd.hard_done, rd.soft_total, rd.soft_done,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues, cl.writers
    ORDER BY r.tier NULLS LAST, rp.total_issues ASC
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
           'ready_all' AS readiness, 0 AS hard_left, 0 AS soft_left,
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
  const { last_read_at, last_read_precision, ...header } = run;
  return { run: { ...header, last_read_when: readWhen(last_read_at, last_read_precision) }, issues, prereqs };
}

function runHeader(userId: string, runId: string) {
  return sql<
    (RunRow & {
      notes: string | null; artists: string | null; why_source: "hand" | "claude";
      credited_issues: number; distinct_issues: number;
      last_read_at: Date | null; last_read_precision: Precision;
    })[]
  >`
    SELECT r.*, cl.writers, cl.artists, cl.credited_issues, cl.issue_count AS distinct_issues,
           rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues,
           rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
           COALESCE(ARRAY_AGG(t.name ORDER BY t.name)
                    FILTER (WHERE t.name IS NOT NULL), '{}') AS tracks,
           lr.completed_at AS last_read_at,
           COALESCE(lr.completed_at_precision, 'none') AS last_read_precision
    FROM runs r
    JOIN run_progress  rp ON rp.run_id = r.id AND rp.user_id = ${userId}
    JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = ${userId}
    JOIN run_span      rs ON rs.run_id = r.id
    JOIN run_credit_line cl ON cl.run_id = r.id
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
    WHERE r.id = ${runId} AND r.deleted_at IS NULL
    GROUP BY r.id, rp.total_issues, rp.read_issues, rp.pct, rp.state, rd.readiness,
             rs.series_issues, rs.start_year, rs.end_year, rs.dated_issues,
             cl.writers, cl.artists, cl.credited_issues, cl.issue_count,
             lr.completed_at, lr.completed_at_precision
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
  status: string;
  /** The earliest year the book is planned in, from `plan_period` (task 1.7); null when none (On deck, Someday). */
  plan_year: number | null;
  /** The year a `read` book was finished, from `finished_on` (D-21); null otherwise. */
  read_year: number | null;
  /** The latest read's date and precision, for the finish-date control (task 1.5). */
  finished_on: string | null; finished_on_precision: "exact" | "approximate" | "none";
  rating: number | null; cover_url: string | null;
  /** No external record yet (no Open Library or Hardcover id): *metadata pending* (task 1.4c). */
  pending: boolean;
};

/** `year` is a finished or planned year; `noYear` is the read books that have
 * an undated read (R2-08). A book is under every year it was read in, and under
 * No year if one of its reads has no date,
 * from book_reads, as books_by_year counts it (D-65): a reread doesn't move it
 * out of its first year. */
export async function listBooks(
  userId: string,
  opts: { status?: string; genre?: string; year?: number; noYear?: boolean; q?: string } = {},
): Promise<WithTotal<BookRow>[]> {
  const { status = null, genre = null, year = null, noYear = false, q = null } = opts;
  return sql<WithTotal<BookRow>[]>`
    SELECT b.id, b.title, a.name AS author, s.name AS series, b.series_position,
           b.genre, b.word_count, b.cover_url,
           (b.open_library_id IS NULL AND b.hardcover_id IS NULL) AS pending,
           COALESCE(st.status, 'to_read') AS status,
           CASE WHEN st.status = 'read' THEN extract(year FROM st.finished_on)::int END AS read_year,
           st.finished_on::text AS finished_on, COALESCE(st.finished_on_precision, 'none') AS finished_on_precision,
           st.rating,
           pl.plan_year,
           COUNT(*) OVER ()::int AS total
    FROM books b
    LEFT JOIN authors a      ON a.id = b.author_id
    LEFT JOIN book_series s  ON s.id = b.series_id
    LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
    -- A book can be planned in two years (Light Bringer: 2026 and 2027), so
    -- collapse to the earliest to keep one row per book (R2-06). The year is
    -- plan_period's, never parsed from the period here (task 1.7).
    LEFT JOIN LATERAL (
      SELECT MIN(pp.year) AS plan_year FROM plan_period pp
      WHERE pp.book_id = b.id AND pp.user_id = ${userId}
    ) pl ON true
    WHERE b.deleted_at IS NULL
      AND (${status}::text IS NULL OR COALESCE(st.status,'to_read') = ${status})
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
    ORDER BY s.name NULLS LAST, b.series_position NULLS LAST, b.title
    LIMIT 500
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
  const [row] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n
    FROM book_reads r
    JOIN books b ON b.id = r.book_id AND b.deleted_at IS NULL
    WHERE r.user_id = ${userId} AND r.finished_on IS NULL
  `;
  return row.n;
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
  word_count_source: "stated" | "estimated" | null; cover_url: string | null; open_library_id: string | null;
  /** No external record yet: *metadata pending*. */
  pending: boolean;
  /** Your status for it, if any. */
  status: string | null;
  /** How many of your shelves hold it: *on 2 shelves*. */
  shelves: number;
};

/**
 * Add books, *Search* (task 1.4c): your library's books for a query, before
 * Open Library's. A book matches when every word of the query is in its title
 * and author, or because it is one of the books Open Library answered with,
 * by work id or by the same title and author (D-61). Exact titles first; at
 * most 20.
 */
export async function librarySearch(
  userId: string, q: string, also: { openLibraryIds: string[]; titles: string[]; authors: string[] },
) {
  // Each word, its LIKE wildcards escaped, must appear somewhere in title and author.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map((w) => `%${w.replace(/[\\%_]/g, "\\$&")}%`);
  return sql<LibraryHit[]>`
    SELECT b.id, b.title, a.name AS author, bs.name AS series, b.series_position,
           b.published_year, b.page_count, b.word_count, b.word_count_source, b.cover_url, b.open_library_id,
           (b.open_library_id IS NULL AND b.hardcover_id IS NULL) AS pending,
           st.status,
           (SELECT COUNT(*) FROM shelf_books sb JOIN shelves sh ON sh.id = sb.shelf_id
            WHERE sb.book_id = b.id AND sh.user_id = ${userId})::int AS shelves
    FROM books b
    LEFT JOIN authors a ON a.id = b.author_id
    LEFT JOIN book_series bs ON bs.id = b.series_id
    LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = ${userId}
    WHERE b.deleted_at IS NULL AND (
      (cardinality(${words}::text[]) > 0
        AND lower(b.title || ' ' || COALESCE(a.name, '')) LIKE ALL (${words}::text[]))
      OR b.open_library_id = ANY(${also.openLibraryIds}::text[])
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
