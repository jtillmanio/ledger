---
id: TASK-146
title: 6.24 Built screens follow the mediums review (4 of 4) — the mockup's settings frame, gear icons and six 834px frames
status: In progress
depends_on: [TASK-143, TASK-144, TASK-145]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 81032b6
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

- The app's `Stepper.tsx` draws no ring while a button is held, where E11 draws a 1.5px `--brand` ring (the mockup's settings frame draws it from this task) (approved at plan) → `docs/05-roadmap.md` § 6.24b
- TASK-143's two finish-toast differences from E10 (the kept chip pushing *+N · Follow…* to a third row at 360–412px; the sentence-case *Now reading* label where E10 draws uppercase mono): the owner chose a new roadmap item to fix both in `ToastOffer.tsx` / `globals.css`, with a proposed **Check:** (owner, at plan) (approved at plan) → `docs/05-roadmap.md` § 6.24c (new)

## Plan

Approved 2026-11-25 (owner: keep every row the phone frame has in the 834 `settings` frame, laid out as E17; remove the merged task-145 worktree for ledger_test_3; TASK-143's toast question → a new roadmap item).

**Steps**

1. **Tests first**, `test/e2e/mockup-tablet.spec.ts`: `SCREENS` gains `bookdetail`, `thisorthat`, `top`, `rebalance`, `calibre`, `settings`. The rail (72px) and no-sideways-scroll check covers all ten; the 48px thumb-bar check stays on the four with a thumb bar (`home`, `spine`, `bdash`, `status`). New describes:
   - the three sheets (`bookdetail` E12, `thisorthat` E13, `rebalance` E15): the sheet is 640px wide and centred on the content column (the `.tabmain`), and the scrim covers the column and the rail;
   - the three lists (`top` E14, `calibre` E16, `settings` E17): the column is padded 32px;
   - `settings` at 834: *Reading pace* and *Appearance* side by side, *Parked* and *Data* full width below them;
   - `settings` phone frame (E11): no stepper carries an inline `background`; one stepper is typed (`input.val`), one held (`b[data-held]`, resolving to a 1.5px `--brand` ring), the rest at rest (`button.val`);
   - AC-3: the mockup holds no `&#9906;`, `⚲` or `&#x26b2;` (nor `&#9881;`); every `nav.bar` ends in `a.iconbtn[aria-label="Settings"]` holding an `svg` with the gear path;
   - AC-4: the mediums-review rows for `settings` and the 834px frames say *redrawn (task 6.24, TASK-146)* and name *Start on* → 6.25, *Spotify* → 9.x, *Your platforms* → 10.0.
   The UX-floor (no hex, no `--danger`, D-32 fonts, 24px targets, axe) and screenshot tests run on all ten; the sheet titles join the Newsreader exemption.
2. **Gears**, by a node script in the session temp folder (never a PowerShell rewrite): every phone bar's last slot becomes the app's drawn gear, `<a class="iconbtn" aria-label="Settings">` with `src/components/nav/Icons.tsx`'s `settings` path at 20×20: the 95 `&#9906;` *Search (Ctrl K)* spans, the 22 bars that draw a search SVG there, and the two `&#9881;` bars (`settings`, `calibre`, with `aria-current="page"`). The bar's search returns left of the gear in 6.25 (TASK-148). The 43 other `&#9906;` (search fields, thumb-bar search buttons, `palette`) become the drawn magnifier (the circle and line already in the mockup), their names kept.
3. **`settings` redrawn from E11**: the steppers drop the inline `background:var(--sunk)` (the base `.stepper` has it since TASK-144); *Minutes a day* stays typed, *Words a minute* is drawn held (a new `.stepper b[data-held]` rule: 1.5px `--brand` ring), *Words per page* at rest. Every row the frame has stays. The notes describe typed and held (§9, MR-D18) and name what the review adds later: *Start on* (6.25, TASK-147), *Spotify* (9.x), *Your platforms* (10.0).
4. **Six 834px frames** (`data-w="tab"`), each with the mockup's current books tablet rail (6.25 redraws it), its own item current: `bookdetail` (E12) and `thisorthat` (E13) as sheets over the Library, `rebalance` (E15) as a sheet over Plan, one new tablet sheet rule (640px, centred over the column, the scrim over the rail too, E12–E17's closing note); `top` (E14), `calibre` (E16, *‹ Settings* back link) and `settings` (E17's two columns; every phone row kept) as lists in the 32px column with the 40/44 title. Copy and figures from E12–E17 (sample data, D-7). `moveplan` gets a note: its 834 frame follows the sheet rule.
5. **`design/mockups-index.md`**: the six rows say "360px and 834px frames" (or "834px frame") and carry fresh line ranges (and `moveplan`'s); the mediums-review rows mark `settings` and the 834px frames redrawn (task 6.24, TASK-146), naming what is left.

**Files**: `design/mockups.html` (gears, `settings`, six 834 frames, the tablet sheet and held-stepper rules); `design/mockups-index.md` (rows, line ranges); `test/e2e/mockup-tablet.spec.ts` (`SCREENS`, the new checks). Nothing in `src/`.

**Test strategy**: AC-1 (this part: `settings` redrawn, the six 834 frames) and AC-2 → the new describes in `mockup-tablet.spec.ts`, run in `w1280-light` (`ONCE`); AC-3 → its gear test; AC-4 → its index test. `markup.spec.ts` runs too.

**Risks**: a test elsewhere may pin the bar's *Search (Ctrl K)* markup or `&#9906;`: grep `test/` before the first run. The new frames' sheet titles are Newsreader, so the D-32 exemption must name them exactly.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
