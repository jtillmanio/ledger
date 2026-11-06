---
id: TASK-052
title: 2.2i Every screen from a phone: the tab row
status: Ready
depends_on: [TASK-014]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-052 — 2.2i Every screen from a phone: the tab row

## Goal

On a phone, a row under the media bar lists every screen of the medium you're in, then Inbox, so no screen needs a typed URL.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2i Every screen from a phone: the tab row (M10, after 2.2c; owner intake 2026-11-05, D-120, **amends D-77**). The roadmap entry and its **Check:** are the contract; its Check was proposed at the intake and agreed by the owner on 2026-11-06, when these task files were written. Features: F-71. Depends on 1.8 (TASK-014, the shell). Nothing later needs it first, but it is the phone's way to every screen, so it goes early. Not one of the entries 1.25 pulls ahead of cutover.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the row, the `--bar-h` change and its sticky offsets, the last medium's hand-off, the perf check, the phone-frame redraw and the new browser spec land together, which is more than 8 files, all in the shell.
- **The gap.** The phone's bar draws the media switch and the gear only (`src/components/nav/MediaBar.tsx`, D-77, D-113), so at 360px nothing links to Books *Status* or *Add*, and Comics *Status* has a link only while something is mid-run.
- **The row.** Below 768px only, inside the sticky bar: the current medium's enabled items from `NAV_ITEMS` (`mediumItems`, `src/components/nav/items.ts`, R1-06), then *Inbox*. A task that flips an item on (Plan, Shelves, Top) adds it here with nothing else to do. Hue never identifies it (`.claude/rules/ui.md`). The current item has `aria-current="page"` (`currentItem`). It scrolls sideways inside itself, never the page, with the current item scrolled into view. Targets are 44px tall.
- **It is part of `.bar`** (D-120): nothing else is sticky at `top:0` below 1024px (UX-N05). `.bar` is a one-line flex box of fixed `height:var(--bar-h)` today, and `.bar nav` styles the media switch, so the row needs its own selector and its own nav name; axe's landmark rules apply.
- **`--bar-h` grows on the phone only.** It is 64px up to 1023px and 80px from 1024px (`src/app/globals.css`). The rail at 768–1023px and everything that reads the variable there keep today's value. Its readers are `.bar`, `.sync-strip` (sticky under the bar) and `.pagehead`, and `test/e2e/shell.spec.ts` probes it. The thumb bar and the five slots don't move, and no screen's skeleton may shift.
- **The last medium needs a hand-off.** The entry says that on a screen with no medium (`/inbox`, `/settings`) the row draws the last medium's items (`mediumFor`, R1-13's cookie). `mediumFor` doesn't read the cookie: it is `mediumOf(pathname) ?? "comics"`. `ledger_medium` is `httpOnly`, and `MediaBar` is a client component, so the server has to hand it over. The pattern is `src/components/nav/LastRun.tsx`: streamed in a `<Suspense>` from `Shell.tsx` and handed to `ShellFrame` by `RememberRun`, so the page stays out of the read. The plan says how, and what the row draws until it arrives; the swap can't change the row's height. `src/proxy.ts` skips prefetches, so the cookie is the last medium you actually visited. The rail and the sidebar don't change, so they keep `mediumFor`'s comics there.
- **Prefetches.** A hidden nav is never prefetched (D-77), so today a phone prefetches only the bar's links. These links are on screen at phone width, and Lighthouse measures a phone, with prefetched RSC counted in *Document + RSC* and in requests (`docs/02-architecture.md` § 7). `/inbox`, `/settings` and `/watch` have the tightest byte budgets (`scripts/perf/budget.json`). The plan says which items take `noPrefetch` (comics Add already does) and whether any budget moves; raising one needs a reason in that section.
- **Three things the browser test has to handle.** Books has no dashboard until 2.2 flips `books-dash`, so *from each medium's dashboard* starts at each media switch's `href`, and picks up Books' Dashboard when TASK-049 lands. Comics *Add* shares `/comics/runs` with *Runs* until you've added to a run (`withLastRun`), so with no last run `currentItem` marks *Runs* after a tap on *Add*. And `NAV_ITEMS` is compiled in and a disabled item's route doesn't exist, so *with every books item enabled* can't be reached by navigating: the plan says how the test gets there (a static fixture, as `test/e2e/fixtures/plan-rail.html`, is one way) without shipping a test-only route or switch.
- **Manual checks walk the UI.** Standing rule 8 (`docs/06-tasklist.md`) is already written; this row is what makes it possible.
- TASK-049's plan puts a *Library* link in the dashboard's lede because the phone had no other way there (TASK-047's note). The row gives it one; the link does no harm and that plan stands unless the owner changes it.
- **Not drawn yet.** The mockup's phone frames gain the row and `design/mockups-index.md` notes it before it is built: the plan draws them first and the owner sees them at the plan gate (standing rule 6, `ui.redrawFiles`). Nearly every screen in the mockup has a phone frame, so the plan says which are redrawn, and any left go under *Not shown* in the index.
- Design: `docs/04-design.md` § 10 and § 11 (already name the row), `design/mockups-index.md` (the 360 frame's description), `design/STYLE_GUIDE.md` § 14 (the bar's glass).
- Decisions: D-120, D-77, D-113, D-40. R1-06, R1-13, UX-N05.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a browser test at 360px, built from `NAV_ITEMS`, so a newly enabled
item is covered without editing it: from each medium's dashboard, every enabled
item of that medium, *Inbox* and *Settings* is reached by tapping links, with no
direct navigation. The current item has `aria-current="page"`. With every books
item enabled, the page has no horizontal overflow at 360px. The row is not
rendered at 768px or wider. Each item measures at least 44px tall, and axe
passes. 0.10's CLS budget holds on `/books/list` and `/comics`. Screenshots at
360px and 412px, light and dark.
- [ ] AC-2: The row lists exactly the bar's own items in order: on each medium, `mediumItems(items, medium)` then *Inbox*, with no disabled item (a unit test flips `comics-status` off and its link leaves the row), and the row's markup is inside `header.bar`.
- [ ] AC-3: Given you last visited a `/books` screen, then tap *Inbox*: on `/inbox` the row lists the books items and *Inbox* has `aria-current="page"`; the same from comics lists the comics items; with no `ledger_medium` cookie it lists comics. On `/settings` the row draws the last medium's items, none of them current, and the gear has `aria-current="page"` (D-113). The row's height is the same before and after the last medium arrives.
- [ ] AC-4: At 360px, scrolled 400px, `.bar`'s bottom edge equals `--bar-h`, the row is still in view, `.sync-strip` sits directly under it, and `shell.spec`'s *everything that sticks but .bar* check passes. `--bar-h` still resolves to 64px at 768px and 80px at 1024px. Loaded on a page whose current item is last in the row, that item is inside the row's visible box and the page's `scrollLeft` is 0.
- [ ] AC-5: On the preview, Lighthouse reports no route over `scripts/perf/budget.json`, and no `/api/*` request during a load or prefetch; any budget this task raises has its reason in `docs/02-architecture.md` § 7.
- [ ] AC-6: The tab row meets the UX floor (`docs/04-design.md` § 10. The UX floor): every link has a name and is at least 44px tall; the current item shows by weight or underline as well as colour, and text is 4.5:1 in both themes; the row keeps `aria-current` on the right item with reduced motion on; axe reports no new violations (landmarks included); screenshots at 360, 390 and 412px, light and dark, and the row is absent at 768, 1024 and 1280px.

## Out of scope

- The tablet rail and the desktop sidebar, which already list these items, and their `mediumFor` on `/inbox`.
- Enabling any `NAV_ITEMS` entry (Plan, Shelves, Top and Watch's items are their own tasks' flips).
- Where Search goes when 6.1 lands (the gear took its slot, D-113).
- Links on the dashboards themselves, or a menu behind a button (both rejected in D-120).
- `design/STYLE_GUIDE.md`, a protected file: anything it needs comes through the design tool.

## Files likely touched

- `src/components/nav/MediaBar.tsx` — draws the row inside `header.bar`.
- `src/components/nav/TabRow.tsx` (new; the plan's name) — the row, its scroll into view.
- `src/components/nav/ShellFrame.tsx`, `src/components/nav/Shell.tsx`, `src/components/nav/LastMedium.tsx` (new; the plan's name) — the last medium's hand-off, as `LastRun`.
- `src/components/nav/items.ts` — `noPrefetch` where the plan says, the medium with no path.
- `src/app/globals.css` — `--bar-h` on the phone, `.bar`'s two lines, the row, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — the phone frames (drawn first).
- `scripts/perf/budget.json`, `docs/02-architecture.md` — only if a budget moves, with its reason.
- `test/e2e/tab-row.spec.ts` (new), `test/nav-items.test.tsx`, `test/e2e/shell.spec.ts`.

## Verification

- Automated: `test/e2e/tab-row.spec.ts` (AC-1 built from `NAV_ITEMS`, AC-3, AC-4, AC-6's sizes, axe and screenshots); `test/nav-items.test.tsx` (AC-2); `test/e2e/shell.spec.ts` (the sticky stack); Lighthouse on the preview (AC-5).
- Manual: `npm run dev` at phone width. From the Comics dashboard tap each item in the row, then *Inbox* → each opens and shows as current. Tap *Books*, then *Status*, *Add* and *Inbox* → the row still lists the books items on Inbox. Tap the gear → Settings, the row unchanged.

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
