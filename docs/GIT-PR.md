# Testing on the branch and opening the PR

The detail behind `.claude/rules/git.md` § *Test on the branch* and
§ *Push and open the PR*, kept out of the rules file so it doesn't load into
every session. Read it before pushing a branch or writing a PR body. Where the
two disagree, `git.md` wins and the disagreement is a bug to fix.

## Test on the branch, before merge

A PR is mergeable only when everything that can prove the change has run
**against the branch** and passed. `workflow.readyGates` is the enforced list,
in order: `verify.full` on the branch head, CI `check`, the full browser suite,
the Vercel preview, Lighthouse, a changed workflow run on the branch, and the
owner's preview walk for UI. Claude opens its PRs ready for review (D-145), so
CI checks every project from the first push (a draft checks the core projects
until it gets the `e2e:full` label, D-80). Claude watches that run in the
background rather than waiting on it, and fixes a failure on the branch
(`gh run view <id> --log-failed`, reproduced locally in the failing project)
and pushes again. Every push to `main` always gets the full suite. A later
push that adds only docs (a close-out, an accept) skips the browser suite and
the build when an earlier run on the branch passed every project and nothing
else differs, `main` included (D-145): the scope job's log names that run.
Claude tells the owner the PR is done only when every gate it can check has
passed, and lists the owner's gates in its report; when it stops with one
failing, it turns the PR into a draft (`gh pr ready <n> --undo`).
"It will show up on `main`" is not a test:
a failure found after merge means reverting `main`. Run every suite that
applies, not just the one nearest the change.

Before pushing, locally:

- `/verify`: typecheck, lint, `npm run test:no-e2e` (tokens, migration
  checks, test-db reset, vitest, SQL view tests, ETL unittests), and the
  browser specs the branch added or changed in one project
  (`node scripts/test-files.mjs <specs>`). The whole browser suite and the
  build run only in CI (D-141): its every-project run is the gate.
- A branch that changes only docs, `.claude/`, `backups/` or root markdown
  runs `npm run verify:docs` instead of `/verify` (D-145): every vitest,
  unittest or SQL test that names a changed file (some pin what a doc says),
  and the task-file parse when a task file changed. It exits 2 and runs
  nothing when the branch changes anything else.
- The task's own **Check:** from `docs/05-roadmap.md`, exactly as written.
- Schema or query changes: the `schema-reviewer` subagent (CLAUDE-CODE.md §3,
  phase 4). Phases 1 and 3 also get the adversarial review pass (standing
  rule 5, `docs/06-tasklist.md`).
- Migrations that drop or retype a column: the up → down → up test.
- Anything else the change touches that has a test path: an ETL script's
  `--dry-run`, `npm run sidecars` after a sidecar change, and, once they
  exist, the e2e and axe runs a task names. `test/perf.test.ts` (in `npm test`)
  holds the Lighthouse job's gate, comment and route list to account (task 0.10).

After pushing, on GitHub:

- CI (`gh pr checks <n> --watch`) is green, and the Vercel preview deploys.
  When the head is a docs-only push after a build (a close-out), Vercel skips
  it: its *Vercel* check reads *Canceled by Ignored Build Step*, and
  **Preview (last build)** (`preview-link.yml`) links to the earlier build,
  which serves the same app. That pair passes the preview gate.
- **Lighthouse** (`.github/workflows/lighthouse.yml`, task 0.10) runs on that
  preview once it deploys and is green, and its PR comment shows nothing over
  budget. It fails on a route handler requested during a load or prefetch,
  bytes or requests over `scripts/perf/budget.json`, CLS of 0.1 or more, or an
  accessibility score under the recorded one. A new top-level screen adds its
  route to `scripts/perf/routes.mjs` and its budget in the same PR.
- **A docs-only PR has neither gate.** A PR that changes only backups, docs,
  design, CI or Claude config (`needsBuild` in `scripts/lib/release.mjs`) gets
  no Vercel build, from its first push (the ignore step compares with `main`'s
  tip), and Lighthouse's `plan` measures nothing on it. Its `check` still runs,
  without the browser suite and the build. A PR that changes
  `lighthouse.yml` is always measured. To build a skipped commit anyway,
  Redeploy it with *Use project's Ignore Build Step* unticked (START-HERE 10e).
- UI changes: open the Vercel preview at 360–412px and walk the changed screen
  and its states against `design/mockups.html`. Say what you looked at.
- A changed workflow runs on the branch before merge:
  `gh workflow run <file> --ref <branch>`, then `gh run watch <id> --exit-status`.
  A workflow with only a `schedule` trigger gets `workflow_dispatch` so it can
  be run. If the run has side effects (the backup commits a dump to the branch),
  say so in the PR. Workflows triggered by `pull_request` are tested by the PR
  itself.

Tests only ever touch `TEST_DATABASE_URL`. If it is not set locally, say which
suites ran locally and which ran only in CI. Never point a test at
`DATABASE_URL` to get it to run.

Something that truly can't run before merge (a Neon-only behaviour, the
production deploy) is named in the PR under **How it was verified**, with the
exact check to run straight after merge. That is the exception, and it needs a
reason.

A test suite added by a task goes into `npm run test:all` (or CI) and into the
list in the same PR, so the next branch runs it too.

Tick the task's checkbox in `docs/05-roadmap.md` in the same PR.

## Push and open the PR

```bash
git push -u origin <branch>
gh pr create --base main --title "<same form as a commit subject>" --body-file <file outside the repo>
```

Once the local gates in *Test on the branch* pass, push and open the PR
without asking first, attended or not (owner, 2026-10-09). The owner reviews
the PR, not a prompt before it exists. Pushing to `main`, force-pushing and
merging still never happen without the owner.

The PR opens ready for review (owner, 2026-11-11, D-145), which starts the
full browser suite and Claude's PR review at once; a `[BLOCKED]` PR opens as a
draft. Ready for review is not ready to merge: the owner merges once the gates
in *Test on the branch* are green.

The PR body has these sections:

- **What**: the change in a few bullets.
- **Why**: the problem, with task, decision and review IDs.
- **How it was verified**: each suite and check from *Test on the branch*, run
  where (locally, CI, a workflow run on the branch with its link, the preview),
  and what it returned. Anything that could only be checked after merge, and why.
- **Follow-ups**: anything noticed and deliberately left out. Every bullet
  ends `→ <path> § <section>` or `→ not tracked: <reason>`.

End it with the attribution line the session gives you. Then watch CI with
`gh pr checks <n> --watch` and fix a red check on the same branch with a new
commit. Tell the owner the PR is ready only once every check in *Test on the
branch* has passed.

