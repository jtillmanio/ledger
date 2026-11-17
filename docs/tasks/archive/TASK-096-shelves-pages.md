---
id: TASK-096
title: 5.1 Shelves (2 of 3) — the Shelves list, a shelf's page with its notes and order, and the nav item
status: Done
depends_on: [TASK-095]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: e5c1411
---

# TASK-096 — 5.1 Shelves (2 of 3) — the Shelves list, a shelf's page with its notes and order, and the nav item

## Goal

Shelves has its own screen: every shelf with how far along it is and its next three unread, a page per shelf with its description, each book's note under its row, an order you can change, and *+ Add to shelf*.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.1 Shelves (books only): create, add items, reorder (M17). Pulled ahead of 1.26 (D-139). Feature F-34. Its two **Check:** lines are the contract.
- **Split, 2 of 3.** TASK-095 built the columns, the writes, the routes and the queries; this part draws them. TASK-097 adds *New shelf…* to the add sheet, and its merge ticks the entry.
- **The Shelves list** (`/books/shelves`, already in `NAV_ITEMS` as `books-shelves` with `enabled: false`, `src/components/nav/items.ts`): flip the flag (R1-06). Each row: the shelf's name, `read / total` in mono, an `.emeter`/`.meter` filled with `--ready` (D-26), and its **next three unread** in shelf order, not just the next one (design § 14 → Shelves); *+ New shelf* creates one (TASK-095's write). The mockup's `shelves` frame (`powershell -NoProfile -File scripts/screen.ps1 shelves`) draws the list at phone and desktop with *Next up* and a single title: this task redraws it with three, and its rows are shelves, not authors or universes (D-42: those are 5.11's pages).
- **A shelf's page** (`/books/shelves/[id]`): the description under the name, rendered only when there is one (no empty line); each book in shelf order with its note under its row (*After Wizard and Glass: sets up the Wolves*), edited in place. 3.1's inline-edit pattern is not built yet (3.1 is open): the plan says what this page uses and whether 3.1 can reuse it. Reorder with the existing controls (`src/components/ReorderList.tsx`, as the comics queue and a quarter use: a keyboard-operable handle and *Move to…*, a touch route for every drag). **+ Add to shelf** opens Add books with the shelf preselected (`/books/add?shelf=<id>`, already read by `src/app/books/add/page.tsx`); its comment says that link stands in "until Phase 5 draws the shelf screen", so this is that screen. The 2.2c follow control (*Reading · Tracking · Not following*) sits on the shelf page, as on the follow sheet.
- **Every write has its Undo toast** (`src/components/Undo.tsx`); a refused write says why, with *Retry* where it can (R1-07).
- **Not drawn yet:** the shelf's own page is in no frame. This PR redraws `shelves` (three unread, a shelf's page with its description, a note under a row, and the empty state) at phone, tablet and desktop widths, and `design/mockups-index.md`'s row names them (`ui.redrawFiles`).
- Architecture: add `/books/shelves` and `/books/shelves/[id]` to `docs/02-architecture.md` § 5. Routes and data access.
- Design: `design/mockups.html` § `shelves`; `design/STYLE_GUIDE.md` § 14 (Shelves); `design/LedgerDesktop.dc.html`; `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md`.
- Decisions: D-26, D-42, D-108, D-139; R1-06, R1-07.
- *From TASK-095 (5.1, PR #278):* the data side is built. Read through `shelfList(userId)` (each books shelf by name: `description`, `read`, `total`, `followState`, `next` = the next three unread in shelf order) and `shelfDetail(userId, id)` (the shelf and its live `books`, each with `status`, `coverUrl` and this placement's `note`; null for a shelf not yours) in `src/db/queries.ts`. Writes: `POST /api/shelves { name }` (*+ New shelf*; 409 with the reason when the name is taken; undo is `DELETE /api/shelves/<id>`, refused once the shelf has a book, a description or a follow) and `PATCH /api/shelves/<id>` with `{ description }`, `{ bookId, note }` or `{ bookId, to }`, each answering `{ change }`; the Undo toast sends `PATCH { undo: change }` (409 when something changed since). A move's `to` counts the shelf's **live** books, the list the page draws, and its change carries the whole order before and after, so its undo is exact.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:** lines, verbatim; this part proves, in the browser (0.11) on the test database: the note saves, survives a reload and renders under its row, a shelf with no description renders no empty line, and a note on one shelf is absent from another holding the same book. TASK-095 proves the data clauses, TASK-097 the add sheet's *New shelf…*):
**Check (the context part):** a note saves, survives a reload and renders
under its row; a shelf with no description renders no empty line; a note
on one shelf does not appear on another shelf holding the same book.
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [x] AC-2: Given a shelf of five books with the 1st and 3rd read, the Shelves list row reads `2 / 5`, its meter fills with `--ready`, and it names the 2nd, 4th and 5th books in shelf order; a shelf with every book read names none.
- [x] AC-3: Given a shelf's page, moving its last book to the top by *Move to…* redraws the order without a reload, survives a reload, and *Undo* puts the original order back.
- [x] AC-4: *Shelves* shows in the phone tab row, the tablet rail and the desktop sidebar under Books, current on `/books/shelves` and on a shelf's page; *+ Add to shelf* on a shelf's page opens Add books with that shelf chosen.
- [x] AC-5: `design/mockups.html`'s `shelves` frame draws three unread per row, a shelf's page with a description and a note, and the empty state, and `design/mockups-index.md`'s `shelves` row names them (task 5.1).
- [x] AC-6: Shelves and a shelf's page meet the UX floor (`docs/04-design.md` § 10): the empty state (no shelves: one primary action, *New shelf*) and a shelf with no books are drawn, loading skeletons at the loaded size, an error state; every control is a real button or link with a name, ≥ 24px; text contrast in light and dark; reduced motion on reorder; screenshots at each `ui.viewports` width.

## Out of scope

- The columns, writes and queries (TASK-095).
- *New shelf…* in the add sheet's *Shelf…* picker (TASK-097).
- Author and universe pages (5.11), the series page (5.9) and *In the middle of* (5.12).
- Renaming or deleting a shelf, and 3.1's inline editing elsewhere.

## Files likely touched

- `src/app/books/shelves/page.tsx`, `src/app/books/shelves/loading.tsx` (new) — the list.
- `src/app/books/shelves/[id]/page.tsx`, `src/app/books/shelves/[id]/loading.tsx` (new) — a shelf's page.
- `src/components/ShelfBooks.tsx` (new; the name is the plan's) — rows, notes in place, reorder via `ReorderList`.
- `src/components/nav/items.ts` — flip `books-shelves`.
- `src/app/books/add/page.tsx` — the comment that waits for this screen.
- `design/mockups.html`, `design/mockups-index.md` — the `shelves` frame (redraw).
- `docs/02-architecture.md` — the two routes.
- `test/nav-items.test.tsx`, `test/e2e/shelves.spec.ts` (new).

## Verification

- Automated: `test/e2e/shelves.spec.ts` (AC-1's browser clauses, AC-2, AC-3, AC-4, axe; screenshots at each width), `test/nav-items.test.tsx` (the flag).
- Manual: on the dev database, Books → Shelves → a shelf → write a note under a book → reload → it is there; open another shelf holding the same book → no note; move a book, *Undo* → order restored. Leave the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `InlineText` (click, type, blur saves, Esc cancels) is there for 3.1 to reuse on its allow-listed fields (approved at plan) → docs/05-roadmap.md § 3.1
- Both shelf routes in the query budget, and `shelfDetail` in one wave → not tracked: done in this PR (plan revision)
- Add books opened from a shelf goes back to it after a paste or Cancel → not tracked: done in this PR (plan revision)
- The development database lacked TASK-095's migration `0031_shelf_context`, so the first UI check couldn't load the page → not tracked: applied with the owner's OK (`npm run db:migrate`, 2026-11-17)
- `test/e2e/tab-row.spec.ts:249` (the row at 280px) failed once locally, showing Inbox alone before the last medium arrived, and passed on the rerun and in CI → not tracked: seen once, not reproduced

## Plan

Approved 2026-11-17.

**Steps**
1. Tests first, and confirm they fail: `test/nav-items.test.tsx` moves *Shelves* from off to on; `test/e2e/shelves.spec.ts` (new) builds its own E2E shelves: five books with the 1st and 3rd read, one all read, one with no description sharing a book with the five, and an empty one.
2. Turn on `books-shelves` in `src/components/nav/items.ts`.
3. `/books/shelves` (page, loading, error): each row has the name, `read / total` in mono, a `.meter` filled with `--ready`, *Next up* with the next three unread in shelf order (none when all read), and a link to the shelf. No coloured edge: a shelf has no hue of its own. At desktop width *+ New shelf* and the explainer sit in the rail. No shelves: an empty slate whose one action is *New shelf*. The error state is neutral, with *Try again*.
4. `src/components/NewShelf.tsx`: a name field and *Create* through `POST /api/shelves`; a 409 shows its reason under the field; a new shelf pushes an Undo (`DELETE`).
5. `/books/shelves/[id]` (page, loading, error): the name; the description only when there is one; `read / total` with its meter; *Reading · Tracking · Not following* (the radios pulled out of `FollowSheet.tsx` into a shared component); *+ Add to shelf* → `/books/add?shelf=<id>`. A shelf with no books: an empty slate whose action is *+ Add to shelf*. An unknown id is a 404.
6. `src/components/ShelfBooks.tsx`: the books in `ReorderList`, each row's ordinal its live position (the API's `to`); a move answers its own undo (`PATCH { undo: change }`). A row shows title, author, status and its note.
7. `src/components/InlineText.tsx`: 3.1's pattern as its roadmap entry states it (click the text, type, blur saves, Esc cancels, no Save button; shown at once, rolled back on failure), one Undo per save and a failure toast with *Retry*. Edits the note, and the description (none set: an *Add a description* button, never an empty line).
8. The comment in `src/app/books/add/page.tsx`; styles in `src/app/globals.css` (tokens only); no reorder motion under reduced motion.
9. `design/mockups.html` `shelves` frame redrawn (three unread per row, a shelf page with a description and a note, the empty state; phone, tablet, desktop) and its `design/mockups-index.md` row; both routes in `docs/02-architecture.md` § 5.

**Files**: `src/app/books/shelves/{page,loading,error}.tsx`, `src/app/books/shelves/[id]/{page,loading,error}.tsx`, `src/components/{ShelfBooks,InlineText,NewShelf}.tsx`, `src/components/FollowSheet.tsx` (not in the likely list: the follow radios become shared), `src/components/nav/items.ts`, `src/app/books/add/page.tsx`, `src/app/globals.css` (not in the list: the styles), `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`, `test/nav-items.test.tsx`, `test/e2e/shelves.spec.ts`.

**Test strategy** (`test/e2e/shelves.spec.ts` unless named)
- AC-1: a note saves, survives a reload and renders under its row; the no-description shelf has no description line; the shared book shows no note on the other shelf.
- AC-2: the five-book row reads `2 / 5`, its meter's colour is the `--ready` token, and it names books 2, 4, 5 in order; the all-read shelf names none.
- AC-3: *Move to top* on the last book; the order is checked, then after a reload, then *Undo* restores it.
- AC-4: *Shelves* current at 360, 834 and 1280px on both routes (`test/nav-items.test.tsx` for the flag); *+ Add to shelf* opens Add with the shelf chosen.
- AC-5: by inspection (spec-reviewer).
- AC-6: axe, contrast, 24px targets, the empty list and an empty shelf, the error state, reduced motion, screenshots at each `ui.viewports` width.

**Revisions after approval** (owner, 2026-11-17):
1. The query budget (task 0.9): `/books/shelves` (1 query) and a shelf's page (2 queries) in `test/query-budget.test.ts` and `docs/02-architecture.md` § Performance budget, one wave each; `shelfDetail` (`src/db/queries.ts`) sends its two reads together, the books read checking the shelf is yours itself. Both routes join `test/loading-states.test.tsx`'s list.
2. Add books opened from a shelf goes back to it: a paste to a shelf lands on `/books/shelves/<id>`, and Cancel from `?shelf=<id>` returns there (`src/components/AddBooks.tsx`, `test/paste-books.test.tsx`).

Also changed, to keep existing tests true: `test/e2e/tab-row.spec.ts` (every books item is now on, so *all enabled* equals the drawn row) and `src/components/ShelfList.tsx` (the list page's body, so `test/shelves-page.test.tsx` can draw the no-shelves state the shared TEST database can't).

**Decisions at the gate**: AC-3's *Move to…* is the ⋯ menu's *Move to top* (`ReorderList` has no *Move to…* picker). Description editing is included: otherwise the app cannot set one. Size: about 17 files, kept whole (already part 2 of a 3-way split; no schema; several files are one-liners).

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(1: `query-budget`, a run that started before `shelfDetail` changed) → R2 PASS; touched specs (`shelves`, `tab-row`, `follows`) PASS in w390-light
- Spec R1 CHANGES (AC-6: no screenshot at 412px) → fixed (empty shelf tagged `@feel`) → R2 APPROVE | Schema R1 APPROVE | Claude PR review: no issues
- Audit R1 PASS (restoration OK)
- CI R1 cancelled by the next push | CI R2 FAIL (`settings.spec.ts:249`: the shelves block redefined the shared `.sk-btn`) → fixed (own class names, `.btn.wide` scoped) | Verify R3 (after the fix)
- UI R1 NOT RUN (the dev database lacked migration 0031) → migrated with the owner's OK → R2 re-run
- Accepted by the owner, 2026-11-17

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3
- Review rounds: 2 (spec), 1 (schema)
- First-pass AC FAILs: 1 (AC-6, the 412px screenshot)
- Plan revisions after approval: 2
