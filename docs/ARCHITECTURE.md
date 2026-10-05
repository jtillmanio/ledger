# Ledger — architecture

Replaces `Comics.xlsx` and `Books.xlsx`. One Postgres database, one Next.js app,
two readers' worth of data model with one reader in it.

## 1. The shape of the problem

| | Comics | Books | Watch |
|---|---|---|---|
| Rows migrated | 10,138 issues in 10,761 run placements, 258 runs, 438 prereq edges, 178 editions (2026-09-23 extract) | 1,478 books, 376 authors, 214 series | none — starts empty |
| Natural model | Directed acyclic graph over runs, ordered list of issues per run | Flat catalog plus per-year status | Three-level hierarchy: franchise → title → season |
| What the sheet couldn't do | Transitive prerequisites, fast mobile check-off, per-user progress | Move a title between years without cut-and-paste | Didn't exist. Added Sept 2026 |

The watchlist was added last and deliberately reuses the comics shape one level
shallower: **franchise → title → season** is **track → run → issue** without the
dependency graph. Same derived-progress pattern, same check-off control, same
detail layout. Nothing new was invented for it.

The comics workbook was already a relational database being emulated with
`COUNTIFS` and `SUMPRODUCT(--ISNUMBER(SEARCH(...)))`. The books workbook was a
single table pivoted across ten year tabs. Both are ordinary schema problems.

## 2. Decisions

**2.1 Catalog and progress are separate tables.** `issues` holds what exists;
`issue_progress` holds what you've read, and where you read it (2.14). Every
progress table carries `user_id` and is keyed on `(user_id, entity_id)` — for
comics the entity is the placement, not the issue. You are the only row in `users` today.
Adding your wife later is an `INSERT`, not a migration — this is the single most
expensive thing to retrofit and the cheapest thing to build in up front.

**2.2 Nothing derived is stored.** Every formula column in `RUNS` — `Readiness`,
`Hard Left`, `Soft Left`, `Unlocks`, `Completed`, `% Done`, `Status`, `In Sheet` —
and the entire `TRACKS`, `DASHBOARD`, and `NOW` tabs are Postgres views in
`etl/views.sql`. At 10k issues the whole rollup runs in single-digit
milliseconds, so there is no cache to invalidate and no state to drift.

| Sheet artifact | Replacement |
|---|---|
| `RUNS!Readiness` | `run_readiness` view |
| `RUNS!% Done`, `Completed`, `Left` | `run_progress` view, over the run's own placements (2.14) |
| `Reading Orders!Completed` | `issue_progress`, one row per read placement — per run, as the sheet had it |
| `RUNS!Series (and Issues)`, `Start Year`, `End Year` | `run_span` view — series text from issue labels, years from `issues.cover_date`. The typed columns had drifted from the reading orders in 212 of 259 runs |
| `RUNS!Writer`, `Artists` | `run_credit_line` view over `issue_credits` (2.11). 157 of 259 runs had no artist typed |
| `TRACKS` tab | `track_progress` view (distinct issues via `track_issue_counts`) |
| `DASHBOARD` ready-to-read query | `readyToRead()` in `src/db/queries.ts` |
| `CLOSURE` tab + Apps Script (removed July 2026) | `run_ancestors(run_id)` — a recursive CTE, cycle-safe, 48-level depth cap |
| `Read 20XX` tabs | `books_by_year` view over `book_status.finished_year` |
| `To-Read 20XX` tabs | `reading_plan.planned_year` |
| `Series!Percent Read` | `series_progress` view |
| `Reading Orders!Track`, `Run Title` | dropped — they were lookups; the join replaces them |

**2.3 The transitive closure you abandoned is now free.** `run_ancestors()`
walks the prereq graph to any depth, collapsing a chain to `hard` only when
every link in it is hard. The run detail page uses it directly, so "read these
first" shows the real chain rather than the one-hop neighbours.

**2.4 Tracks are a join table, not a comma-delimited string.** `RUNS!Track`
held `"Avengers, Spider-Man"` and the sheet searched it with string matching.
`run_tracks` makes it a proper many-to-many, which is why track filtering is an
index lookup instead of a scan over 258 concatenated strings.

**2.5 Run IDs stay exactly as you wrote them.** `hickman-ff`, `claremont-xmen`,
`pad-hulk` become the primary keys. Your `PREREQS` tab allows forward-declared
IDs that don't exist in `RUNS` yet; the ETL materializes those as rows with
`placeholder = true` rather than dropping the edge, and they're hidden from the
run list until you fill them in.

**2.5b Three media types, one set of patterns.** Comics, books, and film/TV each
get a catalog table, a per-user status table, and an append-only event log
(`read_events`, `watch_events`). Progress that can be computed is computed:
`run_progress` over issues, `show_progress` over seasons, `franchise_progress`
over both films and shows. A show's state is never written to `title_status` —
it is a view over `season_status`, for exactly the reason run completion is a
view over `issue_progress`. The one exception is **dropped**: abandoning a show
is a decision, not a consequence of seasons, so a `title_status` row with
`kind = 'tv'` and `status = 'dropped'` is allowed and `show_progress` reads it
first. `show_progress.state` is therefore
`unknown | to_watch | watching | watched | dropped`, and no other show-level
status is ever written.

**2.5c Seasons are tracked; episodes are not.** A show has 2–10 seasons. Episode
tracking would add roughly two orders of magnitude of rows to buy granularity
nobody asked for, and the comics side already demonstrates what 10,000-odd
check-offs feels like. `watch_events` takes either a `title_id` or a
`season_id`, so episode support is an additive change if that judgment turns out
wrong.

**2.5d Franchises and shelves are different things.** A franchise is a fact
about the work — Andor is Star Wars regardless of opinion — and is partly
machine-derived: TMDB films carry `belongs_to_collection`, which seeds
`franchises` automatically. A shelf is the user's own grouping. They stay
separate tables because merging them would make an imported fact and a personal
judgment indistinguishable. `franchises.parent_id` allows exactly one level of
nesting; deeper is a tree nobody needs.

**2.5e Shelves are typed, not polymorphic.** `shelves.kind` is `books` or
`titles`, with `shelf_books` and `shelf_titles` each carrying a real foreign
key. An earlier draft used one table with nullable `book_id`/`run_id` columns and
a `num_nonnulls` check; that was removed because a polymorphic foreign key
cannot be enforced by the database.

**2.6 Editions are separate from issues.** The `Master` tab tracks what you own
in print — 178 trades and omnibuses with `Collected` and `Read` flags that don't
line up with issue-level progress. Modeling `edition_issues` as a join is left
for later; the text field is preserved verbatim so nothing is lost.

**2.7 Books that aren't clean records stay as text.** The old `To-Read` tab mixes
titles, series-plus-author strings, and `Top` markers. 497 of those land in
`wishlist` with `raw_entry` intact and a nullable `book_id`, so nothing is lost
before they are cleaned. They are promoted once, through 1.4's paste-a-list
review (task 1.4d, D-39), after the final load: each line becomes a Someday book
(2.9) or is dismissed, and the table goes once it is empty.
The 534 BookTube entries live in `external_lists` the same way.

**2.8 Blocks are a table, not a number.** A track is divided into numbered
blocks, and `runs.sequence` is a run's position inside one. The numbering is
scoped per track — `avengers` block 1 and `x-men` block 1 are different blocks —
so a bare `runs.block` integer could not say which block a run was in. `blocks`
carries `(track_id, number)` with a nullable `name`, and `runs.block_id` is a
nullable FK to it. Nine runs have no block and load as NULL. The ordinals the
dashboard needs ("run 3 of 5 in block 2 of 7") are computed in the
`block_position` view rather than stored.

**2.9 A plan entry has one period column, and the year is a substring of it.**
`reading_plan` originally carried `planned_year` and `planned_quarter` side by
side (and a `planned_month` was drafted), which allows a row to claim 2027 and
Q1 2028 at the same time. It also has no way to say "this is a 2027 book and I have not
decided when" without that being indistinguishable from a data-entry gap — and
the workbook's To-Read tabs held 100-odd rows in exactly that state (the plan itself now starts empty and is built in the app, R0-04). One column solves both:

```
reading_plan.period text NOT NULL
  CHECK (period ~ '^[0-9]{4}(-Q[1-4])?$' OR period = 'on_deck')
```

`2027-Q1` is a quartered book, `2027` a book committed to the year with no
quarter yet, and `on_deck` a book with no year that is next in line. The year
is `left(period, 4)`, so a year is literally what its quarters roll up to;
nothing can disagree with itself. The `plan_period` view exposes `year`,
`quarter` and `level` so no caller parses the string. **There are no months**
(D-38): a quarter is the finest grain the plan has, so there is no month period,
month rail or monthly capacity, and `reading_settings.plan_granularity` goes.
Migration is mechanical: compose the two columns into one (task 1.7).

The dashboard depends on this. The plan rail draws four quarter columns plus a
fifth lane for `period = year`, and the whole point of the fifth lane is that
those books are visibly in the year and visibly not in the plan.

**A to-read book sits at one of four levels** (D-37, task 1.7):

| Level | Stored as | Ordered | Counts against capacity |
|---|---|---|---|
| Quarter | `period = '2027-Q1'` | yes | that quarter, and its year |
| Year | `period = '2027'` | no | that year |
| On deck | `period = 'on_deck'` | no | nothing |
| Someday | no plan row | no | nothing |

The first three are plan rows. Someday is derived — every `to_read` book with no
plan row — so it never needs writing and cannot disagree with the plan; the
`to_read_level` view names each book's level. A book enters at any level from
the add sheet (2.15) and moves between levels through one picker (task 2.3);
leaving the plan means moving to Someday.

**Only quarters are ordered.** A quarter says *when*; with eight books in it,
*which first* is the question you actually ask. So a quarter carries the comics
queue's shape (2.16):

```
reading_plan.ordinal int   -- NULL exactly when the period is not a quarter
  UNIQUE (user_id, period, ordinal) DEFERRABLE INITIALLY DEFERRED
```

Ordinals are contiguous from 1 within each quarter, and a year reads as its four
quarters in order. Like the queue's order, it is authored, so it is stored: a
book joins the end of the quarter it is placed in, leaving closes the gap, and a
reorder rewrites the quarter in one transaction. The rail stacks a quarter's
blocks in this order from the foot of the column, so the books that cross the
capacity rule are always the ones you ranked last, and the dashboard's *first
Q-current book* is ordinal 1, not an accident of insertion. The year lane and
On deck are unordered on purpose: they hold books you have not decided about
yet, and ranking them would be the decision those levels exist to put off. The
queue stays period-free (2.16); the plan gains an order but keeps its periods.

**2.10 An era is to a run what a block is to a track.** `design/mockups.html`
sections the reading spine into named eras — "Second Genesis & Phoenix 38/38",
"Days of Future Past 4/22" — each with its own count and bar. Nothing in the
data model backs that: the workbook has no era column and `etl/extract.py` never
mentions one, so the era bands are currently a drawing.

They get the same shape as blocks, for the same reason 2.8 gives. `eras`
carries `(run_id, ordinal, name)` and `run_issues.era_id` is a nullable FK —
on the placement, not the issue, because an era is a stretch of one run's
reading order and the same issue can sit in a different era of another run.
`era_progress` mirrors `block_progress` so the run detail can treat them
interchangeably. The alternative — a bare `era` text column — cannot
order eras, cannot rename one without touching every issue in it, and gives no
place to hang a per-era note later.

Two deliberate asymmetries with blocks. A block is numbered with an optional
name, because a block is a *position* in a track and the number is the fact; an
era is named, because an era is a *story* and the name is the fact. And eras
are optional in a way blocks are not: all 258 runs have blocks, far fewer will
ever be worth sectioning. A run with no eras renders a flat spine, which is
what every run does today.

Eras come from nowhere at migration time. They are typed by hand on the run
detail, and task 7.3 — which already reviews a run's reading order against
Metron — is the natural place to propose them.

**2.11 One issue row per comic; runs place issues.** The workbook listed an
issue once per run that read it: 10,835 rows for 10,285 distinct labels, with
426 raw labels in two to four runs (the Fear Itself core issues sit in four).
Stored that way, a crossover counted three times in its track and credits would
have been copied onto every copy. So `issues` is the comic — label (unique),
cover date, story title, cover URL, Metron id — and `run_issues(id, run_id,
sequence, issue_id, type, notes)` is where it sits in a run. `type` and `notes`
stay on the placement because 213 labels are core in one run and optional in
another.

`issue_credits` keys on `issues.id`. Read state does **not** — it keys on the
placement (2.14). Track, block and catalog totals count distinct issues
(`track_issue_counts`, `block_issue_counts`, `catalogTotals()`), never a sum of
run totals. A run holds an issue at most once — `run_issues` is UNIQUE on
`(run_id, issue_id)` — so a run's placement count *is* its distinct-issue count
(D-12, D-19). A label repeated inside one run is dropped by extract and reported
(`repeat placement dropped`); a planned reread is a note on the placement.

*Revised Sept 2026.* This section originally also argued that reading
`Fear Itself #4` in one run should mark it read in the other three. That was
reversed by 2.14: read state is per run.

The issue id is a slug of its label (`fantastic-four-1961-570`), not the old
`run#sequence`. Inserting an issue into a reading order no longer renumbers
every later id, which removes the one-way-door problem from the pre-build review.

**2.12 Credits are rows, and a run's credit line is derived.** `creators(id,
name, metron_id)` and `issue_credits(issue_id, creator_id, role, source)`, with
Metron's many role names collapsed to six: writer, artist, inker, colorist,
letterer, cover. A `text[]` of names on `issues` — the earlier plan — could not
say who drew versus who wrote, could not filter the catalog by creator, and
could not merge "J. Hickman" with "Jonathan Hickman". The creator id is a slug
of the name, so a hand-entered credit and Metron's land on the same row.

`runs.writer` and `runs.artists` are gone. The `run_credit_line` view lists the
writers and artists on at least a quarter of a run's credited issues, most
issues first, three at most. There is deliberately no hand-typed fallback: a
wrong credit line is fixed by fixing the issues' credits, so the run and its
issues can never disagree. The workbook's typed values survive only in
`seed/workbook_run_fields.csv`, and extract flags each run whose typed writer
isn't among its credits.

**2.13 Enrichment writes sidecar CSVs keyed by label, and labels change only by
accept.** Until cutover the workbook is the truth and the database is rebuilt
from it, so Metron's output can't live only in the database — it would be lost
on every rebuild. It lives in files beside `volume_map.csv`: `cover_dates.csv`,
`issue_details.csv`, `issue_credits.csv` and `label_review.csv`. They are keyed
by label because the label is what the workbook and Metron share; ids are
derived from labels at extract time.

Every value carries its source, `metron` or `hand`, and the scripts never
replace a `hand` value. For credits the unit of ownership is `(label, role)`:
one hand writer row means the writers for that issue are yours.

Enrich compares every matched label with Metron's canonical label and proposes
the difference in `label_review.csv`, by category (`year_added`,
`oneshot_number`, `name_style`, `subtitle`, `wrong_volume`). Extract applies a
rename only on an explicit `accept`, the same rule as AI-proposed labels. When a
rename is accepted, the next enrich run moves every sidecar row from the old
label to the new one, hand rows included, so accepting a fix never orphans a
date you typed. Nothing writes back to the workbook.

**2.14 Read state belongs to the placement, not the issue.** *Sept 2026,
reverses part of 2.11.* Reading `Fear Itself #4` as part of the event does not
mean you have read it as part of Journey into Mystery's run. You read it in a
place in an order, and the next time it turns up in a different run you may
want to reread it there or skip it. That is your decision to make on that run.
Marking it read everywhere at once took the decision away. So a checkmark
belongs to a placement:

```
run_issues.id   serial PRIMARY KEY          -- the placement; stable when the order changes
                UNIQUE (run_id, sequence) DEFERRABLE INITIALLY DEFERRED   -- was the primary key
                UNIQUE (run_id, issue_id)   -- one placement per run (D-19)
issue_progress(user_id, placement_id → run_issues.id ON DELETE CASCADE,
               completed_at, completed_at_precision)  PRIMARY KEY (user_id, placement_id)
```

Landed in migration `0007_placement_progress` (task 0.8a). The sequence
constraint is deferred so one `UPDATE … SET sequence = sequence + 1` can shift a
run past an insert (R0-15); the precision pair is 2.17's, unchanged.

The key is a surrogate, not `(run_id, sequence)`, because inserting an issue
into a reading order renumbers every later sequence. `(run_id, issue_id)` is
UNIQUE as well (migration `0004`, D-12): this section once argued it could not
be, because labels repeated inside a run and a planned reread seemed legitimate.
The repeats turned out to be a block entered twice, and the owner decided a
reread inside a run is a note, not a second row (D-19). The surrogate stays the
key because it is what `issue_progress` points at.

What changes downstream:

- **`run_progress` and readiness count the run's own placements.** A
  prerequisite run is finished when *its* placements are read. Reading the same
  issues inside some other run does not finish it.
- **Block, track and catalog rollups still count distinct issues.** An issue
  counts as read in a scope when any of its placements inside that scope is
  read. So a crossover sitting in two runs of the X-Men track counts once, and
  counts as read once either run has it checked. Never SUM run totals.
- **"You've read this before" is derived.** The `issue_read_runs` view returns,
  per user and issue, the runs in which a placement of it is read, plus the
  earliest `completed_at`. The spine uses it to badge a row as *read in Hickman
  — FF*, whether that row is read in this run or not. The issue detail lists
  every run that places the issue and its read state in each. The view is a
  hint. It never checks a box.
- **Nothing propagates.** Marking a placement read writes one row. Range marks,
  undo and the thumb bar act on placements in the current run only.
- **`read_events` carries `placement_id` for comics** (task 1.5). Reading the
  same comic in a second run is a first read *of that placement*. `reread_of`
  links repeat reads of one placement. Stats that count comics read count
  `DISTINCT issue_id`.
- **The workbook already worked this way.** `Completed` is a column on each
  `Reading Orders` row, so extract loads each row's own value. Only 1 of the 76
  completed rows sits on a shared label, and the "completed in one run, not
  another" flag is removed because that case is no longer an inconsistency.

Credits, cover dates, story titles and labels stay on `issues`. They are facts
about the comic. Only the reading is about the placement.

**2.15 Adding starts from a search or a line of text, and always ends in a
real row.** *Sept 2026.* Every add flow offers the same two paths: search an
API, or type it yourself. Both write a real catalog row before they write
anything that points at it:

| Adding | Search path | Freeform path | Then writes |
|---|---|---|---|
| An issue to a run | Your catalog first, then Metron live: series + number, cover and cover date on the result | A label, or many, through the bulk-entry parser (task 1.3) | `issues` (new label) or reuse of the existing row, then a `run_issues` placement |
| A book to a to-read level (a quarter or year, On deck, Someday) or a shelf | Your library first, then Open Library live | Title and author required, series, position, pages and words optional | `books` (plus `authors` / `book_series` if new), then `shelf_books`, `book_status` or `reading_plan` |
| A film or show | TMDB live (unchanged, 2.5b) | — none (D-28): when TMDB fails or finds nothing, *Save to inbox* keeps the query as a Watch capture note | `titles` / `seasons`, then status |

An existing row is always reused. A search result that is already in your
catalog shows up as your row ("in 3 runs", "on 2 shelves"), not as a second
copy. A Metron result writes `metron_id`, `cover_date` and `cover_url` with
source `metron`, and its label is normalised to the bulk-entry grammar before
insert. A freeform issue or book is written with nothing but what you typed.
Backfill (task 4.1 for issues, 4.2 for books) fills in the rest later, and
never overwrites what you typed.

This narrows a rule rather than dropping it. **Metron and Open Library are now
called live, but only from an add flow, which is an action you started**, and
never to render a page. A search runs when you submit it, not on every
keystroke. At 20 requests a minute, Metron is plenty for one person adding
issues. Responses are cached like the backfill's. Hardcover stays backfill-only.
The AI rule is unaffected: tapping *Add* on a Metron result is an explicit
accept of a label Metron says exists, and a freeform line is your own label,
not a model's.

**2.16 Comics get an Up next queue: one ordered list, no dates.** *Sept 2026.*
Books have a plan with periods because word counts make time budgeting
meaningful. Comics need something looser: runs you want to read next, in the
order you want to read them. You can add to it, reorder it and remove from it.
It has no years, quarters or capacity.

```
run_queue(user_id → users, run_id → runs, ordinal int NOT NULL,
          added_at timestamptz NOT NULL DEFAULT now())
  PRIMARY KEY (user_id, run_id)
  UNIQUE (user_id, ordinal) DEFERRABLE INITIALLY DEFERRED
```

- **The order is authored, so it is stored.** Like a why, the order is your
  judgement and nothing derives it. `ordinal` is contiguous from 1. A reorder
  or removal rewrites the ordinals in one transaction, which is why the unique
  constraint is deferrable. At a list of dozens, renumbering is cheaper than
  fractional keys.
- **Membership is stored; state is derived.** A queued run keeps its row
  when you start it. *Up next* shows only queued runs with nothing read, so a
  started run moves to *In flight* and a finished run to *Done*, both through
  `run_progress`. Nothing removes a row automatically. Unmarking a run back to
  zero puts it back in its old place. The row goes only when you remove it.
- **Anything real can be queued, blocked runs included.** A blocked run shows
  its amber *N runs first* badge, because wanting to read it next is legitimate
  and the badge says what that costs. Placeholder and soft-deleted runs can't
  be queued.
- **It is not a shelf.** Shelves hold books or titles, never runs (2.5e). A
  shelf is a named grouping you can have many of; the queue is one ordered list
  per user.
- **Removing is a hard delete of the queue row**, with an undo toast (task
  1.2). Soft delete protects the catalog; a queue row is a note to yourself.

`run_queue_state` joins the queue to `run_progress` and `run_readiness` so
the dashboard and the status screen read one ordered row set with state and
badges, and nothing is computed in the app.

**Table count:** 28 today (task 0.3 added five), 40 once task 1.10 and Phase 8 land.


**2.17 A date is stored with its precision.** *Sept 2026, D-R3-1 (closes
R1-04, R3-03, R2-10).* The range sheet draws *No date*, 1.5 promises
"approximate", and the workbook's 76 reads and ~1,290 book years carry no day at
all. Storing `now()` for those would date reading history to the day of a
backfill, permanently and undetectably. So one rule, applied to three tables:

```
issue_progress.completed_at        timestamptz NULL, completed_at_precision  text NOT NULL DEFAULT 'exact'
book_status.finished_on            date        NULL, finished_on_precision   text NOT NULL DEFAULT 'none'
read_events.finished_on            date        NULL, finished_on_precision   text NOT NULL DEFAULT 'exact'   (1.5)
  precision IN ('exact','approximate','none')  and  (date IS NULL) = (precision = 'none')
```

- `none` is a read with no known date: it counts as read, is excluded from
  pace maths, and sorts **last** wherever finish dates are ordered (`NULLS
  LAST`; Postgres puts NULLs first in a `DESC` sort). `approximate` is a real date the owner has said is a guess (a
  *Spread* range, a book known only by its year, stored as that year's July 1).
  `exact` is a date entered or recorded as it happened.
- The pairing CHECK is the point: a date and its precision cannot disagree, and
  there is no state where a NULL date reads as exact.
- The ETL writes `none` and a blank date for every workbook read, and never lets
  a column default stamp the load time. Anything that computes pace or "read ·
  Sep 2026" filters `precision <> 'none'` or reads a NULL as unknown.
- Landed in migration 0004 for `issue_progress` and `book_status`; 1.5 adds it to
  `read_events`.
- A book's finish **year** is not a second column. 1.5 drops
  `book_status.finished_year` and every reader derives the year from
  `finished_on` (D-21), so a year and a date can never disagree.

## 3. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Runtime | Next.js 16 App Router, React 19 | Server components render the 641-issue Krakoa run without shipping it to the client twice |
| Database | Postgres 18 (Neon free tier) | Recursive CTEs, `FILTER`, array aggregation — all three are load-bearing here |
| Driver | `postgres.js` with `prepare: false` | Required for Neon's transaction-mode pooler |
| Schema | Drizzle, migrations in git | `drizzle-kit generate` produces reviewable SQL |
| Auth | HMAC-signed cookie, one shared passcode | 40 lines. `currentUserId()` is the only seam the rest of the app knows about |
| Styling | Plain CSS with custom properties | No build step, no utility-class churn, dark mode via `prefers-color-scheme`. The token values come from `design/tokens.css` (D-31, from task 1.8a); Tailwind appears in the design files only as a naming reference (`docs/DESIGN.md` §4), never as a dependency |

## 4. Interface

**One dashboard per medium, not one dashboard for everything.** The first cut
had a single `/` that stacked a books pace card above a comics hero — two
questions in one screen, neither answered well. The three media are at
genuinely different stages (0.67% of the comic catalog read against five years
of book history) and they deserve different answers.

| Route | What it is |
|---|---|
| `/` | Redirect to whichever medium you last touched |
| `/comics` | Comics dashboard — the telescope, in-flight runs, ready runs, the frontier |
| `/comics/runs` | The run list, grouped track → block |
| `/comics/tracks` | The tracks index: every track with completion counted in distinct issues, and a *never opened* group; each row links to the run list filtered by track |
| `/comics/status` | In flight · Up next · Done, for runs |
| `/comics/[runId]` | The reading spine. One marker per placement, 3rem rows, optimistic `POST` to `/api/progress/issue` |
| `/comics/[runId]/add` | Add issues: search Metron, or type/paste labels, with an insertion preview |
| `/comics/[runId]/[issueId]` | The issue sheet: every run that places the issue, with a read toggle per placement (intercepted route) |
| `/comics/[runId]/path` | *Why blocked?*: the cheapest ordered chain of prerequisite runs (intercepted route) |
| `/comics/releases` | New issues in the series you follow, each offered for adding to its run (task 5.8, D-35) |
| `/books` | Books dashboard — reading now, the plan rail, capacity, the year so far |
| `/books/status` | In flight · Up next · Done, for books |
| `/books/list` | Master list: search, filter by status, to-read level, year or genre, series completion |
| `/books/add` | Add books: search Open Library, paste a list, or by hand, with a destination (a quarter or year, On deck, Someday, or a shelf) |
| `/books/plan` | Plan by quarter, full editor |
| `/books/releases` | Books coming out that you want, *Out now* then by month (task 5.7, D-35) |
| `/settings` | Minutes a day, words a minute — the inputs the capacity engine reads (task 2.0) |
| `/watch` | Films and shows, mid-show progress computed from seasons |
| `/watch/status` | In flight · Up next · Done, for films and shows |
| `/watch/list` | Films and shows in one list, with mid-show progress computed from seasons |
| `/watch/franchise/[id]` | Franchises |
| `/inbox` | Quick-capture inbox: book, comic, watch or unsure notes to resolve |
| `/session` | Reading sessions: after-the-fact minutes entry, attach to a book or run; feeds Settings → *Measured from sessions* (the timer is 6.12, D-8) |

**Every medium has the same three-tab status screen.** The dashboard answers
"what now". The status screen answers "show me all of it": everything in
flight, everything planned or next up, everything finished. The tabs are the
same in the same order on all three media, and so are their names, *In flight ·
Up next · Done*, each with a count. The tab is in the URL (`?tab=next`), so the
back button and a refresh keep it.

| Tab | Comics | Books | Film & TV |
|---|---|---|---|
| In flight | Runs with at least one placement read and not all read, most recently touched first, each with its resume pointer | `book_status = reading` | Shows whose `show_progress.state` is `watching`, films with `title_status = watching` |
| Up next | **Your queue** (2.16), in your order, unstarted runs only, with drag handles. Below it, *Ready, not queued*: `ready_all` then `ready_hard` runs in track → block order, each with **+ Up next** | The plan by level (2.9): each quarter in your order, with drag handles; then that year's bare-year entries; then On deck. Someday is a link to the master list, not a list here | `to_watch` films and shows, oldest added first, with the dashboard's film/TV and genre filters |
| Done | Finished runs, most recent last read first | `read`, grouped by year finished | `watched` films and shows, with show state derived |

Stopped work — DNF books, dropped titles — sits in a collapsed *Stopped* group
at the foot of Done. It is finished, just not the way you meant it to be.
Two *Up next* tabs are backed by an authored order: comics by the queue (2.16),
books by each quarter's order (2.9). Watch has to-watch; comics follow
the queue with what's reachable but not yet queued. Every tab reads from views
(`run_queue_state`, `run_progress`, `run_readiness`, `plan_period`,
`show_progress`). The queue's order and each quarter's order are the only stored
things on this screen.

The dashboards link in: *Also in flight → All*, *Up next → All*, *Unlocked
and waiting → All N* (computed, D-7), and the books and watch equivalents go to the matching
tab. **The comics dashboard shows the head of the queue** — the first five,
with a *Start* button on the first — between *Also in flight* and *Unlocked
and waiting*. That makes it the comics answer to the books plan rail and the
watch up-next rows. Every *Unlocked and waiting* row gets **+ Up next** as its
control.

**Adding is one pattern everywhere** (2.15): a segmented control at the top of
every add surface, opening on Search, with the freeform path beside it —
*Type it* for issues, *Paste a list · By hand* for books. Watch opens on
Search alone, with *Save to inbox* as its fallback (D-28). Your own catalog is
matched before any API is called.

**Every dashboard has the same five slots in the same order:** what you are in
the middle of; what is next, with a control on it; where that sits; the
situation; a compact rollup. Then the thumb bar. What differs between media is
what fills a slot, never the order — which is what makes the film and TV
dashboard a fill-in-the-blanks exercise rather than a design project.

| Slot | Comics | Books | Film & TV |
|---|---|---|---|
| Now | Run, issue position | Book, page position | Series, season position |
| Next, with a period control | Your Up next queue (2.16), with + Up next on ready runs | Quarter chip | Five up next, filtered by film/TV and genre — see below |
| Position | Issue → run → block → track | Quarters across the year | Season → series → franchise |
| Situation | The frontier: what is reachable | Pace against capacity | What is reachable — seasons ready, shows unstarted, films waiting |
| Rollup | Catalog provenance | The year so far | The year so far |

**The telescope** is the comics "now" slot: three horizontal rails stacked top
to bottom — the track's blocks, the block's runs, the run's issues — with
brackets carrying the eye from coarse to fine, so all three nested positions
read at once as geometry rather than as three percentages. It needs no new
tables and no new views: `block_position` already returns "run 2 of 5 in block
1 of 7", `block_progress` gives per-block issue and read counts, and
`run_progress` gives the run's own. Two ordered queries over views that exist.

**The rails are horizontal at every width, phone portrait included** (D-31,
SG-D1; the first drafts drew them vertical). Four reasons, in order of weight:

1. **Gesture.** Each rail is a `role="slider"`. On a phone a vertical drag is
   page scroll, so a vertical rail either steals scrolling or never scrubs; a
   horizontal drag competes with nothing.
2. **Height.** The vertical drawing took about 354px of an 806px phone
   viewport. Three horizontal rails with their ticks take 124px on the phone
   and 140px on desktop, which puts *Also in flight* and *Up next* above the fold.
3. **Width is enough at 360px.** The run rail is 250px wide in a 360px frame
   (282 at 390, 832 at 1000): room for the X-Men track's seven blocks (110px
   minimum) and a five-run block (82px). Overflow starts at 16 cells on a 360px
   phone.
4. **Thumb reach.** The rails sit in the upper middle of the card and scrub
   with a sideways thumb swipe; the mark verb stays in the bottom thumb bar.

**Telescope geometry is a pure function.** The layout lives in
`src/components/telescope/layout.ts` and is the same on every rail, so the
mockups are held to the same numbers the code will be. The rule did not change
when the rails turned; its axis did — `H` became `W`:

```ts
allocate(counts: number[], W: number, gap = 2, min = 14): Item[]
  avail = W - gap * (n - 1)
  if n * min > avail: return overflow(counts, head, W, gap, min)
  rest = avail - n * min
  return counts.map(c => ({ x, w: min + (c / total) * rest,
                            floored: (c / total) * avail < min }))
```

- `W` is the rail's width: the frame minus page gutters, card padding and a
  fixed rail-key gutter (`--tele-gutter`, 44px phone / 72px desktop) that holds
  the *TRACK · BLOCK · RUN* keys, so no label can collide with a bracket.
- `min` is **14px on the phone and 16px on desktop** (`--tele-min`). Widths are
  `min` plus a proportional share of what is left, so a 6-issue run beside a
  381-issue run is a legible cell, and no rail gives a run more than its share
  of `rest`. On a 282px rail that pair is 17.9px and 262.1px.
- **A floored cell says so.** When a cell's proportional share is under `min`
  it is drawn wider than its data; it keeps its full edge and fill (so it never
  reads as a stub) and carries a centred 4px dot, and the legend reads *• shown
  at minimum width* (SG-D10). That is the data-honesty rule applied to a floor.
- `overflow()` applies when `n · min > avail`. It keeps the **head cell and two
  neighbours either side** at `min` or wider — the window shifts at an edge so
  five are always kept — and folds the rest into at most two dashed stubs, one
  before and one after, each `min` wide. A stub's run or block count and summed
  issue count go in its accessible name, the ladder and its popover
  (*+25 runs · 687 issues — open list*), not inline: they cannot fit in 14px at
  11px text (SG-D9). Widths plus gaps always sum to W within 0.5px.
- **Ticks:** `tick = niceStep(total / floor(W / 6))` from
  {1, 2, 5, 10, 20, 50, 100}, a major tick every fifth. The legend prints the
  computed value, never a constant: 381 issues tick every 10 on a phone and
  every 5 on desktop.
- **Read segments.** The `run_read_segments` view returns run-length segments
  (`is_read`, `from_ordinal`, `to_ordinal`), computed from `issue_progress` and
  nothing stored, and a second set from `issue_read_runs` for placements read
  elsewhere. The first draws green, the second grey with a dashed outline. A
  single fill from the top would misreport a range mark, a skipped optional, or
  an issue read in another run.
- **Head label** is `ordinal / total · label` — `42 / 381 · #141` — on the rail
  and in the ladder, because the two rails otherwise speak different units.
- **Text and colour live outside the viewBox.** Labels are 11px minimum HTML or
  CSS-px classes; fills and strokes are classes (`.tele .cell`), not `var()`
  presentation attributes. The ladder is the text alternative (`role="list"`);
  the `<svg>` has a `<desc>`.
- **Cells are links.** Each is `<a href>` with a `<title>` and the shared
  `--focus-ring`; each rail is also a `role="slider"` (`aria-valuemin/max/now`)
  that scrubs by drag or arrow keys and navigates to `/comics/[runId]#p-[ordinal]`
  on release. While scrubbing, a dashed ghost head and a live `n / N · label`
  readout move; the real head moves only on a mark.
- **The head is the one glow.** The head cell carries a `--brand` ring plus
  `--halo`, and nothing else in the app glows: a halo means *you are here*.
- **Inline labels are fitted, never squeezed.** The longest candidate that fits
  wins (`1 · Foundations` → `1`); if none fits the cell has no text, and its name
  lives in the ladder, `<title>`, `aria-label` and popover. A partly read cell's
  label starts after its fill, so text never straddles green and grey.

**Rail count and fallbacks.** The telescope draws as many rails as the run has
levels, and a missing level is a shorter telescope, never a broken one. The
rule for every variant (drawn in `design/Telescope Spec.dc.html`):

| Variant | When | Rails | What changes | What does not |
|---|---|---|---|---|
| **3-rail** (A1.1) | The run has a block | TRACK → BLOCK → RUN, two brackets | — (the reference) | — |
| **2-rail** (A2.1, `data-rails="2"`) | `block_id IS NULL`; and always on `/watch` (franchise → series → seasons) | TRACK → RUN, one bracket | The BLOCK rail and its bracket are removed. The track rail's last cell is an italic *no block* group holding the block-less runs, and it is the head cell. The ladder drops its BLOCK row entirely (no empty row); TRACK's meta reads *no block · N runs* | Bracket depth, cell height, gap, radius, tick rule, type and the run rail are identical to 3-rail, so it reads as shorter, not broken |
| **Unnamed block** (A1.2) | `blocks.name IS NULL` | 3 | The block's cell label is `block 3`; the ladder reads *block 3 · unnamed* with a 24px **Name it** | Not an error and not amber: a block is a position and may be unnamed |
| **Overflow** (A1.3) | `n · min > avail` on any rail | 3 or 2 | Head ± 2 kept, the rest in at most two stubs; the ladder's BLOCK row reads *run 28 of 60* | Stub width is `min`; the head is never folded |
| **Dense** (A1.4) | A long run (Krakoa, 641) | 3 | Ticks are recomputed (every 20 on a phone, 5 on desktop); the head pill uses the full label (`118 / 641 · X-Men (2019) #8`) | Floored neighbours carry their dot |
| **Empty** (A2.2, `data-state="empty"`) | No run in flight | Track rail only | No head, brackets, run rail or legend. The ladder shows TRACK (`read / total` for the track's own blocks, D-29) and NEXT. One primary: *Start the top of Up next*, or *Pick from N ready runs* when the queue is empty too (M-11) | The track rail keeps its geometry |
| **Fully read** (A2.3) | Every placement read here | 3 or 2 | The run rail is solid `--ready` with no head marker; the badge is grey `✓ read · date`; the action is secondary (*Next in block · …*) | — |

Eras do not change the telescope: they section the spine, not the rails
(2.10). The dense frame's ladder may gain an ERA row
(*DoFP · 4 / 22*) when the run has eras.

**Spine v2 (Oct 2026) stores nothing new yet.** The rows gain an ordinal
gutter, *Hide read*, real covers and a desktop release-date column, and the
hero gains a next-issue strip (STYLE_GUIDE §5.1 and §9). The gutter shows
`run_read_segments`' ordinal, computed, never stored. Covers read
`issues.cover_url` and the date column reads `issues.cover_date`, both already
loaded from the sidecars (2.13). Three proposals would change the model, and
each waits for the owner:

- `issues.store_date`, for the issue sheet's publication date (TASKS 3.5);
- a per-user, per-run preference for *Hide read* and *Show release dates*,
  which is never a column on `runs` (2.1; TASKS 3.6b, 3.6c);
- where *Show covers* is kept (TASKS 4.3).

**Prerequisite state blocks.** The `run_state` view (`etl/views.sql`) combines
`run_readiness` and `run_progress` into five states
(DIAGRAMS §4; progress wins, so a started run is `reading` even if a hard
prerequisite is unread), and every surface that shows a run renders all five through one
`<RunStateBadge>` so a phone and a desktop frame cannot disagree:

| State | Meaning | Badge | Colour |
|---|---|---|---|
| `blocked` | a hard prerequisite is below 100% | `⊘ N runs first` | `--blocked` amber, the only amber readiness badge |
| `ready_hard` | hard met, a soft prerequisite unread | `○ ready · N soft unread` | `--ready` outline on `--surface` |
| `ready_all` | nothing in front of it | `● ready` | `--ready` fill |
| `reading` | one placement read, not all | `◐ n / N` — prerequisite badges are suppressed | `--reading` |
| `read` | all placements read | `✓ read · date` | grey |

Each carries a glyph plus text and an `aria-label` with the full sentence. The
run list's switch is scoped to `blocked` only (*Show N hard-blocked*; N is around
180 on the current graph, not 27 — R1-02, and it defaults to shown until 2.11), and the
*Why blocked?* sheet is opened from the amber badge.

**Film and TV has no period control, and that is deliberate.** Books put a
quarter chip on the next-up row because there is a plan to put a book into.
There is no watch plan, no runtime budget and no watch period model, so the slot
is filled by filters instead — film or TV, then genre. Choosing what to watch is
a mood question, not a scheduling one. A films-per-year target was considered
and cut: it would need three new pieces of machinery to answer a question nobody
asked. `/watch` also nests only two levels, so the telescope drops a rail —
season in series, series in franchise — and keeps the bracket.

**The plan rail** is the books "next" slot: a quarter is a column, a book is a
block sized by its word count, and a dashed rule across all four columns is
capacity. Anything above the rule is hatched. A fifth lane behind a dashed
border holds entries with a year and no quarter. Moving a book is a tap on its
block, which opens the same picker sheet the plan page uses.

Block heights stay proportional to words, but every block is a `<button>` with an
accessible name (*Piranesi, 65k words, estimated, Q1 2027*) and a hit area of at
least 24×24px (`::after` inset), because a 7px block is otherwise untappable and
`title` does not exist on Android. Adjacent sub-24px blocks merge into a
`+N · Nk` stack button that opens a list sheet. `data-wc="estimated"` blocks get
a dotted top edge and a `~` prefix. There is no month variant (D-38). Capacity and the hatch use `--blocked`; the
retired red classes (`.capnum.over`, `.pace .big.behind`) are gone. Only the part
of a block above the rule is hatched. Accepting a *stretch year* turns that hatch
grey (`--hatch-settled`) while still drawing the overage: the data stays
honest, only the held state clears. The phone's quarter footer shows only the
amber overage, because a grey *Nk room* badge wraps in a 62px column; desktop
shows both (SG-D11).

**The plan rail shares the telescope's vocabulary** (STYLE_GUIDE §3): radius 3,
gap 2, *dashed* means folded (a stub, a stack, a fifth-lane entry), *dotted*
means estimated, *hatch* means held, and the same focus ring. Comics measure
sequence along a horizontal rail; books measure time as a column per period
against a capacity rule.

**Detail views are intercepted routes, not modal components.** `/books/[id]`,
`/comics/[runId]/[issueId]`, `/watch/[id]` and `/watch/[id]/season/[n]` each
render as a sheet over the list when navigated to from a list, and as a full
page on direct load or refresh:

```
src/app/
  books/list/page.tsx              the list
  books/[id]/page.tsx              full page — direct link, refresh, new tab
  @modal/(.)books/[id]/page.tsx    the sheet — same component, sheet chrome
```

This buys three things a modal component cannot: the back button dismisses it,
the URL is linkable, and a refresh doesn't drop the user back to the list. A
hover preview was considered and rejected — hover does not exist on Android,
which is the primary device, and a tooltip cannot hold notes, history, or shelf
membership. Run pages stay full pages; they are too dense for a sheet.

The issue sheet is the disclosure surface for per-run read state (2.14): the
grey *read in …* hint on a spine row leads to it. It uses the shared layout —
hero, About, Details, *Your record*, History — where *Your record* is a table of
placements (run · position · read state · date), each with its own `aria-pressed`
toggle and no *mark all*.

**Review tables are the same shape everywhere.** Bulk add, Add-issues search and
the AI review (Phase 7) all end in a list where each line is proposed, checked
and decided before anything is written. The columns, on a phone stacked and on a
desktop as real columns:

| Column | Bulk add | AI diff view (7.3, 7.4) |
|---|---|---|
| **Kind** | Validation glyph — `✓` ok, `!` needs a choice, `×` error — never colour alone | Change kind glyph — `+` insert, `⇅` move or link, `−` remove or make optional, `?` unverified |
| **Line / Change** | The parsed label, e.g. `Thor (1966) #337–340` | What changes: the label or run, in mono for slugs |
| **Why** | One line: *4 issues, 3 to add: #337 is already in this run* | One reason per row: *Beta Ray Bill is the entry point for the whole block* |
| **Check** | Metron existence: confirmed, *new series*, or *unverified* | `verified`, `unverified` (shown, never dropped) or `malformed`, from the bulk-entry grammar and Metron |
| **Decision** | `role="radiogroup"` of buttons: *Use that · Keep as typed · Drop* | `role="radiogroup"`: *Insert · Skip*, *Apply · Skip*, *Make optional · Remove · Keep*, *Accept anyway · Drop* |

The default decision is the safe one: an unverified row defaults to *Drop*, a
duplicate to *Skip*, and nothing defaults to a write the user has not seen.
*Remove* and *Drop* are destructive and so are the only decisions that may use
`--danger`; *DNF* and *Skip* are grey. A row whose check failed is
`aria-invalid="true"` and points at its message with `aria-describedby`. The
sticky bar counts the real write — *Apply 3 accepted*, *Add 9 issues* — never the
line count, and the insertion preview shows where those placements land.

**Design notes.** Colour is functional and carries four meanings: `--ready`
green is read, `--brand` blue is where you are and the primary action,
`--blocked` amber is *held* — a hard prerequisite unread, or a decision not yet
made — and `--danger` red is destructive actions and validation failures only.
Nothing on a dashboard is red: over-planning by 27% is a five-year habit, not
an error, and a red state you see every day is a red state you stop seeing.
Amber clears when the user decides, and accepting an over-committed year is a
first-class outcome that persists. `--t1`–`--t8` carry track and genre identity
and nothing else. Issue labels and counts are set in a mono face because they
are tabular data.

**The styling blueprint** (D-31) is the Step 3 style guide: `design/STYLE_GUIDE.md`
for the rules and the measured contrast, `design/tokens.css` for the values, and
the `design/*.dc.html` spec pages for the telescope, the plan rail and every
component state, drawn in both themes at 390 and 1000px. `docs/DESIGN.md`
indexes them. They are authoritative on tokens, type, elevation, motion and
component states; `design/mockups.html` stays authoritative on layout and copy.
The guide changed values and added tokens, and renamed nothing: the four
colour meanings, the identity hues and every class name survive. It makes
**dark the hero theme** — a near-black page with tonal elevation — and
changes the rest mostly by subtraction: blue only for position and the primary
action (a selected chip is neutral inverse, not a blue fill), one type scale of
nine styles with an 11px floor everywhere, five radii, a 4px spacing grid, and
three elevation tiers.

These rules keep the palette honest across three media and two themes:

- **Contrast is a token property.** `--faint` (text) is `#606979` (dark
  `#8a93a2`), 4.5:1 or more on `--page`, `--surface`, `--raise` and `--sunk`
  (the audit's `#6f7888` measured 4.45:1 on white and 3.9:1 on the page, so it
  was darkened when the mockups were built); `--faint-deco` (`#98a1b0`) is for rules and
  outlines only; `--blocked` is `#8a560c` so a 11px amber badge clears 4.5:1;
  unchecked control rings use `--muted` (3:1+). A script checks every
  text-token/background pair. *(From task 1.8a the values are `tokens.css`'s:
  `--faint` `#5f6878`, and `--faint-deco` darkens to `#848d9b` so it clears 3:1
  and can outline controls — telescope cells, stubs, an off switch (SG-D8). The
  script then also checks every text token on all five surfaces, the elevation
  order, and text on glass at its worst case.)*
- **Depth is tone first, shadow second.** `--sunk` is *below* `--surface` in both
  themes, so meter tracks and empty cells read as recessed (in dark it used to
  sit above, SG-D2). A surface on the page gets a 1px `--rule` ring; a surface
  inside a surface changes tone and has no ring; a row in a group has only a
  `--line` divider. Shadows mark the three tiers — grounded (`--sh-1` at most),
  lifted (`--sh-2`: menus, popovers, toasts, a drag ghost) and modal (`--sh-3`:
  sheets, dialogs, the palette) — and in dark they become a 1px inner top
  highlight, with a drop shadow only from `--sh-2` up.
- **Glass is for chrome over scrolling content, and nothing else.** The header,
  the desktop sidebar, the thumb bar and the command palette are `--glass-bg`
  (the surface at α .90) with a 20px blur. α .90 is near-opaque on purpose:
  measured over pure white and pure black, lower values failed `--muted` text
  (SG-D12). `--ready` text is not allowed on glass. Sheets are solid
  `--overlay` over a `--scrim`; rows, the telescope, the plan rail, badges,
  meters and toasts are never glass. Without `backdrop-filter`, or under
  `prefers-reduced-transparency`, glass falls back to solid `--surface`.
- **Hue identifies data, never navigation.** `--t1`–`--t8` colour tracks and
  franchises; sidebar items get neutral line icons. A franchise keeps one hue
  across its dashboard, franchise page and detail, and watch genre chips are
  neutral grey with a text label. Genre hues are their own token family
  (`--g1`–`--g8`, scoped by `[data-medium]`) so *violet* does not mean X-Men,
  Fantasy and a nav item at once.
- **A medium has an accent, used twice.** `--m-comics`, `--m-books` and
  `--m-watch` colour only the active media tab underline and the `h1` kicker,
  next to a `.unit` badge (*sequence · issues*, *time · words*, *seasons*).
- **Touch targets.** 44px on the thumb bar, icon buttons and sheet close; 32px
  minimum on small buttons with a hit area expanded to 44px; 24px absolute
  floor elsewhere.
- **Interactive means focusable.** A navigable row is
  `<article class="row"><a class="row-link" href>` with a stretched-link overlay
  and any secondary button outside the anchor; segmented controls, chips and
  switches are real buttons (`aria-pressed`, `role="radio"`, `role="switch"`);
  status tabs are `role="tablist"` links to `?tab=`. `.bar` is reserved for the
  app header — meters are `.emeter`.
- **Every screen has states.** Empty, loading (skeletons at the loaded
  dimensions), offline (the sync pill), rate-limited, error and
  *metadata pending* are designed, not left to whatever renders. So are the
  control states: hover (pointer only), pressed, focus-visible, and unavailable
  as `aria-disabled` with a visible reason, never a bare `disabled`.
- **Motion confirms, it never celebrates.** Four durations (100, 150, 200,
  300ms), ease-out to enter and ease-in to leave; `prefers-reduced-motion` sets
  all four to zero. No confetti, bounce or streaks (FEATURES Part 2d).

**Phone first, tablet second.** 360–412px is the primary target. Every screen
is laid out there and expanded; nothing is designed at desktop width and
allowed to degrade. The tablet is a real device too — books and comics are read
on it (D-33) — so it is a touch layout, not a small desktop:

| Width | Navigation | Dashboard verbs |
|---|---|---|
| under 768px | the top media bar | bottom thumb bar |
| 768–1023px | a 72px navigation rail, icon over label | bottom thumb bar |
| 1024–1279px | the sidebar, collapsed to a 64px icon rail | page header, primary last |
| 1280px and up | the 224px sidebar | page header, primary last |

The run detail keeps its bottom thumb bar at every width (D-25). **Width chooses
the layout; the pointer chooses the interaction.** Hover reveals, hover
popovers, drag-to-move and shift-click ranges need `(hover:hover) and
(pointer:fine)`, and each has a tap, long-press or sheet route, which is what a
tablet — or a touch laptop — gets. The telescope's size step at 900px
(`--tele-*`) sizes a component; it is not a layout breakpoint.

## 5. Operational posture

- **Backups.** Nightly `pg_dump` to the repo via GitHub Actions, 30-day
  retention, each dump restored into a scratch Postgres and checked before it
  is committed (D-30), plus `GET /api/export` for a full JSON dump on demand.
  Both exist because the workbook is currently your only copy and it shouldn't
  stay that way.
- **Cold starts.** Neon's free tier suspends compute after 5 idle minutes.
  Measured in task 0.9 (2026-10-03, throttled phone profile), the first tap after
  a quiet period took 1.5–6 s longer than a warm one. Every data route paints its
  skeleton at once, so a cold wake reads as loading rather than a frozen page.
  If it still annoys you, the fix is a paid plan with suspend turned off, not an
  architecture change.
- **Performance budget** (task 0.9). The target, on a throttled phone profile
  (Lighthouse mobile, devtools throttling: Slow 4G, 4× CPU): any tap paints a
  skeleton within 200 ms, cold or warm, and a warm tap between screens shows the
  page within 1 s. What holds that, and the test that fails if it slips:
  - **Queries per page, in one wave.** `/` 4 queries, `/comics` 2, a run 3,
    `/books` 4, `/login` none, each page's queries started together
    (`test/query-budget.test.ts`, which counts them). A query that must wait on
    another raises a page's waves; raising either number needs a reason here.
  - **A view read for one run filters by that run before it aggregates.** No
    catalog-wide CTE, no scan of every issue to describe one run
    (`test/view-plans.test.ts`, which reads the planner's plan). Catalog-wide
    pages (the run list, home) ran in 0.27 s and 0.32 s of database time on
    catalog-sized data when 0.9 closed, down from 5.8 s and 1.6 s; re-measure
    with `EXPLAIN (ANALYZE, BUFFERS)` when a view changes. Not asserted: a
    wall-clock test flakes.
  - **No `<Link>` to a route handler** (`test/no-prefetched-handlers.test.ts`).
    A prefetch runs the handler; the nav's Export link built the 20 MB export
    on every page view until 0.9.
  - **`/comics`, a run and `/books` each have a `loading.tsx`**
    (`test/loading-states.test.tsx`). Without one, Next does not prefetch a
    dynamic route and a tap shows nothing until the server finishes. `/` has
    none yet: a root `loading.tsx` would be the first boundary for every route,
    and `/` becomes a redirect to a dashboard (1.8); the dashboards bring their
    own. A new data route ships with its `loading.tsx`.
  - Byte and request budgets per route arrive with Lighthouse on every preview
    (task 0.10).
- **Instrumentation.** Deliberately none. This is a single-user CRUD app over
  14,000 rows; adding APM here would be ceremony.

## 6. Metadata sources

The catalog is authored by you; the API fills in what sits *below* the label you
wrote. `runs`, `prereqs`, and the reading orders stay hand-curated because no
database on the internet knows that `Fantastic Four #570-588` plus `FF #1-23`
is one Hickman run with a soft dependency on Secret Warriors. That curation is
the asset.

| Layer | Source | Notes |
|---|---|---|
| Issue records, covers, cover dates, story titles, creators, canonical labels | Metron (`metron_id` on `issues`) | 20 req/min, 5,000/day. Dates, covers and labels come from series issue lists (~1,800 requests); titles and credits need one detail request per issue (~8,100) |
| Comics gap-fill | Comic Vine | 1 req/sec, 200/hour — fallback only |
| Book bibliographic data, page counts, covers | Open Library | no key, CC0 |
| Series position | Hardcover GraphQL | 5,000 req/day free |
| Word counts | none exist | Keep hand-entered values; estimate the rest at `pages x 275` and record which is which in `books.word_count_source` |
| Films and TV shows | TMDB (`titles.tmdb_id`) | Free for non-commercial use, ~40-50 req/sec, covers both media in one API. Requires attribution in the UI |

Enrichment runs as a background backfill and never overwrites a hand-entered
value. Before cutover it writes the sidecar CSVs in 2.13; after cutover (task
4.1) it writes the database directly under the same rule.

**Add flows are the one place an API is called live** (2.15). TMDB is searched
live because the catalogue is 1.5M+ titles and there is no watch data to seed
from. Metron and Open Library are searched live from *Add issues* and *Add
books*, when you submit a search, so that the thing you add arrives as a real
record with its metadata already on it. No page render ever calls an API.
Responses are cached, and detail pages never re-call.

## 7. Known gaps

1. **The pace engine is missing.** `To-Read Master List` carried minutes-read-per-day,
   words-per-minute, words-per-week, and quarter projections as formula columns.
   v1 dropped them, which removes the answer to "is next year overcommitted" —
   the reason word counts are tracked at all. `reading_settings` plus a capacity
   view restores it. See FEATURES.md Part 2, item 1.
2. `Ultimate Order` and `Ultimate Collection` (174 + 152 rows) are not migrated
   and are confirmed out of scope.
3. `Reading Orders (old)`, `Master`, `Sheet8` are left behind. `Master` is loaded
   as `editions` but has no page.
4. `edition_issues` is declared conceptually but not built, so "which trade
   collects this issue" isn't answerable yet.
5. `book_status.finished_year` is year-granular. Promoting it to a real date
   unlocks streaks, pace-vs-plan, and an accurate year in review, and it is far
   cheaper to do before you accumulate entries than after.
6. `external_lists` entries are unresolved text until you link them to
   `books.id`. `wishlist` is promoted into Someday by task 1.4d (D-39).
7. No editing UI. Reads are complete; writes are limited to issue check-off and
   book status.
8. The watchlist is entirely unbuilt — `titles`, `seasons`, `franchises`, and
   their status and event tables are specified in `FEATURES.md` Part 2g but no
   migration exists yet. It has no data to migrate, so it is the one feature
   that starts from an empty table rather than a spreadsheet.
9. Cross-media franchises are hand-curated. TMDB collections cover film series
   only; nothing in any public API links a film franchise to its television
   entries.

## 8. Roadmap

See **FEATURES.md** for the confirmed feature set, the proposed additions, and
the phased build order. The schema additions those imply are listed there in
Part 5 rather than duplicated here.

## 9. If you add a second reader

1. `INSERT INTO users (id, name) VALUES ('…', '…')`.
2. Swap the body of `currentUserId()` for a real provider. Everything downstream
   already takes `userId` as a parameter.
3. The views already `CROSS JOIN users`, so progress, readiness, and rollups
   become per-person with no query changes.
