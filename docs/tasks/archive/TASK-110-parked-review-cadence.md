---
id: TASK-110
title: 5.15 Parked (3 of 4) — the review's cadence in Settings, when it is due, and Done reviewing
status: Done
depends_on: [TASK-108]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: aefac9b
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

- [x] AC-1 (roadmap **Check (proposed):**, verbatim; this part proves, with `npm test`: with a monthly cadence, one parked book and a last review 40 days ago the review is due; with nothing parked it is not; *Done reviewing* makes it not due. TASK-108 and TASK-109 prove the status, TASK-111 the review and the dashboard line): (proposed; the owner agrees it by merging or edits it first)
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
- [x] AC-2: With a quarterly cadence, one parked book and a last review 40 days ago, the review is not due; at 100 days it is; with *never* it is never due; with no review yet and one parked book it is due.
- [x] AC-3: *Done reviewing* writes today's Eastern date to `parked_reviewed_on`, and its undo puts the prior value (NULL included) back; a value other than the three cadences is refused by the route with 400 and by the CHECK.
- [x] AC-4: Settings shows *Review parked items* with *Monthly · Quarterly · Never*, *Quarterly* chosen by default; choosing *Monthly* saves, survives a reload, and raises the settings' usual confirmation.
- [x] AC-5: The Settings row meets the UX floor (`docs/04-design.md` § 10): a labelled radiogroup or segmented control operable by keyboard, targets ≥ 24px, contrast in light and dark, screenshots at 360px and 1280px; the `settings` frame in `design/mockups.html` draws the row and `design/mockups-index.md` names it (task 5.15).

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

- The 5.15 row of the proposed additions records the two `reading_settings` columns as built and the due rule (approved at plan) → docs/03-data-model.md § 4.1 By task
- The lasting rule (the two columns, calendar months, one `reviewDue`, *Done reviewing* and its undo, the Undo toast on a settings choice, `.frow-choice`), approved by the owner at close-out → docs/review/decisions.md § D-164
- Schema review MINOR: a first-ever *Done reviewing* sent twice at once reads `prior = null` both times (the `FOR UPDATE` locks no row yet), so one undo could 409 → not tracked: unreachable with one user, and the day written is the same either way
- ui-verifier left the row's loading and failed-save paths and reduced motion unwalked → not tracked: the loading skeleton is pinned by `test/e2e/settings.spec.ts` (the loaded rows' size, every row), the failed-save line is the pace steppers' shared `undo.fail`, and the row has no motion of its own

## Plan

Approved by the owner 2026-11-18, with the plan's recommendations: (1) the two columns as below; (2) a month is a calendar month (31 Jan + 1 month = 28 Feb, as Postgres counts); (3) AC-4's "usual confirmation" is the app's Undo toast, *Review parked items: Monthly*, whose Undo puts the prior cadence back; (4) the row stays in this task (10 code files, past the 8-file line: the row is one small component and one page line, and keeps the cadence provable end to end).

**Steps**
1. Schema + migration 0034 (`npm run db:generate`): `reading_settings.parked_review text NOT NULL DEFAULT 'quarterly'` with `CHECK IN ('monthly','quarterly','never')`; `reading_settings.parked_reviewed_on date` (NULL until the first review). No `user_id` of their own (D-91). Add-only: no down file.
2. `src/lib/parked.ts`: the due rule, one pure function `reviewDue({ cadence, reviewedOn, parked }, today)`: something parked, cadence not `never`, and no review yet or today ≥ reviewedOn + 1 or 3 calendar months (clamped to the month's end). `PARKED_CADENCES`, `DEFAULT_PARKED_CADENCE`, `addMonths`. Today is the Eastern day (`today()`, D-67).
3. `src/db/queries.ts` `parkedReview(userId, now?)` → `{ cadence, reviewedOn, parked, due }`; `parked` counts `book_status.status = 'parked'` on books not deleted. TASK-111's dashboard line, Inbox row and review read it.
4. `src/db/writes.ts`: `saveReadingSettings` takes `parkedReview`; `markParkedReviewed(userId, now?)` upserts today's Eastern day and answers `{ prior, reviewedOn }`; `undoParkedReviewed(userId, change)` puts `prior` back (NULL included), false when the date has changed since.
5. Routes: `PATCH /api/settings` accepts `parkedReview` through `parseSettingsPatch` (`src/lib/settings.ts`); any other value is a 400 that writes nothing. `src/app/api/parked/review/route.ts` (new): POST records, DELETE `{ change }` undoes, 409 when changed since (the note route's pattern).
6. `src/components/ParkedReviewSetting.tsx` (new) on `src/app/settings/page.tsx` under Reading pace (its own *Parked* heading): the `.seg` group of real buttons *Monthly · Quarterly · Never*, `aria-pressed`, named by the row's label; a choice saves at once and pushes the Undo toast; a failed save puts it back and raises the failed-write line with Retry.
7. Redraw `settings` (phone and desk frames) in `design/mockups.html`; `design/mockups-index.md` names the row.
8. `docs/03-data-model.md` § 4.1 row 5.15: the columns are built.

**Files**: `src/db/schema.ts`, `drizzle/0034_*.sql` + `drizzle/meta/*`, `src/lib/parked.ts`, `src/lib/settings.ts` (not in Files likely touched: the patch parser lives there), `src/db/queries.ts`, `src/db/writes.ts`, `src/app/api/settings/route.ts`, `src/app/api/parked/review/route.ts` (new), `src/components/ParkedReviewSetting.tsx` (new, instead of growing `PaceSettings.tsx`), `src/app/settings/page.tsx`, `design/mockups.html`, `design/mockups-index.md`, `docs/03-data-model.md`, `test/parked-review.test.ts` (new), `test/settings.test.tsx`, `test/e2e/settings.spec.ts`.

**Test strategy**
- AC-1 (its due clauses), AC-2: `test/parked-review.test.ts` › "when the review is due" (fixed today): monthly + 40 days due; nothing parked not due; quarterly 40 not / 100 due; never; no review yet; month-end arithmetic.
- AC-3: `test/parked-review.test.ts` › "Done reviewing": POST writes today's Eastern day, DELETE restores the prior (NULL and a date), 409 when changed; PATCH with a bad cadence is 400 and writes nothing; the CHECK refuses one in raw SQL.
- AC-4: `test/settings.test.tsx` (row renders, Quarterly pressed by default; PATCH monthly saves, the next read sees it); `test/e2e/settings.spec.ts` (Monthly → toast → reload → still Monthly; Undo puts Quarterly back).
- AC-5: `test/e2e/settings.spec.ts` floor test (named group, real buttons ≥ 24px, Tab + Enter/Space, contrast, axe); screenshots at 360 and 1280px by ui-verifier; the redraw by eye.

**Risks**: production lags `main`; an add-only migration with defaults is safe on any version. Grep tests for pinned `reading_settings` column lists.

**Revisions after approval** (each forced by an existing test or by the row not fitting; reported to the owner at the PR):
- `src/app/settings/loading.tsx`: the *Parked* group's skeleton row, since the loading-state test compares every loaded row with its skeleton.
- `src/app/globals.css`: `.frow-choice`, a container query that stacks the label above the control where the row is narrower than 26rem (a phone, and a settings column at 1024px), since the label and the three choices do not fit side by side there.
- `test/schema-additions.test.ts` and `test/plan-acceptance.test.ts`: their pinned `reading_settings` row and column list gain the two columns.
- Settings reads the cadence through `readingSettings` (which now carries `parkedReview`) instead of `parkedReview()`, keeping `/settings` at its 3-query budget (`test/query-budget.test.ts`); `parkedReview()` stays for TASK-111.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 FAIL(2: `/settings` query budget 4 > 3; `plan-acceptance` pinned `reading_settings` columns) → R2 PASS (2265 tests) | settings e2e (w390-light, floor also w360/w1024/w1280) PASS
- CI R1 PASS (every project, 8 shards; tests; Vercel preview)
- Schema R1 APPROVE (1 MINOR, not tracked) | Spec R1 APPROVE (2 wording notes fixed in 3f3301f, test-only) | Audit R1 PASS | UI R1 PASS (all six widths, light and dark; dev DB left on Quarterly)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 4 (the skeleton row, `.frow-choice`, two pinned test lists, the cadence through `readingSettings`; listed under the Plan)
