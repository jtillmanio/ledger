---
id: TASK-067
title: 2.7 Rebalance (2 of 2) — the rebalance sheet and the settled stretch year
status: Done
depends_on: [TASK-066]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 9cee95b
---

# TASK-067 — 2.7 Rebalance (2 of 2) — the rebalance sheet and the settled stretch year

## Goal

From an over-full year, one tap opens four equal choices, each showing what it would do. A year you accept turns a calm grey with an Undo, and stays settled until it grows past what you accepted.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.7 Rebalance, and accepting an overage (M11). The entry and its **Check:** are the contract. Feature F-23.
- **Split, 2 of 2.** TASK-066 built `plan_acceptance` and the moves; this part is what you see. **Its merge ticks the roadmap entry.**
- **Stop and ask at plan time (owner, at /new-task, 2026-11-09).** The entry puts the sheet *one tap from the books dashboard* and the banner *on the dashboard and the plan page*, and its Check tests that *the dashboard renders `.decide.settled`*. The owner's later answer at 2.2's plan gate (TASK-049, Q2) puts the capacity card with Rebalance and Accept on `/books/plan` only, never on the dashboard: `docs/04-design.md` § 12 → Books dashboard and → Over-commitment is a decision, not an error, and the dashboard's own notes in `design/mockups.html` (around line 2896). `/books/plan` is built by 2.10 (TASK-069), which M11's order puts after this. The plan asks which surface; if `/books/plan`, whether this task waits on TASK-069, and whether the owner amends the Check. Either way the dashboard's *This quarter* strip is the same rail (M-07, D-137), so its over-rule part takes `--hatch-settled` once the year is accepted.
- **The sheet** (mockup `rebalance`, `design/mockups.html` around lines 5001–5052; captures `rebalance-phone-dark.png`, `rebalance-desk-dark.png` in `design/screenshots/`): four equal-weight buttons, each with a before/after delta (*2028 then holds 45 books*) from TASK-066. A sheet that only offered ways to shrink the plan would be telling you your ambition is the bug (`docs/04-design.md` § 12).
- **Settled.** Accepting turns the amber (`.decide`) into a grey `.decide.settled` card stating what was accepted and when, with an Undo: *2027 accepted as a stretch year on 14 Sep · Undo* (sample figures, D-7). **Persistence is the whole feature**: an indicator that comes back next week is one the user learns to ignore. Both classes already exist in `src/app/globals.css` (around lines 924–931).
- **Settling keeps the data honest** (`design/Plan Rail Spec.dc.html` A4.2): the overage is still drawn, but its hatch turns from `--hatch` to the grey `--hatch-settled` (already a token, `globals.css` line 61) and the legend reads *over, accepted (settled)*; only the held state clears. The rail is `src/components/PlanRail.tsx` and `src/lib/plan-rail.ts`.
- The entry deletes the legacy red classes `.capnum.over` and `.pace .big.behind`. Neither is in `src/` or `design/mockups.html` today (grep, 2026-11-09); the PR confirms they stay gone.
- Amber means *held* and red is for destructive actions only (`docs/04-design.md` § 10): nothing here is red, and the word *behind* appears nowhere.
- The dashboard is a feel-pass surface; if the banner lands on `/books/plan`, that page follows the UX floor's ordinary screenshot widths.
- Decisions: D-37, D-137, D-40, D-7, M-07.
- *From TASK-070 (2.10, PR #245):* the plan page's loading skeleton doesn't match the loaded page at 1280px. Both gaps predate 2.10's drag; the drag readout's own line is matched since PR #245. First, the skeleton's header is about 14px shorter than the loaded *Plan* title and total line, so everything below it moves down when the page arrives. Second, `PlanRailSkeleton`'s rail is about 14px shorter than the loaded rail (the desktop footers carry `/ 760k` and a room or over badge). Since this task redraws the rail's legend and footers for the settled state, check the skeleton against them at 1280px. `swapInSkeleton` in `test/e2e/plan-rail.spec.ts` measures the rail's top, height and gap.
- *From TASK-068 (2.8, PR #246):* *Place them*'s closing card (`src/components/PlaceThem.tsx`, `Closing`) is amber when the year is still over. Mockup `plan`'s last frame gives it **Rebalance 2027** and **Accept as a stretch year**, which 2.8 left out because they are this task's. Add them to that card, opening the same sheet and Accept as the capacity card's. Accepting should also turn the card's amber to settled. The card is checked in `test/e2e/place-them.spec.ts` (Check, AC-3, AC-4).
- *From TASK-066 (2.7, PR #247):* what part 1 leaves this part.
  - **The route** is `/api/plan/rebalance` (`src/app/api/plan/rebalance/route.ts`):
    - POST `{ action: accept | next | on_deck | even, year }` answers `{ ok, undo }`, and what it did: `acceptance`, `moves` or `layout`.
    - DELETE `{ undo }` reverses that action. `{ undo: { kind: "accept", year } }` is also the settled card's *Undo acceptance*.
    - GET `?year=` answers `{ decision, overage }`.
  - **The reads**, in `src/db/queries.ts`:
    - `planDecision(userId, year)` gives `state` `fits | over | settled`, with `acceptedAt` (ISO) and `acceptedTotal`. A server page can call it directly.
    - `planOverage(userId, year)` gives the `to_read` books past each quarter's rule, plus `longestFirst` for On deck's suggestion.
  - **The sheet's deltas** come from the overage's words and the next year's `planCapacity` (*2028 then holds N books*). `previewPlanMove` is still the per-book figure.
  - **An accepted year that drops back under capacity** reads `fits`, not `settled`. The row stays, and the year settles again if it goes back over without passing `accepted_total`. Decide whether the banner says anything then.
  - **Starting books stay put.** Only `to_read` books move, so after *Move the overage* a year can stay slightly over when a started book is past the rule (D-148).
  - **`STRETCH_WHY`** in `src/components/PlanPicker.tsx` still disables the picker's *Accept as a stretch year*. Enabling it (POST `accept`) and dropping the reason is this part's job.
- *From TASK-068 (2.8, PR #246):* on `/books/plan`, axe's `label-content-name-mismatch` flags the rail's block buttons (`PlanRail.tsx`, 2.2b). A block shows `129k` and is named *The Last American Vampire, 129k words, 2027*: one at 360px and 834px, three at 1280px, the fifth lane's `.qb.un` ones included. The rule isn't in the suites' axe lists. While this task redraws the rail, consider whether a block's name should start with its visible text (WCAG 2.5.3, label in name).

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves `.decide.settled` and `--hatch-settled` in the browser, on TASK-066's stored acceptance): test that accepting 2027 at 118% stores the acceptance with a date and
that the dashboard renders `.decide.settled` rather than `.decide`, and the
over-rule part of each block uses `--hatch-settled`, not `--hatch`; that Undo
removes it; that a later change pushing 2027 past the accepted total re-raises
the flag; and that "even out the quarters" leaves the year's book count
unchanged and never puts a book ahead of one that was ahead of it before.
- [x] AC-2: Given a year over capacity, the rebalance sheet shows four buttons with the same class and size, each with its before/after delta as TASK-066 computes it; nothing on the sheet resolves to `--danger`, and no text on it says *behind*.
- [x] AC-3: After *Accept it as a stretch year*, the banner is `.decide.settled` and reads *<year> accepted as a stretch year on <day> <month> · Undo*; every over-rule block part on the rail (and on the strip) uses `--hatch-settled`, and the legend reads *over, accepted (settled)*. Undo returns the banner to `.decide` and the hatch to `--hatch`.
- [x] AC-4: With an acceptance stored on an earlier day, a fresh load still shows the settled state; placing a book that takes the year past `accepted_total` shows `.decide` again.
- [x] AC-5: The sheet and the banner meet the UX floor (`docs/04-design.md` § 10. The UX floor): four real buttons with names, nothing interactive under 24px and 44px on the phone, the sheet's focus on its heading and back on the opener, text 4.5:1 and the settled hatch 3:1 in both themes, axe with no new violations, no horizontal scroll at 360px, and screenshots at 360px, 834px and 1280px, light and dark (every feel-pass width, with reduced motion and transparency, if the banner is on the dashboard).

## Out of scope

- The table and the moves (TASK-066).
- `/books/plan` itself (2.10, TASK-069).
- Accepting from 2.3's preview (asked at TASK-064's plan gate).
- Rebalance for comics or watch (`design/mockups-index.md` open item 12: described, not drawn).

## Files likely touched

- `src/components/RebalanceSheet.tsx` (new; the plan's name) — the four peers.
- `src/components/PlanRail.tsx`, `src/lib/plan-rail.ts` — `--hatch-settled` and the legend.
- `src/components/QuarterStrip.tsx` — the strip's settled hatch.
- `src/app/books/page.tsx`, or `src/app/books/plan/page.tsx` (per the plan-gate answer) — the banner.
- `src/app/globals.css` — the sheet, from tokens only.
- `design/mockups.html`, `design/mockups-index.md` — only if the plan gate moves the banner from what `rebalance` draws.
- `test/e2e/rebalance.spec.ts` (new), `test/plan-rail.test.ts`, `test/e2e/plan-rail.spec.ts`.

## Verification

- Automated: `test/e2e/rebalance.spec.ts` (AC-1's browser clauses, AC-2 to AC-5); `test/plan-rail.test.ts` (the settled hatch and legend in the markup).
- Manual: `npm run dev`. Plan more than a year's capacity → the amber card; open Rebalance → four equal choices with their deltas; *Accept* → the grey card with the date; reload → still grey; place one more book → amber again; Undo the acceptance → amber. Put everything back, as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The plan picker's *Accept as a stretch year* stays `aria-disabled`; its reason now points at Rebalance on the plan page. Enabling it means *move, then accept the year*, shown only when the target's **year** would go over (the preview's `over` is the target period's, so a quarter over in a year that fits can't be accepted), which needs `previewPlanMove` to answer the year's figure too. TASK-072's budget line offers the same Accept (approved at plan) → docs/tasks/TASK-072-planning-sheet.md § Context
- The plan page skeleton is ~14px short in its header and ~14px short in its rail at 1280px (from TASK-070); the settled state changes neither height (the footer badge keeps its line, the legend item its wrap at 1280px), so the gap is unchanged and still open (approved at plan) → docs/tasks/TASK-072-planning-sheet.md § Context
- axe's `label-content-name-mismatch` on the rail's blocks (from TASK-068): untouched here, since this task changes no block's name (approved at plan) → docs/tasks/TASK-072-planning-sheet.md § Context
- Candidate decision: roadmap 2.7's prose and **Check:** put the card, Rebalance and the settled banner on the dashboard. This task built and tested them on `/books/plan`, per TASK-049 Q2 and `docs/04-design.md` § 12. A decision amending the entry (like D-147 for 2.8) waits on the owner, since decisions mode is `propose` → docs/OWNER-CHECKLIST.md § Approvals from follow-ups
- The development database lacked migration 0025 (`plan_acceptance`, TASK-066), so `/books` and `/books/plan` threw there. It is applied now (`npm run db:migrate`, in this session) → not tracked: done; production gets it through Release
- ui-verifier saw existing controls under 44px on the plan page and the dashboard: year chips 53×30 and *Library* 64×34 at 360px. They are at least 24px, the floor for anything that isn't the thumb bar or an icon button (UX floor), and this task added none of them → not tracked: within the floor, not this task's

## Plan

**Decisions taken at the gate (the owner asked for no stop; each is a question in the final report):**
- **Where the banner goes:** `/books/plan` only, per the owner's later answer at TASK-049 Q2 (`docs/04-design.md` § 12 → Books dashboard and → Over-commitment). The dashboard's *This quarter* strip gets the settled hatch and its figure turns grey, and that is all the dashboard says. AC-1's "the dashboard renders `.decide.settled`" is tested on `/books/plan`'s card, and the PR reports the wording as a roadmap/task disagreement. `rebalance`'s settled frame is redrawn on Plan (`ui.redrawFiles`).
- **Over means the year** (TASK-066's `planDecision`: `fits | over | settled` on the year's words). A year that fits with one quarter past its rule keeps the amber hatch and shows no card. An accepted year back under capacity reads `fits`, and the card says nothing.
- **The picker's Accept is not enabled** (see Follow-ups); only its stale *arrives with 2.7* reason changes.
- **Size:** about 20 files with tests, over the split line. Kept whole because the owner asked for the task done in one go; no schema change.

**Steps**
1. `src/lib/plan-rail.ts`: pure `decisionState(year, acceptedTotal)` and `evenQuarters(words[])` (the quarter for each book, by its words' midpoint). `planDecision` (queries) and `evenOutQuarters` (writes) call them, so the sheet's preview and the write share one rule.
2. `src/db/queries.ts`: `planAcceptance(year)` (one row read: `acceptedAt` as ISO, `acceptedTotal`).
3. `GET /api/plan/rebalance?year=` also answers `quarters` (the year's four), `next` (`{ year, books }` from `planYears(year, 2)`) and `even` (each quarter's words after *Even out*, from `planRail` and `evenQuarters`).
4. `src/lib/format.ts`: `acceptedDay(iso)`, the Eastern day as `14 Sep` (`dayWhen`).
5. `src/components/RebalanceSheet.tsx` (new): `RebalanceBody` (inside a `Sheet`: the lede, then four `.rb-opt` rows, each with a title, a delta and one `btn sec sm rb-go` of fixed equal size; the moves and even-out push an Undo toast; every action refreshes and closes; errors stay in the sheet as a neutral line) and `RebalanceButton` (opens it).
6. `src/components/YearDecision.tsx` (new): the plan page's card. Amber `.decide` *2027 is over by 546k…* with **Rebalance 2027** and **Accept as a stretch year**; settled `.decide.settled` *✓ 2027 accepted as a stretch year on 14 Sep. It stays at …* with **Undo**. Focus goes to the other state's button after a change.
7. `/books/plan` reads `planAcceptance` in its wave, renders the card when the state is over or settled, and passes `settled` to `PlanRail`. `PlanRail`: `data-settled` on the rail, the footer's over badge goes grey, and `RailLegend settled` reads *over, accepted (settled)* with a `--hatch-settled` swatch. `/books` does the same for `QuarterStrip` (settled hatch, grey figure and badge).
8. `globals.css` (tokens only): `[data-settled]` hatch, ring and badge; `.lg.ovr.settled`; `.rb-opt`, `.rb-go`.
9. `PlaceThem`'s closing card when over: **Rebalance 2027** swaps the same sheet to `RebalanceBody` (no second sheet, D-34), and **Accept as a stretch year** posts and turns the card settled with **Undo**. It reads the year's decision when it opens, so an accepted year's card is already grey. Closing refreshes the page after any change.
10. `PlanPicker`: `STRETCH_WHY` becomes *Accept the whole year from Rebalance on the plan page.*
11. Budgets: `/books` 10 → 11, `/books/plan` 4 → 5 (the acceptance row, in the same wave), with the reason in `docs/02-architecture.md` § Performance budget.
12. Mockup `rebalance`: the settled frame and the sheet's backdrop on Plan rather than Books; a note line; `design/mockups-index.md` row. The lede, the deltas and the settled line are redrawn in the year's figures, because over means the year (spec-review advisory).
13. *(Plan revision 1, after the first screenshots.)* `src/components/PlanQuarterRows.tsx` takes `settled`: the quarter rows' *over Nk* badges go grey like the rail's footers. The screenshots showed amber badges under a settled rail, which contradicts "only the held state clears" (§ 12, Plan Rail Spec A4.2). The Check test in `rebalance.spec.ts` covers it.

**Files:** steps 1–12 above, plus tests: `test/plan-rail.test.ts`, `test/plan-acceptance.test.ts`, `test/query-budget.test.ts`, `test/e2e/rebalance.spec.ts` (new), `test/e2e/place-them.spec.ts`, `test/e2e/plan-picker.spec.ts` (the reason text). Outside "Files likely touched": queries, writes, the route, format, `YearDecision.tsx`, PlaceThem, PlanPicker, RailLegend, the budget test and the architecture doc.

**Test strategy**
- AC-1: `rebalance.spec.ts` "Check": seed 2027-like year at ~118%; Accept → `plan_acceptance` row with today's date; `.decide.settled` on `/books/plan`, and every `.ov` on the rail and the dashboard strip computes `--hatch-settled`'s image, not `--hatch`'s; Undo → row gone and `.decide`; accept, then a placement past `accepted_total` → `.decide` again; *Even out* → same count, order kept (DB sequence). Unit: `plan-acceptance.test.ts` GET's `even` matches what `evenOutQuarters` writes, and `decisionState`.
- AC-2: spec: four `.rb-go` with equal class and box, each delta text from the seed's figures; no element resolves to `--danger`; no *behind*.
- AC-3: spec: banner text and the legend; `plan-rail.test.ts`: `settled` markup (`data-settled`, the legend copy, grey badge).
- AC-4: spec: an acceptance row inserted with yesterday's date shows settled on a fresh load; placing a book past the total → `.decide`.
- AC-5: spec: names, 24px/44px boxes, focus on the heading and back on the opener, contrast, settled hatch 3:1 against the surface, axe, no scroll at 360, screenshots 360/834/1280 × light/dark.
- PlaceThem: `place-them.spec.ts`: the closing card's two buttons; Accept turns it settled; Rebalance swaps the sheet to *Rebalance <year>*.

**Risks:** the strip's figure turning grey is my reading of "amber clears when you decide"; the even-out preview must match the write (one shared function, and a unit test pins it).

## Review log

_Filled by /implement-task. One line per round._

- Touched specs R1 FAIL(1) (rebalance.spec.ts:292: the skeleton's `.planrail.strip`, w390-light) → fixed | Touched specs R2 PASS
- Verify R1 PASS | Push → PR #248 | CI R1 FAIL (rebalance.spec.ts:135, `.qlegend` matched the streaming skeleton's legend, in w390-light, w390-touch and w768-light) → fixed | Verify R2 PASS | CI R2 PASS (every project, Vercel, Lighthouse)
- Schema R1 APPROVE (2 minors, both done: preview test with a no-count book and a deleted book; a direct `planAcceptance` test)
- Spec R1 CHANGES (Check SPEC GAP; `PlanQuarterRows` plan gap; mockup copy advisory) → R2 CHANGES (Owner checklist placement had no Follow-ups bullet) → fixed. The Check's "dashboard" clause is escalated to the owner (Owner checklist § Approvals); nothing else is open.
- Audit R1 PASS: every AC test fails on 9cee95b. One NON-DISCRIMINATING item, the query-budget ceiling bump: a ceiling can't fail when raised. Accepted as housekeeping, not AC evidence. Tree restored.
- UI R1 NOT RUN (the dev DB lacked migration 0025; the dev server was in a reload loop) → dev DB migrated, `.next/dev` cleared → UI R2: fits-year and layout clauses PASS. Over/settled UNTESTED on dev data (nothing planned there); `rebalance.spec.ts` covers them in CI at every width and theme.

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (plus 2 CI rounds, 1 fix)
- Review rounds: 2 (spec), 1 (schema), 1 (audit), 2 (UI)
- First-pass AC FAILs: 0 (one flaky locator in CI, AC-3's test)
- Plan revisions after approval: 1 (`PlanQuarterRows` grey badges)
