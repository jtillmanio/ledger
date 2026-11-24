---
id: TASK-146
title: 6.24 Built screens follow the mediums review (4 of 4) — the mockup's settings frame, gear icons and six 834px frames
status: Ready
depends_on: [TASK-143, TASK-144, TASK-145]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-146 — 6.24 Built screens follow the mediums review (4 of 4) — the mockup's settings frame, gear icons and six 834px frames

## Goal

`design/mockups.html` matches the mediums review everywhere 6.24 covers: the `settings` frame is redrawn, every phone bar's gear is the drawn icon, and the tablet gains the review's six 834px frames, so the mockup is again the layout source for those screens.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 4 of 4.** TASK-143 (the finish toast, `finishoffer`), TASK-144 (grey *Remove*, the steppers; `status`, `batch`) and TASK-145 (the Library; `blist`) redraw their own frames with their screens. This part draws what no built screen changes, and **its merge ticks 6.24**, with the other three merged first.
- **What it draws** (`design/mockups-index.md` § Nov 2026, mediums review; `design/STYLE_GUIDE.md` §17.8):
  - `settings`, from E11 (the stepper on `--sunk`, typed and held) and E17's layout. E17's *Start on* row is 6.25's (TASK-147), *Spotify* 9.x's and *Your platforms* 10.0's: each is left for its task, and the index row says so.
  - The six 834px frames from E12–E17 (`design/MR-E-Review-3.dc.html`): `bookdetail`, `thisorthat`, `top`, `rebalance` (and `moveplan` by its rule), `calibre`, `settings`.
  - Every phone bar's U+26B2 or text gear becomes the drawn icon, which §9 already required (the index's closing note says 6.24 and 6.25 share it; the phone bars 6.25 redraws in TASK-148 start from this).
- **Design files are read, never edited:** `design/*.dc.html` and `design/STYLE_GUIDE.md` are in `protectedPaths`. Only `design/mockups.html` and `design/mockups-index.md` change (`ui.redrawFiles`). The mockup's own tokens and classes are used (`design/tokens.css`); its covers are placeholders and figures sample data (D-7).
- **The mockup has a test:** `test/e2e/mockup-tablet.spec.ts` (and `test/e2e/markup.spec.ts`) check the mockup's frames; new 834px frames must pass them.
- Decisions: D-7, D-40, D-177.
- *From TASK-143 (6.24, PR #340), open question for the plan:* two differences from E10 that the capped finish toast left open, for the owner to settle against `design/MR-E-Review-2.dc.html` E10 (and `design/mockups.html` § `finishoffer`, redrawn in PR #340): (a) at 360–412px a long kept chip (*Discworld - Death · subseries ×*) pushes *+N · Follow…* onto its own line, so the toast can have three chip rows (*Rank it*, the chip, *+N*) where E10's note says two at most; (b) the toast's *Now reading* label is small sentence case, as built since 2.2h, where E10 draws an uppercase mono label. Either may need a `src/components/ToastOffer.tsx` or `src/app/globals.css` change beside the frame (owner, at TASK-143's close-out).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *the `settings` frame is redrawn from the review and it gains the six 834px frames*; with TASK-143 to TASK-145 merged, every clause is proven and 6.24 is ticked):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [ ] AC-2: `design/mockups.html` holds an 834px frame for each of `bookdetail`, `thisorthat`, `top`, `rebalance`, `calibre` and `settings`, each reachable by its `data-id` with `powershell -NoProfile -File scripts/screen.ps1 <id>`, and `test/e2e/mockup-tablet.spec.ts` lists each in its `SCREENS` and passes.
- [ ] AC-3: No phone bar in `design/mockups.html` contains U+26B2 or a text gear: a search for `⚲`, `&#x26b2;` and `&#9906;` finds nothing, and each bar's gear is the drawn icon.
- [ ] AC-4: `design/mockups-index.md`'s mediums review table marks `settings` and the six 834px frames as redrawn by this task, names what is left (*Start on* → 6.25; *Spotify*, *Your platforms* → 9.x, 10.0), and the frames' line ranges are updated.

## Out of scope

- Any change to the app (`src/`).
- `finishoffer`, `status`, `batch`, `blist` (TASK-143 to TASK-145).
- The phone bar's medium button and search, the rails and sidebar (6.25, TASK-148, TASK-149).
- Editing any `design/*.dc.html` or `design/STYLE_GUIDE.md`.

## Files likely touched

- `design/mockups.html` — `settings`, six 834px frames, the gear icons.
- `design/mockups-index.md` — rows and line ranges.
- `test/e2e/mockup-tablet.spec.ts` — its `SCREENS` list (`home`, `spine`, `bdash`, `status`) gains the six new 834px frames.

## Verification

- Automated: `test/e2e/mockup-tablet.spec.ts` and `test/e2e/markup.spec.ts` pass; a grep for the gear glyphs finds none (AC-3).
- Manual: the owner compares each redrawn frame with E11–E17's PNGs in `design/screenshots/mediums-review/` → expected: layout and copy match, apart from the rows the index leaves to later tasks.

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
