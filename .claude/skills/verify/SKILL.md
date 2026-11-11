---
name: verify
description: Full local verification gate for the Ledger — typecheck, lint, every test suite CI runs except the browser suite, plus the browser specs the change touched in one project. Run before pushing any branch.
---

# Verify

Run these in order and report the actual output, not a summary. Stop at the
first failure and fix the root cause rather than suppressing the error.

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
npm run test:no-e2e
```

`test:no-e2e` holds `test:tokens`, `check:migrations` (journal, down files,
ungenerated schema changes, edits to migrations already on `main`),
`test:db:reset` (migrations plus `etl/views.sql` on the test database),
vitest, `test:views` and `test:etl`. It needs `TEST_DATABASE_URL`. If that is
unset, run the suites that don't need a database (`test:tokens`,
`check:migrations`, `test:etl`), say plainly that the others ran only in CI,
and never point them at `DATABASE_URL`.

**A docs-only branch skips this chain (D-145).** When every file the branch
changes is under `docs/`, `.claude/`, `backups/` or is root markdown, run
`npm run verify:docs` instead: it runs every vitest, unittest and SQL test that
names a changed file (some tests pin what a doc says, e.g. `e2e-guard` reads
`CLAUDE.md` and `.claude/kit.json`) and the task-file parse when a task file
changed. It exits 2 without running anything when the branch changes anything
else; then run the chain above. CI's `tests` job still runs whole on the PR.

**The browser suite is CI's (D-141).** Locally, run only the specs the branch
added or changed, in one project: `node scripts/test-files.mjs <specs>`
(`w390-light`; `-- -g "<fragment>"` for some tests, `-- --project=<p>` for a
test tagged `@at-<p>`). A branch that changes a shared e2e helper
(`test/e2e/helpers.ts`) runs `test/e2e/harness.spec.ts` too, where the
helpers prove themselves. CI's run on every project (`e2e:full`) is the gate: watch it and
fix what fails on the branch. `npm run test:all` (the build and the six core
projects) is still there for running by hand; no gate needs it.

**Don't run the same thing twice.** Run the chain as one background shell
command with its output in a log in the session temp folder, and read only the
tail and the failing step. If this session already ran it and it passed, and
no file has changed since (the commit right after a passing run is the usual
case), cite that run instead of running it again.

This is the local half of *Test on the branch* in `.claude/rules/git.md`. CI,
the full browser suite, the Vercel preview and any changed workflow still have
to pass on the branch.

Then show evidence: the commands you ran and what they returned. Do not assert
success without it.
