---
id: TASK-019
title: 1.12 Load the volume map into volume_rules
status: In progress
depends_on: [TASK-018]
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: a7ce1c2
---

# TASK-019 — 1.12 Load the volume map into volume_rules

## Goal

The approved volume rules (which year a bare series name means) are in the database before cutover. When pasting issues, choosing *Always use 2004 for Captain America* adds a rule, so the same ambiguity isn't asked about again.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.12 Load the volume map into `volume_rules` (sitting 7; it must land before Step 14's final load, the last time `load` runs). It is the load half of 3.9. The roadmap entry and its **Check:** are the contract.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the owner moved the bulk-entry review's volume switch here on 2026-10-09 (it was open question 2 on TASK-005). The roadmap entry was amended to match. That adds the switch in TASK-005's review table, its staged write in TASK-005's insert, and the parser's caller reading the rules, on top of the ETL load.
- Data model: `src/db/schema.ts` `volumeRules` (`series`, `run_id` NULL = any run, `issue_from` / `issue_to` NULL = any issue, `year`). It was created by 0.3 and is empty today. `etl/extract.py` `load_volume_map` reads `etl/data/volume_map.csv` and applies the approved rules to labels, but never writes them to `seed/`.
- The load: extract writes `seed/volume_rules.csv` from the same approved rows (series text verbatim, `run_id` NULL for an any-run rule, `issue_from` / `issue_to` NULL for any issue, `year`). A row flagged `approved with no year` is not written. `etl/load.ps1` and `etl/load.sh` copy it after `runs` (its `run_id` is a foreign key), and `npm run rebuild`'s row counts list it (`etl/rebuild.ps1`, `etl/rebuild.sh`).
- The switch: mockup `bulk` draws *Always use 2004 for Captain America* on a row flagged *ambiguous volume* by TASK-004's parser. It stages an any-run, any-issue rule. Nothing is written until TASK-005's confirm, which writes the rule in the same transaction as the insert. TASK-005's caller passes the table's rules to the parser, so a series with a rule resolves to its year and isn't flagged. Changing or removing a rule stays 3.9's.
- No schema change. Labels are already normalised by extract.
- Decisions: D-16, D-18 (load first, then run in parallel; no load after Step 14). Standing rule 4: a new seed file, other outputs unchanged. Re-run against both workbooks and diff. psql `\copy` paths need forward slashes on Windows (CLAUDE.md).
- `depends_on` TASK-018 records the sitting's build order. The switch also needs TASK-004 and TASK-005, which come earlier in the chain.
- *From TASK-005 (1.3c, PR #74):* The *Always use 2004* switch goes on the ambiguous-volume row: `ReviewTable` draws a row's decision groups in order, so the switch follows the *Volume year* group (`src/lib/bulk-review.ts`, `decide`, the `ambiguous_volume` branch). The insert is `insertIssuesIntoRun(runId, after, labels, { within })` in `src/db/writes.ts`: write the staged volume rule inside `within` and it stands or falls with the insert (`test/bulk-insert.test.ts`, *a throw inside `within` … rolls the whole insert back*).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:etl` covers a fixture map holding a run-scoped rule, an any-run rule and an approved row with no year, and asserts that `seed/volume_rules.csv` holds exactly the first two, with `run_id` NULL on the second. `npm run rebuild` (development) reports a `volume_rules` count equal to the approved rows in `volume_map.csv`.
- [ ] AC-2: The CSV's header matches `volume_rules`' column order. An issue-range rule keeps its `issue_from` and `issue_to`, and an any-issue rule writes them as NULL (empty in the CSV, loaded as NULL). `etl/load.ps1` and `etl/load.sh` both copy it after `runs` and still refuse when `LEDGER_LIVE=true` (the existing guard is untouched). `rebuild`'s row-count report includes `volume_rules`.
- [ ] AC-3: Given known volumes in which `Captain America` has several years and no rule, the line `Captain America #1` is flagged *ambiguous volume* and its row offers *Always use <year> for Captain America* once a year is picked. Switching it on and confirming writes exactly one `volume_rules` row (`series = 'Captain America'`, `run_id` NULL, `issue_from` and `issue_to` NULL, the picked year) in the same transaction as the insert. Cancelling, or switching it off before confirm, writes no rule.
- [ ] AC-4: With that rule in the table, pasting `Captain America #2` into any run is not flagged *ambiguous* and resolves to `Captain America (<year>) #2`. A forced failure in the insert's transaction leaves `volume_rules` unchanged.
- [ ] AC-5: The switch meets the UX floor (`docs/04-design.md` § 10. The UX floor): it is a real switch (`role="switch"` or a checkbox) named *Always use <year> for <series>*, at least 24px, keyboard operable, readable in both themes; screenshots of an ambiguous row with the switch at every `ui.viewports` width, light and dark.
- [ ] AC-6: Every other CSV extract writes is byte-identical before and after the change on the current workbooks, and the PR quotes the diff summary (standing rule 4).

## Out of scope

- The volume map editor: changing or removing a rule, and run- or issue-scoped rules from the app (3.9).
- Any schema change.
- Running `load` against production. That is the owner's Step 14.
- Writing rules back to `etl/data/volume_map.csv`. After cutover the table is the record, and nothing writes back to the workbook or its sidecars from the app.

## Files likely touched

- `etl/extract.py`: write `seed/volume_rules.csv`.
- `etl/test_extract.py`: the fixture map and its assertions.
- `etl/load.ps1`, `etl/load.sh`: copy it after `runs`.
- `etl/rebuild.ps1`, `etl/rebuild.sh`: the row count.
- `src/components/ReviewTable.tsx`: the switch on an ambiguous row.
- `src/db/queries.ts`: the rules, passed to the parser with the known volumes.
- `src/db/writes.ts`, `src/app/api/runs/[runId]/issues/route.ts`: write a staged rule inside TASK-005's insert transaction.
- `test/bulk-insert.test.ts`, `test/review-table.test.tsx`: the switch cases.

## Verification

- Automated: `npm run test:etl` covers the three fixture rows and the NULLs (AC-1, AC-2). `test/bulk-insert.test.ts` against `TEST_DATABASE_URL` covers the rule written with the insert, no rule on cancel, the rollback, and the next paste resolving (AC-3, AC-4). `test/review-table.test.tsx` covers the switch's name and keyboard use (AC-5).
- Manual: `npm run rebuild` on the development database → expected: a `volume_rules` count equal to the approved rows with a year in `etl/data/volume_map.csv`, and the other seed CSVs identical to before (AC-6). On a run's *Add issues → Type it*, paste `Captain America #1`, pick a year, switch *Always use* on and confirm → expected: pasting `Captain America #2` is no longer flagged.

## Follow-ups

- `docs/01-product.md` F-13 says "The 67 approved rules"; today's `volume_map.csv` has 66 approved rows, all with a year. Correct the prose to the count (or drop the number) (approved at plan)
- Roadmap 3.9's *The parser reads it*: 1.12's parser already applies the rules (the run's own first, inside the issue range, annual rules under `<Title> Annual`); 3.9 is left with pre-selecting the year, *from the volume map*, and letting the user change it (approved at plan)
- Candidate decision: an insert's Undo leaves the volume rule it wrote; changing or removing a rule is 3.9's editor alone (owner, 2026-10-25, at the plan gate) (approved at plan)

## Plan

Approved by the owner 2026-10-25 at `a7ce1c2`, with both open questions answered as recommended: (1) the insert's Undo does **not** remove the rule it wrote (3.9 owns change and removal; the toast is unchanged); (2) the parser applies run-scoped and issue-range rules as well as any-run, any-issue ones, matched as extract matches them (TASK-004's note expected the rules folded into the known-volumes input; that would leave the 13 run-scoped and range rules unread).

### Steps

1. **Extract** (`etl/extract.py`). `load_volume_map` also keeps the approved rows that have a year in a module-level `VOLUME_RULES` list, in file order (cleared with the other tables in `WorkbookCase.setUp`). `extract_comics` writes `seed/volume_rules.csv` with header `series,run_id,issue_from,issue_to,year` (the table's columns in order, without the serial `id`, as `wishlist.csv` does): series verbatim, `run_id` / `issue_from` / `issue_to` empty for NULL. A row whose `run_id` is not a run in the workbook is flagged `volume_map,rule for unknown run` in `unresolved.csv` and not written, so `load` can't fail on the foreign key (all 4 run-scoped rules name real runs today, so `unresolved.csv` does not change). `approved with no year` rows stay unwritten.
2. **Load** (`etl/load.ps1`, `etl/load.sh`): add `volume_rules` to the TRUNCATE list, and `\copy volume_rules(series,run_id,issue_from,issue_to,year) FROM '<seed>/volume_rules.csv' CSV HEADER` after `runs` (after `run_tracks`, before `issues`). The `LEDGER_LIVE` guard is untouched. **Rebuild** (`etl/rebuild.ps1`, `etl/rebuild.sh`): add `volume_rules` to the row-count table lists.
3. **Parser** (`src/lib/bulk-parse.ts`). Export `VolumeRule = { series; runId: string | null; issueFrom: number | null; issueTo: number | null; year }`. `parseBulk(text, { knownSeries, runLabels, rules?, runId? })`. In `resolve`, a known series written without a year first looks for a rule: rules for `title` (for an `Annual N` designator, rules for `${title} Annual`, as extract's label regex reads it), skipping another run's rules, ordered most specific first exactly as `load_volume_map` sorts (run + range, run, range, series-wide), and inside the range (`issue_from` NULL = no floor, `issue_to` NULL = no ceiling). A range line resolves only when the first matching rule for its first number also covers its last. A match returns the rule's year with `yearFilled: true` and no flag (the review already says *Volume year filled from your map.*). No match: today's behaviour.
4. **Review** (`src/lib/bulk-review.ts`). On an `ambiguous_volume` line with a year picked, the row carries `rule: { key, series, year, on }`. `key` is the choices key `always:<lower(series)>` and `series` is the title, or `<title> Annual` for an annual line. `on` is true when `choices[key] === "year:<picked>"`. Keying by series means at most one staged rule per series: switching it on on a second row with another year moves it there. `buildReview` passes `rules`/`runId` through to its own `parseBulk` calls and returns `rules: { series, year }[]`, the staged rules whose row is neither pending nor dropped.
5. **Screen.** `ReviewTable.tsx`: under a row's groups, when `row.rule` is set, `<button type="button" role="switch" aria-checked={on} className="switch">` with `<b aria-hidden="true" />` and the name *Always use <year> for <series>*. It toggles via `onChoose(rule.key, on ? "off" : "year:<year>")`. `ReviewTableRow` gains the optional `rule` (the book review never sets it). `src/app/globals.css`: `.review .switch{margin-top:.6875rem}` (the mockup's spacing); size, focus, hover and both themes come from the existing `.switch` rules. `AddIssues.tsx`: a new `rules: VolumeRule[]` prop held in state, with `ctx.run.id` passed to `parseBulk`/`buildReview`. The confirm body adds `rules: review.rules` when non-empty, and on success merges the answer's `rules` into state (`runId: null`, `issueFrom`/`issueTo` null), so the next paste resolves without a reload. Undo is unchanged and leaves the rule.
6. **Server.** `src/db/queries.ts` gets `volumeRules()`: every row, `series, run_id, issue_from, issue_to, year`. `src/app/comics/[runId]/add/page.tsx` loads it in the same `Promise.all` and passes `rules`. `src/db/writes.ts` gets `addVolumeRules(tx, rules)`: it inserts an any-run, any-issue row per `{ series, year }`, skips a series that already has an any-run, any-issue rule (stale tab; changing a rule is 3.9's), and returns what it wrote. `src/app/api/runs/[runId]/issues/route.ts` validates `rules` (array, ≤ 50, `series` a non-empty string ≤ 300 after `normalizeLine`, `year` an integer 1900–2100, distinct series) and writes them inside `within` together with the note's resolve. The answer adds `rules` (written).

### Files

- `etl/extract.py`: `VOLUME_RULES`, write `seed/volume_rules.csv`.
- `etl/test_extract.py`: `VolumeRules` fixture case.
- `etl/load.ps1`, `etl/load.sh`: truncate and copy after `runs`.
- `etl/rebuild.ps1`, `etl/rebuild.sh`: the row count.
- `src/lib/bulk-parse.ts` *(not in Files likely touched)*: rules in `resolve`.
- `src/lib/bulk-review.ts` *(not in Files likely touched)*: the staged rule per row, `Review.rules`.
- `src/components/ReviewTable.tsx`: the switch.
- `src/components/AddIssues.tsx` *(not in Files likely touched)*: rules state, the confirm body.
- `src/app/comics/[runId]/add/page.tsx` *(not in Files likely touched)*: load the rules.
- `src/app/globals.css` *(not in Files likely touched)*: the switch's top margin in a review row.
- `src/db/queries.ts`: `volumeRules()`.
- `src/db/writes.ts`: `addVolumeRules`.
- `src/app/api/runs/[runId]/issues/route.ts`: validate and write `rules` inside `within`.
- `test/bulk-parse.test.ts` *(not in Files likely touched)*: rule matching.
- `test/bulk-insert.test.ts`: the rule with the insert, none when off or unconfirmed, the rollback, the next paste.
- `test/review-table.test.tsx`: the switch.
- `test/load-scripts.test.ts` *(new; not in Files likely touched)*: load and rebuild twins.

19 files, ETL plus UI with no schema change. `splitPolicy: never-split`, `autonomy: attended`: the owner moved the switch into 1.12 (2026-10-09), so it stays one task.

### Test strategy

- **AC-1:** `etl/test_extract.py` `VolumeRules.test_writes_the_approved_rules_with_a_year`: a map with a run-scoped rule (run `a`), an any-run rule, and an approved row with no year. `seed/volume_rules.csv` holds exactly the first two, `run_id` empty on the second. Manual: `npm run rebuild` (development, asked first) reports `volume_rules` = 66, the approved rows in `volume_map.csv`.
- **AC-2:** in the same case, `test_header_and_nulls`: header equals `series,run_id,issue_from,issue_to,year`; a range rule keeps `issue_from`/`issue_to`, and an any-issue rule leaves them empty. Plus `test_rule_for_unknown_run_is_flagged_not_written`. `test/load-scripts.test.ts`: in both `load.ps1` and `load.sh`, the `volume_rules` `\copy` comes after the `runs` `\copy`, `volume_rules` is in the TRUNCATE list, and the `LEDGER_LIVE` refusal is still there before any `psql`; both rebuild twins list `volume_rules`. The NULL load is shown by the manual rebuild (`SELECT count(*) FROM volume_rules WHERE run_id IS NULL` = 62).
- **AC-3:** `test/bulk-parse.test.ts` checks that `Captain America #1` with several years and no rule is `ambiguous_volume`. `test/review-table.test.tsx` checks the switch appears only after a year is picked, named *Always use 2004 for Captain America*. `test/bulk-insert.test.ts` *the Always use switch* covers three cases: on and confirmed writes exactly one row (`series 'Captain America'`, `run_id`, `issue_from`, `issue_to` NULL, `2004`) in the insert's transaction; switched off writes none; nothing confirmed writes none.
- **AC-4:** `test/bulk-insert.test.ts`: with the rule in the table, `parseBulk('Captain America #2', { rules: await queries.volumeRules(), runId: <another run> })` has no `ambiguous_volume` flag and the label `Captain America (2004) #2`. The existing *a throw inside `within`* test is extended to send a rule and assert `volume_rules` is unchanged. `test/bulk-parse.test.ts` covers the run's own rule beating an any-run rule, a range rule only inside its range, and the annual rule.
- **AC-5:** `test/review-table.test.tsx`: `role="switch"`, the accessible name, `aria-checked` toggling on click, Space and Enter. ui-verifier screenshots an ambiguous row with the switch at every `ui.viewports` width, light and dark, and checks the target (≥ 24px; the `.switch` rule is 44px).
- **AC-6:** run `npm run extract` into a temporary folder on `main`'s `etl/extract.py` and on the branch, then compare every CSV other than `volume_rules.csv` byte for byte (`Get-FileHash`). The PR quotes the summary.

### Risks

- The rule-resolved year is shown as *Volume year filled from your map.* and can't be changed in the row (type the year to override); 3.9 adds the change.
- A rule staged on a row that writes nothing (every label already in the run) isn't sent: the confirm is blocked when the count is 0.
- `knownSeries` folds annuals into their series, so an annual line's switch names `<Title> Annual`, the series extract's rules use.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
