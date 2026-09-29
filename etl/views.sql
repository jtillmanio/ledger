-- views.sql — everything your spreadsheet computed in formula columns.
-- Nothing here is stored; it is derived on read. Re-run after any schema change.

-- Per-run, per-user completion. Replaces RUNS!Completed / Left / % Done / Status.
-- Counts placements: an issue read in another run counts as read here too,
-- because progress belongs to the issue, not to where it sits (until task 0.8).
-- run_issues is UNIQUE (run_id, issue_id), so placements and distinct issues
-- are the same number and this agrees with run_credit_line.issue_count (D-R2-1).
CREATE OR REPLACE VIEW run_progress AS
SELECT
  u.id                                                   AS user_id,
  r.id                                                   AS run_id,
  COUNT(ri.issue_id)                                     AS total_issues,
  COUNT(p.issue_id)                                      AS read_issues,
  CASE WHEN COUNT(ri.issue_id) = 0 THEN 0
       ELSE COUNT(p.issue_id)::float8 / COUNT(ri.issue_id) END AS pct,
  CASE WHEN COUNT(ri.issue_id) = 0          THEN 'empty'
       WHEN COUNT(p.issue_id) = 0           THEN 'unread'
       WHEN COUNT(p.issue_id) = COUNT(ri.issue_id) THEN 'read'
       ELSE 'reading' END                                AS state
FROM runs r
CROSS JOIN users u
LEFT JOIN run_issues ri     ON ri.run_id = r.id
LEFT JOIN issue_progress p  ON p.issue_id = ri.issue_id AND p.user_id = u.id
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
WITH parsed AS NOT MATERIALIZED (
  SELECT
    ri.run_id, ri.sequence, i.label, i.cover_date,
    regexp_match(i.label, '^(.+?)\s*#\s*(-?[0-9]+(\.[0-9]+)?)\s*$') AS m
  FROM run_issues ri
  JOIN issues i ON i.id = ri.issue_id
),
numbered AS NOT MATERIALIZED (
  SELECT
    run_id, sequence, label, cover_date,
    btrim(m[1])                            AS series,
    m[2]::numeric                          AS num,
    m[3] IS NULL                           AS is_integer
  FROM parsed
  WHERE m IS NOT NULL
),
-- Gaps-and-islands over distinct integer numbers within a series.
islands AS (
  SELECT run_id, series, num,
         num - ROW_NUMBER() OVER (PARTITION BY run_id, series ORDER BY num) AS island
  FROM (SELECT DISTINCT run_id, series, num FROM numbered WHERE is_integer) d
),
ranges AS (
  SELECT run_id, series, MIN(num) AS lo,
         CASE WHEN MIN(num) = MAX(num) THEN MIN(num)::text
              ELSE MIN(num)::text || '-' || MAX(num)::text END AS txt
  FROM islands
  GROUP BY run_id, series, island
),
points AS (
  SELECT DISTINCT run_id, series, num AS lo, num::text AS txt
  FROM numbered WHERE NOT is_integer
),
series_parts AS (
  SELECT run_id, series,
         string_agg(txt, ', ' ORDER BY kind, lo) AS numbers
  FROM (SELECT run_id, series, lo, txt, 0 AS kind FROM ranges
        UNION ALL
        SELECT run_id, series, lo, txt, 1 AS kind FROM points) x
  GROUP BY run_id, series
),
groups AS (
  SELECT n.run_id, MIN(n.sequence) AS first_seq, n.series || ' #' || sp.numbers AS txt
  FROM numbered n
  JOIN series_parts sp ON sp.run_id = n.run_id AND sp.series = n.series
  GROUP BY n.run_id, n.series, sp.numbers
  UNION ALL
  SELECT run_id, MIN(sequence), label
  FROM parsed WHERE m IS NULL
  GROUP BY run_id, label
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
  FROM run_issues ri JOIN issues i ON i.id = ri.issue_id
  GROUP BY ri.run_id
) c ON c.run_id = r.id
LEFT JOIN (
  SELECT run_id, string_agg(txt, '; ' ORDER BY first_seq, txt) AS series_issues
  FROM groups GROUP BY run_id
) s ON s.run_id = r.id;

-- Direct-prereq readiness. Replaces RUNS!Readiness / Hard Left / Soft Left / Unlocks.
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
-- (task 2.6). finished_at is the latest completion, for "read · Sep 2026".
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
  FROM run_issues ri
  JOIN issue_progress p ON p.issue_id = ri.issue_id AND p.user_id = rr.user_id
  WHERE ri.run_id = rr.run_id
) fin ON true;

-- Read state drawn as run-length segments, for the telescope's run rail. A
-- single fill from the top misreports a range mark or a skipped optional, so
-- every maximal stretch of consecutive placements with the same read state is
-- one row: is_read true is a green segment, false is the gap between. Ordinals
-- are 1-based positions in the run (the "42" in "42 / 381"), not issue numbers,
-- so a run with a gap in `sequence` still lays out contiguously.
-- Today "read" means read anywhere, matching run_progress. Task 0.8 changes
-- both views to the placement, and adds the grey dashed "read in another run"
-- segments from issue_read_runs as a second kind.
CREATE OR REPLACE VIEW run_read_segments AS
WITH placed AS (
  SELECT
    u.id AS user_id,
    ri.run_id,
    ROW_NUMBER() OVER (PARTITION BY u.id, ri.run_id ORDER BY ri.sequence) AS ordinal,
    (p.issue_id IS NOT NULL) AS is_read
  FROM run_issues ri
  CROSS JOIN users u
  LEFT JOIN issue_progress p ON p.issue_id = ri.issue_id AND p.user_id = u.id
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
    FROM prereqs p WHERE p.run_id = target
    UNION
    SELECT p.prereq_run_id,
           CASE WHEN w.type = 'hard' AND p.type = 'hard' THEN 'hard' ELSE 'soft' END,
           w.depth + 1
    FROM prereqs p
    JOIN walk w ON p.run_id = w.run_id
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
JOIN run_tracks rt ON rt.run_id = er.run_id;

-- Distinct issues and distinct read issues per user, per track and per block.
-- A crossover issue placed in three runs of one track counts once, which is
-- why these don't SUM run_progress.
CREATE OR REPLACE VIEW track_issue_counts AS
SELECT u.id AS user_id, rt.track_id,
       COUNT(DISTINCT ri.issue_id) AS total_issues,
       COUNT(DISTINCT p.issue_id)  AS read_issues
FROM run_tracks rt
JOIN runs r         ON r.id = rt.run_id AND NOT r.placeholder
JOIN run_issues ri  ON ri.run_id = r.id
CROSS JOIN users u
LEFT JOIN issue_progress p ON p.issue_id = ri.issue_id AND p.user_id = u.id
GROUP BY u.id, rt.track_id;

CREATE OR REPLACE VIEW block_issue_counts AS
SELECT u.id AS user_id, r.block_id,
       COUNT(DISTINCT ri.issue_id) AS total_issues,
       COUNT(DISTINCT p.issue_id)  AS read_issues
FROM runs r
JOIN run_issues ri  ON ri.run_id = r.id
CROSS JOIN users u
LEFT JOIN issue_progress p ON p.issue_id = ri.issue_id AND p.user_id = u.id
WHERE NOT r.placeholder AND r.block_id IS NOT NULL
GROUP BY u.id, r.block_id;

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
JOIN runs r           ON r.id = rt.run_id AND NOT r.placeholder
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
  WHERE NOT r.placeholder
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
JOIN runs r          ON r.block_id = b.id AND NOT r.placeholder
JOIN run_progress rp ON rp.run_id = r.id
LEFT JOIN block_issue_counts bc ON bc.block_id = b.id AND bc.user_id = rp.user_id
GROUP BY rp.user_id, b.id, b.track_id, b.number, b.name;

-- Who made a run, from its issues' credits. Replaces RUNS!Writer and Artists,
-- which are no longer loaded. share is the fraction of the run's issues that
-- carry any credit in that role, so an uncredited issue neither helps nor hurts.
CREATE OR REPLACE VIEW run_creators AS
WITH placed AS (
  SELECT DISTINCT ri.run_id, ic.issue_id, ic.creator_id, ic.role
  FROM run_issues ri
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
CREATE OR REPLACE VIEW run_credit_line AS
SELECT
  r.id AS run_id,
  (SELECT string_agg(x.name, ', ' ORDER BY x.issues DESC, x.name)
   FROM (SELECT name, issues FROM run_creators
         WHERE run_id = r.id AND role = 'writer' AND share >= 0.25
         ORDER BY issues DESC, name LIMIT 3) x)            AS writers,
  (SELECT string_agg(x.name, ', ' ORDER BY x.issues DESC, x.name)
   FROM (SELECT name, issues FROM run_creators
         WHERE run_id = r.id AND role = 'artist' AND share >= 0.25
         ORDER BY issues DESC, name LIMIT 3) x)            AS artists,
  COALESCE(ci.credited_issues, 0)                        AS credited_issues,
  COALESCE(ci.issue_count, 0)                            AS issue_count
FROM runs r
LEFT JOIN (
  SELECT ri.run_id,
         COUNT(DISTINCT ri.issue_id)                                        AS issue_count,
         COUNT(DISTINCT ri.issue_id) FILTER (WHERE EXISTS (
           SELECT 1 FROM issue_credits ic WHERE ic.issue_id = ri.issue_id)) AS credited_issues
  FROM run_issues ri GROUP BY ri.run_id
) ci ON ci.run_id = r.id;

-- Books read per year per genre. Replaces the Read 20XX tabs.
CREATE OR REPLACE VIEW books_by_year AS
SELECT s.user_id, s.finished_year AS year, b.genre,
       COUNT(*) AS books, SUM(b.word_count) AS words
FROM book_status s JOIN books b ON b.id = s.book_id
WHERE s.status = 'read' AND s.finished_year IS NOT NULL
GROUP BY s.user_id, s.finished_year, b.genre;

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
LEFT JOIN books b       ON b.series_id = bs.id
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
CREATE INDEX IF NOT EXISTS status_user_year ON book_status (user_id, finished_year);
