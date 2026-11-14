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
-- (data model 2.14, task 0.8a). run_issues is UNIQUE (run_id, issue_id), so
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
-- issues inside some other run does not finish it (data model 2.14).
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

-- The five run states the UI draws (DIAGRAMS §4, design §11): blocked,
-- ready_hard, ready_all, reading, read. run_readiness only knows about
-- prerequisites, so a run you have started is still 'blocked' there; the badge
-- must say 'reading' and suppress the prerequisite badge, so progress wins
-- over readiness. Amber is for blocked only: ready_hard (hard prereqs met, a
-- soft one unread) is reachable and is drawn as an outlined green badge.
-- hard_left / soft_left are direct prerequisites still under 100%; the
-- "N runs first" count is the transitive closure and comes from run_ancestors
-- (task 2.6). finished_at is the latest dated completion of this run's own
-- placements, for "read · Sep 2026"; NULL when every read is undated.
-- started_at is the earliest (task 1.17, data model 2.18), for the run's span
-- (*Started Mar 2026*, *Mar–Sep 2026*): derived, never stored. MIN skips the
-- NULLs, so an undated ('none') read counts toward neither, and a run with no
-- dated read has no start. Unlike finished_at it is there while unread remain.
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
  CASE WHEN rp.state = 'read' THEN fin.last_read_at END AS finished_at,
  fin.first_read_at                    AS started_at
FROM run_readiness rr
JOIN run_progress rp ON rp.user_id = rr.user_id AND rp.run_id = rr.run_id
LEFT JOIN LATERAL (
  SELECT MAX(p.completed_at) AS last_read_at, MIN(p.completed_at) AS first_read_at
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
-- count (data model 2.14).
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
-- the telescope (2.5); it never checks a box (data model 2.14).
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
-- format is how it was read (task 1.23, D-85): 'audio' is a listen, which is
-- still a read; the status-only row is 'text', as nothing before 1.23 was a listen.
CREATE OR REPLACE VIEW book_reads AS
SELECT e.user_id, e.book_id, e.finished_on, e.finished_on_precision, e.format
FROM read_events e
WHERE e.book_id IS NOT NULL
UNION ALL
SELECT s.user_id, s.book_id, s.finished_on, s.finished_on_precision, 'text'
FROM book_status s
WHERE s.status = 'read'
  AND NOT EXISTS (SELECT 1 FROM read_events e WHERE e.user_id = s.user_id AND e.book_id = s.book_id);

-- Calibre's genres with their hierarchy (task 1.18c, D-98). book_genres keeps
-- each genre as Calibre writes it, a dotted path, and Calibre's genres cascade:
-- a book tagged 'Young Adult.Fantasy.Romantasy' is in 'Young Adult' and
-- 'Young Adult.Fantasy' too, though it is rarely tagged with them. One row per
-- book and level: depth 1 is a top-level genre, and direct is true where the
-- book carries that path itself.
CREATE OR REPLACE VIEW book_genre_tree AS
SELECT g.book_id,
       array_to_string((string_to_array(g.genre, '.'))[1:l.depth], '.') AS genre,
       l.depth,
       bool_or(l.depth = cardinality(string_to_array(g.genre, '.'))) AS direct
FROM book_genres g
JOIN books b ON b.id = g.book_id AND b.deleted_at IS NULL
CROSS JOIN LATERAL generate_series(1, cardinality(string_to_array(g.genre, '.'))) AS l(depth)
GROUP BY g.book_id, array_to_string((string_to_array(g.genre, '.'))[1:l.depth], '.'), l.depth;

-- A book's genres as every reader takes them (task 4.5, D-98): book_genre_tree's
-- rows, Calibre's alone since the workbook's one genre column was dropped
-- (TASK-089), so a book Calibre gives no genre has no row. One row per book,
-- genre and level whatever its case, spelled the capitalised way under "C" (byte order, on any
-- database's collation, as plan_suggestions did): a book tagged 'Horror' and
-- 'horror.Cosmic' is in 'Horror' once. `name` is a path's last segment, what a
-- Library row shows ('Romantasy'): split here, never in the app.
CREATE OR REPLACE VIEW book_genre_levels AS
SELECT g.book_id, min(g.genre COLLATE "C") AS genre, g.depth, bool_or(g.direct) AS direct,
       (string_to_array(min(g.genre COLLATE "C"), '.'))[g.depth] AS name
FROM book_genre_tree g
GROUP BY g.book_id, lower(g.genre), g.depth;

-- Reads per year per genre. Replaces the Read 20XX tabs. The year is derived
-- from the finish date (D-21): a year-only finish is its July 1st, 'approximate',
-- so it lands in its year; an undated read is in no year, and the books page's
-- *No year* chip counts it instead. `books` counts reads: a book read in 2019
-- and again in 2026 is one in each. `listened` is how many of those reads were
-- listens (task 1.23, D-85): `books` still includes them, as a listen is a read.
-- The genre is each top-level genre of book_genre_levels (task 4.5, D-98): a
-- read counts once under each, so a year's genres can sum past its reads (the
-- year chips count reads, not this); a book with none is under NULL. One
-- spelling whatever the case across books (folded under the database's own
-- collation, as book_genre_levels' genre is "C" and lower() under "C" folds
-- ASCII only); the column keeps the database's collation, which CREATE OR
-- REPLACE can't change.
CREATE OR REPLACE VIEW books_by_year AS
SELECT r.user_id, extract(year FROM r.finished_on)::int AS year, min(g.genre) COLLATE "default" AS genre,
       COUNT(*) AS books, SUM(b.word_count) AS words,
       COUNT(*) FILTER (WHERE r.format = 'audio') AS listened
FROM book_reads r JOIN books b ON b.id = r.book_id
LEFT JOIN book_genre_levels g ON g.book_id = b.id AND g.depth = 1
WHERE r.finished_on IS NOT NULL AND b.deleted_at IS NULL
GROUP BY r.user_id, extract(year FROM r.finished_on)::int, lower(g.genre COLLATE "default");

-- A plan row's period, read (task 1.7, D-37, D-38): '2027-Q1' is year 2027,
-- quarter 1, level 'quarter'; '2027' is year 2027 with no quarter, level 'year';
-- 'on_deck' has neither, level 'on_deck'. The year is never stored beside the
-- period, so the two can't disagree; nothing in the app parses a period.
-- ordinal is the place in a quarter (1…N) and NULL at every other level.
CREATE OR REPLACE VIEW plan_period AS
SELECT p.user_id, p.book_id, p.period,
       CASE WHEN p.period = 'on_deck' THEN NULL ELSE left(p.period, 4)::int END AS year,
       CASE WHEN p.period ~ '-Q' THEN right(p.period, 1)::int END              AS quarter,
       CASE WHEN p.period = 'on_deck' THEN 'on_deck'
            WHEN p.period ~ '-Q'       THEN 'quarter'
            ELSE 'year' END                                                  AS level,
       p.ordinal
FROM reading_plan p
JOIN books b ON b.id = p.book_id AND b.deleted_at IS NULL;

-- The level each to_read book sits at (task 1.7, D-37): a quarter, a year, On
-- deck, or Someday, which is a to_read book with no plan row and is never
-- stored. One row per book: with several plan rows it takes the earliest,
-- quarters and years by date (a quarter before its own bare year), then On deck.
CREATE OR REPLACE VIEW to_read_level AS
SELECT s.user_id, s.book_id,
       COALESCE(pp.level, 'someday') AS level,
       pp.period, pp.year, pp.quarter, pp.ordinal
FROM book_status s
JOIN books b ON b.id = s.book_id AND b.deleted_at IS NULL
LEFT JOIN LATERAL (
  SELECT pp.* FROM plan_period pp
  WHERE pp.user_id = s.user_id AND pp.book_id = s.book_id
  ORDER BY pp.level = 'on_deck', pp.year, pp.quarter NULLS LAST
  LIMIT 1
) pp ON true
WHERE s.status = 'to_read';

-- Each planned book that counts against capacity, and its words (task 2.1,
-- F-21, D-37, D-115). A book counts once, at its earliest dated period by
-- to_read_level's rule (a quarter before its own bare year, an earlier year
-- before a later one); On deck and Someday count against nothing. It counts
-- while it is to read or reading, and once read, unless every read of it was a
-- listen: a listen, or one in progress, runs beside the year's reading, never
-- against its word budget (D-112); a DNF or Unlisted book doesn't count.
-- words is the stated count, or a stored estimate (trusted whatever its page
-- count: the owner, 2026-11-04); else page_count x your
-- words_per_page (the column default, 275, with no settings row), estimated;
-- else NULL with word_source NULL, unknown: counted as a book, never as 0
-- words. Under 50 pages is a picture-book edition's count, not the book's
-- (D-94), so it is unknown too. The earliest period is a NOT EXISTS, not a
-- DISTINCT ON, so a read for one year filters by it before plan_capacity
-- aggregates.
CREATE OR REPLACE VIEW plan_book_words AS
SELECT pp.user_id, pp.book_id, pp.period, pp.year, pp.quarter, s.status,
       CASE WHEN b.word_count IS NOT NULL THEN b.word_count_source
            WHEN b.page_count >= 50 THEN 'estimated' END                      AS word_source,
       COALESCE(b.word_count,
                CASE WHEN b.page_count >= 50 THEN b.page_count * COALESCE(rs.words_per_page, 275) END) AS words
FROM plan_period pp
JOIN books b ON b.id = pp.book_id
JOIN book_status s ON s.user_id = pp.user_id AND s.book_id = pp.book_id
LEFT JOIN reading_settings rs ON rs.user_id = pp.user_id
WHERE pp.level <> 'on_deck'
  AND (s.status IN ('to_read', 'reading')
       OR s.status = 'read' AND EXISTS (
         SELECT 1 FROM book_reads r WHERE r.user_id = pp.user_id AND r.book_id = pp.book_id AND r.format = 'text'))
  AND NOT EXISTS (
    SELECT 1 FROM plan_period e
    WHERE e.user_id = pp.user_id AND e.book_id = pp.book_id AND e.level <> 'on_deck'
      AND (e.year < pp.year
           OR e.year = pp.year AND e.quarter IS NOT NULL AND (pp.quarter IS NULL OR e.quarter < pp.quarter)));

-- How full each planned year and quarter is (task 2.1, F-21, D-37, D-115):
-- one row per year a counted book is planned in, period '2027', and one for
-- each of its quarters, '2027-Q1'…'2027-Q4', an empty quarter included at 0.
-- A quarter's books count against it and its year; a bare-year book against
-- its year and no quarter. capacity is minutes a day x words a minute x the
-- year's days (45 x 185 x 365 = 3,038,625), a quarter a quarter of it, read
-- live from reading_settings (the column defaults with no row). planned_words
-- is stated + estimated; unknown_books are counted in books but in no word
-- total; load is planned / capacity (1.18 is 118%); estimated_share is the
-- share of planned_words that rests on estimates, NULL when nothing is planned.
CREATE OR REPLACE VIEW plan_capacity AS
SELECT y.user_id,
       y.year::text || COALESCE('-Q' || q.quarter, '')                        AS period,
       y.year, q.quarter,
       c.capacity, a.planned_words, a.stated_words, a.estimated_words,
       a.books, a.read_books, a.unknown_books,
       a.planned_words / c.capacity                                           AS load,
       a.estimated_words::float8 / NULLIF(a.planned_words, 0)                 AS estimated_share
FROM (SELECT DISTINCT w.user_id, w.year FROM plan_book_words w) y
CROSS JOIN (VALUES (NULL::int), (1), (2), (3), (4)) q(quarter)
LEFT JOIN reading_settings rs ON rs.user_id = y.user_id
CROSS JOIN LATERAL (
  -- float8 before the product, so no setting overflows it; the leap rule
  -- itself, not make_date, as the period CHECK admits year 0000.
  SELECT COALESCE(rs.minutes_per_day, 45)::float8 * COALESCE(rs.words_per_minute, 185)
         * CASE WHEN (y.year % 4 = 0 AND y.year % 100 <> 0) OR y.year % 400 = 0 THEN 366 ELSE 365 END
         / CASE WHEN q.quarter IS NULL THEN 1 ELSE 4 END                      AS capacity
) c
CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(w.words), 0)::int                                     AS planned_words,
         COALESCE(SUM(w.words) FILTER (WHERE w.word_source = 'stated'), 0)::int    AS stated_words,
         COALESCE(SUM(w.words) FILTER (WHERE w.word_source = 'estimated'), 0)::int AS estimated_words,
         COUNT(*)::int                                                       AS books,
         COUNT(*) FILTER (WHERE w.status = 'read')::int                      AS read_books,
         COUNT(*) FILTER (WHERE w.word_source IS NULL)::int                  AS unknown_books
  FROM plan_book_words w
  WHERE w.user_id = y.user_id AND w.year = y.year AND (q.quarter IS NULL OR w.quarter = q.quarter)
) a;

-- Each book counted in a quarter, in the quarter's order, and whether it is
-- past the quarter's capacity rule (task 2.7, F-23, D-37): the rail's rule
-- (src/lib/plan-rail.ts layoutColumn), so a book is past it when its running
-- end passes capacity, the one the rule runs through included. A book of
-- unknown words takes no room (0). The overage is these books, the end of each
-- quarter's order, so *move the overage* offers the books ranked last.
-- Partitioned by year and quarter, so a read for one year filters before the
-- window runs.
CREATE OR REPLACE VIEW plan_overage AS
SELECT o.user_id, o.book_id, o.period, o.year, o.quarter, o.ordinal, o.status, o.words,
       o.end_words, o.capacity, o.end_words > o.capacity AS past_rule
FROM (
  SELECT w.user_id, w.book_id, w.period, w.year, w.quarter, p.ordinal, w.status, w.words,
         SUM(COALESCE(w.words, 0)) OVER (PARTITION BY w.user_id, w.year, w.quarter
                                         ORDER BY p.ordinal, w.book_id)::bigint AS end_words,
         c.capacity
  FROM plan_book_words w
  JOIN reading_plan p ON p.user_id = w.user_id AND p.book_id = w.book_id AND p.period = w.period
  JOIN plan_capacity c ON c.user_id = w.user_id AND c.year = w.year AND c.quarter = w.quarter
  WHERE w.quarter IS NOT NULL
) o;

-- The comics Up next queue with each run's state (task 1.10, data model 2.16).
-- The order is the only thing stored; whether a queued run is still up next is
-- derived here, so starting a run moves it to In flight and finishing it to
-- Done without touching run_queue, and unmarking it back to zero puts it back
-- at its old ordinal. state: unstarted (nothing read, an empty run included),
-- reading or read. blocked_by is the direct hard prerequisites still unread,
-- soft_left the soft ones (the ○ badge's count);
-- the transitive "N runs first" is run_ancestors' (task 2.6). A run soft-deleted
-- after it was queued drops out through run_progress.
CREATE OR REPLACE VIEW run_queue_state AS
SELECT
  q.user_id,
  q.run_id,
  q.ordinal,
  q.added_at,
  CASE WHEN rp.state IN ('reading', 'read') THEN rp.state ELSE 'unstarted' END AS state,
  rr.readiness,
  (rr.hard_total - rr.hard_done)::int                            AS blocked_by,
  rp.read_issues::int                                            AS read_issues,
  rp.total_issues::int                                           AS total_issues,
  (rr.soft_total - rr.soft_done)::int                            AS soft_left
FROM run_queue q
JOIN run_progress  rp ON rp.run_id = q.run_id AND rp.user_id = q.user_id
JOIN run_readiness rr ON rr.run_id = q.run_id AND rr.user_id = q.user_id;

-- Series completion. Replaces the Series tab. follow_state is the owner's
-- stored choice, tracking or reading, and NULL when the series isn't followed
-- (task 1.15, D-43); whether it is done stays derived (books_read = total_books).
-- follow_state is last, so CREATE OR REPLACE can add it to a live view. A
-- stored 'off' (*Not following*, kept so no later finish follows it again;
-- task 2.2h, D-117) is no follow: NULL here, as in universe_progress and
-- subseries_progress.
CREATE OR REPLACE VIEW series_progress AS
SELECT
  u.id AS user_id, bs.id AS series_id, bs.name, a.name AS author,
  COUNT(b.id)                                           AS books_listed,
  COALESCE(bs.total_books, COUNT(b.id))                 AS total_books,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COALESCE(bs.total_books, COUNT(b.id)), 0)  AS pct,
  NULLIF(f.state, 'off')                                AS follow_state
FROM book_series bs
CROSS JOIN users u
LEFT JOIN authors a     ON a.id = bs.author_id
LEFT JOIN books b       ON b.series_id = bs.id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = u.id
LEFT JOIN series_follows f ON f.series_id = bs.id AND f.user_id = u.id
GROUP BY u.id, bs.id, bs.name, a.name, bs.total_books, f.state;

-- Author and universe completion (task 1.15, D-42), in series_progress's shape:
-- live books only, and a book with no status counts as unread. Neither has a
-- stated total, so the books listed are the whole. follow_state as above.
CREATE OR REPLACE VIEW author_progress AS
SELECT
  u.id AS user_id, a.id AS author_id, a.name,
  COUNT(b.id)                                           AS books_listed,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COUNT(b.id), 0)                            AS pct,
  f.state                                               AS follow_state
FROM authors a
CROSS JOIN users u
LEFT JOIN books b       ON b.author_id = a.id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = u.id
LEFT JOIN author_follows f ON f.author_id = a.id AND f.user_id = u.id
GROUP BY u.id, a.id, a.name, f.state;

CREATE OR REPLACE VIEW universe_progress AS
SELECT
  u.id AS user_id, bu.id AS universe_id, bu.name,
  COUNT(b.id)                                           AS books_listed,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COUNT(b.id), 0)                            AS pct,
  NULLIF(f.state, 'off')                                AS follow_state
FROM book_universes bu
CROSS JOIN users u
LEFT JOIN books b       ON b.universe_id = bu.id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = u.id
LEFT JOIN universe_follows f ON f.universe_id = bu.id AND f.user_id = u.id
GROUP BY u.id, bu.id, bu.name, f.state;

-- Subseries completion (task 2.2h, D-117), in universe_progress's shape: the
-- live books in a subseries (Calibre's #subseries, D-90) and how many are read.
-- subseries_follows has no user_id (D-91), so every user row reads the one
-- follow; 'off' is no follow, NULL. 2.2d's follow_next reads it.
CREATE OR REPLACE VIEW subseries_progress AS
SELECT
  u.id AS user_id, ss.id AS subseries_id, ss.name, ss.series_id,
  COUNT(b.id)                                           AS books_listed,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COUNT(b.id), 0)                            AS pct,
  NULLIF(f.state, 'off')                                AS follow_state
FROM book_subseries ss
CROSS JOIN users u
LEFT JOIN books b       ON b.subseries_id = ss.id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = u.id
LEFT JOIN subseries_follows f ON f.subseries_id = ss.id
GROUP BY u.id, ss.id, ss.name, ss.series_id, f.state;

-- Shelf completion (task 2.2c, D-108), in universe_progress's shape: the live
-- books on a books shelf and how many are read. A shelf is already its owner's,
-- so user_id is the shelf's, and shelf_follows has none (D-91). 5.12 reads it.
CREATE OR REPLACE VIEW shelf_progress AS
SELECT
  s.user_id, s.id AS shelf_id, s.name,
  COUNT(b.id)                                           AS books_listed,
  COUNT(*) FILTER (WHERE st.status = 'read')            AS books_read,
  COUNT(*) FILTER (WHERE st.status = 'read')::float8
    / NULLIF(COUNT(b.id), 0)                            AS pct,
  f.state                                               AS follow_state
FROM shelves s
LEFT JOIN shelf_books sb ON sb.shelf_id = s.id
LEFT JOIN books b       ON b.id = sb.book_id AND b.deleted_at IS NULL
LEFT JOIN book_status st ON st.book_id = b.id AND st.user_id = s.user_id
LEFT JOIN shelf_follows f ON f.shelf_id = s.id
WHERE s.kind = 'books'
GROUP BY s.user_id, s.id, s.name, f.state;

-- What is next in what you follow as Reading (task 2.2d, D-108). follow_queue
-- holds, for each subseries, series, universe, author and books shelf whose
-- follow_state is 'reading' (read from the progress views, so a stored 'off'
-- is no follow), every live book of it still open, ranked: by
-- subseries_position, series_position or universe_position, a shelf's
-- ordinal, or an author's published_year, a missing one last, then title.
-- Open is a list of the statuses that count, not of those that don't: to read,
-- unlisted, no status row (unread, as the progress views count it), reading
-- and listening. Read (a listen included, 1.23), DNF, and any status added
-- later (5.15's parking) are skipped without touching this view. read and
-- total are the progress view's (a series' stated total_books); last_read_on
-- is the follow's latest dated finish over its live books (book_reads), NULL
-- with none: the dashboard lists the follow most recently read in first.
-- Nothing is stored (hard rule 2).
CREATE OR REPLACE VIEW follow_queue AS
WITH follows AS (
  SELECT p.user_id, 'subseries'::text AS kind, p.subseries_id AS entity_id, p.name,
         p.books_read::int AS read, p.books_listed::int AS total
  FROM subseries_progress p WHERE p.follow_state = 'reading'
  UNION ALL
  SELECT p.user_id, 'series', p.series_id, p.name, p.books_read::int, p.total_books::int
  FROM series_progress p WHERE p.follow_state = 'reading'
  UNION ALL
  SELECT p.user_id, 'universe', p.universe_id, p.name, p.books_read::int, p.books_listed::int
  FROM universe_progress p WHERE p.follow_state = 'reading'
  UNION ALL
  SELECT p.user_id, 'author', p.author_id, p.name, p.books_read::int, p.books_listed::int
  FROM author_progress p WHERE p.follow_state = 'reading'
  UNION ALL
  SELECT p.user_id, 'shelf', p.shelf_id, p.name, p.books_read::int, p.books_listed::int
  FROM shelf_progress p WHERE p.follow_state = 'reading'
), members AS (
  -- Each follow's live books, with the place its kind orders them by.
  SELECT f.user_id, f.kind, f.entity_id, b.id AS book_id, b.title, b.subseries_position::float8 AS pos
  FROM follows f JOIN books b ON f.kind = 'subseries' AND b.subseries_id = f.entity_id AND b.deleted_at IS NULL
  UNION ALL
  SELECT f.user_id, f.kind, f.entity_id, b.id, b.title, b.series_position::float8
  FROM follows f JOIN books b ON f.kind = 'series' AND b.series_id = f.entity_id AND b.deleted_at IS NULL
  UNION ALL
  SELECT f.user_id, f.kind, f.entity_id, b.id, b.title, b.universe_position::float8
  FROM follows f JOIN books b ON f.kind = 'universe' AND b.universe_id = f.entity_id AND b.deleted_at IS NULL
  UNION ALL
  SELECT f.user_id, f.kind, f.entity_id, b.id, b.title, b.published_year::float8
  FROM follows f JOIN books b ON f.kind = 'author' AND b.author_id = f.entity_id AND b.deleted_at IS NULL
  UNION ALL
  SELECT f.user_id, f.kind, f.entity_id, b.id, b.title, sb.ordinal::float8
  FROM follows f JOIN shelf_books sb ON f.kind = 'shelf' AND sb.shelf_id = f.entity_id
  JOIN books b ON b.id = sb.book_id AND b.deleted_at IS NULL
), last_read AS (
  SELECT m.user_id, m.kind, m.entity_id, max(r.finished_on) AS last_read_on
  FROM members m JOIN book_reads r ON r.user_id = m.user_id AND r.book_id = m.book_id
  WHERE r.finished_on IS NOT NULL
  GROUP BY m.user_id, m.kind, m.entity_id
), open AS (
  SELECT m.*, st.status
  FROM members m
  LEFT JOIN book_status st ON st.user_id = m.user_id AND st.book_id = m.book_id
  WHERE st.status IS NULL OR st.status IN ('to_read', 'unlisted', 'reading', 'listening')
)
SELECT o.user_id, o.kind, o.entity_id, f.name, o.book_id, o.status,
       row_number() OVER (PARTITION BY o.user_id, o.kind, o.entity_id
                          ORDER BY o.pos NULLS LAST, o.title, o.book_id)::int AS rank,
       f.read, f.total, lr.last_read_on
FROM open o
JOIN follows f ON f.user_id = o.user_id AND f.kind = o.kind AND f.entity_id = o.entity_id
LEFT JOIN last_read lr ON lr.user_id = o.user_id AND lr.kind = o.kind AND lr.entity_id = o.entity_id;

-- Each follow's next book (task 2.2d, D-108): its first open book, listed only
-- when it is unread (to read, unlisted, or no status). One in hand (reading or
-- listening) means you are already on it: no row. A follow with nothing open
-- has none either. The dashboard's *Or keep going* reads it, and so will
-- 2.10b's plan sheet, so the two can't disagree.
CREATE OR REPLACE VIEW follow_next AS
SELECT q.user_id, q.kind, q.entity_id, q.name, q.book_id, q.read, q.total, q.last_read_on
FROM follow_queue q
WHERE q.rank = 1 AND (q.status IS NULL OR q.status IN ('to_read', 'unlisted'));

-- What the planning sheet suggests for a year or a quarter (task 2.10b, F-65,
-- D-104, D-108). A function, not a view: the target, the room it has left and
-- today are its arguments. p_target is '2027-Q2' or '2027'; p_room is the
-- target's capacity less its planned words (plan_capacity, read by the caller,
-- src/db/queries.ts planSuggestions, so the capacity formula stays in one
-- place); p_today is the Eastern day. STABLE and SQL, so it cannot write:
-- nothing is stored or cached (hard rule 2). One row per book, in its first
-- group, in this order (rank 1… within each):
--   next_in_series  follow_next for each subseries, series and universe followed
--                   Reading; a book next in several names the narrowest. The
--                   follow most recently read in first, then by name.
--   next_on_shelf   follow_next for each shelf followed Reading, likewise.
--   from_author     every unread book of an author followed Reading, in
--                   follow_queue's order (earliest published first), so
--                   follow_next's book leads.
--   on_deck         to_read books On deck (D-37), by title.
--   coming_out      to_read books whose releases date falls in the target, by date.
--   recently_added  to_read books added in the app in the last 90 days, p_today
--                   and the 89 before it, Eastern (books.added_at; a loaded
--                   book has none), newest first.
--   fits_room       to_read books whose words, as plan_book_words counts them
--                   (estimates included, an unknown count never), are at most
--                   p_room, largest first.
--   genre_change    to_read books none of whose top-level genres has a read in
--                   p_today's year: book_genre_levels at depth 1, Calibre's
--                   (D-98, task 4.5); a book with none is never listed. The
--                   year is today's,
--                   not the target's: a future year has no reads yet.
-- Groups 1-3 take what follow_next does (to read, Unlisted, no status), flagged
-- `unlisted` for the sheet's tag (1.22); groups 4-8 take to_read only. So a read,
-- reading, listening or DNF book never appears, nor any later status (5.15's
-- parking). A book already planned in the target is left out (for a year, a
-- book planned anywhere in it); one planned elsewhere carries its period
-- (to_read_level's), for the sheet's *Move here*.
CREATE OR REPLACE FUNCTION plan_suggestions(p_user text, p_target text, p_room bigint, p_today date)
RETURNS TABLE (book_id text, reason text, detail text, rank int, status text, unlisted boolean,
               period text, words int, word_source text)
LANGUAGE sql STABLE AS $$
WITH span AS (
  SELECT t.year, t.quarter, t.starts,
         (t.starts + CASE WHEN t.quarter IS NULL THEN interval '1 year' ELSE interval '3 months' END)::date AS ends
  FROM (
    SELECT y.year, y.quarter, make_date(y.year, COALESCE((y.quarter - 1) * 3 + 1, 1), 1) AS starts
    FROM (SELECT left(p_target, 4)::int AS year,
                 CASE WHEN p_target ~ '-Q' THEN right(p_target, 1)::int END AS quarter) y
  ) t
), book AS (
  -- Every live book not already planned in the target, with your status and
  -- its words as plan_book_words counts them.
  SELECT b.id, b.title, b.added_at, st.status,
         CASE WHEN b.word_count IS NOT NULL THEN b.word_count_source
              WHEN b.page_count >= 50 THEN 'estimated' END                       AS word_source,
         COALESCE(b.word_count,
                  CASE WHEN b.page_count >= 50 THEN b.page_count * COALESCE(rs.words_per_page, 275) END) AS words
  FROM books b
  LEFT JOIN book_status st ON st.user_id = p_user AND st.book_id = b.id
  LEFT JOIN reading_settings rs ON rs.user_id = p_user
  CROSS JOIN span s
  WHERE b.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM plan_period pp
                    WHERE pp.user_id = p_user AND pp.book_id = b.id
                      AND (pp.period = p_target OR s.quarter IS NULL AND pp.year = s.year))
), top_genre AS (
  -- Each live book's top-level genres, Calibre's (book_genre_levels, task
  -- 4.5); one spelling of each whatever its case, so
  -- the detail never names it twice: the capitalised one, under "C".
  SELECT g.book_id, g.genre FROM book_genre_levels g WHERE g.depth = 1
), read_genre AS (
  SELECT DISTINCT lower(g.genre) AS genre
  FROM book_reads r JOIN top_genre g ON g.book_id = r.book_id
  WHERE r.user_id = p_user AND extract(year FROM r.finished_on) = extract(year FROM p_today)
), cand AS (
  -- grp is the group; narrow picks the narrowest follow of a book next in
  -- several; ord is the place in its group before a book lands elsewhere.
  SELECT 1 AS grp, f.book_id, 'Next in ' || f.name || ' · you''ve read ' || f.read || ' of ' || f.total AS detail,
         array_position(ARRAY['subseries', 'series', 'universe'], f.kind) AS narrow,
         row_number() OVER (ORDER BY f.last_read_on DESC NULLS LAST, f.name, f.entity_id) AS ord
  FROM follow_next f WHERE f.user_id = p_user AND f.kind IN ('subseries', 'series', 'universe')
  UNION ALL
  SELECT 2, f.book_id, 'Next on ' || f.name || ' · you''ve read ' || f.read || ' of ' || f.total, 0,
         row_number() OVER (ORDER BY f.last_read_on DESC NULLS LAST, f.name, f.entity_id)
  FROM follow_next f WHERE f.user_id = p_user AND f.kind = 'shelf'
  UNION ALL
  SELECT 3, f.book_id, 'More from ' || f.name || ' · you''ve read ' || f.read || ' of ' || f.total, 0,
         row_number() OVER (ORDER BY f.last_read_on DESC NULLS LAST, f.name, f.entity_id, f.rank)
  FROM follow_queue f
  WHERE f.user_id = p_user AND f.kind = 'author' AND (f.status IS NULL OR f.status IN ('to_read', 'unlisted'))
  UNION ALL
  SELECT 4, b.id, 'On deck', 0, row_number() OVER (ORDER BY b.title, b.id)
  FROM book b JOIN to_read_level l ON l.user_id = p_user AND l.book_id = b.id
  WHERE b.status = 'to_read' AND l.level = 'on_deck'
  UNION ALL
  -- release_date is ISO text (5.7); it is compared and printed as text, never
  -- cast, so a malformed or impossible date (2027-02-30) can't fail the call.
  SELECT 5, b.id, 'Out ' || (ARRAY['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
                              [substr(r.release_date, 6, 2)::int]
                  || ' ' || substr(r.release_date, 9, 2)::int || ', ' || left(r.release_date, 4), 0,
         row_number() OVER (ORDER BY r.release_date, b.title, b.id)
  FROM book b JOIN releases r ON r.book_id = b.id CROSS JOIN span s
  WHERE b.status = 'to_read' AND r.release_date ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
    AND r.release_date >= to_char(s.starts, 'YYYY-MM-DD') AND r.release_date < to_char(s.ends, 'YYYY-MM-DD')
  UNION ALL
  -- The last 90 days are today and the 89 before it, Eastern.
  SELECT 6, b.id, 'Added ' || to_char(b.added_at AT TIME ZONE 'America/New_York', 'FMMon FMDD, YYYY'), 0,
         row_number() OVER (ORDER BY b.added_at DESC, b.title, b.id)
  FROM book b
  WHERE b.status = 'to_read'
    AND b.added_at >= (p_today - 89)::timestamp AT TIME ZONE 'America/New_York'
    AND b.added_at < (p_today + 1)::timestamp AT TIME ZONE 'America/New_York'
  UNION ALL
  SELECT 7, b.id, round(b.words / 1000.0) || 'k words · fits the ' || floor(p_room / 1000.0) || 'k left', 0,
         row_number() OVER (ORDER BY b.words DESC, b.title, b.id)
  FROM book b
  WHERE b.status = 'to_read' AND b.words <= p_room
  UNION ALL
  SELECT 8, g.book_id, g.genres || ' · none read in ' || extract(year FROM p_today), 0,
         row_number() OVER (ORDER BY g.genres, g.title, g.book_id)
  FROM (
    SELECT b.id AS book_id, b.title, string_agg(t.genre, ', ' ORDER BY t.genre) AS genres
    FROM book b JOIN top_genre t ON t.book_id = b.id
    WHERE b.status = 'to_read'
    GROUP BY b.id, b.title
    HAVING NOT bool_or(lower(t.genre) IN (SELECT genre FROM read_genre))
  ) g
), picked AS (
  SELECT DISTINCT ON (c.book_id) c.*
  FROM cand c JOIN book b ON b.id = c.book_id
  ORDER BY c.book_id, c.grp, c.narrow, c.ord
)
SELECT p.book_id,
       (ARRAY['next_in_series', 'next_on_shelf', 'from_author', 'on_deck',
              'coming_out', 'recently_added', 'fits_room', 'genre_change'])[p.grp],
       p.detail,
       row_number() OVER (PARTITION BY p.grp ORDER BY p.ord)::int,
       b.status, COALESCE(b.status = 'unlisted', false), l.period, b.words, b.word_source
FROM picked p
JOIN book b ON b.id = p.book_id
LEFT JOIN to_read_level l ON l.user_id = p_user AND l.book_id = p.book_id
ORDER BY p.grp, p.ord
$$;

-- Not here yet: show_progress and franchise_progress arrive with task 8.1,
-- because titles, seasons and season_status do not exist until then. When they
-- do, show_progress.state must be
--   unknown | to_watch | watching | watched | dropped
-- and must read a title_status row (kind 'tv', status 'dropped') FIRST, before
-- deriving from season_status. `dropped` is the one show-level status that is
-- stored; watching and watched never are (data model 2.5b, DIAGRAMS 8b).

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
