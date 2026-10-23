---
id: TASK-017
title: 1.9 Status screens: In flight · Up next · Done
status: Ready
depends_on: [TASK-016]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ae64628
---

# TASK-017 — 1.9 Status screens: In flight · Up next · Done

## Goal

For comics and for books, one screen answers three questions: what am I in the middle of, what's next, and what have I finished. Each answer has a tab, in that order, with an honest count.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.9 Status screens: In flight · Up next · Done (sitting 7, after 1.10). The roadmap entry, its comics/books table and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): one three-tab component used by two media, comics' queue and *Ready, not queued*, books' plan-by-level with in-quarter reordering, Done with *Stopped*, six drawn empty slates, and the master list's level filter.
- Architecture: `docs/04-design.md` § 11. Interface (*Every medium has the same three-tab status screen*; the In flight · Up next · Done table). `.claude/rules/ui.md` (the same three tabs, in that order, under those names; nothing about them is stored).
- Data model: every row comes from `run_queue_state` (TASK-016), `run_progress`, `run_readiness`, `run_state` (`finished_at`), `plan_period` and `to_read_level` (TASK-011), and `book_status`. Only the queue's order and each quarter's order are stored. Quarter reordering uses TASK-011's helpers, within one quarter only.
- Design: mockup `status` (comics' three tabs and their empty slates) and `queue`. STYLE_GUIDE §9 *tab strip* (UX-N22: 44px tabs, mono 11 counts, a 2px `--m-*` underline that is one element sliding between tabs over `--dur-2`). design §14 (empty-slate copy). This task draws books' three empty slates in `design/mockups.html` and closes *Not shown* #6 for comics and books (`ui.redrawFiles`).
- Decisions: D-26b (every meter fills with `--ready`; one `.meter` style), D-37 (the levels), D-13 (the plan starts empty, so books Up next's empty action is *Add a book*), R1-10 (the bare-year lane is grey with no button until 2.8), S-14 (undated finishes sort last), S-L5, M-08, UX-X07.
- Builds on TASK-003 (the resume pointer: *Read <label>* in In flight), TASK-008 (the *Add a book* sheet), TASK-010 (`read` and DNF), TASK-014 (shell, nav `enabled` flips for *Status*).
- *From TASK-028 (1.8e, PR #111):* the mockup's tab counts fail 4.5:1. `.seg span .n` is at `opacity:.8` (axe, light), and the count on the selected, `--brand`-filled tab resolves to `--faint` (about 1:1) instead of `--on-brand`. 1.8e fixes both in the 834 frame only. Don't copy either: a count takes its tab's text colour, `--on-brand` when selected.
- *From TASK-016 (1.10, PR #115):* `/comics/status` exists with the Up next content only: `<h1>Up next</h1>`, *Your queue* (`QueueList`, the shared queue row, M-08) and *Ready, not queued* (`readyNotQueued`, `ready_all` only, by tier and size). The dashboard's *Reorder* and *In Up next · #N* link to `/comics/status?tab=next`, so keep that URL. This task adds the tablist around it, the *Status* h1 and the nav flip; *Ready, not queued* still needs `ready_hard` after `ready_all`, in track → block order (design §11.2). `src/app/comics/status/loading.tsx` and its budget row (2 queries) exist.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): seeded test: a run with 3 of 10 placements read is in In flight and not in Up next, even if it is queued; queued unstarted runs appear first, in queue order; a ready run that isn't queued appears under *Ready, not queued* and not above it; a queued blocked run appears in the queue with its amber badge; an unqueued blocked run appears in neither section; a run with all placements read is in Done; a run whose issues are all read *in other runs* is not in Done (0.8); a run finished with undated reads sorts below one finished last week. A book planned `2027` appears after 2027's quarters and before On deck, with no drag handle. Three books planned `2027-Q1` render in ordinal order, and the keyboard sequence (Space, Down, Space) on the first leaves that quarter at a contiguous 1–3 with it second; a lift never carries a row into another quarter. A `to_read` book with no plan row is not on the tab, is counted in *Someday · N books*, and appears when that row opens the master list at `?status=to_read&level=someday`. A DNF book appears only under Stopped. Tab counts equal row counts. Each tablist contains exactly one underline element. Screenshot at 360px, including every empty tab.
- [ ] AC-2: `/comics/status` and `/books/status` render one shared component. The tab is in the URL (`?tab=inflight|next|done`) and survives a reload. The tabs are `<a role="tab" aria-selected>` links in a `role="tablist"` with arrow-key navigation. The *Status* items in TASK-014's `NAV_ITEMS` are enabled in this PR.
- [ ] AC-3: `/books/list`'s *To read* filter gains *All · Quarter · Year · On deck · Someday*, read from `to_read_level`, with `?level=` in the URL. Each level shows exactly the books `to_read_level` assigns to it.
- [ ] AC-4: The bare-year lane renders grey with its count and no button. Nothing on it resolves to `--blocked`. Each of the six empty slates (three per medium) has the design §14 copy and exactly one primary action, and books *Up next*'s action is **Add a book**, opening TASK-008's sheet.
- [ ] AC-5: The dashboard's *Also reading* row, the Up next shelf's head and *Ready when you are → All N* each link to the matching tab, with N computed. In flight's resume button is named for its target (*Read <full label>*), truncated with a `title`.
- [ ] AC-6: Both status screens meet the UX floor (`docs/04-design.md` § 10. The UX floor): every tab, populated and empty, at every `ui.viewports` width, light and dark; loading skeletons at the loaded size; 44px tabs; the underline moves without easing under reduced motion; DNF's *Stopped* is a `<details>` with a `<summary>` count; axe reports no new violations.

## Out of scope

- Watch's status screen (8.8).
- Cost and leverage on *Ready, not queued* (2.6), and *Place them* on the bare-year lane (2.8).
- Moving a book between quarters (2.3's sheet), and planning a book into a quarter (2.3).
- Run and block completion screens (2.12).

## Files likely touched

- `src/app/comics/status/page.tsx` (new), `src/app/books/status/page.tsx` (new).
- `src/components/StatusTabs.tsx` (new), `src/components/QueueList.tsx` (reused for quarters), `src/components/EmptySlate.tsx` (new or from the shell).
- `src/db/queries.ts`: In flight, Up next and Done for both media, *Someday · N*, tab counts.
- `src/app/books/list/page.tsx`: the level control.
- `src/components/nav/` (`NAV_ITEMS`): enable *Status*.
- `src/app/globals.css`: tab strip and underline, `.stopped`.
- `design/mockups.html`, `design/mockups-index.md`: books' three empty slates; close *Not shown* #6 for comics and books.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json`: the two new top-level screens.
- `test/status.test.ts` (new, DB), `test/e2e/status.spec.ts` (new).

## Verification

- Automated: `test/status.test.ts` against `TEST_DATABASE_URL` covers every placement rule in AC-1, the level filter and the counts (AC-1, AC-3). `test/e2e/status.spec.ts` covers the keyboard reorder within a quarter, the URL tab, arrow keys, one underline, the empty slates, the links from the dashboard, and screenshots (AC-1, AC-2, AC-4, AC-5, AC-6). Lighthouse on the preview, with the new routes in `scripts/perf/routes.mjs`.
- Manual: on the Vercel preview at 360px, open each tab for comics and books → expected: the right rows, counts that match, and an empty slate with one action where a tab is empty.

## Follow-ups

Found while planning; placed on `docs/plans-2026-10-23` (approved at plan, 2026-10-23).

- AC-5's *Also reading* row is part of 2.4's hero, which is not built yet. This task links the dashboard's *Mid-run* head to `?tab=inflight`, and 2.4 links *Also reading* there → docs/05-roadmap.md § 2.4 Comics dashboard (approved at plan)
- *with words left* (books In flight) has no data: `book_status` stores no reading position, so this task shows the word count → docs/05-roadmap.md § 1.9 Status screens (approved at plan)
- Where a book's reading position would be stored, and which task builds it, is the owner's question (a schema column) → docs/OWNER-CHECKLIST.md § Decisions waiting on you (approved at plan)
- *track → block order* for *Ready, not queued*: `tracks` has no order column, so it is track name, then `block_ordinal`, then `run_ordinal`, unblocked runs last → docs/review/decisions.md § D-79 (approved at plan)
- Books' three empty status slates had no source copy; the copy in Risks 1 is the owner's → docs/04-design.md § 14. Per-screen refinements (approved at plan)
- Context says "the *Status* h1", but the mockup has *Runs by status* / *Books by status*, and the mockup wins on copy (D-1) → not tracked: resolved in this plan

## Plan

Provisional: no (TASK-016 is Done). Large by policy (`never-split`, attended): two media × three tabs, a shared reorder engine, the books list filter and the mockup redraw.

**Steps**

1. **Queries** (`src/db/queries.ts`):
   - `inFlightRuns(userId)`: the `inProgressRuns` columns plus a `last_read_at` lateral (MAX `completed_at`), ordered `last_read_at DESC NULLS LAST, r.id`. `inProgressRuns` keeps its order for the dashboard hero.
   - `readyNotQueued` gets its own SQL: unqueued, `rp.state='unread'`, readiness `ready_all` then `ready_hard`, then track name → `block_ordinal` → `run_ordinal`, runs with no block last; still `LIMIT 50` with `total`.
   - `doneRuns(userId)`: `run_state` `state='read'`, ordered `finished_at DESC NULLS LAST, title`.
   - `booksInFlight` (`reading`, with `word_count`).
   - `booksUpNext`: `plan_period` ⨝ `book_status='to_read'`, with level, year, quarter and ordinal, ordered year → quarter → ordinal / title, then On deck by title. It also returns `someday` = the count of `to_read_level` rows at level `someday`.
   - `booksDone`: `read` with `extract(year FROM finished_on)`, newest first and *No year* last, plus `dnf` rows.
   - `listBooks` gains `level?: 'quarter'|'year'|'on_deck'|'someday'`, filtered through `to_read_level`.
2. **The quarter move** (`src/db/writes.ts`, not in Files likely touched): `moveInQuarter(userId, period, bookId, to)` runs inside `inPlan`. It reads the full quarter order, moves the book to ordinal `to` and calls `reorderQuarter`. Hidden rows (books in the quarter that are not `to_read`) keep their places, like the queue's started runs. New `src/app/api/plan/route.ts` takes PATCH `{ bookId, period, to }` (404 when the book isn't in that quarter) and MOVE_TOP through `moveToTop`.
3. **ReorderList**: extract QueueList's engine (keyboard lift, pointer drag, live region, menu, undo) into a generic `src/components/ReorderList.tsx` that takes `rows`, `move(id, toOrdinal)`, an optional `remove`, `renderBody`, `scopeLabel` ("in Q1 2027") and `helpId`. `QueueList` becomes a thin comics wrapper with no behaviour change (`test/e2e/queue.spec.ts` must stay green). `PlanQuarter.tsx` wraps it for one quarter: *Move to top · Move up · Move down*, no Remove. One instance per quarter, so a lift can't cross quarters.
4. **StatusTabs** (`src/components/StatusTabs.tsx`, client):
   - A `role="tablist"` of three `<a role="tab" aria-selected aria-controls>` links: *In flight · Up next · Done*, each with a mono count. ←/→/Home/End move focus and navigate with `router.replace`.
   - One `<span class="tab-ink">` per tablist, placed by `--i`.
   - Children are the selected tab's `role="tabpanel"`.
   - `?tab` is parsed and anything unknown falls back to `inflight`. QUEUE_HREF stays `?tab=next`.
5. **EmptySlate** (`src/components/EmptySlate.tsx`): `<div class="empty"><b>title</b> body + one primary action</div>`.
6. **Pages**:
   - `src/app/comics/status/page.tsx` is rewritten: h1 *Runs by status*, the three tabs, In flight rows with `.meter` and `Read <next_label>` (a link to `#p-n`, `title` = the full label, CSS truncation), and Up next = today's queue and *Ready, not queued* sections.
   - New `src/app/books/status/page.tsx` + `loading.tsx`: h1 *Books by status*. Up next shows quarter groups (`PlanQuarter`), then each year's bare-year lane after its quarters (a grey `ghead` with its count, rows by title, no handle, no button), then On deck, then a `Someday · N books` row linking to `/books/list?status=to_read&level=someday`. Done is grouped by year, *No year* last, then `<details class="stopped"><summary>Stopped · N</summary>`.
   - Counts = rows rendered (comics Up next = queue + `readyTotal`; books Up next = plan rows; Done includes Stopped).
7. **Empty slates** use the comics copy from mockup `states` (line 5706). Books' copy is the owner-approved copy (see Risks), with *Add a book* via `AddBooksButton` (TASK-008's sheet).
8. **`/books/list`**: when `status=to_read`, a chip row *All · Quarter · Year · On deck · Someday* with `?level=` (`prefetch={false}`).
9. **Nav**: `comics-status` and `books-status` get `enabled: true`.
10. **Dashboard**: the *Mid-run* head links to `?tab=inflight`; *Ready when you are* gains `All {readyTotal}` → `/comics/status?tab=next#ready`; the shelf's `Up next` h2 gets a link to the tab (*Reorder* already goes there).
11. **CSS** (`globals.css`, tokens only):
    - `.tabs`: 44px tabs; the selected tab is `--ink` 600 and the rest `--muted` 500; counts take their tab's colour, never opacity (TASK-028 note).
    - `.tab-ink`: 2px `--m-*`, `transform var(--dur-2)`, no transition under reduced motion.
    - `.lane-year` uses `--surface-2`/`--muted` and never `--blocked`; plus `.stopped` and the one `.meter` fill `--ready`.
12. **Mockup**: draw books' three empty slates in `design/mockups.html` beside comics', and strike *Not shown* #6 for comics and books in `design/mockups-index.md`.
13. **Budgets**: `scripts/perf/routes.mjs` + `budget.json` gain `comics-status` and `books-status`. `test/query-budget.test.ts` updates `/comics/status` (6 queries, 1 wave) and adds `/books/status`. `test/loading-states.test.tsx` adds books.

**Files**: the steps' files; the ones not in Files likely touched are `src/db/writes.ts`, `src/app/api/plan/route.ts`, `src/components/ReorderList.tsx`, `src/components/PlanQuarter.tsx`, `src/app/books/status/loading.tsx`, the dashboard page, `QueueShelf.tsx`, `test/query-budget.test.ts` and `test/loading-states.test.tsx`.

**Test strategy**

- AC-1 data rules: `test/status.test.ts`, one `it` per Check clause: the 3/10 queued run, queue order, *Ready, not queued*, the blocked queued run and the blocked unqueued run, all read, read-elsewhere, undated last, 2027 bare-year position, `someday` count + `listBooks({status:'to_read',level:'someday'})`, DNF only in Stopped. Plus `moveInQuarter` keeps the quarter contiguous 1–3 and rejects another quarter.
- AC-1 UI and AC-2, AC-4, AC-5, AC-6: `test/e2e/status.spec.ts`:
  - the Space, Down, Space keyboard reorder in 2027-Q1;
  - tab counts = `[role=tabpanel]` rows;
  - `.tab-ink` count = 1;
  - `?tab=done` survives a reload; arrow keys;
  - the six slates, each with one `.btn`; *Add a book* opens the sheet;
  - the bare-year lane's computed colour ≠ `--blocked`;
  - the dashboard links; the `Read …` name and `title`;
  - `<details class=stopped>`;
  - 44px tabs; axe; screenshots at 360px for every tab, populated and empty.
  - `test/nav-items.test.tsx` checks that Status is enabled.
- AC-3: `test/status.test.ts`: each level equals `to_read_level`'s set.
- AC-6 (every viewport, light and dark): the existing `markup.spec.ts`/`routes.spec.ts` route lists gain the two routes.

**Risks / open questions**

1. **Books slate copy, for owner approval:**
   - In flight: *Nothing in flight. Books you start land here.* → **Open To read**
   - Up next: *Nothing planned. The plan starts empty; nothing is added for you.* → **Add a book**
   - Done: *Nothing finished yet. Finished books land here, by year.* → **Go to In flight**
2. Dragging a book that is in two quarters moves it only in the quarter dragged.
3. The ReorderList extraction risks a regression in the queue; the queue e2e suite guards it.
4. Running all three tabs' queries per load costs about 6 queries in 1 wave. A Lighthouse budget squeeze is possible.

**Size check**: about 20 files across UI, API and query layers, with no schema change. It stays whole by `never-split`; it is already `autonomy: attended`.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
