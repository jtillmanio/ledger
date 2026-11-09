---
id: TASK-067
title: 2.7 Rebalance (2 of 2) — the rebalance sheet and the settled stretch year
status: Draft
depends_on: [TASK-066]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-067 — 2.7 Rebalance (2 of 2) — the rebalance sheet and the settled stretch year

## Goal

From an over-full year, one tap opens four equal choices, each showing what it would do. A year you accept turns a calm grey with an Undo, and stays settled until it grows past what you accepted.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.7 Rebalance, and accepting an overage (M11). The entry and its **Check:** are the contract. Feature F-23.
- **Split, 2 of 2.** TASK-066 built `plan_acceptance` and the moves; this part is what you see. **Its merge ticks the roadmap entry.**
- **Stop and ask at plan time (owner, at /new-task, 2026-11-09).** The entry puts the sheet *one tap from the books dashboard* and the banner *on the dashboard and the plan page*, and its Check tests that *the dashboard renders `.decide.settled`*. The owner's later answer at 2.2's plan gate (TASK-049, Q2) puts the capacity card with Rebalance and Accept on `/books/plan` only, never on the dashboard: `docs/04-design.md` § 12 → Books dashboard and → Over-commitment is a decision, not an error, and the dashboard's own notes in `design/mockups.html` (around line 2896). `/books/plan` is built by 2.10 (TASK-069), which M11's order puts after this. The plan asks which surface; if `/books/plan`, whether this task waits on TASK-069, and whether the owner amends the Check. Either way the dashboard's *This quarter* strip is the same rail (M-07, D-137), so its over-rule part takes `--hatch-settled` once the year is accepted.
- **The sheet** (mockup `rebalance`, `design/mockups.html` around lines 5001–5052; captures `rebalance-phone-dark.png`, `rebalance-desk-dark.png` in `design/screenshots/`): four equal-weight buttons, each with a before/after delta (*2028 then holds 45 books*) from TASK-066. A sheet that only offered ways to shrink the plan would be telling you your ambition is the bug (`docs/04-design.md` § 12).
- **Settled.** Accepting turns the amber (`.decide`) into a grey `.decide.settled` card stating what was accepted and when, with an Undo: *2027 accepted as a stretch year on 14 Sep · Undo* (sample figures, D-7). **Persistence is the whole feature**: an indicator that comes back next week is one the user learns to ignore. Both classes already exist in `src/app/globals.css` (around lines 924–931).
- **Settling keeps the data honest** (`design/Plan Rail Spec.dc.html` A4.2): the overage is still drawn, but its hatch turns from `--hatch` to the grey `--hatch-settled` (already a token, `globals.css` line 61) and the legend reads *over, accepted (settled)*; only the held state clears. The rail is `src/components/PlanRail.tsx` and `src/lib/plan-rail.ts`.
- The entry deletes the legacy red classes `.capnum.over` and `.pace .big.behind`. Neither is in `src/` or `design/mockups.html` today (grep, 2026-11-09); the PR confirms they stay gone.
- Amber means *held* and red is for destructive actions only (`docs/04-design.md` § 10): nothing here is red, and the word *behind* appears nowhere.
- The dashboard is a feel-pass surface; if the banner lands on `/books/plan`, that page follows the UX floor's ordinary screenshot widths.
- Decisions: D-37, D-137, D-40, D-7, M-07.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves `.decide.settled` and `--hatch-settled` in the browser, on TASK-066's stored acceptance): test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.
- [ ] AC-2: Given a year over capacity, the rebalance sheet shows four buttons with the same class and size, each with its before/after delta as TASK-066 computes it; nothing on the sheet resolves to `--danger`, and no text on it says *behind*.
- [ ] AC-3: After *Accept it as a stretch year*, the banner is `.decide.settled` and reads *<year> accepted as a stretch year on <day> <month> · Undo*; every over-rule block part on the rail (and on the strip) uses `--hatch-settled`, and the legend reads *over, accepted (settled)*. Undo returns the banner to `.decide` and the hatch to `--hatch`.
- [ ] AC-4: With an acceptance stored on an earlier day, a fresh load still shows the settled state; placing a book that takes the year past `accepted_total` shows `.decide` again.
- [ ] AC-5: The sheet and the banner meet the UX floor (`docs/04-design.md` § 10. The UX floor): four real buttons with names, nothing interactive under 24px and 44px on the phone, the sheet's focus on its heading and back on the opener, text 4.5:1 and the settled hatch 3:1 in both themes, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360px, 834px and 1280px, light and dark (every feel-pass width, with reduced motion and transparency, if the banner is on the dashboard).

## Out of scope

- The table and the moves (TASK-066).
- `/books/plan` itself (2.10, TASK-069).
- Accepting from 2.3's preview (asked at TASK-064's plan gate).
- Rebalance for comics or watch (`design/mockups-index.md` open item 12: described, not drawn).

## Files likely touched

- `src/components/RebalanceSheet.tsx` (new; the plan's name) — the four peers.
- `src/components/PlanRail.tsx`, `src/lib/plan-rail.ts` — `--hatch-settled` and the legend.
- `src/components/QuarterStrip.tsx` — the strip's settled hatch.
- `src/app/books/page.tsx`, or `src/app/books/plan/page.tsx` (per the plan-gate answer) — the banner.
- `src/app/globals.css` — the sheet, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — only if the plan gate moves the banner from what `rebalance` draws.
- `test/e2e/rebalance.spec.ts` (new), `test/plan-rail.test.ts`, `test/e2e/plan-rail.spec.ts`.

## Verification

- Automated: `test/e2e/rebalance.spec.ts` (AC-1's browser clauses, AC-2 to AC-5); `test/plan-rail.test.ts` (the settled hatch and legend in the markup).
- Manual: `npm run dev`. Plan more than a year's capacity → the amber card; open Rebalance → four equal choices with their deltas; *Accept* → the grey card with the date; reload → still grey; place one more book → amber again; Undo the acceptance → amber. Put everything back, as found.

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
