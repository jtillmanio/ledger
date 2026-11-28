---
id: TASK-139
title: 4.6b Flag a book the sync created under a new author
status: In progress
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 727118b
---

# TASK-139 — 4.6b Flag a book the sync created under a new author

## Goal

When a Calibre sync creates a book under an author the Ledger didn't have, the *Calibre* page says *new author* beside that author, so a stray spelling can be told from a known author.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.6b Flag a book the sync created under a new author (M16 in `docs/06-tasklist.md`). Feature F-33. Depends on 4.6 (TASK-129, done). Its **Check:** is AC-1, verbatim; it is a proposal, agreed when merged.
- *From task 4.6 (TASK-129, PR #326):* 4.6's *Noted with it* paragraph was left undone. A Calibre author spelled a new way creates a new author when the sync creates the book (the app keeps no author merges), and the page can't tell a stray spelling from a known author: a run's report names a created book by its title, and the page shows the author the book has today.
- **What exists.** The sync is `syncCalibre` in `src/db/calibre-sync.ts` (task 4.4, D-133), behind `POST /api/calibre/sync` (`src/app/api/calibre/sync/route.ts`); its change entries are `{ kind: "created" | "updated", calibreId, bookId, title, changes }` and each run is logged as one `calibre_syncs` row, the report stored with it. `src/lib/calibre-log.ts` turns a stored report into the page's rows (`created: boolean`, `came`, `went`), and `src/app/settings/calibre/page.tsx` draws them.
- **The sync records it, nothing is stored on the book** (hard rule 2): each `created` entry carries `newAuthor`, true when the book's author did not exist before the run. It is a key in the run's stored report, not a column; a report stored before this change has no such key, and reading it must not fail. No schema change: if the plan finds the report can't carry the key without one, stop and ask (CLAUDE.md, *Stop and ask before adding or changing a schema column*).
- **The page marks it** in text beside the author, never by colour alone, and offers no button: merging authors is not an action the app has.
- Design: `design/mockups.html` § `calibre` (`design/mockups-index.md`); the review held it as drawn (STYLE_GUIDE §17.8), so the mockup gains only the mark on one created row (`ui.redrawFiles`).
- Rules: `.claude/rules/schema.md` (the sync is the one write path from Calibre), `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-133, D-83.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with the test database, a sync whose payload creates one book by an
author the Ledger lacks and one by a known author: the report's first `created`
entry carries `newAuthor: true` and the second `newAuthor: false`; the *Calibre*
page marks the first *new author* beside its author and not the second; a stored
run whose `created` entries have no `newAuthor` key shows no mark and no error.
At 360px the mark has contrast 4.5:1 in both themes and axe reports no violation.
- [ ] AC-2: Given a payload that creates two books by the same author the Ledger lacks, both `created` entries carry `newAuthor: true` (the author is new to the run, not only to its first book); an `updated` entry carries no `newAuthor` key.
- [ ] AC-3: The sync writes no new column and no new row beyond what it wrote before: given the same payload before and after the change, the `books`, `authors` and `calibre_syncs` row counts match, and only the stored report differs by the `newAuthor` keys.
- [ ] AC-4: The *Calibre* page's created rows meet the UX floor (`docs/04-design.md` § 10. The UX floor): the mark is text, its colour from the custom properties in `src/app/globals.css` (no `--danger`, no hue), contrast 4.5:1 in both themes, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Merging authors, or any button or link to do so.
- Flagging an updated book whose author changed, or a new series or universe.
- Storing anything on `books` or `authors` (hard rule 2).
- 4.6's near-spelling decisions (`src/components/CalibreDecide.tsx`): unchanged.

## Files likely touched

- `src/db/calibre-sync.ts` — `newAuthor` on each `created` entry.
- `src/lib/calibre-log.ts` — read the key, absent meaning no mark.
- `src/app/settings/calibre/page.tsx` — the *new author* mark.
- `src/app/globals.css` — the mark's style, tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `calibre` gains the mark.
- `test/calibre-sync.test.ts`, `test/calibre-page.test.tsx`, `test/e2e/calibre-page.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/calibre-sync.test.ts` (AC-1's report clauses, AC-2, AC-3 on the test database); `test/calibre-page.test.tsx` (the mark, and a stored run with no key); `test/e2e/calibre-page.spec.ts` with axe at 360px, light and dark (AC-1's contrast and axe clause, AC-4).
- Manual: with `npm run dev`, open `/settings/calibre` on the dev database's stored runs (written before this change) → expected: no *new author* mark and no error.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The PC command's printed report (`etl/calibre_sync.py`) doesn't say *new author* (approved at plan) → not tracked: the roadmap entry asks only for the page.

## Plan

Approved 2026-11-28.

**Steps**

1. **Sync** (`src/db/calibre-sync.ts`): `Names` keeps the set of author ids it inserted during the run (`Names.author()` inserts only when the key is missing). Each `created` entry gets `newAuthor: created.has(authorId)`, so two books by one new author are both `true`; an `updated` entry gets no key. `InChange` gains `newAuthor?: boolean` (optional: older stored reports lack it). No schema change: the key lives only in the stored report.
2. **Log** (`src/lib/calibre-log.ts`): `BookEntry` gains `newAuthor: boolean`, true only when a created entry has `newAuthor === true`; a missing key or any other value means no mark.
3. **Page** (`src/app/settings/calibre/page.tsx`): a created row showing its author adds `<span className="ctag" data-mark="new-author"> · new author</span>` after the name. Text, `--muted` through the existing `.ctag` rule, no button. `src/app/globals.css` is not touched: the existing rule covers it.
4. **Mockup**: in `design/mockups.html`, *Gideon the Ninth · new · Tamsyn Muir* gains *· new author* in each of its three frames (phone, 834px, desktop); the `calibre` row in `design/mockups-index.md` gains one clause naming 4.6b.

**Files** (8, all in "Files likely touched"): `src/db/calibre-sync.ts`, `src/lib/calibre-log.ts`, `src/app/settings/calibre/page.tsx`, `design/mockups.html`, `design/mockups-index.md`, `test/calibre-sync.test.ts`, `test/calibre-page.test.tsx`, `test/e2e/calibre-page.spec.ts`.

**Test strategy**

- `test/calibre-sync.test.ts`, describe *a new author (task 4.6b)*: AC-1's report clauses (an unknown author first, a known author second: `newAuthor` true, then false); AC-2 (two books by one new author both true; the `updated` entry has no key); AC-3 (`books` +2, `authors` +1, `calibre_syncs` +1, the counts the code wrote before; each created entry's keys exactly the old five plus `newAuthor`, which fails on the pre-task code; the suite can't run the old code side by side, so the old counts are pinned instead).
- `test/calibre-page.test.tsx`: `byBook` carries `newAuthor`; the rendered page marks the first author and not the second; a stored run without the key renders with no mark and no error.
- `test/e2e/calibre-page.spec.ts`, one `@at-w390-light` test: AC-1's browser clauses (at 360px in both themes the mark is visible beside its author, contrast clean, axe passes); AC-4 (the mark's computed colour is `--muted`; screenshots at all six `ui.viewports` widths, light and dark).
- Manual: `/settings/calibre` on the dev database's existing runs → no mark, no error.

**Risks**: the page shows the author the book has today; if a later sync changed that book's author, the mark sits beside the new name. The roadmap's wording accepts this.

**Size**: 8 files, no schema change; no split.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
