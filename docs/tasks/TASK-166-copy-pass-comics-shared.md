---
id: TASK-166
title: 6.27 Plainer words on every built screen (3 of 3) — comics, shared screens and the rules
status: Ready
depends_on: [TASK-165]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-166 — 6.27 Plainer words on every built screen (3 of 3) — comics, shared screens and the rules

## Goal

The comics and shared screens use the accepted wording, and the voice rules are written into the design doc for screens to come.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.27 (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 3 of 3.** Applies the remaining marked rows: comics (`home`, `runs`, `spine`, `range`, `addsearch`, `bulk`, `queue`, `issuedetail`, `batch`), and the shared screens (`progress`, `capture`, `settings`, `calibre`, `states`, `apistates`, the shell and Undo toasts), and writes the rules from `docs/review/copy-pass.md`'s top into `docs/04-design.md` § 11. Interface. `design/STYLE_GUIDE.md` is protected: it changes only with the owner's permission, asked in the plan. This is the last part: its PR ticks 6.27.
- **Size.** As TASK-165: more than eight source files, and the plan splits it first.
- Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part completes it):
`docs/review/copy-pass.md` lists every changed string with its old and new
text and the owner's mark; no string marked *keep* changed; every accepted
string is in `design/mockups.html` where it draws it; the browser suite
passes; the rules are in `docs/04-design.md` § 11.
- [ ] AC-2: Given each *take* or *edit* row for a comics or shared screen, the string on the screen is the row's new text, at 360px and 1280px.
- [ ] AC-3: `docs/04-design.md` § 11. Interface holds the rules, each with its example, and every row in `docs/review/copy-pass.md` is marked applied or *keep*.
- [ ] AC-4: The changed screens meet the UX floor (`docs/04-design.md` § 10. The UX floor): no new truncation at 360px, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Books screens (TASK-165).
- Watch, music and games, which aren't built.

## Files likely touched

- `src/app/comics/**`, `src/app/progress/**`, `src/app/settings/**`, `src/app/inbox/**`, `src/components/*` (the ones the marks name) — the strings.
- `design/mockups.html` — the same strings.
- `docs/04-design.md` — the rules.
- `test/e2e/*.spec.ts` — the specs that name a changed string.
- `docs/review/copy-pass.md` — each applied row ticked.

## Verification

- Automated: the browser specs that name the strings; `test/copy-pass.test.ts` updated.
- Manual: `npm run dev`, walk comics and Settings at 360px → expected: the accepted wording, nothing cut off.

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
