---
id: TASK-014
title: 1.8 App shell
status: Done
depends_on: [TASK-013, TASK-026]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: b1252ce
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
- *From TASK-026 (1.8c, PR #108):* the nav must not prefetch a redirect. `/` (a route handler) and `/books` (a redirect to `/books/list` until 2.2) both redirect, and with the old nav prefetching them, four tap runs from `/comics` and `/comics/runs` never reached network idle on the preview (`AppNav` now links `/books/list` and gives `/` `prefetch={false}`; `test/app-nav.test.tsx` pins both). The new `NAV_ITEMS` should link Books at `/books/list` until 2.2 builds the dashboard, and keep the home link unprefetched (arrived after the plan was approved).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): screenshot at 360px, 768px, 834px and 1280px; assert no horizontal scroll exists at any of them. At 768px and 834px the page renders the navigation rail, no top media bar and no sidebar; each rail item shows a visible text label and is at least 56px tall; every dashboard renders `.actionbar`, 48px tall. The rendered HTML references no external host for an icon, font or script, and every `<svg>` inside a button is `aria-hidden` while the button has a name. At 1100px the sidebar is 64px wide, each item has an accessible name, and focusing an item from the keyboard shows its tooltip at once. At 1280px the sidebar is 224px wide; at 1440px the content box is 1056px wide and centred in the space beside it. At 1024px and up no dashboard renders the *in inbox* chip and the sidebar's Inbox shows the count. At 360px *Watch* renders untruncated in the media bar, and the phone `/comics` has at most one solid `--brand` fill above the fold. No computed `color` inside `.bar` or `.side` equals `--ready`. With the page scrolled 400px, every sticky element other than `.bar` has a computed `top` of at least `--bar-h`. The rendered HTML contains no U+26B2. Test that every phone route renders exactly the same media nav.
- [x] AC-2: Both bars render from one `NAV_ITEMS` list. An item with `enabled: false` renders nowhere: a test flips one item and asserts it disappears from the phone bar, the rail and the sidebar. Every enabled item's `href` resolves to an existing route (a test requests each and gets neither a 404 nor a 500). The books *Dashboard* item is not rendered.
- [x] AC-3: The sync pill renders `online` and `offline` only, as a 6px dot (`--ready` online, `--blocked` offline) plus `--ink-2` text, with `role="status"`: in the sidebar footer and at the rail's foot, and on the phone as the offline strip under `.bar` (mockups-index *Not shown* #7).
- [x] AC-4: The shell meets the UX floor and the feel-pass check (`docs/TASKS.md` § *The UX floor, for every UI task* and § *A feel-pass surface is checked more widely*): screenshots of each dashboard at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion` and `prefers-reduced-transparency` (glass falls back to solid `--surface`); the sidebar tooltips are hidden at rest; the `.bar` wordmark is a link of at least 24×24px.
- [x] AC-5: `/watch` renders in the shell with one `<h1>` and an empty slate whose one action is *Save to inbox*. Visiting it sets the last-medium cookie to `watch`, and `/` then redirects to `/watch`. `scripts/perf/routes.mjs` measures it (tapped from `/comics` on `nav a[href="/watch"]`), with a budget in `budget.json` and ARCHITECTURE's Performance budget.
- [x] AC-6: `design/mockups.html` gains an 834px and a 360px frame each for `home`, `spine`, `bdash` and `status`, drawn to the feel pass, and `design/mockups-index.md` lists them.

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
- The dashboards' interim `.actionbar` verb repeats the slate's own *Save to inbox* on `/watch`; 1.8b replaces the bar's contents → docs/tasks/TASK-015-thumb-bar-contrast.md § Context
- The desktop page-header band (the `h1` and the dashboard verbs, sticky glass at `--bar-h`) is left to 1.8b; `.bar` is the phone media bar only → docs/tasks/TASK-015-thumb-bar-contrast.md § Context
- Candidate decision: the shell sends all three navs and CSS chooses; the Inbox count streams in a `<Suspense>` outside the per-page query budget → docs/review/decisions.md § D-77 (approved at close-out)
- AC-6's tablet frames carry the shell's geometry and reflow the phone body; redrawing the four bodies to the feel pass is next (owner, 2026-10-20) → docs/TASKS.md § 1.8e (new)
- The feel-pass tablet PNG draws an italic *L* at the top of the rail; this rail has none, since the Check wants no top bar and a link there would be a second 56px-rule exception → not tracked: the owner's call at the preview walk
- The shell added no gated bytes over budget: on the preview `/comics` is 23.1 KB against 28 KB and `/watch` 9.8 KB against the 11 KB copied from `/inbox`, so no budget moved → not tracked: nothing to do, Lighthouse is within budget on the preview

## Plan

Re-planned 2026-10-20 at `b1252ce` (after 1.8a, 0.11 and TASK-026 merged); approved by the owner with the defaults below.

Steps:
1. `src/components/nav/items.ts`: one `NAV_ITEMS` list of `{ id, label, href, icon, enabled, plain? }` and `visibleItems()`. Enabled: Comics `/comics`, Books `/books/list`, Watch `/watch`, comics Dashboard and Runs, books Add, watch Dashboard, Inbox `/inbox`, and Export (a plain `<a href="/api/export">` at the rail and sidebar foot). Every other item, books Dashboard included, is `false`. The home link is `prefetch={false}`.
2. `Icons.tsx`: inline `<symbol>` sprite (Lucide paths as LedgerNav draws them, stroke 1.5) and `<Icon>` (`aria-hidden`); `LUCIDE-LICENSE.txt`.
3. Three navs from `visibleItems()`, client components (`usePathname`), none rendered on `/login`: `MediaBar` (the phone `.bar`, under 768px; wordmark at least 24x24; `aria-current`; `--m-*` underline), `NavRail` (768-1023px, 72px, 56px items, icon over 11px label), `Sidebar` (one DOM from 1024px: 64px icon rail with `aria-label` and tooltip, 224px with labels from 1280px). Rail and sidebar are `position:fixed`, so nothing but `.bar` sticks near the top.
4. `Shell.tsx` (server) lays out nav and a centred `.content` box. The Inbox count is an async server component inside `<Suspense>`, so a cold database never delays a skeleton. `layout.tsx` renders it; `AppNav.tsx` is deleted.
5. `SyncPill.tsx` (client): `online`/`offline`, `role="status"`, 6px dot; a pill in the sidebar and rail foot, an offline strip at `top: var(--bar-h)` on the phone.
6. `/watch` (`page.tsx`: one `h1`, *Nothing to watch yet* slate, *Save to inbox*; `loading.tsx`); `watch` joins `MEDIA`; perf route tapped from `/comics`, a budget row, and ARCHITECTURE's Performance budget. `DashboardBar.tsx` is the 48px `.actionbar` with the owner's interim verbs; the comics dashboard reuses `reading[0]` (no new query).
7. `globals.css`: shell layout, `--bar-h` (64px phone, 80px from 1024px), glass `.bar`/`.side` with fallbacks, rail, sidebar, tooltips, `.content` (1056px, centred beside the nav), `.inbox-chip` hidden from 1024px, `--m-*` accents, `.unit`, 48px `.actionbar` at tablet width; fix the run page's 360px overflow; delete the pre-v4 `.bar-inner` and `.bar .tab` rules.
8. `design/mockups.html` and `mockups-index.md`: 834px and 360px frames for `home`, `spine`, `bdash`, `status`. Tick 1.8 in `docs/TASKS.md`.

Files: `src/app/layout.tsx`, `src/components/nav/{items.ts,Icons.tsx,MediaBar.tsx,NavRail.tsx,Sidebar.tsx,SyncPill.tsx,Shell.tsx,DashboardBar.tsx,LUCIDE-LICENSE.txt}`, `src/components/AppNav.tsx` (deleted), `src/app/comics/(dash)/page.tsx`, `src/app/comics/[runId]/page.tsx` (360px row), `src/app/watch/{page,loading}.tsx`, `src/lib/last-medium.ts`, `scripts/perf/{routes.mjs,budget.json}`, `docs/ARCHITECTURE.md`, `src/app/globals.css`, `design/mockups.html`, `design/mockups-index.md`, `test/e2e/shell.spec.ts`, `test/nav-items.test.tsx`, `test/app-nav.test.tsx` (deleted), `test/sync-pill.test.tsx`, `test/redirect.test.ts`, `test/query-budget.test.ts` (if needed), `docs/TASKS.md`.

Test strategy:
- AC-1 -> `test/e2e/shell.spec.ts`, one test per Check clause (768, 834, 1100 and 1440 viewports set by the spec); `the media nav is identical on every phone route` compares the nav's innerHTML with `aria-current` stripped.
- AC-2 -> `test/nav-items.test.tsx` `a disabled item renders in no bar` and `the books Dashboard item is not rendered`; `shell.spec.ts` `every enabled href answers 2xx or 3xx`.
- AC-3 -> `test/sync-pill.test.tsx` (text, `role="status"`, dot); `shell.spec.ts` offline strip via `context.setOffline(true)`.
- AC-4 -> `shell.spec.ts` screenshots each dashboard in every project; reduced transparency via CDP `Emulation.setEmulatedMedia`; tooltips at rest; wordmark box at least 24x24.
- AC-5 -> `shell.spec.ts` `/watch renders its h1 and slate`; `test/redirect.test.ts` gains `watch`; `test/perf.test.ts`.
- AC-6 -> manual: the eight frames render, and the index lists them.

Risks / open questions (settled by the owner, 2026-10-20):
1. `.bar` is the phone media bar only. The desktop page-header band (h1 plus verbs) is 1.8b's; `--bar-h` is still 80px from 1024px for the sticky stack.
2. The shell's Inbox count adds one row-count query per page, in `Suspense`, outside the per-page budget; documented in ARCHITECTURE.
3. *Export* leaves the phone nav (owner, 2026-10-19). Playwright can't emulate `prefers-reduced-transparency` directly; the CDP route is Chromium-only, which is all the harness runs.

Size check: L, about 25 files, no schema. Attended.

## Review log

Verify R1 FAIL(1: the scroll check ran on a page too short to scroll) → R2 PASS | Audit R1 CHANGES(2: the long-label fixture rendered `Resume #112`; the in-inbox check could pass before the page streamed in) → R2 PASS | Spec R1 CHANGES(3: AC-3 sidebar pill, AC-4 reduced-transparency screenshots, `/watch` missing from the query budget) → R2 APPROVE | UI R1 PASS (7 low-severity notes; the 14px sidebar wordmark link and the rail's `0 Inbox` name order fixed)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (spec), 1 (UI)
- First-pass AC FAILs: 2 (AC-3 and AC-4 each partly untested)
- Plan revisions after approval: 1, not asked in advance: `ShellFrame.tsx` (the `/login` check needs a client wrapper), `NavLink.tsx` and `InboxCount.tsx` were split out of the files the plan named; reported at close-out
