---
id: TASK-154
title: 2.10c Suggestions keep series order, and the sheet can search (1 of 2) — series order in every group
status: Review
depends_on: []
size: S
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 08ffa2c
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

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves its suggestion clauses, TASK-155 the search, the screenshots and axe):
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
- [x] AC-2: Given a subseries whose book 1 is unread inside a series whose earlier books are read, the subseries' book 2 is never suggested; given book 1 parked, book 2 isn't either.
- [x] AC-3: Given a book with no `series_position` in a series, it is never held back and never holds another back.
- [x] AC-4: `test/plan-suggestions.test.ts`'s existing cases still pass unchanged (2.10b's Check).

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

- The `plan_suggestions` row in the data model's views table says a book whose series or subseries has an earlier unread book is listed only under On deck (2.10c) (approved at plan) → docs/03-data-model.md § 3. Views
- Roadmap 2.10c and its task list row stay open until TASK-155 (the search) is Done → not tracked: TASK-155 finishes the item, and its close-out ticks it
- A planned earlier book (To read, in a plan row) still holds the next one back, since the rule is by status; raised at the plan gate and built as written → not tracked: the roadmap rule is explicit and the owner approved the plan with it

## Plan

Approved by the owner 2026-11-26.

**Steps**

1. Tests first, `test/plan-suggestions.test.ts`, a new `describe` (confirm each fails on the current function):
   - AC-1: books `c-1`…`c-4`, 50k each, To read, unfollowed, each also tempting every other group (a Q2 release, added last week, an unread genre); 200k of room (40 min × 200 wpm, 530k planned). Only `c-1`, under *Fits the room left*; `c-1` read → `c-2`, not `c-3`/`c-4`; `c-1` Reading → `c-2`; `c-3` On deck → under *On deck*. An author followed Reading with two series and a standalone: *More from* lists the first unread book of each series and the standalone.
   - The holding statuses: no status, Unlisted, Parked hold the next book; Listening and DNF don't; a soft-deleted earlier book doesn't.
   - AC-2: a subseries inside a series whose earlier books are read: its book 2 never, with book 1 unread or Parked, the subseries also followed Reading (so *Next in a series* is covered); with book 1 read, book 2 is (control).
   - AC-3: a book with no `series_position` is suggested with an earlier book unread, and its own unread status holds nothing.
2. `etl/views.sql` `plan_suggestions`: a `held` CTE, each live book whose series (by `series_position`) or subseries (by `subseries_position`) has an earlier live book with status none, `to_read`, `unlisted` or `parked`; `picked` drops held books from every group but *On deck* (grp 4) before its `DISTINCT ON`, so a held On deck book still lands there and ranks stay 1…n. Positions compare only where both are set (AC-3 falls out). Columns unchanged; the header comment says so.
3. AC-4: the existing cases and `etl/test_views.sql` unchanged (their fixtures hold none of their listed books back).

**Files**: `etl/views.sql` (the filter), `test/plan-suggestions.test.ts` (the tests), this task file. `etl/test_views.sql` is not touched: the columns don't change.

**Test strategy**: AC-1 to AC-3 as the `describe` above; AC-4 the existing file unchanged. `npm run test:db:reset`, the file alone, then `verify.full`; `test/e2e/plan-sheet.spec.ts` still holds (only `s-4` is newly held, which nothing asserts listed), proved by CI.

**Risks**: a planned earlier book still holds the next (the rule is by status; built as written). A universe or subseries follow whose next book is held by series order suggests nothing rather than a later one. Performance: `books_live_series_idx` covers the series lookup; ~1.4k books.

**Size**: S, two code files, no schema, no UI.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (plan-sheet.spec.ts w390-light 13/13) | CI R1 PASS (every area) | Spec R1 APPROVE | Schema R1 APPROVE (MINOR: time the held probe) → ~71 ms vs ~26 ms pre-task at 1.4k books; split into two EXISTS → ~27 ms
- Verify R2 PASS | Schema R2 APPROVE | Spec R2 APPROVE | Audit R1 PASS (11 discriminating, 4 controls) | CI R2 (9c54b40) PASS
- Drift R1 update first (behind 1; main changed src/app/globals.css, task 6.25) → rebased clean | Verify R3 PASS (plan-sheet.spec.ts w390-light 13/13) | CI R3 on the rebased head

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2 (round 2 for the reviewer-asked performance fix)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
