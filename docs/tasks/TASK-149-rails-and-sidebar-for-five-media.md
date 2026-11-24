---
id: TASK-149
title: 6.25 Navigation for four and five media (3 of 3) — the tablet rail, the icon rail's menu and the sidebar
status: Draft
depends_on: [TASK-147, TASK-148]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-149 — 6.25 Navigation for four and five media (3 of 3) — the tablet rail, the icon rail's menu and the sidebar

## Goal

On the tablet and the desktop, every medium is one tap away where it fits by name (the 834px rail, the 1280px sidebar) and one switch button away where it doesn't (the 1024px icon rail); the sidebar gains an *Across media* group and *Search · Ctrl K*, and the page headers drop their *Search* verb.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.25 Navigation for four and five media (M21). Feature F-05. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 3 of 3.** TASK-147 built *Start on*, TASK-148 the phone. **This part's merge ticks 6.25**, with the other two merged first; it reuses TASK-148's across-media items in `src/components/nav/items.ts`.
- **The rule** (D-178; MR-D4, MR-D5; frames A8–A10 in `design/MR-A-Navigation-2.dc.html`; `design/STYLE_GUIDE.md` §17.1's *Tablet*, *Icon rail* and *Sidebar* rows, and *Desktop header*):
  - Tablet (768–1023px): the rail's `--sunk` well holds every medium, 58 × 46, icon over an 11px name, the current one a raised `--surface` pill; after a rule, Inbox (badge), Progress (and Activity once 6.17 builds it); search at the rail's foot.
  - Icon rail (1024–1279px): one 48 × 44 button, the current medium's icon and a chevron, opening a menu of every medium (`role="menu"`, arrows, Esc, focus returns); across media after a rule, as icons; search an icon above the switch.
  - Sidebar (1280px+): *Search · Ctrl K* under the wordmark; *Media*, a list of every medium in 36px rows, the current one open (`aria-expanded`) with its items nested (34px; current `--raise` with a 3px `--m-*` bar), the others one-line links to their dashboards; an *Across media* group: Inbox (mono count), Progress.
  - Desktop header: the dashboards' verbs keep D-25's order, primary last, without *Search*.
  - Until 6.1 builds search, *Search · Ctrl K* and the rail's search icon are drawn and say why they do nothing, as the bar's button does (TASK-148); Ctrl K binds nothing yet.
- **What exists.** `src/components/nav/NavRail.tsx` (the tablet rail: the media switch, the medium's items, Inbox, Export and sync at the foot; `inbox` streamed in a Suspense), `src/components/nav/Sidebar.tsx` (one markup at two widths: 224px with labels from 1280px, a 64px icon rail from 1024px whose labels are visually hidden and shown as tooltips), `src/components/nav/ShellFrame.tsx` (which nav shows is CSS alone, so nothing flashes at hydration), `src/components/Menu.tsx` (a menu to copy for the switch), and the header verbs in `src/components/ThumbBar.tsx` used by `src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx` and `src/app/watch/page.tsx`.
- **One markup at two widths.** The sidebar and the icon rail are one component today; the icon rail's switch button and menu and the sidebar's expanded list may need both drawn and CSS choosing, as the navs are chosen now. The plan says how, keeping no flash at hydration.
- Design: the tablet rail, the desktop sidebar and icon rail on every 834px and desktop frame of `design/mockups.html` are superseded by A8–A10 until this task redraws them (`design/mockups-index.md` § Nov 2026, mediums review; `ui.redrawFiles`).
- Rules: `.claude/rules/ui.md` (sidebar icons neutral; hue identifies data, never navigation, apart from the medium's own `--m-*` bar; nothing interactive under 24px). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-25, D-33, D-177, D-178.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the 834px, 1024px and 1280px clauses and axe at those widths. With TASK-147 and TASK-148 merged, every clause is proven and 6.25 is ticked):
browser test, light and dark: at 360px the bar shows the current medium as a
44px button whose sheet lists every built medium with the current one
`aria-current`, a 44px search button and the gear, nothing scrolls sideways,
and no dashboard's thumb bar has a search slot; the tab row ends with a
divider, *Inbox* and *Progress*; at 834px the rail names every medium; at
1024px the switch button opens a menu of every medium that arrows, Esc and
focus return work in; at 1280px the sidebar lists every medium with the
current one expanded and an *Across media* group; with *Start on* set to
Books, `/` opens `/books`; axe reports no new violations at each width.
- [ ] AC-2: At 834px on `/books`, the rail shows a named item for each built medium with Books marked `aria-current`, then a rule, Inbox and Progress; tapping Watch opens `/watch`.
- [ ] AC-3: At 1024px, the switch button names the current medium and carries `aria-haspopup="menu"`; Enter opens the menu with focus on the first item, ArrowDown and ArrowUp move between media, Enter on Comics navigates to `/comics`, and Esc closes the menu with focus back on the button.
- [ ] AC-4: At 1280px on `/books`, the sidebar's *Media* list has a row per built medium with Books `aria-expanded="true"` and its screens nested under it, the others `aria-expanded="false"` or plain links to their dashboards; an *Across media* group holds Inbox with its count and Progress; *Search · Ctrl K* sits under the wordmark.
- [ ] AC-5: At 1024px and up, no dashboard header carries a *Search* verb, and each keeps its other verbs in D-25's order, primary last.
- [ ] AC-6: The rails, menu and sidebar meet the UX floor (`docs/04-design.md` § 10. The UX floor): targets at least 24px (56px on the tablet rail), every control a real button or link with a name, text 4.5:1 in both themes, reduced motion respected on the menu, axe reports no new violations, screenshots at 768, 1024 and 1280px, light and dark; and `design/mockups.html`'s tablet rails, icon rails and sidebars are redrawn from A8–A10 with `design/mockups-index.md` saying so.

## Out of scope

- The phone bar, its sheet, the tab row and the thumb bar (TASK-148); *Start on* (TASK-147).
- Search and Ctrl K's behaviour (6.1); *Activity* (6.17); music and games (9.0, 10.0).
- Export and sync at the rail's foot: unchanged.

## Files likely touched

- `src/components/nav/NavRail.tsx` — the tablet well and the across-media group.
- `src/components/nav/Sidebar.tsx` — the media list, *Across media*, *Search · Ctrl K*, and the icon rail's switch.
- `src/components/nav/MediumMenu.tsx` (new) — the icon rail's menu, after `src/components/Menu.tsx`.
- `src/components/nav/items.ts` — the media and across-media groups.
- `src/components/ThumbBar.tsx` — the header's *Search* verb dropped.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — the tablet and desktop navs.
- `test/nav-items.test.tsx`, `test/e2e/shell.spec.ts` — AC-1's clauses, AC-2 to AC-6.

## Verification

- Automated: `test/e2e/shell.spec.ts` at 834, 1024 and 1280px, light and dark, with axe (AC-1's clauses, AC-2 to AC-4, AC-6); a header test for AC-5; `test/nav-items.test.tsx` for the groups; `test/perf.test.ts` and the routes' byte budgets still pass.
- Manual: the ui-verifier walks `/comics`, `/books`, `/watch`, `/inbox` and `/progress` at 768, 1024 and 1280px → expected: A8–A10's navs, every medium reachable, the menu works by keyboard.

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
