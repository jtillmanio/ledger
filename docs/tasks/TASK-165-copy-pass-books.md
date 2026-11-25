---
id: TASK-165
title: 6.27 Plainer words on every built screen (2 of 3) — the books screens
status: Ready
depends_on: [TASK-164]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-165 — 6.27 Plainer words on every built screen (2 of 3) — the books screens

## Goal

The books screens use the plainer wording the owner accepted, and the mockup says the same.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.27 (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 2 of 3.** TASK-164 listed the strings and the owner marked them; this applies the *take* and *edit* rows for the books screens (`bdash`, `status`, `plan`, `blist`, `add`, `shelves`, `series`, `author`, `top`, `releases`, `parked`, `bookdetail`, `finishoffer`, `follow` in `design/mockups-index.md`). TASK-166 does the rest.
- **Size.** If the marked rows touch more than eight source files, the plan splits this task by screen group before any code (`workflow.splitPolicy` is `split`).
- Each changed string changes in `src/` and in `design/mockups.html` in the same PR (CLAUDE.md: the mockup is the copy authority), and the specs that name it follow it.
- Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves it for the books screens):
`docs/review/copy-pass.md` lists every changed string with its old and new
text and the owner's mark; no string marked *keep* changed; every accepted
string is in `design/mockups.html` where it draws it; the browser suite
passes; the rules are in `docs/04-design.md` § 11.
- [ ] AC-2: Given each *take* or *edit* row for a books screen, the string on the screen is the row's new text, at 360px and 1280px.
- [ ] AC-3: Given an aria name that repeated the visible text, it says the new text too (axe's `label-content-name-mismatch` passes).
- [ ] AC-4: The changed screens meet the UX floor (`docs/04-design.md` § 10. The UX floor): no new truncation or wrapping at 360px, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Comics, shared and Settings strings (TASK-166).
- Any string marked *keep*, or any layout change.

## Files likely touched

- `src/app/books/**`, `src/components/*` (the books components the marks name) — the strings.
- `design/mockups.html` — the same strings.
- `test/e2e/*.spec.ts` — the specs that name a changed string.
- `docs/review/copy-pass.md` — each applied row ticked.

## Verification

- Automated: the browser specs that name the strings (`npm run test:e2e` locally for the changed specs, the full suite in CI); `test/copy-pass.test.ts` updated to the new text.
- Manual: `npm run dev`, walk each books screen at 360px → expected: the accepted wording, nothing cut off.

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
