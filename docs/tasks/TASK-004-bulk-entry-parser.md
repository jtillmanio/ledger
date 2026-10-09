---
id: TASK-004
title: 1.3 Bulk issue entry — parser and validation
status: Draft
depends_on: [TASK-003]
size: S
model: opus
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-004 — 1.3 Bulk issue entry — parser and validation

## Goal

A pasted block of issue labels, one per line, is turned into a checked list: each line is parsed, normalised, and expanded if it's a range, or flagged with the reason it can't be used as typed. The list is ready for the review table (1.3c).

## Context

- Roadmap: `docs/TASKS.md` § 1.3 Bulk issue entry — parser and validation (sitting 4, first). Split from 1.3c by R3-12: this is the pure parser, testable with no UI and no database.
- `depends_on` TASK-003 records the build order (sitting 3 before sitting 4), not a data dependency.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.15 (freeform issue labels go through the bulk-entry parser). `docs/DIAGRAMS.md` § 6 draws the pipeline. § 4. Interface *Review tables* gives the kinds the parser's output feeds (`✓` ok, `!` needs a choice, `×` error).
- Data model: the parser takes the known series and their volume years as an **input** (a plain list built by 1.3c's caller), so it touches no database. Labels are the identity key (D-15). Fraction designators (`#1⁄2`, D-24a) and suffixed ones (`#16.HU`) are outside the grammar, so they fall to *Unparseable* with a manual accept.
- Decisions: D-15 (the label is the identity), D-24a (fraction ids), R3-12 (the split). The AI-label rule in CLAUDE.md applies: this parser is the first of its three gates.
- Pattern to copy: `src/lib/series-list.ts` with `test/series-list.test.ts`, a pure library function and its unit test.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): unit tests for the parser against a fixture of 40 lines covering every rule above, including the 8-volume Captain America case; `#1-12` expands to 12 in order; a line already in the run is flagged *skip*. No database is touched.
- [ ] AC-2: Normalisation is NFKC, then trim, then internal whitespace collapsed, then en and em dashes turned into `-`. The line `  Thor  (1966)  #337–340 ` parses to title `Thor`, year `1966`, and four rows `Thor (1966) #337` … `#340`, in that order. `Avengers (1998) #605.1` parses to one row, and so does a fixture line using the grammar's `Annual N` designator.
- [ ] AC-3: Given known volumes in which `Captain America` has 8 distinct volume years, `Captain America #1` is flagged *ambiguous volume* and lists all 8 years as candidates. `Captain America (1968) #1` is not flagged. A series with exactly one known volume and no year in the input is not flagged *ambiguous*.
- [ ] AC-4: `Dark Reign: The Cabal` and `Astonishing Tales #1 (Mojoworld)` are flagged *unparseable* with an offer to accept as typed, keeping the normalised text. A title missing from the known series is flagged *new series*, with suggestions from the known titles ranked by trigram similarity, highest first, and none below the threshold the plan names. Each flagged line's output carries its kind (`ok`, `choice`, `error`), so 1.3c renders it without re-deriving anything.
- [ ] AC-5: The parser module imports nothing from `src/db` and makes no network call: a test asserts its import graph (or the module source) contains no `@/db`, `postgres` or `fetch`. A line that matches a label already in the run, as supplied by the caller, is flagged *duplicate* with the default decision *skip*.

## Out of scope

- The review table, the decisions UI, the insertion preview and the insert (1.3c).
- Metron lookup and the existence check (1.3b, and the review's *Check* column in 1.3c).
- Writing to `volume_rules`, including the mockup's *Always use 2004* switch (1.12, TASK-019). 1.12 then passes the rules to the parser as part of its known-volumes input, so the parser itself doesn't change.
- Parsing fraction or suffixed designators into rows. They go through *Unparseable* and a manual accept.

## Files likely touched

- `src/lib/bulk-parse.ts` (new): the grammar, normalisation, range expansion and flags.
- `test/bulk-parse.test.ts` (new): the 40-line fixture and the cases above.
- `test/fixtures/bulk-parse-40.txt` (new, or inline in the test): the fixture lines.

## Verification

- Automated: `test/bulk-parse.test.ts` covers every row of the roadmap's validation table against the 40-line fixture: Captain America's 8 volumes, `#1-12` → 12 in order, *skip* on a duplicate, both freeform examples, a new series with ranked suggestions, and the import-graph check (AC-1 to AC-5).
- Manual: none. There's no UI in this task.

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
