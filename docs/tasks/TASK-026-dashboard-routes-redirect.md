---
id: TASK-026
title: 1.8c Dashboard routes and the / redirect
status: Review
depends_on: [TASK-013]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4bba78a
---

# TASK-026 — 1.8c Dashboard routes and the / redirect

## Goal

The comics dashboard lives at `/comics` and the lists sit one level down (`/comics/runs`, `/books/list`). Opening the app lands on the medium you last used. A stale session goes to sign-in, and the list counts stay honest after the move.

## Context

- Roadmap: `docs/TASKS.md` § 1.8c Dashboard routes and the `/` redirect, plus three paragraphs of § 1.8 that are this task's contract: *A stale session goes to `/login`*, *The list screens keep R2's honest counts* and *Last-touched medium is a cookie*. Split out of TASK-014 (1.8) by the owner, 2026-10-19, and built before it, so the nav only ever links to routes that exist. Sitting 6: 0.11 → **1.8c** → 1.8 → 1.8d → 1.8b.
- Architecture: `docs/ARCHITECTURE.md` § 4. Interface (the route table; *One dashboard per medium*). `.claude/rules/ui.md` (one dashboard per medium; list screens one level down).
- Decisions: R1-13 (the last-touched medium is a cookie, not `localStorage` or a column), R2-05, R2-06, R2-08 and S-L6 (honest counts), R2-11 (a stale session goes to `/login`; route handlers answer 401).
- **Settled by the owner, 2026-10-09:** `/books` is the master list today, but the route table makes it the books dashboard, which 2.2 builds. Until then `/books` redirects to `/books/list`. 2.2 removes the redirect.
- **Settled by the owner, 2026-10-19:** `src/proxy.ts` writes the cookie on any `/comics`, `/books` or `/watch` request, because a Next 16 server component can't set a cookie.
- The v1 home page's *Coming out* section (books releases) doesn't move to `/comics`: it is 2.x's `/books/releases` (`docs/TASKS.md`, the item that says the page goes when 1.8c makes `/` a redirect).
- Next.js 16: the gate is `src/proxy.ts`, and `cookies()` is async. Read `node_modules/next/dist/docs/` before writing the redirect and the proxy cookie.
- `/watch` is TASK-014's (1.8), because its nav is the first thing to link to it, and every perf route needs a tap (`scripts/perf/routes.d.mts`). Until then, the cookie and the redirect know only `comics` and `books`.
- `test/loading-states.test.tsx` forbids a `loading.tsx` at `src/app/comics/`, which would wrap `[runId]`. So the dashboard sits in a route group, `comics/(dash)/`.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): Test that `/` redirects to the last-touched medium and to `/comics` for a user with no history. Test that a request carrying a garbage `rt_session` cookie redirects a page to `/login` and answers a route handler 401 (R2-11). A render test asserts that `/books/list` and `/comics/runs` print the query's total, not the row count, for a fixture where the two differ, and no same-origin link on any page answers 404.
- [x] AC-2: The comics dashboard renders at `/comics` and links to *All runs* (`/comics/runs`). The run list renders at `/comics/runs` with its filter chips pointing there. `/books/list` is the master list with its *No year* chip. `/books` answers a redirect to `/books/list`. A run page's back link goes to `/comics/runs`.
- [x] AC-3: A signed-in request to any `/comics` or `/books` path sets the `ledger_medium` cookie (`httpOnly`, `SameSite=Lax`, path `/`, one year), except a `<Link>` prefetch (a request carrying `next-router-prefetch` or `next-router-segment-prefetch`), which leaves it alone (D-76; owner, 2026-10-20). A request elsewhere (`/inbox`) and a signed-out request leave it alone. An unknown value redirects `/` to `/comics`. Nothing is written to `localStorage`, and there is no schema change.
- [ ] AC-4: `scripts/perf/routes.mjs` follows the moves. `comics` measures the dashboard, `books` measures `/books` through its redirect, the run taps start from `/comics/runs`, and a new `runs` route measures `/comics/runs`. Each has a budget in `scripts/perf/budget.json`, mirrored in `docs/ARCHITECTURE.md`'s Performance budget. `test/perf.test.ts` passes, and Lighthouse is green on the preview.
- [x] AC-5: The moved screens meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): each keeps a loading skeleton at its new path, and no skeleton wraps a run page. Screenshots of `/comics`, `/comics/runs` and `/books/list` at each `ui.viewports` width, light and dark.

## Out of scope

- The navigation chrome: bar, rail, sidebar, sync pill (TASK-014, 1.8).
- Row markup, skeleton geometry and the dashboard axe run (TASK-027, 1.8d).
- `/watch` (TASK-014). The books dashboard (2.2) and `/books/releases` (2.x).

## Files likely touched

- `src/app/page.tsx` → `src/app/comics/(dash)/page.tsx` plus a new `loading.tsx`; `src/app/route.ts` (new).
- `src/app/comics/(list)/{page,loading}.tsx` → `src/app/comics/runs/`; `src/app/comics/[runId]/page.tsx`.
- `src/app/books/{page,loading}.tsx` → `src/app/books/list/`; `src/app/books/page.tsx` (new, the redirect).
- `src/lib/last-medium.ts` (new), `src/proxy.ts`.
- `src/components/AppNav.tsx`, `src/components/AddBooks.tsx`: links follow the moves.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json`, `docs/ARCHITECTURE.md` (the Performance budget table).
- `test/redirect.test.ts` (new), `test/list-totals.test.tsx` (new), `test/e2e/routes.spec.ts` (new); path updates in the tests that import the moved pages.

## Verification

- Automated: `test/redirect.test.ts` covers the redirect and the cookie (AC-1, AC-3). `test/list-totals.test.tsx` covers the totals (AC-1). `test/e2e/routes.spec.ts` covers the garbage session, the link crawl and the new routes (AC-1, AC-2). `test/perf.test.ts` covers AC-4.
- Manual: open `/` after visiting Books → expected: Books. Then open `/` in a fresh profile → expected: `/comics`.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The roadmap and the review ledger already said the proxy writes the cookie (main, 2026-10-19). Neither said a `<Link>` prefetch must not: Next hides `next-router-prefetch` from `proxy()`, so the matcher skips prefetches (owner, 2026-10-20) → docs/TASKS.md § 1.8 (fixed in this PR)
- Same prefetch rule in the ledger's R1-13 row → docs/review/LEDGER.md § R1-13 (fixed in this PR)
- ARCHITECTURE § 4's route table and Performance budget follow the moves: `/`'s cookie, `/comics` today, `/books` redirecting until 2.2, query counts, `loading.tsx` list, `/comics` and `/comics/runs` budget rows → docs/ARCHITECTURE.md § 4. Interface and § 5. Operational posture (approved at close-out)
- The comics dashboard's perf budget (20,000 document + RSC bytes) is provisional until its first preview's Lighthouse run → not tracked: done in this PR (plan revision), set from the PR's Lighthouse comment before the PR is marked ready
- The dashboard's *All runs* link is a plain `<p class="small">` link, not the `h3.s .more` quiet link: the section heads are `h2` today and an `h3` would skip a level → not tracked: 1.8 draws the quiet links (SG-D6, LEDGER UX-N19)
- `upcomingReleases()` is no longer called by any page; the query stays for `/books/releases` → not tracked: already tracked in docs/TASKS.md (the item that says the page goes when 1.8c makes `/` a redirect)
- `MEDIA` in `src/lib/last-medium.ts` needs `watch`, and `test/redirect.test.ts` pins it to `["comics", "books"]` → not tracked: already in docs/tasks/TASK-014-*.md § Context and its plan (it edits that test)
- Candidate decision: the proxy's matcher skips `<Link>` prefetches so they never write `ledger_medium` (owner chose this over `prefetch={false}` on the nav, 2026-10-20) → docs/review/decisions.md § D-76 (approved at close-out)
- The run page `/comics/cap-origin` scrolls sideways at 360, 390 and 412px on the dev data (`scrollWidth` 450; a row's `a.btn.sec.sm` + `.menu-wrap` + `button.more` run past the edge); this diff only changed the back link's href, and it was not checked on `main` → docs/tasks/TASK-027-failed-writes-skeletons-markup.md § Context

## Plan

Provisional: depends on TASK-013 (`routes.spec.ts` runs on its harness).

Steps:
1. Moves, with `git mv`. `src/app/page.tsx` → `src/app/comics/(dash)/page.tsx`, plus a `loading.tsx` on today's `ListSkeleton` (1.8d sets the geometry). `comics/(list)/*` → `comics/runs/*`. `books/{page,loading}.tsx` → `books/list/*`. The dashboard drops its *Coming out* section and the `upcomingReleases()` call; the query stays for 2.x.
2. Links follow. The run-list chips `/comics?…` → `/comics/runs?…`. The books chips `/books?…` → `/books/list?…`. The dashboard's `/comics?readiness=ready_hard` → `/comics/runs?readiness=ready_hard`, and it gains an *All runs* link (`h3.s .more`, SG-D6's quiet link). The run page's *All runs* → `/comics/runs`. `AddBooks` `/books` → `/books/list`. `AppNav` keeps its five links: *Ledger* → `/`, *Comics* → `/comics`, *Books* → `/books`, *Inbox*, *Export*.
3. `src/app/books/page.tsx`: `redirect("/books/list")`.
4. `src/lib/last-medium.ts`: `MEDIUM_COOKIE = "ledger_medium"`, `MEDIA = ["comics", "books"]` (TASK-014 adds `watch`), `mediumOf(pathname)` (a medium or `null`) and `pickMedium(value)` (else `comics`). `src/proxy.ts`: when `rt_session` is present and `mediumOf` is set, set the cookie on the `NextResponse.next()` it already returns. `src/app/route.ts` `GET` answers 307 to `/${pickMedium(req.cookies.get(MEDIUM_COOKIE)?.value)}`; with no page at `/`, nothing renders there.
5. `scripts/perf/routes.mjs`. `comics` keeps path `/comics`, now the dashboard. `books` keeps path `/books`, which `perf.test` needs for a top-level page; Lighthouse follows the redirect. The run taps start `from: "/comics/runs"`. A new `runs` route measures `/comics/runs`, tapped from `/comics` on its *All runs* link, and takes the old `comics` budget (it is the screen that budget was set on). `comics` gets the measured dashboard figure, with the reason given in ARCHITECTURE's Performance budget table, which mirrors `budget.json` row for row.
6. (Revision, owner-approved 2026-10-20) `src/proxy.ts`'s matcher gets `missing: next-router-prefetch, next-router-segment-prefetch`, so a `<Link>` prefetch never writes the cookie. `test/health.test.ts` reads `matcher[0].source`; `test/redirect.test.ts` and `routes.spec.ts` prove it.
7. Update the imports in `test/{add-book,inbox,query-budget,release,resume-pointer,loading-states}.test.*`. `loading-states` lists the new paths and keeps its *no `src/app/comics/loading.tsx`* test. Tick 1.8c in `docs/TASKS.md`.

Test strategy:
- AC-1 → `test/redirect.test.ts`: `GET /` with `ledger_medium=books` answers 307 to `/books`; with no cookie, or with `bogus`, to `/comics`. `test/e2e/routes.spec.ts` `a garbage session goes to /login and gets 401` (`request.get` with `Cookie: rt_session=garbage`, `maxRedirects: 0`): `/comics` → 307 to `/login`, `/api/export` → 401. `test/list-totals.test.tsx` (queries mocked): `/books/list` with 2 rows of `total` 5 prints *2 of 5*, and `/comics/runs` with a filter that shows 2 of 5 prints *2 of 5 shown*. `routes.spec.ts` `no same-origin link answers 404` visits every page route and requests each `a[href^="/"]`.
- AC-2 → `routes.spec.ts`: each route's h1; `/books` → `/books/list`; the dashboard's *All runs* link; the run page's back link.
- AC-3 → `redirect.test.ts`: `proxy()` on `/books/list` with `rt_session` sets `ledger_medium=books` with the attributes; on `/inbox`, or without a session, it sets nothing.
- AC-4 → `test/perf.test.ts`; manual: Lighthouse on the preview.
- AC-5 → `test/loading-states.test.tsx` on the new paths; manual: ui-verifier screenshots.

Risks / open questions:
- `/comics/runs` (static) outranks `/comics/[runId]`, so a run with the id `runs` couldn't be opened. None exists today, and run ids are hand-authored slugs.
- The dashboard at `/comics` replaces the run list in the `comics` budget. Its first Lighthouse figures set the new number, and the reason goes in ARCHITECTURE.

Size check: M. About 20 files, most of them `git mv` renames and link edits. Two layers (routing and pages), no schema. Attended.

## Review log

Verify R1 PASS | Audit R1 PASS (AC-4 specifics unpinned → pinned in `perf.test.ts`) | Spec R1 CHANGES (link crawl skipped the add pages and /login; ARCHITECTURE route-table edit needed approval) → fixed, approved at close-out | UI R1 PASS (the run page's phone-width overflow is not this diff's: follow-up to TASK-027) | Schema: not run (no migration, schema, view, query or ETL change)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1 (spec-reviewer CHANGES, fixed in place)
- First-pass AC FAILs: 0 (one UNTESTED part of AC-1's link crawl)
- Plan revisions after approval: 1 (the proxy's matcher skips prefetches, owner-approved; the tests that import the moved pages also gained `year-chips`, `health` and `series-list`)
