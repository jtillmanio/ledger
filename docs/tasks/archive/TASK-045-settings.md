---
id: TASK-045
title: 2.0 Settings
status: Done
depends_on: []
size: L
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: d1ad1f3
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
- [x] AC-2: Against the TEST database, with no `reading_settings` row: the settings read returns 45 minutes a day and 185 words a minute. After pressing + on *Minutes a day* fifteen times (or saving 60), one row holds `minutes_per_day = 60`, and the next render of `/settings` shows `60` in the stepper's `<output>` and an *a year* figure equal to 60 × 185 × the days in the current year, formatted as the card formats it.
- [x] AC-3: The write route refuses a value outside the plan's stated bounds (at least: 0, a negative, a non-integer, a missing field) with 400 and writes nothing; the stepper's − is `aria-disabled="true"` with a visible reason at the lower bound, never a bare `disabled`.
- [x] AC-4: `/settings` renders the volume map line from `volume_rules` (on a fixture of 3 rules over 2 series it reads *3 rules · 2 series*) and an *Export everything* control that is an `<a href="/api/export">`; the nav's *Settings* item is enabled, and on `/settings` it is current (`aria-current="page"`) in every bar that draws it at 768 and 1280px; at 360px the screen is reachable from the nav in no more than two taps.
- [x] AC-5: `/settings` meets the UX floor (`docs/04-design.md` § 10. The UX floor): its loading state is drawn (`src/app/settings/loading.tsx`, the loaded geometry in `--sunk`) and a failed save is drawn as the app's failed-write line; text 4.5:1 and outlines 3:1 in both themes; each stepper button has an accessible name and is at least 32px with a 44px row; every control is a real `<button>`, `<a href>` or `role="switch"`; screenshots at every `ui.viewports` width, light and dark.

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

- The Check's capacity half: the owner chose (a) at the plan gate (2026-11-04). This task proves the Settings card moves on an edit; TASK-046's AC-2 proves "45 → 60 min/day moves the 2027 figure" against the view, and 2.0's roadmap box stays open until 2.1 closes → docs/tasks/TASK-046-capacity-view.md § Context (approved at plan)
- *Show covers* is left off the Settings screen (owner, 2026-11-04); where it is stored stays 4.3's open question → docs/05-roadmap.md § 4.3 (approved at plan)
- The mockup's *Theme* row (Light / Dark / System; `reading_settings.theme` exists, nothing reads it) lands with Settings → Appearance → docs/05-roadmap.md § 6.11 (approved at plan)
- The mockup's *Last backup* row needs a source the app can read (the nightly dump is in R2, D-66) → docs/05-roadmap.md § 6.20 (new, proposed Check) (approved at plan)
- The mockup's *Estimate missing counts* switch has no column; 2.1 decides whether estimates can be switched off → docs/tasks/TASK-046-capacity-view.md § Context (approved at plan)
- Candidate decision: the phone bar carries a Settings gear at its right end (one tap at 360px), and Export leaves the rail's and sidebar's foot for Settings' *Export everything* (owner, 2026-11-04) → docs/review/decisions.md § D-113 (approved at plan)
- D-113 contradicts two lines of `docs/04-design.md`: § 10 ("the phone bar is the one `Comics · Books · Watch` partial") and § 11 ("plus the search icon on every screen") → docs/OWNER-CHECKLIST.md § Approvals from follow-ups (queued: a planning-doc edit needs the owner's yes)
- The shared `.stepper` (batch and finish sheets, and the mockups' `.stepper`) is still on `--raise`, where STYLE_GUIDE § 9 says `--sunk`; 2.0 follows the guide on Settings only → docs/OWNER-CHECKLIST.md § Approvals from follow-ups (queued)
- `design/mockups-index.md` gives `settings` as lines 3987–4108, but the frame starts at line 4911; the other ranges are stale the same way → not tracked: out of date before this task, and the redraw changed no frame boundary

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Approved 2026-11-04. Plan-gate answers (owner): the Check is split, (a); of the mockup's extra rows only *Words per page* ships (no Theme, Show covers, Last backup, Estimate missing counts, Measured from sessions, Density); the phone gets a gear in the bar; Export leaves the nav.

### Steps

1. `src/lib/settings.ts` (new): the defaults (45 min/day, 185 wpm; words per page reuses `DEFAULT_WORDS_PER_PAGE`, 275), the bounds and steps (minutes 1–600 by 1, so 45 → 60 is fifteen presses; words a minute 50–1000 by 5; words per page 100–1000 by 5), and the year figure: minutes × wpm × the days in the current year (Eastern, as the app's other dates), formatted as the card shows it (`3.0M`, one decimal) and *roughly N average novels* at 100,000 words a novel. Shared by the client card and the tests.
2. `src/db/queries.ts`: `readingSettings(userId)` returns the row or the defaults, uncached (no `cache`, `unstable_cache` or `"use cache"`). `volumeMapCounts()` returns `count(*)` rules and `count(DISTINCT series)` series from `volume_rules`, derived and never stored. `src/db/writes.ts`: `saveReadingSettings(userId, patch)` upserts only the given fields (`INSERT … ON CONFLICT (user_id) DO UPDATE`), so the first edit inserts the row and `etl/load.ps1` doesn't change.
3. `src/app/api/settings/route.ts` (new): `PATCH { minutesPerDay?, wordsPerMinute?, wordsPerPage? }`. At least one field; each is an integer within its bound; an unknown field, a non-integer, 0, a negative, an over-bound value, a missing or unparseable body is a 400 and writes nothing. Answers the saved settings. `apiUserId` / `unauthorized` as `/api/plan`.
4. `src/components/Stepper.tsx` (new): `role="group"` named for its row (*Minutes a day*), a − and a + that are real `<button>`s named *Decrease minutes a day* / *Increase minutes a day*, a mono `<output>`. At a bound the button is `aria-disabled="true"` with `aria-describedby` pointing at a visible reason (*At least 1 minute*), never `disabled`; its click does nothing. `src/components/PaceSettings.tsx` (new, client): holds the three values, changes one on each press at once, and saves once, debounced (500 ms after the last press), only the fields that changed. A failed save puts back the last saved values and raises the Undo provider's failure toast (`fail({ label, retry })`), the app's failed-write line. The *a year* card is computed from the live values.
5. `src/app/settings/page.tsx` (new, `force-dynamic`): one `<h1>` *Settings*; *Reading pace* (three stepper rows, then the card); *Data* (*Volume map* · *N rules · M series*, no *Edit* until 3.9; *Export everything* · *JSON, all tables* · a plain `<a href="/api/export" className="btn sec sm">Download</a>`, never a `<Link>`). Both queries in one wave. From 1024px, pace on the left, data on the right (the mockup's `dk-2up`). `src/app/settings/loading.tsx` (new): the loaded geometry in `--sunk`, as `src/app/inbox/loading.tsx`.
6. `src/components/nav/items.ts`: `settings` to `enabled: true`; the `export` item is removed (its comment updated). `src/components/nav/MediaBar.tsx`: a 44px gear `<Link href="/settings">` named *Settings* at the bar's right end, `aria-current="page"` on `/settings`. The rail and sidebar already draw the foot group.
7. `src/app/globals.css`: the settings layout, the gear, and the stepper on `--sunk` per STYLE_GUIDE § 9 (with the dark `--rule` ring, D2), scoped to the settings screen so the batch and finish sheets don't change; tokens only.
8. Perf and docs: `scripts/perf/routes.mjs` gets `settings` (tap from `/comics`, `a[href="/settings"]`); `scripts/perf/budget.json` gets `settings` starting from `/inbox`'s numbers (11,000 / 173,000 / 28 / 100). `docs/02-architecture.md` § 7: the perf-budget row and "/settings 2" in the queries line; § 5: `/api/settings` in the route-handler list.

### Files

- `src/lib/settings.ts` (new): defaults, bounds, the year figure. *Not in "Files likely touched".*
- `src/db/queries.ts`: `readingSettings`, `volumeMapCounts`.
- `src/db/writes.ts`: `saveReadingSettings`.
- `src/app/api/settings/route.ts` (new): the validated write.
- `src/components/Stepper.tsx` (new): the group stepper. No switch component (no switch ships).
- `src/components/PaceSettings.tsx` (new, client): state, debounced save, failure toast, the card. *Not in "Files likely touched".*
- `src/app/settings/page.tsx`, `src/app/settings/loading.tsx` (new).
- `src/components/nav/items.ts`: Settings on, Export off.
- `src/components/nav/MediaBar.tsx`: the phone's gear. *Not in "Files likely touched".*
- `src/app/globals.css`: settings layout, gear, stepper.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json`: the new route.
- `docs/02-architecture.md`: perf row, query count, route handler. *Not in "Files likely touched".*
- Tests: `test/settings.test.ts` (new), `test/e2e/settings.spec.ts` (new), `test/nav-items.test.tsx`, `test/query-budget.test.ts` (`/settings`: 2 queries, 1 wave) and `test/e2e/shell.spec.ts` (its nav href list loses `/api/export`, gains `/settings`). The last two are *not in "Files likely touched"*.

**Revision 1 (2026-11-04, owner approved at the Phase 5 question, after spec-reviewer R1):**

- `design/mockups.html`: the `settings` frame only (it is a `ui.redrawFiles` file, standing rule 6). Its phone bar draws the Settings gear where it drew Search, and its three steppers, phone and desktop, sit on `--sunk`. *Not in "Files likely touched".*
- `src/db/writes.ts`: `saveReadingSettings` also throws on an empty patch (schema-reviewer's minor).
- Two details differ from the steps, with no change of behaviour: the test file is `test/settings.test.tsx` (it renders JSX), and a stepper at a bound writes *The lowest is 1* / *The highest is 600* beneath itself, where step 4 said *At least 1 minute*.
- Also touched: `test/loading-states.test.tsx` (the `/settings` row in its list of loading screens), `docs/05-roadmap.md`, `docs/06-tasklist.md`, `docs/review/decisions.md`, `docs/OWNER-CHECKLIST.md` and `docs/tasks/TASK-046-capacity-view.md` (the follow-up placements below).

Over 8 files, data and UI together: `workflow.splitPolicy` is `never-split`, so the task stays whole and `autonomy: attended` (as set).

### Test strategy

- AC-1: `test/settings.test.ts` › "a user with no row gets the column defaults" (45/185/275, compared with `information_schema.columns.column_default` so the code's defaults can't drift) and › "an edit is read on the next call" (no cache). `test/e2e/settings.spec.ts` › "one h1, and each stepper is a named group". The capacity-view half is TASK-046's AC-2 (owner's (a)).
- AC-2: `test/settings.test.ts` › "PATCH 60 leaves one row with minutes_per_day 60". `test/e2e/settings.spec.ts` › "fifteen presses of + save 60, and a reload shows it" (the `<output>` reads `60`, the card reads the figure from `src/lib/settings.ts` for 60 × 185 × the year's days); the test sets it back.
- AC-3: `test/settings.test.ts` › "refuses 0, a negative, a non-integer, an over-bound value, an unknown field, a missing field and an empty body with 400, writing nothing" and › "the − at the lower bound is aria-disabled with a visible reason" (`renderToString(<Stepper …/>)`: `aria-disabled="true"`, `aria-describedby` → the reason's text, no `disabled` attribute).
- AC-4: `test/settings.test.ts` › "volume map counts: 3 rules over 2 series". `test/nav-items.test.tsx` › Settings enabled and drawn in the rail and sidebar, Export in no bar, the phone bar's gear, and `aria-current="page"` on `/settings` in each. `test/e2e/settings.spec.ts` › "Export everything is a plain a href=/api/export", › "current in the rail at 768 and the sidebar at 1280", › "one tap from the phone bar at 360".
- AC-5: `test/e2e/settings.spec.ts` › axe in light and dark, › "a failed save shows the failure toast and puts the value back" (route the PATCH to a 500), › "stepper buttons ≥ 32px in a ≥ 44px row", › "the loading state draws the loaded geometry" (as `skeletons.spec.ts` does); screenshots at every width, light and dark, from CI's full projects (the `e2e:full` gate).

### Risks

- The shared `.stepper` sits on `--raise`, but STYLE_GUIDE § 9 says `--sunk`. The settings-scoped rule follows the guide without moving the batch and finish sheets; whether those should follow is noted at close-out.
- The gear widens the phone bar past "the one Comics · Books · Watch partial" (design § 10). The mockup's phone bar already draws an icon button there (Search, 6.1), so it is the slot the design kept; recorded as the candidate decision.
- Debounced saves: a navigation inside the 500 ms window could drop the last press. The client flushes the pending save on `pagehide` / unmount.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 round PASS → full PASS (734 passed, 1 skipped) | R2 round PASS (after the mockup redraw and the empty-patch guard)
- Audit R1 PASS (every automated AC proven; AC-1's capacity half is TASK-046's AC-2, owner's (a))
- Spec R1 CHANGES (the `design/mockups.html` redraw missing) → R2 APPROVE | Schema R1 APPROVE (1 minor: empty patch) → R2 APPROVE | UI R1 PASS (six widths, light and dark; the loading skeleton and the failed save are covered by the e2e spec, not walked). Round 2's ui-verifier was not re-run: the fixes touched no UI source file (D-97).
- Close-out follow-ups check: spec-reviewer (see the PR).

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 1
