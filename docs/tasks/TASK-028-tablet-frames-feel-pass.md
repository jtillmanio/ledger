---
id: TASK-028
title: 1.8e Tablet frames to the feel pass
status: Ready
depends_on: [TASK-014]
size: S
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-028 — 1.8e Tablet frames to the feel pass

## Goal

The mockup's 834px tablet frames show what the feel pass actually draws at tablet width: a horizontal hero, a five-cover shelf, a horizontal telescope with a three-column ladder and the side rail stacked below in two columns. They no longer show the phone's body stretched into one column. Later tablet work can then be built from the mockup.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.8e Tablet frames to the feel pass. Added at 1.8's close-out (owner, 2026-10-20). Sitting 6, M6 in `docs/06-tasklist.md`: 1.8 → **1.8e** → 1.8d → 1.8b.
- *From TASK-014 (1.8, PR #109):* AC-6's tablet frames carry the shell's geometry (the 72px rail, 32px padding, the 40/44 title, the 48px thumb bar) and reflow the phone body. Redrawing the four bodies to the feel pass is this task. 1.8 also capped the telescope at `max-width:344px` in the 834 frame (`.frame[data-w="tab"] svg.tele`, the rule commented *A phone-sized drawing stays phone-sized*). The redraw removes the cap.
- Design: `design/mockups.html` frames `data-w="tab"` in `home`, `spine`, `bdash` and `status` (print one with `scripts/screen.ps1 <id>`), and the tablet CSS block next to `.frame[data-w="tab"]`. The sidebar's *834* toggle sets `body[data-vp="tab"]`, and *Light · Dark* sets the theme.
- Feel pass (D-40, beats the mockup on layout and copy at the 768px tablet): `design/STYLE_GUIDE.md` § 14.5 Tablet, 768–1023px (rail, column, hero, shelf, telescope, side rail, thumb bar). `design/Ledger Feel Review.dc.html` § 10c Tablet. Reference PNGs `design/screenshots/tablet/01-comics-768-dark.png` and `02-comics-768-light.png` are the picture for `home`. `spine`, `bdash` and `status` have no tablet PNG and follow 14.5's text. For `bdash`, § 14.6 names the books side-rail blocks (*On deck*, then *2026 so far*).
- The feel pass draws at 768 and these frames are 834, so the column is wider than the PNG's. 14.5's sizes (the 150 × 225 cover, the 16px shelf gap, the 1.5 : 1 split) are fixed sizes and apply as written. The telescope's width follows 14.5's formula (W = column − 2 × 20 − 44).
- `design/mockups-index.md` § Viewport frames (roadmap 1.8) says the body is *the phone's, reflowed* and not redrawn. The § Oct 2026, feel pass table lists `home` as superseded by § 10c among others.
- Covers use the mockup's neutral placeholder until 4.3 (`mockups-index.md` § Oct 2026, feel pass). Figures in the frames are sample data (D-7).
- Decisions: D-33 (tablet 768–1023px: rail, bottom thumb bar), D-40 (the feel pass), D-31 (the styling blueprint), D-25 (the run detail keeps the bottom bar at every width), D-7.
- UX floor: `docs/04-design.md` § 10. The UX floor.
- Settled at task review (owner, 2026-10-21):
  - The plan works out what `spine` and `status` change beyond the shell from § 14.5 and the feel pass, on Opus.
  - A Playwright spec that loads the mockup with `setContent` is the failing-first test.
  - The ui-verifier walks `design/mockups.html`, not the app, and the *Preview walked at 360–412px* ready gate doesn't apply, because no app code changes.
  - `home` matches the 768 PNGs in arrangement, not pixel for pixel, at 834.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): At `data-vp="tab"`, each of the four 834px frames' `.frame-in` has `scrollWidth` equal to `clientWidth`. `home`'s frame draws the hero with its cover 150px wide and 225px tall beside the number, run and lens (not stacked above them); the Up next shelf shows five covers with a 16px gap; *Since Tuesday* and *Also reading* share one row; the telescope is horizontal, with its ladder in three columns. In `home` and `bdash` the side-rail blocks sit below the main column as two columns in a 1.5 : 1 ratio. Each frame's thumb bar is 48px tall and its rail 72px wide. `design/mockups-index.md` still lists the four frames, and its *Viewport frames* note no longer says the body is not redrawn.
- [ ] AC-2: With `body[data-vp="tab"]`, in `home`'s 834 frame the hero cover's right edge is left of the number's left edge, and their vertical extents overlap. The five shelf covers sit on one row (equal `top`), each pair 16px apart (±1px). *Since Tuesday* and *Also reading* have equal `top`. The ladder's three columns have three distinct `left` values on one row. The two side-rail blocks have equal `top`, and their widths are 1.5 : 1 (±2%).
- [ ] AC-3: The `.frame[data-w="tab"] svg.tele` `max-width:344px` rule is gone. In `home`'s 834 frame the telescope is wider than 344px and no wider than its card.
- [ ] AC-4: `design/mockups-index.md`'s *Viewport frames* note says the 834 bodies follow the feel pass (§ 14.5, § 10c). The § Oct 2026, feel pass table no longer lists § 10c tablet as superseding `home`. The four screens' rows still name their 834px frames.
- [ ] AC-5: The four redrawn frames meet the UX floor (`docs/04-design.md` § 10. The UX floor) where it applies to a mockup frame. Colours are the mockup's custom properties, with no literal hex in the new markup or rules. Nothing in them resolves to `--danger`. Counts are Plex Mono, and Newsreader is used only for the title and hero names. Screenshots of the four 834 frames exist in light and in dark.

## Out of scope

- Any app code: `src/`, `globals.css`, the real tablet layout. The dashboards are built by their own tasks (2.4 comics, 2.2 books), and 1.8 already built the tablet shell.
- The phone (`phone`, `p360`) and desktop (`desk`) frames of these four screens. The desktop `home` and `bdash` redraws are 2.4 and 2.2 (`mockups-index.md` § Oct 2026, feel pass).
- The spine's art band and the telescope above the spine (4.3, 2.5b). This task does not redraw the run detail beyond what 14.5 says for the tablet.
- The italic *L* at the top of the rail that the tablet PNG draws. TASK-014 left it to the owner at the preview walk.
- The 768px drawing itself. The frames stay 834px wide.
- Any protected design file (`design/*.dc.html`, `design/STYLE_GUIDE.md`, `design/tokens.css`, `design/screenshots/**`). They are read, never edited.

## Files likely touched

- `design/mockups.html`: the bodies of the four `data-w="tab"` frames, the tablet CSS block (the `svg.tele` cap goes; hero, shelf, ladder and side-rail rules scoped to `.frame[data-w="tab"]`). Listed in `ui.redrawFiles`.
- `design/mockups-index.md`: § Viewport frames and the § Oct 2026, feel pass table. Listed in `ui.redrawFiles`.
- `test/e2e/mockup-tablet.spec.ts` (new): loads `design/mockups.html` with `setContent`, as `harness.spec.ts` loads its fixtures. It runs in one project, sets `body[data-vp="tab"]` and measures AC-1 to AC-3.
- `docs/05-roadmap.md`: tick 1.8e.

## Verification

- Automated: `test/e2e/mockup-tablet.spec.ts`, with one test per AC-1 clause and the AC-2 and AC-3 geometry. It fails on `main`, where there is no hero, shelf or side rail in the 834 frames and the telescope is capped at 344px. A grep test in the same file covers AC-5: no hex literal in the four tab frames' markup, and no `--danger` in them. `npm run test:tokens` still passes (the mockup's `<style>` 11px floor).
- Manual: open `design/mockups.html` and pick *834*, then walk `home` → expected: it matches `design/screenshots/tablet/02-comics-768-light.png` in arrangement (hero, shelf, *Since Tuesday* · *Also reading* row, telescope, side rail below), allowing for the wider column. Switch to *Dark* → expected: it matches `01-comics-768-dark.png` in the same way. Walk `spine`, `bdash` and `status` at 834 → expected: no sideways scroll, 72px rail, 48px thumb bar, and `bdash`'s *On deck* | *2026 so far* below the main column.

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
