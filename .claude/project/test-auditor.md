# test-auditor: Ledger

## Reading this stack's output

`testAudit.run` is `node scripts/test-files.mjs {tests}`. It prints `> <command>` before each step: `npm run test:db:reset` first whenever a vitest or SQL file is in the list (so the test database matches the restored pre-task schema), then one `npx vitest run …`, then `npm run test:views`, then one `py -m unittest discover -s etl -p <file>` per Python file. Every test step runs even when an earlier one fails. Exit 2 with `no runner for <path>` means a changed file matched `testPathPatterns` but no runner: report it, don't guess a command. A failed reset stops the run before any test: that is **NOT RUN**, not a test result.

`etl/data/*` sidecars and `seed/` are **other**, never implementation, even though `testAudit.implementationExtensions` lists `.py` and `.sql`.

Telling an assertion failure (**DISCRIMINATING**) from a load failure (**FAILS-TO-LOAD**):

- **vitest**: `FAIL  test/x.test.ts > describe > test name` with `AssertionError: expected … to …` and `- Expected` / `+ Received` is an assertion. `FAIL  test/x.test.ts [ test/x.test.ts ]` with no test name, from `Failed to resolve import`, `Cannot find module` or `does not provide an export named`, is a load failure. Location: `❯ test/x.test.ts:48:12`.
- **`etl/test_views.sql`** (through `scripts/sql.mjs`): `etl/test_views.sql: FAILED (test)` then one message. A `RAISE EXCEPTION` text (`run_span counts wrong: …`) is an assertion; `relation "…" does not exist`, `column "…" does not exist` or `function … does not exist` means the view or column the task adds is missing, which is a load failure. The file runs as one batch and stops at its first failure, so it is one test unit: find which `DO` block failed by searching the file for the message's fixed text.
- **Python `unittest`**: `FAIL: test_name (test_x.Class.test_name)` with `AssertionError` is an assertion. `ERROR:` with `ImportError`, `ModuleNotFoundError`, or `AttributeError: module '…' has no attribute`, often on `unittest.loader._FailedTest`, is a load failure. Summary: `Ran N tests`, then `OK` or `FAILED (failures=…, errors=…)`.
- **`check-tokens.mjs`, `check-migrations.mjs`**: these are gates in `verify.full`, not test files, and are never passed to `testAudit.run`. A task changing either script has its tests in `test/` (e.g. `test/migrations-check.test.ts`); audit those. Their own output is `test:tokens — N failure(s):` and `check:migrations found N problem(s):`, one line per problem; `note` lines are not failures.
