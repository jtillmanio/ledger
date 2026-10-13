-- views.sql — everything your spreadsheet computed in formula columns.
-- Nothing here is stored; it is derived on read. Re-run after any schema change.

-- A placement that counts: neither the placement nor its issue is soft-deleted
-- (task 0.4, R3-06). Every view that reads run_issues reads this instead, so the
-- rule is written once. A soft-deleted placement keeps its issue_progress row;
-- it just stops being counted, and restoring it brings the read mark back.
-- id is the placement, what issue_progress.placement_id points at (task 0.8a).
-- It is last so CREATE OR REPLACE can still apply over the older column list.
CREATE OR REPLACE VIEW live_run_issues AS
SELECT ri.run_id, ri.sequence, ri.issue_id, ri.type, ri.notes, ri.era_id, ri.id
FROM run_issues ri
JOIN issues i ON i.id = ri.issue_id AND i.deleted_at IS NULL
WHERE ri.deleted_at IS NULL;

-- Per-run, per-user completion. Replaces RUNS!Completed / Left / % Done / Status.
-- Counts this run's own placements: an issue read in another run is unread here
-- (ARCHITECTURE 2.14, task 0.8a). run_issues is UNIQUE (run_id, issue_id), so
-- placements and distinct issues are the same number and this agrees with
-- run_credit_line.issue_count (D-R2-1).
CREATE OR REPLACE VIEW run_progress AS
SELECT
  u.id                                                   AS user_id,
  r.id                                                   AS run_id,
  COUNT(ri.issue_id)                                     AS total_issues,
  COUNT(p.placement_id)                                  AS read_issues,
  CASE WHEN COUNT(ri.issue_id) = 0 THEN 0
       ELSE COUNT(p.placement_id)::float8 / COUNT(ri.issue_id) END AS pct,
  CASE WHEN COUNT(ri.issue_id) = 0          THEN 'empty'
       WHEN COUNT(p.placement_id) = 0       THEN 'unread'
       WHEN COUNT(p.placement_id) = COUNT(ri.issue_id) THEN 'read'
       ELSE 'reading' END                                AS state
FROM runs r
CROSS JOIN users u
LEFT JOIN live_run_issues ri     ON ri.run_id = r.id
LEFT JOIN issue_progress p  ON p.placement_id = ri.id AND p.user_id = u.id
WHERE r.deleted_at IS NULL
GROUP BY u.id, r.id;

-- What a run spans: its series-and-issues text and its publication years.
-- Replaces RUNS!Series (and Issues), Start Year and End Year, which were typed
-- by hand and drifted from the reading order (212 of 259 runs disagreed).
--
-- series_issues groups issues by series and volume, in the order each series
-- first appears in the reading order, and collapses consecutive integer issue
-- numbers into ranges:  "Avengers (1998) #0-24, 28-56; Thunderbolts (1997) #0-45".
-- Point issues (#605.1) follow their series' ranges. A label that does not
-- end in a plain issue number ("Dark Reign: The Cabal", "Marvel Graphic Novel
-- (1982) #27 - Emperor Doom") is listed verbatim at its own position.
--
-- start_year / end_year come from the earliest and latest cover date among the
-- run's issues — the publication span, not reading order, so a prologue
-- published later can't make a span run backwards. Undated issues are skipped;
-- dated_issues < issue_count means the span may be incomplete.
CREATE OR REPLACE VIEW run_span AS
-- Each label is parsed once and every later step reads the step before it,
-- never parsed twice: an inlined CTE is re-evaluated at every reference, and the
-- regex is what costs (task 0.9). The regex sits in a LATERAL with OFFSET 0 so
-- it runs on the run's own placements; as a plain column, the filter on it
-- references issues alone and Postgres pushed it onto a scan of every issue.
-- run_id is in every partition and grouping key, so a run filter reaches
-- run_issues. island is the gaps-and-islands key over integer issue numbers.
WITH parsed AS NOT MATERIALIZED (
  SELECT ri.run_id, ri.sequence, i.label, i.cover_date, x.m
  FROM live_run_issues ri
  JOIN issues i ON i.id = ri.issue_id
  CROSS JOIN LATERAL (
    SELECT regexp_match(i.label, '^(.+?)\s*#\s*(-?[0-9]+(\.[0-9]+)?)\s*$') AS m OFFSET 0
  ) x
),
keyed AS NOT MATERIALIZED (
  SELECT run_id, sequence,
         m IS NOT NULL                                   AS numbered,
         CASE WHEN m IS NULL THEN label ELSE btrim(m[1]) END AS grp,
         m[2]::numeric                                   AS num,
         m IS NOT NULL AND m[3] IS NULL                  AS is_integer
  FROM parsed
),
placed AS NOT MATERIALIZED (
  SELECT run_id, numbered, grp, num, is_integer,
         MIN(sequence) OVER (PARTITION BY run_id, numbered, grp) AS first_seq,
         CASE WHEN is_integer THEN
           num - DENSE_RANK() OVER (PARTITION BY run_id, numbered, grp, is_integer ORDER BY num)
         END AS island
  FROM keyed
),
pieces AS NOT MATERIALIZED (
  SELECT run_id, numbered, grp, first_seq,
         CASE WHEN NOT numbered THEN 0 WHEN is_integer THEN 0 ELSE 1 END AS kind,
         MIN(num) AS lo,
         CASE WHEN NOT numbered THEN NULL
              WHEN NOT is_integer OR MIN(num) = MAX(num) THEN MIN(num)::text
              ELSE MIN(num)::text || '-' || MAX(num)::text END AS txt
  FROM placed
  GROUP BY run_id, numbered, grp, first_seq, is_integer,
           -- a point issue by its text, as the label wrote it: #605.1 and
           -- #605.10 are equal numbers but two issues, and both are listed
           CASE WHEN is_integer THEN island::text ELSE num::text END
),
groups AS NOT MATERIALIZED (
  SELECT run_id, first_seq,
         CASE WHEN numbered THEN grp || ' #' || string_agg(txt, ', ' ORDER BY kind, lo, txt)
              ELSE grp END AS txt
  FROM pieces
  GROUP BY run_id, numbered, grp, first_seq
)
SELECT
  r.id                                                        AS run_id,
  COALESCE(c.issue_count, 0)                                  AS issue_count,
  s.series_issues,
  COALESCE(c.dated_issues, 0)                                 AS dated_issues,
  c.first_cover_date,
  c.last_cover_date,
  EXTRACT(YEAR FROM c.first_cover_date)::int                  AS start_year,
  EXTRACT(YEAR FROM c.last_cover_date)::int                   AS end_year
FROM runs r
LEFT JOIN (
  SELECT ri.run_id, COUNT(*) AS issue_count, COUNT(i.cover_date) AS dated_issues,
         MIN(i.cover_date) AS first_cover_date, MAX(i.cover_date) AS last_cover_date
  FROM live_run_issues ri JOIN issues i ON i.id = ri.issue_id
  GROUP BY ri.run_id
) c ON c.run_id = r.id
LEFT JOIN (
  SELECT run_id, string_agg(txt, '; ' ORDER BY first_seq, txt) AS series_issues
  FROM groups GROUP BY run_id
) s ON s.run_id = r.id
WHERE r.deleted_at IS NULL;

-- Direct-prereq readiness. Replaces RUNS!Readiness / Hard Left / Soft Left / Unlocks.
-- A prerequisite is finished when its own placements are read: reading the same
-- issues inside some other run does not finish it (ARCHITECTURE 2.14).
CREATE OR REPLACE VIEW run_readiness AS
SELECT
  rp.user_id,
  rp.run_id,
  COUNT(*) FILTER (WHERE pr.type = 'hard')                      AS hard_total,
  COUNT(*) FILTER (WHERE pr.type = 'hard' AND pp.pct >= 1.0)    AS hard_done,
  COUNT(*) FILTER (WHERE pr.type = 'soft')                      AS soft_total,
  COUNT(*) FILTER (WHERE pr.type = 'soft' AND pp.pct >= 1.0)    AS soft_done,
  CASE
    WHEN COUNT(*) FILTER (WHERE pr.type = 'hard' AND COALESCE(pp.pct, 0) < 1.0) > 0
      THEN 'blocked'
    WHEN COUNT(*) FILTER (WHERE pr.type = 'soft' AND COALESCE(pp.pct, 0) < 1.0) > 0
      THEN 'ready_hard'
    ELSE 'ready_all'
  END                                                           AS readiness
FROM run_progress rp
LEFT JOIN prereqs pr      ON pr.run_id = rp.run_id
                         AND EXISTS (SELECT 1 FROM runs pr_r
                                     WHERE pr_r.id = pr.prereq_run_id AND pr_r.deleted_at IS NULL)
LEFT JOIN run_progress pp ON pp.run_id = pr.prereq_run_id AND pp.user_id = rp.user_id
GROUP BY rp.user_id, rp.run_id;

-- The five run states the UI draws (DIAGRAMS §4, ARCHITECTURE §4): blocked,
-- ready_hard, ready_all, reading, read. run_readiness only knows about
-- prerequisites, so a run you have started is still 'blocked' there; the badge
-- must say 'reading' and suppress the prerequisite badge, so progress wins
-- over readiness. Amber is for blocked only: ready_hard (hard prereqs met, a
-- soft one unread) is reachable and is drawn as an outlined green badge.
-- hard_left / soft_left are direct prerequisites still under 100%; the
-- "N runs first" count is the transitive closure and comes from run_ancestors
-- (task 2.6). finished_at is the latest dated completion of this run's own
-- placements, for "read · Sep 2026"; NULL when every read is undated.
CREATE OR REPLACE VIEW run_state AS
SELECT
  rr.user_id,
  rr.run_id,
  CASE
    WHEN rp.state = 'read'    THEN 'read'
    WHEN rp.state = 'reading' THEN 'reading'
    WHEN rr.readiness = 'blocked'    THEN 'blocked'
    WHEN rr.readiness = 'ready_hard' THEN 'ready_hard'
    ELSE 'ready_all'
  END                                  AS state,
  rr.hard_total - rr.hard_done         AS hard_left,
  rr.soft_total - rr.soft_done         AS soft_left,
  rp.read_issues,
  rp.total_issues,
  CASE WHEN rp.state = 'read' THEN fin.last_read_at END AS finished_at
FROM run_readiness rr
JOIN run_progress rp ON rp.user_id = rr.user_id AND rp.run_id = rr.run_id
LEFT JOIN LATERAL (
  SELECT MAX(p.completed_at) AS last_read_at
  FROM live_run_issues ri
  JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = rr.user_id
  WHERE ri.run_id = rr.run_id
) fin ON true;

-- Read state drawn as run-length segments, for the telescope's run rail. A
-- single fill from the top misreports a range mark or a skipped optional, so
-- every maximal stretch of consecutive placements with the same read state is
-- one row: is_read true is a green segment, false is the gap between. Ordinals
-- are 1-based positions in the run (the "42" in "42 / 381"), not issue numbers,
-- so a run with a gap in `sequence` still lays out contiguously.
-- "Read" means this placement is read, matching run_progress (task 0.8a). The
-- grey dashed "read in another run" layer is drawn from issue_read_runs by the
-- telescope (task 2.5), not by this view.
CREATE OR REPLACE VIEW run_read_segments AS
WITH placed AS (
  SELECT
    u.id AS user_id,
    ri.run_id,
    ROW_NUMBER() OVER (PARTITION BY u.id, ri.run_id ORDER BY ri.sequence) AS ordinal,
    (p.placement_id IS NOT NULL) AS is_read
  FROM live_run_issues ri
  JOIN runs r ON r.id = ri.run_id AND r.deleted_at IS NULL
  CROSS JOIN users u
  LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = u.id
), islands AS (
  SELECT *,
    ordinal - ROW_NUMBER() OVER (PARTITION BY user_id, run_id, is_read ORDER BY ordinal) AS grp
  FROM placed
)
SELECT
  user_id,
  run_id,
  is_read,
  MIN(ordinal)::int AS from_ordinal,
  MAX(ordinal)::int AS to_ordinal,
  COUNT(*)::int     AS len
FROM islands
GROUP BY user_id, run_id, is_read, grp;

-- Transitive closure: every run that must come before a given run, at any depth.
-- This is the CLOSURE tab you abandoned in Sheets.
--
-- UNION, not UNION ALL, and no path array (R2-01). A path array makes the walk
-- enumerate every simple path, which is exponential on the real graph's 100-run
-- cyclic component; UNION dedupes on (run_id, type, depth) so the walk is bounded
-- by nodes x 2 types x cap and still terminates on a cycle. The cap is 48 (D-6).
-- A run is never its own ancestor (R2-04), even when it sits in a cycle.
CREATE OR REPLACE FUNCTION run_ancestors(target text)
RETURNS TABLE (run_id text, type text, depth int) AS $$
  WITH RECURSIVE walk(run_id, type, depth) AS (
    SELECT p.prereq_run_id, p.type, 1
    FROM prereqs p
    JOIN runs pr ON pr.id = p.prereq_run_id AND pr.deleted_at IS NULL
    WHERE p.run_id = target
    UNION
    SELECT p.prereq_run_id,
           CASE WHEN w.type = 'hard' AND p.type = 'hard' THEN 'hard' ELSE 'soft' END,
           w.depth + 1
    FROM prereqs p
    JOIN walk w ON p.run_id = w.run_id
    JOIN runs pr ON pr.id = p.prereq_run_id AND pr.deleted_at IS NULL
    WHERE w.depth < 48
  )
  SELECT w.run_id, MIN(w.type) AS type, MIN(w.depth)::int AS depth
  FROM walk w
  WHERE w.run_id <> target
  GROUP BY w.run_id;
$$ LANGUAGE sql STABLE;

-- Events point at runs; track associations are derived through run_tracks.
-- Replaces the old event_tracks table.
CREATE OR REPLACE VIEW event_tracks AS
SELECT DISTINCT er.event_id, rt.track_id
FROM event_runs er
JOIN runs r ON r.id = er.run_id AND r.deleted_at IS NULL
JOIN run_tracks rt ON rt.run_id = er.run_id;

-- Distinct issues and distinct read issues per user, per track and per block.
-- A crossover issue placed in three runs of one track counts once, which is
-- why these don't SUM run_progress. An issue is read in a scope when any of its
-- placements inside that scope is read; a read in a run outside it does not
-- count (ARCHITECTURE 2.14).
CREATE OR REPLACE VIEW track_issue_counts AS
SELECT u.id AS user_id, rt.track_id,
       COUNT(DISTINCT ri.issue_id)                                           AS total_issues,
       COUNT(DISTINCT ri.issue_id) FILTER (WHERE p.placement_id IS NOT NULL) AS read_issues
FROM run_tracks rt
JOIN runs r         ON r.id = rt.run_id AND NOT r.placeholder AND r.deleted_at IS NULL
JOIN live_run_issues ri  ON ri.run_id = r.id
CROSS JOIN users u
LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = u.id
GROUP BY u.id, rt.track_id;

CREATE OR REPLACE VIEW block_issue_counts AS
SELECT u.id AS user_id, r.block_id,
       COUNT(DISTINCT ri.issue_id)                                           AS total_issues,
       COUNT(DISTINCT ri.issue_id) FILTER (WHERE p.placement_id IS NOT NULL) AS read_issues
FROM runs r
JOIN live_run_issues ri  ON ri.run_id = r.id
CROSS JOIN users u
LEFT JOIN issue_progress p ON p.placement_id = ri.id AND p.user_id = u.id
WHERE NOT r.placeholder AND r.deleted_at IS NULL AND r.block_id IS NOT NULL
GROUP BY u.id, r.block_id;

-- "You've read this before": per user and issue, the runs in which a live
-- placement of it is read, earliest read first. A hint for the spine (0.8b) and
-- the telescope (2.5); it never checks a box (ARCHITECTURE 2.14).
-- first_read_at ignores undated reads (precision 'none') and is NULL when every
-- read is undated; first_read_precision is that read's precision, 'none' when
-- first_read_at is NULL, so the range sheet's *Original dates* can copy it (S-15).
-- run_ids needs no DISTINCT: a run places an issue at most once (D-19).
CREATE OR REPLACE VIEW issue_read_runs AS
SELECT
  p.user_id,
  ri.issue_id,
  array_agg(ri.run_id ORDER BY p.completed_at NULLS LAST, ri.run_id)    AS run_ids,
  MIN(p.completed_at) FILTER (WHERE p.completed_at_precision <> 'none') AS first_read_at,
  COALESCE(
    (array_agg(p.completed_at_precision
               ORDER BY p.completed_at, p.completed_at_precision DESC)
       FILTER (WHERE p.completed_at_precision <> 'none'))[1],
    'none')                                                             AS first_read_precision
FROM issue_progress p
JOIN live_run_issues ri ON ri.id = p.placement_id
JOIN runs r             ON r.id = ri.run_id AND r.deleted_at IS NULL
GROUP BY p.user_id, ri.issue_id;

-- Per-track rollup. Replaces the TRACKS tab.
CREATE OR REPLACE VIEW track_progress AS
SELECT
  rp.user_id,
  t.id                                                  AS track_id,
  t.name                                                AS track_name,
  COUNT(DISTINCT r.id)                                  AS total_runs,
  COUNT(DISTINCT r.id) FILTER (WHERE rp.state = 'read') AS runs_read,
  COALESCE(MAX(tc.total_issues), 0)                     AS total_issues,
  COALESCE(MAX(tc.read_issues), 0)                      AS read_issues,
  COUNT(DISTINCT r.id) FILTER (
    WHERE rd.readiness = 'ready_all' AND rp.state = 'unread'
  )                                                     AS ready_now
FROM tracks t
JOIN run_tracks rt    ON rt.track_id = t.id
JOIN runs r           ON r.id = rt.run_id AND NOT r.placeholder AND r.deleted_at IS NULL
JOIN run_progress rp  ON rp.run_id = r.id
JOIN run_readiness rd ON rd.run_id = r.id AND rd.user_id = rp.user_id
LEFT JOIN track_issue_counts tc ON tc.track_id = t.id AND tc.user_id = rp.user_id
GROUP BY rp.user_id, t.id, t.name;

-- Where a run sits: "run 3 of 5 in block 2 of 7". User-independent, so the
-- dashboard joins it once and gets both ordinals in a single row. Runs with no
-- block are absent — LEFT JOIN and render nothing when the row is missing.
-- Ties on sequence (the sheet has a few) break on run id, so an ordinal is
-- stable between queries rather than shuffling.
CREATE OR REPLACE VIEW block_position AS
SELECT
  run_id, block_id, track_id, block_number, block_name,
  run_ordinal, block_runs, block_ordinal,
  MAX(block_ordinal) OVER (PARTITION BY track_id) AS track_blocks
FROM (
  SELECT
    r.id        AS run_id,
    b.id        AS block_id,
    b.track_id,
    b.number    AS block_number,
    b.name      AS block_name,
    ROW_NUMBER() OVER (PARTITION BY b.id ORDER BY r.sequence NULLS LAST, r.id) AS run_ordinal,
    COUNT(*)     OVER (PARTITION BY b.id)                                      AS block_runs,
    DENSE_RANK() OVER (PARTITION BY b.track_id ORDER BY b.number)              AS block_ordinal
  FROM runs r
  JOIN blocks b ON b.id = r.block_id
  WHERE NOT r.placeholder AND r.deleted_at IS NULL
) x;

-- Per-block rollup, same column shape as track_progress so the dashboard can
-- treat the two interchangeably.
CREATE OR REPLACE VIEW block_progress AS
SELECT
  rp.user_id,
  b.id                                                  AS block_id,
  b.track_id,
  b.number                                              AS block_number,
  b.name                                                AS block_name,
  COUNT(DISTINCT r.id)                                  AS total_runs,
  COUNT(DISTINCT r.id) FILTER (WHERE rp.state = 'read') AS runs_read,
  COALESCE(MAX(bc.total_issues), 0)                     AS total_issues,
  COALESCE(MAX(bc.read_issues), 0)                      AS read_issues,
  CASE WHEN COALESCE(MAX(bc.total_issues), 0) = 0 THEN 0
       ELSE MAX(bc.read_issues)::float8 / MAX(bc.total_issues) END AS pct
FROM blocks b
JOIN runs r          ON r.block_id = b.id AND NOT r.placeholder AND r.deleted_at IS NULL
JOIN run_progress rp ON rp.run_id = r.id
LEFT JOIN block_issue_counts bc ON bc.block_id = b.id AND bc.user_id = rp.user_id
GROUP BY rp.user_id, b.id, b.track_id, b.number, b.name;

-- Who made a run, from its issues' credits. Replaces RUNS!Writer and Artists,
-- which are no longer loaded. share is the fraction of the run's issues that
-- carry any credit in that role, so an uncredited issue neither helps nor hurts.
-- placed is NOT MATERIALIZED because it is read twice, and Postgres materializes
-- a CTE read twice: a run filter could not reach it, so every read of
-- run_credit_line built all 87k placed credits and scanned them once per run
-- (task 0.9: the run list spent 5.2 of its 5.8 s there). Inlined, run_id
-- pushes down to run_issues' index.
CREATE OR REPLACE VIEW run_creators AS
WITH placed AS NOT MATERIALIZED (
  SELECT DISTINCT ri.run_id, ic.issue_id, ic.creator_id, ic.role
  FROM live_run_issues ri
  JOIN issue_credits ic ON ic.issue_id = ri.issue_id
),
credited AS (
  SELECT run_id, role, COUNT(DISTINCT issue_id) AS issues
  FROM placed GROUP BY run_id, role
)
SELECT
  p.run_id, p.creator_id, c.name, p.role,
  COUNT(*)                                   AS issues,
  COUNT(*)::float8 / cr.issues               AS share
FROM placed p
JOIN creators c  ON c.id = p.creator_id
JOIN credited cr ON cr.run_id = p.run_id AND cr.role = p.role
GROUP BY p.run_id, p.creator_id, c.name, p.role, cr.issues;

-- A run's credit line: the writers and artists on at least a quarter of its
-- credited issues, most issues first, at most three each. Derived only — there
-- is no hand-typed fallback. credited_issues < issue_count means the line may be
-- incomplete; zero means the run has no credits yet and both lines are null.
-- Ranked once for every run with a window, then joined, rather than a LIMIT 3
-- subquery per row: the run list asked 258 times (task 0.9). The window is
-- partitioned by run, so a single-run read still filters before it ranks.
CREATE OR REPLACE VIEW run_credit_line AS
WITH ranked AS NOT MATERIALIZED (
  SELECT run_id, role, name, issues,
         ROW_NUMBER() OVER (PARTITION BY run_id, role ORDER BY issues DESC, name) AS rn
  FROM run_creators
  WHERE role IN ('writer', 'artist') AND share >= 0.25
)
SELECT
  r.id AS run_id,
  w.names                                                AS writers,
  a.names                                                AS artists,
  COALESCE(ci.credited_issues, 0)                        AS credited_issues,
  COALESCE(ci.issue_count, 0)                            AS issue_count
FROM runs r
LEFT JOIN (
  SELECT run_id, string_agg(name, ', ' ORDER BY issues DESC, name) AS names
  FROM ranked WHERE role = 'writer' AND rn <= 3 GROUP BY run_id
) w ON w.run_id = r.id
LEFT JOIN (
  SELECT run_id, string_agg(name, ', ' ORDER BY issues DESC, name) AS names
  FROM ranked WHERE role = 'artist' AND rn <= 3 GROUP BY run_id
) a ON a.run_id = r.id
LEFT JOIN (
  SELECT ri.run_id,
         COUNT(DISTINCT ri.issue_id)                                        AS issue_count,
         COUNT(DISTINCT ri.issue_id) FILTER (WHERE EXISTS (
           SELECT 1 FROM issue_credits ic WHERE ic.issue_id = ri.issue_id)) AS credited_issues
  FROM live_run_issues ri GROUP BY ri.run_id
) ci ON ci.run_id = r.id
WHERE r.deleted_at IS NULL;

-- Every finished read of a book (task 1.5, D-65): each read_events row, plus a
-- `read` status that has no log row yet (one loaded from the workbook before
-- the log existed), which stands for its single read. A book read twice is two
-- rows, so a reread counts in the year it happened and the first read keeps
-- its year. A read with no date ('none') has a NULL finished_on and is in no year.
CREATE OR REPLACE VIEW book_reads AS
SELECT e.user_id, e.book_id, e.finished_on, e.finished_on_precision
FROM read_events e
WHERE e.book_id IS NOT NULL
UNION ALL
SELECT s.user_id, s.book_id, s.finished_on, s.finished_on_precision
FROM book_status s
WHERE s.status = 'read'
  AND NOT EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = s.user_id AND e.book_id = s.book_id);

-- Reads per year per genre. Replaces the Read 20XX tabs. The year is derived
-- from the finish date (D-21): a year-only finish is its July 1st, 'approximate',
-- so it lands in its year; an undated read is in no year, and the books page's
-- *No year* chip counts it instead. `books` counts reads: a book read in 2019
-- and again in 2026 is one in each.
CREATE OR REPLACE VIEW books_by_year AS
SELECT r.user_id, extract(year FROM r.finished_on)::int AS year, b.genre,
       COUNT(*) AS books, SUM(b.word_count) AS words
FROM book_reads r JOIN books b ON b.id = r.book_id
WHERE r.finished_on IS NOT NULL AND b.deleted_at IS NULL
GROUP BY r.user_id, extract(year FROM r.finished_on)::int, b.genre;

-- Series completion. Replaces the Series tab.
CREATE OR REPLACE VIEW series_progress AS
SELECT
  u.id AS user_id, bs.id AS series_id, bs.name, a.name AS author,
  COUNT(b.id)                                           AS books_listed,
  COALESCE(bs.total_books, COUNT(b.id))                 AS total_books,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COALESCE(bs.total_books, COUNT(b.id)), 0)  AS pct
FROM book_series bs
CROSS JOIN users u
LEFT JOIN authors a     ON a.id = bs.author_id
LEFT JOIN books b       ON b.series_id = bs.id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = u.id
GROUP BY u.id, bs.id, bs.name, a.name, bs.total_books;

-- Not here yet: show_progress and franchise_progress arrive with task 8.1,
-- because titles, seasons and season_status do not exist until then. When they
-- do, show_progress.state must be
--   unknown | to_watch | watching | watched | dropped
-- and must read a title_status row (kind 'tv', status 'dropped') FIRST, before
-- deriving from season_status. `dropped` is the one show-level status that is
-- stored; watching and watched never are (ARCHITECTURE 2.5b, DIAGRAMS 8b).

-- Indexes that matter at 10k issues.
CREATE INDEX IF NOT EXISTS runs_block_seq   ON runs (block_id, sequence);
CREATE INDEX IF NOT EXISTS progress_user    ON issue_progress (user_id);
-- Book title search (listBooks: title ILIKE '%q%') and task 1.4's near-duplicate
-- check both need trigrams. The old books_title_trgm was a btree on lower(title)
-- that neither could use, whatever its name said (R2 L-2).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'books_title_trgm') THEN
    DROP INDEX books_title_trgm;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS books_title_gin_trgm ON books USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS status_user_year ON book_status (user_id, (extract(year FROM finished_on)));

-- Planner statistics, last. Every view filters deleted_at (task 0.4), and a
-- column added by a migration has no statistics until something ANALYZEs it;
-- Neon's autovacuum may never get there on a database that scales to zero.
-- Without them the planner takes runs and run_issues for one row each and nests
-- loops over all 10k placements: the comics pages ran past Vercel's 300 s limit
-- on a preview of live (2026-10-02) and finished once analyzed (the run list
-- still took 5.8 s of query time until task 0.9 fixed the views). Every path
-- that changes the schema or reloads data applies this file afterwards (Release,
-- the preview build, load.ps1/.sh, test:db:reset), so this is where it goes.
-- Public tables only: a bare ANALYZE warns once per system catalog it may not touch.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT format('%I.%I', schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE 'ANALYZE ' || t;
  END LOOP;
END $$;
