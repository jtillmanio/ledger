---
id: TASK-035
title: 0.12 A redeploy of a skipped preview builds
status: Done
depends_on: []
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 13cc051
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

- [x] AC-1 (roadmap **Check:**, verbatim): a redeploy, or the documented force route, of a commit whose own build was skipped builds it. A docs-only push after a build is still skipped. `scripts/vercel-ignore.mjs`'s header says what `VERCEL_GIT_PREVIOUS_SHA` is.
- [x] AC-2: `test/release.test.ts` fails if `scripts/vercel-ignore.mjs` or `scripts/lib/release.mjs` still says a redeploy always builds, or if the `vercel-ignore.mjs` header does not say what `VERCEL_GIT_PREVIOUS_SHA` is (the branch's last successful deployment) or does not name the Redeploy dialog's *Use project's Ignore Build Step* box. Given a fake git whose diff against the previous deployment is docs-only (`["docs/05-roadmap.md"]`), `ignoredBuildStep` returns `build: false` (expected: the existing `"only backups, docs, design, CI or Claude config changed since abc1234"`). Every existing `ignoredBuildStep` and `deploymentNeedsBuild` test still passes unchanged. *(Reworded at the plan gate, 2026-10-29, owner-approved: the force route is Vercel's Redeploy box, which skips the ignore step, so the script reads no force input.)*
- [x] AC-3: Given the force route is in its off state (unset, or whatever the plan names), a docs-only diff against a previous deployment skips and a first push of a docs-only branch skips (both asserted in `test/release.test.ts`), so leaving the route off costs no builds.
- [x] AC-4: `scripts/vercel-ignore.mjs`'s header and the `ignoredBuildStep` / `deploymentNeedsBuild` comments in `scripts/lib/release.mjs` say that `VERCEL_GIT_PREVIOUS_SHA` is the branch's last successful deployment, that a redeploy of a skipped commit compares against it, and name the force route; none still says a redeploy always builds.
- [x] AC-5: `docs/START-HERE.md` § 10e has the force route as owner steps (where to set it, the Redeploy, how to turn it off), next to the *Canceled* paragraph, and § 10e step 4's and § 10f's *redeploy* instructions point to it. `docs/GIT-PR.md`'s docs-only bullet mentions it in one line.
- [x] AC-6: On this task's own PR, after a build: a docs-only commit pushed to the branch shows **Canceled** in Vercel with a log line starting `skip:`; the force route applied to that same commit gives a **Ready** deployment whose log has no `skip:` or `build:` line from the ignore step and shows `vercel-build (preview): migrate → views → next build`; then a second docs-only push shows **Canceled**. The PR's *How it was verified* records the three deployments' commits and outcomes.

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

- Automated: `test/release.test.ts` § `ignoredBuildStep (scripts/vercel-ignore.mjs)` gains comment tests that fail before the change (the header says what `VERCEL_GIT_PREVIOUS_SHA` is and names the *Use project's Ignore Build Step* box; no comment says a redeploy always builds) and a case that pins the skipped-redeploy diff (still skips). `npm test` and `verify.full` green.
- Manual (AC-6, on the PR's Vercel preview, the owner or Claude with the owner's Vercel access): push a docs-only commit after a build → expected: **Canceled**, log `skip: only backups, docs, design, CI or Claude config changed since <sha>`. Redeploy that commit with *Use project's Ignore Build Step* unticked → expected: a **Ready** deployment whose log has no `skip:` or `build:` line from the ignore step and shows `vercel-build (preview): migrate → views → next build`. Push another docs-only commit → expected: **Canceled**.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- `test/release.test.ts` line 26-27 still says a redeploy "builds the commit it last deployed" (an existing test's comment, left unchanged by AC-2) → not tracked: true for the commit the last deployment built, and the new comment tests state the rest.

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

**Route (owner's choice at the plan gate, 2026-10-29): Vercel's Redeploy dialog, box *Use project's Ignore Build Step* unticked.** Vercel's docs (Project settings § *Ignore Build Step on redeploy*) say unticking it skips the ignore step for that one redeploy, so it builds. No system environment variable tells a redeploy from a push (System environment variables: `VERCEL_GIT_PREVIOUS_SHA` is *the git SHA of the last successful deployment for the project and branch*), and an owner-set variable would be one more thing to turn off. Nothing to set, nothing to turn off. AC-2 and AC-6 reworded to match (owner-approved).

**Steps**
1. Test first, `test/release.test.ts`: (a) a test that reads `scripts/vercel-ignore.mjs` and `scripts/lib/release.mjs` and fails if either still says a redeploy always builds, or if the header does not say `VERCEL_GIT_PREVIOUS_SHA` is the branch's last successful deployment and name the *Use project's Ignore Build Step* box; (b) in `ignoredBuildStep`, a redeploy of a skipped commit, still docs-only against the last successful deployment, returns `build: false` with the existing `why` (the script never forces; the force is Vercel's). Existing tests unchanged; the first-push docs-only skip (AC-3) is already covered.
2. `scripts/vercel-ignore.mjs` header and the `deploymentNeedsBuild` / `ignoredBuildStep` comments in `scripts/lib/release.mjs`: an empty diff is a redeploy of the last deployed commit; a skipped commit compares with an older deployment and skips again; the force route is the unticked box. No logic change.
3. `docs/START-HERE.md` § 10e, next to the *Canceled* paragraph, owner steps: Deployments → the commit's Canceled deployment → ⋯ → **Redeploy** → untick **Use project's Ignore Build Step** → **Redeploy**; nothing to turn off (the box applies to that redeploy only). Step 4's *redeploy an open PR's preview* and § 10f's two *redeploy* table rows point to it.
4. `docs/GIT-PR.md`: one line on the docs-only bullet.

**Files**
- `test/release.test.ts`: the comment test and the skipped-redeploy case.
- `scripts/vercel-ignore.mjs`: header comment.
- `scripts/lib/release.mjs`: `deploymentNeedsBuild` and `ignoredBuildStep` comments.
- `docs/START-HERE.md`: § 10e owner steps, step 4 and § 10f pointers.
- `docs/GIT-PR.md`: one line.

**Test strategy**
- AC-1–AC-4: `test/release.test.ts` § `ignoredBuildStep (scripts/vercel-ignore.mjs)`, the new cases above, plus the existing skip cases.
- AC-5: spec-reviewer reads the doc diff.
- AC-6: manual on this PR's preview: Claude pushes the two docs-only commits; the owner does the unticked Redeploy in the Vercel dashboard; the PR records the three deployments.

**Risks / open questions**
- Vercel documents the box generally; that it is offered when redeploying a *Canceled* deployment is proven only by AC-6.
- The forced redeploy reuses the branch's existing Neon branch: fine.

**Follow-ups:** none at plan time.

## Review log

Verify R1 PASS | Audit R1 PASS (comment tests discriminating; one test tightened after) | Spec R1 APPROVE (Verification wording and a long comment line fixed after)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1
- First-pass AC FAILs: 0 (AC-6 is manual, on the PR's preview)
- Plan revisions after approval: 0

## AC-6 log

- Built: `bacc90c` (Ready; the first push changed scripts and tests).
- Docs-only push `09ea47f`: **Canceled by Ignored Build Step**.
- Redeploy of `09ea47f` with *Use project's Ignore Build Step* unticked: **Ready** (owner, 2026-10-29).
- Docs-only push, the accept commit: expected **Canceled**.
