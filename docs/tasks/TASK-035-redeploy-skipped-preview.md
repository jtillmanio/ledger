---
id: TASK-035
title: 0.12 A redeploy of a skipped preview builds
status: Ready
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-035 — 0.12 A redeploy of a skipped preview builds

## Goal

The owner can make Vercel build a commit whose own build the ignore step skipped (for example, to pick up a changed environment variable), while a docs-only push after a build is still skipped.

## Context

- Roadmap: `docs/05-roadmap.md` § 0.12 A redeploy of a skipped preview builds (M2, after 0.10; not in a sitting). The roadmap entry and its **Check:** are the contract. The roadmap says "a `chore/` branch"; the kit names task branches `task/{id}-{slug}`, so this is `task/0.12-redeploy-skipped-preview`.
- Found on PR #76 (task 1.4, 2026-10-12): the owner's **Redeploy** of `1726706` was cancelled because the diff against `dfefc67`, the branch's last successful deployment, was still docs-only.
- The bug: `scripts/vercel-ignore.mjs`'s header says *a redeploy changes nothing, so it always builds*. That holds only when the commit being redeployed is the one last deployed. Vercel's `VERCEL_GIT_PREVIOUS_SHA` is the SHA of the branch's last **successful** deployment, not the commit being redeployed, so a commit whose own build was skipped diffs against an older deployment and is skipped again. `ignoredBuildStep` and `deploymentNeedsBuild` in `scripts/lib/release.mjs` carry the same assumption in their comments; `test/release.test.ts` § "builds a redeploy, where nothing changed" covers only the empty-diff case.
- Today there is no way to force a build of such a commit short of pushing an app-code change.
- **For the plan gate:** which route forces the build. The roadmap allows either a value the ignore step can read (a Vercel system environment variable or deployment property, if Vercel exposes one that tells a redeploy from a push; check Vercel's current documentation, don't assume), or an owner-set environment variable plus a documented procedure. If it is an owner-set variable, the plan says its name, which Vercel environments and branches it is set for, and how it is turned off again so later docs-only pushes skip. Vercel's *Use existing Build Cache* toggle and `VERCEL_FORCE_NO_BUILD_CACHE` control the build cache, not the ignore step: they are not this route.
- Where the ignore step is documented: `docs/START-HERE.md` § 10e. Releases (the *Canceled in Vercel's Deployments tab* paragraph) and § 10f (redeploying after a Neon branch is deleted); `docs/GIT-PR.md` (*A docs-only PR has neither gate*). START-HERE § 10e's step 4 says to *redeploy an open PR's preview* after changing `APP_PASSCODE`: that is the case this task makes work.
- Decisions: D-18, D-49 (a merge is not a deploy; Release promotes). Architecture: `docs/02-architecture.md` § Hosting row (Vercel, a preview per PR).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a redeploy, or the documented force route, of a commit whose own build was skipped builds it. A docs-only push after a build is still skipped. `scripts/vercel-ignore.mjs`'s header says what `VERCEL_GIT_PREVIOUS_SHA` is.
- [ ] AC-2: In `test/release.test.ts`, given a fake git whose diff against the previous deployment is docs-only (`["docs/05-roadmap.md"]`), `ignoredBuildStep` with the force route's input present returns `build: true` with a `why` that names the force route; the same diff without it returns `build: false` (expected: the existing `"only backups, docs, design, CI or Claude config changed since abc1234"`). Every existing `ignoredBuildStep` and `deploymentNeedsBuild` test still passes unchanged.
- [ ] AC-3: Given the force route is in its off state (unset, or whatever the plan names), a docs-only diff against a previous deployment skips and a first push of a docs-only branch skips (both asserted in `test/release.test.ts`), so leaving the route off costs no builds.
- [ ] AC-4: `scripts/vercel-ignore.mjs`'s header and the `ignoredBuildStep` / `deploymentNeedsBuild` comments in `scripts/lib/release.mjs` say that `VERCEL_GIT_PREVIOUS_SHA` is the branch's last successful deployment, that a redeploy of a skipped commit compares against it, and name the force route; none still says a redeploy always builds.
- [ ] AC-5: `docs/START-HERE.md` § 10e has the force route as owner steps (where to set it, the Redeploy, how to turn it off), next to the *Canceled* paragraph, and § 10e step 4's and § 10f's *redeploy* instructions point to it. `docs/GIT-PR.md`'s docs-only bullet mentions it in one line.
- [ ] AC-6: On this task's own PR, after a build: a docs-only commit pushed to the branch shows **Canceled** in Vercel with a log line starting `skip:`; the force route applied to that same commit gives a deployment whose log starts `build:` and whose `why` names the force route; with the route turned off again, a second docs-only push shows **Canceled**. The PR's *How it was verified* records the three deployments' commits and outcomes.

## Out of scope

- Changing what counts as docs-only: the `NO_BUILD` list and `needsBuild` in `scripts/lib/release.mjs`, which Release also reads.
- Release (`scripts/release.mjs`, `.github/workflows/release.yml`): how it chooses what to promote, or whether a docs-only merge to `main` gets a production build.
- Lighthouse's `plan` step deciding whether a preview is measured (task 0.10, `.github/workflows/lighthouse.yml`).
- Vercel's build cache, and `scripts/vercel-build.mjs` (migrate, views, `next build`).
- Calling the Vercel API from the ignore step: it would need a token in every build's environment.

## Files likely touched

- `scripts/vercel-ignore.mjs`: the header comment; pass the force route's input to `ignoredBuildStep`.
- `scripts/lib/release.mjs`: `ignoredBuildStep` (and its comments, and `deploymentNeedsBuild`'s) honour the force route.
- `test/release.test.ts`: the forced and unforced docs-only cases.
- `docs/START-HERE.md` § 10e and § 10f: the owner's steps.
- `docs/GIT-PR.md`: one line on the docs-only bullet.

## Verification

- Automated: `test/release.test.ts` § `ignoredBuildStep (scripts/vercel-ignore.mjs)` gains a case that fails before the change (a docs-only diff with the force route present builds) and a case that pins the off state (still skips). `npm test` and `verify.full` green.
- Manual (AC-6, on the PR's Vercel preview, the owner or Claude with the owner's Vercel access): push a docs-only commit after a build → expected: **Canceled**, log `skip: only backups, docs, design, CI or Claude config changed since <sha>`. Apply the force route to that commit → expected: a **Ready** deployment whose log starts `build:` and names the route. Turn it off and push another docs-only commit → expected: **Canceled**.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
