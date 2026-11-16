---
id: TASK-083
title: 4.4 Sync with Calibre (3 of 3) — the Calibre page, and a line when the last sync is old
status: In progress
depends_on: [TASK-081, TASK-082, TASK-045, TASK-049]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 4ab259b
---

# TASK-083 — 4.4 Sync with Calibre (3 of 3) — the Calibre page, and a line when the last sync is old

## Goal

A *Calibre* page under Settings lists every sync run (when it ran, what came in, what went out, what waits), and the books dashboard says so in plain words once the last sync is more than a week old.

## Context

- Roadmap: `docs/05-roadmap.md` § 4.4 Sync with Calibre, both ways: one command, by hand or weekly (M16). Its **Check:** is the contract (agreed by the owner 2026-11-13). This part's merge ticks the entry.
- **Split, 3 of 3.** TASK-081 keeps the log; TASK-082 runs the sync. This part reads the log.
- **The log** (D-133): each run is listed on a *Calibre* page under Settings (`src/app/settings/page.tsx`, task 2.0, TASK-045): when it ran, what came in, what went out, and what waits (a near spelling waiting on a merge or separate decision, and the book gone from Calibre). Whether a waiting near spelling is decided on this page is the plan's to propose against TASK-081's decisions table; the entry says *a near spelling waits on the Calibre page for a merge or separate decision*. A *Not in Calibre* list, derived from a missing `books.calibre_id` (D-90), belongs here too (the entry's D-90 amendment).
- **The dashboard line**: the books dashboard (`src/app/books/page.tsx`, TASK-049) shows a plain line, *Calibre last synced 9 days ago*, once the last run is more than 7 days old; none at 7 or fewer, and none before any run (the plan says what a never-synced Ledger shows, if anything). Nothing red (hard rule 6, `docs/04-design.md` § 10: nothing on a dashboard is red). *Days* are Eastern days (1.16, D-67).
- Design: no mockup frame draws either; the `settings` frame (`powershell -NoProfile -File scripts/screen.ps1 settings`) and § 14 → Settings set the page's look, and `docs/04-design.md` § 12 → Books dashboard the line's slot. `ui.redrawFiles` (`design/mockups.html`, `design/mockups-index.md`) get both frames in the same PR.
- Decisions: D-40, D-67, D-90, D-133. Hard rule 6.
- *From TASK-081 (4.4, PR #265):* the app keeps no author merges (extract's are `book_review.csv`'s `kind = author` rows), so a Calibre author spelled a new way creates a new author through the sync. The page lists the run's `report.in` entries of kind `created`; an author new to the Ledger is worth showing there so a stray spelling is seen. TASK-081 stores decisions per Calibre book (`calibre_decisions`, written by `decideCalibrePair` in `src/db/writes.ts`), which this page can call for a waiting near spelling.
- *From TASK-082 (4.4, PR #267):* until the books cutover the command sends `#read` and `#date_read` in `missingColumns` while `CALIBRE_SYNC_READS` is off, so a run's `report.skippedColumns` lists them although the library has them. Label the log's skipped columns "missing, or held until the books cutover".
- *From TASK-082 (4.4, PR #267), open question for the plan:* the write-back loses a finish's precision. If the owner's date-read column (`#read_date`) displays a year alone, Calibre's value reads back as July 1st `approximate`, and the route compares days (`src/db/calibre-sync.ts`, `out("#date_read", …)`), so an exact Ledger finish differs and is rewritten every run. Compare by the column's display precision in the route, or say so on the page.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the browser clauses: the *Calibre* page lists the run, and the dashboard's line shows at 8 days and not at 6. TASK-081 and TASK-082 prove the run): with a
fixture library in a temp folder and the test database: four books, one
matching a Ledger book with a changed title and word count, one the Ledger
lacks and marked read, one whose `#date_read` was changed in Calibre after the
Ledger logged a different read, and one the Ledger has read and owns on paper.
One run creates one Unlisted book with one `read_events` row; renames the
matched book and replaces its `stated` word count; overwrites the changed
`#date_read` with the Ledger's and lists it; writes `#read`, `#date_read`,
`#ledger_status` and `#owned` for the book read in the Ledger; and is one log
entry listing each change. A second run changes nothing on either side and
logs that nothing changed. A missing `#owned` column is named and skipped. In
the browser (0.11), the *Calibre* page lists the run, and the dashboard's line
shows when the last run is 8 days old and not when it is 6.
- [ ] AC-2: Given three logged runs, the *Calibre* page lists them newest first, each with its Eastern date and time and its counts in, out and waiting, and a run's details show each change by book; a run that changed nothing reads that it changed nothing.
- [ ] AC-3: Given a last run 8 Eastern days before today, the books dashboard renders *Calibre last synced 8 days ago*, linking to the *Calibre* page; at 6 days and at 7 it renders no such line; no part of the line resolves to `--danger`.
- [ ] AC-4: Settings links to the *Calibre* page, and a Ledger book with no `calibre_id` is listed there under *Not in Calibre*.
- [ ] AC-5: The *Calibre* page and the dashboard line meet the UX floor (`docs/04-design.md` § 10. The UX floor): empty (no run yet), loading and error states drawn; every control a real button or link with a name, nothing under 24px and 44px on the phone; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark, and the dashboard with the line at every feel-pass width (360, 390, 412, 768, 1024, 1280) with reduced motion and reduced transparency (D-40).

## Out of scope

- Running a sync from the browser (D-133: the command on the PC is the only trigger).
- The route, the tables and the command (TASK-081, TASK-082).
- Editing a book's Calibre data in the app.

## Files likely touched

- `src/app/settings/calibre/page.tsx` and `loading.tsx` (new) — the page.
- `src/app/settings/page.tsx` — the link.
- `src/app/books/page.tsx` (or `src/components/BooksNow.tsx`) — the line.
- `src/db/queries.ts` — the runs, the last run, *Not in Calibre*.
- `design/mockups.html`, `design/mockups-index.md` — the two frames (`ui.redrawFiles`).
- `test/calibre-page.test.tsx` (new), `test/e2e/calibre-page.spec.ts` (new).

## Verification

- Automated: `test/calibre-page.test.tsx` (AC-2, AC-3's day boundary), `test/e2e/calibre-page.spec.ts` (AC-1's browser clauses, AC-4, axe).
- Manual: on the dev database with a logged run, open Settings → *Calibre* → the run and its changes are listed; the dashboard shows no line for a fresh run.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Deciding a waiting near spelling on the *Calibre* page (*Merge* / *Separate*): an API route around `decideCalibrePair` (`src/db/writes.ts`), a client component and tests. This page only lists what waits; until the follow-up lands nothing in the app decides one. Planned: a new roadmap item or task beside 4.4 (approved at plan)
- The write-back's lost finish precision (TASK-082's open question): a date-read column displaying a year alone reads back as July 1st `approximate`, so an exact Ledger finish is rewritten every run (`src/db/calibre-sync.ts`, `out("#date_read", …)`). Moot until `CALIBRE_SYNC_READS` is on; the route is TASK-082's, out of scope here. Planned: a note on `docs/05-roadmap.md` § 1.26 (approved at plan)
- An author new to the Ledger on a created book: the report's `created` entries don't record whether the sync created the author, so the page can't flag a stray spelling without guessing. Needs the route to record it. Planned: a note on `docs/05-roadmap.md` § 4.4 (approved at plan)

## Plan

Approved 2026-11-16 at 4ab259b, with the recommended answer to each open question.

**Decisions at the gate.** The page lists a waiting near spelling and does not decide it (follow-up). A never-synced Ledger shows no dashboard line. TASK-082's precision question is a follow-up on 1.26, not fixed here. Kept whole despite 13 files (UI only, no schema; 2 are tests and 2 the required mockup redraws), `autonomy: attended`.

### Steps

1. `src/db/queries.ts`: `calibreRuns()` (id, `ran_at`, and the in / out / waiting counts as `jsonb_array_length` of the report's lists, derived in SQL, never stored, hard rule 2; newest first; the reports themselves not loaded); `calibreRun(id)` (one run's report); `lastCalibreSync()` (the latest `ran_at`, or null); `notInCalibre()` (live books with `calibre_id IS NULL`, title order, with the author name; `deleted_at IS NULL`, hard rule 4).
2. `src/lib/calibre-log.ts` (new, pure): `syncLine(ranAt, now)` → *Calibre last synced N days ago* when the Eastern days between `easternDay(ranAt)` and `today(now)` (`daysBetween`, `src/components/BooksNow.tsx`) exceed 7, else null, and null for no run; `byBook(report)` groups `in` and `out` by book (title, changes, writes); labels for each field and column; the skipped columns' label *missing, or held until the books cutover*.
3. `src/app/settings/calibre/page.tsx` (new): runs newest first, each a native `<details>` (the newest open) whose summary is the Eastern date and time and *n in · n out · n waiting*; inside, by book: came in (a created book shows its current author, joined live), went out (from → to), waiting, gone from Calibre, skipped, skipped columns, notes; a run with empty lists reads *Nothing changed.* Then *Not in Calibre · N*, a collapsed `<details>` listing those books. Empty state: a `--raise` panel, *No sync yet. Run `npm run calibre:sync` on your PC.*, no button (D-133: nothing in the browser runs a sync). `loading.tsx` (new): skeletons at the loaded geometry. `error.tsx` (new, the app's first route error boundary): a neutral line with a grey ×, never red, and a *Try again* button calling `reset`.
4. `src/app/settings/page.tsx`: a *Calibre* row under *Data* (*Last synced …*, or *Not synced yet*) linking to `/settings/calibre`.
5. `src/app/books/page.tsx`: `lastCalibreSync()` joins the one wave; `syncLine` renders a plain `--muted` link to `/settings/calibre` under the lede, beside the inbox chip, at every width. Nothing resolves to `--danger`.
6. `src/app/globals.css`: the page's rows, the empty panel, the error line, the dashboard line (tokens only, hard rule 6).
7. `design/mockups.html`, `design/mockups-index.md` (`ui.redrawFiles`): a new `calibre` frame (phone and desktop: runs, an open run, *Not in Calibre*, the empty state) and the line on one `bdash` frame.

**Files:** `src/db/queries.ts`, `src/lib/calibre-log.ts` (new, not in Files likely touched), `src/app/settings/calibre/page.tsx`, `loading.tsx`, `error.tsx` (new, not in the list), `src/app/settings/page.tsx`, `src/app/books/page.tsx`, `src/app/globals.css` (not in the list), `design/mockups.html`, `design/mockups-index.md`, `test/calibre-page.test.tsx`, `test/e2e/calibre-page.spec.ts`.

### Test strategy

- AC-2 → `test/calibre-page.test.tsx`: three runs come back newest first with their counts; the page renders each Eastern date and time, the changes by book, and *Nothing changed.* for an empty run.
- AC-3 → `test/calibre-page.test.tsx`: `syncLine` at 8 Eastern days renders the line, at 7 and 6 none, before any run none; the rendered line links to `/settings/calibre` and carries no `--danger` class or style. `test/e2e/calibre-page.spec.ts`: the dashboard with a run 8 days old shows it, 6 days old doesn't, and its computed colour isn't `--danger`'s.
- AC-1 (browser clauses) → `test/e2e/calibre-page.spec.ts`: a logged run is listed on `/settings/calibre`; the 8- and 6-day dashboard checks above.
- AC-4 → both: `notInCalibre()` lists a book with no `calibre_id` (vitest); Settings links to the page and the page lists it (e2e).
- AC-5 → `test/e2e/calibre-page.spec.ts`: axe, target sizes (24px, 44px on the phone), contrast, no sideways scroll; screenshots at 360, 834 and 1280px light and dark (the page, empty and with runs), the dashboard with the line at 360, 390, 412, 768, 1024 and 1280 with reduced motion and reduced transparency; the loading skeleton's geometry and the error boundary rendered.
- The spec runs serially and deletes its `calibre_syncs` rows after each test, so other dashboard specs never meet a stale run.

**Risks:** a stray `calibre_syncs` row left in the shared test database would put the line on other specs' dashboard screenshots (mitigated above). `ran_at` is a timestamp, so the Eastern day must come from `easternDay`, never `toISOString().slice(0, 10)`.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
