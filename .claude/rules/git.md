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
| A task in `docs/05-roadmap.md` | `task/<id>-<slug>`, e.g. `task/1.3-bulk-entry-parser` |
| A bug outside a task | `fix/<slug>`, e.g. `fix/backup-pg18` |
| Docs only | `docs/<slug>` |
| Tooling, CI, deps, config | `chore/<slug>` |

Dependabot's own branches (`dependabot/...`, `.github/dependabot.yml`) are the
one exception to these names. Its PRs pass the same CI, and a merged bump is
not live until Release runs.

One task per branch, one branch per PR. A problem that belongs to another
task isn't fixed in this diff: it goes in the PR's Follow-ups, and is also
tracked where the work that will do it will read it, per
`workflow.followUps` (`.claude/skills/track-follow-ups/classify.md`). Three
kinds of change to other files are allowed on a task branch:

- **Roadmap ticks**, in the close-out or accept commit: this task's items in
  `docs/05-roadmap.md`, and items other Done tasks finished that are still
  open (`.claude/skills/sync-roadmap/ticks.md`). Only the mark changes; never
  an item's text or **Check:** line, never an untick.
- **Follow-up placements**, in the close-out commit (or a plans PR): a note
  in another task's Context, a `docs/05-roadmap.md` item, a decisions-log row, an
  approved planning-doc edit, an Owner checklist item. Each traces to a
  Follow-ups bullet; none changes another task's acceptance criteria or a
  **Check:** line.
- **Archiving**, with `workflow.archiveDone` on (the default): a task's
  close-out or accept commit, or a plans PR, also carries `git mv` renames
  of other Done task files into `docs/tasks/archive/`
  (`.claude/scripts/archive-done.ps1`). Never move them on `main`.

## Staging

Stage by path: `git add <file> <file>`. Never `git add -A`, `git add --all`,
`git add .` or `git commit -a`: they sweep in the owner's unrelated edits, `.env` variants and
scratch files. Run `git status` and `git diff --staged` before every commit and
read what is actually staged. If a file holds both your change and the owner's
uncommitted edits, stage only your hunks (build a patch and
`git apply --cached`; `git add -p` is interactive and unavailable) or ask.

Never commit `.env*`, `seed/`, `etl/.metron-cache.sqlite`,
`etl/.openlibrary-cache.sqlite`, `etl/.fandom-cache.json` or anything under
`backups/` (the nightly job owns it).

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
for UI. "It will show up on `main`" is not a test: a failure found after merge
means reverting `main`. Run every suite that applies, not just the one nearest
the change. A UI change includes the browser suite's core projects, with axe
(D-80): `npm run test:all` runs them against a fresh build
(`npm run test:e2e:build`), once per task (D-97); later local rounds run
`npm run test:no-e2e`. CI's `check` runs every width, light and dark
(`npm run test:e2e:full`), and that run is the gate.

Before pushing: `/verify` and the task's own **Check:** exactly as written.
After pushing: CI green, the preview deployed, Lighthouse green. **Read
`docs/GIT-PR.md` before pushing** for the full checklist: reviewers, the
up → down → up test, Lighthouse budgets, the UI preview walk, running a changed
workflow with `--ref`, and what goes in the PR when something can only be
checked after merge.

## Push and open the PR

```bash
git push -u origin <branch>
gh pr create --draft --base main --title "<same form as a commit subject>" --body-file <file outside the repo>
```

Once the local gates pass, push and open the draft PR without asking first,
attended or not (owner, 2026-10-09). Pushing to `main`, force-pushing and
merging still never happen without the owner. Mark it ready (`gh pr ready <n>`)
only after the gates above. The body has **What**, **Why**, **How it was
verified** and **Follow-ups** (every bullet ends `→ <path> § <section>` or
`→ not tracked: <reason>`), as `docs/GIT-PR.md` spells out, and ends with the
attribution line the session gives you.

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
  Metron, Open Library and Fandom caches, and `backups/`.
- `--force-with-lease` after a rebase is allowed (`workflow.allowForceWithLease`
  is `true`, G-19); plain `--force` is denied.
