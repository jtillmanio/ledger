---
id: TASK-048
title: 2.2c Follow what you're reading: the control, and an offer when you finish
status: Ready
depends_on: [TASK-023, TASK-010, TASK-047]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-048 — 2.2c Follow what you're reading: the control, and an offer when you finish

## Goal

You can say for yourself that you're reading a series, an author, a universe or a shelf (*Reading · Tracking · Not following*), and finishing a book offers to follow what it belongs to. Having read one book of something never counts as reading it.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2c Follow what you're reading: the control, and an offer when you finish (M10, after 2.2e; owner intake 2026-11-02, D-108). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-04, when these task files were written. Features: F-68 (and F-20's follows). "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Not one of the entries 1.25 pulls ahead of cutover.
- Depends on 1.15 (TASK-023: `series_follows`, `author_follows`, `universe_follows`, and the `*_progress` views with `follow_state`), 1.5 (TASK-010: the finish, `saveBookStatus`) and 2.2e (TASK-047): until the series, author and universe pages exist (5.9, 5.11), the control is reached from *Follow.* in a book's row menu in the Library. The Library rows have no row menu today (`src/app/books/list/page.tsx`); `src/components/Menu.tsx` is the app's menu.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new table and view, the follow writes and their undo, a route handler, the follow sheet, the row menu, the finish toast's offer and the mockup redraw land together.
- **Only *Reading* means reading** (D-108, sharpening D-43). Nothing infers it from `series_progress` or any other progress view; *Tracking* stays "you want to know about it". Every follow 1.15 loaded is `tracking`.
- **The control.** *Reading · Tracking · Not following*, a `role="radiogroup"` writing the follow table for its kind. *Not following* deletes the row. Each change is one write with an undo (1.2, `src/components/Undo.tsx`) that restores the previous state, row or no row. *Follow.* opens a sheet (`src/components/Sheet.tsx`, D-63: the undo toast stays live over it) listing the book's series, author, universe and each shelf it is on, each with its control and its `read / total` in mono (from the `*_progress` views and `shelf_progress`).
- **Schema: stop and ask at plan time** (the entry, CLAUDE.md: a new table). Proposed: `shelf_follows(shelf_id, state)`, `state IN ('tracking', 'reading')`, no `user_id` (D-91), added to `src/db/export-tables.ts` in the same PR (Hard rule 7; it has no `user_id`, so it goes with the catalog-style list or a new one, the plan says which, and `test/export-tables.test.ts` must pass); and a `shelf_progress` view (books listed and read per shelf, live books only, with `follow_state`), which 5.12 reads later. The three existing follow tables keep their `user_id` until 6.18. Nothing is dropped or retyped, so no `drizzle/down/` file.
- **The offer at the finish.** Setting a book to *Read* saves at once, as today (`src/components/BookStatus.tsx` pushes the undo); then the toast that carries its undo gains a second line, *Keep going?*, with one chip per thing the book belongs to that isn't already *Reading*: its series and universe while either still has an unread live book, its author, and each shelf it is on with a book left. A chip sets *Reading* with its own undo. Ignoring the offer writes nothing, and the offer never blocks the finish. Finishing the last unread book of something followed as *Reading* offers *Done with <name>* instead, which sets it back to *Tracking* (D-43: the app asks rather than changing it). Later: it sits beside 3.4b's *Rank it in 2026* and moves into 5.4's closing card when those exist; neither is built.
- **Whether the toast can hold this.** The undo toast is `role="status"`, lasts 8 seconds and pauses on hover or focus (`docs/04-design.md` § 11.1). The plan says how chips inside it stay reachable by keyboard (the Check) without trapping focus or outliving the undo, and how a listen's finish (1.23, from *Listening*) offers the same.
- **Not drawn yet.** The mockup (`design/mockups.html`, listed in `design/mockups-index.md`) gains the *Follow.* sheet and the finish offer at phone, tablet and desktop widths before they are built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`).
- Writes go through the Drizzle builder in `src/db/writes.ts`, one route handler (a new `src/app/api/follows/route.ts`, the plan's name) that validates the kind and the id and that the entity exists and is live; no page `<Link>`s to it.
- Decisions: D-108, D-43, D-42 (a universe is a fact about the work), D-91, D-63, D-65. Data model 2.5e (narrow tables per kind, `docs/03-data-model.md`).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm test`: setting *Reading* on a series writes one
`series_follows` row at `reading`, *Not following* deletes it, and Undo
restores the earlier state; the same for an author, a universe and a shelf.
Finishing book 2 of 4 of an unfollowed series in the Cosmere, on a shelf with
a book left, offers the series, the author, the Cosmere and the shelf;
finishing book 4 of 4 does not offer the series; a series already *Reading* is
not offered; finishing the last unread book of a *Reading* series offers *Done
with* it, and taking it writes `tracking`; dismissing the offer writes no
follow row. `shelf_progress` counts read and listed books per shelf and skips
a soft-deleted book. The export test passes with `shelf_follows`. In the
browser (0.11), the offer's chips are reachable by keyboard and axe passes.
Screenshots at 360px and 1280px.
- [ ] AC-2: Undo restores the exact earlier state in each of the three cases: no row → *Reading* → undo leaves no row; *Tracking* → *Reading* → undo leaves `tracking`; *Reading* → *Not following* → undo puts back the row at `reading`. The route refuses an unknown kind, a missing id, a soft-deleted book's series, or a shelf that isn't a books shelf with 400 and writes nothing.
- [ ] AC-3: In the Library, a book's row menu has *Follow.*; it opens a sheet headed by the book's title listing exactly the series, author, universe and shelves the book has (a book with no series lists no series row), each with a radiogroup whose checked option matches the stored state and a `read / total` that equals its progress view's counts. Closing the sheet by Esc, Back or its close control returns focus to *Follow.*.
- [ ] AC-4: After a finish, the toast's undo still undoes the finish alone; taking a *Keep going?* chip then undoing that chip leaves the finish in place and no follow row; with nothing to offer (every grouping already *Reading*, or the book in none), the toast has no *Keep going?* line.
- [ ] AC-5: The follow sheet, the row menu and the finish offer meet the UX floor (`docs/04-design.md` § 10. The UX floor): each radiogroup and chip has an accessible name; every option and chip is at least 24px (44px in the toast's row); the sheet traps Tab, is labelled by its heading and returns focus; nothing is red; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- The series, author and universe pages (5.9, 5.11) and placing the control there; 3.5's book sheet.
- 2.2d's *Next in* line, *Or keep going* rows and `follow_next` (TASK-050), and 2.10b's plan suggestions.
- 3.4b's *Rank it in 2026* and 5.4's closing card.
- Inferring *Reading* from reads, or nudges about follows untouched for months (D-108).
- Dropping `user_id` from the existing follow tables (6.18).
- Creating or editing shelves (5.1).

## Files likely touched

- `src/db/schema.ts` — `shelf_follows`; `drizzle/<tag>.sql` and `drizzle/meta/*` from `npm run db:generate`.
- `src/db/export-tables.ts` — `shelf_follows`.
- `etl/views.sql`, `etl/test_views.sql` — `shelf_progress`.
- `src/db/writes.ts`, `src/db/queries.ts` — set and clear a follow with its prior state; a book's groupings with their progress and follow state; what a finish offers.
- `src/app/api/follows/route.ts` (new) — the follow write and its undo.
- `src/components/FollowSheet.tsx` (new), `src/components/BookStatus.tsx`, `src/components/Undo.tsx` — the sheet, the finish offer, the toast's second line.
- `src/app/books/list/page.tsx` — the row menu with *Follow.*.
- `design/mockups.html`, `design/mockups-index.md` — the sheet and the offer (drawn first).
- `test/follows.test.ts` (new), `test/export-tables.test.ts`, `test/e2e/follows.spec.ts` (new).

## Verification

- Automated: `test/follows.test.ts` (AC-1's `npm test` half, AC-2, AC-4's writes); `etl/test_views.sql` (`shelf_progress`); `test/export-tables.test.ts`; `test/e2e/follows.spec.ts` (the sheet from the row menu, the chips by keyboard, axe, screenshots).
- Manual: `npm run dev`, finish a book in a series you don't follow → the toast offers the series, author and universe; take the series chip → its follow reads *Reading* in the *Follow.* sheet; undo both, so the dev database is left as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

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
