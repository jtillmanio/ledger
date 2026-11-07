---
id: TASK-054
title: 2.2f Finish a book from In flight
status: Review
depends_on: [TASK-017, TASK-010, TASK-048]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c5d5352
---

# TASK-054 — 2.2f Finish a book from In flight

## Goal

A book you're reading or listening to can be finished from *In flight* with one tap, and it moves to Done. Undo takes it back.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2f Finish a book from In flight (M10, after 2.0b; owner intake 2026-11-05). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-06, when these task files were written. Features: F-12. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Depends on 1.9 (TASK-017, the status screens), 1.5 (TASK-010, the finish) and 2.2c (TASK-048, *Keep going?*). Not one of the entries 1.25 pulls ahead of cutover.
- **One tap, today (owner, 2026-11-06).** The entry used to say the toast had a date control. It doesn't: the Library's *Read* opens the date control first and the toast only shows the saved date (`src/components/BookStatus.tsx`, `src/components/Undo.tsx`). The owner chose no date step: **Finished** sends `finish: { mode: "today" }` straight away, Eastern and `exact` (`src/lib/finish-date.ts`), and a different date is set from the Library's *Finished*. The entry is corrected to match. This is the same answer as TASK-049's Q4 for *✓ finished*.
- **It is the Library's finish, not a second one.** The finish lives inside `BookStatus`'s `write`: `POST /api/progress/book`, `router.refresh()`, then `push` with the undo (`DELETE` with the server's `change`) and `offerChips(offer)`. The plan factors out what both need, so there is no second copy of the write or its undo. Since 2.2 lands after this and needs the same one-tap finish, the shared piece should fit TASK-049's *✓ finished* too.
- **The row.** `src/components/StatusBookRow.tsx` is a plain, server-rendered row shared by In flight, a bare-year lane, On deck and Done. Only In flight's rows gain **Finished**; the others stay as they are, so the button goes in as a small client child and the row stays cheap (`books-status` in `scripts/perf/budget.json`). `booksInFlight` already gives each row its id and status.
- **A listen.** `saveBookStatus` logs `audio` when the book is *Listening* (D-112): the button sends the same thing on both rows, and the server decides.
- **After the tap** the row leaves In flight, so the focus it held has nowhere to be. The plan says where it goes: the next row's **Finished**, or the tab bar or the slate when the list empties. Both tabs' counts come from the refresh.
- In flight has no other status control: DNF, Parked and the rest stay in the Library.
- **Next in the order:** 2.2h (TASK-055) changes what the toast says. Nothing here needs to know, as long as this reuses the Library's finish.
- **Not drawn yet.** The mockup's `status` frame gains **Finished** at phone, tablet and desktop widths before it is built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`).
- Design: `status` in `design/mockups.html` and its `design/mockups-index.md` row; `StatusTabs`, `.row`, `.btn`.
- Decisions: D-112, D-85, D-116 (F6 into the toast), R1-07 (a failed write). The owner's answer of 2026-11-06.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), **Finished** on a *Reading* row writes `read`
and one `read_events` row with `format = text`, and on a *Listening* row one
with `format = audio`; the toast carries *Keep going?*; Undo restores the status
and leaves no read; the book moves from In flight to Done and both tabs' counts
equal their rows. The button is reachable by keyboard, axe passes and nothing
resolves to `--danger`. Screenshots at 360px and 1280px.
- [x] AC-2: Given a book *Reading* since a known date, **Finished** opens no date control and writes `finished_on` = today with precision `exact`; the read keeps that start date; the toast reads *<title>: read* with *Finished <today>*. Undo puts the status and the start date back.
- [x] AC-3: **Finished** is a `<button>` named *Finished <title>*, on *Reading* and *Listening* rows only: a row on *Up next* or *Done* has none, and an In flight row has no other status control.
- [x] AC-4: After a finish by keyboard, focus is not on `body`: it is on the next row's **Finished**, or where the plan says when the list empties, and F6 moves it to the toast (D-116). When the write fails, the failed-write line offers Retry, the row stays on In flight, and no `read_events` row exists.
- [x] AC-5: In flight meets the UX floor (`docs/04-design.md` § 10. The UX floor): the button is at least 24px tall and sized as the `status` mockup draws it; finishing the last book shows the existing *Nothing in flight.* slate; a long title doesn't overflow the row at 360px; the name stays 4.5:1 in both themes; axe reports no new violations; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- A date step, or a date control in the toast (the owner's answer).
- DNF, Parked and any other status on In flight.
- Comics' In flight.
- What a finish follows (2.2h, TASK-055), and the dashboard's *✓ finished* (TASK-049).

## Files likely touched

- `src/components/FinishBook.tsx` (new; the plan's name) — **Finished**.
- `src/components/BookStatus.tsx` — shares the finish.
- `src/components/StatusBookRow.tsx` — a slot for the button.
- `src/app/books/status/page.tsx` — In flight's rows pass it.
- `src/app/globals.css` — the row with its button, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — the `status` frame (drawn first).
- `test/e2e/status.spec.ts` — the finish, Undo, counts, keyboard, axe, screenshots.

## Verification

- Automated: `test/e2e/status.spec.ts` on the TEST database: AC-1 on a *Reading* and a *Listening* row, `read_events.format` read back from the database; AC-2's date; AC-3's rows; AC-4's focus and a refused write; AC-5's slate and screenshots. The test first fails on `main`, where the row has no button.
- Manual: `npm run dev`. From the Books screen tap *Status* → *In flight*. Tap **Finished** on a book → it moves to *Done*, both counts change, and the toast shows *Keep going?*. Tap Undo → it's back, as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- TASK-049's *✓ finished* / *Finished it* should finish through `useBookWrite`, not a second write (approved at plan) → docs/tasks/TASK-049-books-dashboard.md § Context
- 2.2h: the finish toast's copy now lives in `useBookWrite`, one place for both finishes (approved at plan) → docs/tasks/TASK-055-finishing-follows.md § Context

## Plan

Approved by the owner at the plan gate, 2026-11-07. The mockup frames (step 1) are done and committed in c5d5352. Open question answered: In flight's meta stays `308,931 words` (the plan's default), though it squeezes a long title to three lines at 360.

**Steps**

1. **Mockup (done):** four `.frame.fin-f` frames at the end of `status` in `design/mockups.html` (360 before, 360 after with the toast, 834, desktop) and the `design/mockups-index.md` row. Still to do: `.first()` on the locator `openTab` returns in `test/e2e/mockup-tablet.spec.ts`, because `status` now has two `data-w="tab"` frames and a locator is strict.
2. **Tests first:** the new tests in `test/e2e/status.spec.ts`; confirm they fail because the row has no button.
3. **Shared finish:** `src/components/useBookWrite.ts` (new), a hook holding what `BookStatus.write` does now: `POST /api/progress/book`, `router.refresh()`, `push` with the label and detail (`NAMES` moves here, so the hook owns the toast's copy), the undo (`DELETE` with the server's `change`) and `offerChips(offer)`. A 400 returns the server's reason; anything else that fails throws. It takes callbacks for what a caller does around the write, so `BookStatus` keeps only its local state (`saving`, `failed`, `refused`, `saved`, `refocus`) and no second copy exists. It must fit TASK-049's *✓ finished* too.
4. **Button:** `src/components/FinishBook.tsx` (new, client): `<button class="btn sec sm" aria-label="Finished <title>">Finished</button>`, sending `finish: { mode: "today" }` through the hook, with no date control, on *Reading* and *Listening* alike (the server logs `audio`, D-112).
5. **Double taps:** ignore a tap while saving and stay locked after success until the row unmounts or Undo runs (the undo closure unlocks it, for an Undo that lands before the refresh). `onKeyDown` calls `preventDefault` on `e.repeat`: focus lands on the next book's **Finished**, so a held Enter would finish that one too.
6. **Focus:** on success, only if the button holds focus, move it before the refresh to the next `.finish-book` in the panel, else the previous one, else `#tab-inflight`, which survives the refresh (the *Nothing in flight.* slate's link doesn't exist yet). Undo puts focus on the restored row's **Finished**: a module-level `refocus` id read in an effect, the pattern `BookStatus` uses for *Add to Someday*.
7. **Failed write:** `fail({ label, retry })` from `useUndo` (R1-07): *Couldn't finish <title>. Nothing changed.* with Retry, or the server's reason for a 400 (*Not saved: <reason>.*), also with Retry. The row stays and focus stays on the button.
8. **Row:** `StatusBookRow` gains `action?: React.ReactNode`. With it, the text goes in `<span class="row-text">` and the action in the existing `.row-verbs`, whose rule already makes the row flex; without it, the markup is unchanged. `src/app/books/status/page.tsx` passes `<FinishBook>` on In flight's rows only. `globals.css`: `.row-text{flex:1;min-width:0;overflow-wrap:anywhere}` (block, as the row's children are), tokens only.

**Files**

- `design/mockups.html`, `design/mockups-index.md`: the frames (done).
- `src/components/useBookWrite.ts` (new; not in *Files likely touched*): the shared finish, in place of the task's "shares the finish" inside `BookStatus`.
- `src/components/FinishBook.tsx` (new): **Finished**.
- `src/components/BookStatus.tsx`: `write` goes through the hook.
- `src/components/StatusBookRow.tsx`: the slot.
- `src/app/books/status/page.tsx`: In flight's rows pass it.
- `src/app/globals.css`: `.row-text`.
- `test/e2e/status.spec.ts`: the task's tests.
- `test/e2e/mockup-tablet.spec.ts` (not in *Files likely touched*): `.first()`.

**Test strategy** (`test/e2e/status.spec.ts`, Playwright on the TEST database; the writing tests are `ONCE`)

- AC-1: "Finished on a Reading row writes read and a text read; on a Listening row an audio read", "the toast carries Keep going?; Undo restores the status and leaves no read", "the book moves to Done and both tabs' counts equal their rows", `floor(page)` for axe, and nothing resolving to `--danger`; screenshots.
- AC-2: "a book with a known start: no date control, today and exact, the start kept, the toast's words; Undo restores both".
- AC-3: "a button named Finished <title> on In flight only, and no other status control on the row".
- AC-4: "keyboard: focus goes to the next row, the previous row, then the In flight tab; F6 reaches the toast", "Undo puts focus on the restored row's Finished", "a failed write (route abort) offers Retry, the row stays, no read_events row; Retry saves".
- AC-5: "the button is at least 24px tall", "finishing the last book shows Nothing in flight.", "a long title doesn't overflow at 360", contrast through `floor`, and the existing read-only *In flight* test's screenshot at every width, light and dark, now with the button.
- The refactored Library write: `follows`, `start-dates`, `audiobooks`, `unlisted` already cover it.
- Manual: the task's *Verification* steps.

**Risks / open questions**

- `books-status` JS budget (`scripts/perf/budget.json`): the route gains the hook and `FinishDate.tsx`'s helpers (`finishWords`). Lighthouse is the gate; if it goes over, move the helpers to `src/lib`.
- `status.spec.ts`'s *books* describe asserts In flight's exact rows and the file runs in parallel projects: the new tests need their own serial, cleaned-up seed, leaving the existing `E2E Reading Now` row as found.
- A held-Enter guard stops key repeat only; two deliberate presses finish two books, and only the second can be undone (one toast at a time). AC-4 asks for focus there, so it is accepted.

**Size check:** 10 files, no schema, over the 8-file line. `workflow.splitPolicy` is `never-split` and `autonomy` is already `attended`: the finish, its button and the row can't ship apart.

**Follow-ups:** the two in `## Follow-ups` above.

## Review log

Verify R1 round PASS → full PASS (832 e2e) | Audit R1 CHANGES (keyboard test weak, 400 path, --danger) → R2 PASS | Spec R1 APPROVE | UI R1 PASS (dev DB had one Listening book; Reading/Up next/Done rows and the DB reads are proven by the e2e suite)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1 (round, then full chain)
- Review rounds: 1 (audit 2)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
