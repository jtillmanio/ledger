---
id: TASK-071
title: 2.10b Plan a year or a quarter (1 of 2) — the suggestions, derived
status: Ready
depends_on: [TASK-023, TASK-029, TASK-048, TASK-050]
size: M
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
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

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves its listing clauses, against the query: which book lists under which group for 2027 Q2, the unfollowed series' book 3 under none of the first three, the DNF book never, no book twice, the Unlisted book flagged, and *Fits the room left* within 100k. TASK-072 proves *Put in Q2*, the budget line, Undo, the Unlisted placement's transaction, `--danger` and the screenshots): with a fixture of a `reading` series with books 1–2 read and 3–4
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
- [ ] AC-2: Every suggestion carries one of the eight reasons and a detail line (group 1's from `follow_next`'s `read` and `total`, *you've read 2 of 4*), and the groups come back in the entry's order.
- [ ] AC-3: A book already planned in 2027 Q3 is returned for 2027 Q2 with its period; a book at `reading` or `listening` is never returned.
- [ ] AC-4: A book with a `releases` date in 2027 Q2 is listed under *Coming out in this period* for 2027 Q2 and not for 2027 Q3. Given a to-read book whose only depth-1 genre has no read this year and one whose genre has, *A change of genre* lists the first and not the second. *Fits the room left* is largest first.
- [ ] AC-5: The diff stores no suggestion and adds no table. If the owner approves `books.added_at` at the plan gate, every add path sets it, every loaded row stays NULL, and *Recently added* lists exactly the books added in the last 90 days.

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
