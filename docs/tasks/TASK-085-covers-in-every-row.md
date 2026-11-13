---
id: TASK-085
title: 4.3 Covers in the UI (1 of 3) — real covers in every row: the spine, the Library and the next-issue strip
status: Ready
depends_on: [TASK-027, TASK-003]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-085 — 4.3 Covers in the UI (1 of 3) — real covers in every row: the spine, the Library and the next-issue strip

## Goal

Every spine row, Library row and the next-issue strip shows the real cover in a fixed box, or a plain placeholder in the same box when there is none, so a cover arriving never moves a row.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.3 Covers in the UI (M16; no dependency in the tasklist; after the books cutover, D-139). The entry and its **Check:** are the contract. Feature F-33. The tasklist sizes it S; the entry's spine, feel-pass, setting and measurement work is past S, so it is split (`workflow.splitPolicy: split`).
- **Split, 1 of 3.** This part: one cover box for every row. TASK-086 puts covers at the feel-pass sizes on the dashboards; TASK-087 adds *Show covers* and `prefers-reduced-data`, and its merge ticks the entry.
- **What exists** (*From 1.4c, TASK-008*): `src/components/Cover.tsx` draws `data-enrich="pending"` and its *metadata pending* line on the spine (an issue with no `metron_id`), the Library (a book with no `open_library_id` or `hardcover_id`) and the Add search results; a spine row gets a cover box only when pending, and a Library row with no cover draws none. A real cover is an `<img>` 40×60. `src/components/NextStrip.tsx` stands the issue number in for a cover (*Real covers arrive with 4.3*). The spine query already selects `issues.cover_url` (`src/db/queries.ts`), as does `listBooks`.
- **The box** (STYLE_GUIDE § 9 *Cover in a row*; mockups `spine`, `krakoa`, `states` → *Covers in a row*): fixed 28×42, and 20×30 in compact (`--cv-row-w` / `--cv-row-h` in `src/app/globals.css`, SG-D13), keeping the 48px row; radius `--r-cell` and a 1px inset `--rule` ring. The `<img>` has `loading="lazy"`, `decoding="async"`, explicit `width` and `height`, and `alt=""`. A cover never glows and is never tinted.
- **States**: loading is a `--sunk` skeleton of the same box; no `cover_url` gives the neutral placeholder (UX-X05, M-01, L-01): `--sunk` with mono text in `--muted` and a faint ring (dark: white at 10%), the issue number on the spine (`141`, `GN5`; SG-D14 moved the ordinal to the gutter) and the initials on a book; a freeform row keeps `data-enrich="pending"`. The mockup's `.k1`–`.k8` gradient covers, the red `.k2` included, go. A row carries its track or genre hue once: the `.edge` stripe or the tag, never both.
- *From 1.8d (TASK-027)*: `/books/list`'s loading screen draws run rows; when Library rows get covers, its skeleton draws that geometry.
- **Sources**: comics `issues.cover_url` (Metron's image, via `etl/data/issue_details.csv`, never hand-entered); books `books.cover_url`, Hardcover's image URL, hotlinked (D-94). *From TASK-040 (1.4f)*: a library book's Open Library cover URL can redirect to archive.org and fail; count such books when measuring.
- **Stop and ask at plan time: hotlink or cache.** Hotlinking makes a page render depend on Metron's and Hardcover's image servers; `next/image` with a `remotePatterns` entry has Vercel cache small resized copies, at a config change and a cost. Read `node_modules/next/dist/docs/` for the version-16 image API first. This part measures the Library's Lighthouse run either way; poor loading moves covers to R2 under a later decision (D-94).
- Design: `design/mockups.html` (`spine`, `blist`, `states`), `design/STYLE_GUIDE.md` § 9; `ui.redrawFiles` get the placeholder change in the same PR (the gradient covers go from the frames).
- Decisions: D-40, D-94, SG-D13, SG-D14, UX-X05, M-01, L-01. Hard rule 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the row clauses: CLS under 0.1 on the books page, no placeholder gradient or identity hue, no row with both an `.edge` and a `.tag .sq`, the spine's `<img loading="lazy" alt="">` in a 28×42 box and the issue number in the same box, no height change on a swap (CLS under 0.1 on a 381-row spine), and no cover `box-shadow` resolving to `--halo`. TASK-087 proves the zero-request clause): Lighthouse CLS under 0.1 on the books page. No cover placeholder
renders a gradient or an identity hue, and no row renders both an `.edge` and a
`.tag .sq`. On the spine, a row whose issue has a `cover_url` renders one
`<img loading="lazy" alt="">` inside a 28×42 box, and a row without one renders
the issue number in the same box. Swapping one for the other changes no row's
height (CLS under 0.1 on a 381-row spine). With `prefers-reduced-data: reduce`
emulated, or *Show covers* off, the spine makes zero image requests. No cover
element carries a `box-shadow` that resolves to `--halo`.
- [ ] AC-2: On the spine, a row whose issue has a `cover_url` renders exactly one `<img>` with `loading="lazy"`, `decoding="async"`, `width="28"`, `height="42"` and `alt=""`; one without renders its issue number in a box of the same computed size; in compact density both are 20×30; every row's height is the same with and without a cover.
- [ ] AC-3: On the Library, a book with a `cover_url` renders its cover in the 28×42 box, one without renders its initials in the neutral placeholder, and one pending renders the dashed box and *metadata pending*; the loading skeleton draws the same box per row.
- [ ] AC-4: The next-issue strip renders the next placement's cover by the same rules, its number when it has none.
- [ ] AC-5: No cover placeholder's computed background is a gradient or one of `--t1`–`--t8` / `--g1`–`--g8`; a book row on the Library carries an `.edge` or a `.tag .sq`, never both.
- [ ] AC-6: The spine, the Library and the strip meet the UX floor (`docs/04-design.md` § 10. The UX floor): loading (the `--sunk` box), no-cover and pending states drawn; covers decorative (`alt=""`), the label beside them naming the row; placeholder text 4.5:1 in both themes; reduced motion stops the skeleton shimmer; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- Covers at the feel-pass sizes on the dashboards and shelves (TASK-086).
- *Show covers* and `prefers-reduced-data` (TASK-087).
- Cover art tone (`--art`), the run detail's key-art band, and their columns: deferred by the owner (2026-10-05) and asked with 4.2.
- Filling missing covers (4.1, 4.2).

## Files likely touched

- `src/components/Cover.tsx` — the box, its states and the placeholder text.
- `src/components/IssueRow.tsx` — every spine row gets the box.
- `src/components/NextStrip.tsx` — the strip's cover.
- `src/app/books/list/page.tsx`, `src/app/books/list/loading.tsx` — the Library's rows and skeleton.
- `src/app/globals.css` — the placeholder and ring, from existing tokens.
- `next.config.ts` — only if the plan gate chooses `next/image`.
- `design/mockups.html`, `design/mockups-index.md` — the gradient covers go (`ui.redrawFiles`).
- `test/spine.test.tsx`, `test/e2e/spine.spec.ts`, `test/e2e/covers.spec.ts` (new).

## Verification

- Automated: `test/spine.test.tsx` (AC-2, AC-5), `test/e2e/covers.spec.ts` (AC-1's row clauses incl. CLS on a 381-row fixture spine, AC-3, AC-4, axe); Lighthouse on the Library in CI.
- Manual: on the Vercel preview, the Library and a long spine at 360px → covers load without rows moving; the PR reports the Library's Lighthouse CLS and LCP and how many covers failed to load.

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
