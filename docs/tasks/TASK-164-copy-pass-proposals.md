---
id: TASK-164
title: 6.27 Plainer words on every built screen (1 of 3) — the proposals
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-164 — 6.27 Plainer words on every built screen (1 of 3) — the proposals

## Goal

Every user-facing string on the built screens is listed beside a plainer version, under written rules, for the owner to mark before anything changes.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.27 Plainer words on every built screen (M21 in `docs/06-tasklist.md`). Feature F-44. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 (*overall wording review: less fluffy, more direct*).
- **Split, 1 of 3.** This part writes `docs/review/copy-pass.md` and changes no string; TASK-165 applies the owner's marks to the books screens, TASK-166 to comics, the shared screens and the rules.
- **What the file holds.** At the top, the rules the pass applies (say what happens; cut asides and adverbs; one sentence where there were two; keep the words the data model uses: Someday, On deck, Unlisted, Parked). Then one table per screen, by `design/mockups-index.md`'s screen IDs: the string, where it lives (`file:line`), the proposal, and a blank *mark* column (*keep*, *take*, or *edit:* with the owner's text). Strings the mockup draws are cited there too (`design/mockups.html` is the copy authority, CLAUDE.md).
- **Where strings live.** `src/app/**` and `src/components/**` (headings, empty states, toasts, menus, sheets, Settings), and the aria names that repeat visible text. Test specs that name strings are listed per string, so TASK-165 and TASK-166 know what moves with each.
- Rules: `.claude/rules/ui.md`. Design: `docs/04-design.md` § 11. Interface; `design/STYLE_GUIDE.md` is protected (changes only with the owner's permission).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the file and its marks column, TASK-165 and TASK-166 the changes):
`docs/review/copy-pass.md` lists every changed string with its old and new
text and the owner's mark; no string marked *keep* changed; every accepted
string is in `design/mockups.html` where it draws it; the browser suite
passes; the rules are in `docs/04-design.md` § 11.
- [ ] AC-2: Given `docs/review/copy-pass.md`, every row names a `file:line` that holds that string on the branch's `main` base (a script or test greps each), and every built screen in `design/mockups-index.md` has a table or a line saying it has no strings to change.
- [ ] AC-3: No file under `src/` or `design/` changes in this task's PR.
- [ ] AC-4: The rules at the file's top are each one sentence, with one before → after example from the table.

## Out of scope

- Changing any string (TASK-165, TASK-166).
- Screens not built yet (watch, music, games).

## Files likely touched

- `docs/review/copy-pass.md` — new.
- `test/copy-pass.test.ts` — new: every cited `file:line` holds its string (AC-2).

## Verification

- Automated: `test/copy-pass.test.ts`.
- Manual: the owner reads the file and fills the *mark* column → expected: every row marked before TASK-165 starts.

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
