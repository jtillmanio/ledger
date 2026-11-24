---
id: TASK-148
title: 6.25 Navigation for four and five media (2 of 3) — the phone's medium button, search and tab row
status: Draft
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-148 — 6.25 Navigation for four and five media (2 of 3) — the phone's medium button, search and tab row

## Goal

On the phone, the top bar reads *Ledger* · the current medium as a button that opens a *Switch medium* sheet, then search and the gear, so the bar has room for a fourth and fifth medium; search leaves the thumb bar, and the tab row ends with the across-media items.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.25 Navigation for four and five media (M21). Feature F-05. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 2 of 3.** TASK-147 does *Start on*; TASK-149 the tablet and desktop, and its merge ticks 6.25.
- **The rule** (D-178, which amends D-33's media switch, D-113's phone bar and D-120's tab row; MR-D1, MR-D2, MR-D3; frames A5–A7 in `design/MR-A-Navigation-1.dc.html`, F16 in `design/MR-F-Unbuilt-2.dc.html`; `design/STYLE_GUIDE.md` §17.1's *Phone* row):
  - The bar: *Ledger* · the current medium as a 44px button with a chevron, underlined in its `--m-*` (`aria-haspopup="dialog"`), then a 44px magnifier left of the 44px gear. Width at 360px: 264px whatever the medium (§17.1).
  - The **Switch medium** sheet: a row per medium, each its icon, name, the medium's Now in a few words and a mono count; the current one `aria-current` with a grey check.
  - The tab row (2.2i) is unchanged up to its end, which gains a 1px `--rule-2` divider, then *Inbox* (mono count) · *Progress* · *Activity* (once 6.17 builds `/activity`; not here).
  - Search moves into the bar on every screen; the thumb bar's search slot is retired on every dashboard (D-25's slot 3 on the comics, books and watch dashboards). Until 6.1 builds search the bar's button is drawn and says why it does nothing, as the thumb bar's slot does today (`SearchVerb` in `src/components/ThumbBar.tsx`, `NAV_ITEMS`' `search` item).
- **What exists.** `src/components/nav/MediaBar.tsx` (the bar: wordmark, a *Media* nav of links, the gear, then `TabRow`), `src/components/nav/TabRow.tsx` (`tabRowItems` in `src/components/nav/items.ts`: the medium's screens, then Inbox and Progress from `group: "global"`), `src/components/nav/ShellFrame.tsx` (which nav shows is CSS alone), `src/components/nav/Icons.tsx`, `src/components/ThumbBar.tsx`, and a sheet to copy, `src/components/Sheet.tsx`.
- **Question for the plan gate: the sheet's *Now* line and count.** D-178 draws each row with its medium's Now in a few words and a count, which needs each medium's data on every route, in the shell, like `InboxCount` (`src/components/nav/InboxCount.tsx`, streamed in a Suspense). AC-1 doesn't assert them. The plan proposes how they load (streamed with the sheet, or when the sheet opens) within the routes' byte budgets and `test/query-budget.test.ts`, or proposes drawing name and icon now with the Now line and count as a follow-up; the owner decides at the plan gate.
- **The width limit is why now**: the three-media bar is at its limit at 360px (D-178), so this lands before 9.0 adds music.
- Design: the phone bar and tab row on every phone frame of `design/mockups.html`, and `palette`'s search from the bar, are superseded by A5–A7 and F16 until this task redraws them (`design/mockups-index.md` § Nov 2026, mediums review; `ui.redrawFiles`). TASK-146 has already replaced the gear glyphs if it merged first.
- Rules: `.claude/rules/ui.md` (the thumb bar's slots; hue never names navigation, the medium's underline is its `--m-*`, which is data identity; 44px icon buttons). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-25, D-33, D-113, D-120, D-177, D-178.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves every 360px clause: the medium button and its sheet, the search button and the gear, nothing sideways, no thumb-bar search slot, the tab row's divider, *Inbox* and *Progress*, and axe at 360px. TASK-147 and TASK-149 prove the rest):
browser test, light and dark: at 360px the bar shows the current medium as a
44px button whose sheet lists every built medium with the current one
`aria-current`, a 44px search button and the gear, nothing scrolls sideways,
and no dashboard's thumb bar has a search slot; the tab row ends with a
divider, *Inbox* and *Progress*; at 834px the rail names every medium; at
1024px the switch button opens a menu of every medium that arrows, Esc and
focus return work in; at 1280px the sidebar lists every medium with the
current one expanded and an *Across media* group; with *Start on* set to
Books, `/` opens `/books`; axe reports no new violations at each width.
- [ ] AC-2: On `/books`, the medium button's accessible name includes *Books*, it carries `aria-haspopup="dialog"` and `aria-expanded`; pressing it opens the sheet with focus inside, choosing Comics navigates to `/comics` and closes the sheet, and Esc or Back closes it with focus returned to the button.
- [ ] AC-3: On a screen with no medium (`/inbox`, `/settings`), the medium button names the medium the tab row draws (the last used, as 2.2i does today).
- [ ] AC-4: The comics, books and watch dashboards' thumb bars have no slot named *Search*, and each keeps its mark verb in slot 1; the run detail's slot 3 is still `+` (Add issues).
- [ ] AC-5: The bar and sheet meet the UX floor (`docs/04-design.md` § 10. The UX floor): every button at least 44px, every control a real button or link with a name, text 4.5:1 in both themes, reduced motion respected on the sheet, axe reports no new violations, and screenshots at 360, 390 and 412px, light and dark.
- [ ] AC-6: `design/mockups.html`'s phone bars and tab rows are redrawn from A5–A7 (and `palette` from F16 for the bar's search), and `design/mockups-index.md`'s rows say so.

## Out of scope

- The tablet rail, the icon rail's menu, the sidebar and the desktop headers (TASK-149); *Start on* (TASK-147).
- Search itself (6.1): the button is drawn and says why it does nothing until then.
- *Activity* in the tab row (6.17) and music and games in the sheet (9.0, 10.0).
- The `--m-music` and `--m-games` tokens (already in `globals.css`, D-177).

## Files likely touched

- `src/components/nav/MediaBar.tsx` — the medium button and the search button.
- `src/components/nav/MediumSheet.tsx` (new) — *Switch medium*, after `src/components/Sheet.tsx`.
- `src/components/nav/TabRow.tsx`, `src/components/nav/items.ts` — the divider and the across-media items.
- `src/components/nav/Icons.tsx` — the chevron and the magnifier, if missing.
- `src/components/ThumbBar.tsx` — the search slot retired.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — the phone bars, tab rows and `palette`.
- `test/nav-items.test.tsx`, `test/thumb-bar.test.tsx`, `test/e2e/shell.spec.ts`, `test/e2e/tab-row.spec.ts`, `test/e2e/thumb-bar.spec.ts` — AC-1's clauses, AC-2 to AC-5.

## Verification

- Automated: `test/nav-items.test.tsx` (the tab row's order and divider); `test/thumb-bar.test.tsx` (AC-4); `test/e2e/shell.spec.ts` and `test/e2e/tab-row.spec.ts` at 360px, light and dark, with axe (AC-1's clauses, AC-2, AC-3, AC-5); `test/perf.test.ts` and the routes' byte budgets still pass.
- Manual: the ui-verifier walks the bar and sheet on `/comics`, `/books`, `/watch`, `/inbox` and `/settings` at 360, 390 and 412px → expected: A5–A7's bar, the sheet switches media, nothing scrolls sideways.

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
