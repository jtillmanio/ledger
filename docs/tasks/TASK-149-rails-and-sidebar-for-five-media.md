---
id: TASK-149
title: 6.25 Navigation for four and five media (3 of 3) — the tablet rail, the icon rail's menu and the sidebar
status: In progress
depends_on: [TASK-147, TASK-148]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: f8c9a9f
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
- *From TASK-148 (6.25, PR #354):* search's button is `src/components/nav/SearchButton.tsx` (drawn, `aria-disabled` with its reason, until 6.1 enables the `search` item; a `className` prop). The desktop header's slot 3 imports it in `slots("header")` in `src/components/ThumbBar.tsx`: that is the *Search* verb 6.25 drops from the headers (the thumb bar's slot 3 is already empty on every dashboard). The across-media items are still `NAV_ITEMS`' `group: "global"` items (Inbox, Progress); TASK-148 added none to `items.ts`, only drew them after a divider (`.tabdiv` in the tab row) with Inbox's streamed count. The `chevron-down` and `check` icons are in the sprite for the icon rail's switch.

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

Approved 2026-11-26 (owner: "Approve"; the well's media are 58 × 46 as A8 draws them, AC-6's 56px read as the rail's screen and across-media items).

**Steps**

1. `src/components/nav/SearchButton.tsx`: takes optional children, so the rail and the sidebar draw their own Search, the same `aria-disabled` button named *Search (Ctrl K)* that says *Search isn't built yet* until 6.1. Ctrl K binds nothing.
2. `NavRail.tsx` (768–1023px, A8): under the *L*, a `--sunk` well (`role="group"`, *Medium*) of every built medium, 58 × 46, icon over an 11px name, the current one a raised `--surface` pill; then the medium's items (56px), a rule, Inbox (badge) and Progress; Search, then Settings and sync at the foot. The middle scrolls when the window is short; the foot stays.
3. `MediumMenu.tsx` (new, after `Menu.tsx`): a 48 × 44 button, the current medium's icon and a chevron, named "Books, switch medium", `aria-haspopup="menu"`, `aria-expanded`; its `role="menu"` is a link (`menuitem`) per built medium, the current one `aria-current` with a grey check. Opening focuses the first item; ArrowUp/ArrowDown/Home/End move; Esc closes with focus back on the button; Tab and a click elsewhere close. Placed absolutely beside the 64px rail (`.side`'s backdrop-filter already contains it, as the tooltips).
4. `Sidebar.tsx`: one markup, CSS choosing per width (no flash at hydration). Order: wordmark → Search (*Search · Ctrl K* at 1280, an icon with a tooltip at 1024) → the switch (1024–1279 only) → *Media* (1280+: a 36px row per built medium; the current one a disclosure button, `aria-expanded`, its items nested under it at 34px, current `--raise` + 3px `--m-*` bar; the others one-line links to their dashboards) → *Across media* (Inbox with its mono count, Progress; a rule and icons at 1024) → Settings and sync. At 1024–1279 only the nested items show, as the icon column.
5. `src/components/ThumbBar.tsx`: the header's *Search* verb goes (slot 3 of a dashboard's header is empty); the verbs keep D-25's order, primary last.
6. `src/app/globals.css`: the well, the menu, the media list and the across-media group, tokens only; the sidebar's old `.seg`/`.sm` rules go. The 1280 sidebar scrolls when the window is short.
7. `design/mockups.html`: a one-off scratchpad script (not committed) redraws the 25 tablet rails from A8 (the well of the built media, Progress after Inbox; books' items as A8 lists them) and the 55 desktop sidebars from A9 (Search · Ctrl K, *Media* with the frame's medium open, *Across media*). No frame draws the 1024px icon rail; `design/mockups-index.md`'s row says so.

**Files**: `src/components/nav/{NavRail,Sidebar,SearchButton}.tsx`, `src/components/nav/MediumMenu.tsx` (new), `src/components/ThumbBar.tsx`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/nav-items.test.tsx`, `test/thumb-bar.test.tsx`, `test/e2e/{shell,thumb-bar,mockup-tablet}.spec.ts`; possibly `test/e2e/{books-dashboard,settings}.spec.ts` where they read the old media links. Not in *Files likely touched*: `SearchButton.tsx`, `test/thumb-bar.test.tsx`, `test/e2e/thumb-bar.spec.ts` (AC-5), `test/e2e/mockup-tablet.spec.ts` (AC-6). `items.ts` needs no new group: `media` and `global` already are (TASK-148).

**Test strategy**

- AC-1 (834/1024/1280 clauses, axe), AC-2, AC-3, AC-4: `test/e2e/shell.spec.ts`, light and dark at 834, 1024 and 1280, with axe at each width.
- AC-5: `test/thumb-bar.test.tsx` (each kind's header names, no *Search (Ctrl K)*) and `test/e2e/thumb-bar.spec.ts` at 1024+.
- AC-6: `shell.spec.ts` (target sizes, names, the menu's reduced motion probe, screenshots at 768, 1024 and 1280 light and dark); `mockup-tablet.spec.ts` (every rail has the well and Progress; every sidebar has Search · Ctrl K, *Media* with one open medium, *Across media*; the index row says redrawn).
- The groups: `test/nav-items.test.tsx` (the well, the media list, the switch, Search drawn and inert in the rail and sidebar).

**Revision 1 (Phase 2)**: A9 draws a right chevron on each closed media row, so `Icons.tsx` gains `chevron-right` and `items.ts`' `IconName` names it. The new buttons inside the navs (Search, the switch, the open medium's row) join the control-state matrix as `.rail button` and `.side button` (`globals.css`, `test/control-states.test.ts`). The 1024px menu's screenshot is taken under reduced motion: a full-page capture restarts its 150ms entrance and caught it half-faded. Every rail and sidebar in the mockup is rebuilt from one model (the frame's medium, the old current item), since eight later rails were stubs with no media group or foot.

**Revision 2 (spec review R1; owner: "Yes, in this PR")**: `design/mockups.html`'s two desktop `bdash` headers still drew the *Search* verb this task removes (AC-5, MR-D4); they drop it. The 16 dashboard thumb bars that still drew a search slot (MR-D2, left by TASK-148's redraw) drop it too, since 6.25 ticks with this PR. `mockup-tablet.spec.ts` checks that no desktop header or thumb bar draws Search, and the index row says so.

**Revision 3 (ui-verifier R1)**: in a short window (Books at 834 × 900), the rail's scroller held Inbox and Progress below the fold. Where the browser draws classic scrollbars, a 15px bar left the 64px items 57px and scrolled them sideways, clipping *Add*. Now only the medium's screens scroll; the rule, Inbox and Progress sit outside the scroller, which draws no scrollbar and clips sideways. The icon rail's *Switch medium* tooltip no longer sits over its own open menu. `shell.spec.ts` adds the short-window test and a tooltip check.

**Risks**: at 1024 the switch names the set the rail draws, and a screen under no medium (`/inbox`) still draws comics' set (`mediumFor`, unchanged). The menu is imported statically; if `test/perf.test.ts` or the byte budgets object, it loads on first open as `MediumSheet` does. Size: 13–15 files, no schema; kept whole (part 3 of an agreed split; AC-6 binds the redraw, as TASK-148's did).

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
