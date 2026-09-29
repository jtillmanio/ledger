---
name: verify
description: Full local verification gate for the Ledger — typecheck, lint, every test suite CI runs, build. Run before pushing any branch.
---

# Verify

Run these in order and report the actual output, not a summary. Stop at the
first failure and fix the root cause rather than suppressing the error.

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
npm run test:all
npm run build
```

`test:all` is the same set CI runs: `test:tokens`, `check:migrations` (journal,
down files, ungenerated schema changes, edits to migrations already on `main`),
`test:db:reset` (migrations plus `etl/views.sql` on the test database), vitest,
`test:views` and `test:etl`. It needs `TEST_DATABASE_URL`. If that is unset, run
the suites that don't need a database (`test:tokens`, `check:migrations`,
`test:etl`), say plainly that the others
ran only in CI, and never point them at `DATABASE_URL`.

This is the local half of *Test on the branch* in `.claude/rules/git.md`. CI,
the Vercel preview and any changed workflow still have to pass on the branch.

Then show evidence: the commands you ran and what they returned. Do not assert
success without it.
