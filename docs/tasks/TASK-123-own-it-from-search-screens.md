---
id: TASK-123
title: 5.17b Own it from Search and By hand (2 of 2) — the chips, the button and the paste review on screen
status: Draft
depends_on: [TASK-122]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-123 — 5.17b Own it from Search and By hand (2 of 2) — the chips, the button and the paste review on screen

## Goal

In Add books, *Physical copy* and *Audiobook* stay available in Search and By hand, each result says *Add to Physical copy*, and a paste's review tells you which books you already own before you add them.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.17b (its **Check** is AC-1, verbatim; still *proposed*). `docs/06-tasklist.md` M17. Part 2 of 2: TASK-122 makes the writes, the paste check and the undo's refusal. This part is the screens.
- Add books: `src/components/AddBooks.tsx`. `switchTo` sends *Add to* back to Someday when leaving *Paste a list* with an owned format chosen (`if (next !== "paste" && target.kind === "owned") choose({ kind: "someday" })`), and the two chips are drawn only in paste mode (`mode === "paste" && OWNED_CHOICES.map(...)`). After an owned add the page goes to the Library's *Owned* filter for the format (`/books/list?owned=…`).
- A result's button: `src/components/BookSearch.tsx` (*Add to …*, from `targetName` in `src/lib/book-add.ts`); By hand's submit is in `AddBooks.tsx`. Each says *Add to Physical copy* / *Add to Audiobook*.
- The paste review: `src/components/PasteBooks.tsx` (*Add N books to …*) over `src/lib/book-review.ts`, which TASK-122 changes to mark *Already owned on paper* and count only the rows it will write.
- **Not drawn yet.** `design/mockups.html` `add`'s frames draw *Physical copy* in *Paste a list* only (task 5.17's third phone frame). `ui.redrawFiles`: before it is built, the frame gains Search with *Physical copy* chosen and a result's *Add to Physical copy*, and the paste review's *Already owned on paper*; `design/mockups-index.md` § `add` says what was added.
- Toasts and Undo follow the paste's (TASK-094); the undo route is TASK-122's.
- UX floor: `docs/04-design.md` § 10.
- Decisions: D-132, D-152, D-83 (Unlisted).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses through the screens, in the browser (0.11) on the test database, and the screenshots. TASK-122 proves the writes): (proposed; the owner agrees it by merging or edits it first) with *Physical copy* chosen, Search's *Add to Physical copy* on a library book with a status writes one `physical` row and changes no status. On a Hardcover result, and on a typed book the library lacks, it creates one `unlisted` book with its row. Undo removes exactly what each add wrote, and leaves a row the book had before. A paste whose matched book already has the row counts it as already owned. Undoing an add to Someday whose created book has since gained a `calibre_id` answers 409 and changes nothing. Screenshots at 360px and 1280px.
- [ ] AC-2: With *Physical copy* chosen in *Paste a list*, switching to *Search* and then *By hand* keeps *Physical copy* chosen (`aria-pressed="true"`), and both chips are present in all three modes.
- [ ] AC-3: In Search with *Audiobook* chosen, a library result's button reads *Add to Audiobook*; pressing it shows a toast naming the book with an Undo, and the book's Library row then ends *Audiobook*. In By hand with *Physical copy* chosen, the submit reads *Add to Physical copy*, and the typed book then appears under the Library's *Unlisted* and *Physical* chips.
- [ ] AC-4: A paste to *Physical copy* of three lines, one a book that already has its `physical` row, shows that line's reason *Already owned on paper*, and the primary reads *Add 2 books to Physical copy*; after adding, the toast counts 2.
- [ ] AC-5: Add books meets the UX floor (`docs/04-design.md` § 10) in Search and By hand with an owned format chosen: the chips are named toggles of at least 44px on a phone, axe passes, no horizontal scroll at 360px, nothing on `--danger`, screenshots at 360px and 1280px (Search with *Physical copy* chosen; the paste review with *Already owned on paper*).

## Out of scope

- The writes, the paste check's data and the undo's 409: TASK-122.
- The ebook: never a destination (D-90).
- Any other destination's chip or wording.
- Owning a book from its sheet: TASK-118.

## Files likely touched

- `src/components/AddBooks.tsx`: `switchTo` keeps an owned target; the chips in every mode; By hand's submit label
- `src/components/BookSearch.tsx`: a result's *Add to Physical copy* (if `targetName` doesn't already give it)
- `src/components/PasteBooks.tsx`: the count and the reason from TASK-122's review
- `design/mockups.html`, `design/mockups-index.md`: the `add` frame redrawn first
- `test/e2e/book-search.spec.ts`, `test/e2e/paste-books.spec.ts`: AC-1 to AC-5

## Verification

- Automated: the two e2e specs (chips across modes, each add and Undo, the paste's count, the floor and screenshots).
- Manual: at 390px choose *Physical copy* in Paste a list, switch to Search, find a library book, *Add to Physical copy* → expected: a toast with Undo; the Library's *Physical* chip lists it and its status is unchanged.

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
