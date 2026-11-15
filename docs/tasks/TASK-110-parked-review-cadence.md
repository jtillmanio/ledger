---
id: TASK-110
title: 5.15 Parked (3 of 4) — the review's cadence in Settings, when it is due, and Done reviewing
status: Ready
depends_on: [TASK-108]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-110 — 5.15 Parked (3 of 4) — the review's cadence in Settings, when it is due, and Done reviewing

## Goal

You choose how often to review what you've parked (monthly, quarterly or never), and the Ledger knows when that review is due and when you've done it.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.15 Parked (M17), the *When it is due* bullet. D-105. Pulled ahead of 1.26 (D-139). Feature F-66. Its **Check (proposed):** is the contract.
- **Split, 3 of 4.** TASK-108 built the status; TASK-109 the verb and chip. This part stores the cadence and the last review, derives *due*, and records *Done reviewing*. TASK-111 draws `/parked` and the reminders, and its merge ticks the entry.
- **Schema and one Settings row in one task, on purpose:** the sizing rule splits schema from UI, but the row is a single control over the two columns this task adds, and keeping them together lets the cadence be proven end to end. If the plan finds it runs past 8 files, it moves the row to TASK-111.
- **The setting.** A Settings row (2.0; `src/app/settings/page.tsx`, `src/components/PaceSettings.tsx`, `saveReadingSettings` in `src/db/writes.ts`, `POST /api/settings`), *Review parked items: monthly · quarterly · never*, default quarterly. Proposed: `reading_settings.parked_review` (text with a CHECK of the three values, default `quarterly`) and `reading_settings.parked_reviewed_on date` (NULL until the first review). **Stop and ask at plan time** (two columns). `reading_settings` is keyed by `user_id` today (6.18 drops it); the new columns carry none of their own (D-91).
- **When it is due**, derived, never stored (hard rule 2): something is parked, the cadence isn't *never*, and the last review is older than the cadence (or there has been none). The plan defines *older than a month / a quarter* (calendar months or 30/91 days) and writes it in one place (`src/lib/` or a query) that TASK-111's dashboard line, Inbox row and review all read. *Today* is the Eastern day (1.16, D-67).
- ***Done reviewing*** records the review: `parked_reviewed_on = today`, whatever is left parked, through a route with an undo that puts the prior date back. TASK-111 draws the button; this part builds its write.
- Data model: `docs/03-data-model.md` § 4. Proposed additions (the plan adds the rows). Architecture: `docs/02-architecture.md` § 5.
- Decisions: D-67, D-91, D-105. Hard rules 2 and 3.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, with `npm test`: with a monthly cadence, one parked book and a last review 40 days ago the review is due; with nothing parked it is not; *Done reviewing* makes it not due. TASK-108 and TASK-109 prove the status, TASK-111 the review and the dashboard line): (proposed; the owner agrees it by merging or edits it first)
`npm test`: parking the 2nd of 3 books in 2027 Q1
writes `parked`, removes its plan row and leaves Q1 at ordinals 1–2, and
Undo restores `to_read` at position 2. A parked book is absent from
`to_read_level`, `plan_period`, the three status-screen tabs and 2.10b's
suggestions, and present under the master list's *Parked* chip and in
search tagged *Parked*; a series with one read and one parked book reads
`1 / 2`. With a monthly cadence, one parked book and a last review 40 days
ago, the review is due; with nothing parked it is not; *Done reviewing*
makes it not due. In the browser (0.11), the review's *Plan…* opens 2.3's
picker, *Unlisted* writes `unlisted` and Undo puts back `parked`, and the
dashboard line shows only when the review is due. Nothing on the
dashboard or the review resolves to `--danger`.
- [ ] AC-2: With a quarterly cadence, one parked book and a last review 40 days ago, the review is not due; at 100 days it is; with *never* it is never due; with no review yet and one parked book it is due.
- [ ] AC-3: *Done reviewing* writes today's Eastern date to `parked_reviewed_on`, and its undo puts the prior value (NULL included) back; a value other than the three cadences is refused by the route with 400 and by the CHECK.
- [ ] AC-4: Settings shows *Review parked items* with *Monthly · Quarterly · Never*, *Quarterly* chosen by default; choosing *Monthly* saves, survives a reload, and raises the settings' usual confirmation.
- [ ] AC-5: The Settings row meets the UX floor (`docs/04-design.md` § 10): a labelled radiogroup or segmented control operable by keyboard, targets ≥ 24px, contrast in light and dark, screenshots at 360px and 1280px; the `settings` frame in `design/mockups.html` draws the row and `design/mockups-index.md` names it (task 5.15).

## Out of scope

- The status (TASK-108), the verb and chip (TASK-109).
- `/parked`, its *Done reviewing* button, the dashboard line and the Inbox row (TASK-111).
- The email (7.6) and any push notification.

## Files likely touched

- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — the two columns (as approved).
- `src/db/writes.ts` — `saveReadingSettings`, *Done reviewing* and its undo.
- `src/db/queries.ts`, `src/lib/parked.ts` (new; the name is the plan's) — the due rule.
- `src/app/api/settings/route.ts` — the cadence; the review's write (its route is the plan's).
- `src/app/settings/page.tsx`, `src/components/PaceSettings.tsx` — the row.
- `design/mockups.html`, `design/mockups-index.md` — `settings` (redraw).
- `test/parked-review.test.ts` (new), `test/settings.test.tsx`.

## Verification

- Automated: `test/parked-review.test.ts` (AC-1's due clauses, AC-2, AC-3 on `TEST_DATABASE_URL`), `test/settings.test.tsx` (AC-4's row), `npm run check:migrations`.
- Manual: on the dev database, Settings → *Review parked items* → *Monthly* → reload → still *Monthly*; set it back. Leave the data as found.

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
