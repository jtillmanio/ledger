---
id: TASK-048
title: 2.2c Follow what you're reading: the control, and an offer when you finish
status: Done
depends_on: [TASK-023, TASK-010, TASK-047]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 391e506
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

- [x] AC-1 (roadmap **Check:**, verbatim): `npm test`: setting *Reading* on a series writes one
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
- [x] AC-2: Undo restores the exact earlier state in each of the three cases: no row → *Reading* → undo leaves no row; *Tracking* → *Reading* → undo leaves `tracking`; *Reading* → *Not following* → undo puts back the row at `reading`. The route refuses an unknown kind, a missing id, a soft-deleted book's series, or a shelf that isn't a books shelf with 400 and writes nothing.
- [x] AC-3: In the Library, a book's row menu has *Follow.*; it opens a sheet headed by the book's title listing exactly the series, author, universe and shelves the book has (a book with no series lists no series row), each with a radiogroup whose checked option matches the stored state and a `read / total` that equals its progress view's counts. Closing the sheet by Esc, Back or its close control returns focus to *Follow.*.
  *(Verified as: focus returns to the row's ⋯, "More for <title>", the menu's button: the* Follow… *item is gone once the menu closes. Owner, at the drawing gate, 2026-11-05.)*
- [x] AC-4: After a finish, the toast's undo still undoes the finish alone; taking a *Keep going?* chip then undoing that chip leaves the finish in place and no follow row; with nothing to offer (every grouping already *Reading*, or the book in none), the toast has no *Keep going?* line.
- [x] AC-5: The follow sheet, the row menu and the finish offer meet the UX floor (`docs/04-design.md` § 10. The UX floor): each radiogroup and chip has an accessible name; every option and chip is at least 24px (44px in the toast's row); the sheet traps Tab, is labelled by its heading and returns focus; nothing is red; screenshots at every `ui.viewports` width, light and dark.

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

- Decision D-116: F6 moves focus into the live undo toast and back; that's how its *Keep going?* chips, and its Undo, are reached by keyboard, over a sheet too (amends D-63's *the toast is reached by pointer*; D-63 marked *Amended by D-116*, and `docs/04-design.md` § 11.1 says so). Placed by PR #196; its focus order corrected here to what shipped, Undo first and Tab to the chips (approved at close-out), and § 11.1's line no longer says *planned* → docs/review/decisions.md § D-116 (approved at plan)
- `shelf_follows` and `shelf_progress` are approved (planned: this task): a 2.2c row in `docs/03-data-model.md` § 4.1 By task, and the coverage row in `docs/06-tasklist.md`. Placed by PR #196; both now say built (migration 0022) → docs/03-data-model.md § 4.1 By task (approved at plan)
- The books dashboard's *✓ finished* (2.2) carries the same offer through `src/lib/follow-offer.ts` → not tracked: already in TASK-049's plan (provisional on this task)
- The `follow` mockup frames drew a display-serif heading and a ✕; the app uses the shared `Sheet` (sans heading, *Close* at its foot), so the frames are redrawn to it → design/mockups.html § follow (fixed in this PR; owner, at close-out)
- Schema review: `bookGroupings` joins the four `*_progress` views on a column, which the planner can't push into their GROUP BY, so each call aggregates them whole (milliseconds at 1,361 books) → not tracked: accepted as is until a profile shows it (schema-reviewer, MINOR)
- Schema review: undoing a shelf follow after the shelf is deleted answers 500 (the foreign key), not 400 → not tracked: only a race reaches it, and shelves can't be deleted until 5.1
- Spec review: F6 into the toast while a sheet is open has no browser test → not tracked: the sheet leaves the toast live (D-63, tested by pointer here) and `test/undo.test.tsx` pins F6
- UI walk: the row's ⋯ is named *More for this book* until hydration, then *More for <title>* → not tracked: accepted, the cost of revision 1 (no title in the row's RSC)
- UI walk: setting a finished book back through the status control keeps its read; only the finish's Undo removes it → not tracked: by design (1.5: leaving Read keeps the read)
- Lighthouse gate: `/comics` is raised to 36 requests and `/books/list` to 66,000 bytes and 58 requests, with the reason (a chunk split this task causes; the preview's data) → docs/02-architecture.md § Performance budget (approved at the gate)

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

**Schema (stop-and-ask, answered by approving this plan):** `shelf_follows(shelf_id text PRIMARY KEY → shelves.id ON DELETE CASCADE, state text NOT NULL DEFAULT 'tracking' CHECK (state IN ('tracking','reading')))`, no `user_id` (D-91: a shelf is already the owner's). It goes in `CATALOG_TABLES` beside `shelf_books` (`USER_TABLES` must have `user_id`, and `test/export-tables.test.ts` checks that). Nothing dropped or retyped, so no `drizzle/down/`.

**Steps**
1. Draw first: `follow` (the *Follow…* sheet) and `finishoffer` (the finish toast with *Keep going?*) in `design/mockups.html` at 360, 834 and 1280, light and dark, and list both in `design/mockups-index.md`. Stop for the owner's look before step 2.
2. `shelfFollows` in `src/db/schema.ts`; `npm run db:generate` → `drizzle/0022_*.sql` + `drizzle/meta/*`; `"shelf_follows"` in `CATALOG_TABLES`.
3. `shelf_progress` in `etl/views.sql`, after `universe_progress`, in its shape: `user_id` (the shelf's), `shelf_id`, `name`, `books_listed` (live books on the shelf), `books_read` (`status = 'read'`), `pct`, `follow_state` last. Books shelves only.
4. `src/db/writes.ts`: `FOLLOW_KINDS = ["series","author","universe","shelf"]`; `setFollow(userId, kind, id, state: "tracking"|"reading"|null)` → the prior state (`null` = no row). One transaction, Drizzle builder: read the row, then upsert or delete. The undo is `setFollow(prior)`, so each of the three AC-2 cases restores exactly.
5. `src/db/queries.ts`: `followable(userId, kind, id)` (a series, author or universe with at least one live book; a shelf of yours with `kind = 'books'`); `bookGroupings(userId, bookId)` (series, author, universe, then shelves by name: `kind, id, name, read, total, state` from the four progress views; a series' total is `total_books`, the rest `books_listed`); `finishOffer(userId, bookId)` → `{ take, done }`: a grouping already *Reading* with no unread live book left is `done`; one not *Reading* is `take` if it is the author, or has an unread live book.
6. `src/app/api/follows/route.ts` (new): `GET ?bookId=` → the groupings (404 for no live book); `POST { kind, id, state }` (`state` null = *Not following*) → 400 for an unknown kind, a missing id or anything `followable` refuses, else `{ prior }`. The undo POSTs `prior` back.
7. `src/app/api/progress/book/route.ts` (**not in Files likely touched**: the finish has to carry its offer): when the write appended a read (entering `read`, a listen's finish included), answer `offer: await finishOffer(...)`; else `offer: null`.
8. `src/lib/follow-offer.ts` (new): turns an `offer` into toast chips (*Mistborn · series*, *Brandon Sanderson*, *Cosmere*, *To-read pile · shelf*, *Done with Mistborn*), each writing through `/api/follows` and returning its own undo entry. TASK-049's *✓ finished* reuses it.
9. `src/components/Undo.tsx`: `UndoEntry.offer?: { chips }`. The toast draws a second row, *Keep going?*, with the chips (44px). Taking one writes, then pushes its own entry that carries the chips still untaken; under the one-toast rule (1.8b) that commits the finish, and the chip's Undo undoes the follow alone. The chips go when the toast does; focus already holds it. **Keyboard: F6, while a toast is up, moves focus to its first control; F6 or Esc hands focus back** (`returnTo`). It works over a sheet too (D-63). D-116 (owner, at the plan gate).
10. `src/components/FollowSheet.tsx` (new): `Sheet` headed by the book's title. It fetches the groupings on open, and each row has its name, its kind, `read / total` in mono, and a `role="radiogroup"` of native radios (*Reading · Tracking · Not following*) named *Following <name>*. A change POSTs and pushes an undo restoring `prior`.
11. `src/components/BookRowMenu.tsx` (new, **not in the list**): `Menu` `⋯` named *More for <title>*, with the item *Follow…*. Its only prop is `bookId` (the title is read from `.row-title`, as `BookStatus` does), and the sheet is loaded with `next/dynamic` on first open, so 500 rows add almost no RSC or JS. ~~Placed in each row of `src/app/books/list/page.tsx`.~~ **Revision 1 (owner, 2026-11-05):** `BookStatus` draws it, pinned to the row's top right by CSS, so a row adds no RSC element: the Library had 7.5 KB of its 58.6 KB document + RSC budget left. `page.tsx` is unchanged.
12. `src/components/BookStatus.tsx`: a finish's push carries `offer` through `follow-offer.ts`, and it draws `BookRowMenu` (revision 1).
13. `src/app/globals.css` (**not in the list**): the toast's offer row, the sheet's rows and the menu, from tokens only.
14. **Revision 2 (owner, 2026-11-05, at the Lighthouse gate):** the *Keep going?* row moves into `src/components/ToastOffer.tsx` (new), which `Undo.tsx` loads with `React.lazy` only when a toast carries an offer, so its code isn't on every route; the `⋯`'s glyph loses its own span. The toast's growth still splits the layout's shared chunk, so `/comics` is raised to 36 requests, and `/books/list`, over on its preview's data, to 66,000 bytes and 58 requests (`scripts/perf/budget.json`, `docs/02-architecture.md` § Performance budget, which says why). The finish test's axe run is scoped to the toast (`test/e2e/helpers.ts` gains `include`): a fixed toast at 360px partly covers the links behind it.

**Files:** the 13 steps' files, plus `etl/test_views.sql`, `test/follows.test.ts` (new), `test/undo.test.tsx` (**not in the list**), `test/e2e/follows.spec.ts` (new); `test/export-tables.test.ts` should pass unchanged.

**Test strategy**
- AC-1: `test/follows.test.ts`: `it.each(kinds)("Reading writes one row at reading, Not following deletes it, Undo restores")`; "finishing 2 of 4 in the Cosmere on a shelf with a book left offers series, author, Cosmere, shelf"; "4 of 4 doesn't offer the series"; "a Reading series isn't offered"; "the last unread book of a Reading series offers Done with, and taking it writes tracking"; "a finish with no chip taken writes no follow row". `etl/test_views.sql`: "shelf_progress counts read and listed, skips a soft-deleted book". `test/export-tables.test.ts` as is. `test/e2e/follows.spec.ts`: "the offer's chips by keyboard (F6, Tab, Enter)", axe, screenshots at 360 and 1280.
- AC-2: `follows.test.ts` "undo restores the exact earlier state" (3 cases); "refuses an unknown kind, a missing id, a soft-deleted book's series, a titles shelf with 400, and writes nothing".
- AC-3: `follows.test.ts` "bookGroupings matches the progress views; a book with no series lists none"; `follows.spec.ts` "Follow… opens the sheet with each radiogroup checked as stored; Esc, Back and close return focus".
- AC-4: `follows.test.ts` "finish, take a chip, undo the chip: still read, no follow row"; "nothing to offer: offer empty"; `undo.test.tsx` "the finish's Undo undoes it alone", "a chip pushes its own entry with the rest", "no offer, no Keep going? line".
- AC-5: `follows.spec.ts` at every `ui.viewports` width, light and dark: names, ≥24px (≥44px in the toast), the sheet traps Tab and returns focus, no `--danger`, axe.

**Risks / open questions:** (1) F6 is a new keyboard pattern (D-116): `test/undo.test.tsx` pins it, so the other toasts keep working. (2) At 360px, four chips wrap the toast to three lines. The mockup decides whether they scroll in one row instead. (3) The Library's perf budget (`books`, 60 kB doc+RSC): measure it after step 11.

**Size check:** over 8 files, with schema and UI together. `never-split` keeps it whole and `autonomy: attended`; Context gives the reason.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round PASS → full PASS (796 browser tests) | Audit R1 NOT RUN (tree not clean: the owner's line-ending-only CSVs) → R2 PASS in a worktree (owner's choice; 2 notes, both tightened) | Schema R1 APPROVE (4 MINOR: offer after a saved finish could 500, unfollow refused for a removed series, both fixed; 2 not tracked) | Spec R1 APPROVE (D-116's order and AC-3's focus target to record) | UI R1 PASS (6 widths, light and dark; sheet chrome differed from the drawing → mockup redrawn) | Verify R2 round PASS (after the review fixes) | Schema not re-run: the fixes touched route handlers and tests only (D-97); spec re-run in the close-out check
- Ready gates R1: CI's full browser run FAIL (axe target-size at 360px: the taller toast over two genre links) and Lighthouse FAIL (`/comics` 36 of 35 requests; `/books/list` 62.9 of 60 KB and 55 of 53) → revision 2 → follows.spec core PASS, 360 light and dark PASS

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 round + full, R2 round, R3 round after the gate fixes)
- Review rounds: 1, then the close-out check
- First-pass AC FAILs: 0
- Plan revisions after approval: 2 (step 11: `BookStatus` draws the ⋯, for the Library's RSC budget; step 14: the lazy offer row and the two raised budgets, at the Lighthouse gate)
