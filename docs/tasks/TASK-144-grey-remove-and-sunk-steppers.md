---
id: TASK-144
title: 6.24 Built screens follow the mediums review (2 of 4) — grey Remove from Listen next, steppers on --sunk
status: Review
depends_on: []
size: S
model: sonnet
autonomy: unattended
ui: true
plan_status: approved
planned_at_commit: 64dd15c
---

# TASK-144 — 6.24 Built screens follow the mediums review (2 of 4) — grey Remove from Listen next, steppers on --sunk

## Goal

*Remove from Listen next* reads grey like *Remove from shelf*, and the batch and finish sheets' steppers sit on `--sunk` like every other stepper.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 2 of 4.** TASK-143 does the finish toast, TASK-145 the Library, TASK-146 the remaining mockup frames and ticks 6.24.
- **Grey Remove** (MR-D16, frame E8 in `design/MR-E-Review-2.dc.html`): *Remove from Listen next* (`src/components/ListenNext.tsx`, task 5.14, its row menu's `label: \`Remove from ${LISTEN_NEXT}\``) is grey, as *Remove from shelf* is. Copy how *Remove from shelf* is styled (`src/components/ShelfBooks.tsx`).
- **Steppers on `--sunk`** (MR-D18, MR-Q18, frame E11; `design/STYLE_GUIDE.md` §9 and §17.9): the batch sheet (`src/components/BatchSheet.tsx`, its `.stepper` group *How many issues*) and the finish sheet's year stepper (`src/components/FinishDate.tsx`, `.stepper`) are drawn from `--raise` today; they move to `--sunk`, as `src/components/Stepper.tsx` (Settings) already is. The `.stepper` rules are in `src/app/globals.css`.
- Design: `design/mockups.html` §§ `status` (books *Listen next*) and `batch`, and the books finish sheet, redrawn from E8 and E11 (`ui.redrawFiles`; `design/mockups-index.md` lists them as 6.24's). `settings`' stepper is TASK-146's frame.
- Rules: hard rule 6 (tokens only; only *Remove* and *Drop* may be red, and the review chose grey here). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-177.
- *From TASK-143 (6.24, PR #340):* D-183 moved *Keep going?* out of the finish toast into the *Follow…* sheet, and PR #340 redrew only `finishoffer`. Two other places in the mockup still draw or describe it in the toast: `status`'s In flight *Finished* toast (`design/mockups.html`, the 2.2f frame's `.kg` *Keep going?* group; `design/mockups-index.md`'s `status` row, *the toast with Keep going?*) and `thisorthat`'s note (*Rank it* "above *Now reading* and *Keep going?*"). This task redraws `status`, so it can redraw that toast capped as `finishoffer` now draws it (one *Now reading* chip and *+N · Follow…*); `thisorthat`'s note needs the same words.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *Remove from Listen next resolves to no --danger colour* and *the batch and finish sheets' stepper buttons resolve to --sunk*, and redraws `status` and `batch`. TASK-143, TASK-145 and TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [x] AC-2: Given the Listen next row menu open, *Remove from Listen next*'s text and icon resolve to the same computed colours as *Remove from shelf*'s in both themes, and its undo still puts the book back where it was.
- [x] AC-3: The batch sheet's and the finish sheet's − and + buttons and number resolve to the same background as Settings' stepper (`--sunk`) in both themes, and their text keeps 4.5:1 on it.
- [x] AC-4: These controls meet the UX floor (`docs/04-design.md` § 10. The UX floor): contrast in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.
- [x] AC-5: `design/mockups.html` §§ `status` (*Listen next*) and `batch` and the finish sheet are redrawn from E8 and E11, and their `design/mockups-index.md` rows say so.

## Out of scope

- Making the batch and finish sheets' steppers typed and held (`Stepper.tsx`'s behaviour, MR-D18's first half): only their surface changes here; adopting `Stepper` there is a follow-up if the plan finds it isn't already wanted elsewhere.
- Any other menu item's colour.
- The finish toast (TASK-143), the Library (TASK-145), `settings` and the 834px frames (TASK-146).

## Files likely touched

- `src/components/ListenNext.tsx` — the menu item's tone.
- `src/app/globals.css` — `.stepper` on `--sunk` in sheets.
- `src/components/BatchSheet.tsx`, `src/components/FinishDate.tsx` — only if a class must change.
- `design/mockups.html`, `design/mockups-index.md` — `status`, `batch`, the finish sheet.
- `test/e2e/listen-queue.spec.ts`, `test/control-states.test.ts` — AC-1's two clauses, AC-2, AC-3.

## Verification

- Automated: a browser test at 360px, light and dark, reading computed colours (AC-1's two clauses, AC-2, AC-3) with axe; the existing Listen next undo test still passes.
- Manual: the ui-verifier opens Listen next's menu and the batch and finish sheets at 360px → expected: *Remove* grey, steppers on the sunk surface, as E8 and E11.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The batch and finish sheets' steppers still lack Settings' typed number and held buttons (MR-D18's first half, this task's Out of scope; nothing tracked it) → docs/05-roadmap.md § 6.24b (new; Check proposed), docs/06-tasklist.md § M21
- `thisorthat`'s toast frame redrawn here as one *Now reading* chip and *+3 · Follow…*, so its note and frame agree (D-183); its 834px frame stays TASK-146's → not tracked: done in this PR (plan revision, the note's own frame)
- The finish sheet's *Year only* radio overlays its label, so a plain click on the label text is intercepted (seen by ui-verifier; not caused by this task) → docs/05-roadmap.md § 6.24b (a sentence in its body; Check unchanged)

## Plan

Approved by the owner 2026-11-25. Worktree `.claude/worktrees/task-144`, branch `task/6.24-grey-remove-sunk-steppers`, test DB `ledger_test_2`, E2E port 3200 (`.env.worktree`).

**Reading of AC-3 and the Check (owner, at plan):** "stepper buttons resolve to `--sunk`" means the stepper as §9 and E11 draw it and Settings builds it: the **track** (`.stepper`, the `role="group"`) is `--sunk` with the 1px `--rule` ring in dark, the − and + buttons stay `--surface`, and the number (`.val`, transparent) shows the `--sunk` track. The tests prove each sheet's track equals Settings' track (= `--sunk`) and each sheet's buttons equal Settings' buttons. Menu items carry no icon (`src/components/Menu.tsx`), so AC-2 compares the text colour only; the test says so.

**Steps**

1. Tests first, each failing before the change for the expected reason:
   - `test/e2e/listen-queue.spec.ts`: seed a books shelf (`e2e-lq-shelf`) holding `ONE` in `beforeAll` (removed in `afterAll`, by the `books` cascade and an explicit `DELETE FROM shelves`). New test at 360px, light and dark: open `/books/shelves/<id>`, read *Remove from shelf*'s computed `color`; open Listen next's ⋯ for `TWO`, *Remove from Listen next*'s `color` equals it, isn't `tokenColour(--danger)`, and the item has no `danger` class (AC-1 first clause, AC-2). The existing *Remove from Listen next … Undo* test stays as the undo proof (AC-2). Extend the floor test (axe, contrast, screenshots) with the menu open at each `ui.viewports` width, light and dark (AC-4).
   - New `test/e2e/stepper-surface.spec.ts` (`@area` header like its neighbours): Settings' `.stepper` and its first button's `background-color` read as the reference; the batch sheet (`/comics`, *+ batch*, group *How many issues*) and the finish sheet (a seeded read book's *Finished* on `/books/list`, *Year only*, the year group) each: track `background-color` = Settings' track = `tokenColour(--sunk)`, − and + = Settings' buttons, `.val` transparent over the track; `contrastFailures` empty with the sheet open (text 4.5:1). At 360px light and dark (AC-1 second clause, AC-3); axe, no sideways scroll and screenshots at each `ui.viewports` width, light and dark (AC-4). Seeded rows under its own id prefix, removed after.
   - `test/control-states.test.ts`: no rule whose subject is `.stepper` sets a background of `var(--raise)`, and the base `.stepper` rule's background is `var(--sunk)`.
2. `src/components/ListenNext.tsx`: `danger: false` on `remove`, with the comment's reason (no loss: the book stays in the library and the plan), as `ShelfBooks.tsx` says it.
3. `src/app/globals.css`: base `.stepper` `background:var(--raise)` → `var(--sunk)`; `.settings .stepper` keeps only `margin-left:0`; the Settings block's comment no longer says the sheets keep theirs (MR-D18, MR-Q18).
4. `design/mockups.html`: the base `.stepper` rule → `--sunk` (redraws `batch`'s steppers and the books finish sheet's year stepper in `blist`, from E11); `status`'s Listen next menu loses `style="color:var(--danger)"` on *Remove from Listen next* (E8); `status`'s In flight *Finished* toast redrawn capped as `finishoffer` draws it (one *Now reading* chip and *+N · Follow…*, D-183) and its note reworded; `thisorthat`'s note "above *Now reading* and *+N · Follow…*" (TASK-143's note in Context).
5. `design/mockups-index.md`: the `status` row (the capped toast, *Remove* grey), the `batch` row (stepper on `--sunk`), and the review table's E8 and E11 rows say redrawn (task 6.24, TASK-144); `settings` stays TASK-146's.

**Files**

- `src/components/ListenNext.tsx` — the item's tone.
- `src/app/globals.css` — `.stepper` on `--sunk`.
- `design/mockups.html`, `design/mockups-index.md` — `status`, `batch`, the finish sheet, `thisorthat`'s note (`ui.redrawFiles`).
- `test/e2e/listen-queue.spec.ts` — AC-1, AC-2, AC-4 for the menu.
- `test/e2e/stepper-surface.spec.ts` — **new, not in Files likely touched**: the batch sheet is a comics screen and the finish sheet a books one, so neither existing spec holds both with Settings as the reference.
- `test/control-states.test.ts` — the static `--sunk` check.
- `BatchSheet.tsx`, `FinishDate.tsx` — not touched: no class changes.

**Test strategy**

| AC | Proof |
|---|---|
| AC-1 | `listen-queue.spec.ts` (Remove not `--danger`) and `stepper-surface.spec.ts` (tracks `--sunk`), 360px light and dark; mockup clauses by spec-reviewer |
| AC-2 | `listen-queue.spec.ts`: same colour as *Remove from shelf*; the existing Undo test |
| AC-3 | `stepper-surface.spec.ts`; `control-states.test.ts` |
| AC-4 | the floor loops in both specs (axe, `contrastFailures`, screenshots per `ui.viewports` width and theme) |
| AC-5 | the mockup diff; spec-reviewer and ui-verifier |

**Risks:** the base `.stepper` change reaches every stepper (Settings, batch, finish); that is the intent (§9 "everywhere"). Dark `--sunk` (#05060e) sits under the page, so the existing dark `--rule` ring keeps the track legible (SG-D2). The batch sheet needs the e2e comics run with unread issues; `thumb-bar.spec.ts` uses the same fixture.

**Size:** 7 files, no schema. Within the split policy.

## Review log

- Verify R1 FAIL (1: `e2e-shards.test.ts`, the new spec untimed tipped the 8-shard plan to 1.036) → fixed (shard-times estimates) | Verify R2 PASS | e2e `w390-light`, both specs 15/15 PASS | CI R1 PASS (`3de0491`)
- Audit R1 PASS (stepper-surface, grey-Remove and control-states tests fail on the pre-task code; the two floor tests pass on both, as a no-new-violations floor does)
- Spec R1 APPROVE (note: `thisorthat`'s toast frame still drew two chips → redrawn `dfefffb`) | UI R1 PASS (360 light and dark, glances at 390–1280, no console errors)
- Plan revisions: thisorthat's toast frame; `shard-times.json` (not in Files likely touched)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (spec, UI), 1 test audit
- First-pass AC FAILs: 0
- Plan revisions after approval: 0 (two small additions noted in the Review log: the thisorthat frame, shard-times)
