---
id: TASK-072
title: 2.10b Plan a year or a quarter (2 of 2) — the planning sheet
status: Ready
depends_on: [TASK-071, TASK-062, TASK-063, TASK-064, TASK-066, TASK-069]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-072 — 2.10b Plan a year or a quarter (2 of 2) — the planning sheet

## Goal

From the plan page, one sheet fills a year or a quarter: suggestions grouped by why, each placed with one tap, with the budget updating as you go.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.10b Plan a year or a quarter, with suggestions (M11, last; D-104, D-108). The entry and its **Check:** are the contract. Features F-65, F-68.
- **Split, 2 of 2.** TASK-071 built the suggestions; this part is the sheet. **Its merge ticks the roadmap entry**, and the tasklist row's Done cell once both are Done. It also needs 2.3's writes and picker (TASK-063, TASK-064), 2.10's page (TASK-069), 2.2j's row line (TASK-062, D-134) and 2.7's stretch-year acceptance (TASK-066), which the budget line offers.
- **Where it starts.** `/books/plan` gains *Plan 2027…* in its header (any of 2.3's five years) and *Plan this quarter…* on each quarter's summary row; 2.10's *Suggest* (TASK-069's consolidated empty state) opens it at the quarter with the most room. It is a sheet on the phone and the side rail from 1024px, so each placement is seen landing on the rail.
- **The budget stays in view.** The target's total against capacity, as 2.3's preview reads it (*533k of 760k*, sample figures, D-7), updates after every placement. Over capacity it turns amber and offers 2.3's *Accept as a stretch year* (stored by 2.7, TASK-066); never red, and the word *behind* appears nowhere.
- **Rows.** Each group is a short list (five, then *More*); each row is the book's title, its author with universe and series (2.2j's `bookPlace` line), its word count (estimated counts marked as in 2.2b), a reason line, and *Put in Q2* naming the target (for a year target, the bare year and the four quarter chips). Unlisted rows carry 1.22's *Unlisted* tag; placing one writes `to_read` and its plan row in one transaction (1.21's promote). A book already in the plan shows its period and *Move here* instead.
- **Every write is 2.3's.** *Put in Q2* goes through `placeInPlan` (`src/db/writes.ts`), joining the end of the quarter's order (D-37); a bare year takes no position. Each placement pushes an undo onto the 1.2 stack, its row reads *✓ In Q2 · Undo*, and the sheet stays open for the next. *Not now* hides a suggestion for this sitting only.
- **Not drawn yet.** The mockup gains the planning sheet on `plan`, at phone, tablet and desktop widths, before it is built (at the plan gate, `ui.redrawFiles`), and `design/mockups-index.md` lists it.
- The sheet is the shared `src/components/Sheet.tsx` below 1024px (focus on its heading, Tab trapped, focus back to the opener, R1-11); from 1024px a side rail, which traps nothing.
- Design: `docs/04-design.md` § 12 → Over-commitment is a decision, not an error; § 14 → Plan.
- Decisions: D-104, D-108, D-134, D-37, D-86, D-7, D-63.
- *From TASK-071 (2.10b, PR #226):* the suggestions are `planSuggestions(userId, target, today)` in `src/db/queries.ts` (`target` `2027-Q2` or `2027`, `today` the Eastern day), over the SQL function `plan_suggestions` in `etl/views.sql`. Rows come in `SUGGESTION_REASONS` order (`next_in_series`, `next_on_shelf`, `from_author`, `on_deck`, `coming_out`, `recently_added`, `fits_room`, `genre_change`), ranked 1… within each, each with `detail` (the reason line), `status`, `unlisted` (the *Unlisted* tag), `period` (where it is already planned outside the target, for *Move here*), `words` and `estimated`. A book already planned inside the target is left out (owner, at TASK-071's plan gate). It returns title and author only: 2.2j's place line (universe, series and `#position`, D-134) is this task's to join or extend. *Recently added* reads the new `books.added_at`, NULL for every loaded book, so it starts empty.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): with a fixture of a `reading` series with books 1–2 read and 3–4
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
- [ ] AC-2: *Plan 2027…* in `/books/plan`'s header opens the sheet for 2027, each row offering the bare year and the four quarter chips; *Plan this quarter…* on a summary row opens it for that quarter; *Suggest* opens it at the quarter with the most room.
- [ ] AC-3: After *Put in Q2*, the row reads *✓ In Q2 · Undo*, the sheet stays open, and the budget line grows by the book's words; Undo removes the row and returns the line to its prior total. A placement that takes the target over capacity turns the line amber and offers *Accept as a stretch year*, and no text on the sheet says *behind*.
- [ ] AC-4: A group with more than five books shows five and *More*; *Not now* hides a row until the sheet closes, and reopening the sheet shows it again; a planned book shows its period and *Move here*.
- [ ] AC-5: From 1024px the sheet sits beside the rail and each placement redraws the rail without a reload; below 1024px it is a sheet over the page.
- [ ] AC-6: The sheet meets the UX floor (`docs/04-design.md` § 10. The UX floor): empty, loading and error states drawn; every *Put in*, chip, *More* and *Not now* a real button with a name, nothing interactive under 24px and 44px on the phone; focus on the heading and back on the opener below 1024px; text 4.5:1 in both themes; axe with no new violations; no horizontal scroll at 360px; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- The suggestions themselves (TASK-071).
- The rebalance sheet (TASK-067) and *Place them* (TASK-068).
- A dismissal that outlasts the sitting.
- Planning comics (Later § L-8).

## Files likely touched

- `src/components/PlanSheet.tsx` (new; the plan's name) — the sheet and its groups.
- `src/app/books/plan/page.tsx` (from TASK-069) — *Plan 2027…*, and the side rail from 1024px.
- `src/components/PlanQuarterRows.tsx` (from TASK-069) — *Plan this quarter…* and *Suggest*.
- `src/app/api/plan/suggestions/route.ts` (new; or the page's server data, the plan's) — the suggestions for a target.
- `src/app/globals.css` — the sheet, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `plan` gains the sheet (drawn first).
- `test/e2e/plan-sheet.spec.ts` (new).

## Verification

- Automated: `test/e2e/plan-sheet.spec.ts` (AC-1 on the Check's fixture in the browser, AC-2 to AC-6, the screenshots); `test/plan-suggestions.test.ts` (TASK-071's) still passes.
- Manual: `npm run dev`. Follow a series as *Reading*. On *Plan*, *Plan this quarter…* → its next book under *Next in a series*; *Put in Q2* → the rail grows and the row reads *✓ In Q2 · Undo*; Undo → gone. Put everything back, as found.

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
