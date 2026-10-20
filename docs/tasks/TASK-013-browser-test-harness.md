---
id: TASK-013
title: 0.11 Browser test harness — Playwright and axe
status: Review
depends_on: [TASK-012]
size: M
model: sonnet
autonomy: attended
ui: false
plan_status: approved
planned_at_commit: 4bba78a
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
- [x] AC-2: With `TEST_DATABASE_URL` unset, or naming the same host and database as `DATABASE_URL`, `npm run test:e2e` exits non-zero before starting a browser or a server, with the same message as `scripts/lib/testdb.mjs`.
- [x] AC-3: The helpers are importable from one module (`test/e2e/helpers.ts` or the plan's path). A sample spec uses each one: axe with a named rule list, a computed-style read, the no-scroll assertion, and a screenshot written under a gitignored folder (`git check-ignore` confirms it).
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

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The owner's machine needs the browser once: `npx playwright install chromium` after the first `npm ci` on this branch, or `npm run test:all` fails at the e2e step → docs/OWNER-CHECKLIST.md § Actions from follow-ups (placed by the plans PR #98)
- Candidate decision: browser tests are Playwright on Chromium only, against `next dev` on the test database, signed in with a fixed test passcode the wrapper sets, never the owner's `APP_PASSCODE` → docs/review/decisions.md § D-72 (placed by the plans PR #98)

## Plan

TASK-012 is Done, so this plan is no longer provisional. Re-checked at start (2026-10-20): `package.json`, `package-lock.json` and `docs/TASKS.md` moved since the plan (Dependabot bumps and other tasks' roadmap text); the 0.11 entry and its **Check:** are unchanged, so the plan stands.

Steps:
1. `npm i -D @playwright/test @axe-core/playwright` at exact current versions; `npx playwright install chromium` locally. Chromium only, which is what the ui-verifier drives.
2. `scripts/lib/e2e.mjs` (new): `planE2e(env)` calls `checkTestUrl(env.TEST_DATABASE_URL, env.DATABASE_URL)` and returns `{ error }` with that exact message, or `{ env }` for the child: `DATABASE_URL = TEST_DATABASE_URL`, `APP_PASSCODE = "e2e-passcode"`, `SESSION_SECRET = "e2e-only-secret"`, `OWNER_ID = "e2e-user"`, `E2E_PORT = 3199` (below `ui.portBase` 3100's range). `scripts/e2e.mjs` (new): `loadDotEnv()`, `planE2e`; on error print it and exit 1 before spawning anything; else spawn `npx playwright test <args>` with that env.
3. `playwright.config.ts` (new): refuses unless `process.env.DATABASE_URL === requireTestUrl()` ("run it with npm run test:e2e"), so a bare `npx playwright test` can't start a server on the dev database. `testDir: test/e2e`, `workers: 1` (one shared database), `webServer: npx next dev --port 3199`, waiting on `/api/health`, `reuseExistingServer: false`, timeout 180 s. `globalSetup: test/e2e/global-setup.ts`: `truncateAll` and seed user `e2e-user`, run `e2e-run` (*E2E Run*) with 12 placements, 3 read (`test/db.ts` helpers). Projects: `setup` signs in through `/login`'s form (types the passcode, presses *Open ledger*, so the form posts `/api/login`) and saves `storageState` to `test/e2e/.auth/state.json`. Then 12 width × theme projects (`w360-light` … `w1280-dark`, the `ui.viewports` sizes and `colorScheme`), plus `w390-reduced-motion` (`reducedMotion: 'reduce'`) and `w390-touch` (`hasTouch`, `isMobile`). All depend on `setup`.
4. `test/e2e/helpers.ts` (new): `expectNoAxeViolations(page, rules)` (AxeBuilder `.withRules(rules)`; throws listing each violation's id and target); `computedStyle(locator, props)`; `expectNoHorizontalScroll(page)` (`scrollWidth <= clientWidth` on the root); `screenshot(page, testInfo, name)` → `test-results/screens/<project>/<name>.png`.
5. `test/e2e/fixtures/unnamed-button.html` and `overflow-360.html` (new), loaded with `page.setContent`, so nothing ships in the app. `test/e2e/harness.spec.ts` (new) and `test/e2e/spine.spec.ts` (new).
6. `.gitignore`: `/test-results/`, `/playwright-report/`, `test/e2e/.auth/`.
7. `package.json`: `"test:e2e": "node scripts/e2e.mjs"`; `test:all` ends `&& npm run test:e2e`.
8. `.github/workflows/ci.yml`: after `test:etl`, `npx playwright install --with-deps chromium`, then `npm run test:e2e` (the job has no `DATABASE_URL`, so the wrapper's child gets the test URL).
9. `scripts/lib/test-files.mjs` routes `test/e2e/*.spec.ts` to `node scripts/e2e.mjs <files>`; `.claude/kit.json` `testAudit.testPathPatterns` adds `test/e2e/*.spec.ts`, so the test-auditor sees later tasks' specs (both not in the list).
10. `CLAUDE.md` commands, `.claude/rules/git.md` *Test on the branch*, and `docs/COMMANDS.md` name `npm run test:e2e`. Tick 0.11 in `docs/TASKS.md`.

Files: `package.json`, `package-lock.json`, `playwright.config.ts`, `scripts/e2e.mjs`, `scripts/lib/e2e.mjs` (+ `.d.mts`), `scripts/lib/test-files.mjs`, `test/e2e/{global-setup.ts,helpers.ts,harness.spec.ts,spine.spec.ts,fixtures/*}`, `test/e2e-guard.test.ts`, `test/test-files.test.ts`, `.gitignore`, `.github/workflows/ci.yml`, `.claude/kit.json`, `CLAUDE.md`, `.claude/rules/git.md`, `docs/COMMANDS.md`, `docs/TASKS.md`.

Test strategy:
- AC-1 → `spine.spec.ts` `signs in and loads the seeded spine` in each of the 12 projects: the h1 reads *E2E Run*, 12 `.iss` rows, `expectNoHorizontalScroll`. `harness.spec.ts` `axe fails on button-name for an unnamed button` (the helper rejects, naming `button-name`) and `no-scroll fails on a page that overflows at 360px` (`w360-*` only). CI: the e2e step in the PR's `check` log.
- AC-2 → `test/e2e-guard.test.ts`: `planE2e` returns the exact `checkTestUrl` message for unset, and for same host and database; `node scripts/e2e.mjs` with `TEST_DATABASE_URL` unset exits 1 with that message and launches nothing (a `PLAYWRIGHT_BIN` stub that writes a marker file is never run).
- AC-3 → `harness.spec.ts` `the helpers work together` uses each helper once, an axe rule list, a computed `background-color` equal to `--page`, and a screenshot that exists afterwards; `e2e-guard.test.ts` `git check-ignore` exits 0 for `test-results/screens/probe.png`.
- AC-4 → `e2e-guard.test.ts` `test:all runs test:e2e, and CLAUDE.md and git.md name it`; manual: CI `check` green on the PR, the e2e step visible.

Risks / open questions:
- `next dev` alongside the owner's own `npm run dev` in the same folder may fight over `.next/`. If it does, stop the dev server before `test:all`, and `docs/COMMANDS.md` says so.
- The login cookie is `secure`; Chromium treats `http://localhost` as secure, which is why sign-in goes through the page and not `request.post`.
- `test:all` gets about 2–3 minutes longer (a cold `next dev` compile plus 14 projects).
- If the real spine overflows at 360px, AC-1 fails on a real bug. That gets fixed here, as the UX floor, or the owner splits it out.

Revisions during implementation (2026-10-20). Two files are outside the Files list: `test/e2e/auth.setup.ts` and `scripts/test-files.mjs`.
- Step 2/3: the wrapper does not overwrite `DATABASE_URL` for the Playwright process. `requireTestUrl` refuses when `DATABASE_URL` names the test database, so global-setup would have refused. `planE2e` returns `serverEnv` and `playwright.config.ts` sets it on the `next dev` webServer only; the config also calls `planE2e`, so a bare `npx playwright test` is guarded too, and no "run it with npm" check is needed.
- Step 3: the sign-in project's file is `test/e2e/auth.setup.ts` (new, not in the list); the seed constants live in `helpers.ts`.
- Step 8: `ci.yml` also uploads `test-results/` and `playwright-report/` as a 7-day artifact, so the screenshots are PR evidence from CI too (new step, same file).
- Step 9: `planTestRun` resets the test database before an e2e spec, as it does for vitest. `scripts/test-files.mjs` (the runner, not in the Files list) only has its "no runner for" message extended to name e2e specs.
- `expectNoAxeViolations` has no "rule never ran" check: axe throws on an unknown rule id itself.

Size check: M in code (two layers: test tooling and CI), about 18 files mostly small, no schema or UI; attended.

## Review log

Verify R1 PASS | Audit R1 NOT RUN (guard denied the base-run's deletes; owner approved) → R2 PASS | Spec R1 CHANGES (plan revision list incomplete) → fixed | Spec R2 APPROVE | UI n/a (`ui: false`) | Schema n/a

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 1
- Review rounds: 1 (+1 confirm)
- First-pass AC FAILs: 0 (CI-on-PR part of AC-1/AC-4 is checked by the ready gates)
- Plan revisions after approval: 1 (the `DATABASE_URL` handling and four small additions, listed under Plan)
