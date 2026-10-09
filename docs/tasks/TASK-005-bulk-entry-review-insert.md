---
id: TASK-005
title: 1.3c Bulk issue entry — review table and insert
status: Draft
depends_on: [TASK-004]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-005 — 1.3c Bulk issue entry — review table and insert

## Goal

Pasted issue labels can be checked line by line, with each one accepted, fixed or dropped, and then added to a run in one step at the place you choose. An issue the catalog already has is reused, and one that was removed from the run comes back with its read mark.

## Context

- Roadmap: `docs/TASKS.md` § 1.3c Bulk issue entry — review table and insert (sitting 4, after 1.3). The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the add page, the review table, the insertion preview, the run chip and the transactional insert are one user flow. The count in the header is only right when the review and the insert agree.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.15 (adding ends in a real row: reuse an existing `issues` row, else create it, then the placement) and 2.14. § 4. Interface — the `/comics/[runId]/add` route and *Review tables* (five columns: kind glyph, line, why, check, decision; `role="radiogroup"` decisions).
- Data model: `src/db/schema.ts` `issues` (the id is a slug of the label, D-15; fractions per D-24a) and `runIssues` (UNIQUE `(run_id, issue_id)`, and `(run_id, sequence)` DEFERRABLE). `src/db/writes.ts` `addIssueToRun` already restores a soft-deleted placement and shifts later sequences (S-07, R0-15), and the insert builds on it. The id builder must match `etl/extract.py` `slug()` exactly, or a label added in the app and the same label loaded by extract become two issues.
- Design: mockup `bulk` (paste on the left and the review on the right on desktop; the sticky bar counts the real insert) and `addsearch` (the shared review). FEATURES Part 2c *Remember the last run* and UX-N27 (the *Adding to: … · Change* chip). STYLE_GUIDE §9 *states* for empty, loading and error.
- Decisions: D-15, D-19 (no second placement per run), D-24a, R3-12, S-07, UX-N27. The CLAUDE.md AI-label rule: a freeform line is the user's own label, and the decision column is the explicit accept.
- Undo: the insert pushes one entry onto TASK-001's stack. Its inverse soft-deletes the placements it inserted (Hard rule 4) and re-hides any it restored.
- **Settled by the owner, 2026-10-09:** the mockup `bulk`'s *Always use 2004 for Captain America* switch is built in 1.12 (TASK-019), on this task's review table and insert. Here, the review table leaves room on an *ambiguous volume* row for it, and the insert is structured so a staged rule can join its transaction.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): integration test that pastes 24 lines into an empty run and asserts 24 issues in order, and that a line matching an existing label adds a placement without a second `issues` row. Test that the count in the header equals expanded lines minus duplicates for the fixture paste (10 − 1 = 9), and that choosing *Insert after #336* places the new sequences after it and renumbers later ones without touching their progress rows. Pasting a label whose placement in this run was soft-deleted restores the original row (same id, progress intact) and inserts nothing.
- [ ] AC-2: Nothing is written until the user confirms: after parsing and changing decisions, the `issues` and `run_issues` row counts are unchanged. On confirm, the whole insert runs in one transaction. A fixture that makes the third row fail (a forced constraint violation) leaves both tables exactly as before. The id of every new `issues` row equals `etl/extract.py`'s `slug()` for the same label, checked on a fixture list that includes a fraction label (D-24a).
- [ ] AC-3: Each review row shows the kind glyph (`✓`, `!`, `×`, never colour alone), the parsed line, a one-line why (*already in 3 runs*, *restore — was removed*, *already in this run*), and a `role="radiogroup"` decision whose options fit the row (*Use that · Keep as typed · Drop*). A failed row carries `aria-invalid="true"`. The header and the confirm button both state the number that will actually be written, and confirm is `aria-disabled="true"`, with its reason shown, while any row still needs a choice.
- [ ] AC-4: The insertion preview shows three existing rows above and three below the insertion point, with the new rows highlighted. *Insert after* defaults to the end of the run. A chip at the top reads *Adding to: <run title> · Change*. *Change* picks another run without leaving the screen, and the review re-runs against that run (its duplicates and restores).
- [ ] AC-5: After the insert, an undo toast appears. **Undo** soft-deletes exactly the placements this insert created, re-hides any it restored, and leaves the new `issues` rows and every other placement's sequence and progress as they were before the insert.
- [ ] AC-6: The Add issues *Type it* screen meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): empty (no lines yet), parsing and error states are drawn; the textarea and every decision are real controls with names; text is 4.5:1 and outlines 3:1 in both themes; targets are at least 24px; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- The parser itself (TASK-004) and Metron search (1.3b). The *Check* column shows *unverified* for typed lines until 1.3b supplies Metron's answer.
- The *Always use 2004* volume-map switch (TASK-019, 1.12).
- Adding books (1.4, 1.4c) and the quick-capture inbox (1.4b).
- Editing type or notes on existing placements (3.1), and creating a new run (3.2).
- Eras on new rows (3.6).

## Files likely touched

- `src/app/comics/[runId]/add/page.tsx` (new): the Add issues screen and its *Type it* tab.
- `src/components/ReviewTable.tsx` (new): the five-column table, shared with 1.3b.
- `src/components/InsertPreview.tsx` (new), `src/components/RunChip.tsx` (new).
- `src/app/api/runs/[runId]/issues/route.ts` (new): review (dry run) and confirm (insert).
- `src/db/writes.ts`: a transactional batch insert built on `addIssueToRun`, plus the TS twin of `slug()`.
- `src/db/queries.ts`: known series and volumes for the parser, catalog matches (*in N runs*), and this run's live and removed placements.
- `src/app/globals.css`: review table, preview, chip.
- `test/bulk-insert.test.ts` (new, DB), `test/review-table.test.tsx` (new, happy-dom), `etl/test_extract.py` or a shared fixture for the slug parity check.

## Verification

- Automated: `test/bulk-insert.test.ts` against `TEST_DATABASE_URL` covers 24 lines in order, label reuse, the 10 − 1 = 9 count, *Insert after #336* renumbering with progress intact, restoring a soft-deleted placement, the all-or-nothing transaction, slug parity and undo (AC-1, AC-2, AC-5). `test/review-table.test.tsx` covers the glyphs, the radiogroups, `aria-invalid`, the disabled confirm with its reason, and the chip's *Change* (AC-3, AC-4).
- Manual: `npm run dev`, open a run's *Add issues → Type it*, paste ten lines that include a duplicate and a removed issue → expected: the header says 9 (or the right number), and the removed row reads *restore — was removed*. Confirm, then Undo → expected: the run is as it was.

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
