---
id: TASK-096
title: 5.1 Shelves (2 of 3) — the Shelves list, a shelf's page with its notes and order, and the nav item
status: Ready
depends_on: [TASK-095]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:** lines, verbatim; this part proves, in the browser (0.11) on the test database: the note saves, survives a reload and renders under its row, a shelf with no description renders no empty line, and a note on one shelf is absent from another holding the same book. TASK-095 proves the data clauses, TASK-097 the add sheet's *New shelf…*):
**Check (the context part):** a note saves, survives a reload and renders
under its row; a shelf with no description renders no empty line; a note
on one shelf does not appear on another shelf holding the same book.
**Check (the new-shelf part):** *New shelf…* with a new name writes one
`shelves` row and one `shelf_books` row; Undo leaves neither; a name
already in use writes nothing and says why.
- [ ] AC-2: Given a shelf of five books with the 1st and 3rd read, the Shelves list row reads `2 / 5`, its meter fills with `--ready`, and it names the 2nd, 4th and 5th books in shelf order; a shelf with every book read names none.
- [ ] AC-3: Given a shelf's page, moving its last book to the top by *Move to…* redraws the order without a reload, survives a reload, and *Undo* puts the original order back.
- [ ] AC-4: *Shelves* shows in the phone tab row, the tablet rail and the desktop sidebar under Books, current on `/books/shelves` and on a shelf's page; *+ Add to shelf* on a shelf's page opens Add books with that shelf chosen.
- [ ] AC-5: `design/mockups.html`'s `shelves` frame draws three unread per row, a shelf's page with a description and a note, and the empty state, and `design/mockups-index.md`'s `shelves` row names them (task 5.1).
- [ ] AC-6: Shelves and a shelf's page meet the UX floor (`docs/04-design.md` § 10): the empty state (no shelves: one primary action, *New shelf*) and a shelf with no books are drawn, loading skeletons at the loaded size, an error state; every control is a real button or link with a name, ≥ 24px; text contrast in light and dark; reduced motion on reorder; screenshots at each `ui.viewports` width.

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
