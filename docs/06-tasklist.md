# 06 — Task list: Ledger

_The build plan beneath [05-roadmap.md](05-roadmap.md), in the shape `/milestones`
writes: each milestone is a demoable increment, made of roadmap entries in the
order they are built. The roadmap stays the source of truth (D-1): its
checkboxes for status, its **Check:** lines for acceptance. This file says which
entries make up each milestone, in what order, and why._

_The kit runs in roadmap mode (`workflow.roadmap` in `.claude/kit.json`), so a
milestone is converted into task files by roadmap ID, one sitting at a time:
`/new-task 1.10 1.9`. `/new-task` writes each new task file into its row here
(`.claude/project/new-task.md`). Status is not kept here: a row's box is in the
roadmap, and `docs/STATUS.md` rolls them up by milestone._

## Scope

| Milestones | Scope | Roadmap phases | Entries |
|---|---|---|---|

| M1–M9 | **MVP: cutover from the Sheets.** Every MVP feature in [01-product.md § Feature index](01-product.md#feature-index) | 0, 1, and 2.11a, plus what 1.25 names | 55 |
| M10–M15 | **Next:** the pace engine, the comics dashboard, editing | 2, 3 | 30 |
| M16–M25 | **Later:** enrichment, the remaining surfaces, polish, AI curation, watch and music | 4–9, and 6.2b in M12 | 56 |

- **M1–M9 are START-HERE's sittings under one numbering.** M1 and M2 are
  sittings 1–2 (Phase 0) with the Phase 0 work that came after them; M3–M9 are
  sittings 3–9, the same tasks in the same order. *Sitting 7* and *M7* name the
  same thing.
- **Cutover** is roadmap 1.26 (START-HERE Step 14), the last entry of M9: the
  final load, then a month running both. Cutting over before M9 defeats the
  migration (HANDOFF §10). Its gate is M1–M9 plus every open entry 1.25's
  parity audit names, wherever that entry's milestone is: an entry the
  Sheets' daily use needs is built before the switch, not after (D-95).
- **Sizing.** The kit's guideline is 3–8 tasks a milestone and 3–6 milestones
  to an MVP. This MVP has nine because the sittings came first and decisions
  cite them; M9 has two because sitting 9 does.
- **Runs in parallel.** M8 needs only M1, so it can be built any time before
  the final load. M23–M24 (watch) need only Phase 0 and can be pulled forward
  as a change of pace.
- **Next and Later milestones are a rough plan.** Each is reshaped when the
  milestone before it closes, and every schema proposal in them is asked at its
  task's plan gate (CLAUDE.md, *Stop and ask*).
- **Unscheduled:** L-1 to L-3 ([05-roadmap.md § Later](05-roadmap.md#later--noted-not-scheduled)), each behind an open question.

## Coverage

| Check | Result |
|---|---|
| MVP features in an MVP milestone | 20/20 (F-01–F-20) |
| Next and Later features scheduled | 12/12 Next, 25/25 Later |
| Roadmap entries in exactly one milestone | 129/129 |
| Roadmap entries serving a feature | 129/129 |
| MVP screens built by a task | `spine`, `range`, `batch`, `bulk`, `addsearch`, `apistates`, `add`, `blist`, `capture`, `queue`, `status`, `moveplan` (levels only), and the shell around `home`, `bdash` and `watchlist` (1.8); the dashboards' contents are M10 and M12 |
| Tables | 32/32 built (`src/db/schema.ts`, migrations through `0013`); every proposed table has its task (below) |

### Features → milestones

| Feature | Priority | Roadmap entries | Milestones |
|---|---|---|---|
| F-01 Private sign-in | MVP | 1.11 | M7 |
| F-02 Both workbooks migrated, rebuildable until cutover | MVP | 0.3, 0.4, 0.5, 0.6, 0.7, 1.25, 1.26 | M1, M9 |
| F-03 Tested, released by hand, backed up | MVP | 0.1, 0.2, 0.11, 0.12 | M1, M6, M2 |
| F-04 Fast on a phone | MVP | 0.9, 0.10, 1.8d | M2, M6 |
| F-05 One shell for three media | MVP | 1.8a, 1.8c, 1.8, 1.8e, 1.8b | M6 |
| F-06 Mark an issue read, in this run | MVP | 0.8a, 0.8b, 1.2 | M2, M3 |
| F-07 Mark a range, adopt prior reads | MVP | 1.1 | M3 |
| F-08 Resume where I stopped | MVP | 1.6 | M3 |
| F-09 Add issues by typing them | MVP | 1.3, 1.3c, 1.19 | M4, M9 |
| F-10 Add issues from a Metron search | MVP | 1.3b | M4 |
| F-11 An Up next queue for comics | MVP | 1.10 | M7 |
| F-12 In flight · Up next · Done | MVP (then Later) | 1.9, 8.8 | M7, M24 |
| F-13 The volume map | MVP (then Next) | 1.12, 3.9 | M7, M13 |
| F-14 A prerequisite graph without cycles | MVP (then Next) | 2.11a, 3.3 | M7, M13 |
| F-15 Add books by search, paste or hand | MVP | 1.4, 1.4c, 1.4e, 1.22 | M5, M9 |
| F-16 Quick-capture inbox | MVP | 1.4b | M5 |
| F-17 A dated reading log | MVP | 1.5, 1.16, 1.17 | M5, M9 |
| F-18 To-read levels | MVP | 1.7, 1.4d, 1.21 | M6, M5, M8 |
| F-19 A clean, enriched book catalog | MVP | 1.13, 1.14, 1.18, 1.20 | M8 |
| F-20 Follow series, authors and universes | MVP (then Later) | 1.15, 5.11, 5.12 | M8, M17 |
| F-21 The pace engine | Next (then Later) | 2.0, 2.1, 2.1b, 6.12 | M10, M20 |
| F-22 Books dashboard and the plan rail | Next | 2.2, 2.2b | M10 |
| F-23 Plan editing and rebalance | Next | 2.3, 2.7, 2.8, 2.10 | M11 |
| F-24 Comics dashboard and the telescope | Next | 2.5, 2.5b, 2.4 | M12 |
| F-25 Unlock cost, leverage and the frontier | Next | 2.6, 6.2b | M12 |
| F-26 Run list by track and block | Next | 2.9 | M12 |
| F-27 Run and block completion | Next | 2.12 | M12 |
| F-28 Edit the catalog in place | Next | 3.1, 3.2, 3.7, 3.8 | M13 |
| F-29 Detail sheets | Next (then Later) | 3.5, 8.4 | M14, M23 |
| F-30 Eras and spine v2 | Next | 3.6, 3.6b, 3.6c | M14 |
| F-31 Ratings, notes and DNF | Next (then Later) | 3.4, 5.4, 5.5 | M14, M18, M17 |
| F-32 Adding at scale | Next | 3.10, 3.11, 3.12 | M15 |
| F-33 Metadata backfill and covers | Later | 4.1, 4.2, 4.3, 4.4 | M16 |
| F-34 Shelves with context | Later | 5.1, 8.6 | M17, M24 |
| F-35 Tracks page | Later | 5.2 | M18 |
| F-36 Editions: collected in | Later | 5.6, 5.10 | M18 |
| F-37 Coming out | Later | 5.7, 5.8 | M17, M18 |
| F-38 Series pages | Later | 5.9, 5.13 | M17, M18 |
| F-39 Search and the verb palette | Later | 6.1 | M19 |
| F-40 Stats and the activity log | Later | 6.2, 6.17 | M19 |
| F-41 Offline and the keyboard | Later | 6.4, 6.5 | M20 |
| F-42 Prerequisite graph and events | Later | 6.3, 6.8 | M19 |
| F-43 Choosing from the master list | Later | 6.10 | M19 |
| F-44 Appearance | Later | 6.11, 6.14, 6.15, 6.9 | M20, M21 |
| F-45 Hardening | Later | 6.13, 6.16 | M21 |
| F-46 Import from Goodreads or StoryGraph | Later | 6.6 | M21 |
| F-47 AI review and drafting | Later | 7.1, 7.2, 7.3, 7.4, 7.5 | M22 |
| F-48 Release digest email | Later | 7.6 | M22 |
| F-49 Catch me up | Later | 7.7 | M22 |
| F-50 Issue context | Later | 7.8 | M22 |
| F-51 Watchlist: search, add, seasons | Later | 8.1, 8.2, 8.3 | M23 |
| F-52 Franchises | Later | 8.5 | M23 |
| F-53 Watch dashboard | Later | 8.7 | M24 |
| F-54 New seasons, where to watch, people | Later | 8.9, 8.10 | M24 |
| F-55 Artists and albums | Later | 9.0, 9.1, 9.2, 9.3 | M25 |
| F-56 Song ranking and favourite albums | Later | 9.4, 9.5 | M25 |
| F-57 Music dashboard and status | Later | 9.6 | M25 |
| F-58 Audiobooks | MVP | 1.23 | M9 |

### Entities → tasks

| Tables | Created by |
|---|---|
| `users`, `tracks`, `runs`, `run_tracks`, `prereqs`, `events`, `editions`, `edition_progress`, `issues`, `issue_progress`, `books`, `authors`, `book_series`, `book_status`, `reading_plan`, `releases`, `wishlist`, `external_lists` | v1, before the roadmap (migration `0000`); reshaped by 0.4, 0.7, 0.8a, 1.5 and 1.7 |
| `blocks` | migration `0002` (ahead of 0.3) |
| `run_issues`, `creators`, `issue_credits` | 0.7 (`0003`) |
| `eras`, `reading_settings`, `shelves`, `shelf_books`, `volume_rules` | 0.3 (`0005`); `volume_rules` is loaded by 1.12, `eras` edited by 3.6, `reading_settings` by 2.0, shelves by 5.1 |
| `metron_cache`, `open_library_cache` | 1.3b (`0008`), 1.4c (`0009`) |
| `inbox` | 1.4b (`0010`) |
| `read_events` | 1.5 (`0011`) |
| `run_queue` | 1.10 (proposed) |
| `book_universes`, `series_follows`, `author_follows`, `universe_follows` | 1.15 (proposed) |
| `sessions` | 2.1b (proposed) |
| `edition_issues` | 5.6 (proposed) |
| `proposals` | 7.1 (proposed) |
| `titles`, `seasons`, `franchises`, `franchise_titles`, `title_status`, `season_status`, `watch_events`, `people`, `title_credits` | 8.1 (proposed; the draft is data model §4.2) |
| `shelf_titles` | 8.6 (proposed) |
| `title_providers` | 8.9 (proposed) |
| `artists`, `albums`, `tracks` (music), `artist_follows`, `album_status`, `listen_events`, song rankings | 9.1, 9.4 (proposed) |

Views are in `etl/views.sql` and listed in data model §3; each new one lands
with the task that first reads it.

---

# MVP: cutover

## M1: Foundation: tests, CI and the schema — MVP

**Goal:** Every later check has a runner and CI, and the schema holds what Phase 1 writes.  
**Demo at exit:** `npm run test:all` is green locally and in CI's `check`; `npm run rebuild` loads both workbooks with one issue per comic.  
**Features:** F-03, F-02  
**Depends on:** —  
**Order:** Sitting 1 (0.2 → 0.3 → 0.4 → 0.5), with 0.1 first because it blocks every other task, and 0.6 and 0.7 landed before the first load.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 0.1 | Test harness | S | — | — |
| 0.2 | CI | S | — | — |
| 0.3 | Schema additions | M | — | — |
| 0.4 | Soft-delete everywhere | S | — | — |
| 0.5 | Volume-year normalization | S | — | — |
| 0.6 | Derived run span, cover dates, reviewed whys | M | — | — |
| 0.7 | One issue per comic, credits, story titles, label review | M | — | — |

## M2: Read state per run, and a measured app — MVP

**Goal:** Read state belongs to the placement, and every preview is measured.  
**Demo at exit:** An issue read in one run is unread in another and carries a grey *read in …* hint; each PR's preview gets one Lighthouse comment.  
**Features:** F-06, F-04, F-03  
**Depends on:** M1  
**Order:** Sitting 2 (0.8a → 0.8b), then 0.9 and 0.10, added when the owner found navigation slow (0.10 needs 0.9's routes and runner), and 0.12.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 0.8a | Read state per run — schema, ETL and views | M | — | — |
| 0.8b | Read state per run — the spine | S | — | 0.8a |
| 0.9 | Page performance — measure, find the cause, fix it | M | — | — |
| 0.10 | Lighthouse on every preview | M | — | 0.9 |
| 0.12 | A redeploy of a skipped preview builds | S | — | — |

## M3: Pleasant to use — MVP

**Goal:** The app becomes pleasant to use.  
**Demo at exit:** Mark a range on `hickman-krakoa`, undo it in one step, and resume the run from its next issue.  
**Features:** F-06, F-07, F-08  
**Depends on:** M2 (0.8a)  
**Order:** Sitting 3: 1.2 → 1.1 → 1.6. 1.1's check asserts undo, and 1.1 must not carry its own (R3-10).

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.2 | Undo | S | TASK-001 | — |
| 1.1 | Range marking | M | TASK-002 | 0.8a, 1.2 |
| 1.6 | Resume pointer | S | TASK-003 | — |

## M4: Adding a run beats the sheet — MVP

**Goal:** Adding a run is faster than the sheet.  
**Demo at exit:** Paste a run's labels, or search Metron, and add them through one review table.  
**Features:** F-09, F-10  
**Depends on:** M2  
**Order:** Sitting 4: 1.3 → 1.3c → 1.3b. 1.3c's review table takes the parser's output; 1.3b's Metron results go through the same review and insert. The long one.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.3 | Bulk issue entry — parser and validation | M | TASK-004 | — |
| 1.3c | Bulk issue entry — review table and insert | M | TASK-005 | 1.3 |
| 1.3b | Add issues from a Metron search | M | TASK-006 | — |

## M5: Books end to end — MVP

**Goal:** Books work end to end.  
**Demo at exit:** Add a book by search, paste or hand to a destination, finish it with a date, and jot a note in the inbox and resolve it.  
**Features:** F-15, F-16, F-18, F-17  
**Depends on:** M2  
**Order:** Sitting 5: 1.4 → 1.4c → 1.4b → 1.4d → 1.5 → 1.16. Resolving an inbox note (1.4b) routes into the add flows; 1.4d promotes the wishlist through 1.4's paste review, once, after the final load (D-39); 1.5 must land before real rereads overwrite history; 1.16 reinterprets the dates 1.5 adds, and lands before the final load.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.4 | Books bulk entry | M | TASK-007 | — |
| 1.4c | Add a book by search or by hand, to a destination | M | TASK-008 | — |
| 1.4b | Quick-capture inbox | S | TASK-009 | — |
| 1.4d | Promote the wishlist into Someday | S | TASK-024 | 1.4 |
| 1.5 | Dated reading log | M | TASK-010 | — |
| 1.16 | Dates in `America/New_York` | M | TASK-025 | 1.5 |

## M6: The real navigation — MVP

**Goal:** The real navigation.  
**Demo at exit:** The shell at 360, 768, 1024 and 1280px: the media bar, the tablet rail and the sidebar, every route reachable, `/` opening the last medium.  
**Features:** F-18, F-05, F-03, F-04  
**Depends on:** M5  
**Order:** Sitting 6: 1.7 → 1.8a → 0.11 → 1.8c → 1.8 → 1.8e → 1.8d → 1.8b. 1.8a's tokens come before the first UI task; 0.11's harness runs 1.8's computed-style check and 1.8d's axe run; 1.8c moves the routes the nav links to; 1.8e redraws the tablet frames 1.8 drew in outline and needs only 1.8; 1.8d's axe run covers the finished chrome; 1.8b was split out of 1.8 (R3-12).

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.7 | One period column on `reading_plan` | M | TASK-011 | — |
| 1.8a | Design tokens and control states | M | TASK-012 | — |
| 0.11 | Browser test harness — Playwright and axe | M | TASK-013 | — |
| 1.8c | Dashboard routes and the `/` redirect | M | TASK-026 | 0.11 |
| 1.8 | App shell | L | TASK-014 | 1.8a |
| 1.8e | Tablet frames to the feel pass | S | TASK-028 | 1.8 |
| 1.8d | Failed writes, skeletons and row markup | M | TASK-027 | 1.8 |
| 1.8b | Thumb bar and contrast | S | TASK-015 | 1.8, 1.8d |

## M7: Phase 1 complete — MVP

**Goal:** Phase 1 complete.  
**Demo at exit:** Queue runs and reorder them; the status screens for comics and books; extract lists the prerequisite cycles for your audit.  
**Features:** F-11, F-12, F-14, F-13, F-01  
**Depends on:** M6  
**Order:** Sitting 7: 1.10 → 1.9 → 2.11a → 1.12 → 1.11. 1.9's Up next tab reads the queue; 2.11a is numbered in Phase 2 but built here, before cutover (D-20), and so is 1.11 (D-36); 1.12 must land before Step 14's final load, the last time `load` runs.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.10 | Comics Up next queue | M | TASK-016 | 0.8a |
| 1.9 | Status screens: In flight · Up next · Done | M | TASK-017 | 0.8a, 1.8, 1.10 |
| 2.11a | Prerequisite cycle check | S | TASK-018 | — |
| 1.12 | Load the volume map into `volume_rules` | S | TASK-019 | — |
| 1.11 | Slow down failed sign-ins | S | TASK-020 | — |

## M8: Books load clean — MVP

**Goal:** Books load clean.  
**Demo at exit:** Books load with covers, page counts and real word counts. Answer `book_review.csv` between 1.13 and 1.14, and 1.18's `calibre` near spellings in the same file (Calibre is the source of truth for the rest, D-87); Calibre's other books wait at *Unlisted*.  
**Features:** F-18, F-19, F-20  
**Depends on:** M1  
**Order:** Sitting 8: 1.13 → 1.14 → 1.15 → 1.21 → 1.18 → 1.18b → 1.18c → 1.14b → 1.20 (the 2026-10-08 book-ingest review; 1.20 from the owner, 2026-10-26, holds books Hardcover doesn't know for review; 1.21 from the 2026-10-26 books intake; 1.18b and 1.18c from 1.18's review, D-90; 1.14b from the switch to Hardcover, D-94). 1.14's proposals join 1.13's review file; 1.15 seeds from the series and author names 1.13's review fixed; 1.21 defines the *Unlisted* level that 1.18 creates Calibre's other books at (D-83, D-86); 1.18 reports where Calibre and 1.14's Open Library answers disagree (D-73, D-87) and can be re-run until cutover; 1.14b replaces 1.14's Open Library details with Hardcover's, by Calibre's ISBNs, once the owner has filled the missing ones in Calibre. All nine change what `load` puts in, so they land before the final load. They don't depend on M3–M7 and can be built earlier, leaving time to answer the reviews.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.13 | Book extract — one book per title and author, a merge review, no workbook reads | M | TASK-021 | — |
| 1.14 | Open Library details for the workbook's books | M | TASK-022 | 1.13 |
| 1.15 | Track series, authors and universes | M | TASK-023 | 1.13 |
| 1.21 | Unlisted: the books you have but haven't put on your list | S | TASK-029 | — |
| 1.18 | Calibre: word counts, series, tags and reads for the books | M | TASK-030 | 1.14, 1.15, 1.21 |
| 1.18b | Calibre: universes, subseries, page counts and the Calibre id | M | TASK-032 | 1.18 |
| 1.18c | Calibre genres | M | TASK-033 | 1.18b |
| 1.14b | Hardcover details for the books, by ISBN | M | TASK-034 | 1.18b |
| 1.20 | Hold books with no Open Library match for review | M | TASK-031 | 1.14b |

## M9: Captured from cutover on — MVP

**Goal:** Captured from cutover on.  
**Demo at exit:** Paste a list as title and author in their own cells; search as you type, with each result's source; set a book to *Reading* and its start date is kept; listen to a book and finish it, and it counts as a read with the headphones glyph; then the last load, and both Sheets archived read-only with the app as the record.  
**Features:** F-02, F-09, F-15, F-17, F-58  
**Depends on:** M5, M8 (1.21)  
**Order:** Sitting 9: 1.25 → 1.4e → 1.4f → 1.19 → 1.22 → 1.24 → 1.17 → 1.23 → 1.26. 1.25, the Sheets parity audit (D-95), goes first and can run any time, even before M8 closes: every open entry it names is built before 1.26, so its list sets how long this milestone is, and 1.26, the switch itself, comes last. Then five fixes to screens already in daily use (1.4f searches Hardcover instead of Open Library, D-94, before 1.22 tags each result's source; 1.19 turns on 1.8's comics *Add*, from 1.8b's plan; 1.22 from the 2026-10-26 books intake; 1.24, from TASK-030's follow-ups, lets a wishlist accept move one of 1.18's Unlisted books onto the list), then start dates and audiobooks, which like 1.5 must land before real reading accumulates and before cutover. 1.23 follows 1.17 because both change `book_status` and `read_events`.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 1.25 | Sheets parity audit | S | — | — |
| 1.4e | Paste a list: title and author in their own cells | S | — | — |
| 1.4f | Add books searches Hardcover | M | — | — |
| 1.19 | Comics Add remembers the last run | S | — | 1.8, 1.3c |
| 1.22 | Search as you type, and where each result comes from | M | — | 1.21, 1.4f |
| 1.24 | Wishlist accept promotes an Unlisted book to Someday | S | — | 1.21, 1.4d |
| 1.17 | Started and finished: a start date for books, a derived span for runs | M | — | — |
| 1.23 | Audiobooks: listening, and a listen that counts as a read | M | — | 1.5, 1.17 |
| 1.26 | Cut over from the Sheets | M | — | 1.25, all of Phase 1, and every open entry 1.25 names |

# Next

## M10: Capacity: is the year overcommitted? — Next

**Goal:** Answer "is 2027 overcommitted" from the real reading rate.  
**Demo at exit:** Settings take minutes a day and words a minute; a logged session recalculates them; the books dashboard shows the book in hand and the quarter against 760k, and the plan rail draws the year.  
**Features:** F-21, F-22  
**Depends on:** Cutover (M1–M9)  
**Order:** 2.0 → 2.1 → 2.1b → 2.2 → 2.2b: settings feed capacity, the dashboard reads capacity, and the rail is the dashboard's.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 2.0 | Settings | S | — | — |
| 2.1 | Capacity view | M | — | 1.7, 2.0 |
| 2.1b | Reading sessions — after-the-fact entry | S | — | 2.0 |
| 2.2 | Books dashboard | M | — | 1.7, 1.8, 2.1 |
| 2.2b | The plan rail | M | — | 2.2 |

## M11: Editing the plan — Next

**Goal:** Act on what the plan rail shows.  
**Demo at exit:** Move a book between periods, rebalance an over-full year or accept it as a stretch year, and place the unquartered.  
**Features:** F-23  
**Depends on:** M10  
**Order:** 2.3 → 2.7 → 2.8 → 2.10: the picker first, then the actions that use it, then the full-size plan page.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 2.3 | Plan editor | M | — | 1.7, 2.1 |
| 2.7 | Rebalance, and accepting an overage | M | — | — |
| 2.8 | Place the unquartered | M | — | — |
| 2.10 | Plan page as the full-size rail | M | — | 1.7, 2.1, 2.2 |

## M12: The comics dashboard and the telescope — Next

**Goal:** Where am I, drawn; what does a run really cost.  
**Demo at exit:** The comics dashboard with the telescope, the Up next shelf and *Ready when you are*; the run list grouped track → block with `costs N · opens N`; finishing a run shows what it opened.  
**Features:** F-24, F-25, F-26, F-27  
**Depends on:** M7 (1.10), M6 (1.8b)  
**Order:** 2.5 → 2.5b → 2.6 → 2.4 → 2.9 → 2.12. 2.4 draws 2.5b's telescope and 2.6's cost; 2.9 and 2.12 read 2.6's views. 2.4's *Coming out* line waits for 5.8 (M18). 6.2b is the scope note that moved unlock cost here.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 2.5 | The telescope | M | — | — |
| 2.5b | The telescope — SVG and ladder | M | — | 2.5, 0.8a |
| 2.6 | Unlock cost, leverage and the frontier | M | — | — |
| 2.4 | Comics dashboard | L | — | 1.6, 1.8, 1.8b, 1.10, 2.5b, 2.6 |
| 2.9 | Run list, grouped track → block | M | — | 2.6 |
| 2.12 | Run and block completion | M | — | 1.8b, 2.5b, 2.6 |
| 6.2b | True unlock cost | S | — | — |

## M13: Editing the catalog — Next

**Goal:** Maintain the catalog in the app.  
**Demo at exit:** Edit a field inline, create a run with its tracks and prerequisites, assign and name blocks, archive and restore, edit the volume map.  
**Features:** F-28, F-14, F-13  
**Depends on:** M12 (2.9)  
**Order:** 3.1 → 3.2 → 3.3 → 3.7 → 3.8 → 3.9: 3.1's field is the pattern the rest reuse; 3.8 reorders 2.9's grouped run list.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 3.1 | Inline field editing | M | — | — |
| 3.2 | Create and edit runs | M | — | — |
| 3.3 | Prereq editor | M | — | — |
| 3.7 | Archive and restore | S | — | 0.4 |
| 3.8 | Blocks: assign, order, name | M | — | 2.9 |
| 3.9 | Volume map editor | S | — | 1.12 |

## M14: The run detail and the detail sheets — Next

**Goal:** The run detail and the detail sheets.  
**Demo at exit:** Open a book or an issue as a sheet over its list and dismiss it with Back; rate a book; section a run into eras, with ordinals, release dates and read rows hidden.  
**Features:** F-29, F-31, F-30  
**Depends on:** Cutover  
**Order:** 3.5 → 3.4 → 3.6 → 3.6b → 3.6c.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 3.5 | Detail sheets — books and issues | M | — | — |
| 3.4 | Book ratings and top-books reorder | S | — | — |
| 3.6 | Eras on the run detail | M | — | — |
| 3.6b | Spine rows — ordinal gutter and release dates | S | — | 0.8b |
| 3.6c | Hide read in this run | S | — | 0.8a |

## M15: Adding at scale — Next

**Goal:** Adding at scale.  
**Demo at exit:** Add a whole volume from its issue list, arrange the new issues as you add them, and preview an issue before adding it.  
**Features:** F-32  
**Depends on:** M4, M13 (3.2)  
**Order:** 3.10 → 3.11 → 3.12: 3.11's *Arrange* step follows 3.10's series browser into 1.3c's review.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 3.10 | Add from a series' issue list | M | — | 1.3b, 1.3c, 3.2 |
| 3.11 | Arrange issues in the reading order | M | — | 1.3c, 3.10 |
| 3.12 | Issue previews in Add issues | S | — | 1.3b |

# Later

## M16: Enrichment and covers — Later

**Goal:** Metadata below every label, and real covers.  
**Demo at exit:** After cutover, Metron, Open Library and Hardcover fill the catalog without touching a hand value; covers show on spine rows and dashboards.  
**Features:** F-33  
**Depends on:** Cutover  
**Order:** 4.4 → 4.1 → 4.2 → 4.3. A prerequisite for M22. 4.4 goes first (2026-10-26 books intake): after cutover it is the only way Calibre's new books and reads come in, and it needs nothing else in this milestone.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 4.4 | Sync from Calibre after cutover: upload `metadata.db` | M | — | 1.18, 1.21 |
| 4.1 | Metron backfill | M | — | — |
| 4.2 | Open Library and Hardcover backfill | M | — | — |
| 4.3 | Covers in the UI | S | — | — |

## M17: Book surfaces — Later

**Goal:** The remaining book surfaces.  
**Demo at exit:** Shelves with notes, DNF with a reason, books coming out, a page per series, author and universe pages, and *In the middle of*.  
**Features:** F-34, F-31, F-37, F-38, F-20  
**Depends on:** M7 (1.9), M8 (1.15)  
**Order:** 5.1 → 5.5 → 5.7 → 5.9 → 5.11 → 5.12: 5.11 builds on 5.9's series page, and 5.12 reads 5.1's shelves and 5.11's follows.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 5.1 | Shelves (books only): create, add items, reorder | M | — | — |
| 5.5 | DNF with a reason field | S | — | — |
| 5.7 | Books coming out | M | — | 1.4c, 1.8 |
| 5.9 | Series page from `series_progress` | M | — | — |
| 5.11 | Author and universe pages, and the follow control | M | — | 1.15, 5.9 |
| 5.12 | In the middle of: series, authors, universes and reading-order shelves | S | — | 1.9, 1.15, 5.1, 5.11 |

## M18: Comic surfaces — Later

**Goal:** The remaining comic surfaces.  
**Demo at exit:** The tracks page, a rating when a run is finished, *Collected in*, new issues for the runs you follow, and a page per comic volume with its gaps.  
**Features:** F-35, F-31, F-36, F-37, F-38  
**Depends on:** M14 (3.5), M16 (4.1), M17 (5.7)  
**Order:** 5.2 → 5.4 → 5.6 → 5.8 → 5.10 → 5.13: 5.10 reads 5.6's parsed editions; 5.8 follows 5.7's release pattern.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 5.2 | Tracks page from `track_progress` | S | — | — |
| 5.4 | Ratings and post-read notes on runs | S | — | — |
| 5.6 | `edition_issues` parser: issue text into join rows | M | — | — |
| 5.8 | Comic issues coming out, for the runs you follow | M | — | 1.3b, 1.3c, 5.7 |
| 5.10 | Editions: collected and read | M | — | 5.6 |
| 5.13 | Comic series page: every issue of a volume, its runs and its gaps | M | — | 3.5, 4.1 |

## M19: Find and look back — Later

**Goal:** Find anything, and look back.  
**Demo at exit:** `Ctrl+K` across everything; stats and the activity log; the prerequisite graph; events with verdicts; *Pick one* on the master list.  
**Features:** F-39, F-40, F-42, F-43  
**Depends on:** M10 (2.1b)  
**Order:** Any order (Phase 6). 6.2 needs 1.5 and 2.1b; 6.17 needs 1.17.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 6.1 | Global search, `Ctrl+K`, across runs, issues, books, series, events | M | — | — |
| 6.2 | Stats and year in review | L | — | 1.5, 2.1b |
| 6.17 | Activity: the reading log as a page | M | — | 1.5, 1.17 |
| 6.3 | Prereq graph visualization | M | — | — |
| 6.8 | Events page with your read-it/skip verdicts | S | — | — |
| 6.10 | Master list: *Fits Q2 · 56k*, *Pick one* and saved views | S | — | — |

## M20: Devices and input — Later

**Goal:** Every device and input.  
**Demo at exit:** Marks queue offline and sync; `j`/`k`/`x`/`/` on the desktop; compact density; the session timer; the sidebar toggle; a favicon.  
**Features:** F-41, F-44, F-21  
**Depends on:** Cutover  
**Order:** Any order (Phase 6).

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 6.4 | PWA: manifest, service worker, queued offline writes | M | — | — |
| 6.5 | Keyboard shortcuts: `j`/`k`/`x`/`/` | S | — | — |
| 6.11 | Density toggle in Settings → Appearance | S | — | — |
| 6.12 | Reading-session timer | M | — | — |
| 6.14 | Sidebar toggle (UX-N08) | S | — | — |
| 6.15 | A favicon | S | — | — |

## M21: Hardening and the last pass — Later

**Goal:** Hardening and the last pass.  
**Demo at exit:** A malformed body answers 400; a sign-in stronger than one passcode; a Goodreads or StoryGraph import; the theme revisited once every screen exists.  
**Features:** F-45, F-46, F-44  
**Depends on:** M19, M20  
**Order:** 6.9 last: it is a pass over every finished screen.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 6.16 | A malformed request body is a 400, not a 500 | S | — | — |
| 6.13 | Better sign-in than one passcode (D-23) | M | — | — |
| 6.6 | Goodreads and StoryGraph CSV import | M | — | — |
| 6.18 | Drop `user_id`: the schema is single-user | L | — | — |
| 6.19 | Remove Open Library | S | — | 1.14b, 1.4f |
| 6.9 | Revisit the theme | M | — | — |

## M22: AI-assisted curation — Later

**Goal:** Claude proposes, Metron verifies, you approve.  
**Demo at exit:** Review a run's reading order as a diff and accept rows one at a time; draft a run; a recap before a later book; drafted issue context.  
**Features:** F-47, F-48, F-49, F-50  
**Depends on:** M16 (Phase 4)  
**Order:** 7.1 → 7.2 first: the proposals table and the verification gate every later task goes through.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 7.1 | Proposals table and API plumbing | M | — | — |
| 7.2 | Verification gate | M | — | — |
| 7.3 | Review a run's reading order | M | — | — |
| 7.4 | Review a block or track | M | — | — |
| 7.5 | Draft a new run from scratch | L | — | — |
| 7.6 | Release digest email | S | — | — |
| 7.7 | Catch me up: a recap before a later book in a series | M | — | 7.1 |
| 7.8 | Issue context: draft notes for a run's important issues | M | — | 7.1, 7.2, 4.1 |

## M23: Watchlist: search, seasons, franchises — Later

**Goal:** Films, shows and seasons.  
**Demo at exit:** Search TMDB, add a show with its seasons, track it by season, open its detail sheet, and see it in a franchise.  
**Features:** F-51, F-29, F-52  
**Depends on:** M1–M2 only (Phase 0): can be pulled forward any time  
**Order:** 8.1 → 8.2 → 8.3 → 8.4 → 8.5.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 8.1 | Schema and TMDB client | M | — | — |
| 8.2 | Search and add | M | — | — |
| 8.3 | Lists and season progress | M | — | — |
| 8.4 | Detail sheets — film, show, season | M | — | — |
| 8.5 | Franchises | M | — | — |

## M24: Watch, every day — Later

**Goal:** Watch, every day.  
**Demo at exit:** The watch dashboard and status tabs, title shelves, a new season found when you ask with where to watch it, and a page per director or actor.  
**Features:** F-53, F-12, F-34, F-54  
**Depends on:** M23, M7 (1.9)  
**Order:** 8.7 → 8.8 → 8.6 → 8.9 → 8.10.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 8.7 | Watch dashboard | M | — | 8.3 |
| 8.8 | Watch status: In flight · Up next · Done | S | — | 1.9, 8.3 |
| 8.6 | Title shelves | S | — | — |
| 8.9 | Refresh shows: new seasons and where to watch | M | — | 8.1, 8.3 |
| 8.10 | People: director and cast pages | S | — | 8.1, 8.3 |

## M25: Music — Later

**Goal:** A fourth medium, last (D-75).  
**Demo at exit:** Follow an artist, mark albums listened, rank an artist's songs with *This or that*, and see the music dashboard.  
**Features:** F-55, F-56, F-57  
**Depends on:** M24 (after Phase 8)  
**Order:** 9.0 first: a fourth medium changes the phone media bar every screen shares, so it is designed before it is built.

| # | Task | Size | Task file | Depends on |
|---|---|---|---|---|
| 9.0 | Music in the shell, designed | M | — | — |
| 9.1 | Schema and MusicBrainz client | M | — | 9.0 |
| 9.2 | Search and add an artist, with the discography | M | — | 9.1 |
| 9.3 | Albums: listened, rated, logged | S | — | 9.2 |
| 9.4 | Rank an artist's songs | M | — | 9.2 |
| 9.5 | Which albums you favour | S | — | 9.4 |
| 9.6 | Music dashboard and status | M | — | 9.0, 9.3, 1.9 |

---

## Standing rules for every task

1. Plan mode first if the task touches more than two files. Skip it if you could
   describe the diff in one sentence.
2. No task merges without a test that would have failed before it.
3. Migrations are forward-only and reversible; never edit a migration that has
   been applied to production.
4. Never touch `etl/extract.py` output format without re-running it against both
   workbooks and diffing the CSVs.
5. Run an adversarial review before merging anything in Phase 1 or 3 — a
   subagent that sees only the diff and the task's acceptance criteria. Tell it
   to report gaps affecting correctness, not style preferences.
6. A UI task meets the UX floor (design §10, [04-design.md](04-design.md)), and if it changes what a
   screen looks like it changes `design/mockups.html` and
   `design/mockups-index.md` in the same PR. Anything the mockup cannot show yet
   is listed under *Not shown* in the index rather than silently skipped.
7. A task that creates a table adds it to `GET /api/export`
   (`src/db/export-tables.ts`) in the same PR, user-scoped if it has a `user_id`;
   `test/export-tables.test.ts` fails otherwise (D-17, S-12). `users` stays out.
