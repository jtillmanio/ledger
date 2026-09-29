# R1 — Product requirements and UX review (HORIZON = Phases 0–2)

> **Disposition, 2026-09-20.** Owner took the recommendation on both decisions
> (→ `decisions.md` D-7, D-8) and accepted R1-AR1 (D-9). Twelve of thirteen
> findings were resolved in the docs in the same pass — see the ledger for
> per-item notes. **R1-04 stays open for R2**: it needs a schema decision
> (`completed_at_precision`, nullable `completed_at`) rather than a doc edit, and
> **it is still not-past-1.1**. R1-12 is deferred rather than fixed: D-8 moved
> the timer to 6.12, which removes it from HORIZON without answering it.
> Two tasks were added — **2.0 Settings · S** and **2.11 Prerequisite audit · M**
> — and one was split (**2.1b** M → S, remainder to **6.12**).
> The findings below are the review as written; they were not edited to match.

Reviewed as the sole owner, on an Android phone and a desktop. Primary artifacts
read first (TASKS 0.1–2.10, FEATURES Parts 1–2i, ARCHITECTURE §2.14–2.16 and §4,
mockup sections by screen, `schema.ts`, `views.sql`, `globals.css`, seed CSVs);
HANDOFF narrative last. Ledger items R0-01…R0-AR1 are not re-reported.

## 1. Verdict — PASS WITH CONDITIONS

The product definition is unusually strong: the five-slot dashboard rule, the
four colour meanings, per-run read state and the "search or type it, always a
real row" add pattern are coherent across FEATURES, ARCHITECTURE, TASKS and the
mockups, and the mockups genuinely settle layout arguments. Two things block a
clean pass. First, **the readiness and unlock-cost numbers the comics product is
designed around are wrong by roughly 6×** against the current data — 181 of 259
runs carry a hard prerequisite, not 27 — which makes two acceptance checks
unpassable and one dashboard slot much thinner than drawn. Second, **the books
half of HORIZON has no way to change a book's status**, so "I finished a book"
cannot complete in Phases 0–2 even though three HORIZON surfaces read the result.
Both are cheap to fix now and expensive after 2.4/2.9 are built against them.

## 2. Traceability matrix (HORIZON)

Feature → task → screen → is the check observable? Flags only; unflagged rows
traced clean.

| Feature (FEATURES) | Task | Screen (mockup) | Check observable? | Flag |
|---|---|---|---|---|
| #3 Mark a range | 1.1 | `range` | Yes (row counts, one round trip) | Date modes have no storage → **R1-04** |
| #5 Undo | 1.2 | toast in most screens | Yes | Scope excludes 1.10/2.7 → **R1-09** |
| #2 Bulk entry | 1.3 / 1.3b | `bulk`, `addsearch` | Yes (fixture counts, mocked 429) | clean |
| #2 Books bulk / 2i add | 1.4 / 1.4c | `add` | Yes | clean |
| #21 Quick capture | 1.4b | `capture` | Yes | clean |
| #4 Dated log | 1.5 | — (no screen) | Partly | "approximate" names no column → **R1-04**; no status UI → **R1-03** |
| #7 Resume pointer | 1.6 | `home` telecard | Yes | clean |
| B2 period column | 1.7 | — (schema only) | Yes | clean |
| 2c Everywhere / 2h thumb bar | 1.8 | `states`, all frames | Mostly | Links to unbuilt routes → **R1-06**; offline pill → **R1-07** |
| 2i In flight·Up next·Done | 1.9 | `status`, `queue` | Yes | Books amber lane un-actionable → **R1-10** |
| 2i Up next queue | 1.10 | `queue`, `home` | Yes | *Start* undefined → **R1-08**; "41 ready" false → **R1-02** |
| #1 Pace engine | 2.1 | — (view only) | Yes (118% ±1%) | Inputs unreachable → **R1-05** |
| #20 Sessions | 2.1b | `session`, `dashextras` | Partly | Settings absent → **R1-05**; runaway timer → **R1-12** |
| B1 Books dashboard | 2.2 | `bdash` | Yes (hatching, lane, 24px) | "evenings" undefined with 0 sessions → R1-12 |
| B2 Plan editor | 2.3 | `moveplan` | Yes | clean |
| C1 Comics dashboard | 2.4 | `home` | Yes (badges, no `--danger`) | "41 ready" false → **R1-02** |
| 2h Telescope | 2.5 | `telescope` | Yes — best-specified task in the set | clean |
| 2d Unlock cost | 2.6 | `path` | **No — asserts 4,642** | → **R1-01** |
| 2h Over-commitment | 2.7 | `rebalance` | Yes | Undo semantics → R1-09 |
| 2.8 Place unquartered | 2.8 | `bdash` | Yes | count 175/102 = ledger R0-04 |
| 2c Run list | 2.9 | `runs` | **No — asserts 27 blocked** | → **R1-02** |
| 2c Plan page | 2.10 | `plan`, `planmonth` | Yes | clean |

**Screens with no HORIZON task that builds them:** `settings` (no task in *any*
phase, and not in ARCHITECTURE's route table) → **R1-05**; `search`, `tracks`,
`stats` are drawn and linked from 1.8's chrome but built in 5.2/6.1/6.2 →
**R1-06**. **Task with no screen:** 1.5 has no drawn surface for editing a date
or finishing a book → **R1-03**. No scope-creep task found: every HORIZON task
traces to a stated feature.

## 3. Flow walks — the owner's weekly loop

| Flow | Entry → action | Feedback | Persisted | Undo | Lands | Gap |
|---|---|---|---|---|---|---|
| Mark one issue read | `/comics/[runId]` → tap `.chk` | `aria-pressed`, green fill, toast | `issue_progress(user, placement, completed_at=now)` | Ctrl+Z / toast 8s | same row | **Write failure / offline undefined (R1-07)** |
| Mark a range | spine long-press → range sheet → date mode → *Mark 96 read* | toast "96 marked" | 96 rows, one request | one undo, all 96 | spine, scrolled to end | **"No date"/"Spread" unstorable (R1-04)** |
| Adopt prior reads | run hero → *Adopt 9 prior reads* | preview in range sheet | 9 rows at original dates | one undo | run hero | clean |
| Pick what's next | `/comics` → Up next → *Start* | — | — | — | ? | **Start's effect undefined (R1-08)** |
| Queue a run | `/comics/runs` row → *+ Up next* | row becomes *In Up next · #3* | `run_queue` ordinal | toast | same list | clean |
| Finish a book | ? | ? | ? | ? | ? | **No entry point exists in HORIZON (R1-03)** |
| Move a book's period | plan row → *Move* → chips → confirm | live preview, amber if over | `reading_plan.period` | move back (no undo) | plan page | Undo unspecified (LOW) |
| Place an unquartered book | `/books` → *Place them* | quarter totals on each button | `period='2027-Q3'` | — | dashboard | Phase-2 only; 1.9 offers it earlier (**R1-10**) |
| Log a session | thumb bar timer chip → stop | sheet pre-filled | session row | — | prior screen | **Runaway timer / two devices (R1-12)** |
| Accept an overage | `/books` → Rebalance → *Accept* | amber → settled grey | dated acceptance row | persistent *Undo* | dashboard | two meanings of Undo (**R1-09**) |

## 4. States by HORIZON screen

Drawn and specified: offline strip and sync pill, loading skeletons, empty
telecard, empty queue, empty *Reading now*, metadata-pending, and all three
live-API states (loading / rate-limited / error) — better than most projects
manage. Gaps:

- **Error state for a *write*** is drawn nowhere; only API *reads* have one. A
  failed mark is the worst outcome in this app and FEATURES says so (→ R1-07).
- **First-run before any data** exists only for `/watch` ("Watch — first run").
  The comics empty telecard says *"41 ready to start"* and the empty queue says
  *"pick from 41 ready runs"* — both assume a loaded catalog. Acceptable here:
  the owner arrives at cutover with 10,840 placements, so a true zero state is
  unreachable. Not a finding.
- **Stale data** is not addressed on any HORIZON screen (two devices, one
  session each). Phone marks an issue, desktop still shows it unread. → ACCEPTED
  RISK below.
- **Very large lists**: covered for the spine (641 issues, minimap, collapse) and
  the telescope (overflow stubs), not for the run list at 259 rows or the master
  list at 1,478. Both are plain scrolls; fine at this size.

## 5. Findings

### R1-01 `run_unlock_cost`'s acceptance check cannot pass — 4,642 vs 7,209 → R2

- HIGH / Proven / high confidence
- Where: `docs/TASKS.md:756,771,776`; `docs/FEATURES.md:420`; mockup `path` notes
- Evidence: computed over `seed/prereqs.csv` + `seed/issues.csv`:
  `ewing-defenders ancestors 160 closure issues 7209 +own 13 = 7222`.
  FEATURES:420 records `| Ewing — Defenders | 13 | 98 | 4,642 |` — 98 ancestors,
  not 160. `claremont-xmen direct leverage 13` ✓ (that half of the check holds).
- Failure scenario: an agent implements 2.6 correctly and the test
  `run_unlock_cost = 4642` fails; the agent "fixes" the view until the number
  matches, shipping a wrong closure to the dashboard's `costs N` badge.
- Why it matters here: silently wrong numbers on screen, and `costs N` is the
  figure that decides what the owner opens.
- New evidence for **R0-01**: the closure grew because the graph has a **103-run
  cyclic component** over all edges (Tarjan, seed data). `ewing-defenders` and
  `claremont-xmen` have the *same* 160 ancestors. Until R0-01 is resolved,
  `run_unlock_cost` is not merely stale, it is meaningless for ~40% of runs.
- Resolution: delete both literal figures from 2.6; make the check relational —
  *cost equals the sum of `issue_count` over the run's ancestor set, and the
  ancestor set contains no run reachable from the target* — and re-derive the
  displayed number after R0-01 closes.
- Proceed without fixing? **Not past 2.6.**

### R1-02 "41 ready" and "Show 27 hard-blocked" are false; 2.9's check fails → R2

- HIGH / Proven / high confidence
- Where: `TASKS.md:495,539,683,834,845`; `FEATURES.md:272,313`;
  `ARCHITECTURE.md:415,507`; 15 occurrences in `design/mockups.html`
- Evidence: `runs 259 · runs with >=1 HARD prereq edge: 181 · runs with NO
  prereq edge at all: 30 · progress rows 76`. With one run fully read, **at
  least 180 runs are `blocked`**; at most 30 can be `ready_all`. Modelling the
  five states gives `blocked 180 · ready_all 30 · ready_hard 46`.
- Failure scenario: 2.9's check *"hiding blocked runs removes 27 rows from the
  seeded set"* fails at 180; the *Unlocked and waiting* slot the comics dashboard
  is built around holds 30 runs, not 41; and the blocked switch hides 70% of the
  run list, which is a different screen from the one that was reviewed.
- Why it matters here: wrong numbers on screen, plus a product premise (the
  frontier as the thing that replaces a progress bar) that was argued from a
  figure that does not hold.
- Resolution: replace every literal in copy with the computed count, and rewrite
  2.9's and 2.4's checks to assert *the switch hides exactly the rows whose
  `run_state = 'blocked'`* rather than a number. Then see DECISION D-R1-1.
- Proceed without fixing? **Not past 2.4.**

### R1-03 No HORIZON task lets the owner change a book's status

- HIGH / Proven / high confidence
- Where: `TASKS.md:947` (3.4, Phase 3); `src/app/books/page.tsx:41-43`;
  `src/app/api/progress/book/route.ts`
- Evidence: the shipped books page only *filters* by status
  (`href="/books?status=reading"`); `/api/progress/book` exists with no caller.
  The only status editor in the plan is **3.4, Phase 3**.
- Failure scenario: the owner finishes a book in week one of daily use and has
  nowhere to record it. 1.5 builds `finished_on` and `read_events`, 1.9's Done
  tab reads `book_status = read`, 2.2's *year so far* counts it and 2.2's empty
  state offers *Start the first Q-current book* — four HORIZON surfaces read or
  write a state nothing in HORIZON creates.
- Why it matters here: a daily-use flow that cannot complete is exactly the
  "slower than Sheets, so you drift back" risk FEATURES names as highest.
- Resolution: move the status control (to_read → reading → read/DNF, plus the
  finish date) out of 3.4 into **1.5**, which already migrates that table. Keep
  rating and top-books reorder in 3.4. Fix R0-C1 in the same task.
- Proceed without fixing? **Not past 1.5.**

### R1-04 Date modes drawn on the range sheet have nowhere to be stored → R2

- HIGH / Proven / high confidence
- Where: `src/db/schema.ts:225`; mockup `range`; `TASKS.md:222-223,385`
- Evidence: `completedAt: timestamp(...).defaultNow().notNull()`. Task 0.8
  restates `issue_progress(user_id, placement_id, completed_at)` unchanged. The
  mockup draws four filled buttons: *Today · Pick a date · Spread over a range ·
  **No date***, and its note says no-date issues "count as read and are excluded
  from pace maths".
- Failure scenario: an agent building 1.1 cannot store "no date", so it writes
  `now()`. The reading log then claims 96 issues were read on the day of a
  backfill, permanently and undetectably, and 2.1/6.2 compute pace from it.
  Same gap in 1.5: *"record that they are approximate"* names no column, and
  *Spread over a range* specifies neither a second date nor a distribution rule.
- Why it matters here: corrupted reading history, which the calibration list
  puts first, and it is unrecoverable once real dates accumulate.
- Resolution: one column, matching the existing `*_source` pattern —
  `completed_at_precision text CHECK (IN ('exact','approximate','none'))`, with
  `completed_at` nullable when precision is `none`; apply the same to
  `book_status.finished_on` in 1.5. Specify *Spread* as: two dates, placements
  distributed evenly by ordinal, precision `approximate`.
- Proceed without fixing? **Not past 1.1.**

### R1-05 No task builds Settings, and every capacity number depends on it

- HIGH / Read / high confidence
- Where: `TASKS.md` — no Settings task in any phase (only 6.11 adds a toggle
  *to* it); `ARCHITECTURE.md:370-391` route table has no `/settings`; mockup
  `settings` exists; `TASKS.md:566,575,583,790`
- Evidence: 2.1 is `reading_settings` (minutes/day, words/minute, granularity)
  "plus a view"; 2.1b's check is *"Settings shows the drift rather than silently
  overwriting"*; 2.7 persists the overage acceptance "on `reading_settings`".
- Failure scenario: the owner's reading time changes (a toddler's schedule is
  the stated reason sessions exist) and there is no screen on which to change 45
  min/day or 185 wpm — so every figure on the books dashboard, the plan rail, the
  move sheet and the rebalance sheet is stuck at a seeded guess. 2.1b's
  acceptance check cannot be performed at all.
- Why it matters here: an agent reaching 2.1 must invent both the screen and
  where the initial row comes from.
- Resolution: add **2.0 Settings · S** before 2.1 — one form over
  `reading_settings` (minutes/day, wpm, quarter/month granularity) plus the seed
  row, and let 2.1b and 6.11 extend it. Add `/settings` to the route table.
- Proceed without fixing? **Not past 2.1.**

### R1-06 1.8 ships chrome that links to routes no HORIZON task builds

- MEDIUM / Read / high confidence
- Where: `TASKS.md:443-448` vs `TASKS.md:1021-1059`
- Evidence: 1.8 specifies "a 44px search icon (`aria-label="Search (Ctrl K)"`)"
  on every phone screen and a desktop sidebar carrying *Tracks*, *Shelves*,
  *Top books*, *Stats* and *Settings*. Those are 6.1, 5.2, 5.1, 6.2 and nothing.
- Failure scenario: the owner taps the search icon on the phone — the single
  most prominent control in the header — and gets a 404 or a dead button, for
  the whole of Phases 1 and 2.
- Resolution: 1.8 renders only links whose route exists, behind one
  `NAV_ENABLED` list; add the entry when its task lands. One line per task.
- Proceed without fixing? Not past 1.8.

### R1-07 A failed or offline write has no defined behaviour in HORIZON

- MEDIUM / Read / high confidence
- Where: `TASKS.md:455-456` ("6.4 builds the queue"); `TASKS.md:1055`;
  `FEATURES.md:276-280`; `ARCHITECTURE.md:377` ("optimistic `POST`")
- Evidence: 1.8 builds the sync pill and the mockup draws *Offline · 3 marks
  queued* with `queued` tags on rows, but the queue behind it is **6.4**, out of
  horizon. No HORIZON task defines what happens when `/api/progress/issue` fails.
- Failure scenario: the owner marks issues on the phone on a bad connection; the
  optimistic tick stays green, the POST fails, and the reads are gone with no
  indication — precisely the outcome FEATURES calls "the worst".
- Why it matters here: lost reading history on the primary device.
- Resolution: 1.8's scope gains one rule — a failed write reverts the optimistic
  tick and raises the error toast with *Retry* — and the pill renders only
  `online`/`offline` until 6.4. Do not build the queue early.
- Proceed without fixing? Not past 1.8.

### R1-08 *Start* on the queue's top row has no defined effect

- MEDIUM / Read / medium confidence
- Where: `TASKS.md:537`; mockup `queue` (`<button class="btn sm">Start</button>`)
- Evidence: 1.10 says the dashboard shows "the first five unstarted queued runs,
  *Start* on the first" and, separately, "Starting or finishing a queued run
  changes nothing in `run_queue`". Whether *Start* navigates to the spine or
  marks the first placement read is never stated. 8.7 defines the watch
  equivalent precisely (*"the button says **Start S1**… not a bare *Watch*"*).
- Failure scenario: an agent implements *Start* as "mark placement 1 read"; a
  mistap on the dashboard writes progress and silently moves the run out of Up
  next. The reverse guess makes the button a duplicate of the row link.
- Resolution: state it in 1.10 — *Start* navigates to `/comics/[runId]#p-1`; the
  only control that writes progress is the thumb bar's mark verb.
- Proceed without fixing? Not past 1.10.

### R1-09 1.2's undo scope excludes two things that later depend on it

- MEDIUM / Read / high confidence
- Where: `TASKS.md:241` vs `TASKS.md:535,553,793-803`
- Evidence: 1.2 is "Last-action stack in memory… Covers single marks, range
  marks, and status changes." 1.10 requires "undo restores the exact prior
  order" of an ordinal rewrite; 2.7 requires an *Undo* on a banner that persists
  across sessions on two screens.
- Failure scenario: 1.2 ships a stack typed to progress rows; 1.10 rewrites it
  to hold a queue snapshot and 2.7 needs a durable one — the same feature built
  three times. And two different affordances are both called *Undo*: an 8-second
  toast and a permanent banner action.
- Resolution: 1.2 defines one inverse-operation interface (`undo()` closure +
  label) and names its three users. 2.7's control is renamed *Undo acceptance*
  and is explicitly not the toast stack.
- Proceed without fixing? Not past 1.10.

### R1-10 Books *Up next* shows amber the owner cannot clear until Phase 2

- MEDIUM / Read / high confidence
- Where: `TASKS.md:489`; mockup `status` notes ("the bare-year lane in amber and
  a **Place them** button (the 2.8 flow)"); `TASKS.md:808` (2.8), `632` (2.3)
- Evidence: 1.9 ships in Phase 1 and renders the bare-year lane amber. The only
  ways to give a row a quarter are 2.3 (plan editor) and 2.8 (place the
  unquartered), both Phase 2.
- Failure scenario: for the length of Phase 1 the books status screen shows 175
  amber rows with a button that does nothing, against the project's own rule
  that "an indicator you cannot dismiss by choosing is one people stop reading".
- Resolution: in 1.9, render the bare-year lane neutral with the count and no
  button; it turns amber and gains *Place them* when 2.8 lands. One conditional.
- Proceed without fixing? Not past 1.9.

### R1-11 Focus after a sheet or dialog closes is specified nowhere

- MEDIUM / Proven / high confidence
- Where: grep for "focus" across TASKS/FEATURES/ARCHITECTURE returns only
  `TASKS.md:454` (toast paused on focus) and `FEATURES.md:862` (same) — plus
  `:focus-visible` strokes. No rule for focus restoration.
- Evidence: HORIZON ships at least eight overlay surfaces — range (1.1), batch
  (1.8), add review (1.3/1.3b/1.4c), move/plan (2.3), rebalance (2.7), path
  (2.6), session (2.1b), issue sheet.
- Failure scenario: on the desktop, the owner opens the range sheet from a row
  at issue 340 of 381, confirms, and focus falls to `<body>`; the next Tab starts
  at the media bar, 340 rows away.
- Why it matters here: the owner uses a keyboard on desktop for bulk work, and
  this is eight tasks' worth of rework if it is fixed per-sheet.
- Resolution: one line in the UX floor (`TASKS.md:23-31`) — *a sheet returns
  focus to the control that opened it; an intercepted route returns focus to the
  row link* — so it is one shared sheet component, not eight fixes.
- Proceed without fixing? Not past 1.1.

### R1-12 A forgotten timer poisons the numbers sessions exist to fix → R2

- MEDIUM / Read / medium confidence
- Where: `TASKS.md:573-593`
- Evidence: 2.1b specifies a start/stop timer, a chip that "follows you across
  screens", and *Recalculate from sessions* which "replaces the typed wpm and
  minutes/day with observed values". No maximum session length, no confirmation
  on an implausible one, and no statement of where a running timer lives.
- Failure scenario: the owner starts the timer and falls asleep; a 9-hour
  session is recorded; *Use these* then sets minutes/day to a figure that makes
  the entire capacity engine — 2.1, 2.2, 2.3, 2.7, 2.10 — wrong in one tap.
  Separately, starting a timer on the phone and stopping it on the desktop is
  undefined; if the timer is local state, the session is lost.
- Resolution: store the timer as a row (`started_at`, nullable `ended_at`) so it
  is device-independent; on stop past a threshold (say 4h) the sheet opens with
  the minutes editable and unconfirmed; *Recalculate* shows the sessions it used.
- Proceed without fixing? Not past 2.1b.

### R1-13 `/`'s "last-touched medium" has no defined storage → R2

- MEDIUM / Read / high confidence
- Where: `TASKS.md:436-437,471`; `ARCHITECTURE.md:372`
- Evidence: specified in three places as behaviour, nowhere as state. The check
  ("`/` redirects to the last-touched medium, and to `/comics` for a user with
  no history") is observable but not implementable without a decision.
- Failure scenario: an agent picks `localStorage`, so the redirect cannot run on
  the server and `/` flashes or hangs on the phone; or it adds a column to
  `users` and a write on every page view.
- Resolution: state it — a `medium` cookie written by the three dashboard
  routes, read in the `/` route handler. No schema change.
- Proceed without fixing? Not past 1.8.

### LOW (5)

1. **Run-detail thumb bar has no owner.** CLAUDE.md and FEATURES 2c specify the
   bar on the run detail (`Mark #141 read · Mark through… · +`), but 1.8's scope
   is "the chrome every dashboard sits in" and 1.1 only builds *Mark through*.
   Name the run detail in 1.8.
2. **2.2's *Reading now* promises "evenings"** at the owner's session length
   while 2.1b hides session-derived surfaces until five sessions exist. What the
   slot shows at zero sessions is unstated.
3. **Saved views are specified twice** — 2.9 and 6.10 — with no note that one
   supersedes the other.
4. **2.3's *Remove from plan* has no undo**, while every neighbouring
   destructive action does.
5. **Dark-mode `--faint`** is `#69727f` in `globals.css:43,60` but `#8a93a2` in
   the mockups, where `#69727f` is the *decorative* value — i.e. dark mode uses
   the rules colour for text. New evidence on **R0-08**, not a new finding.

## 6. DECISION NEEDED

### D-R1-1 Is `blocked` still the right default, now that 180 of 259 runs are blocked?

The docs assume a catalog where a minority of runs are held (27) and a healthy
frontier of ready ones (41). The data says 181 runs have a hard prerequisite and
30 have none at all. The docs do not settle this because the figures they argue
from were never recomputed. Options:

- **(a) Keep the design, fix the numbers.** *Unlocked and waiting* shows ~30
  runs; the blocked switch hides 180. Cheapest; the run list defaults to 79 rows.
- **(b) Default the blocked switch to "shown"** and rely on the badge. The list
  stays complete; 70% of rows carry an amber badge, which dilutes amber.
- **(c) Treat the prerequisite graph as over-specified** and audit it (many of
  the 230 hard edges may deserve to be soft) before 2.4 is built on it.
- **(d) Make the frontier the run list's default view** rather than a slot.

Recommendation: **(a) now, and schedule (c)** — (c) is data work the owner must
do, and R0-01's cycles have to be resolved anyway; doing both in one pass is one
sitting. Blocks 2.4 and 2.9.

### D-R1-2 Is 2.1b (reading sessions) worth its cost inside HORIZON?

2.1b costs a session sheet, a timer chip in three thumb bars and the desktop
sidebar, Settings integration, and two derived surfaces that stay hidden until
five sessions exist — to replace two numbers the owner types once. FEATURES
calls it "the highest-leverage thing that was missing"; that is a recommendation,
not an owner decision, so it is open. Options: **(a) keep whole**; **(b) keep
after-the-fact minutes entry only, defer the timer chip and *Tonight* card to
Phase 6**; **(c) cut, and let the owner retype the two settings**. Recommendation:
**(b)** — it preserves the honest-input argument at a fraction of the surface
area, and unblocks 2.1's capacity numbers immediately. Blocks 2.1b, 2.2.

## 7. Proposed ACCEPTED RISK

- **R1-AR1 No cross-device staleness handling.** The owner uses a phone and a
  desktop; a mark on one is invisible on the other until reload. Server
  components plus a router refresh on write cover the same-device case, and two
  devices in the same minute is rare for one person. Revalidation machinery is
  not worth it. Owner confirms or rejects.

## 8. NOT A VALID ISSUE

- Colour-alone meaning: every readiness state carries a glyph *and* text, checked
  across mockups, FEATURES 2h and ARCHITECTURE §4. Sound.
- Tap targets: 44px thumb bar / icon buttons and a 24px floor are specified as
  tokens with a `getComputedStyle` check in 1.8 and a per-element check in 2.2.
- Keyboard operation of the queue: fully specified (Space/arrows/Space/Esc with a
  live region) — better than most drag implementations ship.
- Dark-mode `--blocked`: defined in both files (`#d7a161`); only the light value
  differs, which is R0-08.
- Status-tab deep links: the tab is in the URL, so back and refresh survive.
- "Five states, one badge partial": one component named, asserted identical
  across phone and desktop frames in 2.4's check.
- First-run empty states: unreachable in practice (cutover loads 10,840 rows).

## 9. Sound — do not change

- **The telescope spec (2.5).** Geometry as a pure exported function with three
  named unit tests, a text-equivalent ladder, an `<svg><desc>`, an 11px floor and
  three named variants. It is the only screen in the set whose acceptance check
  could not be passed by something that looks right and is wrong.
- **Per-run read state and the grey hint (0.8 / 2.14).** The rule that the hint
  never ticks a box, is hidden on rows already read here, and that *Adopt* is
  explicit and undoable, is consistent across ARCHITECTURE, FEATURES, TASKS and
  the mockup. Do not "helpfully" propagate marks.
- **Amber means held, and clears when you decide.** Including by accepting the
  overage, persisted with a date. This is the single best product decision in the
  documents; resist any future "just make it red when over".
- **The live-API state trio** (loading / rate-limited with `Retry-After` /
  error), each `role="status"`, each offering *Type it instead*, with the
  catalog matched before any API call.
- **Review tables have one shape** across bulk add, search add and the Phase 7
  diff, with the sticky bar counting the real write, not the line count.

## 10. Out of horizon

- 8.7's watch telescope reuses `data-rails="2"`; 2.5 must not hard-code three rails.
- 3.6 (eras) needs `run_issues.era_id` from 0.3 — already sequenced correctly.
- 6.4's offline queue is the only consumer of 1.8's `queued` pill state.
- 5.2 `/comics/tracks` is the target of a sidebar link shipped in 1.8 (R1-06).
- `seed/*.csv` are pre-0.7 shape (positional issue ids, `runs.writer`); the
  figures above are robust to that, but R2 should confirm the rebuild's
  row-count comparison still matches.
