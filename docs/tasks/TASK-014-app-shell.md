---
id: TASK-014
title: 1.8 App shell
status: Ready
depends_on: [TASK-013, TASK-026]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4bba78a
---

# TASK-014 — 1.8 App shell

## Goal

Every screen sits in the same chrome: a media bar on the phone, a navigation rail on a tablet, a sidebar on desktop. Nothing in the nav leads to a screen that doesn't exist yet.

## Context

- Roadmap: `docs/TASKS.md` § 1.8 App shell (sitting 6: 0.11 → 1.8c → **1.8** → 1.8d → 1.8b). R3-12 split out 1.8b (the thumb bar). The owner split the rest in three (2026-10-19): TASK-026 (1.8c) moves the routes and builds the `/` redirect first; this task is the navigation, the sync pill, glass, the widths and the mockup frames; TASK-027 (1.8d) is failed writes, skeletons and row markup. The roadmap entry, its widths table, *The tablet as drawn*, *The desktop as drawn* and its **Check:** are the contract. The 1.8c and 1.8d paragraphs in it are theirs.
- **Why this is still large** (`size: L`): the three navigation forms, the sprite, glass and the sticky stack, and the mockup's new frames change one layout together.
- Architecture: `docs/ARCHITECTURE.md` § 4. Interface (the route table; *One dashboard per medium*). `.claude/rules/ui.md` (one phone bar; hover behind `(pointer:fine)`; hue identifies data, never navigation).
- Design: STYLE_GUIDE §7–§9 and §14.5–§14.6; `design/LedgerDesktop.dc.html`, `design/LedgerNav.dc.html`; `design/Ledger Feel Review.dc.html` §10c (tablet) and §11 (desktop); PNGs in `design/screenshots/desktop/`. Mockups `home`, `spine`, `bdash`, `status` gain an 834px tablet frame and a 360px frame (`ui.redrawFiles`).
- Decisions: D-33 (breakpoints 768, 1024, 1280; the tablet rail), D-25b (the run detail keeps the bottom bar), D-40 (FP-D5 titles, FP-D16 inbox count in the sidebar), D-24b (identity hues), R1-06 (nav renders only routes that exist: one `NAV_ITEMS` list with `enabled`), UX-N05, UX-N07–N09.
- **Settled by the owner, 2026-10-19:** until 1.8b builds the thumb bar, each dashboard's `.actionbar` holds one verb that already exists. On comics it is *Resume <label>* to the resume pointer, or *Pick a run* → `/comics/runs` when nothing is in flight. On watch it is *Save to inbox* → `/inbox`. 1.8b replaces the contents.
- Picks up from TASK-009: the sidebar's global `Inbox (N)` links to `/inbox`, and this task asserts that half of 1.4b's check.
- Icons: Lucide outline at 1.5px, as an inline SVG `<symbol>` sprite in the layout (keep its ISC notice). Not under `public/`, because the passcode gate covers it. Nothing from a CDN.
- `/watch` is built here, not in TASK-026: this nav is the first thing to link to it, and its perf route needs a tap. It gets the shell, an `h1` and an empty slate, nothing more (8.x). `src/lib/last-medium.ts` (TASK-026) gains `watch` in the same PR.
- **Settled by the owner, 2026-10-09:** the books nav *Dashboard* item is `enabled: false` until 2.2 builds it. `/books` redirects to `/books/list` (TASK-026).
- *From TASK-005 (1.3c, PR #74):* The app-wide *Add* (sidebar, rail) should land on the run last added to (FEATURES 2c *Remember the last run*). 1.3c's Add issues screen covers consecutive adds with its *Adding to: … · Change* chip (`src/components/RunChip.tsx`), but nothing remembers the run between visits.
- *From TASK-005 (1.3c, PR #74):* The top bar's *Ledger* link is 46×23px at 360–768px, under the 24px target floor (ui-verifier on 1.3c's screen; the bar is `src/app/layout.tsx`).
- *From TASK-009 (1.4b, PR #80):* The lede's `N in inbox` chip on `/` and `/books` (`.inbox-chip`, `src/app/globals.css`) shows at every width for now; hide it from 1024px once the sidebar's `Inbox (N)` lands (FP-D16). 1.4b also put an `Inbox` link in the pre-shell nav bar (`src/app/layout.tsx`) and narrowed `.bar-inner`'s gap below 390px so its five links fit 360px; the shell's nav replaces both.
- *From TASK-012 (1.8a, task/1.8a-tokens-control-states):* The run page (`/comics/<run>`) at 360px is 29px wider than the viewport, so the Resume, Add issues and ⋯ row clips the ⋯ button. It is on `main` too (measured with main's `globals.css`); the shell should fit the row at 360px. (arrived after the plan was approved)

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): screenshot at 360px, 768px, 834px and 1280px; assert no horizontal scroll exists at any of them. At 768px and 834px the page renders the navigation rail, no top media bar and no sidebar; each rail item shows a visible text label and is at least 56px tall; every dashboard renders `.actionbar`, 48px tall. The rendered HTML references no external host for an icon, font or script, and every `<svg>` inside a button is `aria-hidden` while the button has a name. At 1100px the sidebar is 64px wide, each item has an accessible name, and focusing an item from the keyboard shows its tooltip at once. At 1280px the sidebar is 224px wide; at 1440px the content box is 1056px wide and centred in the space beside it. At 1024px and up no dashboard renders the *in inbox* chip and the sidebar's Inbox shows the count. At 360px *Watch* renders untruncated in the media bar, and the phone `/comics` has at most one solid `--brand` fill above the fold. No computed `color` inside `.bar` or `.side` equals `--ready`. With the page scrolled 400px, every sticky element other than `.bar` has a computed `top` of at least `--bar-h`. The rendered HTML contains no U+26B2. Test that every phone route renders exactly the same media nav.
- [ ] AC-2: Both bars render from one `NAV_ITEMS` list. An item with `enabled: false` renders nowhere: a test flips one item and asserts it disappears from the phone bar, the rail and the sidebar. Every enabled item's `href` resolves to an existing route (a test requests each and gets neither a 404 nor a 500). The books *Dashboard* item is not rendered.
- [ ] AC-3: The sync pill renders `online` and `offline` only, as a 6px dot (`--ready` online, `--blocked` offline) plus `--ink-2` text, with `role="status"`: in the sidebar footer and at the rail's foot, and on the phone as the offline strip under `.bar` (mockups-index *Not shown* #7).
- [ ] AC-4: The shell meets the UX floor and the feel-pass check (`docs/TASKS.md` § *The UX floor, for every UI task* and § *A feel-pass surface is checked more widely*): screenshots of each dashboard at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion` and `prefers-reduced-transparency` (glass falls back to solid `--surface`); the sidebar tooltips are hidden at rest; the `.bar` wordmark is a link of at least 24×24px.
- [ ] AC-5: `/watch` renders in the shell with one `<h1>` and an empty slate whose one action is *Save to inbox*. Visiting it sets the last-medium cookie to `watch`, and `/` then redirects to `/watch`. `scripts/perf/routes.mjs` measures it (tapped from `/comics` on `nav a[href="/watch"]`), with a budget in `budget.json` and ARCHITECTURE's Performance budget.
- [ ] AC-6: `design/mockups.html` gains an 834px and a 360px frame each for `home`, `spine`, `bdash` and `status`, drawn to the feel pass, and `design/mockups-index.md` lists them.

## Out of scope

- The route moves, the `/` redirect and its cookie, stale sessions, honest counts (TASK-026, 1.8c).
- The failed-write revert and its error toast, skeletons, row markup and the dashboard axe run (TASK-027, 1.8d).
- The thumb bar, its verbs, the mark storyboard and the toast's placement (1.8b).
- The offline queue and the sync pill's `queued` state (6.4).
- The sidebar collapse toggle (6.14), search and Ctrl K (6.1), and Settings (2.0). Their nav items stay `enabled: false`.
- /watch beyond the shell (8.x). Dashboard content (2.2, 2.4).

## Files likely touched

- `src/app/layout.tsx`: the shell and sprite.
- `src/components/nav/` (new): `NAV_ITEMS`, `MediaBar`, `NavRail`, `Sidebar`, `SyncPill`, `Icons` (sprite), `Shell`, `DashboardBar`.
- `src/components/AppNav.tsx`: deleted, replaced by the shell.
- `src/app/comics/(dash)/page.tsx`: the `.actionbar`. `src/app/watch/{page,loading}.tsx` (new). `src/lib/last-medium.ts`: `watch`.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json`, `docs/ARCHITECTURE.md` (Performance budget): `/watch`.
- `src/app/globals.css`: shell layout, rail, sidebar, glass, sticky stack, `--m-*` accents, `.unit`.
- `design/mockups.html`, `design/mockups-index.md`: 834px and 360px frames for `home`, `spine`, `bdash`, `status`.
- `test/e2e/shell.spec.ts` (new), `test/nav-items.test.tsx` (new, replacing `test/app-nav.test.tsx`), `test/sync-pill.test.tsx` (new).

## Verification

- Automated: `test/e2e/shell.spec.ts` on TASK-013's harness covers every measurement in AC-1, the live hrefs (AC-2) and reduced motion and transparency (AC-4). `test/nav-items.test.tsx` covers the `enabled` flip (AC-2). `test/sync-pill.test.tsx` covers AC-3.
- Manual: walk the Vercel preview at 360, 834 and 1280px → expected: the bar, rail and sidebar as drawn, and no dead nav item.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- TASK-005's *Remember the last run* for the app-wide *Add*: no comics route adds without a run, so comics *Add* ships `enabled: false`, and the item that builds the remembered run turns it on → docs/tasks/TASK-015-thumb-bar-contrast.md § Context (approved at plan)
- *Export* leaves the phone nav until Settings carries it (owner, 2026-10-19) → docs/TASKS.md § 2.0 (approved at plan)

## Plan

Provisional: depends on TASK-013 (the harness API: `test/e2e/helpers.ts`, the projects) and TASK-026 (the routes the nav links to). Re-plan if either changes those files.

Steps:
1. `src/components/nav/items.ts`: `NAV_ITEMS` holds the media (Comics `/comics`, Books `/books`, Watch `/watch`), each medium's items as LedgerNav draws them, the global Inbox `/inbox`, and the footer Search and Settings. Each item is `{ id, label, href, icon, enabled }`, and `visibleItems()` filters on `enabled`. Enabled: comics Dashboard, Runs (`/comics/runs`); books Add (`/books/add`); watch Dashboard; Inbox. Every other item, books Dashboard included (until 2.2), is `false`.
2. `src/components/nav/Icons.tsx`: an inline `<svg hidden>` `<symbol>` sprite (Lucide paths as LedgerNav draws them, stroke 1.5) plus `<Icon name>` (`<svg aria-hidden="true"><use href="#i-…"/>`). Lucide's ISC notice goes in `src/components/nav/LUCIDE-LICENSE.txt`.
3. `MediaBar`, under 768px: `.bar` with the wordmark (at least 24×24) and `<nav aria-label="Media">` with `aria-current="page"`. `NavRail`, 768–1023px: 72px, 56px items, an icon over an 11px label, the current item a `--raise` pill with a 3px `--m-*` bar. `Sidebar`: from 1024px the 64px icon rail with `aria-label` and a `data-tip` tooltip; from 1280px 224px wide, holding the media well, the items, a `--line` rule, `Inbox (N)` and the `SyncPill` footer. All read `visibleItems()` and take an optional `items` prop for tests. Client components, for `usePathname`. CSS media queries alone show and hide them, so nothing flashes.
4. `src/components/nav/Shell.tsx` (server) fetches `inboxCount` and lays out the bar, rail, sidebar, content box and children. `layout.tsx` renders it, and there is no shell on `/login`. `AppNav.tsx` is deleted; `test/app-nav.test.tsx` becomes `test/nav-items.test.tsx`.
5. `SyncPill.tsx` (client): `useSyncExternalStore` on `online` and `offline`; `<span role="status" class="sync"><i/>online</span>`.
6. `src/app/watch/page.tsx` (`requireUserId()`, `<h1>Watch</h1>`, an `.empty` slate reading *Nothing to watch yet* with a *Save to inbox* link to `/inbox`) and `watch/loading.tsx`. `last-medium.ts` `MEDIA` gains `watch`. `scripts/perf/routes.mjs` gains `watch`, with its budget copied from `inbox`'s and mirrored in ARCHITECTURE. `src/components/nav/DashboardBar.tsx` is the `.actionbar` with the owner's interim verb (Context), rendered by `comics/(dash)/page.tsx` and `watch/page.tsx`.
7. `globals.css`: the shell grid; `--bar-h` (64px phone, 80px from 1024px); glass `.bar` and `.side` per STYLE_GUIDE §8, with the fallback; `.rail`; the sidebar widths from `--rail-w` and `--side-w`; the tooltips (`--overlay`, `--sh-2`, a `--rule-2` ring, 12px to the right; after `--dur-4` on hover and at once on `:focus-visible`); the `--content-max` box centred beside the nav; the sticky stack; `.inbox-chip{display:none}` from 1024px; the `--m-*` current-item bar and `.unit`; `.actionbar` 48px at 768–1023px. The pre-v4 `.bar-inner` rules go.
8. `design/mockups.html`: an 834px and a 360px frame each for `home`, `spine`, `bdash`, `status` (new `data-w` widths), drawn from the feel pass and listed in `design/mockups-index.md`. Tick 1.8 in `docs/TASKS.md`.

Files: `src/app/layout.tsx`, `src/components/nav/{items.ts,Icons.tsx,MediaBar.tsx,NavRail.tsx,Sidebar.tsx,SyncPill.tsx,Shell.tsx,DashboardBar.tsx,LUCIDE-LICENSE.txt}`, `src/components/AppNav.tsx` (deleted), `src/app/comics/(dash)/page.tsx`, `src/app/watch/{page,loading}.tsx`, `src/lib/last-medium.ts`, `scripts/perf/{routes.mjs,budget.json}`, `docs/ARCHITECTURE.md`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/e2e/shell.spec.ts`, `test/nav-items.test.tsx`, `test/app-nav.test.tsx` (deleted), `test/sync-pill.test.tsx`, `test/redirect.test.ts`, `docs/TASKS.md`.

Test strategy:
- AC-1 → `test/e2e/shell.spec.ts`, one test per Check clause, run in the light and dark projects. The spec sets the 768, 834, 1100 and 1440 viewports itself. One test, `the media nav is identical on every phone route`, compares the nav's innerHTML with `aria-current` stripped.
- AC-2 → `test/nav-items.test.tsx` `a disabled item renders in no bar` (flip one item, render all three bars) and `the books Dashboard item is not rendered`; `shell.spec.ts` `every enabled href answers 2xx or 3xx`.
- AC-3 → `test/sync-pill.test.tsx` (happy-dom; dispatches `offline` and `online`): text, `role="status"`, the dot's class. `shell.spec.ts` `offline strip sits at --bar-h on the phone` uses `context.setOffline(true)`.
- AC-4 → `shell.spec.ts` screenshots each dashboard in every project. For reduced transparency it goes through CDP `Emulation.setEmulatedMedia`, and the `.bar` background then computes to `--surface`. Tooltips have opacity 0 at rest at 1280px, and the wordmark's box is at least 24×24.
- AC-5 → `shell.spec.ts` `/watch renders its h1 and slate`; `test/redirect.test.ts` gains `watch` (the proxy sets it on `/watch`, and `/` → `/watch`); `test/perf.test.ts`.
- AC-6 → manual: the eight frames render, and the index lists them.

Risks / open questions:
1. Settled (owner, 2026-10-19): *Export*, in today's nav and in no drawn one, becomes a plain, unprefetched link at the sidebar and rail foot. The phone loses it until Settings (2.0).
2. The books set as drawn has no list item. Until 2.2, `/books/list` is reached through the media switch, since `/books` redirects there.
3. Playwright can't emulate `prefers-reduced-transparency` directly. The CDP route is Chromium-only, which is all the harness runs.

Size check: L, about 25 files: the layout and nav components, their CSS and the mockup frames. No schema. Attended.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
