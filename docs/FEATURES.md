# Features

Your list, plus what it implies, plus what's missing. Priority order within each
section. Nothing here is built yet except where marked **shipped**.

---

## Part 1 — Your list, with what each one actually needs

### Books

| # | Feature | Status | What it needs beyond v1 |
|---|---|---|---|
| B1 | Dashboard | new | Currently-reading, pace-vs-plan for the year, next up, upcoming releases, genre mix. Design below |
| B2 | To Read by year and quarter, with word-count budgeting | partial | `reading_plan.planned_quarter` exists; task 1.7 makes one period column with four to-read levels — quarter, year, On deck, Someday (D-37) — and no months (D-38); needs the pace engine |
| B3 | To-Read master list, searchable | shipped | Search works; needs sort by word count, filter by series-completeness. TASKS 6.10 |
| B4 | Top books per year, editable | partial | `book_status.year_rank` holds the data, but from TASKS 1.13 the workbook's ranks don't load (no workbook read state, D-41); re-entered through 3.4's reorder, with the ranks kept in `seed/workbook_reads.csv` |
| B5 | Coming out list | shipped | Needs "notify me" and a calendar view. Task 5.7 (D-35): *Out now* plus a month-grouped list, notified in the app; comics get the same in 5.8 |
| B6 | Tracked series and authors with progress | partial | `series_progress` view exists; TASKS 5.9 draws it as `/books/series`. TASKS 1.15 adds universes (`book_universes`, a fact about the work, D-42), `author_progress` / `universe_progress`, and a stored `tracking` / `reading` follow per series, author or universe (D-43), seeded from the Series tab. Arbitrary groupings are shelves (5.1) |
| — | BookTube top 10, Download, HP Fanfiction | migrated, unsurfaced | Data is in `external_lists` and `wishlist`. No pages. Leave `external_lists`; `wishlist` is promoted into Someday (task 1.4d, D-39) |
| B7 | Series, authors, universes and reading-order shelves I'm in the middle of | planned | Derived from the progress views plus a `shelf_progress` view; authors only when followed. A group on 1.9's In flight tab. TASKS 5.12 (Part 2j) |
| B8 | Date started and finished | partial | The finish is a date since 1.5. The start is new: `started_on` with its precision on `book_status` and `read_events`. TASKS 1.17, before cutover |
| B9 | Import metadata from Calibre | planned | Word counts (Count Pages, `stated`), series and index and ISBN checked against Open Library and Hardcover, tags and summary, reads through a review (D-73). TASKS 1.18, before cutover |
| B10 | Books read each year, and a log of what I read | partial | Year totals ship (`books_by_year`, the year chips); 6.2 charts them; `/activity` is the log. TASKS 6.17 |
| B11 | Add books: title and author as two fields | partial | *By hand* has them. *Paste a list* gains a tab-separated form and a review with separate cells. TASKS 1.4e |
| B12 | Series are links | planned | Every series name links to `/books/series/[id]`, which lists the books in order, with gaps. TASKS 5.9 |
| B13 | Year chip: the count reads apart from the year | bug | TASKS 1.5b |
| B14 | *Catch me up*: a recap of the earlier books before a later one | planned | Claude, on demand, spoiler-bounded, stored in `proposals`. TASKS 7.7 |
| B15 | A shelf's context: why each book is on it | planned | `shelves.description`, `shelf_books.note`; ordered shelves are reading orders (the Dark Tower). TASKS 5.1 |

### Comics

| # | Feature | Status | What it needs beyond v1 |
|---|---|---|---|
| C1 | Dashboard: reading now, block position, issues left, next up | partial | Block position is ready — `blocks` and the `block_position` view landed early; "next up" still needs a resume pointer |
| C2 | Full run list with readiness, plus add new | partial | List and readiness shipped; no create/edit |
| C3 | Reading order page per run | shipped | The spine view |
| C3a | Ordinal gutter on spine rows | planned | The placement's ordinal (`42`) before the tick, matching the head pill `42 / 381 · #141`; in the row's accessible name; the scrub target. TASKS 3.6b, STYLE_GUIDE §5.1 |
| C3b | Hide read, per run | planned | Hides rows read in this run (rows read elsewhere stay); a `+N read · Show` stub per hidden stretch; remembered per run, storage to decide. Needs per-placement read state (0.8a, done). TASKS 3.6c |
| C3c | Real covers on spine rows | planned | `issues.cover_url` (Metron) in a fixed 28×42 box, with the text fallback, lazy loading, and a reduced-data path and a *Show covers* setting. TASKS 4.3 |
| C3d | Release date per row | planned | `issues.cover_date` as a grey desktop column; phone rows leave it to the issue sheet, which also gains the publication date (a new column, to be approved); an opt-in per-run caption for runs not in publication order. TASKS 3.6b, 3.5 |
| C3e | Next issue in the run hero | planned | A tonal strip above *Resume #141*: cover, label and the placement's note. TASKS 1.6 |
| C4 | Edit everything | not built | The largest single chunk of remaining work. See Part 3; blocks are TASKS 3.8, the volume map 3.9 |
| C5 | To-read list | shipped | On the dashboard as "Start next" |
| C6 | Events and tracks tracking | partial | Views exist, no pages |
| — | Ultimate Order, Ultimate Collection, Master, Sheet8 | out | Not migrated. `Master` is loaded as `editions`; TASKS 5.10 surfaces it (collected and read) |
| C7 | A run's date started and finished | planned | Derived: `run_state.started_at` beside `finished_at`, from the run's own dated reads. TASKS 1.17 |
| C8 | Collected in: omnibus or trade? | planned | *Collected in* on the run page, from `edition_issues` and `editions.book_type`. TASKS 5.6, 5.10; discovering editions you haven't listed is Later § L-3 |
| C9 | Series view, with gaps | planned | `/comics/series/[key]`: every issue of a volume, the runs that place it, read state per run, gap stubs. TASKS 5.13 |
| C10 | Add many issues of one series at once | planned | A series browser in Add issues: the whole volume from Metron's issue list, check a range, then 1.3c's review. TASKS 3.10 |
| C11 | Other publishers (DC, Image: Walking Dead, Invincible) | ready | Nothing is Marvel-specific except `tracks.publisher`'s default. 3.2 creates a track with a publisher; 3.10's check runs a non-Marvel volume |
| C12 | Other providers: Marvel Unlimited, League of Comic Geeks ratings | later | No public APIs. TASKS *Later* § L-1, L-2 |
| C13 | Context for a run's important issues | planned | The fact is Metron's summary (`issues.summary`, 4.1). Why it is in *this* run is the placement note, which Claude drafts and you accept (7.8) |
| C14 | Search results preview an issue | planned | A *Details* disclosure: tap, or hover with a fine pointer. One Metron detail request, cached. TASKS 3.12 |
| C15 | Arrange issues as you add them | planned | An *Arrange* step in the review: drag, menu or keyboard. It doubles as the run's reorder. TASKS 3.11 |

### Watch (2026-10-20 additions)

| # | Feature | Status | What it needs |
|---|---|---|---|
| W1 | Metadata that shows and filters: network or streamer, studio, director, cast, length, seasons and episodes, genre | planned | `titles.networks`, `titles.studios`, `people` + `title_credits` rows, totals derived in `show_progress`. TASKS 8.1, 8.3 |
| W2 | Where to watch | planned | Reverses Part 2e's *Out* (D-74). A dated TMDB/JustWatch snapshot, refreshed when you ask. TASKS 8.9 |
| W3 | Which show I'm on, what I've finished, a rating; waiting for a new season | partial | Season tracking was already designed. Adds a show-level rating and the derived `caught_up` state. TASKS 8.1, 8.8, 8.9 |
| W4 | Custom shelves (Nolan, Spielberg, Disney Animated, DCOM, loose groups) | planned | Title shelves (8.6) with notes, for loose groups; person pages (8.10) and the studio filter (8.3), for the ones that are facts |

### Music (2026-10-20 additions)

| # | Feature | Status | What it needs |
|---|---|---|---|
| M1 | Artists I want to listen to | planned | `artist_follows` (*want · listening*). TASKS 9.1, 9.2 |
| M2 | Albums to listen to, from those artists | planned | The discography from MusicBrainz, studio albums by default; `album_status`, `listen_events`. TASKS 9.2, 9.3 |
| M3 | Rank each song for some artists, and see which albums I favour | planned | A stored order built with a *This or that* sorter; album favourites derived. TASKS 9.4, 9.5 |

---

## Part 2 — What you didn't list and probably want

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
drifting further. Full rule table in TASKS.md 1.3, pipeline in DIAGRAMS.md §6.

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
as an author, TASKS 1.15. Shelves stay for free-form lists like the HP fanfic
one.)*

**10. Stats / year in review.** Books and issues per year, words read, genre mix,
longest run finished, series closed out. Depends on #4.

**11. DNF as a real status.** Already in the enum, needs UI and a reason field.

**12. Which trade collects this issue.** You have 178 editions with issue ranges
as text. Parsing `"Avengers #500-503 and Avengers Finale"` into an
`edition_issues` join means the run page can tell you what to actually buy or
pull off the shelf. Parsing is fiddly but one-time.

### Tier 3 — worth it once the basics land

**13. Cover art**, from the APIs in Part 4. Turns a list of strings into something
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

### Deliberately not recommended

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


---

## Part 2b — Confirmed additions (Sept 2026 review)

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

---

## Part 2c — Per-screen refinements

Small things, ordered by how often you'd feel their absence.

### Everywhere
- **Empty states that offer an action**, never a bare "nothing here." Already
  done on Q3 of the plan page; needs to be the rule. Each has exactly one
  primary action:

  | Surface | Empty state |
  |---|---|
  | Comics telescope, no run in flight | Track rail only, with **Start the top of Up next** |
  | Comics Up next, queue empty | **Pick from N ready runs** (computed, D-7), top three rows each with **+ Up next** |
  | Books *Reading now*, nothing reading | **Start the first Q-current book** |
  | Status tabs | One primary action per medium and tab |
  | Watch, first run | A full-width TMDB search with three example queries and attribution — never "no items" (Part 2e) |
- **Offline indicator.** You read on a tablet and phone; a silently failed
  write is the worst outcome. Queue and show it: a sync pill
  (`online · offline · queued`, `role="status"`, `aria-live="polite"`) in the
  desktop sidebar footer and the phone header, reading e.g. *Offline · 3 marks
  queued*.
- **Loading.** The first Neon request after idle takes about a second. Show
  skeletons with the same dimensions as the loaded telecard, run rows, plan rail
  and season rows, so nothing shifts when data lands; the shimmer is off under
  `prefers-reduced-motion`.
- **Live-API states.** A Metron, TMDB or Open Library search shows *loading*,
  *rate-limited* (with the `Retry-After` countdown) and *error* lines, each
  `role="status"` and each offering **Type it instead**, so a stalled add is
  never silent and a retry does not hit the 20-requests-a-minute limit.
- **Metadata pending.** A freeform issue or book starts thin. Wherever it renders
  (spine, master list, book detail) the cover has a dashed outline and the row
  says *metadata pending* until backfill fills it in.
- **"Since you were last here"** line on the dashboard — issues marked, books
  finished, anything that changed — plus the inbox count chip.
- **The accessibility floor.** Body and hint text is at least 4.5:1 and UI
  control outlines at least 3:1 in both themes (`--faint` is text-safe;
  `--faint-deco` is for rules only). Touch targets are 44px on the thumb bar and
  icon buttons, and at least 24px anywhere else (WCAG 2.5.8). Every control is a
  real `<button>` or `<a href>` with a name; nothing relies on colour alone, so
  every readiness badge carries a glyph and text. Each page has one `<h1>`.
- **Phone navigation is one bar.** `Ledger · Comics · Books · Watch` plus the
  search icon on every screen, current medium marked with `aria-current`. There
  is no Home tab because `/` is a redirect. On desktop the sidebar lists, per
  medium, *Dashboard · Status · list · Add*, plus Runs and Tracks for comics,
  Plan, Shelves and Top for books, and Franchises for watch, with a global
  `Inbox (N)`. Sidebar icons are neutral; hue is reserved for data.

### Run list
- **Sort control**, not just filters: by issue count, start year, tier, or
  unlock leverage (see Part 2d).
- **Sticky group headers** while scrolling a long track.
- **Remaining, not just total**, on partially-read runs — "108 left" beats
  "11/25" when you're deciding what to pick up.
- **The blocked switch says what it hides.** *Show N hard-blocked* hides
  `blocked` runs only. A `ready_hard` run (all hard prerequisites read, a soft
  one unread) is reachable and never hidden by it.
- **Saved views.** A toolbar row of named views above the controls — *Ready ·
  owned · under 60 issues · X-Men or Thor* — each just a stored URL, plus *Save
  view* in the desktop filter rail. The master list gets the same.
- **Density.** Settings → Appearance: *Comfortable / Compact* (desktop only,
  32px rows against the phone's 48px).

### Run detail
- **Eras are drawn but not stored.** The mockup sections the spine into named
  eras with their own counts; nothing in the workbook or the ETL produces them.
  They become a table shaped like `blocks` (ARCHITECTURE 2.10) and get typed by
  hand or proposed by task 7.3. Until a run has them, the spine is flat, which
  is the correct default rather than an empty state.
- **Era jump chips** at the top that scroll to a section, sticky under the hero,
  each with its read count (*Phoenix ✓ · DoFP 4/22 · Brood 0/19*). 381 issues is
  a lot of thumb travel. On the 641-issue Krakoa run add a **minimap** at the
  right edge (in the desktop rail): era boundaries, green read stretches and
  grey dashed *read elsewhere* ticks, so the next decision is visible without
  scrolling 300 rows.
- **Collapse finished eras** by default on runs over ~100 issues, with a count.
  The header is a button (`aria-expanded`, chevron) reading *38 / 38 · all read ·
  Show*; a collapsed era is a real state, not just a missing list.
- **The read control has a name.** Each row's circle is
  `<button aria-pressed aria-label="Mark Uncanny X-Men #141 read in this run">`.
- **The grey hint appears only where it helps.** *read in …* shows on rows
  unread here; on a row already read here it is hidden, so it does not spend
  attention where no decision remains. A trailing `+2` is a button that opens
  the issue sheet with the full list.
- **Adopt prior reads.** When unread placements have reads elsewhere the hero
  offers *Adopt 9 prior reads*: an explicit, previewed, undoable action on this
  run, keeping the original dates. It opens the range sheet in *Original dates*
  mode. Nothing ticks them for you.
- **Thumb bar order.** `Mark #141 read` (primary) · `Mark through…` · `+`
  (add issues) — the same primary slot as the dashboard.
- **Estimated time to finish** from your real reading rate — "about 6 weeks at
  your pace" is more decision-useful than "339 issues left."
- **Copy issue list** as plain text, for pasting into a shop pull-list or search.
  From the hero's `⋯` menu: *Copy unread (339) · Copy all · Copy as ranges*,
  confirmed by a toast.

### Bulk add
- **Remember the last run** you added to, so consecutive adds don't re-navigate.
- **Preview the resulting order** — show where the new issues land relative to
  existing ones before committing: three existing rows above and below the
  insertion point, the new rows highlighted, and an *Insert after* picker. The
  same preview sits on the search half of Add issues.
- **The count is the real insert.** The header and the button both count what
  will be written (*9 will be added* for a paste that expands to 10 with one
  already in the run), never the raw line count.

### Master list
- **"Pick one for me"** — a random or weighted suggestion from the current
  filter. With 1,130 unread books, choosing is the actual bottleneck.
  Shown as one highlighted row with *Another* and *Plan for…*; a `Pick one`
  button in the list controls.
- **"Fits my remaining budget"** filter — surface only books that fit the
  current quarter's leftover word capacity.
  A chip in the controls (*Fits Q2 · 56k*).
- **A row is a summary, not a page.** Its full record opens as the detail sheet
  (Part 2f). DNF, when chosen, is grey: stopping a book is not destructive.

### Plan
- **Auto-balance** — redistribute an over-capacity year across its quarters in
  one action, rather than moving books one at a time.
- **Running year total** at the top, not just per-quarter.
- **Estimated counts look estimated.** About 29% of 2027's words are
  estimated at pages × 275. Those blocks get a dotted top edge and a `~` prefix
  (`~65k`), with a legend tag, on the rail, plan rows, master list and book
  detail. A stated count is solid.
- **Every rail block is a tap target.** Blocks are proportional in height but
  each is a `<button>` with a name (*Piranesi, 65k words, estimated, Q1 2027*)
  and at least a 24px hit area; runs of sub-24px blocks merge into a `+3 · 180k`
  stack button that opens a list sheet.
- **No month view** (D-38). A quarter is the plan's finest grain: no month
  toggle, month columns or monthly capacity.
- **Desktop drag.** Dragging a block between quarters shows a ghost and a live
  readout (*Q3 +118k → 533k / 760k*) before release. The Move sheet stays the
  keyboard and phone route.

### Shelves
- **Next three unread**, not just the next one. Useful when the next one isn't
  what you're in the mood for.

### Settings
- **Recalculate from sessions** button once #20 exists, so the pace figures
  stop being a guess.
- **Real controls.** The minutes-a-day stepper is a group of two labelled
  buttons around an `<output>`; switches are `role="switch"`. The volume map
  reads *67 rules · 61 series*.

---

## Part 2d — Metrics worth building

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

### Deliberately not building

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


---

## Part 2e — Watchlist: film and television

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

Show-level progress is computed from seasons, exactly as run progress is
computed from issues. A show is `watching` when some seasons are watched and
others aren't; `watched` when all are. Nothing about show status is stored —
`show_progress` is a view.

**Dropped is the one exception, and it is stored narrowly.** Abandoning a show
must not leave it in *watching* forever. A `title_status` row with
`kind = 'tv'` and `status = 'dropped'` is allowed, and `show_progress` checks it
first, so `state` can be `unknown | to_watch | watching | watched | dropped`.
Dropped shows and films sit under *Stopped* at the foot of Done, with a grey
`dropped` badge. Nothing else is ever written at show level.

### API

**TMDB.** One source for films and shows, which decided it — TVmaze is TV-only,
OMDb is thin on television. Free for non-commercial use, ~40–50 requests per
second, hosted posters. Requires a key and **attribution in the UI**.

| Endpoint | Used for |
|---|---|
| `/search/multi` | One search box across films and shows |
| `/movie/{id}`, `/tv/{id}` | Detail. `/tv/{id}` returns the full seasons array in one call |
| `/tv/{id}/season/{n}` | Season overview and episode count, only if the summary array is thin |
| `/collection/{id}` | Film collections — auto-populates franchises |
| `/configuration` | Image base URLs, fetched once and cached |

**One call per show gets you its seasons.** `/tv/{id}` includes a `seasons`
array with number, name, episode count, air date, and poster, so adding a show
populates its whole season list without N further requests.

Unlike Metron and Open Library, TMDB is **called live during search** — the
catalogue is 1.5M+ titles and there's nothing to pre-seed from. Detail is
cached into `titles` and `seasons` on first add.

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

## Part 2f — Detail: a sheet, not a page (and not a hover)

**This reverses an earlier decision.** During the v2 mockup review the answer was
"no book detail page right now." Later is now, and it extends to all media.

### Why not hover

Hover doesn't exist on Android, and that's the device this app is mostly used
on. A hover preview would give the desktop a feature the phone can't have, and
leave the phone with nothing — backwards, given where the reading actually
happens. It also can't hold the content that justifies a detail view in the
first place: notes, reread history, shelf membership, edition mapping.

### What to build instead: an intercepted route

Tap a row and detail opens as a **sheet over the list** — a bottom sheet on
phone, a centred modal on desktop. The list stays behind it, scroll position
intact. Dismiss by dragging down, tapping outside, or pressing back.

The trick is that it's **a real route, not a modal component.** Next.js
intercepting routes render `/books/[id]` as a sheet when you arrive from the
list, and as a full page when you land on it directly:

```
src/app/
  books/
    page.tsx                  the master list
    [id]/page.tsx             full page — direct link, refresh, new tab
  @modal/
    (.)books/[id]/page.tsx    the sheet — same component, sheet chrome
```

This gets three things a modal component cannot:

1. **The back button dismisses it.** Which is what a phone user will press.
2. **It's linkable.** `/books/abc` works pasted into a note or opened cold.
3. **Refresh doesn't lose you.** You get the full page, not the list.

Same pattern for `/comics/[runId]/[issueId]` and `/watch/[id]`. Runs keep a
full page of their own — they're too dense for a sheet and you navigate to them
deliberately.

### What each detail view shows

| Media | Content |
|---|---|
| **Book** | Cover, summary, author, series and position (a link to the series page), genre, year, page count, word count with `stated`/`estimated` flag, status, start and finish date (1.17), rating, notes, shelves with each shelf's note, plan placement, reread history |
| **Issue** | Cover, series (a link to the series page, 5.13), cover date, story title, summary (4.1), credits by role, story arc, every run that places it with its position, **its read state in that run** (Part 2i) and the placement's note (7.8), which editions collect it |
| **Run** | Full page. Era list, writers and artists derived from issue credits (`run_credit_line`), `why`, true unlock cost, prerequisite chain, collecting editions |
| **Film** | Poster, overview, genres, year, runtime, studio, director, top cast (each a link to the person page), where to watch with its date, status, watch date, rating, notes, franchise, shelves, rewatch history |
| **Show** | The above with network or streamer in place of studio and creator in place of director, plus **a season list with per-season status**, season and episode totals, derived show progress (with *waiting for a new season*), the next unwatched season, and a show-level rating |
| **Season** | Poster, overview, episode count, air year, status, watch date, rating, notes |
| **Franchise** | Every film and show in it, in release or chronological order, with combined progress |

### What this changes

1. **`books` needs `summary` and `subjects`** — Open Library returns both and
   the app currently discards them. `subjects` is a better genre source than the
   single hand-entered value.
2. **The master list keeps inline status editing.** The sheet is for reading
   about an item; the list row is the fastest path to marking it read. Both
   exist and don't compete.
3. **One layout across all media** — hero, About, Details, Your record, History.
   Learn it once.

### Shelves become multi-media

Shelves were narrowed to books-only in the v3 review. They now cover films and
shows too, but **not** by reintroducing a polymorphic item table.
`shelves.kind` is `books` or `titles`, with `shelf_books` and `shelf_titles`
each carrying a real foreign key. A shelf holds one media type.

**Shelves and franchises are different things.** A franchise is a fact about the
work — Andor is Star Wars whether you like it or not. A shelf is your opinion —
"comfort rewatches", "things I own on disc". Franchises come from TMDB and
curation; shelves are purely yours.

## Part 2g — Schema additions for watchlist and detail

*Amended 2026-10-20 (Part 2j; ARCHITECTURE 2.20; D-74), before 8.1 builds
any of it:* credits are rows (`people`, `title_credits`), not arrays; season
and episode totals are derived, so `season_count` is gone; `networks`,
`studios` and `tmdb_status` are added; a show's `title_status` row holds a
rating and notes with a NULL or `dropped` status; `title_providers` (8.9)
holds where to watch; shelves gain a description and per-item notes (5.1).
Each column is still asked about at its task's plan gate.

```sql
-- Films and shows. One row per title; seasons live below.
CREATE TABLE titles (
  id            text PRIMARY KEY,          -- 'movie-27205', 'tv-1396'
  tmdb_id       int  NOT NULL,
  kind          text NOT NULL,             -- movie | tv
  name          text NOT NULL,
  overview      text,
  release_year  int,
  runtime       int,                       -- minutes: a film, or a show's typical episode
  tmdb_status   text,                      -- Returning Series | Ended | Canceled | In Production
  genres        text[],
  networks      text[],                    -- TV: original network or streamer (HBO, Netflix)
  studios       text[],                    -- production companies
  poster_url    text,
  backdrop_url  text,
  imdb_id       text,
  tmdb_collection_id int,                  -- films: belongs_to_collection
  fetched_at    timestamptz,
  deleted_at    timestamptz,
  UNIQUE (tmdb_id, kind)
);

-- People and credits, as comics' creators and issue_credits (ARCHITECTURE 2.12).
CREATE TABLE people (
  id       text PRIMARY KEY,               -- 'person-525'
  tmdb_id  int  NOT NULL UNIQUE,
  name     text NOT NULL
);
CREATE TABLE title_credits (
  title_id  text NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  person_id text NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role      text NOT NULL CHECK (role IN ('director', 'creator', 'cast')),
  ordinal   int,                           -- billing order; cast capped at ten
  PRIMARY KEY (title_id, person_id, role)
);

-- Where to watch: a dated snapshot, refreshed only when asked (8.9, D-74).
-- Rebuildable third-party data with a date on it.
CREATE TABLE title_providers (
  title_id   text NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  region     text NOT NULL DEFAULT 'US',
  provider   text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('flatrate', 'free', 'ads', 'rent', 'buy')),
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (title_id, region, provider, kind)
);

-- Seasons. Populated from the /tv/{id} seasons array in one call.
-- This is to titles what issues are to runs.
CREATE TABLE seasons (
  id            text PRIMARY KEY,          -- 'tv-1396-s2'
  title_id      text NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season_number int  NOT NULL,
  name          text,                      -- "Season 2", or a named season
  episode_count int,
  air_year      int,
  overview      text,
  poster_url    text,
  UNIQUE (title_id, season_number)
);

-- Franchises and series. parent_id gives one level of nesting:
-- Star Wars -> The Mandalorian era -> titles.
CREATE TABLE franchises (
  id        text PRIMARY KEY,
  name      text NOT NULL,
  parent_id text REFERENCES franchises(id),
  tmdb_collection_id int,                  -- set when auto-created from TMDB
  poster_url text,
  note      text
);
CREATE TABLE franchise_titles (
  franchise_id text REFERENCES franchises(id) ON DELETE CASCADE,
  title_id     text REFERENCES titles(id) ON DELETE CASCADE,
  release_ordinal    int,                  -- release order
  chronology_ordinal int,                  -- in-universe order, optional
  PRIMARY KEY (franchise_id, title_id)
);

-- Status at whichever level you track. A film gets a title row; a show
-- usually gets season rows and derives its own state from them. A show's
-- row holds only its rating and notes, with status NULL or 'dropped'.
CREATE TABLE title_status (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id   text NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  status     text,                       -- film: to_watch|watching|watched|dropped; show: NULL|dropped
  watched_on date,
  rating     double precision,
  notes      text,
  PRIMARY KEY (user_id, title_id)
);
CREATE TABLE season_status (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  season_id  text NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'to_watch',
  watched_on date,
  rating     double precision,
  notes      text,
  PRIMARY KEY (user_id, season_id)
);

-- The log. Same pattern as read_events: rewatches append, never overwrite.
CREATE TABLE watch_events (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_id   text REFERENCES titles(id) ON DELETE CASCADE,
  season_id  text REFERENCES seasons(id) ON DELETE CASCADE,
  watched_on date,
  rewatch_of int REFERENCES watch_events(id),
  note       text,
  CHECK (num_nonnulls(title_id, season_id) = 1)
);

-- Shelves gain a kind; items split into two typed tables.
ALTER TABLE shelves ADD COLUMN kind text NOT NULL DEFAULT 'books';  -- books | titles
ALTER TABLE shelf_items RENAME TO shelf_books;
CREATE TABLE shelf_titles (
  shelf_id text REFERENCES shelves(id) ON DELETE CASCADE,
  title_id text REFERENCES titles(id) ON DELETE CASCADE,
  ordinal  int,
  note     text,                         -- why it is on the shelf (5.1, 8.6)
  PRIMARY KEY (shelf_id, title_id)
);
-- Shelf context (5.1): ALTER TABLE shelves ADD COLUMN description text;
--                      ALTER TABLE shelf_books ADD COLUMN note text;

-- Detail fields the APIs already return and we currently discard.
ALTER TABLE books  ADD COLUMN summary text;
ALTER TABLE books  ADD COLUMN subjects text[];
ALTER TABLE issues ADD COLUMN story_arc text;
-- Issue credits and story titles are not here: they landed as tables and
-- columns in migration 0003 (task 0.7) — creators, issue_credits,
-- issues.story_title — rather than an issues.creators text[].
```

### Views

Show progress is derived from seasons, exactly as `run_progress` is derived
from issues. Nothing about it is stored.

```sql
CREATE OR REPLACE VIEW show_progress AS
SELECT
  u.id AS user_id,
  t.id AS title_id,
  COUNT(s.id)                                          AS total_seasons,
  SUM(s.episode_count)                                 AS total_episodes,
  COUNT(*) FILTER (WHERE ss.status = 'watched')        AS watched_seasons,
  MIN(s.season_number) FILTER (
    WHERE ss.status IS DISTINCT FROM 'watched'
  )                                                    AS next_season,
  -- 8.1 also reads a 'dropped' title_status row first (ARCHITECTURE 2.5b).
  CASE WHEN COUNT(s.id) = 0                            THEN 'unknown'
       WHEN COUNT(*) FILTER (WHERE ss.status='watched') = 0 THEN 'to_watch'
       WHEN COUNT(*) FILTER (WHERE ss.status='watched') = COUNT(s.id)
            AND t.tmdb_status = 'Returning Series'     THEN 'caught_up'
       WHEN COUNT(*) FILTER (WHERE ss.status='watched') = COUNT(s.id) THEN 'watched'
       ELSE 'watching' END                             AS state
FROM titles t
CROSS JOIN users u
LEFT JOIN seasons s        ON s.title_id = t.id
LEFT JOIN season_status ss ON ss.season_id = s.id AND ss.user_id = u.id
WHERE t.kind = 'tv' AND t.deleted_at IS NULL
GROUP BY u.id, t.id;

-- Franchise rollup, spanning films and shows.
CREATE OR REPLACE VIEW franchise_progress AS
SELECT
  u.id AS user_id, f.id AS franchise_id, f.name,
  COUNT(ft.title_id) AS total_titles,
  COUNT(*) FILTER (
    WHERE COALESCE(sp.state, ts.status) IN ('watched', 'caught_up')
  ) AS watched_titles
FROM franchises f
CROSS JOIN users u
LEFT JOIN franchise_titles ft ON ft.franchise_id = f.id
LEFT JOIN titles t            ON t.id = ft.title_id
LEFT JOIN title_status ts     ON ts.title_id = t.id AND ts.user_id = u.id
LEFT JOIN show_progress sp    ON sp.title_id = t.id AND sp.user_id = u.id
GROUP BY u.id, f.id, f.name;

-- Watched per year, the watchlist twin of books_by_year.
CREATE OR REPLACE VIEW titles_by_year AS
SELECT user_id, EXTRACT(year FROM watched_on)::int AS year, COUNT(*) AS watched
FROM watch_events WHERE watched_on IS NOT NULL GROUP BY 1, 2;
```

Still no capacity view and no readiness view. A watchlist has nothing to
compute that a list, a status, and a season count don't already answer.

---

## Part 2h — The dashboards (v4)

`design/mockups.html` is authoritative for layout; this is the scope behind it.
**Since the feel pass (D-40, 2026-10-05)** the dashboards follow
`design/STYLE_GUIDE.md` §14–§15 and `design/Ledger Feel Review.dc.html` instead,
where those draw them: the Now slot is the one hero, led by a cover; Up next is a
cover shelf with *Reorder*; the telescope is its own Position card; the
situation slot is at most three rows; and the rollup is three this-year counts,
never the catalogue. The slot order below is unchanged. TASKS 2.2, 2.4 and 8.7
carry the detail.

### One per medium, five slots, same order

`/comics`, `/books`, `/watch`. `/` redirects to whichever you touched last. The
list screens moved down a level (`/comics/runs`, `/books/list`). Every dashboard
fills the same five slots in the same order, so the film and TV screen is a
fill-in-the-blanks exercise rather than a design project:

1. **Now** — what you are in the middle of.
2. **Next, with a period control on it** — and the control is a frequent
   action, not a settings screen.
3. **Position** — drawn, not counted.
4. **Situation** — the honest question this medium can answer.
5. **A compact rollup** — four figures and one link to the stats page.

Then the thumb bar: fixed to the bottom, same primary verb slot, 44px minimum.
Marking what you just read is one tap on all three media. The left slot is
always that medium's mark verb — `Mark #141 read`, `Log progress`,
`Mark S2 watched` — followed by a secondary and a `+`. Every `+ batch` opens the
**batch sheet**: *Mark next N* (a stepper), *Mark through…*, *Log a session*.
Undo toasts are `role="status"` and last 8 seconds, paused on hover or focus.

**Three media, told apart at a glance.** Each dashboard's `h1` carries a small
unit badge — *sequence · issues*, *time · words*, *seasons* — because amber
means *held* on all three but is held against a different thing. The active
media tab and the `h1` kicker take a per-medium accent (`--m-comics`,
`--m-books`, `--m-watch`); genre hues are a separate token family from track
hues. The comics telescope's coarse rail is headed **TRACK · prerequisite
order** and the watch one **FRANCHISE · release order**.

### Comics dashboard

| Region | Answers | Source |
|---|---|---|
| Now (*Up now*) | What am I reading, and how far into this stretch of it | the resume pointer, `run_progress`, `issues.story_title`, `run_credit_line`; the *This stretch* lens is 24 issues around the head, run-relative |
| … *Since Tuesday* | What have I read since I last looked | the marks since the last visit, as up to four covers and a count |
| … *Also reading* | What else is open, so I don't abandon it by accident | runs with state `reading`, as one row |
| Up next | What I've decided to read next, in my order | `run_queue_state` — unstarted runs as a cover shelf, *Reorder* opens the list (Part 2i) |
| Where you are | Where am I in this run, its block, and the track — at once | the telescope: `run_progress`, `block_position`, `block_progress` (all exist) |
| Ready when you are | What could I start tonight with nothing to read first | `run_readiness`, plus `run_unlock_cost` and `run_opens` on the row; at most three |
| 2026 so far | What has this year been | three this-year counts |

*Rest of this block* is now the ladder's BLOCK row, and *The frontier* moved to
the run list (D-40, FP-D4). The frontier replaces a progress bar. Ready runs, runs one soft prereq short,
tracks never opened, and trades already on your shelf that cover a ready run are
the four numbers that change what you open.

### The telescope, in numbers

The telescope is generated from three ordered queries, so its geometry is a
function, not a drawing (ARCHITECTURE §4; TASKS 2.5). Its rails are horizontal at
every width (D-31), so where this section says *H*, read the rail's width *W*;
the variants and their fallback rules are in ARCHITECTURE §4 and
`docs/DESIGN.md` §5. The rules the mockups are held to:

- **A floor under every cell.** Cells are proportional to issue count *above a
  minimum*: 14px on the phone, 16px on desktop. Each rail allots `min` to every
  cell first, then shares the remainder by count. A 6-issue run beside a
  381-issue one stays a legible 14px cell.
- **Overflow folds, it does not shrink.** When the cells cannot all reach the
  minimum, the head cell and its two neighbours either side stay full size and
  the rest fold into at most two `+N runs` / `+N blocks` stubs of 14px, labelled
  with their summed issue count.
- **Read state is drawn as segments**, not one fill from the top. Green
  run-length segments show what is read *here*; a grey, dashed-outline layer
  marks placements read in another run. A gap in the green at #142 (read
  elsewhere, unread here) is the point of per-run read state.
- **The head label is `42 / 381 · #141`** — placement ordinal first, issue label
  second — on the rail and in the ladder's RUN row alike.
- **Ticks are computed.** Spacing is the next "nice" step (1, 2, 5, 10, 20, 50,
  100) above `total / floor(H / 6)`, and the legend states it, so Krakoa's 641
  issues do not reuse a hard-coded *1 tick = 10*.
- **Text is not scaled.** Labels are HTML or CSS-px classes, 11px minimum; the
  ladder beside the rails is the text equivalent (`role="list"`) and the SVG
  carries a `<desc>`. Colours are classes, not `var()` presentation attributes.
- **Every cell is a link** (`<a href>` with a `<title>` — *Block 2 · The Outback
  Years · 214 issues · 0 read*) with a visible focus stroke. Dragging or
  arrowing along a rail scrubs, releasing opens `/comics/[runId]#p-[ordinal]`.
- **Three variants:** the two-rail fallback for the nine block-less runs
  (`data-rails="2"`), the empty state with no run in flight, and the 641-issue
  Krakoa density.
- **One badge partial.** Phone and desktop render the run-state badges from the
  same component, so the two frames can never disagree.

### Run readiness: five states, one glyph each

The `run_state` view has five states and every one is visible. Amber is for *held*
only, so a run with only a soft prerequisite unread is not amber.

| State | Badge | Colour |
|---|---|---|
| `blocked` | `⊘ 82 runs first` | amber |
| `ready_hard` | `○ ready · 1 soft unread` | green outline |
| `ready_all` | `● ready` | green fill |
| `reading` | `◐ 42 / 381` (no prerequisite badge) | blue |
| `read` | `✓ read · Sep 2026` | grey |

The frontier's *one soft prereq short* tile takes the `ready_hard` outline. Each
badge carries an `aria-label` with the full sentence.

### Books dashboard

Since D-40 the dashboard shows the book in hand (or *Between books*), the
current quarter's shelf, a single-quarter strip against the 760k rule, On deck
and *2026 so far*; the full rail below is `/books/plan`'s, and where Rebalance
and *Place them* now surface is open (TASKS 2.2). The regions as first scoped:

| Region | Answers | Source |
|---|---|---|
| Reading now | How much is left, in evenings rather than dates | `book_status`, word count, `reading_settings` |
| The plan rail | Where is the year going, what is over, and what has not been placed | `plan_period`, `capacity` |
| Unplaced entries | Which entries are pretending to belong to a year | `plan_period` where `period` is a bare year |
| Against capacity | Is my plan lying to me, and can I act on it from here | `capacity` |
| 2026 so far | What has this year been | `books_by_year` |

The plan rail: a quarter is a column, a book is a block sized by its word count,
a dashed rule across all four columns is the 760k quarterly capacity. Anything
above the rule is hatched. A fifth lane behind a dashed border holds entries with
a year and no quarter — in the year, visibly not in the plan.
Tap targets and estimated counts are in Part 2c (Plan).

### Over-commitment is a decision, not an error

Amber means **held**: either a hard prerequisite is unread, or a decision has
not been made. It is the same colour on both screens because it means the same
thing. It clears when you decide — including when you decide to keep the
overage. Red is reserved for destructive actions and validation failures;
nothing on a dashboard is red.

The catch-up affordance is one tap from the dashboard and offers four peers:

1. **Move the overage into the next year** — and show that the next year then
   holds 45 books. The overage moves; it does not leave.
2. **Move it to On deck** — out of the year, still next in line; suggests the
   longest titles first. Nothing is deleted.
3. **Even out the quarters** — same books, saner shape. Fixes the shape, not the
   total.
4. **Accept it as a stretch year** — persisted, dated, and the amber stops.
   Afterwards the banner reads *2027 accepted as a stretch year on 14 Sep ·
   Undo* in a calm state.

The four are equal-weight buttons on the **Rebalance sheet**, each showing a
before/after delta (*2028 then holds 45 books*). The Move sheet uses the same
amber for a preview that would overrun a period (*Q1 → 1,010k of 760k · over
250k*) — never red — and offers the same *Accept* outcome.

A sheet that only offered ways to shrink the plan would be telling you your
ambition is the bug.

### The three screens that followed

**Run list** groups **track → block**, always. Block bands are the same filled
bands the spine uses for eras, so "an ordered list, sectioned" is one device at
both levels. Every row carries `costs N · opens N` instead of a tier badge —
cost is the decision you are making now, tier is a judgement you made once, and
tier survives as a sort option. Cost badges are amber: an expensive run is held,
not failed. The nine block-less runs group under **No block** at the foot of
their track. Settles HANDOFF §8 open question 5.

**Plan page** is the plan rail at full size, with titles legible inside the
blocks. Only the quarter you are working on expands; the other three are summary
rows. The empty-state action consolidates to one line — "893k of room across
Q2–Q4" with a Suggest button — rather than three quarters each asking the same
question. v3's numbers were internally inconsistent (a 240k quarterly budget
beside a 3.04M annual capacity, rows that did not sum to their quarter totals);
they now reconcile at 760k a quarter.

**`/watch`** stopped being a list. It is a dashboard with the same five slots,
and the list moved to `/watch/list`:

- **Now** — the season in flight, with a two-rail telescope. Watch nests only two
  levels (season in series, series in franchise) so the component drops a rail
  and keeps the bracket. Episodes stay untracked, which is why the fine rail is
  seasons and stops there.
- **Next** — five rows, filtered by film/TV and then by genre. There is no period
  control because there is no watch plan to put anything into, and a
  films-per-year target would need a plan table, a runtime budget and a period
  model to answer a question nobody asked. What survives of that idea is one
  line — series finished this year — in the rollup.
- **Situation** — the comics frontier, not the books pace: seasons ready, shows
  never started, films waiting, plus the franchise in progress and the title
  that has waited longest.
- **Cut:** newly-available-on-your-services. It depends on a provider feed that
  goes stale, it changes weekly for reasons that have nothing to do with you, and
  it turns a personal list into a storefront.

### Metrics the dashboards promote to a row

- **True unlock cost** and **leverage** on every candidate run row — "costs 44 ·
  opens 2" instead of a tier badge.
- **Why blocked?** The amber `⊘ 82 runs first` badge is a button that opens a
  sheet at `/comics/[runId]/path`: the cheapest ordered chain to that run, with
  each run's own cost, the running total, hard/soft markers and *+ Up next all*.
- **Unlock preview.** *opens 13* expands in place to show which of those runs
  become `ready_all` and which stay `ready_hard`.
- **Cheapest block to close** — the only honest form of "completion" at 0.67%.
  52 issues finishes Thor block 1.
- **Owned and ready** — trades on your shelf covering runs with nothing in
  front of them. The shortest path from opening the app to reading.
- **Next event on your path**, with distance in issues.
- **Series debt** — series where the next book is unread and already owned. The
  best tiebreak when filling a quarter slot.
- **Evenings left in the current book** — pages left over your median session.
  Decides whether you start something else tonight. Deliberately short-horizon,
  which is why it is not the completion date that stays cut.

---

## Part 2i — Requirement changes (Sept 2026)

Four changes, all confirmed. Schema reasoning is in ARCHITECTURE 2.14–2.16
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
- **Bringing reads across is explicit.** *Adopt N prior reads* (Part 2c) acts on
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
| Issues to a run | Your catalog, then **Metron** — cover, volume year and cover date on each result, so an ambiguous `Captain America #1` is resolved by looking at it | One label per line, ranges allowed, through the bulk-entry validator (TASKS 1.3) | `issues` if the label is new, then a `run_issues` placement |
| A book to a to-read level (a quarter or year, On deck, Someday) or a shelf | Your library, then **Open Library** — pages, year, cover, estimated words | Title and author, the rest optional; or paste a list (TASKS 1.4) | `books` (plus `authors` / `book_series`), then `shelf_books`, `book_status` or `reading_plan` |

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
word counts make them honest (FEATURES Part 2d). ARCHITECTURE 2.16, TASKS 1.10.

---

## Part 2j — Owner additions (Oct 2026)

On 2026-10-20 the owner listed 25 additions and corrections across books,
comics, watch and a new medium, music. Each was judged for value and fit and
then placed: amended into a task that already does that work, given a new
task where it fits the build order, or parked under TASKS *Later*. Part 1's
tables carry the short form (B7–B15, C7–C15, W1–W4, M1–M3). This part records
the calls that shaped them.

**Placed before cutover, because the data can't be recovered later.** A
book's start date (1.17) has the same deadline 1.5 had: a start that isn't
captured from the first day is gone. The Calibre import (1.18) runs through
extract's sidecars like 1.14, and extract stops running at cutover. The two
small fixes (1.4e, the paste; 1.5b, the year chip) are to screens already in
daily use.

**Calibre is the best word-count source available** (Part 4's honest answer
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
that hover also opens on a desktop. That keeps the UX floor and Part 2f's
point: Android, the main device, has no hover.

**Browsing one series amends D-60.** Walking Metron's issue list was rejected
for typed number ranges. For "show me the whole volume and let me check what
I want", it is the right call: a 300-issue volume is three cached requests.

**Other publishers need almost nothing.** The parser, Metron and the volume
map are publisher-agnostic. The one Marvel default is `tracks.publisher`, so
3.2 lets a new track name its publisher.

**Watch: credits become rows, and counts become derived.** The Part 2g draft
had `creators` and `cast_top` arrays and a stored `season_count`. Filtering by
director and a *Christopher Nolan* page are joins, as comics' credits are
(ARCHITECTURE 2.12), and a season total is a count of `seasons` rows (hard
rule 2). Corrected before 8.1 builds it (ARCHITECTURE 2.20).

**Where to watch is in, as a dated snapshot** (D-74, reversing Part 2e's
*Out*). Availability moves monthly, so every value shows its date and
refreshes only when you ask. The original network or streamer, and the
studio, don't move, so they are columns.

**"Waiting for the next season" is a state of its own, `caught_up`.**
Without it, a show you are current on reads as *watched* and drops into Done,
or reads as *watching* when there is nothing to watch. It is derived from the
seasons and TMDB's *Returning Series*, never stored.

**Not every "shelf" is a shelf.** *Christopher Nolan* and *Disney Animated*
are facts about the work, so they are a person page (8.10) and a studio
filter (8.3) that keep themselves current. DCOM and a loose group of films
are shelves (8.6), now with notes.

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

---

## Part 3 — Editing, since "edit everything" is most of the work

Full CRUD across 36 tables is a lot of forms. Three principles keep it small:

1. **Inline edit over modal forms.** Click the field, type, blur to save. No
   separate edit page for a run, no save button to hunt for.
2. **One create path per entity, reachable from where you noticed the gap.** Add
   a run from the run list. Add issues from the run page. Add a book from a
   shelf, the plan, or search when it returns nothing. Every add path is *search
   or type it*, and it creates the catalog row before the row that points at it
   (Part 2i).
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

---

## Part 4 — Metadata APIs

Short answer: **yes for comics, mostly yes for books, no for word counts.**

### Comics

| Source | Auth | Limits | Verdict |
|---|---|---|---|
| **Metron** | free account, HTTP Basic | 20 req/min, 5,000 req/day per IP | **Use this.** Query issue fields directly in one request; Comic Vine needs a volume lookup first. IDs are stable, and `cv_id`/`gcd_id` filters cross-reference Comic Vine and the Grand Comics Database |
| Comic Vine | free API key | 1 req/sec, 200 req/hour | Fallback for gaps. Much larger catalog, much tighter limits |
| Marvel Developer API | free key | Marvel only | Official, but weaker for run/arc structure than Metron |

Practical shape, as built in tasks 0.6 and 0.7: `etl/enrich_comics.py`
resolves by series name and issue number, caches every response, and writes
sidecar CSVs keyed by label. Series issue lists (~1,800 requests) give
`metron_id`, `cover_date`, `cover_url` and Metron's canonical label, which feeds
a label review. Story titles and credits need one detail request per issue —
about 8,100, so two days at 5,000/day. Credits are stored as `issue_credits`
rows in six roles, and a run's writers and artists are derived from them.
`story_arc` and `page_count` are in the same cached detail pages for later.
Handles 429s and respects `Retry-After`.

What it will **not** do is build your reading orders. Metron knows
`Fantastic Four #570` exists; it does not know that #570-588 plus `FF #1-23`
constitute "Hickman's Fantastic Four" or that it soft-depends on Secret Warriors.
That curation is the actual value in your spreadsheet, and no API has it. So:
**you keep authoring runs and prereqs; the API fills in everything below the
issue label.** Which is the right split — it means adding a run becomes "paste
the series and issue range" and the app resolves 23 issue records for you.

### Books

| Source | Auth | Limits | Best for |
|---|---|---|---|
| **Open Library** | none | courtesy limits, send a real User-Agent | Bibliographic spine: titles, authors, ISBNs, publish years, page counts, covers. CC0 data |
| **Hardcover** | free account, GraphQL | 5,000 req/day free | Series ordering and community tags — the best single source for "book 4 of 7" |
| Google Books | key optional | ~1,000/day per project by default, raisable on request | Descriptions and categories; good fallback |
| ISBNdb | paid | — | Skip |
| **Calibre** (the owner's library) | none: a local `metadata.db`, read from a copy | none | Word counts from the Count Pages plugin, series and index, tags, comments, ISBN, read dates. TASKS 1.18, D-73 |

Use Open Library for the spine and Hardcover for series position, which is data
you currently maintain by hand as `Harry Potter #1`. Calibre's series, index
and ISBN fill only where one of them agrees (D-73).

### Word counts — the honest answer

No general book API exposes word counts. Goodreads never had it, Open Library
and Google Books give page counts, and publishers largely don't publish the
figure. The options:

1. **Estimate from page count.** `pages × 275` is the conventional figure.
   Cheap, automatic, roughly ±15%. Good enough for "is 2027 overcommitted",
   which is a planning question, not an accounting one.
2. **AR BookFinder** (arbookfind.com) publishes real word counts — it's the
   Accelerated Reader database, and it's where numbers like these usually come
   from. No public API, so it's manual lookup.
3. **Keep what you have and estimate the rest.** You already have real counts for
   a large share of the master list. Store a `word_count_source` flag
   (`stated` / `estimated`) so the pace engine can tell you how much of a year's
   projection rests on estimates.

Recommend 3, falling back to 1. Never silently overwrite a hand-entered count
with an estimate.

4. **Calibre's Count Pages column** (2026-10-20). For every book the owner has
   as an ebook, the plugin counts the words in the file itself: a real count,
   loaded as `stated` where the workbook has none (TASKS 1.18). It moves the
   order to 3, then 4, then 1.

### Music

| Source | Auth | Limits | Verdict |
|---|---|---|---|
| **MusicBrainz** | none; a real User-Agent | 1 request a second | **Use this** (D-75). CC0 core data. Release groups are albums, recordings are songs |
| Cover Art Archive | none | generous | Album covers by MusicBrainz release id |
| Spotify Web API | app registration | restricted for new apps | Not a catalog source. Links out, if ever, are a later question |

---

## Part 5 — Schema additions these imply

```sql
-- read history: the log, with the existing tables as its current-status
-- projection. Add this BEFORE accumulating data; it cannot be reconstructed.
CREATE TABLE read_events (
  id          serial PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id     text REFERENCES books(id) ON DELETE CASCADE,
  placement_id int REFERENCES run_issues(id) ON DELETE CASCADE,  -- per run (Part 2i)
  finished_on date,                    -- NULL exactly when precision = 'none' (D-R3-1)
  finished_on_precision text NOT NULL DEFAULT 'exact'
    CHECK (finished_on_precision IN ('exact','approximate','none')),
  reread_of   int REFERENCES read_events(id),
  CHECK (num_nonnulls(book_id, placement_id) = 1),
  CHECK ((finished_on IS NULL) = (finished_on_precision = 'none'))
);
-- Date precision (D-R3-1) is one rule on three tables: issue_progress
-- (completed_at, completed_at_precision), book_status (finished_on,
-- finished_on_precision) and read_events (above). A date without its precision
-- is not stored; 'none' is the honest state of the 76 workbook reads.
-- issue_progress and book_status landed in migration 0004.

-- reading sessions: what calibrates the pace engine
CREATE TABLE sessions (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  minutes    int NOT NULL,
  book_id    text REFERENCES books(id),
  run_id     text REFERENCES runs(id),
  words      int,                    -- derived where known, for wpm calibration
  note       text
);

-- quick capture: zero required fields
CREATE TABLE inbox (
  id         serial PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text   text NOT NULL,
  kind       text,                   -- books | comics | null
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  book_id    text REFERENCES books(id),
  run_id     text REFERENCES runs(id)
);

-- LANDED in migration 0005 (task 0.3), down to "archive instead of delete",
-- except reading_plan.planned_month (void, 1.7) and the void shelf_items block.
-- The shipped shapes below are the ones in src/db/schema.ts, which wins (D-1).

-- pace engine
CREATE TABLE reading_settings (
  user_id           text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  minutes_per_day   int  NOT NULL DEFAULT 45,
  words_per_minute  int  NOT NULL DEFAULT 185,
  words_per_page    int  NOT NULL DEFAULT 275,
  plan_granularity  text NOT NULL DEFAULT 'quarter' CHECK (plan_granularity IN ('quarter','month')),  -- dropped in 1.7 (D-38)
  theme             text NOT NULL DEFAULT 'system'  CHECK (theme IN ('system','light','dark')),
  show_covers       boolean NOT NULL DEFAULT true
);

-- Named eras within a run: your 8 Claremont sections, Slott's Brand New Day /
-- Big Time / Superior / Spider-Verse. Placements carry an optional era: an era
-- is a stretch of one run's reading order, and an issue in two runs can sit in
-- a different era of each.
CREATE TABLE eras (
  id      serial PRIMARY KEY,
  run_id  text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ordinal int  NOT NULL,
  name    text NOT NULL,
  UNIQUE (run_id, ordinal),
  UNIQUE (id, run_id)            -- target of the composite key below
);
-- A placement can only sit in an era of its own run, and deleting an era
-- clears era_id and nothing else (SET NULL with a column list, PG 15+).
ALTER TABLE run_issues ADD COLUMN era_id int,
  ADD FOREIGN KEY (era_id, run_id) REFERENCES eras(id, run_id) ON DELETE SET NULL (era_id);

-- The volume map, editable in the app instead of only as a CSV.
CREATE TABLE volume_rules (
  id       serial PRIMARY KEY,
  series   text NOT NULL,
  run_id   text REFERENCES runs(id) ON DELETE CASCADE,   -- null = any run
  issue_from int, issue_to int,        -- null = any issue
  year     int NOT NULL
);

-- VOID: task 1.7 replaces the plan's year/quarter columns with one period column.
ALTER TABLE reading_plan  ADD COLUMN planned_month int;     -- 1-12, null = quarter-level
-- stated | estimated, NULL exactly when word_count is (no default); 0005
-- backfills 'stated' for every book that has a count.
ALTER TABLE books         ADD COLUMN word_count_source text
  CHECK ((word_count IS NULL) = (word_count_source IS NULL)
         AND (word_count_source IS NULL OR word_count_source IN ('stated','estimated')));
ALTER TABLE books         ADD COLUMN page_count int;
ALTER TABLE books         ADD COLUMN cover_url text;
-- finished_on already exists as text (100% NULL); migration 0004 retyped it to
-- date and added finished_on_precision (R3-05, D-R3-1). Only notes remains:
ALTER TABLE book_status   ADD COLUMN notes text;

-- ALREADY LANDED, ahead of this task and ahead of the first data load, because
-- it changes the shape of runs and the ETL. Shipped shape, which differs from
-- the original sketch on two points:
--   * text slug id, not serial — every other catalog table here is a text slug
--     PK, and extract.py has to write runs.block_id before either CSV loads,
--     so a surrogate key would have to be invented by the ETL anyway
--   * name is NULLABLE — blocks are numbered today and get named later
-- Block numbers are scoped per track: avengers block 1 and x-men block 1 are
-- different blocks, hence the (track_id, number) unique constraint.
CREATE TABLE blocks (
  id       text PRIMARY KEY,      -- "avengers-b2"
  track_id text NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  number   int  NOT NULL,         -- order within the track
  name     text,                  -- "The Setup and the Relaunch", once named
  UNIQUE (track_id, number)
);
ALTER TABLE runs ADD COLUMN block_id text REFERENCES blocks(id);  -- nullable
ALTER TABLE runs DROP COLUMN block;   -- block_id replaces it
-- runs.sequence keeps its meaning: position within the block.
-- See block_position and block_progress in etl/views.sql.

-- arbitrary curated lists: Cosmere, Stephen King, anything you invent.
-- VOID BLOCK (R3-04): the shelf_items table below is superseded. Task 0.3 creates
-- shelves(kind CHECK IN ('books','titles')) and shelf_books only; shelf_titles
-- lands with `titles` in 8.1/8.6, because it needs that table to point at.
CREATE TABLE shelves (
  id       text PRIMARY KEY,
  name     text NOT NULL,
  user_id  text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind     text NOT NULL CHECK (kind IN ('books','titles'))
);
CREATE TABLE shelf_books (
  shelf_id text NOT NULL REFERENCES shelves(id) ON DELETE CASCADE,
  book_id  text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  ordinal  int  NOT NULL,
  PRIMARY KEY (shelf_id, book_id)
);
-- Books only. A curated comics list, if ever wanted, gets its own feature
-- rather than a polymorphic table.
CREATE TABLE shelf_items (  -- VOID: use shelf_books
  shelf_id text REFERENCES shelves(id) ON DELETE CASCADE,
  book_id  text REFERENCES books(id) ON DELETE CASCADE,
  ordinal  int,
  PRIMARY KEY (shelf_id, book_id)
);

-- metadata enrichment (issues.metron_id, cover_date, cover_url, story_title,
-- creators and issue_credits already landed in migrations 0002 and 0003)
ALTER TABLE books  ADD COLUMN open_library_id text;
ALTER TABLE books  ADD COLUMN hardcover_id int;

-- archive instead of delete
ALTER TABLE runs   ADD COLUMN deleted_at timestamptz;
ALTER TABLE issues ADD COLUMN deleted_at timestamptz;
ALTER TABLE books  ADD COLUMN deleted_at timestamptz;
-- Also run_issues (R3-06): removing an issue from a run must not cascade-delete
-- its read history. A soft-deleted placement keeps its issue_progress row.
ALTER TABLE run_issues ADD COLUMN deleted_at timestamptz;
```

---

## Part 6 — Proposed build order

| Phase | Contents | Rough size |
|---|---|---|
| 0 | Test harness, CI, schema additions, soft delete, volume normalization, per-run read state (0.8) | a sitting. Builds nothing visible — do it anyway |
| 1 | Range marking, undo, bulk add, add by search or by hand, quick capture, dated log, resume pointer, status screens | 3–4 sittings. **Cut over from Sheets after this** |
| 2 | Pace engine, reading sessions, books dashboard, plan editor | a weekend. The highest-value missing thing |
| 3 | Editing: inline fields, runs, prereqs, book status, detail sheets | two weekends |
| 4 | Metron + Open Library enrichment, covers | a weekend. Prerequisite for phase 7 |
| 5 | Shelves, tracks page, eras, ratings, DNF, `edition_issues` | a weekend |
| 6 | Stats, true unlock cost, global search, PWA, shortcuts, events | as you feel like it |
| 7 | AI review and drafting (19–22), then the release digest email | last. Needs phase 4 |
| 8 | **Watchlist**: TMDB, seasons, franchises, detail sheets, where to watch, person pages | self-contained — needs only phase 0, pull it forward any time |
| 9 | **Music**: MusicBrainz, artists, albums, song ranking (D-75) | last; starts with its design (9.0) |
| Later | Marvel Unlimited, League of Comic Geeks, editions you haven't listed | not scheduled: each has an open question first (TASKS *Later*) |

The 2026-10-20 additions (Part 2j) also put three tasks before cutover: 1.18
(Calibre, in sitting 8), and 1.4e, 1.5b and 1.17 (sitting 9).

**Phase 1 before phase 2.** The pace engine is more interesting, but if adding
data is painful you'll stop using the app before you ever see a projection.

**Phase 8 sits outside the sequence.** It shares no tables with comics or books
beyond `users` and `shelves`, so it can slot in anywhere after phase 0 — useful
as a change of pace between the heavier comics phases, and the only feature that
starts from an empty table rather than a migration.

**Two items worth pulling forward out of order:**

- **Task 6.2b, true unlock cost.** Uses `run_ancestors()`, which already exists.
  A few hours — but the 64-issues-behind-4,173 figure once quoted here is
  withdrawn (R1-01) until 2.11 breaks the graph's 98-run cycle; the
  real number comes from `run_unlock_cost` after that.
- **Task 1.5, `read_events`.** Already in phase 1, but worth restating: it must
  land before real reading history accumulates. A second read currently
  overwrites the first and that history cannot be reconstructed.
