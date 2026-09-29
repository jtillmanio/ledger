---
name: verify
description: Full local verification gate for the Ledger — typecheck, lint, tests, build. Run before opening any PR.
---

# Verify

Run these in order and report the actual output, not a summary. Stop at the
first failure and fix the root cause rather than suppressing the error.

```bash
npx tsc --noEmit
npx eslint . --max-warnings 0
npm test
npm run build
```

If the schema changed in this branch, also confirm the views still apply:

```bash
npm run test:db:reset
```

Then show evidence: the commands you ran and what they returned. Do not assert
success without it.
