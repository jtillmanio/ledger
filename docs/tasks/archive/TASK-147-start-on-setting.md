---
id: TASK-147
title: 6.25 Navigation for four and five media (1 of 3) — Start on, for what / opens
status: Done
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: e1b1401
---

# TASK-147 — 6.25 Navigation for four and five media (1 of 3) — Start on, for what / opens

## Goal

Settings → Appearance gains *Start on*: *Last used* (as today) or a named medium, and opening the Ledger at `/` goes there.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.25 Navigation for four and five media (M21 in `docs/06-tasklist.md`; lands before 9.0 adds a fourth medium). Feature F-05. Depends on 6.23 (TASK-126, done). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 1 of 3** (`workflow.splitPolicy: split`: the phone bar, the switch sheet, the tab row, the thumb bar, the tablet rail, the icon rail's menu, the sidebar, the desktop headers and a setting are well over eight files). This part: *Start on*. TASK-148 does the phone; TASK-149 the tablet and desktop, and its merge ticks 6.25.
- **The rule** (MR-D7, MR-Q2, D-178; `design/STYLE_GUIDE.md` §17.1, frame E17 in `design/MR-E-Review-3.dc.html`): `/` redirects to the dashboard of the medium used last (unchanged; R1-13); *Start on* (*Last used* by default, or a medium) overrides it; with nothing used yet it opens `/comics`.
- **What exists.** `src/app/route.ts` redirects `/` with `pickMedium(req.cookies.get(MEDIUM_COOKIE)?.value)` (`src/lib/last-medium.ts`, `ledger_medium`, `MEDIA`). Settings' *Appearance* group (`src/app/settings/page.tsx`) holds *Show covers* (`src/components/ShowCovers.tsx`), a per-device cookie (`ledger_covers`, `src/lib/covers.ts`) read on the server so the switch draws right on the first paint, written on a press, with a read-back check. Copy that pattern.
- **Where it is stored.** A per-device cookie, as *Show covers*, needs no schema. Storing it in the database (`reading_settings` or a new column) would change the schema: CLAUDE.md says stop and ask first, so the plan proposes a cookie unless the owner says otherwise at the plan gate.
- **The choices** list every built medium (`MEDIA`: comics, books, watch today); music and games join when 9.0 and 10.0 add them to `MEDIA`.
- Design: `design/mockups.html` § `settings` gains the *Start on* row from E17 (`ui.redrawFiles`; TASK-146 redraws the rest of the frame and leaves this row to 6.25).
- Rules: `.claude/rules/ui.md`; `/api/health` stays the one route outside the passcode gate (`src/proxy.ts`). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-178, D-33; R1-13.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *with Start on set to Books, / opens /books*. TASK-148 and TASK-149 prove the rest):
browser test, light and dark: at 360px the bar shows the current medium as a
44px button whose sheet lists every built medium with the current one
`aria-current`, a 44px search button and the gear, nothing scrolls sideways,
and no dashboard's thumb bar has a search slot; the tab row ends with a
divider, *Inbox* and *Progress*; at 834px the rail names every medium; at
1024px the switch button opens a menu of every medium that arrows, Esc and
focus return work in; at 1280px the sidebar lists every medium with the
current one expanded and an *Across media* group; with *Start on* set to
Books, `/` opens `/books`; axe reports no new violations at each width.
- [x] AC-2: Given *Start on* is *Last used* (the default, and the value when nothing is stored) and the last medium visited was watch, `/` redirects to `/watch`; given nothing visited and nothing stored, `/` redirects to `/comics`.
- [x] AC-3: Given *Start on* is Books and the last medium visited was comics, `/` redirects to `/books`; given a stored value that names no built medium, `/` behaves as *Last used*.
- [x] AC-4: Settings → Appearance shows *Start on* with *Last used* and one choice per built medium, the stored choice selected on the first paint (no flash), and a change persists across a reload; nothing is written to the database.
- [x] AC-5: *Start on* meets the UX floor (`docs/04-design.md` § 10. The UX floor): a real control with a name, targets at least 44px, text 4.5:1 in both themes, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The phone bar, the switch sheet, the tab row and the thumb bar (TASK-148); the rails and sidebar (TASK-149).
- Theme and density, also under Appearance (6.11).
- Storing the choice in the database (a schema change: only if the owner asks).

## Files likely touched

- `src/lib/last-medium.ts` — the *Start on* cookie and the pick.
- `src/app/route.ts` — `/` honours *Start on*.
- `src/components/StartOn.tsx` (new) — the control, after `ShowCovers.tsx`.
- `src/app/settings/page.tsx` — the row in *Appearance*.
- `design/mockups.html`, `design/mockups-index.md` — `settings`' *Start on* row.
- `test/redirect.test.ts`, `test/settings.test.tsx`, `test/e2e/settings.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/redirect.test.ts` (AC-2, AC-3); `test/settings.test.tsx` (AC-4's first paint); `test/e2e/settings.spec.ts` setting *Start on* to Books, then opening `/` (AC-1's clause, AC-4, AC-5 with axe).
- Manual: the ui-verifier sets *Start on* to Books, opens `/` → expected: `/books`; sets it back to *Last used* → expected: `/` opens the medium visited last; the setting is left as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: *Start on* is a per-device cookie (`ledger_start`), not a `reading_settings` column, so a phone and a desktop can each open somewhere different and no schema changes (MR-D7; owner chose the cookie at the plan gate, 2026-11-25) → docs/review/decisions.md § D-188 (approved at plan)
- The mockups draw the dropdown chip with `aria-haspopup="true"`; the built `ChipMenu` has `aria-expanded` and no `aria-haspopup` (ui-verifier) → not tracked: `ChipMenu` is a disclosure of links and buttons, not a `role="menu"` (its own doc comment), so `aria-haspopup` would promise keyboard behaviour it doesn't have; the Library's chips, shipped by 6.24, are the same
- Later screens' line ranges in `design/mockups-index.md` moved by three lines when the mockup gained the row → not tracked: the index says the screen scripts compute the range fresh from the file, so it cannot go stale in use
- `locator.click()` scrolls clipped containers, so a spec that only clicks misses a menu a pointer can't reach (ui-verifier, the clipped *Start on* menu) → not tracked: the spec now hit-tests each choice (`settings.spec.ts`, "not clipped by its group"); no other `.group` holds a dropdown chip today, and `.group:has(.menu-wrap)` covers one added later

## Plan

Approved 2026-11-25 (owner: per-device cookie, not a column). Worktree `.claude/worktrees/task-147`, slot `ledger_test_3` / port 3201.

**Steps**

1. `src/lib/last-medium.ts`: `START_COOKIE = "ledger_start"`; `startMedium(start, last)`: a stored value naming a built medium (`MEDIA`) wins, else `pickMedium(last)` (first visit → comics). A client writer after `writeCoversCookie`: *Last used* deletes the cookie, a medium sets it (year, Lax, Secure on https); returns whether it reads back.
2. `src/app/route.ts`: `/` redirects with `startMedium(ledger_start, ledger_medium)`.
3. `src/components/ChipMenu.tsx`: a choice is a link (`href`, as now) or a button (`onSelect`); the keyboard code selects `.chipmenu .opt`, not `a`; a button choice closes the menu and returns focus to the chip. The Library's two chips are unchanged (`library-sort.spec.ts`, `library-owned.spec.ts` are the regression check).
4. `src/components/StartOn.tsx` (new): the *Start on* row, a `.frow` with the label and a `ChipMenu` (E17's `chip dd`), choices *Last used* · Comics · Books · Watch (one per `MEDIA`), the stored one `aria-current`; chip text the choice, name `Start on: <choice>`, group `Start on`, `align="end"`. A choice shows at once and writes the cookie; a read-back failure puts it back and raises the failed-write line with Retry (as `ShowCovers`). No fetch, nothing to the database.
5. `src/app/settings/page.tsx`: read `ledger_start` from `cookies()` (first paint), the row under *Show covers* in *Appearance*.
6. `src/app/settings/loading.tsx`: a matching skeleton row in Appearance (the loading-geometry test counts rows). Not in "Files likely touched".
7. `design/mockups.html` § `settings`: a *Start on* · *Last used* ▾ (`chip dd`) row in the phone, 834px and desktop Appearance groups; the 834px note line no longer says the row is left for 6.25. `design/mockups-index.md` § `settings`: names the row.

**Files**: the seven above plus three test files. ChipMenu.tsx and loading.tsx are outside "Files likely touched" (reasons in steps 3 and 6).

**Test strategy** (each test written first and seen to fail)

- AC-2, AC-3: `test/redirect.test.ts`, new `describe("GET / with Start on (TASK-147)")`: Last used + ledger_medium=watch → `/watch`; nothing → `/comics`; ledger_start=books + ledger_medium=comics → `/books`; ledger_start=bogus/`__proto__` → as Last used; plus the writer's set / delete / read-back on a fake document.
- AC-4 (first paint, no database): `test/settings.test.tsx`: the page with no cookie, `ledger_start=books` and garbage draws the chip as *Last used*, *Books*, *Last used*; no `reading_settings` row is written.
- AC-1's clause: `test/e2e/settings.spec.ts`, `@floor` (every width, light and dark): choose Books, visit `/comics`, `page.goto("/")` → `/books`; then *Last used* → `/` opens `/comics`. The setting is cleared after.
- AC-4 in the browser: the choice survives a reload; no request to `/api/settings` while choosing.
- AC-5: 44px chip and choices on the phone, contrast, axe (the spec's `AXE` list), no sideways scroll, the keyboard (ArrowDown opens, arrows move, Esc closes and focus returns to the chip); one `@at-w390-light` test screenshots the open menu at every `ui.viewports` width (360, 390, 412, 768, 1024, 1280), light and dark.

**Risks**: ChipMenu is shared (the Library's chips). E17 draws the row at 834px only; the phone and desktop frames copy it.

## Review log

Verify R1 PASS (tsc, lint, test:no-e2e; 48 specs in w390-light) | CI R1 PASS (`8a5e666`) | Spec R1 APPROVE (no findings; a dead `useId` removed) | Audit R1 PASS (every AC discriminating; restoration OK) | UI R1 CHANGES (the open menu was clipped by `.group{overflow:hidden}`: a mouse or finger could only hit *Last used*; scripted `click()` had hidden it) → fixed with `.group:has(.menu-wrap){overflow:visible}` and a hit-test spec that fails without it | Verify R2 PASS | Verify R3 PASS (49 specs) | Drift R1 update first (behind 3; both changed `design/mockups.html`, `design/mockups-index.md`, `src/app/globals.css`; main changed `src/db/queries.ts`) → rebased, clean | UI R2 not re-run (it needs a sign-in in the verifier's browser; the hit-test spec covers the defect; the owner walked it and accepted) | Verify R4 PASS on the rebased head | CI R2: see the PR | Accepted by the owner 2026-11-25

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4 (R1 to R3 PASS, R4 on the rebased head)
- Review rounds: 2 (spec-reviewer 1, test-auditor 1, ui-verifier 1 with CHANGES; the fix is covered by a new spec)
- First-pass AC FAILs: 0 (AC-5's mouse path failed the ui-verifier's walk; no spec had failed)
- Plan revisions after approval: 0
