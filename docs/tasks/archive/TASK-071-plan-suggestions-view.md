---
id: TASK-071
title: 2.10b Plan a year or a quarter (1 of 2) — the suggestions, derived
status: Done
depends_on: [TASK-023, TASK-029, TASK-048, TASK-050]
size: M
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 4f91752
---

# TASK-071 — 2.10b Plan a year or a quarter (1 of 2) — the suggestions, derived

## Goal

For any year or quarter, the Ledger lists books worth planning there, grouped by why (next in what you're reading, followed authors, On deck, coming out, recently added, fits the room left, a change of genre), all from your own data and never stored.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10b Plan a year or a quarter, with suggestions (M11, last; owner intake 2026-11-02, D-104; amended by D-108). The entry and its **Check:** are the contract. Feature F-65 (and F-68). The tasklist row depends on 2.3, 2.10, 1.15, 1.21, 2.2c and 2.2d; this part needs the data ones: 1.15 (TASK-023, follows), 1.21 (TASK-029, Unlisted), 2.2c (TASK-048, the *Reading* follows, `shelf_follows`) and 2.2d (TASK-050, `follow_next`).
- **Split, 1 of 2** (`workflow.splitPolicy: split`: a view, perhaps a column, and a sheet). This part is the suggestions; TASK-072 is the planning sheet, and **its merge ticks the roadmap entry**.
- **No plan object (D-104).** A year's plan is the `reading_plan` rows whose period falls in it (D-37); this task adds none. **Books only**: planning comics runs is *Later* § L-8. **No AI**: the suggestions are rules over your own data.
- **The groups, in this order** (each a short list; a group with nothing in it is left out):
  1. **Next in a series you're reading:** `follow_next`'s row (2.2d) for each series and universe followed `reading`, with its `read` and `total` (*you've read 3 of 6*).
  2. **Next on a shelf you're reading:** `follow_next`'s row for each shelf followed `reading` (2.2c; 5.1 builds the shelves UI).
  3. **From authors you're reading:** unread books by an author followed `reading`, earliest published first, `follow_next`'s first.
  4. **On deck:** already next in line (D-37).
  5. **Coming out in this period:** books whose `releases` date falls in the target. The `releases` table exists; 5.7 fills it, and 5.7 is pulled ahead of 1.26, so it is built before this.
  6. **Recently added:** books added in the last 90 days. `books` records no date added: **stop and ask at plan time** (CLAUDE.md: a schema column). Proposed: `books.added_at timestamptz`, NULL for every row loaded before it, so the group starts empty and fills as books are added in the app; every add path sets it.
  7. **Fits the room left:** to-read books whose word count fits the target's remaining room, largest first, so a quarter fills without tipping over. Words as `plan_book_words` counts them, estimates included.
  8. **A change of genre:** to-read books in a top-level genre you haven't read this year (`book_genre_tree` at depth 1, `books.genre` for a book with none, D-98).
- *Amended by D-108:* groups 1–3 read only what you follow as *Reading*. A series or shelf you happen to have read one book of is not inferred into them; it shows nowhere unless another group lists it.
- *From TASK-050 (2.2d, PR #212):* `follow_next` as built is one row per follow (`kind` subseries, series, universe, author or shelf), with the follow's `read`, `total` and `last_read_on` (its latest dated finish); a book with no status row counts unread. One book can be next in several follows (its series and its universe); the dashboard's `keepGoing` lists it once, with the narrowest reason, and leaves out the top of the quarter's plan, but the view itself does neither, so the sheet's groups choose for themselves. Subseries rows exist too: group 1 can read them beside series and universe.
- **Rules across groups.** A book shows in the first group that lists it, never twice. Unlisted books appear in groups 1–3 (owning the next book of a series is the point), flagged so the sheet can tag them *Unlisted* (1.22). A book already in the plan carries its period. Read, reading, listening and DNF books never appear, nor parked ones once 5.15 lands.
- **Derived, never stored** (Hard rule 2): proposed view `plan_suggestions(book_id, reason, detail, rank)` in `etl/views.sql`, run when the sheet opens, not cached. Groups 5 and 7 depend on the target and its room, which a view can't take as a parameter: the plan says how (the view plus a filtered query, or a function). Whether a dismissal should outlast a sitting (a table) is a plan-gate question, proposed no.
- Data model: `docs/03-data-model.md` § 3. Views; § 4. Proposed additions.
- Decisions: D-104, D-108, D-98, D-37, D-86, D-134. Hard rules 2 and 4.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves its listing clauses, against the query: which book lists under which group for 2027 Q2, the unfollowed series' book 3 under none of the first three, the DNF book never, no book twice, the Unlisted book flagged, and *Fits the room left* within 100k. TASK-072 proves *Put in Q2*, the budget line, Undo, the Unlisted placement's transaction, `--danger` and the screenshots): with a fixture of a `reading` series with books 1–2 read and 3–4
`to_read`, a shelf followed `reading` whose first book is read, an author
followed `reading` with one unread book, an On deck book, an Unlisted book 3
of another `reading` series whose books 1–2 are read, an unfollowed series
with books 1–2 read and 3 `to_read`, and a DNF book, the sheet for 2027 Q2
lists book 3 and not book 4 under *Next in a series*, the shelf's second book
under *Next on a shelf*, the author's book, the On deck book, and the Unlisted
book tagged *Unlisted*; it lists the unfollowed series' book 3 under none of
the first three groups, never lists the DNF book, and no book twice. *Put in Q2* on
book 3 writes one `reading_plan` row at Q2's last ordinal, the budget line
shows the new total, and Undo removes the row. Placing the Unlisted book
writes its `to_read` status and its plan row in one transaction. With 100k of
room left, *Fits the room left* lists no book over 100k. Nothing on the sheet
resolves to `--danger`. Screenshots at 360px and 1280px.
- [x] AC-2: Every suggestion carries one of the eight reasons and a detail line (group 1's from `follow_next`'s `read` and `total`, *you've read 2 of 4*), and the groups come back in the entry's order.
- [x] AC-3: A book already planned in 2027 Q3 is returned for 2027 Q2 with its period; a book at `reading` or `listening` is never returned.
- [x] AC-4: A book with a `releases` date in 2027 Q2 is listed under *Coming out in this period* for 2027 Q2 and not for 2027 Q3. Given a to-read book whose only depth-1 genre has no read this year and one whose genre has, *A change of genre* lists the first and not the second. *Fits the room left* is largest first.
- [x] AC-5: The diff stores no suggestion and adds no table. If the owner approves `books.added_at` at the plan gate, every add path sets it, every loaded row stays NULL, and *Recently added* lists exactly the books added in the last 90 days.

## Out of scope

- The planning sheet, its entry points and its writes (TASK-072).
- A dismissal that outlasts the sitting (a table), unless the plan gate says otherwise.
- AI-written suggestions (D-104).
- Planning comics (Later § L-8).

## Files likely touched

- `etl/views.sql`, `etl/test_views.sql` — `plan_suggestions` (or the plan's shape).
- `src/db/queries.ts` — the suggestions for a target.
- `src/db/schema.ts`, `drizzle/<new migration>.sql`, `drizzle/meta/*` — `books.added_at`, only if approved.
- `src/db/writes.ts` — every add path sets `added_at`, only if approved.
- `test/plan-suggestions.test.ts` (new).

## Verification

- Automated: `test/plan-suggestions.test.ts` (AC-1's listing clauses on the Check's fixture, AC-2 to AC-5, on `TEST_DATABASE_URL`); `npm run test:views` (`etl/test_views.sql`).
- Manual: none in a browser (TASK-072).

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The data model's views table lacks `plan_suggestions` → docs/03-data-model.md § 3. Views (approved at plan)
- The data model's additions table lacks `books.added_at` → docs/03-data-model.md § 4.1 By task (approved at plan)
- Candidate decision: `books.added_at` has no default, so every loaded row stays NULL and only `createBooks` stamps it → docs/review/decisions.md § D-140 (approved at plan)
- TASK-072 needs `planSuggestions`' signature and its eight `reason` values, and must join 2.2j's place line (D-134), which it doesn't return → docs/tasks/TASK-072-planning-sheet.md § Context (approved at plan)
- Schema review's five minors (a release date cast, DateStyle-dependent bounds, a 91-day window, a genre named twice, a collation-dependent spelling) → not tracked: done in this PR (review fixes)
- An impossible release date (`2027-02-30`) is listed as written; validating dates on write is 5.7's job, and it is already built → not tracked: accepted as is, the call no longer fails on one

## Plan

Approved 2026-11-10 with the owner's answers: (1) `books.added_at` approved; (2) no dismissal table, *Not now* lasts the sitting; (3) group 8's "this year" is today's Eastern year, passed in; (4) a book with several top-level genres lists under group 8 only when none of them has a read this year; (5) a book already planned inside the target is left out (a year target: anything planned in that year), any other planned book comes back with its period.

**Shape.** A view can't take the target, the room or today, so `plan_suggestions` is a SQL **function** in `etl/views.sql` (beside `run_ancestors`): `plan_suggestions(p_user text, p_target text, p_room bigint, p_today date)` returning `book_id, reason, detail, rank, status, unlisted, period, words, word_source`, one row per book. The wrapper `planSuggestions(userId, target, today)` in `src/db/queries.ts` reads the room from `planCapacity` (the capacity formula stays in one place) and calls it. Derived on every call, nothing stored.

### Steps

1. Tests first: `test/plan-suggestions.test.ts` (the Check's fixture, AC-1's listing clauses to AC-5) and a `plan_suggestions` block in `etl/test_views.sql`; confirm both fail.
2. The function. Groups 1–3 from `follow_next` / `follow_queue`: 1 = subseries, series, universe (one row per book, the narrowest reason; the follow most recently read in first); 2 = shelf; 3 = every unread book of an author followed `reading`, `follow_queue` rank (earliest published first). These take status NULL, `to_read` or `unlisted`; detail *Next in X · you've read 2 of 4*. Groups 4–8 take `to_read` only: 4 On deck (`to_read_level`); 5 `releases.release_date` in the target's range; 6 `added_at` within 90 days of `p_today`; 7 words ≤ `p_room` (as `plan_book_words` counts them, estimates included; unknown words left out), largest first; 8 none of the book's depth-1 genres (`book_genre_tree`, else `books.genre`) has a read in `p_today`'s year. A book shows in its first group only; books planned inside the target are left out; any other plan period is returned in `period`.
3. `planSuggestions(userId, target, today)` in `src/db/queries.ts`: validates the target, room from `planCapacity`, joins title and author.
4. `books.added_at timestamptz`, nullable, **no default** (`\copy books(...)` names its columns, so every loaded row stays NULL; a default would stamp the load time): `src/db/schema.ts`, `npm run db:generate` (`drizzle/0024_*`, `drizzle/meta/*`); `createBooks` in `src/db/writes.ts`, the one path that inserts a book, sets it; `etl/test_views.sql`'s catalog-columns list gains it. An added column needs no down file.

### Files

- `etl/views.sql` — the `plan_suggestions` function.
- `etl/test_views.sql` — its columns and a listing assertion; `added_at` in the catalog-columns list.
- `src/db/queries.ts` — `planSuggestions`.
- `src/db/schema.ts`, `drizzle/0024_*.sql`, `drizzle/meta/*` — `books.added_at`.
- `src/db/writes.ts` — `createBooks` sets `added_at`.
- `test/plan-suggestions.test.ts` (new).

### Test strategy

- AC-1 (listing clauses), AC-2: the Check's fixture for 2027 Q2 → `test/plan-suggestions.test.ts` "the Check's fixture …"; 100k room set through `reading_settings` and a planned book → "fits the room left lists nothing over 100k".
- AC-3: a book planned in 2027-Q3 comes back for Q2 with `period` `2027-Q3`; reading and listening never.
- AC-4: a release in Q2 listed for Q2 and not Q3; two to-read books by genre read this year or not; group 7 largest first.
- AC-5: no table added (`information_schema`), the function stores nothing; `addBooks` stamps created books and leaves a reused one NULL; *Recently added* lists the book added 10 days before `today`, not 100.

**Risks.** Groups 7 and 8 can be hundreds of rows; all are returned (the sheet shows five, then *More*). The detail copy is a first draft TASK-072 may refine when the mockup is drawn.

## Review log

Verify R1 round PASS (one unrelated 5s timeout in books-dashboard under load; passes alone) → full PASS (1530 vitest, 1008 browser) | Audit R1 PASS (12/12 fail on base) | Spec R1 CHANGES (Follow-ups bullets lacked `→`) → R2 APPROVE | Schema R1 APPROVE (4 minors, fixed) → R2 APPROVE (1 minor, fixed) | Verify R2 round PASS (1531) | Verify R3 round PASS (1531), after the collation fix | Close-out follow-ups check APPROVE | UI not run (no UI files, `ui: false`)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 round + full, R2 round, R3 round)
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
