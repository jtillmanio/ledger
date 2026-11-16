---
id: TASK-086
title: 4.3 Covers in the UI (2 of 3) — covers at the feel-pass sizes: the heroes, the shelf and the dashboard rows
status: Done
depends_on: [TASK-085, TASK-049]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 87f1423
---

# TASK-086 — 4.3 Covers in the UI (2 of 3) — covers at the feel-pass sizes: the heroes, the shelf and the dashboard rows

## Goal

The dashboards lead with real covers (the book in hand, the comics Up next shelf, the On deck and queue rows) at the feel pass's sizes, with the same plain placeholder where a cover is missing.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.3 Covers in the UI (M16), its *Covers lead the feel pass* paragraph (D-40, P1; STYLE_GUIDE § 4.2, § 7). The entry and its **Check:** are the contract. Feature F-33.
- **Split, 2 of 3.** TASK-085 built the row box and the neutral placeholder; this part applies the same lazy, aspect-locked, neutral-placeholder rules outside the spine row; TASK-087 adds the setting.
- **Sizes**: 2:3 at the `--cover-*` widths in `src/app/globals.css`: hero `--cover-hero` 112 (150 from 768px, 168 from 1280px), shelf `--cover-shelf` 112, dashboard row `--cover-row` 36, and a stack at 30 (the entry; no token exists yet, so the plan adds one from `design/tokens.css` or asks). Each with `--r-cover` 4 and `--sh-cover`, whose 1px edge stops a dark cover merging into a dark card. The spine row stays 28×42 (SG-D13).
- **Where they go today as placeholders** (*Until 4.3 every card shows the neutral cover placeholder*): the books hero `.now-cover` (`src/components/BooksNow.tsx`), *Between books* (`src/components/BetweenBooks.tsx`), the On deck rows (`src/components/OnDeckRow.tsx`, `.deck-row .cv`), the comics Up next shelf (`src/components/QueueShelf.tsx`, `.shelf .cover`), the queue rows (`.qrow .cv`), and the dashboards' *Up next* cards. The plan lists every one against the feel pass (`design/Ledger Feel Review.dc.html`, `design/LedgerDesktop.dc.html`, `design/screenshots/README.md`) and the queries that must now select `cover_url` (`src/db/queries.ts`).
- A run's cover (the shelf, the comics hero) needs a rule for *which* cover is a run's: the entry asks it with the art tone (*which cover is a run's key art: the first placement's? the head's? a chosen one?*). **Stop and ask at plan time** for the shelf's and the comics hero's cover; the art tone itself stays deferred.
- Covers are data: never glow, never tinted; no cover `box-shadow` resolves to `--halo`. Glass is unchanged: covers scrolling under the header are the worst case D12 was sized for (STYLE_GUIDE § 8).
- Design: the feel pass wins on layout for the dashboards (CLAUDE.md, D-40); `docs/04-design.md` § 9 The feel pass, § 12 The dashboards.
- Decisions: D-12, D-33, D-40, D-94, SG-D13. Hard rule 6.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves, for the dashboard and shelf covers, *no cover placeholder renders a gradient or an identity hue* and *no cover element carries a `box-shadow` that resolves to `--halo`*. TASK-085 proves the row clauses and TASK-087 the zero-request clause): Lighthouse CLS under 0.1 on the books page. No cover placeholder
renders a gradient or an identity hue, and no row renders both an `.edge` and a
`.tag .sq`. On the spine, a row whose issue has a `cover_url` renders one
`<img loading="lazy" alt="">` inside a 28×42 box, and a row without one renders
the issue number in the same box. Swapping one for the other changes no row's
height (CLS under 0.1 on a 381-row spine). With `prefers-reduced-data: reduce`
emulated, or *Show covers* off, the spine makes zero image requests. No cover
element carries a `box-shadow` that resolves to `--halo`.
- [x] AC-2: On the books dashboard reading a book with a `cover_url`, the hero renders it 2:3 at `--cover-hero` (112px at 360, 150px at 768, 168px at 1280), with `--r-cover` and `--sh-cover`; a book without one renders the neutral placeholder in the same box, and the hero's height is the same either way.
- [x] AC-3: The comics Up next shelf renders each queued run's cover (as the plan gate settled) at `--cover-shelf`, and the On deck and queue rows at `--cover-row`, each lazy with explicit `width` and `height` and `alt=""`, or the placeholder in the same box.
- [x] AC-4: No dashboard cover or placeholder has a computed gradient background, an identity hue, or a `box-shadow` containing `--halo`'s value, in light or dark.
- [x] AC-5: The two dashboards meet the UX floor, feel-pass width (`docs/04-design.md` § 10. The UX floor): every state they have (reading, listening, between books, never finished; the shelf full and empty) with real covers and with placeholders, screenshotted at 360, 390, 412, 768, 1024 and 1280px, light and dark, once with `prefers-reduced-motion` and once with `prefers-reduced-transparency`; at 1440px the content box stays 1056px; axe reports no new violations; nothing resolves to `--danger`.

## Out of scope

- The row box and the spine (TASK-085).
- *Show covers* and reduced data (TASK-087).
- The run detail's full-bleed `--art` band and the art tone columns (deferred; asked with 4.2).
- Completion screens (2.12).

## Files likely touched

- `src/components/BooksNow.tsx`, `src/components/BetweenBooks.tsx`, `src/components/OnDeckRow.tsx`, `src/components/QueueShelf.tsx` — real covers.
- `src/components/Cover.tsx` — a size variant per slot.
- `src/db/queries.ts` — `cover_url` where a dashboard query lacks it; a run's cover.
- `src/app/globals.css` — the stack width, from `design/tokens.css`.
- `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/queue.spec.ts`.

## Verification

- Automated: the dashboard and queue specs (AC-2 to AC-4, axe at the feel-pass widths).
- Manual: on the Vercel preview at 360px and 1280px, both dashboards with the dev data → covers in the hero, shelf and rows, none glowing, none tinted.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 2.4's comics hero and its *Since Tuesday* stack (30px) are not built, so this task adds no `--cover-stack` token (none in `design/tokens.css`) and no hero cover; 2.4 uses the run-cover rule settled here and takes the 30 width from `design/tokens.css` (approved at plan, 2026-11-16) → docs/05-roadmap.md § 2.4
- Candidate decision: a run's cover is the cover of its lowest-sequence live placement whose issue has a `cover_url`; the placeholder only when none has one. Owner's choice at the plan gate, 2026-11-16, over sequence 1 strictly and a chosen cover (a schema change) (approved at plan, 2026-11-16) → docs/review/decisions.md § D-155
- `docs/review/decisions.md`'s closing line still read *The next new decision is **D-154*** after D-154 was recorded; it now reads D-156 → docs/review/decisions.md § D-155 (fixed in this PR)
- An empty-string `cover_url` would pass `IS NOT NULL` in `upNext`'s lateral (schema-reviewer, minor): only Metron and the ETL write the column and neither writes one → not tracked: theoretical

## Plan

_Approved 2026-11-16 (owner): one task, not split, the books status screen's quarter rows (`PlanQuarter`) included; a run's cover is its first placement with one._

**Steps**

1. `src/components/Cover.tsx`: `ArtCover({ url, w })`, one `<span class="cv">` box either way: with a url an `<img loading="lazy" decoding="async" alt="" width={w} height={w*1.5}>` inside it, without one `cv none`. The slot's CSS sizes the box (`--cover-hero`, `--cover-shelf`, `--cover-row`, `aspect-ratio:2/3`), so a cover arriving changes no height.
2. `src/app/globals.css`: `.cv > img` fills its box (`object-fit:cover`); `overflow:hidden` on the row boxes (`.deck-row .cv`, `.qrow .cv`, `.between-offer>.cv`) so the radius clips the art; `.qrow .cv` gets `--sh-cover` like the other slots. No gradient, nothing resolving to `--halo`.
3. `src/db/queries.ts`: `QueueRow` and `upNext` gain `cover_url`: the issue cover of the run's lowest-`sequence` placement with `deleted_at IS NULL` whose issue has a `cover_url` (a LATERAL), null when none. `PlannedBook` and `booksUpNext` gain `b.cover_url` (the books status screen's quarter rows; `StatusBook`, shared with In flight, is unchanged). The books queries the dashboards read (`InHandBook`, `ShelfBook`, `LastFinish`) already select it.
4. Real covers through `ArtCover`: `BooksNow` (hero, w 112), `BetweenBooks` (the last finish's cover, w 72, and the offer, w 36), `OnDeckRow` (36), `PlanShelf` (books Up next shelf, 112), `QueueShelf` (comics Up next shelf, 112), `QueueList` (comics queue rows, 36), `PlanQuarter` (books status screen's quarter rows, 36; `QuarterBook` gains `cover_url`).
5. `design/mockups.html`: the `.k1`–`.k8` gradient covers leave the `home`, `queue` and `status` frames (TASK-085 left the dashboard frames to this task; `bdash` has none).

**Files**: the six components, `Cover.tsx`, `queries.ts`, `globals.css`, `design/mockups.html` (not in *Files likely touched*: the redraw, `ui.redrawFiles`), `src/components/PlanShelf.tsx`, `src/components/QueueList.tsx` and `src/components/PlanQuarter.tsx` (not listed: the books shelf, the comics queue rows, the books quarter rows), `test/run-queue.test.ts`, `test/status.test.ts` (`booksUpNext` selects `cover_url`), `test/e2e/dashboard-covers.spec.ts` (new). ~11 source files: over the split line, kept whole by the owner (each component change is a one-line swap behind one helper).

**Test strategy**

- AC-3 (the rule): `test/run-queue.test.ts`, *upNext gives a run the cover of its first placement with one, skipping a coverless head and a deleted placement; null when none*; `test/status.test.ts`, *booksUpNext carries each planned book's cover_url*.
- AC-2, AC-3, AC-4, AC-1's two clauses, AC-5: `test/e2e/dashboard-covers.spec.ts`, rows under `e2e-dc-` ids, covers from a fake host answered by `page.route` (as `covers.spec.ts`): the hero 2:3 at 112 / 150 / 168 by project width and the same height with and without a cover; shelf, On deck, comics queue and books quarter-row images lazy with `width`, `height`, `alt=""`; every cover and placeholder with no `background-image`, background `--sunk`, no `box-shadow` containing `--halo`'s value (light and dark projects); screenshots of reading, listening, between books, never finished, shelf full and empty, with covers and with placeholders, in every project; reduced motion and reduced transparency once each; 1440px content box 1056; axe; nothing `--danger`.
- AC-1's CLS clause on `/books`: CI's Lighthouse gate.

**Risks**: AC-5's matrix makes the new spec large; the existing dashboard specs already screenshot most states, so the new one adds the cover variants and leaves theirs alone.

## Review log

Verify R1 PASS | CI R1 PASS (all 8 e2e shards, Vercel, Lighthouse on 8add61d) | Audit R1 PASS | Spec R1 APPROVE | Schema R1 APPROVE | UI R1 CHANGES (AC-2: at 360px a three-line title stretched the hero cover to 112×186) → fixed (`align-self:flex-start`, test fails without it) | Verify R2 PASS | CI R2 pending at close-out

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (a fix after the UI round, re-checked below)
- First-pass AC FAILs: 1 (AC-2 at 360px with a long title, found by ui-verifier)
- Plan revisions after approval: 0
