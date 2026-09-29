# Git: branches, commits, PRs

Loaded for every session (no `paths`). The repo is private on a free plan, so
`main` has no branch protection: these rules are the only thing keeping it
clean. Follow them without being asked.

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

## Before pushing

- Code changes: `/verify` clean, and the task's own acceptance check run.
  Schema changes also get the `schema-reviewer` subagent (CLAUDE-CODE.md §3,
  phase 4).
- Docs- or workflow-only changes: say in the PR what was checked instead
  (YAML parses, links resolve, the runbook step was walked).
- Tick the task's checkbox in `docs/TASKS.md` in the same PR.

## Push and open the PR

```bash
git push -u origin <branch>
gh pr create --base main --title "<same form as a commit subject>" --body-file <file>
```

The PR body has these sections:

- **What**: the change in a few bullets.
- **Why**: the problem, with task, decision and review IDs.
- **How it was verified**: the commands run and what they returned; what could
  not be verified locally and how to verify it after merge (a GitHub Actions
  workflow, a Neon-only behaviour).
- **Follow-ups**: anything noticed and deliberately left out.

End it with the attribution line the session gives you. Then watch CI with
`gh pr checks <n> --watch` and fix a red check on the same branch with a new
commit.

## Merging

The owner merges, with **Squash and merge**. Don't merge your own PR unless
the owner says to for that PR. After a merge, `git switch main`,
`git pull --ff-only`, and delete the local branch.

Rebase a branch on `main` only when it conflicts or is stale enough to matter;
after a rebase, push with `--force-with-lease`, never `--force`, and only to
your own branch.
