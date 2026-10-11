---
id: TASK-004
title: 1.3 Bulk issue entry — parser and validation
status: Review
depends_on: [TASK-003]
size: S
model: opus
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: e2eb3fd
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

- [x] AC-1 (roadmap **Check:**, verbatim): unit tests for the parser against a fixture of 40 lines covering every rule above, including the 8-volume Captain America case; `#1-12` expands to 12 in order; a line already in the run is flagged *skip*. No database is touched.
- [x] AC-2: Normalisation is NFKC, then trim, then internal whitespace collapsed, then en and em dashes turned into `-`. The line `  Thor  (1966)  #337–340 ` parses to title `Thor`, year `1966`, and four rows `Thor (1966) #337` … `#340`, in that order. `Avengers (1998) #605.1` parses to one row, and so does a fixture line using the grammar's `Annual N` designator.
- [x] AC-3: Given known volumes in which `Captain America` has 8 distinct volume years, `Captain America #1` is flagged *ambiguous volume* and lists all 8 years as candidates. `Captain America (1968) #1` is not flagged. A series with exactly one known volume and no year in the input is not flagged *ambiguous*.
- [x] AC-4: `Dark Reign: The Cabal` and `Astonishing Tales #1 (Mojoworld)` are flagged *unparseable* with an offer to accept as typed, keeping the normalised text. A title missing from the known series is flagged *new series*, with suggestions from the known titles ranked by trigram similarity, highest first, and none below the threshold the plan names. Each flagged line's output carries its kind (`ok`, `choice`, `error`), so 1.3c renders it without re-deriving anything.
- [x] AC-5: The parser module imports nothing from `src/db` and makes no network call: a test asserts its import graph (or the module source) contains no `@/db`, `postgres` or `fetch`. A line that matches a label already in the run, as supplied by the caller, is flagged *duplicate* with the default decision *skip*.

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

Approved by the owner 2026-10-11.

**Steps**

1. `test/bulk-parse.test.ts` first, with the 40-line fixture inline (each line
   paired with its expected kind, flags, expanded labels and skips); confirm it
   fails.
2. `src/lib/bulk-parse.ts`, a pure module with no imports:
   `parseBulk(text, { knownSeries: {title, years: number[]}[], runLabels: string[] })`
   returns one result per non-blank line:
   `{ line, input, normalized, kind: ok|choice|error, title, year, rows[], flags[] }`,
   a row being `{ label, designator, decision: add|skip }`.
3. The rules, in the roadmap's order:
   - Normalise: NFKC, trim, collapse internal whitespace, en/em dash to `-`.
   - Unparseable → `error`, keeps the normalised text, offers accept as typed;
     when adding the missing `#` makes the line parse, a suggestion too (the
     mockup's "Did you mean…", `Thor Annual 13`).
   - New series → `choice`, up to 5 known titles by trigram similarity
     (pg_trgm-style word-padded trigrams, Jaccard), highest first, none below
     **0.3** (pg_trgm's default).
   - Ambiguous volume → `choice`: no year in the input and 2+ known years lists
     them; exactly 1 known year fills it ("Volume year filled from your map");
     0 leaves the label yearless.
   - Range: `#1-12` → 12 rows in order; a reversed range or one over 500
     issues → `error`.
   - Duplicate: a row whose label is already in the run gets flag `duplicate`
     and decision `skip`; a range with one duplicate stays `ok`.
4. Export `labelFor(title, year, designator)` so 1.3c can rebuild labels after
   a year is picked.

**Owner's answers**

1. Annual: accept both `Title (Year) #Annual N` (the roadmap grammar, probably
   a typo there and never expected in practice) and `Title (Year) Annual #N`
   (the mockup); output is always `Title (Year) Annual #N`.
2. Series match case-insensitively and take the catalog's spelling; duplicate
   checks are case-insensitive too (label slugs, D-15).
3. An explicit year the series doesn't know (`Captain America (1969) #1`) stays
   `ok`; 1.3c's Metron check catches it. A *new volume* flag is a follow-up.

**Files**

- `src/lib/bulk-parse.ts` (new): grammar, normalisation, range expansion, flags.
- `test/bulk-parse.test.ts` (new): the 40-line fixture inline, and the AC cases.
- `docs/tasks/TASK-004-bulk-entry-parser.md`, `docs/TASKS.md` (tick 1.3).

**Test strategy**

- AC-1: "40-line fixture", "8-volume Captain America", "#1-12 expands to 12 in
  order", "line already in the run is skip".
- AC-2: "normalises Thor (1966) #337–340", "decimal designator", "Annual
  designator".
- AC-3: "ambiguous lists 8 years", "explicit year not flagged", "single known
  volume not ambiguous".
- AC-4: "freeform lines are unparseable", "new series ranked suggestions ≥ 0.3",
  "every line carries a kind".
- AC-5: "module has no @/db, postgres or fetch" (reads the source) and the
  duplicate → skip case.
- Sanity, not committed: run the parser over `seed/issues.csv` labels; about
  302 should be unparseable (roadmap).

**Risks**: the trigram threshold and the 500-issue range cap are judgement
calls, named here so 1.3c can change them in one place.

**Revision 1 (owner, 2026-10-11, after review)**: fold in the PR's follow-ups
that belong to this task. Designators lose leading zeros (`#01` is `#1`, so a
duplicate isn't missed); the TASKS 1.3 grammar drops the `#Annual N` typo; the
threshold and the annual form are recorded as D-54 and D-55. The 1.3c notes go
to TASK-005 on a separate docs branch.

## Review log

Verify R1 PASS | Audit R1 PASS (2 minor notes; threshold pinned in 2125a6e) | Spec R1 APPROVE | Schema n/a (pure module, no DB) | UI n/a (ui: false)
Revision 1 (owner's follow-ups): Verify R2 PASS | Spec R2 APPROVE

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0
- Plan revisions after approval: 1 (owner's follow-ups, after review)
