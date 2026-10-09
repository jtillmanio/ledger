---
id: TASK-014
title: 1.8 App shell
status: Draft
depends_on: [TASK-013]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-014 — 1.8 App shell

## Goal

Every screen sits in the same chrome: a media bar on the phone, a navigation rail on a tablet, a sidebar on desktop. Opening the app lands on the medium you last used, and nothing in the nav leads to a screen that doesn't exist yet.

## Context

- Roadmap: `docs/TASKS.md` § 1.8 App shell (sitting 6, after 0.11). It was split from 1.8b by R3-12: this is the shell (nav, redirect, sync pill, skeletons, markup rules), and 1.8b is the thumb bar and the contrast checks. The roadmap entry, its widths table, *The tablet as drawn*, *The desktop as drawn* and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the layout, the three navigation forms, the `/` redirect and its cookie, the route moves (`/books` → `/books/list`, the run list → `/comics/runs`), skeletons, the icon sprite, the error toast (R1-07), and the mockup's new 834px and 360px frames.
- Architecture: `docs/ARCHITECTURE.md` § 4. Interface (the route table; *One dashboard per medium*). `.claude/rules/ui.md` (one phone bar; hover behind `(pointer:fine)`; one dashboard per medium).
- Design: STYLE_GUIDE §7–§9 and §14.5–§14.6; `design/LedgerDesktop.dc.html`, `design/LedgerNav.dc.html`; `design/Ledger Feel Review.dc.html` §10c (tablet) and §11 (desktop); PNGs in `design/screenshots/desktop/`. Mockups `home`, `spine`, `bdash`, `status` gain an 834px tablet frame and a 360px frame (`ui.redrawFiles`).
- Decisions: D-33 (breakpoints 768, 1024, 1280; the tablet rail), D-25b (the run detail keeps the bottom bar), D-40 (FP-D5 titles, FP-D16 inbox count in the sidebar), D-24b (identity hues), R1-06 (nav renders only routes that exist: one `NAV_ITEMS` list with `enabled`), R1-07 (a failed write reverts and raises the error toast with *Retry*), R1-13 (last-touched medium is a cookie, not `localStorage` or a column), R2-05, R2-06, R2-08 and S-L6 (the list screens keep their honest counts when they move), R2-11 (a stale session goes to `/login`), UX-N05, UX-N07–N09.
- Picks up from TASK-009: the sidebar's global `Inbox (N)` links to `/inbox`, and this task asserts that half of 1.4b's check.
- Icons: Lucide outline at 1.5px, as an inline SVG `<symbol>` sprite in the layout (keep its ISC notice). Not under `public/`, because the passcode gate covers it. Nothing from a CDN.
- **Open question for the owner:** 1. Today `/books` *is* the master list, but the route table makes it the books dashboard, which 2.2 builds. Between this task and 2.2, the draft redirects `/books` to `/books/list` and gives the books nav *Dashboard* item `enabled: false`. The alternative is a minimal dashboard holding *Reading now*.
- Next.js 16: the gate is `src/proxy.ts`, and `cookies()` is async. Read `node_modules/next/dist/docs/` before writing the redirect.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): screenshot at 360px, 768px, 834px and 1280px; assert no horizontal scroll exists at any of them. At 768px and 834px the page renders the navigation rail, no top media bar and no sidebar; each rail item shows a visible text label and is at least 56px tall; every dashboard renders `.actionbar`, 48px tall. The rendered HTML references no external host for an icon, font or script, and every `<svg>` inside a button is `aria-hidden` while the button has a name. At 1100px the sidebar is 64px wide, each item has an accessible name, and focusing an item from the keyboard shows its tooltip at once. At 1280px the sidebar is 224px wide; at 1440px the content box is 1056px wide and centred in the space beside it. At 1024px and up no dashboard renders the *in inbox* chip and the sidebar's Inbox shows the count. At 360px *Watch* renders untruncated in the media bar, and the phone `/comics` has at most one solid `--brand` fill above the fold. No computed `color` inside `.bar` or `.side` equals `--ready`. With the page scrolled 400px, every sticky element other than `.bar` has a computed `top` of at least `--bar-h`. The rendered HTML contains no U+26B2. Test that `/` redirects to the last-touched medium and to `/comics` for a user with no history. Test that every phone route renders exactly the same media nav. Test that a request carrying a garbage `rt_session` cookie redirects a page to `/login` and answers a route handler 401 (R2-11). An axe-core run over each dashboard reports no `nested-interactive`, `button-name` or `link-name` violations.
- [ ] AC-2: Both bars render from one `NAV_ITEMS` list. An item with `enabled: false` renders nowhere: a test flips one item and asserts it disappears from the phone bar, the rail and the sidebar. Every enabled item's `href` resolves to an existing route (a test requests each and gets neither a 404 nor a 500).
- [ ] AC-3: `/books/list` prints the query's total (*N of M*), not the row count, and keeps the *No year* chip. The comics run list at `/comics/runs` prints the real total beside a limited list. A render test asserts the printed total equals the query's `total` for a fixture where the two differ. The comics dashboard moves from `/` to `/comics`. Until 2.2 builds the books dashboard, `/books` behaves as the owner settles in open question 1, and no link points at a page that 404s.
- [ ] AC-4: A spine tick whose write fails (mocked 500) reverts the tick and raises an error toast with *Retry*. *Retry* re-sends the same request, and a success then ticks the row. The sync pill renders `online` and `offline` only, as a 6px dot plus `--ink-2` text, with `role="status"`.
- [ ] AC-5: Skeletons for the telecard, run rows, plan rail and season rows render at the loaded geometry (a test compares the skeleton's box to the loaded component's at 360px within 2px), and their shimmer stops under `prefers-reduced-motion`.
- [ ] AC-6: The shell meets the UX floor and the feel-pass check (`docs/TASKS.md` § *The UX floor, for every UI task* and § *A feel-pass surface is checked more widely*): screenshots of each dashboard at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion` and `prefers-reduced-transparency` (glass falls back to solid `--surface`); hover reveals hidden at rest with a fine pointer at 1280px; one `<h1>` per page; a navigable row is `<article class="row"><a class="row-link">` with secondary buttons outside the anchor.

## Out of scope

- The thumb bar, its verbs, the mark storyboard and the toast's placement (1.8b).
- The offline queue and the sync pill's `queued` state (6.4).
- The sidebar collapse toggle (6.14), search and Ctrl K (6.1), and Settings (2.0). Their nav items stay `enabled: false`.
- /watch beyond the shell (8.x). Dashboard content (2.2, 2.4).

## Files likely touched

- `src/app/layout.tsx`: shell, sprite, sync pill, media nav.
- `src/components/nav/` (new): `NAV_ITEMS`, `MediaBar`, `NavRail`, `Sidebar`, `SyncPill`, `Icons` (sprite).
- `src/app/page.tsx` → `/` redirect handler. `src/app/comics/page.tsx` (new dashboard home), `src/app/comics/runs/page.tsx` (moved list), `src/app/books/list/page.tsx` (moved list), `src/app/watch/page.tsx` (shell only).
- `src/lib/last-medium.ts` (new): the cookie.
- `src/components/Skeleton.tsx`, the `loading.tsx` files.
- `src/components/IssueRow.tsx` and `src/components/Undo.tsx`: the R1-07 revert and the error toast.
- `src/app/globals.css`: shell layout, rail, sidebar, glass, sticky stack, `--m-*` accents, `.unit`, `--g1`–`--g8`.
- `scripts/perf/routes.mjs` and `scripts/perf/budget.json`: the moved routes.
- `design/mockups.html`, `design/mockups-index.md`: 834px and 360px frames for `home`, `spine`, `bdash`, `status`.
- `test/e2e/shell.spec.ts` (new), `test/nav-items.test.ts` (new), `test/redirect.test.ts` (new), `test/loading-states.test.tsx`.

## Verification

- Automated: `test/e2e/shell.spec.ts` on TASK-013's harness covers every measurement in AC-1, the axe run, skeleton geometry and reduced motion and transparency (AC-1, AC-5, AC-6). `test/nav-items.test.ts` covers the `enabled` flip and live hrefs (AC-2). `test/redirect.test.ts` covers the cookie redirect and the garbage-cookie 401 and redirect (AC-1). Render tests cover the honest totals (AC-3) and the failed-write revert (AC-4). Lighthouse on the preview, with the moved routes in `scripts/perf/routes.mjs`.
- Manual: walk the Vercel preview at 360, 834 and 1280px → expected: the bar, rail and sidebar as drawn, `/` landing on the last medium, and no dead nav item.

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
