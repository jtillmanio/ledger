# implement-task: Ledger

- **Verification (D-97, D-141): one local chain; the browser suite is CI's.**
  `verify.full` is `npx tsc --noEmit`, `npm run lint`, `npm run test:no-e2e`.
  No local run of the whole browser suite and no local build: CI runs both,
  every project on four shards, in about 10 minutes.
  - Before the first run, check cheaply: run the test files the task added or
    changed (`node scripts/test-files.mjs <files>`; vitest, SQL and Python as
    they are, browser specs in one project, `w390-light`; add
    `-- -g "<fragment>"` for some tests, `-- --project=<p>` for a test tagged
    `@at-<p>`). A spec that sets its own viewport and theme (the three-width,
    two-theme screenshot tests) covers the widths in that one project. A task
    that changes `test/e2e/helpers.ts` runs `test/e2e/harness.spec.ts` too.
    And grep `test/`, `etl/test_*.py` and `etl/test_views.sql` for every
    table, column, view, function, CLI flag, command line and file name the
    diff adds, renames or removes: some tests pin a list (the catalog columns
    in `etl/test_views.sql`, the auditor's command in `test/e2e-guard.test.ts`)
    and fail only in the full suites.
  - Then run `verify.full` until it passes; every later round (after a CI,
    audit or review fix, and the Phase 7 gate when code changed) runs it
    again, with the touched specs in one project when the fix touched UI or a
    spec.
  - Record each round in the Review log: `Verify R1 PASS | CI R1 FAIL
    (status.spec.ts:82, w768-light) → fixed | Verify R2 PASS | CI R2 PASS`.
- **Run the chain yourself, in the background; don't delegate it to
  test-runner.** One shell command with `run_in_background`, all output to a
  log in the session temp folder, e.g. (Bash)
  `{ npx tsc --noEmit && npm run lint && npm run test:no-e2e; } > <temp>/verify-r1.log 2>&1`.
  Don't poll it. When it reports, read the log's last 60 lines, then only the
  failing step's part (`.claude/project/test-runner.md` says how each tool
  reports a failure and where the location is). The test-runner agent spent
  most of its tokens waiting on the suite.
- **Push the PR at the end of Phase 3, without asking, ready for review
  (D-145).** In attended mode too, as soon as `verify.full` and the touched
  specs have passed and the checkpoint commit is made, push the task branch
  and open the PR with `gh pr create` **without `--draft`** (skip the "Push
  and open a draft PR?" question; owner, 2026-10-09, 2026-11-10 and
  2026-11-11; `.claude/rules/git.md` § *Push and open the PR*: the local gates
  have passed by then). A PR that is ready for review runs every project from
  its first push, so it needs no `e2e:full` label, and Claude's PR review
  starts alongside CI. Phase 7's `gh pr ready` is then already done: skip it.
  Don't wait for the test audit, the reviews or the close-out. Write the
  body's **What**, **Why** and **How it was verified** now and mark
  **Follow-ups** as pending; at close-out, push the close-out commit and
  rewrite the body with `gh pr edit <n> --body-file`. The Phase 7 gates are
  judged on the close-out head; CI skips the browser suite there when only
  docs changed since a run that passed every project (D-145), and the gate
  reads that run. The floor is unchanged: never push to or merge into
  `main`, never force-push, never start Release.
- **No separate "link follow-ups" commit (D-145).** The PR exists from
  Phase 3, so at close-out write `PR #<n>` straight into every placement where
  the kit would write the branch name (`track-follow-ups/classify.md`), in the
  close-out commit itself. Every push to a task branch is a CI run; this one
  only renamed a link.
- **Ready for review is not "ready to merge".** The owner reads the checks
  before merging. When Claude stops without the gates green (past
  `workflow.maxCiFixRounds`, an `ownerFix`, Blocked), it turns the PR back
  into a draft with `gh pr ready <n> --undo` and says why, so a red PR never
  looks finished.
- **Watch CI from the first push, and fix what fails (owner, 2026-11-10).**
  Watch each run in the background (`gh run watch <id> --exit-status`,
  `run_in_background`) while the audit and reviews go on; don't sit on it.
  When it fails, act on it straight away, whatever phase you are in:
  1. Read the failure where it lives: `gh run view <id> --log-failed`, and
     for a browser failure the merged HTML report in the run's `e2e-report`
     artifact (`gh run download <id> -n e2e-report`). Note the spec, the line,
     the test and every project it failed in.
  2. Reproduce it locally in one failing project:
     `node scripts/test-files.mjs <spec> -- --project=<p> -g "<fragment>"`
     (`next dev`), or `npm run test:e2e:build -- <spec> --project=<p> -g "<fragment>"`
     when it looks like it needs a build (`next start`, as CI serves).
     If it won't reproduce, read the trace in the report before calling it
     a flake. A flake that comes from a test reading something that moves (a
     transition, a toast, a reload) gets the test fixed; a rerun alone is
     not a fix.
  3. Fix it on the branch, run `verify.full` and the reproduced test, commit,
     push, and watch the new run.
  Each push that answers a red run counts toward `workflow.maxCiFixRounds`
  (4), with Phase 7's rounds. Past it, stop: turn the PR into a draft
  (`gh pr ready <n> --undo`) and report
  what still fails and what you tried. If the fix needs the owner (a gate's
  `ownerFix`, a secret, a Neon branch), stop and say so rather than loop.
- **After the push: reviewers, then the audit, then ui-verifier.** Start
  spec-reviewer and (when it applies) schema-reviewer together in the
  background on the pushed commit; they read files and git. The test-auditor
  runs when they have reported, because it swaps pre-task files into the
  tree they read; ui-verifier runs after the auditor has put the tree back.
  CI runs alongside all of it. A fix any of them forces goes through
  *Review round 2* below and is pushed like a CI fix.
- **ui-verifier runs against the development database without asking.** The
  dev server (`npm run dev`) reads `.env` `DATABASE_URL`. The owner allows the
  ticks, unticks and undos a UI check makes there, as long as it leaves the data
  as it found it (CLAUDE.md, *Stop and ask before*). Production is never touched.
- **Before Phase 2, check the model (attended only).** Compare the task's
  `model:` front matter with the model this session runs on (the system prompt
  names it). If they differ, stop before writing any code and say:
  "TASK-### is `model: <x>`; this session is <y>. Run `/clear`, `/model <x>`,
  then `/implement-task TASK-###`." The plan is already saved in the task file,
  so the new session skips Phase 1. Carry on only if the owner says to. The
  check matters most for `sonnet` tasks in an Opus session: implementing on
  Sonnet is the cheaper path the field exists for. Unattended sessions skip it:
  `dispatch-approved.ps1` already starts them on the task's model.
- **Review round 2 re-reads only what changed (D-97).** Re-run a reviewer that
  returned anything but APPROVE, and one whose files the fixes touched
  (spec-reviewer: any; schema-reviewer: migrations, `src/db/`, `etl/`, views,
  queries; ui-verifier: UI files). Give it the fixes' diff
  (`git diff <commit it reviewed>..HEAD`) and its round-1 findings, not the
  whole task again. A reviewer whose files nothing touched since it approved
  isn't re-run; say so in the Review log. The close-out follow-ups check is
  unchanged.
