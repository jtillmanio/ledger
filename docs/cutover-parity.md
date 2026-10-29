# Cutover parity: the Sheets, tab by tab

Roadmap 1.25 (D-95). Cutover (1.26) freezes `Comics.xlsx` and `Books.xlsx`, so
anything the owner still does in them stops the day after unless the app does
it. This file lists every tab of a fresh export (2026-10-29: 16 comics tabs, 22
books tabs; re-list before 1.26 with the one-liner in 1.25's **Check:**), what
the owner reads or does there, and where each use goes.

Each use ends in one of:

- **a ticked roadmap ID**: the app does it today;
- **an open roadmap ID**: it is built before the switch, so it is in 1.26's
  **Depends on** and in M9's *Order*;
- **won't carry**, with the owner's reason. A reason may name a later entry
  (*6.8 after cutover*): that entry is not built before the switch.

The rule used to draft it: where the owner **writes** something in a tab
(adds a row, ticks a box, edits a cell), losing it on the freeze loses data, so
the use gates cutover. Where the owner only **reads** what is already loaded, a
later entry can draw it after the switch. `etl/test_cutover_parity.py`
(`npm run test:etl`) checks the form of this file.

Drafted from the tabs' headers, `etl/extract.py` and HANDOFF § 4's artifacts
table; the owner answered its eighteen questions on 2026-10-29 (every
proposal taken).

**Signed off:** the owner, 2026-10-29, after reading it end to end.

## What cutover waits for

The open entries below, each built before 1.26 and named in its **Depends
on**, on top of the open Phase 1 entries it already names:

- 2.0, 2.1, 2.2, 2.2b, 2.3: the year and quarter word-count budget the
  `To-Read 20XX` tabs and the master list's pace cells hold. 2.2's
  *sittings* line needs 2.1b, which is not pulled ahead (owner, 2026-10-29):
  2.2 ships without that line and gains it when 2.1b lands, after cutover.
- 3.1, 3.2, 3.3: editing runs, placements and prerequisites, and adding a run.
- 3.4: ranking the top books of a year.
- 5.7: adding a book that is coming out, with its date.
- 5.10, and the 5.6 it depends on: recording a trade bought.

Everything else the Sheets do today is either in the app already or waits,
by the owner's choice, for an entry after the switch.

## Comics.xlsx

### `NOW`

Two runs side by side (`hickman-ff`, `simonson-thor`): a progress bar and
percent, issues left, an *Est. done* date, the next issue, the run's track
order with each run's state, and the run's issue checklist. All formulas over
`Reading Orders`; extract reads none of it.

- See the runs I'm in the middle of, with progress and issues left → 1.9
- The next issue to read in each → 1.6
- Tick the issues I read, one or a range → 1.1
- The other runs around this one in its track, with their states → won't carry: the run list shows each run's tracks today; the telescope (2.5) and the grouped run list (2.9) come after cutover
- *Est. done*: when I'll finish this run at my pace → won't carry: a nice-to-have; no entry estimates a run's finish, and none is wanted before cutover

### `RUNS`

The run catalog: title, run ID, track, writer, artists, series and issues,
issue count, years, `In Sheet`, status, tier, why, notes. Extract loads title,
tier, why and notes; tracks become `run_tracks`; the span and the credit line
are derived (`run_span`, `run_credit_line`), and status is `run_state`.

- Browse every run with its readiness and status → 1.8c, 1.9
- Add a new run, with its tracks → 3.2
- Edit a run's title, why, notes or tier → 3.1
- A run on a non-Marvel track (DC, Image) → 3.2

### `Reading Orders`

Every run's issues in order (10,754 rows): `Completed`, `Sequence`, `Type`,
`Notes`. Loaded as `issues` and `run_issues`; `Completed` is the read mark.

- Tick an issue read in this run → 1.1
- Add issues to a run, typed or from Metron → 1.3c, 1.3b
- Edit a placement's type or note → 3.1
- Put an issue at a chosen place in a run, or reorder → won't carry: appending is enough until then; Arrange (3.11, after 3.10) comes after cutover

### `PREREQS`

436 edges, `hard` or `soft`, with the prerequisite's title, status and a
`Satisfied` formula. Loaded as `prereqs`; `run_readiness` replaces
`Satisfied`.

- See whether a run's prerequisites are met → 1.9
- Add, remove or retype an edge → 3.3

### `TRACKS`

One row per track with runs read, issues read and percent read: formulas,
replaced by `track_progress`. Nothing typed here.

- Glance at each track's progress → won't carry: a read-only rollup of data that loads; the tracks page (5.2) after cutover

### `EVENTS`

29 events: year, the runs they touch, a read-it / skip verdict, home run and
note. Loaded as `events`; no page.

- Look up an event's verdict before reading it → won't carry: the verdicts load and are rarely looked up; the events page (6.8) after cutover

### `DASHBOARD`

Three lists: *Ready to Read* (ready runs with track, writer and issue count),
*Satellite* (short ready runs, ten issues or fewer, shortest first) and
*Target Run* (the runs still to read before a chosen run). Formulas;
`readyToRead()` replaced the first.

- What I can read next, ready now → 1.9
- Short runs I could finish quickly → won't carry: 1.9's *Ready, not queued* lists the ready runs; a sort by cost comes with 2.6 and 2.9, after cutover
- What stands between me and a target run → won't carry: unlock cost and *what a run opens* are 2.6, after cutover

### `Sheet26`

*Coming*: upcoming issues against the run they will join (`pkj-hulk`,
`kelly-spiderman`, …). Typed by hand; extract reads none of it.

- Note an upcoming issue for a run I follow → 1.4b

### `Run Order`

Per character (Captain America, Daredevil, Hulk, …), the runs to read in
order, as free text. Extract reads none of it.

- Keep the order I mean to read runs in → 1.10

### `To Read`

*Current* and *Next*: a short ordered list of reading projects. Extract reads
none of it.

- What I'm reading now and what comes next → 1.10

### `DC`

DC characters (Batman, Superman, …) with ticked lists of runs. Not loaded: no
DC run is in the Ledger.

- Plan DC runs, with checkboxes → won't carry: no DC run is loaded; entered by hand as runs on a DC track once 3.2 lands, if at all

### `Ultimate Order`

The Ultimate universe's reading order by collection. Not migrated (HANDOFF §
2, *confirmed out of scope*).

- Ultimate reading order → won't carry: superseded by the `ultimate-*` runs in `Reading Orders`

### `Master`

178 trades and omnibuses: `Collected`, `Read`, type, author, character, year,
title, issues, notes. Loaded as `editions` and `edition_progress`; no page.

- Record a trade I bought → 5.10
- See which trades I own and have read → 5.10

### `Ultimate Collection`

The Ultimate collections by series, with issue ranges. Not migrated.

- Ultimate collections → won't carry: superseded, like `Ultimate Order`

### `Reading Orders (old)`

The earlier side-by-side layout of the reading orders, one column pair per
run. Not migrated.

- The old reading orders → won't carry: superseded by `Reading Orders`, which loads

### `Sheet8`

Scratch notes: *Fresh Start*, *Events*, *Recents*. Not loaded.

- Jot down runs to look at later → 1.4b

## Books.xlsx

### `Coming Out`

Upcoming books with author, series and date (51 rows). Loaded as `releases`;
no page since 1.8c made `/` a redirect.

- Add a book coming out, with its date → 5.7
- See what is out now and coming soon → 5.7

### `HP Fanfiction`

Fan fiction titles to read. Not loaded: extract reads no such tab.

- Fan fiction to read → won't carry: kept out of the Ledger; the owner pastes any into Someday through 1.4 if wanted

### `Stephen King` · `Riordanverse` · `Dresden` · `Cosmere`

Author and universe completion lists: `Completed`, type, book, series,
published, a word count (King) and a `Read Plan` month (Cosmere). Loaded as
books, with `tracking` follows (1.15); `Completed` is not loaded (D-41).

- Mark a book read → 1.5
- Add a newly announced book to the list → 1.4c
- See how much of an author or universe I've read → won't carry: the views exist (1.15); the author and universe pages (5.11) come after cutover
- Plan when I'll read the next one (`Read Plan`) → 2.3
- The Dark Tower reading order column → won't carry: a reading-order shelf (5.1) after cutover

### `To-Read Master List`

1,185 books to read with genre, author, series and words, plus the budget
inputs (minutes a day, words a minute, words a day and a week) and the
current quarter. Loaded as books with `to_read` status.

- Find a book on my list, by title, author or series → 1.8c
- Add a book to the list → 1.4c
- Fix a book's word count → 1.18
- Set my reading pace (minutes a day, words a minute) → 2.0
- See what a quarter or a year can hold in words → 2.1

### `Read 2021` · `Read 2022` · `Read 2023` · `Read 2024` · `Read 2025`

One tab per year: the books read, in a column per genre, with a count row per
genre and a block naming the series and authors read. Not loaded (D-41); the
reads are entered in the app (`seed/workbook_reads.csv` lists them).

- Log a book I finished, with its date → 1.5
- See the books I read in a year → 1.9
- Count the reads per genre in a year, and which series and authors → won't carry: a yearly glance; the year in review (6.2) after cutover

### `To-Read 2026` · `To-Read 2027` · `To-Read 2028` · `To-Read 2029` · `To-Read 2030`

One tab per year: the books planned, in a column per genre, a count row, the
series and authors, and the year's word-count budget. Load only with
`--with-plan`, and nothing from 2028 on (D-13, D-70).

- Put a book in a year or a quarter → 1.7
- Budget a year and its quarters by word count → 2.1, 2.2, 2.2b, 2.3
- Move a book between years and quarters → 2.3
- Count the planned books per genre → won't carry: a glance; genre mix planned vs read is 6.2, after cutover

### `To-Read`

The old wishlist: free-text lines by genre (`First Law - Joe Abercrombie`),
with a *Top* row and an empty *Goals* column. Loaded as `wishlist` and promoted
into Someday once (1.4d, D-39).

- Ideas for books to read someday → 1.4d
- Capture a new idea quickly → 1.4b
- The *Top* pick per genre → 1.7

### `Top Books`

Ranked top ten per year, 2021–2026. Not loaded (D-41); the ranks are in
`seed/workbook_reads.csv`.

- Rank my top books of a year → 3.4

### `Series`

Series and authors with percent read, words, books read and total: the
groups load as `tracking` follows (1.15), the total fills `total_books`.

- Follow a series I've started → won't carry: the Series tab's follows load (1.15); following a new one needs 5.11's control, after cutover
- See each series' progress and next book → won't carry: the view exists (1.15); the series page (5.9) after cutover

### `Booktube Top 10`

Seven BookTube channels' top-ten lists by year. Loaded as `external_lists`;
no page.

- Recommendations from BookTube channels → won't carry: reference only; promising titles go into Someday through 1.4c

### `Download`

Books to find (Disney, Survivor, Discworld, …) and a link. Not loaded.

- Books to track down → won't carry: the owner pastes any into Someday through 1.4, or drops them
