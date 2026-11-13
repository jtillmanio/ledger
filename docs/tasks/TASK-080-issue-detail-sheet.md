---
id: TASK-080
title: 3.5 Detail sheets (3 of 3) — the issue sheet, every run that places it
status: Draft
depends_on: [TASK-078, TASK-079]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-080 — 3.5 Detail sheets (3 of 3) — the issue sheet, every run that places it

## Goal

Tapping an issue opens a sheet with its story, credits and dates, and every run it sits in with its read state there, so a reader can mark it read in one more run, deliberately, one run at a time.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5 Detail sheets — books and issues (M14). The entry and its **Check:** are the contract. Feature F-29. This part's merge ticks the entry.
- **Split, 3 of 3.** TASK-078 stored the story arc (and the store date, if approved); TASK-079 built the route sheet. This part is `/comics/[runId]/[issueId]` on the same frame: a sheet from the run detail (`src/app/@modal/(.)comics/[runId]/[issueId]/page.tsx`), a full page on a direct load (`src/app/comics/[runId]/[issueId]/page.tsx`). The run page stays a full page.
- **Your record** (design § 13 → *The issue sheet*; data model 2.14; mockup `issuedetail`, `powershell -NoProfile -File scripts/screen.ps1 issuedetail`): a table of every run that places the issue, run · position · read state · date. Read runs a green tick and a date, unread runs a grey ring, the run you came from marked *this run*. Each row has its own `aria-pressed` toggle that marks that placement through the existing write (`/api/progress/issue`, `src/db/writes.ts`), with its undo; there is no *mark all* and nothing propagates (`.claude/rules/schema.md` → *Read state is per run*). DNF in the status editor is grey.
- **Credits are selective** (the entry): Writer, Penciller (role `artist`) and Inker (only when the issue has one) by default; Cover only when the cover artist differs from the penciller; Colorist and Letterer under a *More credits* disclosure. All six roles stay in `issue_credits`; `run_credit_line` is unchanged.
- **Dates** (spine v2): a *Dates* group lists *Cover date* (`issues.cover_date`, `Mon YYYY`) and, when it differs and only if TASK-078 added it, *Published* (`issues.store_date`). Both grey. An undated issue renders no *Dates* group and no `—`.
- Also on the sheet: hero, story title (`issues.story_title`), story arc (TASK-078), collecting editions (`editions`). Links to reading sources, if they ever arrive, go here and nowhere else (STYLE_GUIDE § 12).
- **What links to it**: the spine's grey `+N` / *read in …* hint and every issue row (`src/components/IssueRow.tsx`), and the master list's collapsed row, whose full record is this sheet.
- **Stop and ask at plan time:** the Check's *Opening Why blocked? from inside an issue sheet leaves exactly one sheet in the DOM, and Back returns to the issue sheet* needs 2.6's *Why blocked?* sheet (`/comics/[runId]/path`, roadmap § 2.6, M12), which is not built. Whether this part waits for 2.6, builds the clause's test against another sheet the issue sheet can open, or carries the clause to 2.6 is the owner's call.
- Decisions: D-19, D-33, D-34, D-63, D-129, UX-N10, UX-N12. Hard rules 3 and 6.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the issue clauses: three runs listed with one read, marking a second writes exactly one `issue_progress` row, one sheet in the DOM after *Why blocked?* (as settled at the plan gate), *Cover date* in `Mon YYYY`, and no *Dates* group for an undated issue. TASK-079 proves the book clauses): test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.
- [ ] AC-2: Given an issue placed in three runs and read in one, opened from one of the unread runs, *Your record* lists three rows, the read one with a green tick and its date, the other two grey rings, the opening run marked *this run*; pressing one unread row's toggle sets `aria-pressed="true"`, writes one `issue_progress` row for that placement and no other, and its undo removes it.
- [ ] AC-3: An issue whose cover artist is its penciller renders no Cover row; one with a different cover artist renders it; one with no inker credit renders no Inker row; Colorist and Letterer render only inside the *More credits* disclosure.
- [ ] AC-4: An issue with `cover_date` 1981-01-01 renders *Cover date* `Jan 1981`; an undated one renders no *Dates* group and no `—`; *Published* renders only when a store date exists and differs.
- [ ] AC-5: Loading `/comics/{runId}/{issueId}` directly renders the full page; from the run detail the sheet opens over the spine and Back returns to the spine at its scroll position with focus on the row that opened it.
- [ ] AC-6: The issue sheet and full page meet the UX floor (`docs/04-design.md` § 10. The UX floor): loading and error states drawn; each placement toggle is a real button named with its run and position, 44px on the phone; the *More credits* disclosure is a real button with `aria-expanded`; read state carries a glyph and text, not colour alone; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- The book sheet (TASK-079).
- 2.6's *Why blocked?* path sheet itself.
- `issues.summary` (4.1) and the comic series page (5.13).
- A placement's drafted note (7.8).

## Files likely touched

- `src/app/@modal/(.)comics/[runId]/[issueId]/page.tsx` (new), `src/app/comics/[runId]/[issueId]/page.tsx` (new).
- `src/components/IssueDetail.tsx` (new) — the content and *Your record*.
- `src/components/IssueRow.tsx` — rows and the `+N` hint link to the sheet.
- `src/db/queries.ts` — one issue's placements with read state, credits, editions.
- `test/issue-detail.test.tsx` (new), `test/e2e/issue-detail.spec.ts` (new), `test/spine.test.tsx`.

## Verification

- Automated: `test/issue-detail.test.tsx` (AC-3, AC-4), `test/e2e/issue-detail.spec.ts` (AC-1's issue clauses, AC-2, AC-5, axe) on the test database.
- Manual: on the dev database, open an issue that sits in several runs from its spine, mark it read in a second run from the sheet → that run's spine shows it read and the first run's is unchanged; undo it, leaving the data as found.

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
