---
id: TASK-123
title: 5.17b Own it from Search and By hand (2 of 2) — the chips, the button and the paste review on screen
status: Review
depends_on: [TASK-122]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b2e7229
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
- *From TASK-122 (5.17b, PR #310):* the API is in: `POST /api/books` takes `{ kind: 'owned', format }`, and its answer is the undo `DELETE /api/books` takes. A library book that already has the row answers `added: []`, so the screen offers no Undo, as for a Someday add to a book with a status. The review's reasons are *Already owned on paper.* and *Already own the audiobook.* (`OWNED_ALREADY` in `src/lib/book-review.ts`). Two comments still say an owned format is *Paste a list*'s alone, and change with the screen: `src/components/AddBooks.tsx:171` (above `switchTo`) and the `Target` doc in `src/lib/book-add.ts:24`.
- UX floor: `docs/04-design.md` § 10.
- Decisions: D-132, D-152, D-83 (Unlisted).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves the clauses through the screens, in the browser (0.11) on the test database, and the screenshots. TASK-122 proves the writes): (proposed; the owner agrees it by merging or edits it first) with *Physical copy* chosen, Search's *Add to Physical copy* on a library book with a status writes one `physical` row and changes no status. On a Hardcover result, and on a typed book the library lacks, it creates one `unlisted` book with its row. Undo removes exactly what each add wrote, and leaves a row the book had before. A paste whose matched book already has the row counts it as already owned. Undoing an add to Someday whose created book has since gained a `calibre_id` answers 409 and changes nothing. Screenshots at 360px and 1280px.
- [x] AC-2: With *Physical copy* chosen in *Paste a list*, switching to *Search* and then *By hand* keeps *Physical copy* chosen (`aria-pressed="true"`), and both chips are present in all three modes.
- [x] AC-3: In Search with *Audiobook* chosen, a library result's button reads *Add to Audiobook*; pressing it shows a toast naming the book with an Undo, and the book's Library row then ends *Audiobook*. In By hand with *Physical copy* chosen, the submit reads *Add to Physical copy*, and the typed book then appears under the Library's *Unlisted* and *Physical* chips.
- [x] AC-4: A paste to *Physical copy* of three lines, one a book that already has its `physical` row, shows that line's reason *Already owned on paper*, and the primary reads *Add 2 books to Physical copy*; after adding, the toast counts 2.
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

- AC-5 says 44px chips on a phone; every *Add to* chip is 32px (design § 10) and the owner kept it at the gate. The AC's wording, and whether § 10's expanded 44px hit area is required of these chips, are the owner's → docs/OWNER-CHECKLIST.md § Approvals from follow-ups
- Two of the new browser tests (AC-4's paste review and count, and AC-1's 409 on Undo) pass without this task's code, because TASK-122 (PR #310) already ships that behaviour; the test-auditor marked them guards, not proofs → not tracked: kept as regression guards, named in the Review log and the PR for the owner to overrule; the behaviour is TASK-122's
- `test/e2e/shard-times.json` holds estimated times for `add-books-owned.spec.ts` and the longer `paste-books.spec.ts` → not tracked: CI's balance step prints the drift and `npm run e2e:plan` refreshes the times from full runs (D-167)
- Add books' loading skeleton lists Add to's items by hand, so adding chips moved the loaded height and failed `add-books-loading.spec.ts` at 768px → not tracked: done in this PR (plan revision 2), and that spec fails again if the two drift

## Plan

Approved 2026-11-20 (owner). Branch `task/5.17b-own-it-from-search-screens`.

What is already in: every result's button and By hand's submit read `addTo(target)`, so they say *Add to Physical copy* / *Add to Audiobook* once the target survives the switch; `buildBookReview` (TASK-122) already gives *Already owned on paper.* and counts only the rows it writes, and `PasteBooks` reads `review.count`. The screen change is `AddBooks.tsx`.

### Steps

1. **Redraw first** (`ui.redrawFiles`): `design/mockups.html` `add` gains a sixth phone frame, Search with *Physical copy* chosen (all seven chips: Someday, On deck, Year or quarter…, Shelf…, Coming out, Physical copy, Audiobook) and a library result's *Add to Physical copy*; the third frame's review shows one line *Already owned on paper.*, *2 will be added* and *Add 2 books to Physical copy*; a notes line (task 5.17b). `design/mockups-index.md` § `add` says what was added.
2. **Tests first, failing:**
   - New `test/e2e/add-books-owned.spec.ts`, with its own fixtures (a library book with a status, one that already has its `physical` row, a seeded `hardcover_cache` row under its own key and Hardcover id): AC-2 (Paste → *Physical copy* → Search → By hand keeps `aria-pressed="true"`; both chips in all three modes); AC-3 (Search *Audiobook* on a library result: toast naming the book with Undo, its Library row ends *Audiobook*; By hand *Physical copy*: the submit reads *Add to Physical copy*, the typed book is under *Unlisted* and *Physical*); AC-1 (library book with a status → one `physical` row, status unchanged; Hardcover result and typed book → one `unlisted` book each with its row; Undo removes exactly that; a book that had the row gets none written and no Undo, and keeps its row; an add to Someday whose created book gains a `calibre_id` by SQL: Undo's toast says *Couldn't undo…*, the book stays). Writes run once (`@at-w390-light`).
   - AC-5: a FLOOR test (every width) in Search with *Physical copy* chosen: chips are named toggles ≥ 44px on a phone, axe, no sideways scroll at 360px, nothing on `--danger`; screenshots at 360px and 1280px.
   - `test/e2e/paste-books.spec.ts`: AC-4, a paste to *Physical copy* of three lines, one already with its `physical` row → *Already owned on paper.*, *Add 2 books to Physical copy*, toast *2 books added to Physical copy*; the paste review's screenshot at 360px and 1280px (AC-5).
3. **`src/components/AddBooks.tsx`**: `switchTo` keeps an owned target in every mode (only *Coming out* leaving for Paste goes back to Someday); the two owned chips are drawn in all three modes; the comment above `switchTo` says so. `src/lib/book-add.ts:24`'s `Target` doc no longer says *Paste a list only*.
4. **The toast when nothing is written** (owner approved at plan): an owned add to a book that already has the row says *Already in your library* · *already owned on paper* / *already own the audiobook* (a small map in `src/lib/book-add.ts`), not the book's status.

### Files

- `src/components/AddBooks.tsx`: `switchTo`, the chips in every mode, the toast's wording
- `src/lib/book-add.ts`: the `Target` doc; the owned *already* wording
- `design/mockups.html`, `design/mockups-index.md`: the redraw
- `test/e2e/add-books-owned.spec.ts` (**new**, not in Files likely touched): Search and By hand, AC-1–AC-3, AC-5; kept apart from `book-search.spec.ts`, whose later tests depend on its Piranesi state
- `test/e2e/paste-books.spec.ts`: AC-4, the paste review's screenshots
- No change: `BookSearch.tsx`, `ByHand.tsx`, `PasteBooks.tsx`
- `src/components/Skeleton.tsx` (**added after approval**, revision 2): Add books' loading skeleton draws Add to's items; the real row now has eight, so at 768px the loaded sheet came out a row shorter and `add-books-loading.spec.ts` measured a 22px jump. The skeleton draws eight.
- `test/e2e/plan-picker.spec.ts` (**added after approval**, revision 3): its `settled()` rejected when the plan picker cancelled a year chip's colour transition. The test failed in CI and locally only with the owned chips in Search (reverting the chips' condition made it pass, 2026-11-20): they shift the timing of the picker's data arriving. A cancelled animation is over, so `settled()` ignores the rejection.
- `test/e2e/shard-times.json`: estimates for the new spec and the longer paste spec, so the committed plan stays balanced until a full CI run's times replace them (`npm run e2e:plan`).

### Plan revisions after approval

1. **AC-5's 44px (owner, 2026-11-20, asked in the session).** Every Add to chip is 32px on a phone (`.addto .chip`, `src/app/globals.css`; `docs/04-design.md` § 10: 32px small buttons, 24px floor, 44px for the thumb bar, icon buttons and sheet close). The owner chose to keep 32px, so the floor test asserts 32px on a phone and 24px elsewhere. AC-5's text is the owner's to amend; it is listed under Follow-ups.
2. The skeleton (above).
3. `plan-picker.spec.ts` (above).

### Test strategy

| AC | Where |
|---|---|
| AC-1 | `add-books-owned.spec.ts` (writes once); TASK-122's `test/add-book.test.ts` holds the database-level proof |
| AC-2 | `add-books-owned.spec.ts` |
| AC-3 | `add-books-owned.spec.ts` |
| AC-4 | `paste-books.spec.ts` |
| AC-5 | FLOOR tests in both specs, fixed 360px and 1280px screenshots |

### Risks

- Browser suite time (the suite is due a trim): write tests stay in `w390-light`; only the floor test runs at every width.

### Follow-ups found at plan

None.

## Review log

Verify R1 FAIL(3: add-book-sheet.test, paste-books.test, e2e-shards.test, each pinning the old chips or the shard balance) → R2 PASS → R3 PASS (after the CI fixes) | CI R1 FAIL (add-books-loading.spec.ts, w768-light: the skeleton's chip count; plan-picker.spec.ts, w390-light: `settled()` on a cancelled animation) → fixed, R2 PASS on 23a9c5d | Audit R1 NOT PASS: every test PROVEN but two, which pass without this task's code because TASK-122 already ships the behaviour (AC-4's paste review and count; AC-1's 409 on Undo): kept as regression guards, for the owner to overrule | Spec R1 CHANGES (AC-5 says 44px, built and tested at 32px by the owner's choice; `Skeleton.tsx` and `plan-picker.spec.ts` not in the plan) → plan revisions recorded in the task file; not re-run, since only the task file changed and AC-5's wording is the owner's (Owner checklist § Approvals) | UI R1 PASS (data left as found; axe and the sixth-frame comparison not walked by the verifier, axe runs in the CI floor tests)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 failed three unit tests)
- Review rounds: 1 (spec, audit, UI; spec and audit asked for changes that were recorded, not re-run)
- First-pass AC FAILs: 1 (AC-5 as written, 44px; the owner kept 32px)
- Plan revisions after approval: 3 (AC-5's height, `Skeleton.tsx`, `plan-picker.spec.ts`)
