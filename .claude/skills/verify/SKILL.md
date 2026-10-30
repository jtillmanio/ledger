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
```

`test:all` is `test:no-e2e`, then `test:e2e:build`. `test:no-e2e` holds
`test:tokens`, `check:migrations` (journal, down files, ungenerated schema
changes, edits to migrations already on `main`), `test:db:reset` (migrations
plus `etl/views.sql` on the test database), vitest, `test:views` and
`test:etl`. `test:e2e:build` runs `next build`, then the browser suite's core
projects against `next start` over that build (D-97), so there is no separate
build step. It needs `TEST_DATABASE_URL`. If that is unset, run the suites that
don't need a database (`test:tokens`, `check:migrations`, `test:etl`), say
plainly that the others ran only in CI, and never point them at
`DATABASE_URL`.

**Don't run the same thing twice (D-97).** Run it as one background shell
command with its output in a log in the session temp folder, and read only the
tail and the failing step.

- If this session already ran this chain and it passed, and no file has changed
  since (the commit right after a passing run is the usual case), cite that run
  instead of running it again.
- During a task, once the full chain has passed, later re-runs are the round
  chain: `npx tsc --noEmit`, `npx eslint . --max-warnings 0`,
  `npm run test:no-e2e`. Say which chain you ran. The browser suite on the
  branch head is CI's (`.claude/project/implement-task.md`).

This is the local half of *Test on the branch* in `.claude/rules/git.md`. CI,
the Vercel preview and any changed workflow still have to pass on the branch.

Then show evidence: the commands you ran and what they returned. Do not assert
success without it.
