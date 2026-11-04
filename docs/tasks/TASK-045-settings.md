---
id: TASK-045
title: 2.0 Settings
status: Ready
depends_on: []
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-045 — 2.0 Settings

## Goal

A Settings screen where you set how many minutes a day you read and how many words a minute you read, and every capacity figure follows the change with no redeploy. *Export everything* moves there, so the phone gets an Export too.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.0 Settings (M10, first; pulled ahead of cutover by 1.25, `docs/cutover-parity.md`: the To-Read tabs' word-count budget is 2.0 → 2.1 → 2.2 → 2.2b and 2.3, built before 1.26). R1-05. The roadmap entry and its **Check:** are the contract. Features: F-21 (`docs/01-product.md` § Feature index).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new route, its loading state, a read, a write and its route handler, the stepper control, the nav item flip and the perf route land together, which is over 8 files across the data and UI layers.
- **Open: the Check's second half needs 2.1.** It asks that "2.1's capacity view reflects an edit" (45 → 60 min/day moves the 2027 figure), but 2.1 (TASK-046) is built after this task and depends on it. **Ask at the plan gate** which of these the owner wants: (a) this task proves the half it can (Settings' own *At 45 minutes a day you can read about … words a year* line moves on an edit, read live from `reading_settings`), and TASK-046's AC-2 proves the capacity view half; or (b) 2.0 and 2.1 are built and reviewed in one sitting, so this task is closed only once 2.1's view exists. Don't tick 2.0's roadmap box on half a Check.
- Data: `reading_settings` (`src/db/schema.ts`, migration `0005`): `minutes_per_day` (default 45), `words_per_minute` (185), `words_per_page` (275), `theme`, `show_covers`. There is no `plan_granularity` (D-38, dropped by 1.7). The table has a `user_id` key until 6.18 (D-91); no column is added here. "Seeds one row per user" is the entry's: the existing read `wordsPerPage` (`src/db/queries.ts`) and `addBook` (`src/db/writes.ts`) already fall back to the column defaults when there is no row, and the plan says whether the first edit inserts the row (an upsert) or the load seeds it (it's an `etl/load.ps1` change only if the plan picks it, and then it asks).
- Writes: one write per stepper press or a debounced one, the plan's call; the read path must not cache, so another screen reads the new value on its next render ("without a redeploy"). A route handler under `src/app/api/` like `src/app/api/plan/route.ts`; no page links to it with `<Link>` (architecture § 5. Routes and data access, § Operational posture).
- Design: mockup `settings` in `design/mockups.html` (print it with `scripts/screen.ps1 settings`): *Reading pace* (minutes a day, words a minute, *Estimate missing counts · Words per page*, and the *At 45 minutes a day you can read about 3.0M words a year — roughly 30 average novels* card), *Appearance* (theme, *Show covers*, density), *Data* (*Volume map · 67 rules · 61 series · Edit*, *Export everything*, *Last backup*). Desktop: pace on the left, appearance and data on the right. `docs/04-design.md` § 14 → Settings (real controls); `design/STYLE_GUIDE.md` § 9 (the 36×20 switch in a 44px row; the `role="group"` stepper of 32px buttons on `--sunk` with a mono `<output>`). The mockup's figures are sample data (D-7).
- **In scope, from the entry:** minutes a day and words a minute; the *a year* translation card; the volume map line (counts from `volume_rules`, derived, never stored); *Export everything* (a plain `<a href="/api/export">`, never a `<Link>`, as the nav's is: `plain: true` in `src/components/nav/items.ts`; owner, 2026-10-19, from TASK-014). **Ask at the plan gate** whether *Words per page*, *Theme* and *Show covers* ship now (the mockup draws them, the entry doesn't name them, and `docs/03-data-model.md` § 4.1 leaves where *Show covers* is kept to 4.3), and whether *Last backup* has a source the app can read (the nightly backup writes to R2, D-66).
- Nav: `src/components/nav/items.ts` has `settings` at `enabled: false`; this task flips it (`test/nav-items.test.tsx`). Whether the foot's *Export* item stays beside it is the plan's, within the entry's *Export moves here from the nav*.
- Perf: a new top-level screen adds its route and budget to `scripts/perf/routes.mjs` and `scripts/perf/budget.json` in the same PR (`docs/02-architecture.md` § 7).
- Later tasks extend this screen and don't create it: 2.1b adds *Measured from sessions* and **Use these**; 6.11 the density toggle; 3.9 the volume map's *Edit* (`/settings/volumes`).
- Decisions: D-38 (no month planning, no granularity), D-37, D-7 (figures are sample data), D-8 (sessions after the fact; 2.1b), D-91, D-66. R1-05.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test that a user with no row gets the seeded defaults and that 2.1's
capacity view reflects an edit — changing 45 to 60 min/day moves the 2027 figure
— without a redeploy. The stepper is a button group with an accessible name, and
the page has one `<h1>`.
- [ ] AC-2: Against the TEST database, with no `reading_settings` row: the settings read returns 45 minutes a day and 185 words a minute. After pressing + on *Minutes a day* fifteen times (or saving 60), one row holds `minutes_per_day = 60`, and the next render of `/settings` shows `60` in the stepper's `<output>` and an *a year* figure equal to 60 × 185 × the days in the current year, formatted as the card formats it.
- [ ] AC-3: The write route refuses a value outside the plan's stated bounds (at least: 0, a negative, a non-integer, a missing field) with 400 and writes nothing; the stepper's − is `aria-disabled="true"` with a visible reason at the lower bound, never a bare `disabled`.
- [ ] AC-4: `/settings` renders the volume map line from `volume_rules` (on a fixture of 3 rules over 2 series it reads *3 rules · 2 series*) and an *Export everything* control that is an `<a href="/api/export">`; the nav's *Settings* item is enabled, and on `/settings` it is current (`aria-current="page"`) in every bar that draws it at 768 and 1280px; at 360px the screen is reachable from the nav in no more than two taps.
- [ ] AC-5: `/settings` meets the UX floor (`docs/04-design.md` § 10. The UX floor): its loading state is drawn (`src/app/settings/loading.tsx`, the loaded geometry in `--sunk`) and a failed save is drawn as the app's failed-write line; text 4.5:1 and outlines 3:1 in both themes; each stepper button has an accessible name and is at least 32px with a 44px row; every control is a real `<button>`, `<a href>` or `role="switch"`; screenshots at every `ui.viewports` width, light and dark.

## Out of scope

- *Measured from sessions*, **Use these** and the drift flag (2.1b), and the session sheet itself.
- The capacity view and anything summing the plan (2.1, TASK-046).
- The density toggle (6.11) and editing the volume map (3.9, `/settings/volumes`).
- A `plan_granularity` or month setting (D-38).
- Stretch-year acceptance (2.7's own `plan_acceptance` table, R3-14).
- Any new `reading_settings` column.

## Files likely touched

- `src/app/settings/page.tsx`, `src/app/settings/loading.tsx` — the screen and its skeleton (new).
- `src/components/Stepper.tsx` (new) — the `role="group"` stepper; the plan says if a switch component comes with it.
- `src/app/api/settings/route.ts` (new) — the write, validated.
- `src/db/queries.ts` — the settings read with defaults (beside `wordsPerPage`), the volume map counts.
- `src/db/writes.ts` — the settings upsert.
- `src/components/nav/items.ts` — `settings` enabled; *Export* per the plan.
- `src/app/globals.css` — the stepper and switch, from tokens only.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json` — the new route.
- `test/settings.test.ts`, `test/nav-items.test.tsx`, `test/e2e/settings.spec.ts` (new) — tests.

## Verification

- Automated: `test/settings.test.ts` (AC-2 defaults and the edit, AC-3 refusals, AC-4's volume map counts); `test/nav-items.test.tsx` (the flip); `test/e2e/settings.spec.ts` (one `<h1>`, the stepper's group name, an edit shown on reload, axe, screenshots); plus the capacity half of AC-1 per the plan gate's answer.
- Manual: `npm run dev`, open `/settings`, press + on *Minutes a day* → the `<output>` and the *a year* card change, and a reload keeps the value; set it back to what it was (the dev database is left as found).

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
