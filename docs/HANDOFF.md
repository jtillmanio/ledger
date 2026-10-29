# Handoff — project context

**Read this first if you are picking this project up in a new conversation.**
Everything decided so far, why, and what's still open. Nothing else in the repo
assumes knowledge that isn't written down here.

---

## 1. Who and what

**Justin.** Site Reliability Engineer at Nationwide (insurance), Hilliard, Ohio.
Formerly a backend Java/Spring engineer and tech lead. Works in New Relic/NRQL,
SLO/SLI engineering, Resilience4j, Terraform.

**Development environment:** Windows PC, PowerShell. Android phone, used heavily
for the Claude app and as the primary device for the finished product. Uses
Claude Code for development.

**The project:** replace two Google Sheets — a comics reading tracker and a book
reading tracker — with a private web app reachable from anywhere, and add a
third media type from scratch: a film and TV watchlist. Single user now,
possibly a second reader (his wife) later.

**Preferences that shaped the deliverables:** separate documents per distinct
deliverable rather than one combined file; exhaustive structured output —
numbered lists, tables, full code files; professional voice favouring concrete,
metric-backed language over anything that reads as corporate or AI-generated.

---

## 2. The three media types

| | Comics | Books | Watch |
|---|---|---|---|
| **Source** | `Comics (4).xlsx`, migrated | `Books (1).xlsx`, migrated | None — starts empty |
| **Hierarchy** | Track → run → issue | Series → book | Franchise → title → season |
| **Hard part** | A 436-edge prerequisite graph, 21 levels deep (a DAG since the audit broke its cycles, D-20; 2.11a) | Word-count capacity planning | Nothing. It's deliberately the light one |
| **Metadata** | Metron (backfill, and live in Add issues) | Open Library (backfill, and live in Add books), Hardcover (backfill) | TMDB (live search) |

The watchlist reuses the comics shape one level shallower. **Franchise → title →
season is track → run → issue without the dependency graph** — same
derived-progress pattern, same check-off control, same detail layout. Nothing
new was invented for it.

### Migrated data

From the 2026-10-25 extract (`npm run extract -- --fail-on-cycle` on a fresh
download of both workbooks). Re-count from a fresh extract; never trust these.

| Comics | Count | Books | Count |
|---|---|---|---|
| Issues (distinct) / run placements | 10,131 / 10,754 | Books | 1,361 |
| Runs | 258 | Authors | 371 |
| Prereq edges | 436 (219 hard) | Series | 213 |
| Tracks | 37 | Statuses | 1,168 |
| Editions (trades) | 178 | Plan entries | 0 (the plan starts empty; R0-04) |
| Events | 29 | Wishlist / external lists | 497 / 534 |
| Issues already read | 76 | Releases | 25 |

**Readiness after the prerequisite audit** (task 2.11a, the 2026-10-25
extract). `npm run extract -- --fail-on-cycle` passes: 0 prereq cycles, and no
run appears in its own `run_ancestors()`, even on a walk without R2-04's
filter. Of the 258 runs (none placeholders), `run_readiness` has **173
blocked**, **45 ready_hard** (hard prereqs read, a soft one not) and **40
ready_all**. The five badges (`run_state`) are 173 blocked, 42 ready_hard,
40 ready_all, 2 reading and 1 read. Blocked stays high until the checklist's
hard → soft pass (`OWNER-CHECKLIST.md`): 219 of the 436 edges are still hard.

**Not migrated, confirmed out of scope:** `Ultimate Order`, `Ultimate
Collection`, `Sheet8`, `Reading Orders (old)`. `Master` is loaded as `editions`
but has no UI. The BookTube Top 10 tab is in `external_lists`, unsurfaced; the
old To-Read tab is `wishlist`, promoted into Someday by task 1.4d (D-39). The
Download and HP Fanfiction tabs load nothing. What every tab became, and what
cutover waits for, is `docs/cutover-parity.md` (1.25).

---

## 3. Why this was worth doing

The comics workbook stopped being a spreadsheet. `RUNS` → `Reading Orders` →
`PREREQS` is a three-table relational schema with foreign keys, simulated with
`COUNTIFS` and `SUMPRODUCT(--ISNUMBER(SEARCH(...)))`. The readiness state
machine is a dependency graph. Justin built a CLOSURE tab with Apps Script in
July 2026 to get transitive prerequisites and removed it as too much overhead —
in application code it's a 15-line recursive CTE.

Three other drivers: marking an issue read on a phone in a 10,800-row Sheets tab
is the worst UX in the current setup; the formula layer is already degrading
(Google-native `QUERY` and `ARRAYFORMULA` calls come through as
`__xludf.DUMMYFUNCTION` in the Excel export, so it's locked to Google Sheets
specifically); and the ten per-year book tabs are one table pivoted, so moving a
book between years is a cut-and-paste across sheets.

---

## 4. Architecture decisions

| Decision | Rationale |
|---|---|
| **Next.js 16 App Router, React 19, TypeScript** | Server components render the 641-issue Krakoa run without shipping it twice. Chosen over Spring Boot — familiarity doesn't pay for itself on a single-user CRUD app |
| **Postgres on Neon free tier** | Recursive CTEs, `FILTER`, array aggregation all load-bearing. Permanent free tier, ~0.5 GB against ~14k rows |
| **`postgres.js` with `prepare: false`** | Required for Neon's transaction-mode pooler |
| **Drizzle ORM, migrations in git** | `drizzle-kit generate` produces reviewable SQL |
| **Vercel Hobby** | Free, non-commercial personal use. Git push deploys |
| **HMAC-signed cookie, one shared passcode** | 40 lines. `currentUserId()` is the only seam; swapping in a real provider later changes nothing downstream |
| **Plain CSS with custom properties** | No build step, no utility-class churn |
| **Catalog and progress in separate tables** | Every progress table keyed `(user_id, entity_id)` from day one. Adding a second reader is an `INSERT`, not a migration |
| **One issue row per comic, placed into runs** | `issues` + `run_issues`. The sheet repeated an issue once per run; totals above a run now count it once (task 0.7) |
| **Read state is per run** | `issue_progress` keys on the placement. Reading an issue in one run leaves it unread in the others, and the spine says where it was read before. Reverses 0.7's read-everywhere (task 0.8, ARCHITECTURE 2.14) |
| **Add = search or type it, always a real row** | Metron / Open Library searched live from add flows only; freeform always available; catalog row created before the placement, shelf or plan row (ARCHITECTURE 2.15) |
| **Credits are rows; run credit lines are derived** | `creators` + `issue_credits` in six roles. `runs.writer`/`artists` dropped — the sheet's typed values are not trusted (task 0.7) |
| **Metadata lives in sidecar CSVs until cutover** | Keyed by label, `metron` or `hand` source, hand never overwritten; labels change only by accepted review. The database is rebuilt from workbook + sidecars (`npm run rebuild`) until `LEDGER_LIVE=true` |
| **Nothing derived is stored** | Readiness, percentages, rollups, capacity, show progress all live in `etl/views.sql` |
| **One pattern per media type** | Catalog table + per-user status table + append-only event log (`read_events`, `watch_events`). Learn it once |
| **Soft delete only** | A cascade from `runs` silently takes issues and prereq edges |
| **Typed shelves, not polymorphic** | `shelves.kind` plus `shelf_books` / `shelf_titles`. A polymorphic FK can't be enforced by the database |

**Table count: 28 today (task 0.3 added five), 40 once task 1.10 and Phase 8 land.**

### What each spreadsheet artifact became

| Sheet artifact | Replacement |
|---|---|
| `RUNS!Readiness` | `run_readiness` view |
| `RUNS!% Done`, `Completed`, `Left` | `run_progress` view |
| `TRACKS` tab | `track_progress` view |
| `DASHBOARD` ready-to-read query | `readyToRead()` in `src/db/queries.ts` |
| `CLOSURE` tab + Apps Script (removed July 2026) | `run_ancestors(run_id)`, recursive, cycle-safe, depth-capped at 48 |
| `Read 20XX` tabs | `books_by_year` view: reads per year, from `book_reads` (`read_events`, plus workbook reads with no log row) by `extract(year FROM finished_on)` (D-21, D-65) |
| `To-Read 20XX` tabs | Tabs before 2028: `reading_plan.period`, a bare year (`'2027'`), written only with `extract.py --with-plan`: the plan starts empty (D-13, task 1.7). Later tabs load nothing; their titles go to `seed/workbook_plans.csv`, which is not loaded (D-70) |
| `Series!Percent Read` | `series_progress` view |
| `Reading Orders!Track`, `Run Title` | Dropped — they were lookups; the join replaces them |
| `RUNS!Track` comma list | `run_tracks` many-to-many |
| `RUNS!Series (and Issues)`, `Start Year`, `End Year` | `run_span` view — from issue labels and `issues.cover_date` (task 0.6) |
| `RUNS!Why` | `runs.why` + `why_source`, redrafted and reviewed through `why_review.csv` |
| `RUNS!Writer`, `Artists` | `run_credit_line` view over `issue_credits` from Metron (task 0.7); typed values kept only as a comparison report |
| `Reading Orders` rows | `issues` (one per distinct label) + `run_issues` (one per row) (task 0.7) |
| — | `show_progress`, `franchise_progress` are the watchlist equivalents |

---

## 5. Data findings from the migration

These came out of analysing the real workbooks. Several are latent bugs in the
sheet that were invisible there.

### 5.1 The `Sequence` formula collides

`Reading Orders!Sequence` is `=IF($B2=$B1,F1+1,1)`, which restarts whenever a
run's rows are not contiguous. **1,058 issues** got renumbered on import.
Affects exactly three runs with split row blocks: `hickman-avengers`,
`bendis-initiative`, `bendis-secret-invasion`. The ETL renumbers from sheet row
order, which is the real reading order. Spot-check those three after load.

### 5.2 Volume-year ambiguity — resolved

**59 series** appeared both with and without a volume year. `Captain America #1`
matched eight volumes in the user's own data; `Avengers #1` matched six. Solved
with `etl/volumes.py`, which proposes rules, and a reviewed `volume_map.csv`
the ETL applies.

Rules match most-specific-first: run + issue range, then run, then range, then
series-wide. Final state: **67 approved rules across 61 series**, taking labels
carrying a volume year from **4,225 to 7,283** of 10,834, with **zero unmatched**.

Six series broke the naive "assume the initial volume" rule: Incredible Hulk
(vol 1 is only #1–6; the 1968 volume runs #102–474, so it splits at #102),
Secret Wars (bare #0–12 is Hickman's 2015, not the 1984 original), X-Men (#1–65
is 1963, #188–204 is legacy numbering on the 1991 volume), Venom (three volumes
with legacy numbering), Punisher, Wolverine.

### 5.3 Label format inconsistency — resolved

**11 labels** wrote the year after the issue number (`Daredevil Annual #1
(2007)`) rather than the canonical `Title (Year) #N`. The parser read them as
year-less, surfacing false ambiguities. `normalize_label()` in
`etl/extract.py` reorders them before anything else runs.

### 5.4 True unlock cost — the most decision-changing metric

The prereq graph is **21 levels deep** (2026-09-23 extract). The old claim that
**156 runs cost more than 3x their own size** was computed on the buggy,
cycle-inflated closure and is withdrawn with the figures below (R1-01); unlock
cost now counts unread issues (D-22).

| Run | Shows as | Prereq runs | True cost |
|---|---|---|---|
| Ewing — Defenders | 13 issues | — | **all four figures withdrawn (R1-01)** |
| Ewing — Immortal Thor | 45 issues | — | — |
| Ewing — Immortal Hulk | 64 issues | — | — |
| Spencer — Spider-Man | 92 issues | — | — |

All four rows sit inside or near the same 98-run cyclic component (R0-01), so
the 88/82/78 prereq counts above were that component showing through, not four
independent measurements — see FEATURES.md Part 2d for the current argument.
The real numbers wait on task 2.11. Inverse view: `claremont-xmen` directly blocks 13 runs,
`leekirby-ff` blocks 9, `hickman-secret-wars` blocks 7. Task 6.2b surfaces both;
`run_ancestors()` already exists, so it's a few hours of work.

### 5.5 Systematic over-planning

| Year | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| Books read | 33 | 20 | 29 | 34 | 30 |

A steady **~29/year**. The 2026–2030 plan averages **35/year** — about 27%
optimistic. Backlog is **1,130 unread books / 149.5M words**, roughly a 50-year
queue at current pace.

### 5.6 Smaller findings

- **Issues repeat across runs.** At the 2026-09-16 export, 10,835 `Reading Orders` rows held 10,285
  distinct labels; 426 raw labels sit in two to four runs. Now one issue row
  with several placements (task 0.7). 213 labels have a different `Type` in
  different runs, so type stays on the placement.
- **Metron's canonical labels differ from the sheet's** for about 3,500 of 8,159
  matched labels: ~2,325 lack only a volume year, ~1,012 differ in style (`The`,
  capitalization), ~123 one-shots lack `#1`, 11 carry subtitles or pasted notes.
  ~237 matched issues are dated more than two years outside their run's typed
  span — a wrong-volume signal, though many typed spans are themselves wrong.
  All proposed in `label_review.csv`.
- **44 Metron issues are matched by two sheet spellings** (`Pulse #1` / `The
  Pulse #1`), and **36 labels repeat inside one run**, several broken
  (`X-Men: Emperor Vulcan #` ×5).
- **The sheet's writers aren't trusted.** 157 of 259 runs had no artist; run
  credit lines now come from Metron issue credits. 11 runs have no Metron-matched
  issue at all, so they have no credit line until labels are fixed.

- **`EVENTS!Tracks Touched` was renamed to `Runs Touched`**, and its 64 cells now
  hold run IDs directly. Events point at runs; track associations are derived
  through `run_tracks` via the `event_tracks` view. Resolved — was previously
  26 cells read as unrecognized track names, before the sheet rename.
- **6 forward-declared prereq IDs** with no `RUNS` row — loaded as
  `placeholder = true` so edges survive.
- **`Amazing Spider-Man` and `The Amazing Spider-Man` — resolved.** Were both in
  use as of an earlier extract (137 and 100 bare labels, same series). A fresh
  2026-10-02 extract found no bare split left in the workbook — every label
  reads `The Amazing Spider-Man` today. The stale `volume_map.csv` row
  describing the bare split (task 0.5) has been removed.
- **`X-Men (vol. 2) #177–179` — resolved.** The three labels were year-less as
  of an earlier extract; a fresh 2026-10-02 extract found them already written
  as `X-Men (2004) #177-179`, Metron-matched. The stale `volume_map.csv` row
  (task 0.5) has been removed.
- **Typed run summaries had drifted from the reading orders.** `RUNS!Series
  (and Issues)` disagreed with the run's own issues in 212 of 259 runs, 30 runs
  had identical start and end years, and at least 21 ended before a volume in
  their own list began. All three are now derived (task 0.6). The same pass
  found `emperor-doom` and `triumph-and-torment` holding each other's graphic
  novel (fixed in the sheet) and about 14 runs whose labels name the wrong volume
  year — listed in `why_review.csv` and START-HERE Step 8c.
- **24 of 37 tracks** have never been started.
- Typos surfaced: *The Lightning Theif*, *Olypmians*, *Dreden Files*, and
  *Restoration of Faith* dated 2910.
- **No book API exposes word counts.** Goodreads never had it; Open Library and
  Google Books give page counts. Keep hand-entered values, estimate the rest at
  `pages × 275`, flag which is which in `books.word_count_source`.

---

## 6. Feature decisions

### Confirmed in scope

**Comics:** dashboard with in-progress runs and block position; run list with
readiness; per-run reading order with era sections; full editing; to-read list;
tracks page.
**Books:** dashboard; to-read at four levels — quarter, year, On deck, Someday
(D-37) — with word budgeting by year and quarter; searchable master list; top books per year; coming-out list; shelves.
**Watch:** search and add via TMDB; to-watch, watching, watched, dropped;
season-level progress; franchises; shelves; rewatch log.

### Added during review

| # | Feature | Why |
|---|---|---|
| 20 | Reading session tracking | The capacity engine currently rests on two typed numbers. Sessions let it compute real wpm and minutes/day |
| 21 | Quick-capture inbox | Zero-field jotting for "someone mentioned a run." Books had `wishlist`; comics had nothing |
| 22 | Re-read history (`read_events`) | Progress tables are one row per item, so a second read overwrites the first. **Must land before data accumulates** |
| 23 | Watchlist — film and TV (Phase 8) | Third media type, three levels. Seasons tracked, episodes not |
| 24 | Detail views for all media | Books, issues, runs, films, shows, seasons. Adds `books.summary`, `books.subjects`, `issues.story_arc` — fields the APIs already return and the app discards. Issue credits and story titles already exist (task 0.7) |
| — | True unlock cost (6.2b) | See 5.4 |
| — | Range marking, undo, bulk entry, dated log, resume pointer | Phase 1 daily-use essentials |

### Explicitly out of scope

- **Episode-level TV tracking** — 2–10 seasons per show is trackable; 200 episodes is a checkbox farm. `watch_events` takes a `season_id`, so episodes are additive if this judgment proves wrong
- **Streaming availability, Trakt sync, air-date reminders, watch-time budgeting**
- **Hover-preview detail** — considered and rejected. Hover doesn't exist on Android, the primary device, and a tooltip can't hold notes, history, or shelf membership
- ~~**Upcoming-issue tracking for ongoing comics**~~ — back in scope by D-35 (2026-09-30): tasks 5.7 (books coming out) and 5.8 (new issues in followed series)
- **Events page** — deferred to Phase 6; data is migrated
- **Streaks** — reward consistency over enjoyment; 20 books in 2022 and 34 in 2024 are both fine
- **Catalog completion date** — a 50-year number shown daily is discouraging
- **Public sharing, recommendation engine, social features, native app**

### Metadata APIs

| Source | Limits | Use for |
|---|---|---|
| **Metron** | 20/min, 5,000/day per IP | Comics issues, covers, dates, creators. Single-request issue lookup; Comic Vine needs a volume lookup first |
| Comic Vine | 1/sec, 200/hour | Fallback only |
| **Open Library** | No key | Book spine, page counts, covers, summary, subjects |
| Hardcover | 5,000/day, GraphQL | Series position |
| **TMDB** | ~40–50/sec, free non-commercial, **attribution required** | Films and TV. One API for both, which beat TVmaze (TV-only) and OMDb (thin on TV). `/tv/{id}` returns the whole seasons array in one call; `belongs_to_collection` seeds film franchises |

**The division that matters for comics:** Metron knows `Fantastic Four #570`
exists. It does not know that #570–588 plus `FF #1–23` is one Hickman run with a
soft dependency on Secret Warriors. Justin keeps authoring runs and prereqs; the
API fills in everything below the issue label.

**APIs are called live only from add flows.** TMDB is searched live because the
catalogue is 1.5M+ titles and there's no existing watch data to pre-seed from.
Responses cache into `titles` and `seasons` on first add, so detail views never
re-call. Since Sept 2026, Metron (Add issues) and Open Library (Add books) are
also searched live when the user submits a search, so an added item arrives
as a real record. No page render calls any API, and Hardcover stays
backfill-only.

### AI features (Phase 7)

Review a run's order, review a block or track, draft a new run, propose prereq
edges. **Non-negotiable: the model proposes, Metron verifies, the user
approves.** Every proposed label passes the bulk-entry parser and an existence
check. Unverified suggestions are shown and badged, never silently dropped or
accepted. Every proposal stored with prompt and raw response. Must come after
Phase 4 — without enrichment there's no verification layer.

---

## 7. Design decisions

Three revisions of `design/mockups.html`. The evolution matters because the
final direction was reached by correction.

**v1** — newsprint ledger. Hairline rules, one accent colour, austere.
**Rejected:** too plain, all grey text, no visual structure.

**v2** — added cover art. **Partially right** — covers were liked, but the
feedback clarified the real need was colour, clearer row divisions, and obvious
affordances, not imagery.

**v3, current** — the answer:

- **Grouped surfaces.** Rows live in bordered white cards on a grey page, with a
  header carrying a count. Dividers are inside the card, not floating.
- **Functional colour.** Track hues (Thor amber, X-Men violet, Hulk green,
  Street red, Avengers blue) appear as a row's left edge, in tags, in the filter
  dropdown. Genres reuse the same hues, but sidebar items get neutral icons (Sept 2026 audit): hue identifies data, never navigation. Status colours mean
  ready / blocked / reading / done / danger. Nothing is coloured decoratively.
- **Explicit affordances.** Filled primary buttons, outlined secondary, chevrons
  on navigable rows, visible drag handles, sticky bottom action bars.
- **The checkbox is a 20px circle** that fills green with a tick. It was 12px
  and too timid for the app's most-used control.
- **Light and dark themes**, phone (360–412px) and desktop layouts.
- Validation states are coloured tiles with glyphs (✓ ! ×), readable without
  relying on colour alone.

**40 screens mocked**, all annotated with reasoning. `design/mockups.html` is
authoritative — where a task description and the mockup disagree, the mockup
wins, because it's what was reviewed.

**v4, current** — the dashboards, reached by designing them from scratch
against a written brief rather than by editing v3. Three directions were drawn
(Launchpad, ranked by what you do next; Spine, position made spatial; Ledger,
everything priced) and the chosen answer is Launchpad's information order with
Spine's two spatial components dropped into it. Only the dashboard screens
changed; the other 21 are untouched.

- **One dashboard per medium.** `/` was a mixed "Saturday" home with a books
  pace card above a comics hero — two questions, neither answered. It is now
  `/comics`, `/books` and `/watch`, each with the same five slots in the same
  order, and `/` redirects to whichever you touched last. The list screens moved
  down a level.
- **The telescope** replaces the comics hero cover. Three rails — the track's
  blocks, the block's runs, the run's issues — with brackets from coarse to
  fine, so all three nested positions read at once. It restores the one thing
  the spreadsheet column did better than any app: seeing how far down a long
  ordered list you are. `block_position` and `block_progress` already compute
  every number it needs.
- **The plan rail** replaces the books capacity gauge as the second element. A
  quarter is a column, a book is a block sized by its word count, a dashed rule
  across all four is the 760k quarterly capacity, and anything above the rule is
  hatched. A fifth lane holds entries with a year and no quarter.
- **Amber, not red.** v3 turned the capacity number red past 100% and the
  quarter budge badges red when over. v4 reserves red for destructive actions
  and validation failures. Amber means *held* — a hard prereq unread, or a
  decision not yet made — and it clears when you decide, including when you
  decide to keep the overage. Accepting an over-committed year is a first-class,
  persisted outcome. A red state you see every day is a red state you stop
  seeing.
- **No progress bar against the catalog.** 76 of 10,138 drawn as a rectangle is
  a lie. The comics screen measures against the run and the block, and answers
  "what do I read next and what does it cost" with the frontier — N ready, N
  a soft prereq short, 24 tracks never opened, 11 owned and ready. The catalog
  total survives once, in grey, at the bottom.
- **Cost and leverage on the row.** "costs 44 · opens 2" instead of a tier
  badge. Tier is a judgement made once; cost is the decision being made now.
  Ewing — Defenders is on the mockup deliberately: a 13-issue run with a large
  unlock cost. The 4,642 figure is withdrawn (R1-01); the real one comes from
  `run_unlock_cost` after task 2.11 breaks the prereq cycles.
- **One thumb bar** at the bottom of every dashboard and the run detail, same
  position, same primary verb slot, 44px minimum.
- **Numbers reconciled.** v3 had a 240k quarterly budget next to a 3.04M annual
  capacity, and plan rows that did not sum to their quarter totals. Quarter
  capacity is 760k — 45 min a day at 185 wpm, quartered — and every figure on
  the dashboards adds up.
- **Three screens followed the dashboards.** The **run list** groups track →
  block and carries cost and leverage on the row instead of tier. The **plan
  page** is the plan rail at full size with titles legible inside the blocks,
  and only the quarter you are working on expands. **`/watch`** stopped being a
  list and became a dashboard with the same five slots; the list moved to
  `/watch/list`.
- **Every screen now has a desktop frame** — 25 of 25, where v3 had two. Desktop
  is not the phone stretched: a list gains a sticky rail, a form splits in two,
  a sheet becomes a centred dialogue over the page it came from.


### Specific UX decisions

| Decision | Answer |
|---|---|
| Blocked runs | *Hard*-blocked runs behind a *Show N hard-blocked* switch, **shown by default until task 2.11** (N is 173 on the 2026-10-25 extract, not 27 — R1-02), muted + amber `⊘ N runs first` badge. A `ready_hard` run is never hidden |
| Era headers | Break the spine into sections, each with its own progress bar and count |
| Volume year picked in bulk-add | Saved as that series' default going forward, switch on by default |
| Range marking | Prompts for a date: today / pick / spread across a range / no date. Single taps never prompt |
| Dashboard header | Pace vs plan, not raw totals |
| Dashboard count | One per medium — `/comics`, `/books`, `/watch`. `/` redirects to the last one touched |
| Three nested comic positions | Drawn as the telescope, not stated as three percentages |
| Over capacity | Amber, never red. Clears when a decision is made, including "accept" |
| Catch-up affordance | Rebalance sheet: push, drop, even out the quarters, or accept — four peers, one tap from the dashboard |
| Unquartered plan entries | A fifth lane on the plan rail, and one-tap-each bulk placement without leaving the dashboard |
| Planned year | Derived from the period, never stored beside it (ARCHITECTURE 2.9) |
| Run list grouping | **Track → block, always.** Blocks hold 4–6 runs, so 37 tracks do not become 37 walls. Settles open question 5 |
| Cost vs tier on a run row | Cost and leverage on the row; tier demoted to a sort option |
| `/watch` situation slot | What's reachable, like comics — not pace, like books. No watch plan and no time budget exist to measure pace against |
| `/watch` next-up | Five rows with film/TV and genre filters, in place of a period control. Choosing what to watch is a mood question, not a scheduling one |
| Eras vs blocks | An era is to a run what a block is to a track. Blocks are numbered with an optional name, eras are named (ARCHITECTURE 2.10) |
| Search | Grouped by type (Comics · Books · Watch), issue matches collapse to one row; `>` switches `Ctrl+K` to verbs |
| Run readiness | Five states, five badges: `⊘ blocked` amber, `○ ready_hard` green outline, `● ready_all`, `◐ reading`, `✓ read` |
| Telescope legibility | 14px (phone) / 16px (desktop) minimum cell, overflow folded into `+N` stubs, read state as segments (ARCHITECTURE §4) |
| Navigation chrome | One `Comics · Books · Watch` bar on every phone screen, no Home tab; a per-medium desktop sidebar with neutral icons and an Inbox |
| Accessibility floor | 4.5:1 text, 3:1 controls, 44px thumb bar, real buttons with names, one `h1` per page |
| Track filter | Multi-select dropdown, not chips |
| Moving a book between periods | A picker sheet, not drag. Year → quarter, or On deck or Someday, each year and quarter chip showing that period's word total, with a live preview that turns amber (never red) if it would go over |
| Detail presentation | **Intercepted routes.** A sheet over the list when arrived at from a list, a full page on direct load or refresh. Back button dismisses, URL is linkable. Runs keep a dedicated full page — too dense for a sheet |
| Watch granularity | **Seasons yes, episodes no.** Show state derived from `season_status` via `show_progress`, never stored — except `dropped`, the one stored show-level status |
| Franchises | One table, `parent_id` for one level of nesting (Star Wars → Mandalorian era). Films auto-populate from TMDB `belongs_to_collection`; cross-media franchises hand-curated |
| Franchise vs shelf | A franchise is a fact about the work; a shelf is your opinion. Separate concepts, separate tables |
| Shelves | Books and titles, never runs, never both at once |
| AI review scope | Run, block, or track via a switch |
| Read state across runs | **Per run** (Sept 2026). A grey *read in Hickman — FF* note on the spine row, never a green tick. The issue sheet lists every run and its state in each |
| Adding issues and books | *Search · Type it* on every add surface. Your catalog first, then Metron / Open Library. Always a real row |
| In flight / up next / done | One status screen per medium, the same three tabs on all three: `/comics/status`, `/books/status`, `/watch/status` |
| Comics up next | **An ordered queue of runs** (`run_queue`) — add, reorder, remove, no dates. On the comics dashboard as its next slot, and first in the Up next tab, ahead of ready-but-unqueued runs (ARCHITECTURE 2.16) |

---

## 8. Still open

**Settled 2026-09-20 (docs/review/decisions.md D-3): every default below is accepted.** Kept for the reasoning.

Six questions that changed code, none blocking:

1. ~~**Pace in books or words?**~~ **Answered in v4: words everywhere.** A 387k
   Way of Kings is three ordinary books of a quarter, and counting titles is why
   the plan reads as 27% over when it is often worse. Book counts survive only
   in the year rollup, where they are the unit you think in after the fact.
2. **Rating scale** — 5-star, 10-point, or just the top-10 ranking? *Default: ranking only.*
3. **Collapse finished eras** on runs over 100 issues? *Default: yes, with a count.*
4. **Top-books list** capped at 10 or open-ended? *Default: capped at 10.*
5. ~~**Run list with no track filter** — 37 groups or one flat list?~~
   **Answered in v4: grouped, track → block, always.** The dashboard's argument is
   that the block is the middle unit, and a list that grouped only by track would
   disagree with the screen you arrived from. Blocks hold four to six runs, so the
   nesting stays shallow.
6. **Franchise ordering default** — release or chronological? *Default: release.*

---

## 9. State of the repo

**For current task progress, what's built, and what's next, see
`docs/STATUS.md` — it's a rollup of `TASKS.md`'s checkboxes and is kept
current there, not here.** As of this writing: 4 of 81 tasks done, still in
Phase 0, task 0.8a (read state per run) is next and gates everything in
Phase 1.

**Documents:**

| File | Role |
|---|---|
| `START-HERE.md` | The linear runbook. Unzip to cutover, every command |
| `STATUS.md` | Current progress: task done/next, what's built, what's next |
| `CLAUDE-CODE.md` | Technique reference for driving Claude Code. Not a sequence |
| `HANDOFF.md` | This file |
| `FEATURES.md` | Scope, additions, APIs, metrics, schema additions |
| `TASKS.md` | 81 tasks in 9 phases, each with a pass/fail check |
| `design/mockups.html` | 40 annotated screens, authoritative for layout |
| `DIAGRAMS.md` | 13 Mermaid diagrams — ERDs, derived layer, runtime, pipelines, add flow |
| `ARCHITECTURE.md` | Why the schema looks like this |
| `CLAUDE.md` | Auto-loaded by Claude Code each session |

---

## 10. How to resume in a new conversation

Attach the zip and say:

> I'm building a personal reading and watching tracker to replace two Google
> Sheets. Read STATUS.md for where things stand, HANDOFF.md for full context,
> then START-HERE.md for where I am. I'm on step N.

The two workbook exports (`Comics.xlsx`, `Books.xlsx`) are **not** in the zip —
they hold the full library and are regenerated from Google Sheets whenever
needed.

**The three things most likely to be forgotten and most costly to get wrong:**

1. **Task 1.5 (`read_events`) must land before real reading data accumulates.**
   A second read currently overwrites the first, and that history cannot be
   reconstructed. The same applies to `watch_events` in Phase 8. Task 0.8
   (per-run read state) goes before it, because `read_events` keys comics on the
   placement.
2. **Do not cut over from Sheets before Phase 1 finishes.** Bulk entry has to
   exist, or adding a run is slower than the spreadsheet and the migration was
   wasted effort.
3. **Never let a deploy auto-migrate.** Vercel builds on every push, and there
   is no undo. Migrations reach the live database only through the Release
   workflow, started by hand after a merge (START-HERE Step 13). A preview
   build migrates its own throwaway Neon branch, never live (10f).
