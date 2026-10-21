<!-- /implement-task fills this in. For PRs you open yourself, fill what applies.
     Sections and title follow .claude/rules/git.md: the title is a commit subject
     (`task 1.2: add undo`), and this body is what main keeps after the squash. -->

## What

<!-- The change in a few bullets. Task work: "Task 1.2 Undo (docs/tasks/TASK-###-undo.md)". -->
-

## Why

<!-- The problem, with task, decision and review IDs (task 1.2, D-18, R2-03). -->

## Acceptance criteria

<!-- The task's **Check:** from docs/05-roadmap.md, verbatim, then the task file's ACs; tick each when verified. -->
- [ ] Check:
- [ ] AC-1:

## How it was verified

<!-- One row per reviewer, then one row per ready gate (workflow.readyGates), in order. Owner gates say "owner". -->

| Check | Where | Result |
|---|---|---|
| `/verify` (tsc, lint, `test:all`, build) / test-runner | local | |
| The task's **Check:**, as written | local | |
| test-auditor | local | |
| spec-reviewer | local | |
| schema-reviewer | local | n/a |
| Up → down → up (drop or retype migrations) | local | n/a |
| ui-verifier | local dev server | n/a |
| CI `check` | GitHub | see checks below |
| Vercel preview deploys | Vercel | |
| Lighthouse (no route over budget) | GitHub, on the preview | |
| Preview walked at 360–412px against the mockup / feel pass | preview | n/a |
| Changed workflow, `gh workflow run <file> --ref <branch>` | GitHub | n/a |

<!-- Say which suites ran locally and which only in CI. Anything that can only be
     checked after merge: name it, why, and the exact check to run straight after.
     Screenshots from ui-verifier, if any. -->

### Manual verification (owner)

<!-- Steps from the task's Verification section, each with its expected result -->
1.

## Follow-ups

<!-- Work noticed and deliberately left out (copied from the task file's ## Follow-ups). Each bullet ends with
     where it was placed, per workflow.followUps (.claude/skills/track-follow-ups/classify.md), or why not:
       - A range like #5-5 should say why it is rejected → docs/05-roadmap.md § 1.3c
       - Candidate decision: suggestions use pg_trgm's 0.3 threshold → docs/review/decisions.md § D-59 (approved at close-out)
       - Set the RESEND_API_KEY secret in production → docs/OWNER-CHECKLIST.md § Actions from follow-ups
       - Leading zeros aren't canonicalised → not tracked: done in this PR (plan revision)
     workflow.decisions is "propose": a candidate decision is recorded only once the owner approves it;
     until then it waits under Approvals from follow-ups, and the bullet says so.
     Review-finding IDs this PR addresses or opens. -->
-

## Reviewer checklist (owner)

- [ ] Ran the manual steps above and got the expected results
- [ ] Every owner gate in the table above has passed
- [ ] Diff contains only what the task asked for (no surprise files), plus the follow-up placements listed above
- [ ] Each follow-up went where the work that will do it will read it (move or drop any you disagree with)
- [ ] No secrets, `.env*`, `seed/`, `backups/`, protected files or production config touched
- [ ] The task's checkbox in `docs/05-roadmap.md` is ticked in this PR
- [ ] Task file set to `status: Done` (reply "accepted" to the session) before merging. Accepting also moves it to `docs/tasks/archive/`; a hand edit leaves that to the next task's close-out
- [ ] After the squash merge, run Release (START-HERE Step 13) to put it live
