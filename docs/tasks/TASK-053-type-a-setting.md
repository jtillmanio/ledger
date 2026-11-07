---
id: TASK-053
title: 2.0b Type a setting, and hold to step
status: Review
depends_on: [TASK-045]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b18da5b
---

# TASK-053 — 2.0b Type a setting, and hold to step

## Goal

A reading-pace number can be typed, with a phone's numpad, and holding − or + runs it up or down faster the longer you hold.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.0b Type a setting, and hold to step (M10, after 2.2i; owner intake 2026-11-05, D-123). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-06, when these task files were written. Features: F-21. "In the browser (0.11)" is the Playwright harness, `test/e2e/` (TASK-013). Depends on 2.0 (TASK-045). Not one of the entries 1.25 pulls ahead of cutover.
- **Today.** `src/components/Stepper.tsx` is a named group of − , a mono `<output>` and +, used only by `src/components/PaceSettings.tsx`. It holds no state. At a bound the button stays a focusable `<button>` with `aria-disabled` and a visible reason (*The highest is N*), and that reason is what a typed value past a bound shows.
- **Type it.** The number becomes a button named for its row (*Edit minutes a day*); a tap swaps it for `<input inputmode="numeric">` with the value selected. Enter or leaving the field commits, and Esc puts the old value back. An empty field or anything that isn't a number changes nothing. The plan says how the value stays announced, now that the `<output>` has gone and the button's name doesn't include it.
- **Hold.** Repeats after 400ms and speeds up the longer it's held; it stops at a bound, on release, and when the pointer leaves or is cancelled. A tap is one step, a keyboard press still one. Details the plan has to get right: each repeat steps from the latest value, not the one captured at the press; the `click` that ends a hold must not add a step; a long press on a phone must not select text or open a context menu.
- **One save, and what that asks of a hold.** `PaceSettings` restarts a 500ms timer on each change, so the gap between any two repeats, the first one included, must stay under 500ms, or a slow hold sends two `PATCH`es. A typed value goes through the same `change`. `pagehide` flushes the timer but not a field still open: the plan says what happens to an uncommitted draft when the page is left.
- **Ask at the plan gate: what a typed value may be.** The entry bounds it but doesn't mention the step. `SETTING_BOUNDS` steps minutes by 1 and words by 5, and `PATCH /api/settings` takes any whole number in range. Proposed: a whole number off the step stays as typed (187), and − and + go on from it, clamped to the bound. A fraction (a desktop keyboard can type 12.5) counts as *isn't a number* and changes nothing, because the route would refuse it.
- **Drawn in this PR.** The mockup's `settings` frame gains the input here (standing rule 6, `ui.redrawFiles`). `design/STYLE_GUIDE.md` § 9 (*a number you step*) is a protected file and comes from the design tool afterwards: D-123 governs until then, and `Stepper.tsx`'s comment, which quotes *rather than type*, changes here.
- Design: `settings` in `design/mockups.html`; `.stepper` and `.stepper-wrap` in `src/app/globals.css`, including the 32px buttons and `.val`'s width, which the input has to hold so a row doesn't jump.
- Decisions: D-123. 2.0 (TASK-045) set the `aria-disabled` rule at a bound and the failed-write line.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): component tests: typing 45 and Enter in *Minutes a day* changes it
to 45; a value over the maximum commits the maximum and shows the reason; Esc
and an empty field leave the value as it was; with fake timers, a hold repeats,
repeats faster after its first second, and stops at the bound and on release; a
tap steps once. `PaceSettings`: a hold sends one `PATCH`, carrying the final
value. In the browser (0.11), the input has `inputmode="numeric"`, focus
returns to the number after a commit, and axe passes. Screenshots at 360px and
1280px.
- [x] AC-2: Given *Minutes a day* at 45: a tap on the number shows an input with its text selected; typing a value under the minimum and Enter commits the minimum and shows *The lowest is N*; typing 50 and leaving the field commits 50 with no Enter; `abc` then Enter leaves 45 and sends no `PATCH`. Enter and Esc put focus back on the number; leaving the field by tapping elsewhere leaves focus where you tapped.
- [x] AC-3: With fake timers: nothing repeats before 400ms; a release, a `pointerleave` and a `pointercancel` each stop the repeat; a hold that reaches a bound stops there with the button `aria-disabled` and the reason shown; the value after a hold of N repeats differs from the start by N steps plus none for the closing `click`; pressing Enter or Space on + steps once.
- [x] AC-4: A hold whose repeats span more than one second sends one `PATCH`, with the final value and only that field; a typed value and a − press inside the same 500ms send one `PATCH`; a failed save puts the number back and raises the failed-write line with Retry, as a press does (2.0).
- [x] AC-5: The Settings steppers meet the UX floor (`docs/04-design.md` § 10. The UX floor): the number's button and the input are real controls with names and at least 24px tall; a row is the same height with the input open as closed at 360px; a press-and-hold on a touch screen selects no text and opens no menu; text is 4.5:1 and the input's outline 3:1 in both themes; axe reports no new violations; screenshots at every `ui.viewports` width, light and dark, with the input open.

## Out of scope

- `design/STYLE_GUIDE.md` § 9 (protected; the design tool's).
- Changing `SETTING_BOUNDS`, any step size, or the 500ms wait.
- Other steppers (the batch sheet's *Mark next N*, not built).
- A logged session recalculating these numbers (2.1b).

## Files likely touched

- `src/components/Stepper.tsx` — the number's button, the input, the hold.
- `src/components/PaceSettings.tsx` — only if a hold needs more than `onChange` gives it.
- `src/app/globals.css` — the number's button, the input, hold's touch rules, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — the `settings` frame.
- `test/settings.test.tsx` — the component and fake-timer cases.
- `test/e2e/settings.spec.ts` — `inputmode`, focus, axe, screenshots.

## Verification

- Automated: `test/settings.test.tsx` (AC-1's component half, AC-2's values, AC-3, AC-4); `test/e2e/settings.spec.ts` (AC-1's browser half, AC-2's focus, AC-5).
- Manual: `npm run dev` on a phone. Tap the gear → Settings. Tap *Minutes a day*'s number → the numpad opens; type a number past the maximum and press Go → it stops at the maximum and says why. Hold + → it climbs and speeds up, and one save lands on release. Put the settings back as they were.

## Follow-ups

- `design/STYLE_GUIDE.md` § 9 (*a number you step*) still says "rather than type"; it is protected and comes from the design tool, D-123 governs until then → docs/OWNER-CHECKLIST.md § Actions from follow-ups (approved at plan)
- Typing a value off a bound removes the *highest/lowest is N* line, so the rows below move up before a tap on the next field lands; the reason line already did this on a press → not tracked: small, pre-existing with − and +, and the e2e order avoids it; raise it if it bites on the phone
- Screenshots are taken at the e2e projects' widths (390 light and dark, 768, 1280, reduced motion, touch); the ui-verifier covered 360, 390, 412, 768, 1024 and 1280 by hand → not tracked: the projects' widths are the accepted set (D-80)
- A real touch long press (no text selection, no context menu) can only be checked on a phone; CSS and the `contextmenu` guard are tested → not tracked: it is the task's manual step for the owner

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

Approved by the owner 2026-11-07. Typed values: whole numbers only (a fraction is "not a number"); a whole number off the step stays as typed, and − / + continue from it, clamped. An open draft is committed when the page is left.

1. Tests first: `test/settings.test.tsx` (happy-dom, fake timers) and `test/e2e/settings.spec.ts`.
2. `Stepper.tsx` (client): the number is a button named *Edit <label>*; a tap swaps it for `<input inputmode="numeric">` with the text selected. Enter commits and refocuses the number; Esc restores and refocuses; blur commits and leaves focus where tapped. Empty or non-whole-number changes nothing; past a bound commits the bound and shows the existing reason. A visually hidden `role="status"` output keeps the value announced.
3. Hold: `pointerdown` starts a 400ms timer and does not step; a tap steps on its `click`, and a hold's first step comes at 400ms, then every 300ms, every 120ms after 1s of hold (always under 500ms apart). Each step reads the latest value from a ref. Stops on up, leave, cancel and at a bound. The `click` that closes a hold is swallowed; a keyboard click (detail 0) always steps once, even after a hold that ended with no click (spec review R1; plan revision, wording only). CSS `touch-action`, `user-select:none`, `-webkit-touch-callout:none`; `contextmenu` prevented on the buttons.
4. Draft on leave: `Stepper` commits an open draft on `pagehide` and unmount; `PaceSettings.change()` saves at once when `document.visibilityState === "hidden"`.
5. `globals.css`: number button and input hold `.val`'s width and 32px height; input outline `--brand` (3:1); tokens only.
6. `design/mockups.html` `settings` frame gains the input-open state; `design/mockups-index.md` updated; `Stepper.tsx` comment no longer says "rather than type".

Files: `src/components/Stepper.tsx`, `src/components/PaceSettings.tsx`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/settings.test.tsx`, `test/e2e/settings.spec.ts`.

Tests: AC-1/2 component cases (plus e2e `inputmode`, axe); AC-3 fake timers; AC-4 `PaceSettings` with mocked `fetch`; AC-5 e2e (heights, row height open vs closed at 360px, contrast, axe, screenshots at every width, light and dark, input open; computed-style check for no-select; manual phone check for the long press).

Risks: happy-dom has no real touch long press.

## Review log

Verify R1 round PASS → full FAIL (7 e2e: one stale count of 2 buttons, one test-order slip in the new typing test) → specs re-run PASS | R2 round PASS | Audit R1 CHANGES (AC-3 key press unproven) → R2 PASS | Spec R1 CHANGES (a keyboard click swallowed after a clickless hold) → R2 APPROVE | UI R1 PASS (360–1280, light and dark; no console errors; dev data put back)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (round chain; full chain once)
- Review rounds: 2 (spec-reviewer; ui-verifier 1)
- First-pass AC FAILs: 1 (AC-3, the key press after a clickless hold)
- Plan revisions after approval: 2 (test/stepper.test.tsx added; step 3 reworded, a tap steps on click)
