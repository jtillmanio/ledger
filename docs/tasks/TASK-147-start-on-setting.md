---
id: TASK-147
title: 6.25 Navigation for four and five media (1 of 3) — Start on, for what / opens
status: Draft
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-147 — 6.25 Navigation for four and five media (1 of 3) — Start on, for what / opens

## Goal

Settings → Appearance gains *Start on*: *Last used* (as today) or a named medium, and opening the Ledger at `/` goes there.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.25 Navigation for four and five media (M21 in `docs/06-tasklist.md`; lands before 9.0 adds a fourth medium). Feature F-05. Depends on 6.23 (TASK-126, done). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 1 of 3** (`workflow.splitPolicy: split`: the phone bar, the switch sheet, the tab row, the thumb bar, the tablet rail, the icon rail's menu, the sidebar, the desktop headers and a setting are well over eight files). This part: *Start on*. TASK-148 does the phone; TASK-149 the tablet and desktop, and its merge ticks 6.25.
- **The rule** (MR-D7, MR-Q2, D-178; `design/STYLE_GUIDE.md` §17.1, frame E17 in `design/MR-E-Review-3.dc.html`): `/` redirects to the dashboard of the medium used last (unchanged; R1-13); *Start on* (*Last used* by default, or a medium) overrides it; with nothing used yet it opens `/comics`.
- **What exists.** `src/app/route.ts` redirects `/` with `pickMedium(req.cookies.get(MEDIUM_COOKIE)?.value)` (`src/lib/last-medium.ts`, `ledger_medium`, `MEDIA`). Settings' *Appearance* group (`src/app/settings/page.tsx`) holds *Show covers* (`src/components/ShowCovers.tsx`), a per-device cookie (`ledger_covers`, `src/lib/covers.ts`) read on the server so the switch draws right on the first paint, written on a press, with a read-back check. Copy that pattern.
- **Where it is stored.** A per-device cookie, as *Show covers*, needs no schema. Storing it in the database (`reading_settings` or a new column) would change the schema: CLAUDE.md says stop and ask first, so the plan proposes a cookie unless the owner says otherwise at the plan gate.
- **The choices** list every built medium (`MEDIA`: comics, books, watch today); music and games join when 9.0 and 10.0 add them to `MEDIA`.
- Design: `design/mockups.html` § `settings` gains the *Start on* row from E17 (`ui.redrawFiles`; TASK-146 redraws the rest of the frame and leaves this row to 6.25).
- Rules: `.claude/rules/ui.md`; `/api/health` stays the one route outside the passcode gate (`src/proxy.ts`). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-178, D-33; R1-13.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *with Start on set to Books, / opens /books*. TASK-148 and TASK-149 prove the rest):
browser test, light and dark: at 360px the bar shows the current medium as a
44px button whose sheet lists every built medium with the current one
`aria-current`, a 44px search button and the gear, nothing scrolls sideways,
and no dashboard's thumb bar has a search slot; the tab row ends with a
divider, *Inbox* and *Progress*; at 834px the rail names every medium; at
1024px the switch button opens a menu of every medium that arrows, Esc and
focus return work in; at 1280px the sidebar lists every medium with the
current one expanded and an *Across media* group; with *Start on* set to
Books, `/` opens `/books`; axe reports no new violations at each width.
- [ ] AC-2: Given *Start on* is *Last used* (the default, and the value when nothing is stored) and the last medium visited was watch, `/` redirects to `/watch`; given nothing visited and nothing stored, `/` redirects to `/comics`.
- [ ] AC-3: Given *Start on* is Books and the last medium visited was comics, `/` redirects to `/books`; given a stored value that names no built medium, `/` behaves as *Last used*.
- [ ] AC-4: Settings → Appearance shows *Start on* with *Last used* and one choice per built medium, the stored choice selected on the first paint (no flash), and a change persists across a reload; nothing is written to the database.
- [ ] AC-5: *Start on* meets the UX floor (`docs/04-design.md` § 10. The UX floor): a real control with a name, targets at least 44px, text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The phone bar, the switch sheet, the tab row and the thumb bar (TASK-148); the rails and sidebar (TASK-149).
- Theme and density, also under Appearance (6.11).
- Storing the choice in the database (a schema change: only if the owner asks).

## Files likely touched

- `src/lib/last-medium.ts` — the *Start on* cookie and the pick.
- `src/app/route.ts` — `/` honours *Start on*.
- `src/components/StartOn.tsx` (new) — the control, after `ShowCovers.tsx`.
- `src/app/settings/page.tsx` — the row in *Appearance*.
- `design/mockups.html`, `design/mockups-index.md` — `settings`' *Start on* row.
- `test/redirect.test.ts`, `test/settings.test.tsx`, `test/e2e/settings.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/redirect.test.ts` (AC-2, AC-3); `test/settings.test.tsx` (AC-4's first paint); `test/e2e/settings.spec.ts` setting *Start on* to Books, then opening `/` (AC-1's clause, AC-4, AC-5 with axe).
- Manual: the ui-verifier sets *Start on* to Books, opens `/` → expected: `/books`; sets it back to *Last used* → expected: `/` opens the medium visited last; the setting is left as found.

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
