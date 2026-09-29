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

-- One issue in two runs of one track. Reading it once marks it read in both
-- runs, and the track counts it once.
INSERT INTO users (id, name) VALUES ('zz-user', 'Fixture reader');
INSERT INTO tracks (id, name) VALUES ('zz-track', 'Fixture track');
INSERT INTO runs (id, title) VALUES ('zz-run-a', 'Run A'), ('zz-run-b', 'Run B');
INSERT INTO run_tracks (run_id, track_id) VALUES ('zz-run-a', 'zz-track'), ('zz-run-b', 'zz-track');
INSERT INTO issues (id, label) VALUES
  ('zz-x1', 'Zz Crossover (2000) #1'), ('zz-a2', 'Zz Alpha (2000) #2'), ('zz-b2', 'Zz Beta (2000) #2');
INSERT INTO run_issues (run_id, sequence, issue_id, type) VALUES
  ('zz-run-a', 1, 'zz-x1', 'core'), ('zz-run-a', 2, 'zz-a2', 'core'),
  ('zz-run-b', 1, 'zz-b2', 'core'), ('zz-run-b', 2, 'zz-x1', 'optional');
INSERT INTO issue_progress (user_id, issue_id) VALUES ('zz-user', 'zz-x1');

DO $$
DECLARE a record; b record; t record;
BEGIN
  SELECT * INTO a FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-run-a';
  SELECT * INTO b FROM run_progress WHERE user_id = 'zz-user' AND run_id = 'zz-run-b';
  IF a.read_issues <> 1 OR b.read_issues <> 1 OR a.total_issues <> 2 OR b.total_issues <> 2 THEN
    RAISE EXCEPTION 'shared issue not read in both runs: a %/%, b %/%',
      a.read_issues, a.total_issues, b.read_issues, b.total_issues;
  END IF;
  SELECT * INTO t FROM track_progress WHERE user_id = 'zz-user' AND track_id = 'zz-track';
  IF t.total_issues <> 3 OR t.read_issues <> 1 THEN
    RAISE EXCEPTION 'track_progress double-counted a shared issue: %/%', t.read_issues, t.total_issues;
  END IF;
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
INSERT INTO issue_progress (user_id, issue_id) VALUES ('zz-user', 'zz-str1'), ('zz-user', 'zz-std1');

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
INSERT INTO issue_progress (user_id, issue_id) VALUES
  ('zz-user', 'zz-sg1'), ('zz-user', 'zz-sg2'), ('zz-user', 'zz-sg3'), ('zz-user', 'zz-sg5');

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
  INSERT INTO issue_progress (user_id, issue_id, completed_at, completed_at_precision)
    SELECT 'zz-user', id, NULL, 'none' FROM issues
      WHERE id NOT IN (SELECT issue_id FROM issue_progress WHERE user_id = 'zz-user') LIMIT 1;
  DELETE FROM issue_progress WHERE user_id = 'zz-user' AND completed_at IS NULL;
  BEGIN
    INSERT INTO issue_progress (user_id, issue_id, completed_at, completed_at_precision)
      SELECT 'zz-user', id, NULL, 'exact' FROM issues
        WHERE id NOT IN (SELECT issue_id FROM issue_progress WHERE user_id = 'zz-user') LIMIT 1;
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

ROLLBACK;

\echo 'test_views.sql: all assertions passed'
