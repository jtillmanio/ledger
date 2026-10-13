---
id: TASK-015
title: 1.8b Thumb bar and contrast
status: Ready
depends_on: [TASK-014]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-015 — 1.8b Thumb bar and contrast

## Goal

Marking what you just read is one thumb tap at the bottom of every dashboard and the run page. The button confirms in green, then offers the next issue. Every piece of text on screen meets contrast in both themes.

## Context

- Roadmap: `docs/TASKS.md` § 1.8b Thumb bar and contrast (sitting 6, last). It was split out of 1.8 (R3-12). The roadmap entry, its slot rules, *The mark answers back* table and its **Check:** are the contract.
- **Size M, not the roadmap's S:** the thumb bar, the batch sheet, the mark storyboard component, the toast's placement (on TASK-001's toast), the header verbs at 1024px, and an e2e contrast script.
- Architecture: `docs/ARCHITECTURE.md` § 4. Interface. `.claude/rules/ui.md` *The thumb bar is fixed at the bottom of every dashboard and the run detail* (the verb names the issue by its label; `#141` alone only on a single-series run).
- Design: STYLE_GUIDE §9 (the bar; toast), §14.3 (the mark answers back), §14.6 (desktop placement). `design/Ledger Feel Review.dc.html` §3 and `design/LedgerComics.dc.html` (live). Reference screenshots `design/screenshots/phone/03…08` (the mark storyboard). FEATURES 2c → Run detail (`Mark #141 read · Mark through… · +`).
- Decisions: D-25b and D-33 (the dashboards move verbs into the header at 1024px; the run detail keeps the bottom bar at every width; a tablet keeps the bar), D-40 (FP-D7 the green hold, FP-D10 radius 12), M-02 (no literal `#fff`; text on fills uses `--on-*`), M-10 (the verb names the issue), UX-N05 and F1–F3, R1-07.
- Builds on TASK-001 (the toast's content and undo stack: this task places it, adds the countdown bar and the one-at-a-time rule, where a new toast commits the old one), TASK-002 (*Mark through…* opens its range sheet), TASK-003 (the next label comes from the resume pointer) and TASK-014 (the shell, `--bar-h`, the error toast).
- The batch sheet's *Log a session* is 2.1b, so here it is `aria-disabled="true"` with its reason.
- *From TASK-008 (1.4c, PR #77):* since 1.4c the toast stays live above an open sheet (D-63): `Sheet` leaves the `data-over-sheet` toast region out of `inert`, and the region sits at z-index 45, over the sheet's 40. When you place the toast, keep it reachable over a sheet. Also, pressing **Undo** unmounts the toast and leaves focus on `<body>` (seen in the 1.4c browser walk with the Add books sheet open). Give focus somewhere sane, such as back to where it was before the toast took it.
- **Redraw the `batch` frame's toast** (follow-up from PR #63, task 1.2). Both frames in `design/mockups.html` (around lines 4934 and 4966) still draw 1.2's old one-line toast, `Marked #141–145 read · Undo`. This task places the toast, so it redraws those frames to 1.2's two-line toast with this task's countdown bar, in the same PR (`ui.redrawFiles`).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): screenshot at 360px; assert the primary action button is within the bottom 96px. At 360px the toast's bounding box does not intersect the primary `.actionbar .btn`; two marks in a row leave exactly one toast on screen and the first mark committed. Under emulated `prefers-reduced-motion` the `.chk`'s computed `transition-duration` is `0s`. `getComputedStyle` reports at least 44px for every `.actionbar .btn` and `.iconbtn`, and a contrast script reports at least 4.5:1 for every rendered text node's computed colour against its computed background (not a list of token pairs: a literal `#fff` on `--brand` is 2.51:1 in dark mode, M-02) and 3:1 for the unchecked control ring, in both themes; `npm run test:tokens` passes. At 1280px no dashboard renders `.actionbar` and the header holds the primary verb; at 834px every dashboard renders it, with the primary action inside the bottom 96px; the run detail renders it at all three widths. At 1280px a dashboard's toast is centred on the content box with its bottom edge 24px above the viewport's, and at 1100px a primary verb whose label is truncated keeps the full label as its accessible name. On a fixture run spanning two series the thumb bar's verb contains the series name. **The mark storyboard:** with a fake clock, a mark shows press at 0, the `--ready` button reading *✓ {label} read* at 120ms and still at 700ms, and the next label in `--brand` after 1.3s; under emulated `prefers-reduced-motion` the same four states appear at the same times with every `animation-duration` and `transition-duration` at `0s`; a mark whose write fails never shows the confirm state for longer than the revert. Each `.actionbar .btn`'s computed `border-radius` is 12px.
- [ ] AC-2: The slots are fixed. Slot 1 is the medium's mark verb, primary (`Mark #141 read` comics, `Log progress` books, `Mark S2 watched` watch). Slot 2 is `+ batch` on comics dashboards, `✓ finished` on books, `+ Add` on watch, and `Mark through…` on the run detail. Slot 3 is search (`aria-label="Search (Ctrl K)"`) on dashboards and status, and `+` *Add issues* on the run detail. At 1024px and up, the dashboard header holds the same verbs in DOM and visual order *Search · + batch · Mark … read*, and an empty state shows *Search · Start {next}* only.
- [ ] AC-3: The thumb bar's mark calls the existing optimistic write (`POST /api/progress/issue`) and adds no second write path (a test counts one request per mark). It pushes the same undo entry as a spine tick. *Mark through…* on the run detail opens TASK-002's range sheet. `+ batch` opens the batch sheet with *Mark next N* (a stepper, which marks the next N unread placements in one range request), *Mark through…*, and *Log a session* (`aria-disabled="true"` with a visible reason; the copy is the plan's to propose).
- [ ] AC-4: The toast is pinned at `bottom: calc(var(--actionbar-h) + 8px + env(safe-area-inset-bottom))`, has a 2px `--brand` countdown bar over 8s that pauses on hover or focus, and enters with a 12px rise over `--dur-4` (none under reduced motion). The bar's `padding-bottom` is `max(12px, env(safe-area-inset-bottom))`.
- [ ] AC-5: The thumb bar and the mark sequence meet the UX floor and the feel-pass check (`docs/TASKS.md` § *The UX floor, for every UI task* and § *A feel-pass surface is checked more widely*): every state of the storyboard screenshotted at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion`; an axe pass over each dashboard and the run page reports no new violations; nothing on a dashboard resolves to `--danger`.

## Out of scope

- The dashboard's lens cell, *Since Tuesday* stack and hero cover stamp (2.4), which are driven by this component later.
- Reading sessions (2.1b) behind *Log a session*.
- The books *Log progress* and watch *Mark S2 watched* behaviours (2.2, 8.7). Their slots render on screens that exist, wired as far as those screens allow.
- The offline queue (6.4).

## Files likely touched

- `src/components/ThumbBar.tsx` (new), `src/components/MarkButton.tsx` (new, the four-state storyboard), `src/components/BatchSheet.tsx` (new).
- `src/components/Undo.tsx`: toast placement, countdown, one-at-a-time commit.
- `src/app/comics/[runId]/page.tsx`, `src/app/comics/page.tsx`, `src/app/books/page.tsx`: place the bar and the header verbs.
- `src/app/globals.css`: `.actionbar`, the keyframes (cell fill, count tick, cover slide, toast enter, countdown), reduced motion.
- `design/mockups.html`, `design/mockups-index.md`: thumb-bar frames if they differ from the drawn ones (`ui.redrawFiles`).
- `test/e2e/thumb-bar.spec.ts` (new, with the contrast script), `test/mark-button.test.tsx` (new, fake clock).

## Verification

- Automated: `test/e2e/thumb-bar.spec.ts` on TASK-013's harness covers the positions, sizes, toast overlap, widths, the truncated label's name, the contrast script over every text node in both themes, and axe (AC-1, AC-2, AC-4, AC-5). `test/mark-button.test.tsx` covers the storyboard with a fake clock, reduced motion, the failed-write revert and one request per mark (AC-1, AC-3). `npm run test:tokens`.
- Manual: on the Vercel preview at 360px, open a run and tap *Mark … read* twice → expected: green confirm, the next label, and one toast. At 1280px → expected: the verbs in the dashboard header and the bar on the run page.

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
