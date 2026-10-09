---
id: TASK-013
title: 0.11 Browser test harness — Playwright and axe
status: Draft
depends_on: [TASK-012]
size: M
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-013 — 0.11 Browser test harness — Playwright and axe

## Goal

UI checks run in a real browser at every target width and theme, with accessibility scanning, as part of the normal test suite. Every later screen task can then prove its UX-floor checks instead of eyeballing them.

## Context

- Roadmap: `docs/TASKS.md` § 0.11 Browser test harness — Playwright and axe. It is numbered in Phase 0 but **built in sitting 6, before 1.8**, because 1.8's check needs axe over each dashboard and computed styles at set widths. Gap G-6 in `docs/kit-adoption.md`. The roadmap entry and its **Check:** are the contract.
- What: `@playwright/test` and `@axe-core/playwright`, run by `npm run test:e2e` against the app on `TEST_DATABASE_URL` only, refusing without it as `scripts/lib/testdb.mjs` does. It signs in with a test `APP_PASSCODE` through `/api/login`, as `scripts/perf/login.mjs` does. Playwright rather than `scripts/perf/`'s puppeteer-core because the kit's ui-verifier already drives Playwright, and `scripts/perf/` keeps its own package.
- Projects: the six `ui.viewports` widths in `.claude/kit.json` (360, 390, 412, 768, 1024, 1280), light and dark through `colorScheme`, plus `reducedMotion: 'reduce'` and `hasTouch` variants.
- Helpers, in one module: an axe call that fails on any violation of the rules a check names, a computed-style reader, a no-horizontal-scroll assertion, and a screenshot helper writing to a gitignored folder. Screenshots are PR evidence, not baselines, so there is no pixel diffing.
- Wiring, in this PR: into `npm run test:all` (so `/verify` and CI's `check` run it); `.github/workflows/ci.yml` (browsers installed in the job); `.claude/rules/git.md` *Test on the branch*; the `CLAUDE.md` command list. `.claude/kit.json` `verify.full` already runs `test:all`.
- Decisions: D-11 (tests touch `TEST_DATABASE_URL` only), D-52 (CI is the `check` job, the same gate as `test:all`), D-33 (the widths).
- Ready gates: CI changes, so the changed workflow is tested by this PR itself (`pull_request` trigger).

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): `npm run test:e2e` signs in with the test passcode and loads a seeded run's spine at 360, 390, 412, 768, 1024 and 1280px, light and dark, and passes. A fixture page with an unnamed `<button>` makes the axe step fail on `button-name`. The no-horizontal-scroll helper fails on a fixture that overflows at 360px. CI runs the suite on the PR against `TEST_DATABASE_URL` only, and `git.md`'s *Test on the branch* lists it.
- [ ] AC-2: With `TEST_DATABASE_URL` unset, or naming the same host and database as `DATABASE_URL`, `npm run test:e2e` exits non-zero before starting a browser or a server, with the same message as `scripts/lib/testdb.mjs`.
- [ ] AC-3: The helpers are importable from one module (`test/e2e/helpers.ts` or the plan's path). A sample spec uses each one: axe with a named rule list, a computed-style read, the no-scroll assertion, and a screenshot written under a gitignored folder (`git check-ignore` confirms it).
- [ ] AC-4: `npm run test:all` runs `test:e2e`. The CI `check` job is green on this PR with the e2e step visible in its log. `CLAUDE.md`'s command list and `.claude/rules/git.md` both name `npm run test:e2e`.

## Out of scope

- Any screen's own e2e checks: each UI task writes its own on these helpers (1.8 is first).
- Pixel-diff baselines.
- Migrating `scripts/perf/` from puppeteer-core.
- Lighthouse (0.10 owns it).

## Files likely touched

- `package.json`, `package-lock.json`: `@playwright/test`, `@axe-core/playwright`, the `test:e2e` script, and `test:all`.
- `playwright.config.ts` (new): the projects, the web server on the test database, the sign-in setup.
- `test/e2e/helpers.ts` (new), `test/e2e/spine.spec.ts` (new), `test/e2e/fixtures/` (new: the unnamed-button and overflow pages).
- `.github/workflows/ci.yml`: install the browsers and run the suite.
- `.gitignore`: the screenshot folder.
- `CLAUDE.md`, `.claude/rules/git.md`: the command and the *Test on the branch* line.

## Verification

- Automated: `npm run test:e2e` locally, green, then red on the unnamed-button and overflow fixtures, with the output quoted in the PR (AC-1, AC-3). Run with `TEST_DATABASE_URL` unset → non-zero before launch (AC-2). CI `check` green on the PR, with the e2e step in its log (AC-4).
- Manual: open the screenshot folder after a run → expected: one spine image per width and theme. It is ignored by git.

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
