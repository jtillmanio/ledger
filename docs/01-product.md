# 01 — Product: Ledger

What the Ledger is, who it is for, what it must do and what it deliberately
won't. The feature index (F-01…) is the scope the roadmap is checked against:
[06-tasklist.md § Coverage](06-tasklist.md#coverage) maps every feature to its
roadmap entries and milestones. Screens are named by their `design/mockups.html`
`data-id` ([design/mockups-index.md](../design/mockups-index.md)).

This is a narrative document and ranks last when documents disagree (D-1):
the code, the roadmap's **Check:** lines, and the architecture and data model
all win over it. Counts are from the 2026-09-23 extract; re-count from a fresh
extract, never from here.

## Product brief

### Problem

Two Google Sheets outgrew being spreadsheets. The comics workbook is a
three-table relational schema (`RUNS` → `Reading Orders` → `PREREQS`) simulated
with `COUNTIFS` and `SUMPRODUCT(--ISNUMBER(SEARCH(...)))`, and its readiness
state machine is a dependency graph 21 levels deep that needed a recursive CTE
Sheets couldn't provide (a CLOSURE tab with Apps Script was built in July 2026
and removed as too much overhead). Marking an issue read on a phone in a
10,800-row tab is the worst part of using it. The formula layer is locked to
Google Sheets (`QUERY` and `ARRAYFORMULA` export as `__xludf.DUMMYFUNCTION`),
and the books workbook is one table pivoted across ten year tabs, so moving a
book between years is a cut-and-paste. A film and TV watchlist, and later music,
start from nothing.

### Users

| User | Context | What they need most |
|---|---|---|
| The owner (primary, the only user today) | An Android phone at 360–412px, daily: marking reads, jotting titles. A tablet for reading (D-33). A Windows desktop for bulk adding and planning | Marking what was just read in one tap; adding a run faster than the sheet; a plan that says honestly whether a year fits |
| A second reader (possible, later) | Their own progress over the shared catalog | An `INSERT`, not a migration ([architecture § If you add a second reader](02-architecture.md#14-if-you-add-a-second-reader)) |

### Goals

| Goal | Metric | Target |
|---|---|---|
| Replace both Sheets | Reading tracked in the app rather than the Sheets | All of it from cutover (START-HERE Step 14), after a month running both |
| Marking is fast | Taps to mark the next issue read | One, from the dashboard or the run, at 360px |
| Adding beats the sheet | Steps to add a run's issues | One paste or one search, one review, one insert, however many issues |
| Snappy on a phone | A tap paints a skeleton; a warm screen change shows the page (throttled phone profile) | Within 200 ms; within 1 s ([architecture § Operational posture](02-architecture.md#7-non-functional-requirements)) |
| Honest planning | Planned words per period against capacity | Every planned quarter and year, from the real reading rate (Phase 2) |
| Free to run | Hosting and services | $0 a month |
| Nothing lost | Backups | Nightly, each one restored and checked before it is kept (D-30) |

### Non-goals

Public or shared pages, recommendations, social features, a native app,
episode-level TV tracking, music playback or scrobbling, streaks, and any
completion date or progress bar against the whole catalog. Each is in the
[cut list](#cut-list) with its reason.

### Constraints

| Constraint | Value |
|---|---|
| Budget | $0/month: Vercel Hobby, Neon free tier, Cloudflare R2 for backups (D-66) |
| Platforms | Android phone first (360–412px); a touch tablet layout at 768–1023px (D-33); desktop from 1024px |
| Users and data volume | One user, multi-user schema. About 10,138 comic issues in 10,761 placements across 258 runs, 438 prerequisite edges, 1,478 books (2026-09-23 extract) |
| Offline | None until 6.4 (PWA, queued writes); no cross-device staleness handling (D-9) |
| Import | `Comics.xlsx` and `Books.xlsx` through `etl/extract.py` and sidecar CSVs until cutover; the owner's Calibre library, read-only (D-73) |
| Metadata | Metron, Open Library, Hardcover, TMDB, MusicBrainz, on free tiers; called from add flows and backfill only, never to render a page |
| Stack | Next.js 16, Postgres on Neon, Drizzle, plain CSS ([architecture § Stack](02-architecture.md#2-stack)) |
| Cadence | One task per Claude Code session, one in flight at a time (`workflow.wipLimit`) |

### Success at MVP

The MVP is **cutover**: the day the Sheets stop being the record.

- Milestones M1–M9 are merged and accepted: all of Phase 1, plus 2.11a (the
  prerequisite graph has no unreviewed cycles) and 1.11 (failed sign-ins slow
  down).
- The final load from the workbooks has run (START-HERE Step 14), and
  `LEDGER_LIVE=true` makes `load` and `rebuild` refuse against production
  (D-18).
- Every read carries its date from the first day: `read_events` (1.5) and a
  book's start date (1.17) were in place before real reading accumulated.
- For a month after, every read, every added issue and every added book goes
  into the app first, and the Sheets are not needed.

### Open questions

Settled defaults, revisited only if the owner wants to (D-3): a ranking-only
rating with no star scale; finished eras collapsed with a count on runs over
100 issues; the top-books list capped at 10; franchises in release order.

Asked at a plan gate when the task arrives: the schema columns 1.17, 1.18,
4.1, 5.1, 7.8 and 8.1 propose; where 8.3's saved views keep their hand-added
and removed titles; 5.13's series key; 9.0's media bar with a fourth medium.
The feel pass left six more, each written into its task as *stop and ask*
(design §9).

## Feature index

Priority comes from the milestone that builds it: **MVP** is cutover (M1–M9), **Next** the first work after it (M10–M15), **Later** the rest (M16–M25). A feature whose work spans two gets the earlier, with the rest noted. Screens are mockup `data-id`s; `—` means the screen is not drawn yet, or the feature has none.

| ID | Feature | User story | Priority | Roadmap | Screens |
|---|---|---|---|---|---|
| F-01 | **Private sign-in** (Platform) | As the owner, I want the ledger behind one passcode, with failed attempts slowed, so it is private and reachable from any device | MVP | 1.11 | — |
| F-02 | **Both workbooks migrated, rebuildable until cutover** (Platform) | As the owner, I want the comics and books workbooks loaded into one schema and rebuildable from the workbook and its sidecars until I cut over | MVP | 0.3, 0.4, 0.5, 0.6, 0.7 | — |
| F-03 | **Tested, released by hand, backed up** (Platform) | As the owner, I want every change tested on its branch, released by hand, and the data backed up nightly, so nothing I typed is ever lost | MVP | 0.1, 0.2, 0.11, 0.12 | — |
| F-04 | **Fast on a phone** (Platform) | As the owner on an Android phone, I want every tap to paint at once and a warm screen change inside a second | MVP | 0.9, 0.10, 1.8d | `states` |
| F-05 | **One shell for three media** (Platform) | As the owner, I want one media bar, rail or sidebar that takes me to comics, books and watch, and `/` to open where I was | MVP | 1.8a, 1.8c, 1.8, 1.8e, 1.8b | `home`, `bdash`, `status`, `watchlist` |
| F-06 | **Mark an issue read, in this run** (Comics) | As a reader, I want one tap to mark an issue read in the run I am reading, with undo, and a grey hint where I read it before | MVP | 0.8a, 0.8b, 1.2 | `spine` |
| F-07 | **Mark a range, adopt prior reads** (Comics) | As a reader, I want to mark a stretch of a run in one action and bring reads from another run across on purpose | MVP | 1.1 | `range`, `batch` |
| F-08 | **Resume where I stopped** (Comics) | As a reader, I want each run I am reading to say which issue is next and take me there | MVP | 1.6 | `spine`, `home` |
| F-09 | **Add issues by typing them** (Comics) | As the curator, I want to paste labels and ranges, validated against my catalog's grammar, and confirm each line before anything is written | MVP | 1.3, 1.3c | `bulk` |
| F-10 | **Add issues from a Metron search** (Comics) | As the curator, I want to search Metron for the issues I am adding and see covers and dates to tell volumes apart | MVP | 1.3b | `addsearch`, `apistates` |
| F-11 | **An Up next queue for comics** (Comics) | As a reader, I want one ordered list of the runs I mean to read next, which I can add to, reorder and remove from | MVP | 1.10 | `queue`, `home` |
| F-12 | **In flight · Up next · Done** (Every medium) | As the owner, I want one screen per medium showing everything in flight, next and finished | MVP (then Later) | 1.9, 8.8 | `status`, `queue` |
| F-13 | **The volume map** (Comics) | As the curator, I want a bare series label to resolve to the right volume year, by rules I can edit | MVP (then Next) | 1.12, 3.9 | `settings` |
| F-14 | **A prerequisite graph without cycles** (Comics) | As the curator, I want the prerequisite graph checked for cycles and edited safely, so readiness means something | MVP (then Next) | 2.11a, 3.3 | `path` |
| F-15 | **Add books by search, paste or hand** (Books) | As a reader, I want to add a book from Open Library, a pasted list or by hand, straight to where it belongs, with results as I type and each one's source shown | MVP | 1.4, 1.4c, 1.4e, 1.22 | `add`, `blist` |
| F-16 | **Quick-capture inbox** (Every medium) | As the owner, I want to jot a title in two seconds with nothing required and resolve it later | MVP | 1.4b | `capture`, `dashextras` |
| F-17 | **A dated reading log** (Books) | As a reader, I want when I started and finished each read kept, rereads included, in my time zone | MVP | 1.5, 1.16, 1.17 | `blist` |
| F-18 | **To-read levels** (Books) | As a reader, I want each to-read book at a quarter, a year, On deck or Someday, with my old wishlist promoted into it, and the books I have but haven't listed kept at Unlisted, out of the way | MVP | 1.7, 1.4d, 1.21 | `blist`, `moveplan` |
| F-19 | **A clean, enriched book catalog** (Books) | As a reader, I want one row per book, with Open Library details and Calibre's real word counts | MVP | 1.13, 1.14, 1.18 | `blist`, `bookdetail` |
| F-20 | **Follow series, authors and universes** (Books) | As a reader, I want to follow the series, authors and universes I am tracking and see my progress through each | MVP (then Later) | 1.15, 5.11, 5.12 | `shelves` |
| F-21 | **The pace engine** (Books) | As a reader, I want my real reading rate to say whether a year's plan fits | Next (then Later) | 2.0, 2.1, 2.1b, 6.12 | `settings`, `session`, `dashextras` |
| F-22 | **Books dashboard and the plan rail** (Books) | As a reader, I want the book in hand, this quarter's shelf and the year against capacity on one screen | Next | 2.2, 2.2b | `bdash`, `planmonth` |
| F-23 | **Plan editing and rebalance** (Books) | As a reader, I want to move books between periods, rebalance an over-full year, or accept it as a stretch | Next | 2.3, 2.7, 2.8, 2.10 | `plan`, `moveplan`, `rebalance` |
| F-24 | **Comics dashboard and the telescope** (Comics) | As a reader, I want to see where I am in the run, its block and its track at once, drawn rather than counted | Next | 2.5, 2.5b, 2.4 | `home`, `telescope`, `states` |
| F-25 | **Unlock cost, leverage and the frontier** (Comics) | As a reader, I want each run's true cost and what finishing it opens, so I pick what to start | Next | 2.6, 6.2b | `path`, `runs` |
| F-26 | **Run list by track and block** (Comics) | As a reader, I want the run list grouped track → block with cost and readiness on every row | Next | 2.9 | `runs` |
| F-27 | **Run and block completion** (Comics) | As a reader, I want finishing a run or a block to be marked, calmly, with what it opened | Next | 2.12 | — |
| F-28 | **Edit the catalog in place** (Comics) | As the curator, I want to edit fields inline, create runs, assign blocks and archive rather than delete | Next | 3.1, 3.2, 3.7, 3.8 | `newrun`, `runs`, `spine` |
| F-29 | **Detail sheets** (Every medium) | As the owner, I want a book, issue, film or show to open as a sheet over the list, linkable and dismissed by Back | Next (then Later) | 3.5, 8.4 | `bookdetail`, `issuedetail`, `titledetail` |
| F-30 | **Eras and spine v2** (Comics) | As a reader, I want a long run sectioned into eras, with ordinals, release dates and read rows hidden | Next | 3.6, 3.6b, 3.6c | `spine`, `krakoa` |
| F-31 | **Ratings, notes and DNF** (Every medium) | As a reader, I want to rate and note what I finish, rank my top books, and stop a book without it reading as failure | Next (then Later) | 3.4, 5.4, 5.5 | `top` |
| F-32 | **Adding at scale** (Comics) | As the curator, I want to add from a whole series' issue list, arrange as I add, and preview an issue before adding it | Next | 3.10, 3.11, 3.12 | `addsearch`, `bulk` |
| F-33 | **Metadata backfill and covers** (Every medium) | As the owner, I want Metron, Open Library and Hardcover to fill in what sits below each label, with real covers, and Calibre synced after cutover | Later | 4.1, 4.2, 4.3, 4.4 | `states` |
| F-34 | **Shelves with context** (Every medium) | As a reader, I want my own ordered lists, with a note on why each item is on them | Later | 5.1, 8.6 | `shelves` |
| F-35 | **Tracks page** (Comics) | As a reader, I want every track drawn as a row of its blocks | Later | 5.2 | `tracks` |
| F-36 | **Editions: collected in** (Comics) | As a collector, I want to know which trade collects an issue and which I own and have read | Later | 5.6, 5.10 | — |
| F-37 | **Coming out** (Every medium) | As a reader, I want the books I want listed when they come out, and new issues in series I follow offered for my runs | Later | 5.7, 5.8 | — |
| F-38 | **Series pages** (Every medium) | As a reader, I want a page per book series and per comic volume, in order, with gaps | Later | 5.9, 5.13 | — |
| F-39 | **Search and the verb palette** (Every medium) | As the owner, I want one `Ctrl+K` box across everything, which also runs commands | Later | 6.1 | `search`, `palette` |
| F-40 | **Stats and the activity log** (Every medium) | As a reader, I want a year in review and a log of everything I finished | Later | 6.2, 6.17 | `stats` |
| F-41 | **Offline and the keyboard** (Every medium) | As the owner, I want marks to queue offline and the desktop to be fast from the keyboard | Later | 6.4, 6.5 | `states` |
| F-42 | **Prerequisite graph and events** (Comics) | As a reader, I want to see the dependency graph and record a read-it or skip-it verdict on events | Later | 6.3, 6.8 | — |
| F-43 | **Choosing from the master list** (Books) | As a reader, I want *Pick one* and *Fits my remaining budget* on the master list | Later | 6.10 | `blist` |
| F-44 | **Appearance** (Platform) | As the owner, I want a compact density, a sidebar toggle, a favicon and a theme I have lived with | Later | 6.11, 6.14, 6.15, 6.9 | `settings` |
| F-45 | **Hardening** (Platform) | As the owner, I want a sign-in stronger than one passcode and a bad request answered as one | Later | 6.13, 6.16 | — |
| F-46 | **Import from Goodreads or StoryGraph** (Books) | As a reader, I want history I don't have imported from a CSV | Later | 6.6 | — |
| F-47 | **AI review and drafting** (Comics) | As the curator, I want Claude to propose reading-order and prerequisite changes, verified by Metron, each accepted by me | Later | 7.1, 7.2, 7.3, 7.4, 7.5 | `ai` |
| F-48 | **Release digest email** (Every medium) | As the owner, I want a weekly email of what comes out in the next 60 days | Later | 7.6 | — |
| F-49 | **Catch me up** (Books) | As a reader, I want a spoiler-bounded recap of the earlier books before a later one | Later | 7.7 | — |
| F-50 | **Issue context** (Comics) | As a reader, I want drafted notes on why an issue matters in this run, accepted by me | Later | 7.8 | — |
| F-51 | **Watchlist: search, add, seasons** (Watch) | As a viewer, I want to add films and shows from TMDB and track shows by season | Later | 8.1, 8.2, 8.3 | `watchadd`, `watchempty`, `watchlist` |
| F-52 | **Franchises** (Watch) | As a viewer, I want films and shows grouped into franchises across media | Later | 8.5 | `franchise` |
| F-53 | **Watch dashboard** (Watch) | As a viewer, I want the five-slot dashboard for what I am watching | Later | 8.7 | `watchlist` |
| F-54 | **New seasons, where to watch, people** (Watch) | As a viewer, I want to know when a show I am current on has a new season, where to watch it, and a page per director or actor | Later | 8.9, 8.10 | `titledetail` |
| F-55 | **Artists and albums** (Music) | As a listener, I want the artists I mean to listen to and their albums, from MusicBrainz | Later | 9.0, 9.1, 9.2, 9.3 | — |
| F-56 | **Song ranking and favourite albums** (Music) | As a listener, I want to rank an artist's songs by picking between two, and see which albums I favour | Later | 9.4, 9.5 | — |
| F-57 | **Music dashboard and status** (Music) | As a listener, I want the music dashboard and its status tabs | Later | 9.6 | — |
| F-58 | **Audiobooks** (Books) | As a reader, I want to mark a book I'm listening to, have a finished listen count as a read, and see listens apart from reads, with an icon | MVP | 1.23 | `blist`, `status`, `bookdetail` |

### Observable outcomes for MVP features

Each MVP feature's roadmap entries carry the exact **Check:**; these are the outcomes in a line.

- **F-01 Private sign-in.** A wrong passcode is answered more slowly each time; `/api/health` is the only route outside the gate.
- **F-02 Both workbooks migrated, rebuildable until cutover.** `npm run rebuild` loads every row from the workbooks and sidecars; nothing derived is stored.
- **F-03 Tested, released by hand, backed up.** CI's `check` and the browser suite pass on the branch; a backup restores; Release is the only path to production.
- **F-04 Fast on a phone.** Each preview is measured against `scripts/perf/budget.json`; a page's queries run in one wave.
- **F-05 One shell for three media.** Every phone route renders the same media nav; `/` redirects to the last medium touched.
- **F-06 Mark an issue read, in this run.** Marking an issue in run A leaves it unread in run B; undo restores the exact prior state.
- **F-07 Mark a range, adopt prior reads.** A range writes one row per placement in one round trip and keeps dates already recorded.
- **F-08 Resume where I stopped.** The pointer is the lowest unread placement in the run, derived, never stored.
- **F-09 Add issues by typing them.** An ambiguous volume asks me to pick; `#1-12` expands to twelve; nothing writes until I confirm.
- **F-10 Add issues from a Metron search.** My catalog is matched first; a Metron failure leaves *Type it* working; no page render calls Metron.
- **F-11 An Up next queue for comics.** The order is stored and contiguous; a started run leaves *Up next* but keeps its place.
- **F-12 In flight · Up next · Done.** The same three tabs, in the same order, on comics and books; each reads from views.
- **F-13 The volume map.** The approved rules load into `volume_rules` and the parser reads them.
- **F-14 A prerequisite graph without cycles.** Extract lists every cycle for review; a cycle is never loaded silently.
- **F-15 Add books by search, paste or hand.** An existing book is reused and says so; *By hand* works when Open Library fails.
- **F-16 Quick-capture inbox.** A note saves with only its text; resolving it opens the add flow its kind names.
- **F-17 A dated reading log.** A reread appends a `read_events` row; a date is stored with its precision; dates are Eastern.
- **F-18 To-read levels.** One `period` column; a year is what its quarters roll up to; Someday is derived.
- **F-19 A clean, enriched book catalog.** Same-title books by different authors stay apart; a hand value is never overwritten.
- **F-20 Follow series, authors and universes.** A follow is stored per user; progress through a series, author or universe is a view.

## The owner's list

The owner's own list, with what each item needs beyond v1. The status column
is a snapshot from the 2026-10-20 intake; the roadmap's boxes are current. The
B, C, W and M numbers are cited across the docs and stay.

### Books

| # | Feature | Status | What it needs beyond v1 |
|---|---|---|---|
| B1 | Dashboard | new | Currently-reading, pace-vs-plan for the year, next up, upcoming releases, genre mix. Design below |
| B2 | To Read by year and quarter, with word-count budgeting | partial | `reading_plan.planned_quarter` exists; task 1.7 makes one period column with four to-read levels — quarter, year, On deck, Someday (D-37) — and no months (D-38); needs the pace engine |
| B3 | To-Read master list, searchable | shipped | Search works; needs sort by word count, filter by series-completeness. roadmap 6.10 |
| B4 | Top books per year, editable | partial | `book_status.year_rank` holds the data, but from roadmap 1.13 the workbook's ranks don't load (no workbook read state, D-41); re-entered through 3.4's reorder, with the ranks kept in `seed/workbook_reads.csv` |
| B5 | Coming out list | shipped | Needs "notify me" and a calendar view. Task 5.7 (D-35): *Out now* plus a month-grouped list, notified in the app; comics get the same in 5.8 |
| B6 | Tracked series and authors with progress | partial | `series_progress` view exists; roadmap 5.9 draws it as `/books/series`. roadmap 1.15 adds universes (`book_universes`, a fact about the work, D-42), `author_progress` / `universe_progress`, and a stored `tracking` / `reading` follow per series, author or universe (D-43), seeded from the Series tab. Arbitrary groupings are shelves (5.1) |
| — | BookTube top 10, Download, HP Fanfiction | migrated, unsurfaced | Data is in `external_lists` and `wishlist`. No pages. Leave `external_lists`; `wishlist` is promoted into Someday (task 1.4d, D-39) |
| B7 | Series, authors, universes and reading-order shelves I'm in the middle of | planned | Derived from the progress views plus a `shelf_progress` view; authors only when followed. A group on 1.9's In flight tab. roadmap 5.12 (product § Owner additions) |
| B8 | Date started and finished | partial | The finish is a date since 1.5. The start is new: `started_on` with its precision on `book_status` and `read_events`. roadmap 1.17, before cutover |
| B9 | Import metadata from Calibre | planned | Word counts (Count Pages, `stated`), series and index and ISBN checked against Open Library and Hardcover, tags and summary, reads through a review (D-73). roadmap 1.18, before cutover |
| B10 | Books read each year, and a log of what I read | partial | Year totals ship (`books_by_year`, the year chips); 6.2 charts them; `/activity` is the log. roadmap 6.17 |
| B11 | Add books: title and author as two fields | partial | *By hand* has them. *Paste a list* gains a tab-separated form and a review with separate cells. roadmap 1.4e |
| B12 | Series are links | planned | Every series name links to `/books/series/[id]`, which lists the books in order, with gaps. roadmap 5.9 |
| B13 | Year chip: the count reads apart from the year | bug | Fixed outside the task list, on `fix/year-chip-count` |
| B14 | *Catch me up*: a recap of the earlier books before a later one | planned | Claude, on demand, spoiler-bounded, stored in `proposals`. roadmap 7.7 |
| B15 | A shelf's context: why each book is on it | planned | `shelves.description`, `shelf_books.note`; ordered shelves are reading orders (the Dark Tower). roadmap 5.1 |
| B16 | Search as I type, and say where each result came from | planned | 2026-10-26. Every search box searches after 3 characters and a 500 ms pause; each result is tagged with its level or its source. roadmap 1.22, D-84 |
| B17 | Every Calibre book in the Ledger, kept out of the way; Calibre re-synced | planned | 2026-10-26. A new *Unlisted* level below Someday, found by search and its own chip, on no list or dashboard. 1.18 re-runs until cutover; after it, an in-app upload sync; Google Drive later. roadmap 1.21, 1.18, 4.4, Later L-4, D-83, D-86 |
| B18 | Audiobooks: listening, and listened | planned | 2026-10-26. A *Listening* status, a finished listen counts as a read, a headphones glyph, reads and listens counted apart. roadmap 1.23, D-85 |
| B19 | Create a shelf while adding a book | planned | 2026-10-26. *New shelf…* in the add sheet's shelf picker. roadmap 5.1 |

### Comics

| # | Feature | Status | What it needs beyond v1 |
|---|---|---|---|
| C1 | Dashboard: reading now, block position, issues left, next up | partial | Block position is ready — `blocks` and the `block_position` view landed early; "next up" still needs a resume pointer |
| C2 | Full run list with readiness, plus add new | partial | List and readiness shipped; no create/edit |
| C3 | Reading order page per run | shipped | The spine view |
| C3a | Ordinal gutter on spine rows | planned | The placement's ordinal (`42`) before the tick, matching the head pill `42 / 381 · #141`; in the row's accessible name; the scrub target. roadmap 3.6b, STYLE_GUIDE §5.1 |
| C3b | Hide read, per run | planned | Hides rows read in this run (rows read elsewhere stay); a `+N read · Show` stub per hidden stretch; remembered per run, storage to decide. Needs per-placement read state (0.8a, done). roadmap 3.6c |
| C3c | Real covers on spine rows | planned | `issues.cover_url` (Metron) in a fixed 28×42 box, with the text fallback, lazy loading, and a reduced-data path and a *Show covers* setting. roadmap 4.3 |
| C3d | Release date per row | planned | `issues.cover_date` as a grey desktop column; phone rows leave it to the issue sheet, which also gains the publication date (a new column, to be approved); an opt-in per-run caption for runs not in publication order. roadmap 3.6b, 3.5 |
| C3e | Next issue in the run hero | planned | A tonal strip above *Resume #141*: cover, label and the placement's note. roadmap 1.6 |
| C4 | Edit everything | not built | The largest single chunk of remaining work. See product § Editing principles; blocks are roadmap 3.8, the volume map 3.9 |
| C5 | To-read list | shipped | On the dashboard as "Start next" |
| C6 | Events and tracks tracking | partial | Views exist, no pages |
| — | Ultimate Order, Ultimate Collection, Master, Sheet8 | out | Not migrated. `Master` is loaded as `editions`; roadmap 5.10 surfaces it (collected and read) |
| C7 | A run's date started and finished | planned | Derived: `run_state.started_at` beside `finished_at`, from the run's own dated reads. roadmap 1.17 |
| C8 | Collected in: omnibus or trade? | planned | *Collected in* on the run page, from `edition_issues` and `editions.book_type`. roadmap 5.6, 5.10; discovering editions you haven't listed is Later § L-3 |
| C9 | Series view, with gaps | planned | `/comics/series/[key]`: every issue of a volume, the runs that place it, read state per run, gap stubs. roadmap 5.13 |
| C10 | Add many issues of one series at once | planned | A series browser in Add issues: the whole volume from Metron's issue list, check a range, then 1.3c's review. roadmap 3.10 |
| C11 | Other publishers (DC, Image: Walking Dead, Invincible) | ready | Nothing is Marvel-specific except `tracks.publisher`'s default. 3.2 creates a track with a publisher; 3.10's check runs a non-Marvel volume |
| C12 | Other providers: Marvel Unlimited, League of Comic Geeks ratings | later | No public APIs. roadmap *Later* § L-1, L-2 |
| C13 | Context for a run's important issues | planned | The fact is Metron's summary (`issues.summary`, 4.1). Why it is in *this* run is the placement note, which Claude drafts and you accept (7.8) |
| C14 | Search results preview an issue | planned | A *Details* disclosure: tap, or hover with a fine pointer. One Metron detail request, cached. roadmap 3.12 |
| C15 | Arrange issues as you add them | planned | An *Arrange* step in the review: drag, menu or keyboard. It doubles as the run's reorder. roadmap 3.11 |

### Watch (2026-10-20 additions)

| # | Feature | Status | What it needs |
|---|---|---|---|
| W1 | Metadata that shows and filters: network or streamer, studio, director, cast, length, seasons and episodes, genre | planned | `titles.networks`, `titles.studios`, `people` + `title_credits` rows, totals derived in `show_progress`. roadmap 8.1, 8.3 |
| W2 | Where to watch | planned | Reverses product § Watch's *Out* (D-74). A dated TMDB/JustWatch snapshot, refreshed when you ask. roadmap 8.9 |
| W3 | Which show I'm on, what I've finished, a rating; waiting for a new season | partial | Season tracking was already designed. Adds a show-level rating and the derived `caught_up` state. roadmap 8.1, 8.8, 8.9 |
| W4 | Custom groupings, made in the app (examples: Nolan, Spielberg, Disney Animated, DCOM, loose groups) | planned | Two kinds, both created by you. A title shelf (8.6, with notes) is hand-picked and ordered. A saved view (8.3) is a named filter (person, studio, network, genre and so on) that keeps itself current, plus titles you add and minus titles you remove by hand; with no filter, a view is entirely hand-picked. *Add these to a shelf…* turns a filter into a shelf. Every credited person also has a page (8.10) |

### Music (2026-10-20 additions)

| # | Feature | Status | What it needs |
|---|---|---|---|
| M1 | Artists I want to listen to | planned | `artist_follows` (*want · listening*). roadmap 9.1, 9.2 |
| M2 | Albums to listen to, from those artists | planned | The discography from MusicBrainz, studio albums by default; `album_status`, `listen_events`. roadmap 9.2, 9.3 |
| M3 | Rank each song for some artists, and see which albums I favour | planned | A stored order built with a *This or that* sorter; album favourites derived. roadmap 9.4, 9.5 |

## Beyond the list

What the owner didn't list and probably wants, in priority order within each
tier. Item numbers (#1…#22) are cited elsewhere and stay; #19–#22 appear twice,
once in the final tier and the AI section and again in *Confirmed additions*,
as they did in the original.

### Tier 1 — these change whether the app survives contact with daily use

**1. The pace engine (books).** Your sheet computes words/day from minutes-read-per-day
times reading speed, projects across quarters, and lets you see whether a year's
plan fits. Rebuild it properly: a `reading_settings` row holding your minutes/day
and words/minute, then a view that sums planned word counts per year and quarter
and compares against capacity. Surface it as a single number per period —
"2027 is at 118% of capacity" — with the overage broken out by genre. This is the
whole reason you track word counts, and it's the feature that makes B2 worth
building at all.

**2. Bulk entry, with validation.** One textarea, one issue per line, inserted in
order. Same for books. Without this the app is slower than Sheets for adding a
run and you will drift back — still the single highest-risk item.

Validation is what makes it better than Sheets rather than merely equivalent.
Your 10,000-odd existing labels follow a consistent grammar —
`Title [(Year)] #Number` — which means a parser can enforce it going forward.
The rule that actually earns its keep: **59 series in your data appear both with
and without a volume year.** `Captain America #1` matches eight volumes
(1997, 1998, 2004, 2011, 2012, 2013, 2025, and the original); `Avengers #1`
matches six. Today the sheet accepts either silently. The importer should flag
an ambiguous label and make you pick, so the catalog converges instead of
drifting further. Full rule table in [archive/TASKS.md](archive/TASKS.md) § 1.3, pipeline in DIAGRAMS.md §6.

Everything routes through a review table — accept, fix, or drop each line —
before anything is written. Ranges (`#1-12`) expand on insert. 302 labels are
legitimately freeform (`Dark Reign: The Cabal`, `Astonishing Tales #1
(Mojoworld)`), so unparseable must mean "confirm manually", never "reject".

**3. Mark a range read.** Krakoa is 641 issues. Checking them one at a time is
absurd. Shift-click for a range, plus "mark everything through here" on a row.

**4. A dated reading log.** *(Built in task 1.5: a finish date with its precision,
`read_events` for books, and *Change date…* on a comic read.)* Before it,
`book_status.finished_year` was year-only and `issue_progress.completed_at`
defaulted to now. Make the date first-class and
editable, and you get: what did I read in July, current streak, pace against plan,
and an accurate year-in-review. Almost every stat you'd want later depends on
having this, and it's nearly free to add now versus painful to backfill.

**5. Undo.** Everything is one tap. A mistap on a 641-row list is otherwise
unrecoverable without hunting for the row.

### Tier 2 — high value, cheap

**6. Global search.** One box, `Ctrl+K`, across runs, issues, books, series,
authors, events. You have 12,000 rows; navigation by filter alone gets old.

The `Ctrl+K` overlay is also the app's **verb palette**. A `>` prefix switches it
to commands against the current screen — `> mark through #160`, `> move Piranesi
Q3`, `> queue Priest BP top` — listed as *Actions on this screen* above *Results*.
Results are grouped Comics · Books · Watch, so a film someone mentioned is found
by the same box. On desktop the shortcut shows in the sidebar; on the phone it is
the search icon at the right of the media bar, a 44px target.

**7. Resume pointer per run.** "Continue: Fantastic Four #583" on the dashboard,
one tap to the right position in the spine. Derived, not stored — the lowest
unread sequence in a run you've started.

**8. Ratings and notes after reading.** `runs.rating` exists and is empty. Add a
short note field on runs and books, filled in when you finish. This is the thing
you'll be glad you have in three years, and a spreadsheet is a bad place for prose.

**9. Shelves.** A generic `shelves` + `shelf_items` pair covers "Cosmere",
"Stephen King", "Riordanverse", the HP fanfic list, and whatever you invent next —
instead of a hardcoded tab per thing. This is what B6's "ability to add more of
these" is asking for. *(Amended by D-42: Cosmere, Riordanverse and other
universes are catalog facts in `book_universes`, and Stephen King is followed
as an author, roadmap 1.15. Shelves stay for free-form lists like the HP fanfic
one.)*

**10. Stats / year in review.** Books and issues per year, words read, genre mix,
longest run finished, series closed out. Depends on #4.

**11. DNF as a real status.** Already in the enum, needs UI and a reason field.

**12. Which trade collects this issue.** You have 178 editions with issue ranges
as text. Parsing `"Avengers #500-503 and Avengers Finale"` into an
`edition_issues` join means the run page can tell you what to actually buy or
pull off the shelf. Parsing is fiddly but one-time.

### Tier 3 — worth it once the basics land

**13. Cover art**, from the APIs in architecture § Metadata sources. Turns a list of strings into something
you want to look at. One image column, lazily populated.

**14. PWA / offline read.** Service worker caching the last few runs you opened,
with writes queued when offline. You read on a tablet; wifi isn't guaranteed.

**15. Prereq graph view.** A visual of the dependency DAG per track. You have 438
edges; seeing them is genuinely different from reading them.

**16. Import from Goodreads or StoryGraph CSV.** If you ever want history you
don't currently have.

**17. Keyboard shortcuts.** `j/k` to move, `x` to toggle, `/` to search. You'll
use the desktop for bulk work and the phone for check-off.

### Final tier — last, by your call

**18. Release digest email.** Weekly summary of what's coming out in the next 60
days, via Vercel cron plus Resend's free tier. You said you don't need it;
logged here so it isn't lost.

**19. Events page.** Crossovers with your read-it or skip-it verdict. Deferred
by your call; the data is already migrated into `events` and `event_runs`.

### AI-assisted curation (Phase 7)

Yes, this works — with one structural rule that decides whether it's useful or a
liability.

**The rule: the model proposes, Metron verifies, you approve.** Claude is
genuinely good at "what's the accepted reading order for Simonson's Thor",
"which tie-ins does this event actually need", and "you're missing the two
issues that set up the Krakoa status quo". It is unreliable at exact issue
numbers and will produce a confident, plausible, wrong `#` — which is the one
thing your data cannot tolerate. So every proposed label is parsed with the
bulk-entry grammar and existence-checked against Metron before it reaches you.
Anything that fails is shown as unverified rather than dropped, so you can
accept it knowingly.

**19. Review a run's reading order.** Send the run's title, writer, issue list,
and your notes; get back proposed insertions, removals, reorderings, and
core/optional reclassifications, each with a one-line reason. Renders as a diff
against the current order — accept per row.

**20. Review a block or track.** Wider scope: gaps between runs, ordering
problems, a prereq edge that should exist, a run that belongs in a different
track. Output is a list of proposed changes, not prose.

**21. Draft a new run from scratch.** You give a writer, a character, or an era
("Priest's Black Panther", "the Messiah trilogy"). It drafts the run record —
title, writer, a `why`, proposed
tracks and prereqs — plus a full issue list. Everything lands in the same
review table as bulk entry. Nothing writes until you accept.

**22. Propose prereq edges.** Given a run, suggest what should be read first and
why, checked against the existing graph for cycles.

Implementation notes:

- Server-side only, `ANTHROPIC_API_KEY` in env, never exposed to the client.
- Every proposal is stored in a `proposals` table with the prompt, the raw
  response, and the accept/reject decision. Auditable, and it lets you re-run a
  review later and diff the two.
- Ground the prompt with what you already have: the track's other runs, the
  existing prereq edges, your tier ratings. A review that doesn't know your
  Prereq tab will suggest things you already encoded.
- Cost is negligible — a run review is a few thousand tokens.
- **Build it after Phase 4.** Without Metron enrichment there's no verification
  step, and an unverified drafting tool would quietly poison a catalog you spent
  years building.

## Confirmed additions

*From the Sept 2026 review.*

**20. Reading session tracking.** The capacity engine currently rests on two
numbers you type once: 45 min/day and 185 wpm. Guesses drift, and yours will
drift as a toddler's schedule changes what a reading day looks like. Log
sessions — a start/stop timer, or "read 35 minutes" after the fact — and the
app computes your *actual* words per minute and minutes per day from real data,
then flags when reality has diverged from the setting. Every capacity number in
Phase 2 depends on this input, so it's the highest-leverage thing that was
missing.

Sessions attach to a book or a run, so they also feed reading velocity over
time and answer "how long will this 641-issue run actually take me."

**Split by D-8 (Sept 2026 review).** The capability — honest input to the
capacity engine — is task **2.1b** and is just the after-the-fact minutes entry
plus *Recalculate from sessions*. The convenience around it (the start/stop
timer, the timer chip, the *Tonight* card, *Estimated time to finish*) is task
**6.12**. Two numbers the owner types once do not justify a chip in three thumb
bars before the rest of the app exists; the entry path alone makes them honest.

The mockups need four surfaces for this, none of which existed before the
Sept 2026 audit (the first is 2.1b; the rest are 6.12):

- **The session sheet.** Start/stop timer, an after-the-fact "read 35 minutes"
  entry, an attach-to control (a book or a run) and a delta — pages for a book,
  issues for a run. It is the only input to Settings → *Measured from sessions*
  (212 wpm · 38 min/day), so the **Use these** button has a source.
- **A timer chip** in the third slot of the thumb bar, mirrored in the desktop
  sidebar footer. It follows you across screens; stopping it opens the session
  sheet pre-filled with the current run or book.
- **A "tonight" fit card** under the Now slot: *6 issues of Claremont · or the
  rest of The Butcher of the Forest · or Andor S2*. It looks one evening ahead
  only, so it does not break the rule against completion dates. Hidden until at
  least five sessions exist.
- **Estimated time to finish** ("about 6 weeks at your pace") on the run hero
  and in-flight status rows, hidden until session data exists.

**21. Quick-capture inbox.** Bulk add and New Run both assume you already know
what you're adding — issue ranges, a writer, a series string. They don't cover
the real moment: someone mentions a run in passing, or a BookTube video
name-drops a title, and you want to jot *"Priest's Black Panther, apparently
great"* in two seconds on a phone with zero required fields, then resolve it
properly at a desk later. Books had only the raw `wishlist` for this (promoted
into Someday by task 1.4d); comics had nothing.
One text field, optionally tagged books or comics, feeding the same
review-and-resolve flow as bulk add.

The kind control reads **Books · Comics · Watch · Unsure**; resolving a Watch
note opens `/watch/add` pre-filled. The inbox count (*6 in inbox*) shows as a
chip on each dashboard's lede below 1024px and as `Inbox (N)` in the desktop
sidebar, which replaces the chip from 1024px (FP-D16), so a note you jotted
on the phone is visible somewhere you will actually look.

**22. Re-read history.** `issue_progress` and `book_status` are one row per
item, so marking something read a second time overwrites the first. With King
and Cosmere on your shelves and a plausible Krakoa re-read before any events
work, this needs deciding before you accumulate a year of data — retrofitting
means migrating what already exists. Recommendation: add a `read_events` log
(user, item, finished_on, session_id) and keep the existing tables as the
current-status projection over it. Costs one table now; impossible to
reconstruct later.

~~**Not building:** upcoming-issue tracking for ongoing comics.~~ **Reversed by
D-35 (2026-09-30):** new issues in a series you follow are offered for adding
to a run (task 5.8), and books coming out get their own list (5.7).

## Metrics

Computed from your actual migrated data, not hypotheticals.

### The one that changes decisions: true unlock cost

Your prereq graph runs **21 levels deep** (2026-09-23), and 156 runs cost more than 3x their
own size once prerequisites are counted. The run list currently shows a run's
own issue count, which is misleading for most of the catalog:

| Run | Shown | Prereq runs | True cost |
|---|---|---|---|
| Ewing — Defenders | 13 | — | **all four figures withdrawn (R1-01)** |
| Ewing — Immortal Thor | 45 | — | — |
| Ewing — Immortal Hulk | 64 | — | — |
| Spencer — Spider-Man | 92 | — | — |

**The costs in this table are withdrawn, not merely stale** (R1-01, D-7). They
were computed against a graph with a 98-run closure; a Tarjan pass over the
current `prereqs.csv` finds a **98-run strongly connected component**, and
inside a cycle every member is an ancestor of every other — so `ewing-defenders`
and `claremont-xmen` now report the *same* 160 ancestors. The near-identical
88 / 82 / 78 prereq counts above are that component showing through, not four
independent measurements. The argument survives and the numbers do not: real
costs come from `run_unlock_cost` after task 2.11 breaks the cycles. No
acceptance check asserts a figure from this table.

The corollary: **highest-leverage run**, which is cycle-independent and holds.
Verified against the extract: `claremont-xmen` is a direct prerequisite for 13
other runs, `hickman-secret-wars` and `leekirby-ff` for 9 each,
`morrison-new-xmen` for 7. "Finish this, unlock the most" is a genuinely
different ordering from tier.

### Pace vs. plan — you are over-planning by 27%

| Year | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| Books read | 33 | 20 | 29 | 34 | 30 |

A steady ~29/year. Your plan for 2026–2030 averages **35/year**. The capacity
model already catches this in words; stating it in books, against five years of
your own history, is blunter and more convincing.

### Backlog horizon

1,130 unread books, **149.5M words**. At 3.0M words/year that's a ~50-year
queue. Not a number to display prominently — but "you will not read this list"
is a true and useful thing for a completionist to see once, and it reframes the
plan as curation rather than a checklist.

### Worth building

1. **Books per year, with plan overlaid** — bar chart, five years of history
   plus five years planned. Makes the over-planning visible at a glance.
2. **Genre mix: planned vs. actually read** — two stacked bars. You plan 467
   Fantasy but read across eight genres; the gap is interesting.
3. **Track completion** — 37 tracks, each drawn as a row of its blocks, every
   block filled by its own share read, with the count as text (D-29 — one bar
   per track would sit near empty for years). Also surfaces which tracks you've
   never started.
4. **Reading velocity over time** — needs #20, but once it exists, words/week
   is the honest version of the pace number.
5. **Publication decade coverage** — your runs span 1941–2026, with 73 starting
   in the 2010s and only 15 in the 1960s. A histogram of what you've *read*
   against what you've *listed* shows era blind spots.

## Watch

*Film and television, Phase 8.*

A third media type. Lighter than comics — no dependency graph, no capacity
engine — but with real structure: **films, shows, seasons, and franchises.**

### Three levels, not one

The earlier draft had one row per show and no episode tracking. That was right
about episodes and wrong about seasons. The structure mirrors comics exactly:

| Comics | Watch | Granularity |
|---|---|---|
| Run | Show | The thing you decide to start |
| Issue | **Season** | The unit you finish and feel progress on |
| Track | **Franchise** | The grouping you browse by |
| — | ~~Episode~~ | **Still out.** See below |

**Seasons are in; episodes stay out.** A show has 2–10 seasons, not 200
episodes. Season-level tracking answers "where am I in Severance" without
turning a TV tracker into a checkbox farm — and it's the level you actually
think and talk at. If episode tracking ever becomes necessary, `watch_events`
already supports multiple rows per season.

### Franchises and series

One table covering both, with optional nesting via `parent_id`:

- **Star Wars** (franchise) → **The Mandalorian era** (series) → shows and films
- **Dune** — just a flat series, no nesting needed
- **MCU** → **Infinity Saga** → films

A franchise spans films and shows, which is the point — Andor and Rogue One
belong together regardless of medium.

**TMDB does half of this for free.** Films carry `belongs_to_collection`, so
the Dune, LOTR, and John Wick collections populate automatically via
`/collection/{id}`. **There is no TV equivalent**, and nothing links films to
shows, so cross-media franchises are hand-curated. Auto-populate what TMDB
knows, let the user build the rest.

### Scope

| In | Out |
|---|---|
| Search TMDB, add a film or show | Episode-level tracking |
| Season-level status and progress | ~~Where-to-stream availability~~ (in, D-74) |
| Franchise and series grouping, nested one level | Runtime budgeting or a capacity engine |
| To-watch, watching, watched, dropped | Trakt sync or scrobbling |
| Date and rating per film, show, or season | Recommendations |
| Shelves, same concept as books | Air-date calendars or reminders |
| Rewatch history at title or season level | |
| Network or streamer, studio, director, cast, length; filter by each (8.1, 8.3) | |
| Where to watch, as a dated snapshot refreshed when you ask (D-74, 8.9) | |
| *Waiting for a new season* (`caught_up`), and a new season found when you ask (8.9) | |
| Person pages for directors and cast (8.10) | |

### Derived, not stored

Show progress is computed from seasons, as run progress is from issues, and a
dropped show is the one show-level status written (data model 2.5b, 2.20). TMDB,
the one source for films and shows, is in
[architecture § Metadata sources](02-architecture.md#10-metadata-sources).

### Starting from zero

No spreadsheet to migrate. The list starts empty, which makes this the one
feature where the empty state matters: the first screen is a search box, not a
"no items" message. Concretely: a full-width TMDB search, three example queries
underneath, and the TMDB attribution — no "no items" copy anywhere on it.

**Add and franchise details.** Each show row in the add flow has a *Watched
through* stepper (*none · S1 · S2 · S3*), so a show you have already seen is not
added at zero. The up-next button says **Start S1** (or `Start S{next}`) rather
than a bare *Watch*, which is ambiguous between *set watching* and *log watched*.
On the franchise page the order toggle sits above the tree it reorders, child
rows are links to the title, and a null `chronology_ordinal` shows under an
*unplaced in chronology* group when Chronological is chosen. A franchise owns
one hue across the dashboard, franchise and detail screens; genre chips are
neutral grey with a text label.

## Requirement changes

*Sept 2026.*

Four changes, all confirmed. Schema reasoning is in data model 2.14–2.16
and §4. Tasks are 0.8, 1.3b, 1.4c, 1.9, 1.10 and 8.8.

### Read state is per run, and the app tells you where you read it before

**Change:** an issue can be read in one run and unread in another. This reverses
the "read it once, read everywhere" behaviour that task 0.7 shipped.

Why it is right: a crossover issue means something different in the event than
in the tie-in run, and whether to reread it when it turns up again is a decision
you make run by run. The workbook already recorded `Completed` per row, so this
is the sheet's own model. Only 1 of 76 completed rows sits on a shared issue.

What you see:

- **On the spine**, a row whose issue has been read in another run carries a
  grey note: *read in Hickman — FF*, or *read in Fear Itself +2*. It is grey on
  purpose: green means read *here*, and the hint must not pass for a checkmark.
  The box is not ticked for you. One tap ticks it, the same as any row.
- **In the issue sheet** (`/comics/[runId]/[issueId]`, the intercepted route the
  grey hint leads to), every run that places the issue, its position there, and
  whether it is read in that run, with a date. Its shape is the shared detail
  layout: hero, story title, credits by role, story arc, *Your record* — a table
  of placements (run · position · read state · date), each with its own
  `aria-pressed` toggle — and collecting editions. You can tick any one of them.
  Nothing ticks them all; there is no *mark all*.
- **Bringing reads across is explicit.** *Adopt N prior reads* (design §14) acts on
  one run at your command, previewed and undoable.
- **Rollups** above a run count each comic once. A block or track counts an
  issue as read when any of its placements inside that block or track is read.
  A prerequisite run only counts as finished when its own placements are read.

### Adding: search an API, or type it — and a real record either way

**Change:** adding an issue to a run, or a book to a shelf or the to-read list,
starts with a choice between searching an API and entering it freeform. Either
way, a record is created in the database before anything points at it.

| Adding | Search | Type it | Creates |
|---|---|---|---|
| Issues to a run | Your catalog, then **Metron** — cover, volume year and cover date on each result, so an ambiguous `Captain America #1` is resolved by looking at it | One label per line, ranges allowed, through the bulk-entry validator (roadmap 1.3) | `issues` if the label is new, then a `run_issues` placement |
| A book to a to-read level (a quarter or year, On deck, Someday) or a shelf | Your library, then **Open Library** — pages, year, cover, estimated words | Title and author, the rest optional; or paste a list (roadmap 1.4) | `books` (plus `authors` / `book_series`), then `shelf_books`, `book_status` or `reading_plan` |

Existing rows are always reused and shown as yours ("in 3 runs", "on
Cosmere"). This makes Metron and Open Library **live during add** as well as
backfill sources. No page render calls them, and a search runs only when you
submit it. A freeform record starts thin and backfill fills it in later,
without touching what you typed.

### Every medium: in flight, up next, done

**Change:** books, comics and film/TV each get one screen that shows everything
in flight, everything planned or next up, and everything completed.

`/comics/status`, `/books/status`, `/watch/status`: one component, three tabs,
the same names in the same order on all three: **In flight · Up next · Done**.

| | Comics (runs) | Books | Film & TV |
|---|---|---|---|
| In flight | Partly read, with resume pointer | Reading | Watching — shows derived from seasons |
| Up next | **Your queue**, in your order — then runs ready to start that aren't queued yet | The plan by level (D-37): each quarter in your order, then the year's bare-year entries, then On deck; Someday links to the master list | To watch, filtered by film/TV and genre |
| Done | Finished runs | Read, by year | Watched |

DNF and dropped sit collapsed under *Stopped* at the foot of Done. The
dashboards stay as they are and link into the matching tab. The master list
stays too: it is for searching the whole catalog, and the status screen is for
seeing where everything stands.

### Comics Up next: an ordered want-to-read queue

**Change:** comics get an Up next plan. It is one list of runs, open-ended, that
you can add to, reorder and remove from. It has no years or quarters, and it
sits on the comics dashboard the way the plan rail sits on the books one.

- **Adding.** *+ Up next* on a run's detail page, on run-list rows, on the
  dashboard's *Unlocked and waiting* rows, and on the status screen's *Ready,
  not queued* section. New entries go to the bottom. The run detail also offers
  *Read next*, which puts it at the top.
  On the status screen the tabs are a real `role="tablist"` of links
  (`?tab=next`); *Ready, not queued* is its own group under the queue, each row
  with **+ Up next**.
- **Reordering.** A drag handle on each row, which is a long press on the
  phone. The handle is a button (*Reorder Simonson — Thor, position 2 of 12*):
  Space lifts, arrows move, Space drops, Esc cancels, announced in a live
  region. The row menu offers *Move to top · Move up · Move down · Remove*, so
  reordering never depends on a pointer.
- **Removing.** *Remove from Up next* in the row menu, with an undo toast.
  Nothing else removes anything. Starting a queued run moves it to In flight,
  and finishing it moves it to Done, but its place in the queue is kept until
  you remove it.
- **Blocked runs are allowed.** A queued run that is blocked carries its amber
  *N runs first* badge. Wanting to read it is a fine thing to write down; the
  badge tells you what that costs.
- **On the dashboard**, the first five unstarted runs in the queue, with *Start*
  on the top one and *All N* linking to the Up next tab. When the queue is empty,
  the section offers a pick from the ready runs rather than saying nothing.

It deliberately has no capacity, pace or period. Those belong to books, where
word counts make them honest (product § Metrics). data model 2.16, roadmap 1.10.

## Owner additions

*Oct 2026.*

On 2026-10-20 the owner listed 25 additions and corrections across books,
comics, watch and a new medium, music. Each was judged for value and fit and
then placed: amended into a task that already does that work, given a new
task where it fits the build order, or parked under roadmap *Later*. product § The owner's list's
tables carry the short form (B7–B15, C7–C15, W1–W4, M1–M3). This part records
the calls that shaped them.

**Placed before cutover, because the data can't be recovered later.** A
book's start date (1.17) has the same deadline 1.5 had: a start that isn't
captured from the first day is gone. The Calibre import (1.18) runs through
extract's sidecars like 1.14, and extract stops running at cutover. The paste
fix (1.4e) is to a screen already in daily use. The year chip's spacing is a
plain bug, so it was fixed on its own branch (`fix/year-chip-count`) rather
than made a task.

**The 2026-10-26 books intake** (B16–B19) asked for five things; two were
already planned. A series view with each book's status and dates is 5.9
(B12). Creating a shelf is 5.1, which now also offers *New shelf…* from the
add sheet. The other three are new. Search as you type (1.22) reaches the
external APIs as well, so the add-flow rule changes from *on submit* to *on
submit or a pause* (D-84), with answers still cached. Calibre's books all come
in (D-83), at an *Unlisted* level below Someday (D-86) that search finds and its own
chip lists, and that dashboards and counts leave out (1.21). Calibre syncs by
re-running 1.18 until cutover and by an in-app upload after (4.4), because
after cutover nothing local writes the live database; fetching from Google
Drive is the later upgrade (L-4). Audiobooks (1.23) land before cutover for
1.17's reason. A finished listen counts as a read, so progress and year totals
include it, but the log records the format, so stats, the book's summary and a
headphones glyph can tell them apart (D-85).

**Calibre is the best word-count source available** (the *Word counts* answer in architecture § Metadata sources
had only estimates and manual lookups). The Count Pages plugin's counts load
as `stated`. The owner asked that series, index and ISBN still be checked
against an API, so they fill only where Open Library or Hardcover agree, and
disagreements go to a review. Calibre's reads may load where the workbook's
may not (D-41), because they are typed fields rather than tabs that parse
badly, but only those the owner accepts (D-73).

**A run's dates are derived, not stored.** A run starts at its earliest dated
read and finishes at its last, so `run_state` carries both. Storing them would
be a second copy of `issue_progress` that drifts.

**"In the middle of" counts authors only when followed.** A series, universe
or reading-order shelf with some read and some unread is genuinely in
progress. An author with one book read and one unread on the list is not, and
there are 376 of them. A follow (D-43) is the owner saying it matters.

**An issue's context is two things.** What the issue *is* (Metron's summary)
is a catalog fact, backfilled in 4.1. Why it is in *this* run, a first
appearance, a tie-in you need going in, is the placement's note, because the
same issue can be essential to one reading order and skippable in another.
Claude drafts those notes and you accept them (7.8). Notes carry provenance
like a why, and any issue a note names passes the verification gate.

**Hover is never the only way in.** The search preview (3.12) is a disclosure
that hover also opens on a desktop. That keeps the UX floor and design §13's
point: Android, the main device, has no hover.

**Browsing one series amends D-60.** Walking Metron's issue list was rejected
for typed number ranges. For "show me the whole volume and let me check what
I want", it is the right call: a 300-issue volume is three cached requests.

**Other publishers need almost nothing.** The parser, Metron and the volume
map are publisher-agnostic. The one Marvel default is `tracks.publisher`, so
3.2 lets a new track name its publisher.

**Watch: credits become rows, and counts become derived.** The data model §4.2 draft
had `creators` and `cast_top` arrays and a stored `season_count`. Filtering by
director and a *Christopher Nolan* page are joins, as comics' credits are
(data model 2.12), and a season total is a count of `seasons` rows (hard
rule 2). Corrected before 8.1 builds it (data model 2.20).

**Where to watch is in, as a dated snapshot** (D-74, reversing product § Watch's
*Out*). Availability moves monthly, so every value shows its date and
refreshes only when you ask. The original network or streamer, and the
studio, don't move, so they are columns.

**"Waiting for the next season" is a state of its own, `caught_up`.**
Without it, a show you are current on reads as *watched* and drops into Done,
or reads as *watching* when there is nothing to watch. It is derived from the
seasons and TMDB's *Returning Series*, never stored.

**Not every "shelf" is a shelf, and you make both kinds.** The owner's
examples are illustrations of groupings to create in the app, and they come in
two kinds. A group that is a fact about the work (a director's films, a
studio's, a network's: *Nolan*, *Disney Animated*, *DCOM*) is a **saved view**
(8.3), a named filter that keeps itself current. Where the filter misses a
title or catches one too many, you add or remove it by hand on that view, and
a view with no filter at all is simply a hand-picked list (owner: *in case
filters don't get what I want*). A group that is your opinion
(a loosely connected set, or anything in your own order) is a **shelf** (8.6),
now with notes. *Add these to a shelf…* copies a filter's titles onto a shelf
when you want the membership but your own order. Person pages (8.10) need no
creating.

**The recap (7.7) is worth building, with guard rails.** A model recapping a
popular series is good. For a less-known book it will confabulate with
confidence, and it can spoil the book you are starting. So the recap is
offered only when a gap of six months makes it useful, it covers only the
earlier books, it is grounded in their summaries and your notes, it is labelled
as Claude's, and it is stored so reopening it costs nothing. "Real time" means
it streams when you ask, never on a page render.

**Music is worth building, last** (D-75). The want-to-listen list and album
completion fit the ledger's shape: artist → album → track is the watch
hierarchy again. The song ranking is the novel part. Ranking 150 songs by
dragging is miserable, so the main tool is a *This or that* sorter, about
log₂ n picks per song, resumable. Which albums you favour falls out of the
ranking as a view. It comes after Watch, and it starts with design (9.0),
because a fourth medium changes the phone media bar every screen shares. Out:
playback, scrobbling, streaming-service sync.

**Parked under *Later*, because no API exists.** Marvel Unlimited (L-1) and
League of Comic Geeks ratings (L-2) have no public APIs. Each has an open
question that decides whether it can be built at all. Discovering editions
you don't own from Metron's reprint data (L-3) needs research first.

## Editing principles

*Since "edit everything" is most of the work.*

Full CRUD across 36 tables is a lot of forms. Three principles keep it small:

1. **Inline edit over modal forms.** Click the field, type, blur to save. No
   separate edit page for a run, no save button to hunt for.
2. **One create path per entity, reachable from where you noticed the gap.** Add
   a run from the run list. Add issues from the run page. Add a book from a
   shelf, the plan, or search when it returns nothing. Every add path is *search
   or type it*, and it creates the catalog row before the row that points at it
   (product § Requirement changes).
3. **Archive, don't delete.** A `deleted_at` column on runs, issues, and books.
   Hard deletes on a 10,000-row catalog you spent years assembling are a bad
   default, and cascading deletes from `runs` would silently take issues and
   prereq edges with them.

Editable surfaces, in build order:

| Order | What | Why first |
|---|---|---|
| 1 | Issue check-off, range marks, undo | Daily use |
| 2 | Bulk-add issues to a run | Unblocks everything else |
| 3 | Book status and finish date (task 1.5); rating in 3.4 | Daily use — "I finished a book" has to work in Phase 1 (R1-03) |
| 4 | Create/edit run, assign tracks, edit prereqs | The thing you do when planning |
| 5 | Reading plan: move a book between years/quarters | Quarterly |
| 6 | Top-books reorder | Annual |
| 7 | Events, tracks, shelves | Rare |

## Cut list

Ideas deliberately left out, so they don't creep back in unannounced. Each
says why. Watch's own in/out table is in [§ Watch](#watch).

### Product

- **Public sharing / profile pages.** You said just you. Adding read-only public
  routes doubles the auth surface for no gain you've asked for.
- **Recommendation engine.** You have 1,165 books queued and seven BookTube
  channels feeding you more. The bottleneck isn't finding books.
- **Social features, comments, follows.** No.
- **Mobile native app.** The PWA gets you the home-screen icon without an app
  store.
- **Music playback, scrobbling or streaming-service sync** (D-75). Music is a
  list of what to listen to and what you think of it, not a player or a
  listening history fed by another service.

- **Newly available on your services** (watch). It depends on a provider
  feed that goes stale, it changes weekly for reasons that have nothing to do
  with you, and it turns a personal list into a storefront (design §12).
- **A films-per-year target.** It would need a plan table, a runtime budget and
  a period model to answer a question nobody asked (design §11).

### Metrics

- **Streaks.** They reward consistency over enjoyment and turn a hobby into an
  obligation. You read 20 books in 2022 and 34 in 2024; neither is a failure.
- **Estimated completion date for the whole catalog.** A ~50-year number
  displayed daily is discouraging rather than informative.
- **Comparison to other readers.** Single-user app, and it's not a competition.
- **A catalog completion percentage for comics.** 76 of 10,138 is 0.75%, it will
  still be under 5% in 2031, and drawn as a bar it is a lie told with a
  rectangle. The figure survives once, in grey, on the Stats page as
  provenance (D-40 moved it off the comics dashboard). Progress is measured against
  the run and the block, where it is real.
- **Pace on the comics screen.** Any issues-per-week figure computed from 76
  issues is noise wearing a metric's clothes. The comics equivalent of pace is
  the frontier — what is reachable — because "how fast am I going" is not a
  question this data can answer honestly yet.
- **Pages or words per day.** Goes down when life happens and up when you have
  flu. Capacity against plan already answers the only question it gestures at.
- **This year versus last year at the same date.** The same fact as pace vs.
  plan in a competitive costume. The five-year mean is the steadier comparator
  and it is already on the screen.
- **Prerequisite graph depth.** 21 levels is the most impressive number in the
  dataset and it changes nothing. What matters is the closure size of the run in
  front of you, which is on its row.
- **Run tier as a dashboard sort.** A judgement you made once. Useful as a
  filter when browsing; on a dashboard it silently re-ranks your plan behind
  your back.
