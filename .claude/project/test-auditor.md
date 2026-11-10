# test-auditor: Ledger

## Reading this stack's output

`testAudit.run` is `node scripts/test-files.mjs {tests}`. It prints `> <command>` before each step: `npm run test:db:reset` first whenever a vitest or SQL file is in the list (so the test database matches the restored pre-task schema), then one `npx vitest run …`, then `npm run test:views`, then one `py -m unittest discover -s etl -p <file>` per Python file. Every test step runs even when an earlier one fails. Exit 2 with `no runner for <path>` means a changed file matched `testPathPatterns` but no runner: report it, don't guess a command. A failed reset stops the run before any test: that is **NOT RUN**, not a test result.

## Browser specs: one project, only the tests that changed

A browser spec (`test/e2e/*.spec.ts`) is the slow part of an audit: the whole spec in the six core projects took TASK-064's audit past 30 minutes. What the audit asks, whether each new or changed test fails without the change, is answered in one project.

- `node scripts/test-files.mjs <spec>` runs specs in `w390-light` (`DEFAULT_E2E_PROJECT` in `scripts/lib/test-files.mjs`) and prints the `> node scripts/e2e.mjs … --project=w390-light` command it runs. Don't add the other projects.
- Run only the tests the task added or changed, never the rest of a changed spec: everything after `--` goes to Playwright, so `node scripts/test-files.mjs test/e2e/status.spec.ts -- -g "Plan a book"`. `-g` is a regular expression over the test's full title; give a plain fragment of each title, and join several with `|` (`-g "Undo puts it back|No quarter yet"`). The script refuses a fragment holding `"`, `%`, `$`, a backtick or a trailing backslash (exit 2): pick a different fragment.
- A test tagged `@at-<project>` runs only in that project, so `-- --project=<project> -g "…"` for it, in a call of its own. `@at-w390-light` is the default already. Playwright exiting with `No tests found` means the fragment or the project missed: that is **NOT RUN**, not a pass or a fail.
- A spec's post-task result is the implementer's full chain (the core projects, against a build), logged in the task's Review log as `Verify R1 … full PASS`. Run browser specs only against the pre-task code; if the log shows no passing full chain, run the same one-project command on the restored tree and say why.
- Vitest, SQL and Python files are unchanged: run them as before (they take seconds).

`etl/data/*` sidecars and `seed/` are **other**, never implementation, even though `testAudit.implementationExtensions` lists `.py` and `.sql`.

Telling an assertion failure (**DISCRIMINATING**) from a load failure (**FAILS-TO-LOAD**):

- **vitest**: `FAIL  test/x.test.ts > describe > test name` with `AssertionError: expected … to …` and `- Expected` / `+ Received` is an assertion. `FAIL  test/x.test.ts [ test/x.test.ts ]` with no test name, from `Failed to resolve import`, `Cannot find module` or `does not provide an export named`, is a load failure. Location: `❯ test/x.test.ts:48:12`.
- **`etl/test_views.sql`** (through `scripts/sql.mjs`): `etl/test_views.sql: FAILED (test)` then one message. A `RAISE EXCEPTION` text (`run_span counts wrong: …`) is an assertion; `relation "…" does not exist`, `column "…" does not exist` or `function … does not exist` means the view or column the task adds is missing, which is a load failure. The file runs as one batch and stops at its first failure, so it is one test unit: find which `DO` block failed by searching the file for the message's fixed text.
- **Python `unittest`**: `FAIL: test_name (test_x.Class.test_name)` with `AssertionError` is an assertion. `ERROR:` with `ImportError`, `ModuleNotFoundError`, or `AttributeError: module '…' has no attribute`, often on `unittest.loader._FailedTest`, is a load failure. Summary: `Ran N tests`, then `OK` or `FAILED (failures=…, errors=…)`.
- **`check-tokens.mjs`, `check-migrations.mjs`**: these are gates in `verify.full`, not test files, and are never passed to `testAudit.run`. A task changing either script has its tests in `test/` (e.g. `test/migrations-check.test.ts`); audit those. Their own output is `test:tokens — N failure(s):` and `check:migrations found N problem(s):`, one line per problem; `note` lines are not failures.
