---
id: TASK-002
title: 1.1 Range marking
status: In progress
depends_on: [TASK-001]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 344a0b6
---

# TASK-002 — 1.1 Range marking

## Goal

Many issues of a run can be marked read in one go: select a stretch of the spine, choose how to date it, and confirm. A range never overwrites a date already recorded, and one Undo takes the whole range back. Placements read in other runs can be adopted with their original dates.

## Context

- Roadmap: `docs/TASKS.md` § 1.1 Range marking (sitting 3, after 1.2). The roadmap entry, its date-rules table and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the endpoint, the selection and the sheet ship together on one branch. The range rules (placement ids only, `DO NOTHING`, precision per mode) are only testable end to end, from a selection to rows.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.14 (marks act on this run's placements only) and 2.17 (date and precision); § 4. Interface (the route table gains `POST /api/progress/range`).
- Data model: `src/db/schema.ts` `issueProgress`, `runIssues`; `etl/views.sql` `issue_read_runs` (`first_read_at`, `first_read_precision`), the source for *Adopt* and *Original dates*.
- Design: mockup `range` (the sheet, its four date options and the *marked through here* row) and `krakoa` (the run hero's `⋯` menu: *Copy unread (N) · Copy all (N) · Copy as ranges*, confirmed by *Copied N unread issues*). Mockup `spine` draws *Adopt 2 prior reads* in the hero. `docs/TASKS.md` § *Focus returns where it came from* (R1-11) and D-34 (one sheet at a time) govern the sheet; this is the first task to open one, so it builds the shared sheet behaviour.
- Decisions: R3-10 (placement ids, not sequences; undo comes from 1.2), R3-07 (date rules), D-9 (a stale tab is an accepted risk, so the server checks ids), D-33 (shift-click sits behind `(hover:hover) and (pointer:fine)`, and a tablet uses long-press), UX-N17 (the desktop selection is visible before the sheet opens).
- Builds on TASK-001's undo stack: a range is one entry whose inverse removes exactly the rows this range inserted.
- **Date writes follow the roadmap's table exactly.** It is the owner's spec for this write, so the plan cites it row for row. Any departure is a stop-and-ask (CLAUDE.md).
- **Settled by the owner, 2026-10-09:**
  1. A range opened by long-press or *Mark everything through here* starts at the run's first unread placement and ends at the pressed row.
  2. *Copy as ranges* copies the run's `run_span.series_issues` text (`X-Men (2019) #1-21; …`).
  3. The toast after a range reads *N issues marked read* (mockup `range`), with 1.2's run count line as its second line.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test marks sequences 5 through 200 of a run in one call and asserts 196 `issue_progress` rows, one per placement, in one round trip. Marks go to this run's placements only (0.8a): an issue in the range also placed in another run stays unread there. A range containing four placements that already carry a March date leaves those four dates untouched (`DO NOTHING`). Spread over 10 placements writes non-decreasing dates from start to end with precision `approximate`; No date writes NULL and `none`. A request whose `placementIds` include an id from another run is rejected and writes nothing. Adopting 9 prior reads writes 9 placements with `completed_at` equal to their original read dates (NULL where those were undated) and the same precision (an `approximate` prior read stays `approximate`), in one request, and one undo removes exactly those 9. At 1280px, a click on the fifth row and a shift-click on the twenty-second opens the sheet counting 18 placements. Manually: open `hickman-krakoa` (641 issues), mark a 100-issue range, confirm no visible stall.
- [ ] AC-2: `POST /api/progress/range` with `{ runId, placementIds, mode, date?, from?, to? }` returns 400 and writes nothing when: `mode` is not one of the five modes; *Pick a date* has no `date`; *Spread* lacks `from` or `to`, or has `to` before `from`; any id is not a live placement of `runId` (soft-deleted placements included). A valid request returns the ids it inserted and the count it skipped as already read. Today writes `exact`, *Pick a date* writes that date as `exact`, and in *Spread* the first placement gets `from` and the last gets `to`.
- [ ] AC-3: Given a range of 12 placements, 2 of them optional and 3 already read here, the sheet reads *12 issues · 2 optional*. After confirming, the toast's first line reports 9 marked and *3 already read, kept their dates*, and its second line is 1.2's run count line. One **Undo** deletes exactly the 9 inserted rows, and the 3 earlier rows keep their `completed_at` and precision.
- [ ] AC-4: Given a run with 9 unread placements whose issues are read in another run, the run hero shows *Adopt 9 prior reads*. It opens the same sheet pre-filled with those 9 and a fifth option, *Original dates*, which appears only from this entry point. Given a run with no such placements, no Adopt control renders. An issue with two prior reads adopts the earliest.
- [ ] AC-5: With a fine pointer (`matchMedia('(hover:hover) and (pointer:fine)')` true), the first click sets an anchor row with a 1px `--brand` ring. Hovering another row tints the rows between in `--brand-soft` and shows a pill counting them (*Mark N read · Shift-click to finish*). `Esc` clears the anchor. With a coarse pointer, a long-press on a row selects from the run's first unread placement to that row and opens the same sheet, and each row's menu offers *Mark everything through here*. A single tap or click never opens the sheet or prompts for a date. The run hero's `⋯` menu offers *Copy unread · Copy all · Copy as ranges*: the first two copy the labels one per line in sequence order, and each copy is confirmed by a `role="status"` toast.
- [ ] AC-6: The range sheet meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task* and § *Focus returns where it came from*). It is labelled by its heading, which takes focus on open (`tabindex="-1"`). It traps Tab, marks the page behind it `inert`, and is dismissed by `Esc`, Cancel and Back, each of which returns focus to the control that opened it. The date options are real radio inputs with names. A disabled confirm is `aria-disabled="true"` with its reason shown. Targets are at least 24px. Shift-click and hover tints sit behind `(hover:hover) and (pointer:fine)`. Screenshots at every `ui.viewports` width, light and dark, including the desktop anchor and pill at 1280px.

## Out of scope

- The thumb bar's *Mark through…* and the batch sheet (*Mark next N*) (1.8b). They can reuse this endpoint later, but they aren't built here.
- The undo stack itself (TASK-001). This task only pushes onto it.
- Eras, *Hide read*, the minimap and the ordinal gutter on the spine (3.6, 3.6c, 3.6b).
- Auto-ticking placements read elsewhere. *Adopt* is the only route, and it is explicit and previewed.
- Logging range marks as `read_events` (1.5).
- Revalidating a stale tab against the server beyond the per-id ownership check (D-9).

## Files likely touched

- `src/app/api/progress/range/route.ts` (new): the endpoint, modelled on `src/app/api/progress/issue/route.ts`.
- `src/db/writes.ts`: `markRange` (one multi-row `INSERT … ON CONFLICT DO NOTHING RETURNING`) and its inverse.
- `src/db/queries.ts`: adopt candidates per run (from `issue_read_runs`), and fields for the run hero.
- `src/components/IssueRow.tsx`: anchor, hover tint, shift-click, long-press, the row menu.
- `src/components/RangeSheet.tsx` (new) and `src/components/Sheet.tsx` (new): the date sheet, and the shared sheet behaviour (focus, inert, Esc and Back).
- `src/app/comics/[runId]/page.tsx`: the run hero's *Adopt N prior reads* and the `⋯` copy menu.
- `src/app/globals.css`: sheet, scrim, anchor ring, range tint, pill.
- `docs/ARCHITECTURE.md` § 4. Interface: add the route.
- `design/mockups.html`, `design/mockups-index.md`: the fifth *Original dates* option, and the desktop anchor and pill in `range` (`ui.redrawFiles`).
- `test/range-marking.test.ts` (new, DB) and `test/range-sheet.test.tsx` (new, happy-dom).

## Verification

- Automated: `test/range-marking.test.ts` against `TEST_DATABASE_URL` covers the 5 → 200 count (196 rows), cross-run isolation, `DO NOTHING` on four March dates, *Spread* over 10, *No date*, the foreign-id rejection, *Adopt 9* with mixed precisions and its single undo, and the 400 cases (AC-1, AC-2, AC-3). `test/range-sheet.test.tsx` (pattern: `test/spine-toggle.test.tsx`, with `matchMedia` stubbed) covers the anchor, the 5th → 22nd count of 18, `Esc`, the single-tap no-prompt rule, focus return and the Adopt control's presence (AC-1, AC-4, AC-5, AC-6).
- Manual: open `hickman-krakoa`, mark a 100-issue range with *Spread* → expected: no visible stall, and the count rises by the number inserted. Undo → expected: the count is back. Run *Adopt* on a run with prior reads → expected: the dates match those reads.

## Plan

Approved by the owner 2026-10-10.

**Steps**
1. Tests first: `test/range-marking.test.ts` (DB) and `test/range-sheet.test.tsx` (happy-dom, `matchMedia` stubbed); both fail.
2. `src/db/writes.ts`: `markRange(userId, runId, ids, mode, dates)` is one SQL statement — a CTE checks every id is a live placement of `runId`, and only when all are does one `INSERT … ON CONFLICT DO NOTHING RETURNING` run (one round trip). `unmarkRange` deletes this user's rows for those ids in this run.
3. `src/app/api/progress/range/route.ts`: `POST` validates (each AC-2 case → 400) and returns `{ inserted: number[], skipped }`; `DELETE { runId, placementIds }` is the undo inverse.
4. Date rules, row for row with the roadmap table:
   - Today → `now()`, `exact`.
   - Pick a date → `date`, `exact`.
   - Spread → the k-th of n selected placements (sequence order) gets `from` + round(k·(to−from)/(n−1)) days (first = `from`, last = `to`; n=1 gets `to`), `approximate`.
   - No date → NULL, `none`.
   - Original dates (Adopt only) → `issue_read_runs.first_read_at`, `first_read_precision`; a placement with no prior read (stale tab) → 400, nothing written.
   - A calendar day is stored as UTC midnight, whole days (owner, 2026-10-10); display stays UTC through `readWhen`. Eastern time is a follow-up.
5. `src/components/Sheet.tsx` (new, shared): portal, `role=dialog` labelled by its heading (`tabindex=-1`, focused on open), the page behind `inert`, Tab trapped; Esc, Cancel, Back (a `history.pushState` entry) and confirm all close it and return focus to the opener.
6. `src/components/RangeSheet.tsx` (new): *Mark N issues read*, first and last labels, *N issues · K optional*; real radio inputs named `mode`; *Original dates* only from Adopt; `<input type=date>` fields; an unavailable confirm is `aria-disabled` with its reason.
7. `src/components/IssueRow.tsx`: fine pointer — click on the row body (not the checkbox) sets the anchor, hover tints and shows the pill, shift-click opens the sheet, Esc clears. Coarse pointer — long-press (500ms) runs from the first unread placement to the pressed row. Each row gets a `⋯` menu with *Mark everything through here* (visible on touch; on hover or focus with a fine pointer). The hero row of controls: *Adopt N prior reads* (counted from the spine rows: unread here, read elsewhere, so the page stays at 3 queries) and `⋯` with *Copy unread (N) · Copy all (N) · Copy as ranges* (`run_span.series_issues`). A range ticks rows locally, then the toast reads *N issues marked read · M already read, kept their dates* over the run count line, and one undo entry `DELETE`s exactly the inserted ids.
8. `src/app/comics/[runId]/page.tsx` passes `series_issues`. `src/app/globals.css`: sheet (`--overlay` over `--scrim`), anchor ring, `--brand-soft` tint, pill, menu; hover rules behind `(hover:hover) and (pointer:fine)`.
9. Docs: a route row in `docs/ARCHITECTURE.md` § 4. Interface; `design/mockups.html` `range` gains the fifth option and the desktop anchor and pill; `design/mockups-index.md` matches; tick 1.1 in `docs/TASKS.md`.

**Files** (listed in the task unless marked): `src/app/api/progress/range/route.ts` (new), `src/db/writes.ts`, `src/components/IssueRow.tsx`, `src/components/RangeSheet.tsx` (new), `src/components/Sheet.tsx` (new), `src/app/comics/[runId]/page.tsx`, `src/app/globals.css`, `docs/ARCHITECTURE.md`, `design/mockups.html`, `design/mockups-index.md`, `test/range-marking.test.ts` (new), `test/range-sheet.test.tsx` (new), `docs/TASKS.md`.
- Not in the task's list: `src/components/Undo.tsx` gains `notify(label)`, a toast with no Undo, for the copy confirmations; `src/components/Menu.tsx` (new) is a small `role=menu` popup shared by the row and the hero.
- Left unchanged: `src/db/queries.ts`, because the Adopt count comes from the spine rows already loaded.

**Test strategy**
- AC-1 and AC-2, `range-marking.test.ts`: 5→200 gives 196 rows in one statement; cross-run isolation; four March rows untouched; Spread over 10 is non-decreasing and `approximate`; No date is NULL and `none`; a foreign or soft-deleted id → 400 and nothing written; every AC-2 400 case.
- AC-1 Adopt part: Adopt 9 with mixed precisions, the earliest of two reads, and one `DELETE` removes exactly those 9.
- AC-3: the DB file covers 12 placements with 3 already read (9 inserted, 3 dates kept, undo deletes the 9); the happy-dom file covers the *12 issues · 2 optional* line and the toast text.
- AC-4 to AC-6, `range-sheet.test.tsx`: Adopt present and absent, the fifth radio only from Adopt; 5th → shift-22nd counts 18; Esc; a single click never opens the sheet; long-press; the row menu; the copy toasts; focus return, `inert`, the Tab trap, the radio inputs.
- Screenshots: ui-verifier at every `ui.viewports` width, light and dark.

**Risks**: more than 8 files, kept whole (`never-split`); Back relies on Next 16's `pushState` integration.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
