---
id: TASK-154
title: 2.10c Suggestions keep series order, and the sheet can search (1 of 2) — series order in every group
status: Ready
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-154 — 2.10c Suggestions keep series order, and the sheet can search (1 of 2) — series order in every group

## Goal

The plan sheet never suggests a later book of a series while an earlier one is still unread, in any group but *On deck*.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10c Suggestions keep series order, and the sheet can search (M11 in `docs/06-tasklist.md`). Feature F-65. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 1 of 2.** This part is `plan_suggestions`; TASK-155 adds the search and its browser clauses.
- **The bug.** `plan_suggestions` (`etl/views.sql`, task 2.10b, D-104, D-108) reads `follow_next` only for *Next in a series* and *Next on a shelf*. *More from* (every unread book of an author followed Reading, from `follow_queue`), *Coming out*, *Recently added*, *Fits the room left* and *A change of genre* take any To-read book, so book 4 of an unstarted series is offered.
- **The rule.** A book is left out of every group but *On deck* when its series, or its subseries, has an earlier live book (`series_position`, `subseries_position`) whose status is none, `to_read`, `unlisted` or `parked`. `reading`, `listening`, `read` and `dnf` count as started. Universe order isn't used. Derived at read (hard rule 2), in the one function; `planSuggestions` (`src/db/queries.ts`) is unchanged but for what the function returns.
- Rules: `.claude/rules/schema.md` (views, to-read levels, Unlisted, Parked). Decisions: D-37, D-104, D-108.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its suggestion clauses, TASK-155 the search, the screenshots and axe):
with
the test database: a series with books 1–4, none followed, all To read, each
50k words, and 200k of room left: the sheet for 2027 Q2 suggests book 1 under
*Fits the room left* and never books 2–4 in any group; with book 1 read it
suggests book 2 and not 3–4; with book 1 Reading, book 2; book 3 put On deck is
listed under *On deck*. An author followed Reading lists only the first unread
book of each of the author's series under *More from*. Typing two letters of a
title in the sheet's search lists that book with its place line and no read
book; *Put in Q2* on it writes one `reading_plan` row and Undo removes it.
Screenshots at 360px and 1280px; axe passes.
- [ ] AC-2: Given a subseries whose book 1 is unread inside a series whose earlier books are read, the subseries' book 2 is never suggested; given book 1 parked, book 2 isn't either.
- [ ] AC-3: Given a book with no `series_position` in a series, it is never held back and never holds another back.
- [ ] AC-4: `test/plan-suggestions.test.ts`'s existing cases still pass unchanged (2.10b's Check).

## Out of scope

- The search (TASK-155).
- Universe order, and any change to which groups exist or their order.

## Files likely touched

- `etl/views.sql` — `plan_suggestions`: the series-order filter.
- `etl/test_views.sql` — if the views' own test lists the function's columns.
- `test/plan-suggestions.test.ts` — AC-1's suggestion clauses, AC-2 to AC-4.

## Verification

- Automated: `test/plan-suggestions.test.ts` on the test database (`npm run test:db:reset` first, so `views.sql` is current).
- Manual: none; TASK-155 walks the sheet.

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
