# implement-task: Ledger

- **Push the draft PR at the end of Phase 3, without asking.** In attended
  mode too, as soon as the full chain has passed and the checkpoint commit is
  made, push the task branch and open the draft PR (skip the "Push and open a
  draft PR?" question; owner, 2026-10-09 and 2026-11-10; `.claude/rules/git.md`
  § *Push and open the PR*: the local gates have passed by then). Don't wait
  for the test audit, the reviews or the close-out: CI's core run, the Vercel
  preview and Lighthouse then run while they do, and a CI-only failure (a
  width or theme the core projects skip) turns up sooner. Write the body's **What**, **Why** and **How it was
  verified** now and mark **Follow-ups** as pending; at close-out, push the
  close-out commit and rewrite the body with `gh pr edit <n> --body-file`.
  CI reruns on every push (its scope is the whole PR's diff against `main`),
  so the gates in Phase 7 are judged on the close-out head, as before: add
  `e2e:full` only once that head is pushed. Then go straight into the Phase 7
  ready gates. The floor is unchanged: the PR stays a draft until the gates
  pass, never push to or merge into `main`, never force-push, never start
  Release.
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
- **Verification rounds (D-97): the browser suite once per task.** Two
  chains. The *round chain* is `npx tsc --noEmit`, `npm run lint`,
  `npm run test:no-e2e`. The *full chain* is `verify.full` (typecheck, lint,
  `npm run test:all`, which builds and runs the core browser projects against
  `next start`).
  - Phase 3: run the round chain until it passes, then the full chain once.
    If only the browser suite fails, fix it, re-run only the failing tests,
    in a project each failed in:
    `npm run test:e2e:build -- <spec files> --project=<project> -g "<title fragment>"`,
    then the round chain. Not the spec in all six core projects: the full
    chain already ran the rest, and CI runs every project.
  - The full chain is the one time a task's specs run in the core projects
    locally. While writing and fixing, run a spec in one project
    (`node scripts/test-files.mjs <spec>` does that, in `w390-light`; add
    `-- -g "<fragment>"` for one test, `-- --project=<p>` for a test tagged
    `@at-<p>`). A spec that sets its own viewport and theme (the
    three-width, two-theme screenshot tests) covers the widths in that one
    project.
  - Every later re-run (after test-audit fixes, after review fixes, and the
    Phase 7 `verify.full` gate when code changed) runs the round chain. The
    browser suite on the branch head is CI's: the `e2e:full` gate.
  - Record which chain each round ran in the Review log (`Verify R1 round
    PASS → full PASS | R2 round PASS`).
- **Run the chains yourself, in the background; don't delegate them to
  test-runner.** One shell command with `run_in_background`, all output to a
  log in the session temp folder, e.g. (Bash)
  `{ npx tsc --noEmit && npm run lint && npm run test:no-e2e; } > <temp>/verify-r1.log 2>&1`.
  Don't poll it. When it reports, read the log's last 60 lines, then only the
  failing step's part (`.claude/project/test-runner.md` says how each tool
  reports a failure and where the location is). The test-runner agent spent
  most of its tokens waiting on the suite.
- **Commit before the full chain, and review while it runs.** Make the Phase 3
  checkpoint commit once the round chain passes, then start the full chain in
  the background and, alongside it, spec-reviewer and (when it applies)
  schema-reviewer on that commit: they read files and git, and the chain
  writes neither. Not ui-verifier (its dev server shares `.next` with the
  chain's build) and not the test-auditor (it swaps pre-task files into the
  tree the chain is building): both wait for the chain. A fix the chain, the
  audit or a reviewer forces goes through *Review round 2* below.
- **Before the first chain, check cheaply.** Run the test files the task
  touched (`node scripts/test-files.mjs <files>`; specs run in one project),
  and grep `test/`,
  `etl/test_*.py` and `etl/test_views.sql` for every table, column, view,
  function, CLI flag and file name the diff adds, renames or removes: some
  tests pin a list (the catalog columns in `etl/test_views.sql`) and fail only
  in the full suites.
- **Review round 2 re-reads only what changed (D-97).** Re-run a reviewer that
  returned anything but APPROVE, and one whose files the fixes touched
  (spec-reviewer: any; schema-reviewer: migrations, `src/db/`, `etl/`, views,
  queries; ui-verifier: UI files). Give it the fixes' diff
  (`git diff <commit it reviewed>..HEAD`) and its round-1 findings, not the
  whole task again. A reviewer whose files nothing touched since it approved
  isn't re-run; say so in the Review log. The close-out follow-ups check is
  unchanged.
