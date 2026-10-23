---
id: TASK-015
title: 1.8b Thumb bar and contrast
status: Done
depends_on: [TASK-014, TASK-027]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: dcece7c
---

# TASK-015 — 1.8b Thumb bar and contrast

## Goal

Marking what you just read is one thumb tap at the bottom of every dashboard and the run page. The button confirms in green, then offers the next issue. Every piece of text on screen meets contrast in both themes.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.8b Thumb bar and contrast (sitting 6, last). It was split out of 1.8 (R3-12). The roadmap entry, its slot rules, *The mark answers back* table and its **Check:** are the contract.
- **Size M, not the roadmap's S:** the thumb bar, the batch sheet, the mark storyboard component, the toast's placement (on TASK-001's toast), the header verbs at 1024px, and an e2e contrast script.
- Architecture: `docs/04-design.md` § 11. Interface. `.claude/rules/ui.md` *The thumb bar is fixed at the bottom of every dashboard and the run detail* (the verb names the issue by its label; `#141` alone only on a single-series run).
- Design: STYLE_GUIDE §9 (the bar; toast), §14.3 (the mark answers back), §14.6 (desktop placement). `design/Ledger Feel Review.dc.html` §3 and `design/LedgerComics.dc.html` (live). Reference screenshots `design/screenshots/phone/03…08` (the mark storyboard). design §14 → Run detail (`Mark #141 read · Mark through… · +`).
- Decisions: D-25b and D-33 (the dashboards move verbs into the header at 1024px; the run detail keeps the bottom bar at every width; a tablet keeps the bar), D-40 (FP-D7 the green hold, FP-D10 radius 12), M-02 (no literal `#fff`; text on fills uses `--on-*`), M-10 (the verb names the issue), UX-N05 and F1–F3, R1-07.
- Builds on TASK-001 (the toast's content and undo stack: this task places it, adds the countdown bar and the one-at-a-time rule, where a new toast commits the old one), TASK-002 (*Mark through…* opens its range sheet), TASK-003 (the next label comes from the resume pointer) and TASK-014 (the shell, `--bar-h`, the error toast).
- The batch sheet's *Log a session* is 2.1b, so here it is `aria-disabled="true"` with its reason.
- *From TASK-008 (1.4c, PR #77):* since 1.4c the toast stays live above an open sheet (D-63): `Sheet` leaves the `data-over-sheet` toast region out of `inert`, and the region sits at z-index 45, over the sheet's 40. When you place the toast, keep it reachable over a sheet. Also, pressing **Undo** unmounts the toast and leaves focus on `<body>` (seen in the 1.4c browser walk with the Add books sheet open). Give focus somewhere sane, such as back to where it was before the toast took it.
- **Redraw the `batch` frame's toast** (follow-up from PR #63, task 1.2). Both frames in `design/mockups.html` (around lines 4934 and 4966) still draw 1.2's old one-line toast, `Marked #141–145 read · Undo`. This task places the toast, so it redraws those frames to 1.2's two-line toast with this task's countdown bar, in the same PR (`ui.redrawFiles`).
- *From the 1.8 split (owner, 2026-10-19):* the error toast with *Retry* (R1-07) is now TASK-027's (1.8d), not TASK-014's; this task places it above the thumb bar. `--bar-h` and the shell stay TASK-014's.
- *From TASK-027 (1.8d, PR #112):* the error toast is built. `useUndo().fail({ label, retry })` in `src/components/Undo.tsx` raises *That didn't save* with a *Retry* button in the same `role="status"` region, lasting `UNDO_MS` like any toast, and it never goes on the undo stack. *Retry* shares the `.toast-undo` rule. Place it above the thumb bar with the other toasts, give it the countdown bar, and keep its text on `--toast-ink` / `--toast-link`.
- *From TASK-014 (1.8, PR #98), open question for the plan:* the app-wide *Add* should land on the run last added to (design §14 *Remember the last run*; TASK-005's note). Comics *Add* ships `enabled: false` in 1.8's `NAV_ITEMS`, because no comics route adds without a run. Does this task remember the last run and turn the item on, or does another item?
- *From TASK-014 (1.8, PR #109):* the dashboards' `.actionbar` is `DashboardBar` (`src/components/nav/DashboardBar.tsx`) with the owner's interim verb (comics *Resume <label>* or *Pick a run*, watch *Save to inbox*), 48px at 768–1023px. Replace its contents, not the element. On `/watch` the interim verb repeats the slate's own *Save to inbox*; drop one when the bar is built.
- *From TASK-014 (1.8, PR #109):* from 1024px the dashboard verbs move into the page header (STYLE_GUIDE §14.6), a sticky glass band holding the `h1` and the verbs, about 80px. 1.8 left it to this task: `.bar` is the phone media bar only (hidden from 768px, D-77), and `--bar-h` is already 80px from 1024px for the band. The band is not `.bar`, and the sticky stack keeps everything but `.bar` at or below `--bar-h`.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): screenshot at 360px; assert the primary action button is within the bottom 96px. At 360px the toast's bounding box does not intersect the primary `.actionbar .btn`; two marks in a row leave exactly one toast on screen and the first mark committed. Under emulated `prefers-reduced-motion` the `.chk`'s computed `transition-duration` is `0s`. `getComputedStyle` reports at least 44px for every `.actionbar .btn` and `.iconbtn`, and a contrast script reports at least 4.5:1 for every rendered text node outside an inactive control (`aria-disabled` or `:disabled`, WCAG 1.4.3) by its computed colour against its computed background (not a list of token pairs: a literal `#fff` on `--brand` is 2.51:1 in dark mode, M-02) and 3:1 for the unchecked control ring, in both themes; `npm run test:tokens` passes. At 1280px no dashboard renders `.actionbar` and the header holds the primary verb; at 834px every dashboard renders it, with the primary action inside the bottom 96px; the run detail renders it at all three widths. At 1280px a dashboard's toast is centred on the content box with its bottom edge 24px above the viewport's, and at 1100px a primary verb whose label is truncated keeps the full label as its accessible name. On a fixture run spanning two series the thumb bar's verb contains the series name. **The mark storyboard:** with a fake clock, a mark shows press at 0, the `--ready` button reading *✓ {label} read* at 120ms and still at 700ms, and the next label in `--brand` after 1.3s; under emulated `prefers-reduced-motion` the same four states appear at the same times with every `animation-duration` and `transition-duration` at `0s`; a mark whose write fails never shows the confirm state for longer than the revert. Each `.actionbar .btn`'s computed `border-radius` is 12px.
- [x] AC-2: The slots are fixed. Slot 1 is the medium's mark verb, primary (`Mark #141 read` comics, `Log progress` books, `Mark S2 watched` watch). Slot 2 is `+ batch` on comics dashboards, `✓ finished` on books, `+ Add` on watch, and `Mark through…` on the run detail. Slot 3 is search (`aria-label="Search (Ctrl K)"`) on dashboards and status, and `+` *Add issues* on the run detail. At 1024px and up, the dashboard header holds the same verbs in DOM and visual order *Search · + batch · Mark … read*, and an empty state shows *Search · Start {next}* only.
- [x] AC-3: The thumb bar's mark calls the existing optimistic write (`POST /api/progress/issue`) and adds no second write path (a test counts one request per mark). It pushes the same undo entry as a spine tick. *Mark through…* on the run detail opens TASK-002's range sheet. `+ batch` opens the batch sheet with *Mark next N* (a stepper, which marks the next N unread placements in one range request), *Mark through…*, and *Log a session* (`aria-disabled="true"` with a visible reason; the copy is the plan's to propose).
- [x] AC-4: The toast is pinned at `bottom: calc(var(--actionbar-h) + 8px + env(safe-area-inset-bottom))`, has a 2px `--brand` countdown bar over 8s that pauses on hover or focus, and enters with a 12px rise over `--dur-4` (none under reduced motion). The bar's `padding-bottom` is `max(12px, env(safe-area-inset-bottom))`.
- [x] AC-5: The thumb bar and the mark sequence meet the UX floor and the feel-pass check (`docs/04-design.md` § 10. The UX floor and § *A feel-pass surface is checked more widely*): every state of the storyboard screenshotted at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion`; an axe pass over each dashboard and the run page reports no new violations; nothing on a dashboard resolves to `--danger`.

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

## Follow-ups

- Comics *Add* landing on the run last added to (TASK-014's open question): this task doesn't do it, and no roadmap item owned it → docs/05-roadmap.md § 1.19 (new) (approved at plan), placed in docs/06-tasklist.md § M9
- The books slots (`Log progress` · `✓ finished`; header *Search · Finished it · Log pages*) are built in `ThumbBar`'s books config but rendered nowhere until the books dashboard exists → docs/05-roadmap.md § 2.2 (approved at plan)
- Watch's `Mark S2 watched` · `+ Add` replaces the empty-state *Search · Save to inbox* verbs → docs/05-roadmap.md § 8.7 (approved at plan)
- The batch sheet's *Log a session* ships `aria-disabled` with a reason → docs/05-roadmap.md § 2.1b (approved at plan)
- The Search slot (`Search (Ctrl K)`) is drawn but `aria-disabled` until the search page exists; enabling the `search` nav item turns it into a link → docs/05-roadmap.md § 6.1
- `/comics` went from 4 queries to 5 (`nextUnread`, the hero run's unread placements, in the same wave) → docs/02-architecture.md § Performance budget (fixed in this PR)
- The tablet bar is 48px controls with 12px around them (73px with the glass edge), not the 48px total task 1.8 drew; the owner amended 1.8's Check, and the 834px frames in `design/mockups.html` are redrawn → docs/05-roadmap.md § 1.8 (Check amended, owner-approved, D-78; fixed in this PR)
- From 1024px the dashboard's `.pagehead` band is sticky at `top:0` and 1.8's sticky-stack Check now names it; the contrast Check now leaves inactive controls out (WCAG 1.4.3) → docs/review/decisions.md § D-78 (owner-approved)
- The mark toast in `design/screenshots/phone/04-mark-2-answer-dark.png` has a green ✓ circle that STYLE_GUIDE §9 and the `batch` frame do not draw, so the toast has none → not tracked: the guide and the mockup agree with what is built, and the reference screenshot is the outlier
- `RunRow`'s `read_issues` / `total_issues` are typed `number` but Postgres returns `COUNT()` as a string; the dashboard coerces them where the toast adds one → not tracked: coerced where this task uses them, the other uses only print them
- Notes in the 834px mockup frames and `docs/04-design.md` § 11 still say "a 48px thumb bar"; D-78 and the amended Checks say 48px controls with 12px around them → not tracked: wording only, and a planning-doc edit needs the owner's approval
- A stale `.next` makes the e2e login setup loop forever on this machine (`rm -rf .next` before `npm run test:e2e`) → not tracked: environment quirk, noted in the PR

## Plan

**Steps**
1. `src/lib/mark.ts` (new): move `post()` and the tick's undo-entry construction out of `RunSpine.toggle` into `markPlacement({ placementId, completed, label, detail, onSaved, onUndone }, { push, fail })`. `RunSpine` calls it, and so does the dashboard bar. That keeps one write path (`POST /api/progress/issue`) and one entry shape.
2. `src/db/queries.ts`: `nextUnread(userId, runId, limit = 50)` returns `{ placement_id, label, type, notes }[]` (unread placements in sequence order) and `single_series`, using run_span's label regex. The hero run is `inProgressRuns()[0]`. No schema change.
3. `src/components/MarkButton.tsx` (new, client): the four states `idle → press (0) → confirm (120ms) → hold (to 120 + --dur-hold) → next (1.3s)` go in `data-state`. Confirm reads `✓ {label} read` on `--ready`/`--on-ready`. A failed `onMark()` returns to idle at once, so confirm never outlasts the revert. Taps before *next* are ignored, and the label is captured at the press.
4. `src/components/ThumbBar.tsx` (new, client): `VerbsProvider` holds a medium config (`comics | books | watch | run | empty`). `HeaderVerbs` (DOM order *Search · second · primary*) and `ThumbBar` (`.actionbar`, *primary · second · search/+*) read the same state. The primary truncates, keeps its full label as `aria-label` and gets a `title`. The verb is `Mark {issueName(label, single)} read`. The empty state is `Start {first readyToRead run}`, or `Pick a run`.
5. `src/components/BatchSheet.tsx` (new): on the shared `Sheet`, *Mark the next N* (a `.stepper`, 1…upcoming.length, with the range shown beneath) sends one `POST /api/progress/range` and pushes one undo. *Mark through… · Choose* opens a picker of the unread rows, then `RangeSheet`. *Log a session · Log* is `aria-disabled="true"`, `aria-describedby` → "Sessions aren't here yet." The picker is exported as `ThroughPicker` for the run detail.
6. `src/components/nav/DashboardBar.tsx` is deleted. `comics/(dash)/page.tsx` wraps its `main` in `VerbsProvider`, the `h1` row becomes `<header class="pagehead">` with `HeaderVerbs`, and `ThumbBar` replaces `DashboardBar`. After *next*, a mark runs `router.refresh()` so the Mid-run counts move. `watch/page.tsx` shows the empty state *Search · Save to inbox*, and the slate loses its duplicate button. `/books` is still a redirect (2.2), so the books config is built and unit-tested but rendered nowhere.
7. `IssueRow.tsx` (`RunSpine`): renders `ThumbBar` (run config). Its mark is `toggle(next)`, *Mark through…* opens `ThroughPicker` → `throughHere(at)`, and `+` links to `/comics/{id}/add` with `aria-label="Add issues"`. `run-actions .resume` stays.
8. `Undo.tsx`: **one at a time**. `push` keeps only the new entry, so the old one is committed. `notify` and `fail` also drop the stack. Hover or focus on `.toast` pauses: the remaining time is frozen and both `until` and `expires` move. A `.toast-count` 2px `--brand` bar animates `toast-count` over `UNDO_MS`, paused through `animation-play-state`. Focus after Undo or Retry goes back to the toast's `relatedTarget` on focus-in when that is still connected, otherwise to `.actionbar .btn`.
9. `globals.css`: `.actionbar` goes `position:fixed` (inset from the rail and sidebar), with `padding-bottom:max(12px, env(safe-area-inset-bottom))`, `--actionbar-h` (0 with no bar, set by `body:has(.actionbar)`), `main` padding to clear it, buttons radius `--r-lg`, `+ batch` with a `--rule-2` ring, and a 44×44 search. The run detail at 1024px and up gets glass with 720px/48px buttons. `.pagehead` is a sticky glass band at `top:0` from 1024px, while `.headverbs` and `.actionbar.dash` swap by media query (D-77: both in DOM, CSS chooses). `.iconbtn` goes 34→44px. The toast sits at `calc(var(--actionbar-h) + 8px + env(…))`; at 1024px and up with `.actionbar.dash` it is centred in the content box, 24px up. Keyframes `toast-enter` (12px, `--dur-4`), `toast-count`, `count-tick`, `cell-fill` and `cover-slide` all use `--dur-*`/`--ease-out`. Reduced motion zeroes every duration, and the existing `*` rules cover it. Any text node the contrast script fails gets its token swapped (no new hex).
10. `design/mockups.html`: the two `batch` toasts (~5585, 5617) are redrawn to the two-line toast with its countdown bar, and the `batch` row in `mockups-index.md` is updated. Tick 1.8b in `docs/05-roadmap.md`.

**Files:** `src/lib/mark.ts`, `src/components/{MarkButton,ThumbBar,BatchSheet}.tsx` (new); `src/components/{IssueRow,Undo}.tsx`, `src/components/nav/DashboardBar.tsx` (deleted), `src/app/comics/(dash)/page.tsx`, `src/app/watch/page.tsx`, `src/db/queries.ts`, `src/app/globals.css`; `test/e2e/{thumb-bar.spec.ts (new),helpers.ts,shell.spec.ts}`; `test/{mark-button,thumb-bar,batch-sheet}.test.tsx` (new), `test/undo.test.tsx`, `test/queries.test.ts`; `design/mockups.html`, `design/mockups-index.md`, `docs/05-roadmap.md`.

**Test strategy**
- AC-1 → `test/e2e/thumb-bar.spec.ts`. Every project runs, with each check at the widths the Check names. `contrastFailures(page)` in `helpers.ts` walks the text nodes, composites the ancestor backgrounds and requires 4.5:1, plus 3:1 for `.chk i`'s ring. It covers `/comics`, `/watch` and the run page, with the toast and batch sheet open, in both themes. `page.clock` runs the storyboard, and the `w390-reduced-motion` project checks the durations are `0s`. The fixture state (a wide-label hero for 1100px) is set and restored in the spec through `testSql`. The two-series verb uses `E2E_LONG_RUN_ID`. `test/mark-button.test.tsx` (fake timers) checks the states at 0/120/700/1300 and the failed write.
- AC-2 → `test/thumb-bar.test.tsx` checks each config's slot names, order and `aria-label`, and the empty state. The e2e spec checks the header DOM order at 1280.
- AC-3 → `test/thumb-bar.test.tsx` checks one `/api/progress/issue` call per mark, and that the entry equals a spine tick's. `test/batch-sheet.test.tsx` checks that Mark next 3 sends one range POST with 3 ids, that Log is `aria-disabled` with its reason, and that Choose → RangeSheet.
- AC-4 → `test/undo.test.tsx`: a second push commits the first, hover pauses expiry, the countdown is present, and focus returns after Undo. The e2e spec checks the computed `bottom`, `padding-bottom` and enter animation.
- AC-5 → the e2e spec screenshots every storyboard state in all 14 projects, runs `expectNoAxeViolations` on the 3 pages, and checks that no dashboard element's computed colour equals the resolved `--danger`. `test/queries.test.ts` checks that `nextUnread` follows order, skips read placements, and that `single_series` agrees with `singleSeries()`.

**Risks / open questions**
1. One-at-a-time changes how task 1.2's stack behaves. `undo.test.tsx` *Ctrl+Z and ⌘Z undo the newest entry* gets rewritten: after undoing the second entry, the first does **not** come back. The contract (UX-N05, F3) asks for it, but please confirm.
2. *Renders no `.actionbar`* at 1280 is read as `display:none` (D-77's pattern), not absent from the DOM.
3. Fixing contrast and `.iconbtn` at 44px may change the media bar at 360px (`expectNoHorizontalScroll`) and existing screenshots.
4. The copy *Sessions aren't here yet.* and the watch empty state are proposals.

**Size check:** fails at about 14 files and 5 ACs (L). `splitPolicy: never-split`, so it is planned whole and stays `autonomy: attended`. It is large because the Check binds the bar, the toast, the header band, the storyboard and an app-wide contrast audit into one contract.

## Review log

Verify R1 FAIL(2) → R2 FAIL(1, bar height 73 not 72) → R3 PASS | Audit R1 CHANGES(5) → R2 PASS | Schema R1 APPROVE (1 minor fixed) | Spec R1 CHANGES (3 SPEC GAPs, owner ruled, D-78) | UI R1 CHANGES (sheet targets, fixed)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0 (the e2e run caught the hover colour and the string count before the first full verify)
- Plan revisions after approval: 4 (the `/comics` query budget in `test/query-budget.test.ts` and `docs/02-architecture.md`; the range write shared in `src/lib/mark.ts`; the batch sheet's steps swap inside one `Sheet`, so no exported `ThroughPicker`; the tablet bar is 73px, not 48)
