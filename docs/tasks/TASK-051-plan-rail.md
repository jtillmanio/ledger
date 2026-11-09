---
id: TASK-051
title: 2.2b The plan rail
status: In progress
depends_on: [TASK-049, TASK-011]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b2889c3
---

# TASK-051 — 2.2b The plan rail

## Goal

The plan draws as a rail. Each quarter is a column, each book a block sized by its word count and stacked in your order, and a dashed rule marks quarterly capacity. The part over the rule is hatched, so the books past capacity are always the ones you ranked last. Bare-year entries sit in a fifth lane. The dashboard's *This quarter* strip is this rail drawn for one quarter.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2b The plan rail (M10, last; pulled ahead of cutover by 1.25: 2.0 → 2.1 → 2.2 → 2.2b, then 2.3, before 1.26). The roadmap entry and its **Check:** are the contract. Split out of 2.2 (R3-12). Features: F-22. Depends on 2.2 (TASK-049, the slot) and 1.7 (TASK-011, `plan_period`); the rule is 2.1's quarterly capacity (TASK-046).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the component and its layout rules (stacking, the hatch above the rule, the merged stacks, the fifth lane), its query, the dashboard strip's swap to it, the skeleton's re-measure and its tests at three widths come to more than 8 files.
- **The rail** (`docs/04-design.md` § 6. The plan rail; `design/STYLE_GUIDE.md` §3; `design/Plan Rail Spec.dc.html` A4.1, A4.2): a quarter is a column, a book is a block sized by its word count, a dashed rule across all four columns is the quarterly capacity. Blocks stack from the foot of the column in the quarter's `ordinal` order (D-37), so the cumulative total crosses the rule at the end of your order: only **the part of a block above the rule** takes `--hatch` over `--blocked-soft`, and that block's ring turns `--blocked`, its label on a `--surface` chip over the hatch. A fifth lane behind a dashed border holds bare-year rows; it has no order (D-37) and stacks largest at the foot. On deck and Someday are not on the rail (they count against no capacity). There is no month layout and no *Quarter | Month* control (D-38).
- **Every block is a `<button>`** with an accessible name (*Piranesi, 65k words, estimated, Q1 2027*) and at least a 24×24px hit area; two or more adjacent sub-24px blocks merge into one `+N · Nk` stack button (`--raise`, dashed `--faint-deco`, height the sum or 24px, whichever is larger); a lone sub-24px block keeps its drawn height and gets a 24px `::after` hit area. Estimated counts (`data-wc="estimated"`) have a dotted top edge and a `~` prefix, with a legend tag.
- **One rail markup** (M-07), the same on the dashboard and the plan page (2.10): `button.qb` with the book's genre hue in `--hue` (one book, one hue), `.over` for a block past the rule, `.un` for a fifth-lane entry (a button, not decoration), `data-wc` for estimated counts. No inline fills (Hard rule 6: custom properties only). Quarter footers carry an amber *over Nk* badge or a grey *Nk room* badge, never green (M-06); **on the phone the footer shows only the amber overage** (`+132k`); the grey room badge is desktop only (SG-D11).
- **Geometry:** 230px tall on the phone and 300px on desktop, scaled so 1000k fills a quarter column; columns 6px apart on the phone, 10px on desktop; the fifth lane 52px on the phone and 150px on desktop (*2027 · no quarter*), with a 1px dashed `--blocked` left border and `.un` blocks in `--blocked-soft` with a dashed `--blocked` ring; a block is radius 3 with a 3px `--hue` left edge on `--reading-soft`, gap 2; the capacity rule is 1.5px dashed `--ink-2`. Measurements in the design files are geometry, not data (D-7 applies to their figures, not their pixels).
- **The dashboard strip** (FP-D8): 2.2 (TASK-049) draws *This quarter* as a single-quarter strip; this task draws it with this component as a one-quarter rail (its desktop strip fills its card's inner width, each block k / 760 of it, the rule at the right edge: the plan says how the one component draws both a column and that horizontal strip). The four-column rail's own screen is `/books/plan` (2.10), not built here.
- **Open, ask at the plan gate: what a tap does before 2.3.** The entry says tapping a block opens 2.3's picker sheet; 2.3 (M11) is built after this task. Until it lands, a block is still a `<button>` with its name (the Check measures it), and the plan says what it does (nothing yet with a visible reason, or opens the book's Library row). Note it in 2.3's entry as a follow-up.
- *From 1.8d (TASK-027):* `PlanRailSkeleton` (`src/components/Skeleton.tsx`) was measured against a fixture of the mockup's markup (`test/e2e/fixtures/plan-rail.html`, `test/e2e/skeletons.spec.ts`); re-measure it against this component, within 2px at 360px.
- Moving a book in the Check uses the existing plan helpers (`moveToTop`, `reorderQuarter` in `src/db/writes.ts`); no new write is needed.
- Design: mockups `bdash` (the strip), `plan` and `planmonth` (*Plan rail — estimates, stacks, drag*; month retired, D-38) in `design/mockups.html`; captures `design/captures/1.8a/planmonth-*.png`. Desktop drag (ghost, live readout) is 2.3/2.10's, not this task's.
- Decisions: D-37, D-38, D-40, D-7, M-06, M-07, SG-D11, FP-D8, R3-12.
- *From TASK-049 (2.2, PR #196):* the books dashboard's *This quarter* strip is `src/components/QuarterStrip.tsx`, with markup kept close to this rail's (M-07). Replace its markup and class names with this component drawn as a one-quarter rail, so there is one rail markup.
- *From TASK-049 (2.2, PR #206):* the strip's markup is `.qrail > .qcol > .qstack > .qcell`, laid on its side, and its `.qcol` and `.qstack` rules are scoped under `.qrail` in `src/app/globals.css` because the vertical rail's own `.qcol`, `.qstack` and `.qfoot` (and `PlanRailSkeleton`) already use those names; its footer is `.qfigs`, not `.qfoot`. When this component replaces the strip, fold the two sets into the one rail's rules and drop the `.qrail` scoping. The strip's figures come from `planCapacity` and its blocks from `quarterBlocks` (`src/db/queries.ts`), whose words sum to the quarter's `plannedWords`.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a quarter whose books total 892k against a 760k capacity renders
exactly the blocks past 760k as hatched, and those are the quarter's highest
ordinals; moving the last hatched book to the top of the order renders it plain
and leaves the quarter's total unchanged. A book with `period = '2027'`
renders in the fifth lane and in no column. A block straddling the rule is
hatched above the rule and plain below it. Every interactive element inside
`.planrail` measures at least 24×24 CSS px, an estimated book renders the dotted
edge and `~` label, the rail renders without horizontal page overflow at 360px,
and no *Quarter | Month* control renders anywhere. At 360px no quarter footer renders a *room* badge; at 1280px an
under-capacity quarter does. Nothing resolves to `--danger`. Screenshot at 360px
and 412px.
- [ ] AC-2: The layout function, unit-tested with no browser: given a quarter's books in ordinal order with their word counts and a capacity, it returns for each block its drawn height at the rail's scale (1000k = the column height), whether it is over, and for a straddling block the split point at the rule; given three adjacent blocks each under 24px it returns one stack of `+3` with their summed words; given one lone sub-24px block it returns that block unmerged.
- [ ] AC-3: Each block's accessible name gives its title, its word count rounded to k, *estimated* when its count is, and its period (*Q1 2027*, or *2027* in the fifth lane); a stack button's name says how many books and how many words it holds.
- [ ] AC-4: On the dashboard, *This quarter* is drawn by this component: its planned total still equals TASK-046's figure for the current quarter, and the over part of its last block is hatched when the quarter is past capacity. `PlanRailSkeleton` measures within 2px of the loaded rail at 360px.
- [ ] AC-5: The rail meets the UX floor (`docs/04-design.md` § 10. The UX floor): every block and stack is a real `<button>` with a name and a hit area of at least 24×24px; the hatch, the rule and the badges hold 3:1 against their background in both themes; over-capacity is amber with text (*over Nk*, *+Nk*), never colour alone and never red; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- `/books/plan` and the full-size rail page (2.10), the plan editor and its picker and move sheets (2.3), rebalance and *Accept* (2.7, the grey `--hatch-settled`), *Place them* (2.8).
- Desktop drag between quarters (2.3/2.10).
- Any month layout or control (D-38).
- Changing how capacity is computed (2.1, TASK-046).

## Files likely touched

- `src/components/PlanRail.tsx` (new) — the rail, the fifth lane, footers, the one-quarter strip.
- `src/lib/plan-rail.ts` (new) — the layout: heights, the over split, merged stacks.
- `src/db/queries.ts` — a year's or a quarter's blocks: book, words and source, ordinal, period, genre hue.
- `src/app/globals.css` — `.planrail`, `.qb`, `.over`, `.un`, the hatch, footers, from tokens only.
- `src/components/QuarterStrip.tsx` (from TASK-049) — draws through `PlanRail`.
- `src/components/Skeleton.tsx` — `PlanRailSkeleton` re-measured.
- `test/plan-rail.test.ts` (new), `test/e2e/plan-rail.spec.ts` (new), `test/e2e/skeletons.spec.ts`.

## Verification

- Automated: `test/plan-rail.test.ts` (AC-2, AC-3's names); `test/e2e/plan-rail.spec.ts` on the TEST database (the 892k / 760k quarter, `moveToTop` and the re-render, the fifth lane, the straddle, 24×24 hit areas, estimated edge, no overflow at 360px, footers at 360 and 1280, no *Quarter | Month*, `--danger` absent, screenshots); `test/e2e/skeletons.spec.ts` (the re-measure).
- Manual: `npm run dev`, open `/books` with a quarter planned past capacity → the last books in your order are hatched above the dashed rule; reorder one of them to the top (Reorder), see it plain, then put the order back.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 2.3: until the picker sheet exists, a rail block is a `<button>` in a GET form to `/books/list?q=<title>` (it opens the book's Library row); 2.3 swaps that for the picker sheet, on the dashboard strip too (approved at plan) → planned: `docs/05-roadmap.md` § 2.3
- 2.10: the rail's four-column Check items (columns, fifth lane, footers at 360 and 1280) were proven on a staged render, since `/books/plan` didn't exist; re-run them on the real page (approved at plan) → planned: `docs/05-roadmap.md` § 2.10
- Candidate decision: a merged stack sits at its exact word position and keeps its drawn height, with its 24px hit area from `::after` like a lone block, so the hatch is exactly the words past capacity; this departs from STYLE_GUIDE §3's "height = the sum or 24" (owner, at the plan gate) (approved at plan) → planned: `docs/review/decisions.md` (new D-n, from `next-id.ps1`)
- Candidate decision: a book's rail hue is a stable hash of `books.genre` onto `--g1`…`--g7`, `--g8` when it has none (owner, at the plan gate) (approved at plan) → planned: `docs/review/decisions.md` (new D-n)
- Candidate decision: the dashboard's *This quarter* strip is the rail drawn on its side; it keeps the feel pass's fills (`--sunk`, a `--ready` fill when read, the `--brand` ring on the book in hand, D-40) and takes the rail's states (buttons, the hatch above the rule, the dotted `~` estimated edge, stacks); `--hue` is in the markup but not drawn on the strip (owner, at the plan gate) (approved at plan) → planned: `docs/review/decisions.md` (new D-n)

## Plan

_Approved by the owner at the plan gate, 2026-11-09 (planned on Opus; implement on `model: sonnet`). The four open points were decided there: block tap opens the Library, the strip keeps the feel-pass fills, the hue is a genre hash, words decide the hatch._

### Decisions taken at the gate

1. **Tap before 2.3:** every book block is a real `<button type="submit">` inside a GET `<form action="/books/list">` with a hidden `q` = the book's title, so it opens the book's Library row. No client JS. The form is `display:contents` so it doesn't touch the layout. A stack holds several books, so it has no single row to open: see Risks 1.
2. **The strip's look:** the feel pass's fills stay on the dashboard strip (`--sunk` cells; read fills `--ready`, text `--on-ready`; the book in hand a 1.5px `--brand` ring). The rail's states are added: buttons, the hatch on the part past the rule with the block's ring `--blocked`, the dotted estimated edge (on the strip, the leading edge: the right edge, as the strip grows rightwards) and `~` label, stacks. `--hue` is set in the markup (M-07, one markup) and drawn only by the vertical rail.
3. **Hue:** `genreHue(genre)` in `src/lib/plan-rail.ts`: a stable string hash (e.g. FNV-1a over the lower-cased, trimmed genre) mod 7 → `--g1`…`--g7`; null/empty → `--g8`. Unit-tested: same genre → same hue, case/space-insensitive, null → `--g8`.
4. **Words decide:** a block's position along its column is its cumulative words exactly (offset = words before it × scale), its size its own words × scale. The 2px gap is drawn *inside* each block (a 2px transparent edge on the far side, `background-clip: content-box` or an inset pseudo), so gaps never shift anything and the rule sits exactly at capacity. A merged stack keeps its drawn height (the sum) and gets its 24px hit area from `::after`, exactly like a lone sub-24px block; its `+N · Nk` label may overflow its drawn box onto a `--surface` chip, centred on it. A block is over when its end (cumulative words including itself) > capacity; its over part is `end − max(start, capacity)` words; a straddling block's split is at `capacity − start` words from its start.

### Steps

1. **Layout** (`src/lib/plan-rail.ts`, new, no React, no DB): types `RailBook { id, title, words, estimated, period, genre, status }` and `RailItem = { kind: "block", book, start, size, overSize, over } | { kind: "stack", books, words, start, size, overSize, over }` (start/size/overSize in px). `layoutColumn(books, { length, scale, capacity, min = 24 })` — `length` px stands for `scale` words (1000k for a column; the strip passes `max(planned, capacity)` as today), books in the order given; runs of ≥2 adjacent books each `< min` px merge into one stack; a lone one stays a block. `layoutLane(books, opts)` sorts largest first (at the foot) then calls `layoutColumn` with `capacity = Infinity` (the lane counts against no capacity). Also `railName(book)` → *Piranesi, 65k words, estimated, Q1 2027* (stated: no word; bare year: *2027*), `stackName(stack)` → *3 books, 84k words*, `periodName(period)`, `kWords` (moved here from `QuarterStrip.tsx`, re-exported or imports updated), `genreHue`. Merging is decided at the phone's length (230px column; the strip's 360px card inner width, 296px), so a block that clears 24px on the phone clears it on desktop too; px values are emitted as CSS lengths relative to the rail height (see step 4) so the drawing scales between 230 and 300.
2. **Query** (`src/db/queries.ts`): `planRail(userId, year)` → `RailBook[]` for `period IN (year, year-Q1…Q4)` from `plan_book_words` (so words sum to `plan_capacity`'s `planned_words` per quarter) joined to `reading_plan` for `ordinal` and `books` for `title`, `genre`; `estimated = word_source = 'estimated'`; `words IS NOT NULL` only (a book with no count draws no block, as today); order `period, ordinal NULLS LAST, title, id`. `quarterBlocks` gains `estimated` and `genre` (the strip's blocks); the TASK-049 test that its words sum to `planCapacity` still holds.
3. **Component** (`src/components/PlanRail.tsx`, new, server component): `PlanRail({ year, books, capacity, quarters })` draws `.planrail` (the four `.qcol` and the `.qcol.nq` fifth lane, the `.caprule` with its `760k` label on `--surface`, each column's `.qfoot`, and the legend: `~ estimated`, `over capacity`, `+N · merged under 24px`, `year, no quarter`), and `PlanRail` with `axis="row"` and one quarter draws the strip's rail (`.planrail.row`, no footers or legend: the card's `.qfigs` stay the strip's figures). Every block: `button.qb` with `--hue`, `.over`, `.un` (fifth lane), `data-wc="estimated"`, `data-state` (`read` / `head`, used by the strip), its size and offset as custom properties (`--at`, `--sz`, `--ov`), never a fill. Footer: phone `Q1` + `892k` + amber `+132k` only when over; from 1024px `892k / 760k` + `over 132k` (amber, `.bdg.bl`) or `56k room` (grey, `.bdg.dn`): both spans rendered, CSS hides the desktop ones under 1024px (so the 360px check finds no *room* text rendered visibly — the test checks visibility, see Test strategy). Fifth lane footer: `2027` (phone) / `2027 · no quarter` (desktop), the summed words, a count badge.
4. **CSS** (`src/app/globals.css`, tokens only): fold the strip's `.qrail` rules into the rail's (`.planrail`, `.qcol`, `.qstack`, `.qfoot`, `.qb` …) and drop the `.qrail` scoping; `--rail-h: 230px` (phone) / `300px` (≥1024px); a block's px = `calc(var(--sz) * var(--rail-h) / 230)` where `--sz` is the phone-px from the layout (or emit unitless fractions of the length and multiply by `--rail-h`; pick one and keep it). Columns gap 6px / 10px; fifth lane 52px / 150px with a 1px dashed `--blocked` left border; `.qb` radius 3, `--reading-soft`, inset 1px `--rule` ring, 3px `--hue` left edge (`::before`); `.qb.over` ring `--blocked` and an `.ov` child (or `::after`-free layer) `--hatch` over `--blocked-soft` sized `--ov` at the far end; the hit area `::after` (min 24×24, centred) on any block or stack drawn under 24px; `[data-wc="estimated"]` 1.5px dotted `--muted` top edge (strip: right edge); `.qb.un` `--blocked-soft` with a dashed `--blocked` ring; stack `--raise`, dashed `--faint-deco`; `.caprule` 1.5px dashed `--ink-2`. The strip (`.planrail.row`): horizontal, 28px tall, the rule at capacity along its length, feel-pass fills via `data-state`. Delete the now-unused `.qcell`, `.qcap`, `.qstack i.over/.fits/.unplaced` rules. Nothing resolves to `--danger`.
5. **Dashboard** (`src/components/QuarterStrip.tsx`): keeps the card, head and `.qfigs` (2.1's figures unchanged), and draws its rail through `<PlanRail axis="row" …>`; `src/app/books/page.tsx` only if the props change. `src/components/Skeleton.tsx`: `PlanRailSkeleton` re-measured to the component (230px column at 360px, footers), `QuarterStripSkeleton` to the new strip if its box moved. Delete `test/e2e/fixtures/plan-rail.html` (its header says this task deletes it).
6. **Mockup redraw** (`design/mockups.html`, `design/mockups-index.md`): the `bdash` frame past capacity (*Between books*, desktop, *52k over*) draws the hatch on its last block's part past the rule and the strip's blocks as `button.qb`; the index line says so (task 2.2b). `plan` and `planmonth` already use `button.qb` (M-07): no redraw.
7. **Tests** (below), then the verify chains.

### Files

- `src/lib/plan-rail.ts` (new) — the layout, names, hue, `kWords`.
- `src/components/PlanRail.tsx` (new) — the rail and its strip form.
- `src/db/queries.ts` — `planRail`; `quarterBlocks` gains `estimated`, `genre`.
- `src/app/globals.css` — one set of rail rules, the strip folded in.
- `src/components/QuarterStrip.tsx` — draws through `PlanRail`.
- `src/components/Skeleton.tsx` — `PlanRailSkeleton` (and `QuarterStripSkeleton` if needed) re-measured.
- `src/app/books/page.tsx` — *not in "Files likely touched"*: only if the strip's props change.
- `design/mockups.html`, `design/mockups-index.md` — *not listed*: the `bdash` past-capacity frame is redrawn (`ui.redrawFiles`).
- `test/plan-rail.test.ts` (new), `test/e2e/plan-rail.spec.ts` (new), `test/e2e/skeletons.spec.ts`.
- `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/loading-states.test.tsx` — *not listed*: they pin the strip's old markup (`.qcell`, `qrail`).
- `test/e2e/fixtures/plan-rail.html` — deleted.

### Test strategy

- **AC-1** (the Check): split by what each half needs.
  - `test/plan-rail.test.ts` › *the Check on the test database* (vitest, `TEST_DATABASE_URL`): a 2027 fixture under its own ids, Q1 = six books totalling 892k at a 760k capacity (settings fixed so a quarter is 760k: set `reading_settings` so `wordsPerYear / 4 = 760_000`, or assert against `planCapacity`'s figure, D-7), one straddling the rule; render `PlanRail` with `renderToStaticMarkup` from `planRail()`: the `.over` buttons are exactly the books whose cumulative words pass the quarter's capacity, and they are the highest ordinals; `moveToTop` the last hatched book → re-query and re-render: that book has no `.over`, Q1's planned total (`planCapacity`) is unchanged; a `period = '2027'` book is inside `.qcol.nq` and in no other `.qcol`; no element names *Month* or has `role="tablist"`.
  - `test/e2e/plan-rail.spec.ts` (rendered from the same kind of fixture, staged into a signed-in page's `<main>` as `skeletons.spec.ts` does, so it gets the real CSS and width): the straddling block's hatch layer's top edge is the rule's y (±1px) and its plain part ends at the rule; every `button`, `a`, `input` inside `.planrail` has a hit box ≥ 24×24 (`elementFromPoint` across the 24px `::after` or the box, whichever is larger); `[data-wc="estimated"]` has a dotted top border and a label starting `~`; `expectNoHorizontalScroll` at 360px; `getByText(/\bmonth\b/i)` count 0 and no *Quarter | Month* segmented control anywhere on the page; at 360px no visible *room* text in any `.qfoot`, at 1280px the under-capacity quarter's footer shows *room*; no computed colour in `.planrail` equals `--danger`'s; screenshots `plan-rail-360`, `plan-rail-412` (and every `ui.viewports` width, light and dark, for AC-5).
- **AC-2** `test/plan-rail.test.ts` › *layout*: heights at 230px / 1000k; `over` and the straddle's split at the rule; three adjacent sub-24px books → one stack `+3` with their summed words; a lone sub-24px book → one block, unmerged; the fifth lane largest at the foot.
- **AC-3** `test/plan-rail.test.ts` › *names*: *Piranesi, 65k words, estimated, Q1 2027*; a stated book omits *estimated*; a fifth-lane book ends *2027*; a stack *3 books, 84k words*.
- **AC-4** `test/books-dashboard.test.ts` (the strip renders `.planrail.row` with `button.qb`; its planned figure still equals `planCapacity`'s for the quarter; past capacity the last block carries `.over` and a hatch layer sized to the overage) and `test/e2e/books-dashboard.spec.ts` (selectors moved from `.qcell` to `.qb`; the strip's over part is hatched in the past-capacity state); `test/e2e/skeletons.spec.ts` (*the plan rail skeleton is the plan rail's size*: staged `PlanRail` from a fixed set of books, not the fixture file, within 2px at 360px).
- **AC-5** `test/e2e/plan-rail.spec.ts`: axe (`button-name`, `target-size`, `color-contrast`) on the staged rail; the hatch, the rule and the badges ≥ 3:1 against their background via `contrastFailures` / `tokenColour` in light and dark; over-capacity badges carry text (*over Nk*, *+Nk*) and use `--blocked`, never `--danger`; screenshots at every `ui.viewports` width, light and dark (projects).
- `genreHue` and `kWords` unit tests in `test/plan-rail.test.ts`.

### Risks / open questions

1. **A stack's tap before 2.3**: a stack opens 2.3's list sheet; until then a stack is a `<button type="button">` with its name (*3 books, 84k words*) and no action, plus a visually-hidden or legend note that the list comes with the plan editor. If that reads as a dead control in review, fall back to `aria-disabled="true"` with the legend line as its visible reason (UX floor). Not a gate question: say which in the PR.
2. **No four-column page exists** (2.10 builds `/books/plan`): the Check's column items are proven on a staged render in a real browser with the app's CSS. Follow-up to 2.10 to re-run them there.
3. **Responsive px from one server render**: merging is decided at the phone's length so desktop never drops under 24px; sizes scale with `--rail-h`. A block that is 24px on the phone is ~31px on desktop; fine.
4. **Label in a sub-24px stack** may overflow its drawn box (words decide); its label sits on a `--surface` chip like the over labels. Check it in the screenshots.
5. `test/loading-states.test.tsx` pins `class="sk qrail"`; the skeleton's class changes with the strip.

### Size

About 14 files, schema untouched. The task file records why it stays one task (`autonomy: attended`); the owner kept it whole at the gate.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
