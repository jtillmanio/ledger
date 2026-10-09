# Git: branches, commits, PRs

Loaded for every session (no `paths`). The repo is private on a free plan, so
`main` has no branch protection: these rules are the only thing keeping it
clean. Follow them without being asked.

The kit's skills follow these rules through the switches in
`.claude/kit.json` (`workflow.staging`, `commitFormat`, `branchPrefixes`,
`taskBranch`, `readyGates`, `afterMerge`, `allowForceWithLease`); that file is
the one place they are set, and this one says what they mean here.

## Never commit to `main`

Every change, including a one-line doc fix, goes on a branch and reaches `main`
through a PR. Never `git commit` while `main` is checked out, never
`git push origin main`, never force-push `main`.

Start every piece of work from an up-to-date `main`:

```bash
git switch main
git pull --ff-only
git switch -c <branch>
```

If the working tree already has changes you did not make, leave them alone:
they are the owner's work in progress. Don't stash, reset or commit them.

## Branch names

Lowercase, hyphenated, one purpose per branch.

| Work | Branch |
|---|---|
| A task in `docs/TASKS.md` | `task/<id>-<slug>`, e.g. `task/1.3-bulk-entry-parser` |
| A bug outside a task | `fix/<slug>`, e.g. `fix/backup-pg18` |
| Docs only | `docs/<slug>` |
| Tooling, CI, deps, config | `chore/<slug>` |

Dependabot's own branches (`dependabot/...`, `.github/dependabot.yml`) are the
one exception to these names. Its PRs pass the same CI, and a merged bump is
not live until Release runs.

One task per branch, one branch per PR. A problem you notice that belongs to
another task goes in the PR description as a follow-up, not in this diff.

## Staging

Stage by path: `git add <file> <file>`. Never `git add -A`, `git add .` or
`git commit -a`: they sweep in the owner's unrelated edits, `.env` variants and
scratch files. Run `git status` and `git diff --staged` before every commit and
read what is actually staged. If a file holds both your change and the owner's
uncommitted edits, stage only your hunks (build a patch and
`git apply --cached`; `git add -p` is interactive and unavailable) or ask.

Never commit `.env*`, `seed/`, `etl/.metron-cache.sqlite`,
`etl/.fandom-cache.json` or anything under `backups/` (the nightly job owns it).

## Commit messages

```
<area>: <what the change does, imperative, lowercase>

<Why the change was needed and anything a reader of the diff cannot see:
the failure it fixes, the constraint it respects, what was ruled out.
Wrap at 72. Cite the IDs the docs use (task 1.3, D-18, R2-03).>

Co-Authored-By: ...
```

- Subject at most 72 characters, no trailing period, imperative ("add",
  "fix", "drop"; not "added" or "adds").
- `<area>` is the task for task work (`task 1.3: parse bulk-entry labels`),
  otherwise the part of the repo: `backup`, `ci`, `etl`, `db`, `views`,
  `ui`, `api`, `docs`, `deps`, `claude`.
- The body explains *why*. The diff already says what. Skip the body only when
  the subject says everything (`docs: fix typo in START-HERE 10d`).
- End with the attribution trailer the session gives you.
- Several commits per branch are fine and encouraged at natural checkpoints;
  the PR is squash-merged, so the PR title and description are what `main`
  keeps.
- Never `--no-verify`, never `--amend` a commit that is already pushed.

## Test on the branch, before merge

A PR is ready only when everything that can prove the change has run
**against the branch** and passed. `workflow.readyGates` is the enforced list,
in order: `verify.full` on the branch head, CI `check`, the Vercel preview,
Lighthouse, a changed workflow run on the branch, and the owner's preview walk
for UI. Claude marks a PR ready only when every gate it can check has passed,
and lists the owner's gates in its report. "It will show up on `main`" is not a test:
a failure found after merge means reverting `main`. Run every suite that
applies, not just the one nearest the change.

Before pushing, locally:

- `/verify`: typecheck, lint, `npm run test:all` (tokens, migration checks,
  test-db reset, vitest, SQL view tests, ETL unittests) and `next build`. It is
  the same set CI runs.
- The task's own **Check:** from `docs/TASKS.md`, exactly as written.
- Schema or query changes: the `schema-reviewer` subagent (CLAUDE-CODE.md §3,
  phase 4). Phases 1 and 3 also get the adversarial review pass (TASKS.md
  standing rule 5).
- Migrations that drop or retype a column: the up → down → up test.
- Anything else the change touches that has a test path: an ETL script's
  `--dry-run`, `npm run sidecars` after a sidecar change, and, once they
  exist, the e2e and axe runs a task names. `test/perf.test.ts` (in `npm test`)
  holds the Lighthouse job's gate, comment and route list to account (task 0.10).

After pushing, on GitHub:

- CI (`gh pr checks <n> --watch`) is green, and the Vercel preview deploys.
- **Lighthouse** (`.github/workflows/lighthouse.yml`, task 0.10) runs on that
  preview once it deploys and is green, and its PR comment shows nothing over
  budget. It fails on a route handler requested during a load or prefetch,
  bytes or requests over `scripts/perf/budget.json`, CLS of 0.1 or more, or an
  accessibility score under the recorded one. A new top-level screen adds its
  route to `scripts/perf/routes.mjs` and its budget in the same PR.
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

A test suite added by a task goes into `npm run test:all` (or CI) and into this
list in the same PR, so the next branch runs it too.

Tick the task's checkbox in `docs/TASKS.md` in the same PR.

## Push and open the PR

```bash
git push -u origin <branch>
gh pr create --draft --base main --title "<same form as a commit subject>" --body-file <file outside the repo>
```

The PR opens as a draft and is marked ready (`gh pr ready <n>`) only after the
gates in *Test on the branch*.

The PR body has these sections:

- **What**: the change in a few bullets.
- **Why**: the problem, with task, decision and review IDs.
- **How it was verified**: each suite and check from *Test on the branch*, run
  where (locally, CI, a workflow run on the branch with its link, the preview),
  and what it returned. Anything that could only be checked after merge, and why.
- **Follow-ups**: anything noticed and deliberately left out.

End it with the attribution line the session gives you. Then watch CI with
`gh pr checks <n> --watch` and fix a red check on the same branch with a new
commit. Tell the owner the PR is ready only once every check in *Test on the
branch* has passed.

## Merging

The owner merges, with **Squash and merge**. Don't merge your own PR unless
the owner says to for that PR. After a merge, `git switch main`,
`git pull --ff-only`, and delete the local branch.

Merging does not deploy. The owner runs the **Release** workflow (START-HERE
Step 13), which migrates the live database and promotes the build. Never start
it yourself, dry run included, unless the owner says to for that release: it
reads and writes the live database.

Rebase a branch on `main` only when it conflicts or is stale enough to matter;
after a rebase, push with `--force-with-lease`, never `--force`, and only to
your own branch.

## Project notes

- No branch protection is available on this repository (rulesets return 403
  on a private free-plan repo): these rules and the `Bash(...)` and
  `PowerShell(...)` deny rules in `.claude/settings.json` are the only guard.
- Files never to commit are listed under *Staging*: `.env*`, `seed/`, the
  Metron and Fandom caches, and `backups/`.
- `--force-with-lease` after a rebase is allowed (`workflow.allowForceWithLease`
  is `true`, G-19); plain `--force` is denied.
