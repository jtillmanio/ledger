---
id: TASK-083
title: 4.4 Sync with Calibre (3 of 3) — the Calibre page, and a line when the last sync is old
status: Ready
depends_on: [TASK-081, TASK-082, TASK-045, TASK-049]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
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
