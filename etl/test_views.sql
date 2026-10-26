-- test_views.sql — assertions for derived views, run against any database that
-- has the schema and etl/views.sql applied. Everything happens inside one
-- transaction that is rolled back, so it is safe against a loaded database.
--
--   psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f etl/test_views.sql
--
-- A failing assertion raises and psql exits non-zero. Silence means pass.
-- Port into vitest when task 0.1 lands; keep the fixtures.

BEGIN;

INSERT INTO runs (id, title) VALUES
  ('zz-test-span',  'Span fixture'),
  ('zz-test-empty', 'Empty fixture');

-- Reading order deliberately interleaves two series, leaves a gap, includes a
-- point issue, a freeform label, a label with a trailing subtitle, a
-- year-less series, and a prologue that was published after the run began.
INSERT INTO issues (id, label, cover_date, cover_date_source) VALUES
  ('zz-i01', 'Zz Dark Reign: The Cabal', '2009-06-01', 'metron'),
  ('zz-i02', 'Zz Avengers (1998) #1', '1998-02-01', 'metron'),
  ('zz-i03', 'Zz Thunderbolts (1997) #1', '1997-04-01', 'metron'),
  ('zz-i04', 'Zz Avengers (1998) #2', '1998-03-01', 'metron'),
  ('zz-i05', 'Zz Thunderbolts (1997) #2', '1997-05-01', 'hand'),
  ('zz-i06', 'Zz Avengers (1998) #3', '1998-04-01', 'metron'),
  ('zz-i07', 'Zz Avengers (1998) #5', NULL, NULL),
  ('zz-i08', 'Zz Avengers (1998) #3.1', NULL, NULL),
  ('zz-i09', 'Zz Marvel Graphic Novel (1982) #27 - Emperor Doom', '1987-01-01', 'metron'),
  ('zz-i10', 'Zz FF #1', '2011-05-01', 'metron');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-test-span',  1, 'zz-i01'),
  ('zz-test-span',  2, 'zz-i02'),
  ('zz-test-span',  3, 'zz-i03'),
  ('zz-test-span',  4, 'zz-i04'),
  ('zz-test-span',  5, 'zz-i05'),
  ('zz-test-span',  6, 'zz-i06'),
  ('zz-test-span',  7, 'zz-i07'),
  ('zz-test-span',  8, 'zz-i08'),
  ('zz-test-span',  9, 'zz-i09'),
  ('zz-test-span', 10, 'zz-i10');

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM run_span WHERE run_id = 'zz-test-span';

  IF s.series_issues IS DISTINCT FROM
     'Zz Dark Reign: The Cabal; Zz Avengers (1998) #1-3, 5, 3.1; Zz Thunderbolts (1997) #1-2; '
     || 'Zz Marvel Graphic Novel (1982) #27 - Emperor Doom; Zz FF #1' THEN
    RAISE EXCEPTION 'run_span.series_issues wrong: %', s.series_issues;
  END IF;
  IF s.issue_count <> 10 OR s.dated_issues <> 8 THEN
    RAISE EXCEPTION 'run_span counts wrong: % issues, % dated', s.issue_count, s.dated_issues;
  END IF;
  -- Earliest and latest cover date, not first and last in reading order.
  IF s.start_year <> 1987 OR s.end_year <> 2011 THEN
    RAISE EXCEPTION 'run_span years wrong: %-%', s.start_year, s.end_year;
  END IF;

  SELECT * INTO s FROM run_span WHERE run_id = 'zz-test-empty';
  IF s.run_id IS NULL OR s.issue_count <> 0 OR s.series_issues IS NOT NULL
     OR s.start_year IS NOT NULL THEN
    RAISE EXCEPTION 'run_span should return an empty row for a run with no issues';
  END IF;
END $$;

-- The regression this view exists for: editing a run's issues must change its
-- summary with no other write. Under the old stored columns this failed.
INSERT INTO issues (id, label, cover_date, cover_date_source) VALUES
  ('zz-i11', 'Zz Avengers (1998) #4', '2014-01-01', 'hand');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('zz-test-span', 11, 'zz-i11');
DELETE FROM run_issues WHERE run_id = 'zz-test-span' AND sequence = 10;

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM run_span WHERE run_id = 'zz-test-span';
  IF s.series_issues IS DISTINCT FROM
     'Zz Dark Reign: The Cabal; Zz Avengers (1998) #1-5, 3.1; Zz Thunderbolts (1997) #1-2; '
     || 'Zz Marvel Graphic Novel (1982) #27 - Emperor Doom' THEN
    RAISE EXCEPTION 'run_span did not follow an issue edit: %', s.series_issues;
  END IF;
  IF s.end_year <> 2014 THEN
    RAISE EXCEPTION 'run_span end_year did not follow an issue edit: %', s.end_year;
  END IF;
END $$;

-- Point issues are listed as written: #605.1 and #605.10 are equal numbers but
-- two issues, so both appear, in a fixed order whatever the insert order
-- (task 0.9 review). Integers still collapse into ranges.
INSERT INTO runs (id, title) VALUES ('zz-test-points', 'Points fixture');
INSERT INTO issues (id, label) VALUES
  ('zz-p1', 'Zz Points (2001) #605.10'),
  ('zz-p2', 'Zz Points (2001) #605.1'),
  ('zz-p3', 'Zz Points (2001) #2'),
  ('zz-p4', 'Zz Points (2001) #1');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-test-points', 1, 'zz-p1'),
  ('zz-test-points', 2, 'zz-p2'),
  ('zz-test-points', 3, 'zz-p3'),
  ('zz-test-points', 4, 'zz-p4');

DO $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM run_span WHERE run_id = 'zz-test-points';
  IF s.series_issues IS DISTINCT FROM 'Zz Points (2001) #1-2, 605.1, 605.10' THEN
    RAISE EXCEPTION 'run_span dropped or reordered an equal-valued point issue: %', s.series_issues;
  END IF;
END $$;

-- The schema refuses a date without a source, and a source without a date.
DO $$
BEGIN
  BEGIN
    INSERT INTO issues (id, label, cover_date) VALUES ('zz-i99', 'Zz X #1', '2000-01-01');
    RAISE EXCEPTION 'cover_date without cover_date_source was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO issues (id, label, story_title) VALUES ('zz-i98', 'Zz X #2', 'Untitled source');
    RAISE EXCEPTION 'story_title without story_title_source was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO issues (id, label) VALUES ('zz-i97', 'Zz Avengers (1998) #1');
    RAISE EXCEPTION 'a second issue row with the same label was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO creators (id, name) VALUES ('zz-c-bad', 'Bad');
    INSERT INTO issue_credits (issue_id, creator_id, role, source)
    VALUES ('zz-i02', 'zz-c-bad', 'editor', 'metron');
    RAISE EXCEPTION 'issue_credits role outside the six was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    UPDATE runs SET why_source = 'ai' WHERE id = 'zz-test-span';
    RAISE EXCEPTION 'why_source outside hand/claude was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- Read state belongs to the placement (data model 2.14, task 0.8a). One
-- issue in two runs of one track, read in A: unread in B, read once in the track.
INSERT INTO users (id, name) VALUES ('zz-user', 'Fixture reader');
INSERT INTO tracks (id, name) VALUES ('zz-track', 'Fixture track');
INSERT INTO runs (id, title) VALUES ('zz-run-a', 'Run A'), ('zz-run-b', 'Run B');
INSERT INTO run_tracks (run_id, track_id) VALUES ('zz-run-a', 'zz-track'), ('zz-run-b', 'zz-track');
INSERT INTO issues (id, label) VALUES
  ('zz-x1', 'Zz Crossover (2000) #1'), ('zz-a2', 'Zz Alpha (2000) #2'), ('zz-b2', 'Zz Beta (2000) #2');
INSERT INTO run_issues (run_id, sequence, issue_id, type) VALUES
  ('zz-run-a', 1, 'zz-x1', 'core'), ('zz-run-a', 2, 'zz-a2', 'core'),
  ('zz-run-b', 1, 'zz-b2', 'core'), ('zz-run-b', 2, 'zz-x1', 'optional');
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues WHERE run_id = 'zz-run-a' AND issue_id = 'zz-x1';

DO $$
DECLARE a record; b record; t record; got text[];
BEGIN
  SELECT * INTO a FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-run-a';
  SELECT * INTO b FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-run-b';
  IF a.read_issues <> 1 OR b.read_issues <> 0 OR a.total_issues <> 2 OR b.total_issues <> 2 THEN
    RAISE EXCEPTION 'a read in run A should leave run B unread: a %/%, b %/%',
      a.read_issues, a.total_issues, b.read_issues, b.total_issues;
  END IF;
  SELECT run_ids INTO got FROM issue_read_runs WHERE user_id = 'zz-user' AND issue_id = 'zz-x1';
  IF got IS DISTINCT FROM ARRAY['zz-run-a'] THEN
    RAISE EXCEPTION 'issue_read_runs for a read in A should be {zz-run-a}, got %', got;
  END IF;
  SELECT * INTO t FROM track_progress WHERE user_id = 'zz-user' AND track_id = 'zz-track';
  IF t.total_issues <> 3 OR t.read_issues <> 1 THEN
    RAISE EXCEPTION 'track_progress should count the shared issue once, read via A: %/%',
      t.read_issues, t.total_issues;
  END IF;
END $$;

-- Read in B as well: two placements read, still one issue read in the track.
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues WHERE run_id = 'zz-run-b' AND issue_id = 'zz-x1';
DO $$
DECLARE t record; got text[];
BEGIN
  SELECT * INTO t FROM track_issue_counts WHERE user_id = 'zz-user' AND track_id = 'zz-track';
  IF t.total_issues <> 3 OR t.read_issues <> 1 THEN
    RAISE EXCEPTION 'track_issue_counts double-counted an issue read in two runs: %/%',
      t.read_issues, t.total_issues;
  END IF;
  SELECT run_ids INTO got FROM issue_read_runs WHERE user_id = 'zz-user' AND issue_id = 'zz-x1';
  IF got IS DISTINCT FROM ARRAY['zz-run-a', 'zz-run-b'] THEN
    RAISE EXCEPTION 'issue_read_runs should list both runs, got %', got;
  END IF;
END $$;

-- A soft-deleted placement keeps its read row but drops out of the hint (R3-06);
-- restoring it brings the run back.
UPDATE run_issues SET deleted_at = now() WHERE run_id = 'zz-run-b' AND issue_id = 'zz-x1';
DO $$
BEGIN
  IF (SELECT run_ids FROM issue_read_runs WHERE user_id = 'zz-user' AND issue_id = 'zz-x1')
     IS DISTINCT FROM ARRAY['zz-run-a'] THEN
    RAISE EXCEPTION 'issue_read_runs still lists a soft-deleted placement';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id
                 WHERE ri.run_id = 'zz-run-b' AND ri.issue_id = 'zz-x1') THEN
    RAISE EXCEPTION 'soft-deleting a placement lost its read row';
  END IF;
END $$;
UPDATE run_issues SET deleted_at = NULL WHERE run_id = 'zz-run-b' AND issue_id = 'zz-x1';

-- Reordering a run moves sequences, not ids: one UPDATE that passes through
-- taken slots works because (run_id, sequence) is deferred (R0-15), and every
-- read row still points at the same issue. IMMEDIATE forces the deferred check
-- here; the ROLLBACK at the end would otherwise never run it.
UPDATE run_issues SET sequence = sequence + 1 WHERE run_id = 'zz-run-a';
SET CONSTRAINTS run_issues_run_id_sequence_unique IMMEDIATE;
SET CONSTRAINTS run_issues_run_id_sequence_unique DEFERRED;
DO $$
BEGIN
  IF (SELECT ri.issue_id || '@' || ri.sequence FROM issue_progress p
      JOIN run_issues ri ON ri.id = p.placement_id
      WHERE p.user_id = 'zz-user' AND ri.run_id = 'zz-run-a') IS DISTINCT FROM 'zz-x1@2' THEN
    RAISE EXCEPTION 'reordering a run moved a read mark off its issue';
  END IF;
  IF (SELECT read_issues FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-run-a') <> 1 THEN
    RAISE EXCEPTION 'reordering a run changed its read count';
  END IF;
END $$;

-- Scope: an issue is read in a block or track when a placement of it *inside*
-- that scope is read. zz-s-x sits in both block runs and is read in both (one
-- issue); zz-s-y is read only in zz-s-out, outside the block and the track.
INSERT INTO tracks (id, name) VALUES ('zz-tr-s', 'Scope track');
INSERT INTO blocks (id, track_id, number) VALUES ('zz-tr-s-b1', 'zz-tr-s', 1);
INSERT INTO runs (id, title, block_id) VALUES
  ('zz-s-in1', 'Scope in 1', 'zz-tr-s-b1'), ('zz-s-in2', 'Scope in 2', 'zz-tr-s-b1'),
  ('zz-s-out', 'Scope out', NULL);
INSERT INTO run_tracks (run_id, track_id) VALUES ('zz-s-in1', 'zz-tr-s'), ('zz-s-in2', 'zz-tr-s');
INSERT INTO issues (id, label) VALUES ('zz-s-x', 'Zz Scope (2004) #1'), ('zz-s-y', 'Zz Scope (2004) #2');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-s-in1', 1, 'zz-s-x'), ('zz-s-in1', 2, 'zz-s-y'), ('zz-s-in2', 1, 'zz-s-x'),
  ('zz-s-out', 1, 'zz-s-y');
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues
  WHERE (run_id, issue_id) IN (('zz-s-in1', 'zz-s-x'), ('zz-s-in2', 'zz-s-x'), ('zz-s-out', 'zz-s-y'));
DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM block_issue_counts WHERE user_id = 'zz-user' AND block_id = 'zz-tr-s-b1';
  IF c.total_issues <> 2 OR c.read_issues <> 1 THEN
    RAISE EXCEPTION 'block_issue_counts scope wrong: %/% (want 1/2)', c.read_issues, c.total_issues;
  END IF;
  SELECT * INTO c FROM block_progress WHERE user_id = 'zz-user' AND block_id = 'zz-tr-s-b1';
  IF c.total_issues <> 2 OR c.read_issues <> 1 THEN
    RAISE EXCEPTION 'block_progress scope wrong: %/% (want 1/2)', c.read_issues, c.total_issues;
  END IF;
  SELECT * INTO c FROM track_issue_counts WHERE user_id = 'zz-user' AND track_id = 'zz-tr-s';
  IF c.total_issues <> 2 OR c.read_issues <> 1 THEN
    RAISE EXCEPTION 'track_issue_counts counted a read from outside the track: %/%',
      c.read_issues, c.total_issues;
  END IF;
END $$;

-- A prerequisite whose issues are read only *elsewhere* is unfinished: the
-- dependent stays blocked (data model 2.14).
INSERT INTO runs (id, title) VALUES
  ('zz-pq-p', 'Prereq read elsewhere'), ('zz-pq-d', 'Depends on it'), ('zz-pq-e', 'Elsewhere');
INSERT INTO issues (id, label) VALUES ('zz-pq1', 'Zz Prereq Elsewhere (2005) #1');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-pq-p', 1, 'zz-pq1'), ('zz-pq-e', 1, 'zz-pq1');
INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('zz-pq-d', 'zz-pq-p', 'hard');
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues WHERE run_id = 'zz-pq-e' AND issue_id = 'zz-pq1';
DO $$
BEGIN
  IF (SELECT readiness FROM run_readiness WHERE user_id = 'zz-user' AND run_id = 'zz-pq-d')
     IS DISTINCT FROM 'blocked' THEN
    RAISE EXCEPTION 'a prerequisite read only in another run should still block';
  END IF;
  IF (SELECT read_issues FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-pq-p') <> 0 THEN
    RAISE EXCEPTION 'the prerequisite run counted a read from another run';
  END IF;
END $$;

-- First read across runs (S-15). first_read_at skips undated reads and is NULL
-- when every read is; first_read_precision is that read's precision.
--   zz-fr1: undated in a, approximate 2020-07-01 in b    -> 2020-07-01 approximate
--   zz-fr2: approximate 2019-07-01 in a, exact 2021 in b -> 2019-07-01 approximate
--   zz-fr3: undated in a only                            -> NULL none
--   zz-fr4: approximate and exact on the same day        -> exact
INSERT INTO runs (id, title) VALUES ('zz-fr-a', 'First read A'), ('zz-fr-b', 'First read B');
INSERT INTO issues (id, label) VALUES
  ('zz-fr1', 'Zz First (2006) #1'), ('zz-fr2', 'Zz First (2006) #2'),
  ('zz-fr3', 'Zz First (2006) #3'), ('zz-fr4', 'Zz First (2006) #4');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-fr-a', 1, 'zz-fr1'), ('zz-fr-a', 2, 'zz-fr2'), ('zz-fr-a', 3, 'zz-fr3'), ('zz-fr-a', 4, 'zz-fr4'),
  ('zz-fr-b', 1, 'zz-fr1'), ('zz-fr-b', 2, 'zz-fr2'), ('zz-fr-b', 3, 'zz-fr4');
INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
  SELECT 'zz-user', ri.id, v.at::timestamptz, v.precision
  FROM (VALUES
    ('zz-fr-a', 'zz-fr1', NULL, 'none'),        ('zz-fr-b', 'zz-fr1', '2020-07-01', 'approximate'),
    ('zz-fr-a', 'zz-fr2', '2019-07-01', 'approximate'), ('zz-fr-b', 'zz-fr2', '2021-03-05', 'exact'),
    ('zz-fr-a', 'zz-fr3', NULL, 'none'),
    ('zz-fr-a', 'zz-fr4', '2018-07-01', 'approximate'), ('zz-fr-b', 'zz-fr4', '2018-07-01', 'exact')
  ) AS v(run_id, issue_id, at, precision)
  JOIN run_issues ri ON ri.run_id = v.run_id AND ri.issue_id = v.issue_id;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('zz-fr1', '2020-07-01'::date, 'approximate', ARRAY['zz-fr-b', 'zz-fr-a']),
    ('zz-fr2', '2019-07-01'::date, 'approximate', ARRAY['zz-fr-a', 'zz-fr-b']),
    ('zz-fr3', NULL::date,         'none',        ARRAY['zz-fr-a']),
    ('zz-fr4', '2018-07-01'::date, 'exact',       ARRAY['zz-fr-a', 'zz-fr-b'])
  ) AS v(issue_id, at, precision, runs) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM issue_read_runs x
      WHERE x.user_id = 'zz-user' AND x.issue_id = r.issue_id
        AND x.first_read_at::date IS NOT DISTINCT FROM r.at
        AND x.first_read_precision = r.precision
        AND x.run_ids = r.runs) THEN
      RAISE EXCEPTION 'issue_read_runs for % wrong: %', r.issue_id,
        (SELECT row_to_json(x) FROM issue_read_runs x WHERE x.user_id = 'zz-user' AND x.issue_id = r.issue_id);
    END IF;
  END LOOP;
END $$;

-- A run's finish date comes from its own placements: reading the same issue
-- later in another run does not move it.
INSERT INTO runs (id, title) VALUES ('zz-fin-r', 'Finished'), ('zz-fin-o', 'Other');
INSERT INTO issues (id, label) VALUES ('zz-fin1', 'Zz Finish (2007) #1');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('zz-fin-r', 1, 'zz-fin1'), ('zz-fin-o', 1, 'zz-fin1');
INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
  SELECT 'zz-user', id, CASE run_id WHEN 'zz-fin-r' THEN '2015-01-10'::timestamptz ELSE '2022-01-10'::timestamptz END, 'exact'
  FROM run_issues WHERE issue_id = 'zz-fin1';
DO $$
BEGIN
  IF (SELECT finished_at::date FROM run_state WHERE user_id = 'zz-user' AND run_id = 'zz-fin-r')
     IS DISTINCT FROM '2015-01-10'::date THEN
    RAISE EXCEPTION 'run_state.finished_at took a read from another run';
  END IF;
END $$;

-- Hard-deleting a placement takes its read row with it (ON DELETE CASCADE);
-- that is why the app only ever soft-deletes one (R3-06).
DELETE FROM run_issues WHERE run_id = 'zz-fin-o' AND issue_id = 'zz-fin1';
DO $$
BEGIN
  IF (SELECT count(*) FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id
      WHERE ri.issue_id = 'zz-fin1') <> 1
     OR EXISTS (SELECT 1 FROM issue_progress p
                WHERE NOT EXISTS (SELECT 1 FROM run_issues ri WHERE ri.id = p.placement_id)) THEN
    RAISE EXCEPTION 'deleting a placement left its read row behind';
  END IF;
END $$;

-- The shape 0.8a promises: placements keyed by id, (run_id, sequence) unique and
-- deferred, (run_id, issue_id) still unique (D-19), progress with no issue_id.
DO $$
BEGIN
  IF (SELECT array_agg(a.attname::text) FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.conrelid = 'run_issues'::regclass AND c.contype = 'p') IS DISTINCT FROM ARRAY['id'] THEN
    RAISE EXCEPTION 'run_issues primary key should be (id)';
  END IF;
  IF NOT COALESCE((SELECT condeferrable AND condeferred FROM pg_constraint
                   WHERE conname = 'run_issues_run_id_sequence_unique'), false) THEN
    RAISE EXCEPTION 'run_issues (run_id, sequence) should be UNIQUE DEFERRABLE INITIALLY DEFERRED';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'issue_progress' AND column_name = 'issue_id') THEN
    RAISE EXCEPTION 'issue_progress still has an issue_id column';
  END IF;
  BEGIN
    INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('zz-run-a', 99, 'zz-x1');
    RAISE EXCEPTION 'a second placement of one issue in one run was accepted (D-19)';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Credit lines are derived from issue credits only, with a 25% line measured
-- against the run's credited issues, not all of its issues.
INSERT INTO creators (id, name) VALUES
  ('zz-w1', 'Writer One'), ('zz-w2', 'Writer Two'), ('zz-w3', 'Writer Three'), ('zz-p1', 'Penciller One');
INSERT INTO runs (id, title) VALUES ('zz-run-c', 'Run C'), ('zz-run-bare', 'Uncredited');
INSERT INTO issues (id, label) VALUES
  ('zz-c1', 'Zz Gamma (2001) #1'), ('zz-c2', 'Zz Gamma (2001) #2'), ('zz-c3', 'Zz Gamma (2001) #3'),
  ('zz-c4', 'Zz Gamma (2001) #4'), ('zz-c5', 'Zz Gamma (2001) #5'), ('zz-bare1', 'Zz Bare (2001) #1');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-run-c', 1, 'zz-c1'), ('zz-run-c', 2, 'zz-c2'), ('zz-run-c', 3, 'zz-c3'),
  ('zz-run-c', 4, 'zz-c4'), ('zz-run-c', 5, 'zz-c5'), ('zz-run-bare', 1, 'zz-bare1');
INSERT INTO issue_credits (issue_id, creator_id, role, source) VALUES
  ('zz-c1', 'zz-w1', 'writer', 'metron'), ('zz-c2', 'zz-w1', 'writer', 'metron'),
  ('zz-c3', 'zz-w1', 'writer', 'metron'), ('zz-c4', 'zz-w1', 'writer', 'metron'),
  ('zz-c1', 'zz-w2', 'writer', 'metron'), ('zz-c2', 'zz-w2', 'writer', 'hand'),
  ('zz-c3', 'zz-w3', 'writer', 'metron'),
  ('zz-c1', 'zz-p1', 'artist', 'metron'), ('zz-c1', 'zz-p1', 'cover', 'metron');
-- zz-c5 has no credits: 4 credited issues, so Writer Two is 2/4 and Writer Three 1/4.

DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM run_credit_line WHERE run_id = 'zz-run-c';
  IF c.writers IS DISTINCT FROM 'Writer One, Writer Two, Writer Three' THEN
    RAISE EXCEPTION 'run_credit_line writers wrong: %', c.writers;
  END IF;
  IF c.artists IS DISTINCT FROM 'Penciller One' OR c.credited_issues <> 4 OR c.issue_count <> 5 THEN
    RAISE EXCEPTION 'run_credit_line artists/counts wrong: % % %', c.artists, c.credited_issues, c.issue_count;
  END IF;
  SELECT * INTO c FROM run_credit_line WHERE run_id = 'zz-run-bare';
  IF c.writers IS NOT NULL OR c.artists IS NOT NULL OR c.credited_issues <> 0 THEN
    RAISE EXCEPTION 'an uncredited run should have null credit lines';
  END IF;
END $$;

-- Below a quarter drops out: a fifth credited issue for Writer One only.
INSERT INTO issue_credits (issue_id, creator_id, role, source) VALUES ('zz-c5', 'zz-w1', 'writer', 'metron');
DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM run_credit_line WHERE run_id = 'zz-run-c';
  IF c.writers IS DISTINCT FROM 'Writer One, Writer Two' THEN
    RAISE EXCEPTION 'run_credit_line kept a writer under 25%%: %', c.writers;
  END IF;
END $$;

-- Deleting an issue removes its placements and credits with it.
DELETE FROM issues WHERE id = 'zz-c1';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM run_issues WHERE issue_id = 'zz-c1')
     OR EXISTS (SELECT 1 FROM issue_credits WHERE issue_id = 'zz-c1') THEN
    RAISE EXCEPTION 'deleting an issue left placements or credits behind';
  END IF;
END $$;

-- The five run states. zz-user has read nothing of zz-st-p, so every run
-- with a prerequisite on it is held; starting one overrides the hold.
INSERT INTO runs (id, title) VALUES
  ('zz-st-p', 'Prereq'), ('zz-st-blocked', 'Blocked'), ('zz-st-rh', 'Ready hard'),
  ('zz-st-all', 'Ready all'), ('zz-st-reading', 'Reading'), ('zz-st-read', 'Read');
INSERT INTO issues (id, label) VALUES
  ('zz-stp1', 'Zz State Prereq (2002) #1'), ('zz-stb1', 'Zz State Blocked (2002) #1'),
  ('zz-str1', 'Zz State Reading (2002) #1'), ('zz-str2', 'Zz State Reading (2002) #2'),
  ('zz-std1', 'Zz State Done (2002) #1');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-st-p', 1, 'zz-stp1'), ('zz-st-blocked', 1, 'zz-stb1'),
  ('zz-st-reading', 1, 'zz-str1'), ('zz-st-reading', 2, 'zz-str2'),
  ('zz-st-read', 1, 'zz-std1');
INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES
  ('zz-st-blocked', 'zz-st-p', 'hard'),
  ('zz-st-rh', 'zz-st-p', 'soft'),
  ('zz-st-reading', 'zz-st-p', 'hard');
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues
  WHERE (run_id, issue_id) IN (('zz-st-reading', 'zz-str1'), ('zz-st-read', 'zz-std1'));

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('zz-st-blocked', 'blocked'), ('zz-st-rh', 'ready_hard'), ('zz-st-all', 'ready_all'),
    ('zz-st-p', 'ready_all'), ('zz-st-reading', 'reading'), ('zz-st-read', 'read')
  ) AS v(run_id, want) LOOP
    IF (SELECT state FROM run_state WHERE user_id = 'zz-user' AND run_id = r.run_id)
       IS DISTINCT FROM r.want THEN
      RAISE EXCEPTION 'run_state for % should be %, got %', r.run_id, r.want,
        (SELECT state FROM run_state WHERE user_id = 'zz-user' AND run_id = r.run_id);
    END IF;
  END LOOP;
  -- A soft-only hold is not a hard hold: ready_hard reports 0 hard left, 1 soft.
  SELECT * INTO r FROM run_state WHERE user_id = 'zz-user' AND run_id = 'zz-st-rh';
  IF r.hard_left <> 0 OR r.soft_left <> 1 THEN
    RAISE EXCEPTION 'ready_hard counts wrong: % hard, % soft', r.hard_left, r.soft_left;
  END IF;
  -- Reading a run whose hard prerequisite is unread is still 'reading', and it
  -- still reports what is unread so the UI can choose to show it elsewhere.
  SELECT * INTO r FROM run_state WHERE user_id = 'zz-user' AND run_id = 'zz-st-reading';
  IF r.hard_left <> 1 OR r.read_issues <> 1 OR r.finished_at IS NOT NULL THEN
    RAISE EXCEPTION 'reading run counts wrong: % hard left, % read', r.hard_left, r.read_issues;
  END IF;
  -- Only a finished run carries a finish date.
  IF (SELECT finished_at FROM run_state WHERE user_id = 'zz-user' AND run_id = 'zz-st-read') IS NULL THEN
    RAISE EXCEPTION 'a read run should have finished_at';
  END IF;
END $$;

-- Read state as segments: 1-3 read, 4 unread, 5 read, 6 unread. The gap at 4 is
-- the case one top-anchored fill cannot draw.
INSERT INTO runs (id, title) VALUES ('zz-seg', 'Segments');
INSERT INTO issues (id, label) VALUES
  ('zz-sg1', 'Zz Seg (2003) #1'), ('zz-sg2', 'Zz Seg (2003) #2'), ('zz-sg3', 'Zz Seg (2003) #3'),
  ('zz-sg4', 'Zz Seg (2003) #4'), ('zz-sg5', 'Zz Seg (2003) #5'), ('zz-sg6', 'Zz Seg (2003) #6');
-- sequence 10, 20, ... : ordinals must still be 1..6
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-seg', 10, 'zz-sg1'), ('zz-seg', 20, 'zz-sg2'), ('zz-seg', 30, 'zz-sg3'),
  ('zz-seg', 40, 'zz-sg4'), ('zz-seg', 50, 'zz-sg5'), ('zz-seg', 60, 'zz-sg6');
INSERT INTO issue_progress (user_id, placement_id)
  SELECT 'zz-user', id FROM run_issues
  WHERE run_id = 'zz-seg' AND issue_id IN ('zz-sg1', 'zz-sg2', 'zz-sg3', 'zz-sg5');
-- zz-sg1 again, in a second run where it is not read: read elsewhere is unread here.
INSERT INTO runs (id, title) VALUES ('zz-seg2', 'Segments elsewhere');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('zz-seg2', 1, 'zz-sg1');

DO $$
DECLARE got text;
BEGIN
  SELECT string_agg((CASE WHEN is_read THEN 'r' ELSE 'u' END) || from_ordinal || '-' || to_ordinal,
                    ' ' ORDER BY from_ordinal)
    INTO got FROM run_read_segments WHERE user_id = 'zz-user' AND run_id = 'zz-seg';
  IF got IS DISTINCT FROM 'r1-3 u4-4 r5-5 u6-6' THEN
    RAISE EXCEPTION 'run_read_segments wrong: %', got;
  END IF;
  -- Segments tile the run exactly: their lengths sum to the placement count.
  IF (SELECT SUM(len) FROM run_read_segments WHERE user_id = 'zz-user' AND run_id = 'zz-seg') <> 6 THEN
    RAISE EXCEPTION 'run_read_segments do not tile the run';
  END IF;
  -- A fully unread run for the same user is one unread segment.
  IF (SELECT COUNT(*) FROM run_read_segments WHERE user_id = 'zz-user' AND run_id = 'zz-st-blocked' AND NOT is_read) <> 1 THEN
    RAISE EXCEPTION 'an unread run should be a single unread segment';
  END IF;
  -- Read in zz-seg is not read in zz-seg2 (task 0.8a).
  IF (SELECT string_agg(is_read::text, ',') FROM run_read_segments
      WHERE user_id = 'zz-user' AND run_id = 'zz-seg2') IS DISTINCT FROM 'false' THEN
    RAISE EXCEPTION 'run_read_segments drew a read from another run';
  END IF;
END $$;

-- run_ancestors walks a 45-run hard chain to the end (the cap is 48; it was 20,
-- which silently truncated the real graph). The chain is z0 <- z1 <- ... <- z45.
INSERT INTO runs (id, title)
  SELECT 'zz-chain-' || g, 'Zz chain ' || g FROM generate_series(0, 45) g;
INSERT INTO prereqs (run_id, prereq_run_id, type)
  SELECT 'zz-chain-' || g, 'zz-chain-' || (g - 1), 'hard' FROM generate_series(1, 45) g;
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM run_ancestors('zz-chain-45')) <> 45 THEN
    RAISE EXCEPTION 'run_ancestors truncated a 45-deep chain: % ancestors',
      (SELECT COUNT(*) FROM run_ancestors('zz-chain-45'));
  END IF;
  IF (SELECT MAX(depth) FROM run_ancestors('zz-chain-45')) <> 45 THEN
    RAISE EXCEPTION 'run_ancestors depth wrong';
  END IF;
END $$;

-- Branching, not just a chain (R2-01). A linear chain has one path per node, the
-- one shape that cannot blow up; this is a diamond plus a back edge, so the walk
-- has two routes to d0 and a cycle to survive. d0 <- d1,d2 <- d3 <- d4, and
-- d0 requires d4 (the back edge). A run in a cycle is never its own ancestor.
INSERT INTO runs (id, title)
  SELECT 'zz-d' || g, 'Zz diamond ' || g FROM generate_series(0, 4) g;
INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES
  ('zz-d4', 'zz-d3', 'hard'), ('zz-d3', 'zz-d1', 'hard'), ('zz-d3', 'zz-d2', 'soft'),
  ('zz-d1', 'zz-d0', 'hard'), ('zz-d2', 'zz-d0', 'hard'), ('zz-d0', 'zz-d4', 'hard');
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(run_id || ':' || type || ':' || depth, ' ' ORDER BY run_id)
    INTO got FROM run_ancestors('zz-d4');
  -- d0 is reached hard-all-the-way via d1 (depth 3) and soft via d2; hard wins.
  IF got IS DISTINCT FROM 'zz-d0:hard:3 zz-d1:hard:2 zz-d2:soft:2 zz-d3:hard:1' THEN
    RAISE EXCEPTION 'run_ancestors over a diamond with a back edge wrong: %', got;
  END IF;
  IF EXISTS (SELECT 1 FROM run_ancestors('zz-d4') WHERE run_id = 'zz-d4') THEN
    RAISE EXCEPTION 'a run in a cycle lists itself as its own ancestor';
  END IF;
END $$;

-- Date precision (D-R3-1): a read with no date is representable and honest, and
-- the value and its precision cannot disagree.
DO $$
DECLARE ok boolean := false;
BEGIN
  INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
    SELECT 'zz-user', id, NULL, 'none' FROM run_issues
      WHERE id NOT IN (SELECT placement_id FROM issue_progress WHERE user_id = 'zz-user') LIMIT 1;
  DELETE FROM issue_progress WHERE user_id = 'zz-user' AND completed_at IS NULL;
  BEGIN
    INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
      SELECT 'zz-user', id, NULL, 'exact' FROM run_issues
        WHERE id NOT IN (SELECT placement_id FROM issue_progress WHERE user_id = 'zz-user') LIMIT 1;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  IF NOT ok THEN RAISE EXCEPTION 'an exact read with no date should violate the precision check'; END IF;
END $$;

-- Book title search is served by a trigram index, not a btree that ILIKE '%q%'
-- cannot use (R2 L-2).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'books'
                   AND indexdef ILIKE '%USING gin%gin_trgm_ops%') THEN
    RAISE EXCEPTION 'books has no trigram index on title';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'books_title_trgm') THEN
    RAISE EXCEPTION 'the old btree books_title_trgm should be gone';
  END IF;
END $$;

-- books_by_year counts reads by the year of their finish date (task 1.5, D-21,
-- D-65): an exact day and a year-only July 1st land in their years, a read with
-- no date is in no year, a status with no log row counts only while `read`, and
-- a book read twice counts in both years.
INSERT INTO books (id, title, genre, word_count, word_count_source) VALUES
  ('zz-b-exact', 'Zz Exact', 'Zz Genre', 100000, 'stated'),
  ('zz-b-year',  'Zz Year',  'Zz Genre', 50000, 'stated'),
  ('zz-b-none',  'Zz None',  'Zz Genre', 10000, 'stated'),
  ('zz-b-dnf',   'Zz Dnf',   'Zz Genre', 10000, 'stated'),
  ('zz-b-again', 'Zz Again', 'Zz Genre', 20000, 'stated');
INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision) VALUES
  ('zz-user', 'zz-b-exact', 'read', '2024-03-11', 'exact'),
  ('zz-user', 'zz-b-year',  'read', '2019-07-01', 'approximate'),
  ('zz-user', 'zz-b-none',  'read', NULL, 'none'),
  ('zz-user', 'zz-b-dnf',   'dnf',  '2024-05-01', 'exact'),
  ('zz-user', 'zz-b-again', 'reading', '2024-02-01', 'exact');
-- Read in 2018 and again in 2024, reading it a third time now: one read in each
-- year, from the log (D-65), whatever its status says.
INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES
  ('zz-user', 'zz-b-again', '2018-05-01', 'exact'),
  ('zz-user', 'zz-b-again', '2024-02-01', 'exact');
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(year || ':' || books || ':' || words, ', ' ORDER BY year) INTO got
  FROM books_by_year WHERE user_id = 'zz-user' AND genre = 'Zz Genre';
  IF got IS DISTINCT FROM '2018:1:20000, 2019:1:50000, 2024:2:120000' THEN
    RAISE EXCEPTION 'books_by_year wrong: %', got;
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'books_by_year' AND column_name = 'year') <> 'integer' THEN
    RAISE EXCEPTION 'books_by_year.year should stay an integer';
  END IF;
END $$;

-- plan_period reads a period's year, quarter and level, and to_read_level puts
-- each to_read book at one level (task 1.7, D-37): no plan row is Someday; with
-- several, the earliest by date wins (a quarter before its own bare year), and
-- On deck only when there is nothing dated. A removed book is in neither.
INSERT INTO books (id, title) VALUES
  ('zz-p-someday', 'Zz Someday'), ('zz-p-deck', 'Zz Deck'), ('zz-p-year', 'Zz Year Plan'),
  ('zz-p-quarter', 'Zz Quarter'), ('zz-p-both', 'Zz Both'), ('zz-p-gone', 'Zz Gone');
UPDATE books SET deleted_at = now() WHERE id = 'zz-p-gone';
INSERT INTO book_status (user_id, book_id, status) VALUES
  ('zz-user', 'zz-p-someday', 'to_read'), ('zz-user', 'zz-p-deck', 'to_read'),
  ('zz-user', 'zz-p-year', 'to_read'), ('zz-user', 'zz-p-quarter', 'to_read'),
  ('zz-user', 'zz-p-both', 'to_read'), ('zz-user', 'zz-p-gone', 'to_read');
INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES
  ('zz-user', 'zz-p-deck', 'on_deck', NULL),
  ('zz-user', 'zz-p-year', '2027', NULL), ('zz-user', 'zz-p-year', 'on_deck', NULL),
  ('zz-user', 'zz-p-quarter', '2028', NULL), ('zz-user', 'zz-p-quarter', '2027-Q4', 1),
  ('zz-user', 'zz-p-both', '2027', NULL), ('zz-user', 'zz-p-both', '2027-Q1', 1),
  ('zz-user', 'zz-p-gone', '2027-Q1', 2);
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(book_id || ':' || period || ':' || coalesce(year::text, '-') || ':'
                    || coalesce(quarter::text, '-') || ':' || level || ':' || coalesce(ordinal::text, '-'),
                    ', ' ORDER BY book_id, period) INTO got
  FROM plan_period WHERE user_id = 'zz-user' AND book_id LIKE 'zz-p-%';
  IF got IS DISTINCT FROM 'zz-p-both:2027:2027:-:year:-, zz-p-both:2027-Q1:2027:1:quarter:1, '
                       || 'zz-p-deck:on_deck:-:-:on_deck:-, '
                       || 'zz-p-quarter:2027-Q4:2027:4:quarter:1, zz-p-quarter:2028:2028:-:year:-, '
                       || 'zz-p-year:2027:2027:-:year:-, zz-p-year:on_deck:-:-:on_deck:-' THEN
    RAISE EXCEPTION 'plan_period wrong: %', got;
  END IF;
  SELECT string_agg(book_id || ':' || level || ':' || coalesce(period, '-'), ', ' ORDER BY book_id) INTO got
  FROM to_read_level WHERE user_id = 'zz-user' AND book_id LIKE 'zz-p-%';
  IF got IS DISTINCT FROM 'zz-p-both:quarter:2027-Q1, zz-p-deck:on_deck:on_deck, '
                       || 'zz-p-quarter:quarter:2027-Q4, zz-p-someday:someday:-, zz-p-year:year:2027' THEN
    RAISE EXCEPTION 'to_read_level wrong: %', got;
  END IF;
END $$;

-- The Up next queue (task 1.10): state and the blocked-by count are derived;
-- the stored ordinal is read back as it was written, whatever the run's state.
INSERT INTO users (id, name) VALUES ('zz-q-user', 'Queue fixture') ON CONFLICT DO NOTHING;
INSERT INTO runs (id, title) VALUES
  ('zz-q-fresh', 'Queue fresh'), ('zz-q-going', 'Queue going'), ('zz-q-done', 'Queue done'),
  ('zz-q-held', 'Queue held'), ('zz-q-pre1', 'Queue prereq 1'), ('zz-q-pre2', 'Queue prereq 2');
INSERT INTO issues (id, label) VALUES ('zz-q-i1', 'Zz Queue #1'), ('zz-q-i2', 'Zz Queue #2');
INSERT INTO run_issues (run_id, sequence, issue_id) VALUES
  ('zz-q-fresh', 1, 'zz-q-i1'), ('zz-q-going', 1, 'zz-q-i1'), ('zz-q-going', 2, 'zz-q-i2'),
  ('zz-q-done', 1, 'zz-q-i1'), ('zz-q-held', 1, 'zz-q-i1'),
  ('zz-q-pre1', 1, 'zz-q-i2'), ('zz-q-pre2', 1, 'zz-q-i2');
INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
SELECT 'zz-q-user', id, NULL, 'none' FROM run_issues
WHERE (run_id = 'zz-q-going' AND sequence = 1) OR run_id = 'zz-q-done';
INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES
  ('zz-q-held', 'zz-q-pre1', 'hard'), ('zz-q-held', 'zz-q-pre2', 'hard');
INSERT INTO run_queue (user_id, run_id, ordinal) VALUES
  ('zz-q-user', 'zz-q-held', 1), ('zz-q-user', 'zz-q-going', 2),
  ('zz-q-user', 'zz-q-fresh', 3), ('zz-q-user', 'zz-q-done', 4);
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(run_id || ':' || ordinal || ':' || state || ':' || readiness || ':' || blocked_by,
                    ', ' ORDER BY ordinal) INTO got
  FROM run_queue_state WHERE user_id = 'zz-q-user';
  IF got IS DISTINCT FROM 'zz-q-held:1:unstarted:blocked:2, zz-q-going:2:reading:ready_all:0, '
                       || 'zz-q-fresh:3:unstarted:ready_all:0, zz-q-done:4:read:ready_all:0' THEN
    RAISE EXCEPTION 'run_queue_state wrong: %', got;
  END IF;
  -- A soft-deleted run leaves the view; its row stays in run_queue.
  UPDATE runs SET deleted_at = now() WHERE id = 'zz-q-fresh';
  IF EXISTS (SELECT 1 FROM run_queue_state WHERE run_id = 'zz-q-fresh') THEN
    RAISE EXCEPTION 'run_queue_state shows a soft-deleted run';
  END IF;
END $$;

-- Series, authors and universes (task 1.15, D-42, D-43). author_progress and
-- universe_progress count live books only, a book with no status is unread,
-- and follow_state is the stored choice, NULL when nobody follows.
INSERT INTO authors (id, name) VALUES ('zz-f-author', 'Zz Author'), ('zz-f-nobody', 'Zz Nobody');
INSERT INTO book_universes (id, name) VALUES ('zz-f-verse', 'Zz Verse'), ('zz-f-empty', 'Zz Empty');
INSERT INTO book_series (id, name, author_id, total_books) VALUES
  ('zz-f-series', 'Zz Series', 'zz-f-author', 5), ('zz-f-quiet', 'Zz Quiet', NULL, NULL);
INSERT INTO books (id, title, author_id, series_id, universe_id) VALUES
  ('zz-f-read',     'Zz F Read',      'zz-f-author', 'zz-f-series', 'zz-f-verse'),
  ('zz-f-toread',   'Zz F To Read',   'zz-f-author', 'zz-f-series', 'zz-f-verse'),
  ('zz-f-nostatus', 'Zz F No Status', 'zz-f-author', 'zz-f-quiet',  'zz-f-verse'),
  ('zz-f-gone',     'Zz F Gone',      'zz-f-author', 'zz-f-series', 'zz-f-verse');
UPDATE books SET deleted_at = now() WHERE id = 'zz-f-gone';
INSERT INTO book_status (user_id, book_id, status) VALUES
  ('zz-user', 'zz-f-read', 'read'), ('zz-user', 'zz-f-toread', 'to_read'), ('zz-user', 'zz-f-gone', 'read');
INSERT INTO author_follows (user_id, author_id, state) VALUES ('zz-user', 'zz-f-author', 'reading');
INSERT INTO universe_follows (user_id, universe_id) VALUES ('zz-user', 'zz-f-verse');
INSERT INTO series_follows (user_id, series_id) VALUES ('zz-user', 'zz-f-quiet');
DO $$
DECLARE got text;
BEGIN
  SELECT string_agg(author_id || ':' || books_listed || ':' || books_read || ':' || coalesce(round(pct::numeric, 3)::text, '-')
                    || ':' || coalesce(follow_state, '-'), ', ' ORDER BY author_id) INTO got
  FROM author_progress WHERE user_id = 'zz-user' AND author_id LIKE 'zz-f-%';
  IF got IS DISTINCT FROM 'zz-f-author:3:1:0.333:reading, zz-f-nobody:0:0:-:-' THEN
    RAISE EXCEPTION 'author_progress wrong: %', got;
  END IF;
  SELECT string_agg(universe_id || ':' || books_listed || ':' || books_read || ':' || coalesce(round(pct::numeric, 3)::text, '-')
                    || ':' || coalesce(follow_state, '-'), ', ' ORDER BY universe_id) INTO got
  FROM universe_progress WHERE user_id = 'zz-user' AND universe_id LIKE 'zz-f-%';
  IF got IS DISTINCT FROM 'zz-f-empty:0:0:-:-, zz-f-verse:3:1:0.333:tracking' THEN
    RAISE EXCEPTION 'universe_progress wrong: %', got;
  END IF;
  SELECT string_agg(series_id || ':' || books_listed || ':' || books_read || ':' || coalesce(follow_state, '-'),
                    ', ' ORDER BY series_id) INTO got
  FROM series_progress WHERE user_id = 'zz-user' AND series_id LIKE 'zz-f-%';
  IF got IS DISTINCT FROM 'zz-f-quiet:1:0:tracking, zz-f-series:2:1:-' THEN
    RAISE EXCEPTION 'series_progress follow_state wrong: %', got;
  END IF;
END $$;

-- A follow's state is tracking or reading, nothing else, in each of the three.
DO $$
BEGIN
  BEGIN
    INSERT INTO series_follows (user_id, series_id, state) VALUES ('zz-user', 'zz-f-series', 'done');
    RAISE EXCEPTION 'series_follows accepted state done';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO author_follows (user_id, author_id, state) VALUES ('zz-user', 'zz-f-nobody', 'done');
    RAISE EXCEPTION 'author_follows accepted state done';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO universe_follows (user_id, universe_id, state) VALUES ('zz-user', 'zz-f-empty', 'done');
    RAISE EXCEPTION 'universe_follows accepted state done';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- series_progress keeps every row and column it had before 1.15 and gains only
-- follow_state, last (AC-2): its pre-1.15 SELECT, run here, matches the view's
-- old columns row for row on every series, the followed fixture one included.
DO $$
DECLARE diff int; cols text;
BEGIN
  WITH before AS (
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
    GROUP BY u.id, bs.id, bs.name, a.name, bs.total_books
  ), after AS (
    SELECT user_id, series_id, name, author, books_listed, total_books, books_read, pct FROM series_progress
  )
  SELECT count(*) INTO diff FROM (
    (SELECT * FROM before EXCEPT ALL SELECT * FROM after)
    UNION ALL
    (SELECT * FROM after EXCEPT ALL SELECT * FROM before)) d;
  IF diff <> 0 OR NOT EXISTS (SELECT 1 FROM series_progress WHERE series_id = 'zz-f-quiet') THEN
    RAISE EXCEPTION 'series_progress changed under 1.15: % rows differ', diff;
  END IF;
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO cols
  FROM information_schema.columns WHERE table_name = 'series_progress';
  IF cols IS DISTINCT FROM 'user_id,series_id,name,author,books_listed,total_books,books_read,pct,follow_state' THEN
    RAISE EXCEPTION 'series_progress columns wrong: %', cols;
  END IF;
END $$;

-- No catalog table carries a per-user fact (AC-4, hard rule 3): a follow is a
-- row of its own, so changing its state changes follow_state and no catalog row.
DO $$
DECLARE bad text; before text; after text; got text;
BEGIN
  SELECT string_agg(table_name || '.' || column_name, ', ') INTO bad
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('books', 'authors', 'book_series', 'book_universes')
    AND (column_name IN ('user_id', 'state', 'follow_state', 'status', 'read', 'done')
         OR column_name LIKE '%complet%');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'a catalog table has a per-user column: %', bad;
  END IF;
  SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) INTO before FROM (
    SELECT b::text AS t FROM books b WHERE b.id LIKE 'zz-f-%'
    UNION ALL SELECT a::text FROM authors a WHERE a.id LIKE 'zz-f-%'
    UNION ALL SELECT s::text FROM book_series s WHERE s.id LIKE 'zz-f-%'
    UNION ALL SELECT v::text FROM book_universes v WHERE v.id LIKE 'zz-f-%') x;
  UPDATE author_follows SET state = 'tracking' WHERE user_id = 'zz-user' AND author_id = 'zz-f-author';
  SELECT follow_state INTO got FROM author_progress WHERE user_id = 'zz-user' AND author_id = 'zz-f-author';
  SELECT md5(string_agg(t::text, '|' ORDER BY t::text)) INTO after FROM (
    SELECT b::text AS t FROM books b WHERE b.id LIKE 'zz-f-%'
    UNION ALL SELECT a::text FROM authors a WHERE a.id LIKE 'zz-f-%'
    UNION ALL SELECT s::text FROM book_series s WHERE s.id LIKE 'zz-f-%'
    UNION ALL SELECT v::text FROM book_universes v WHERE v.id LIKE 'zz-f-%') x;
  IF got IS DISTINCT FROM 'tracking' OR before IS DISTINCT FROM after THEN
    RAISE EXCEPTION 'a follow change should move follow_state (%) and no catalog row (% vs %)', got, before, after;
  END IF;
END $$;

-- Applying views.sql leaves every table analyzed. A table the planner has no
-- statistics for gets nested-loop plans that ran for minutes on a preview of
-- live (2026-10-02).
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(relname, ', ' ORDER BY relname) INTO missing
  FROM pg_stat_user_tables
  WHERE schemaname = 'public' AND last_analyze IS NULL AND last_autoanalyze IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'tables never analyzed after views.sql: %', missing;
  END IF;
END $$;

ROLLBACK;

\echo 'test_views.sql: all assertions passed'
