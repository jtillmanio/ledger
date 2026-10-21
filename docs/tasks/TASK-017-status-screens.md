---
id: TASK-017
title: 1.9 Status screens: In flight · Up next · Done
status: Ready
depends_on: [TASK-016]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
