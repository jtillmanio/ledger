---
id: TASK-054
title: 2.2f Finish a book from In flight
status: Draft
depends_on: [TASK-017, TASK-010, TASK-048]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim): in the browser (0.11), **Finished** on a *Reading* row writes `read`
and one `read_events` row with `format = text`, and on a *Listening* row one
with `format = audio`; the toast carries *Keep going?*; Undo restores the status
and leaves no read; the book moves from In flight to Done and both tabs' counts
equal their rows. The button is reachable by keyboard, axe passes and nothing
resolves to `--danger`. Screenshots at 360px and 1280px.
- [ ] AC-2: Given a book *Reading* since a known date, **Finished** opens no date control and writes `finished_on` = today with precision `exact`; the read keeps that start date; the toast reads *<title>: read* with *Finished <today>*. Undo puts the status and the start date back.
- [ ] AC-3: **Finished** is a `<button>` named *Finished <title>*, on *Reading* and *Listening* rows only: a row on *Up next* or *Done* has none, and an In flight row has no other status control.
- [ ] AC-4: After a finish by keyboard, focus is not on `body`: it is on the next row's **Finished**, or where the plan says when the list empties, and F6 moves it to the toast (D-116). When the write fails, the failed-write line offers Retry, the row stays on In flight, and no `read_events` row exists.
- [ ] AC-5: In flight meets the UX floor (`docs/04-design.md` § 10. The UX floor): the button is at least 24px tall and sized as the `status` mockup draws it; finishing the last book shows the existing *Nothing in flight.* slate; a long title doesn't overflow the row at 360px; the name stays 4.5:1 in both themes; axe reports no new violations; screenshots at every `ui.viewports` width, light and dark.

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
