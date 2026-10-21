---
id: TASK-028
title: 1.8e Tablet frames to the feel pass
status: Review
depends_on: [TASK-014]
size: S
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 1b67b2b
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

- [x] AC-1 (roadmap **Check:**, verbatim): At `data-vp="tab"`, each of the four 834px frames' `.frame-in` has `scrollWidth` equal to `clientWidth`. `home`'s frame draws the hero with its cover 150px wide and 225px tall beside the number, run and lens (not stacked above them); the Up next shelf shows five covers with a 16px gap; *Since Tuesday* and *Also reading* share one row; the telescope is horizontal, with its ladder in three columns. In `home` and `bdash` the side-rail blocks sit below the main column as two columns in a 1.5 : 1 ratio. Each frame's thumb bar is 48px tall and its rail 72px wide. `design/mockups-index.md` still lists the four frames, and its *Viewport frames* note no longer says the body is not redrawn.
- [x] AC-2: With `body[data-vp="tab"]`, in `home`'s 834 frame the hero cover's right edge is left of the number's left edge, and their vertical extents overlap. The five shelf covers sit on one row (equal `top`), each pair 16px apart (±1px). *Since Tuesday* and *Also reading* have equal `top`. The ladder's three columns have three distinct `left` values on one row. The two side-rail blocks have equal `top`, and their widths are 1.5 : 1 (±2%).
- [x] AC-3: The `.frame[data-w="tab"] svg.tele` `max-width:344px` rule is gone. In `home`'s 834 frame the telescope is wider than 344px and no wider than its card.
- [x] AC-4: `design/mockups-index.md`'s *Viewport frames* note says the 834 bodies follow the feel pass (§ 14.5, § 10c). The § Oct 2026, feel pass table no longer lists § 10c tablet as superseding `home`. The four screens' rows still name their 834px frames.
- [x] AC-5: The four redrawn frames meet the UX floor (`docs/04-design.md` § 10. The UX floor) where it applies to a mockup frame. Colours are the mockup's custom properties, with no literal hex in the new markup or rules. Nothing in them resolves to `--danger`. Counts are Plex Mono, and Newsreader is used only for the title and hero names. Screenshots of the four 834 frames exist in light and in dark.

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

- 2.4 builds the tablet layout from the 834 `home` frame this task draws from Feel Review §10c (approved at plan) → docs/05-roadmap.md § 2.4
- 2.2 builds the tablet layout from the 834 `bdash` frame this task draws from the books feel pass (approved at plan) → docs/05-roadmap.md § 2.2
- The mockup's status tab counts fail 4.5:1: `.seg span .n` is at `opacity:.8`, and the selected tab's count is `--faint` on `--brand`. The status screens must not copy either (approved at revision 1) → docs/tasks/TASK-017-status-screens.md § Context
- `spine`'s `.seen-more` (*+1*) is 15 × 17 in the mockup's phone and desktop frames → not tracked: the app already draws it at 24px (`globals.css` `.seen .seen-more`); only the 834 frame is in scope
- ui-verifier: the covers are flat grey and near-black placeholders, with no stripes or `--art` tint → not tracked: the neutral placeholder is required until 4.3 (`mockups-index.md` § Oct 2026, feel pass)
- ui-verifier: at 834 the five-cover shelf ends about 70px short of the column → not tracked: § 14.5's 112px covers and 16px gap are fixed sizes and apply as written (task Context)
- ui-verifier: the thumb bar has a search icon that the 768 PNG doesn't → not tracked: 1.8's shell, and § 14.1 lists search in the thumb bar
- ui-verifier: `spine`'s empty `button.chk` computes to Arial → not tracked: the button has no text and the body is out of scope

## Plan

Approved by the owner, 2026-10-21, with the `spine` and `status` conclusion (step 5): the run detail's own feel-pass redraw is roadmap 4.3 (the `--art` key-art band) and 2.5b (the telescope above the spine), per Feel Review § 6.

Geometry at 834: column 696 (832 − 72 rail − 2 × 32); telescope W = 696 − 40 − 44 = 612; shelf 5 × 112 + 4 × 16 = 624; side rail 676 split 405.6 : 270.4.

1. **Test first.** `test/e2e/mockup-tablet.spec.ts`, run in `w1280-light` only, viewport 1400, `setContent` of `design/mockups.html`, `body[data-vp="tab"]`. One test per AC-1 clause, the AC-2 and AC-3 geometry, AC-4 as a read of `mockups-index.md`, and AC-5: no hex literal (`(?<![&%\w])#[0-9a-f]{3,8}`) and no `--danger` in the four tab frames' markup or the tablet CSS block; nothing computed resolves to `--danger`; Newsreader only on `h1.t` and the hero name or story; counts in Plex Mono; screenshots of the four frames light and dark. Confirm it fails on `main`.
2. **Tablet CSS.** Drop the `svg.tele` 344px cap and its comment. Add `.frame[data-w="tab"]` rules, tokens only: hero (150 × 225 cover, 20 padding, 24 gap, 56/60 mono number, two-cell footer), shelf (5 × 112, 16 gap), horizontal telescope (44 + 612 grid), three-column ladder, side rail 1.5fr : 1fr. Covers use a neutral placeholder (`--sunk`, `--rule` ring, mono label), not a hex data URI.
3. **`home` body** from § 10c and its copy: header with *6 in inbox* and the *14 issues since Tuesday…* lede; Now hero with the lens; *Since Tuesday* | *Also reading*; *Up next 12* with Reorder and five cards with readiness badges; *Where you are* (TRACK, BLOCK, RUN rails, cells from `alloc()` at W = 612, three-column ladder); *Ready when you are* | *2026 so far*. The thumb bar stays as 1.8 drew it.
4. **`bdash` body** from the books feel pass (§ 4, desktop § 11c, named by § 14.6): horizontal hero (*Reading now*, *The Fifth Season*, p. 212 of 468, 6px `--ready` meter, sittings footer); *Up next in Q4* (three covers); *This quarter* (Q4 strip, FP-D8); *On deck* | *2026 so far* below as 1.5 : 1. The capacity card and *Place them* go, as 11c leaves them out. Thumb bar copy: *Log pages · Finished it* + search.
5. **`spine` and `status`**: body unchanged, plus two tab-scoped UX-floor rules (revision 1, approved 2026-10-21): `.seen-more` min 24 × 24 (as `globals.css` draws it) and `.seg span .n` at full opacity (axe: 4.5:1 in light), plus, from UI review round 1, the selected tab's count in `--on-brand`. § 14.5 names nothing for them beyond the rail, column and thumb bar, which 1.8 draws. The spec still checks their scroll, rail and bar.
6. **`design/mockups-index.md`**: *Viewport frames* says the 834 bodies follow § 14.5 / § 10c (and the `spine`/`status` conclusion); the feel-pass table's `home` row drops § 10c; the four screens' rows keep their 834px frames.
7. Tick 1.8e in `docs/05-roadmap.md`. Verify, test audit, spec-reviewer, ui-verifier on the mockup.

**Files:** `design/mockups.html`, `design/mockups-index.md`, `test/e2e/mockup-tablet.spec.ts` (new), `docs/05-roadmap.md`, this task file. All in *Files likely touched*.

**Risks:** `spine`'s tab frame keeps its percent-encoded data-URI cover images (`%23394049`); the hex check skips `%23…` as image data, not styling. The telescope is hand-drawn, not from `layout.ts` (2.5).

## Review log

Verify R1 PASS | Audit R1 PASS | Spec R1 APPROVE (note: `.wrap.tb` padding-top overridden, fixed) | UI R1 CHANGES (status: selected tab count `--faint` on `--brand`, ~1:1) → fix + spec assertion → Verify R2 PASS | UI R2 PASS

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 1 (AC-5, ui-verifier: status tab count contrast)
- Plan revisions after approval: 1 (tab-scoped UX-floor rules for the kept spine and status bodies)
