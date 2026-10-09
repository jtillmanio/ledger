---
id: TASK-003
title: 1.6 Resume pointer
status: Draft
depends_on: [TASK-002]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-003 — 1.6 Resume pointer

## Goal

Every run in progress says which issue is next, on the dashboard and at the top of the run page, and takes you straight to it. A fully read run says so instead.

## Context

- Roadmap: `docs/TASKS.md` § 1.6 Resume pointer (sitting 3, after 1.1). The roadmap entry and its **Check:** are the contract. `depends_on` TASK-002 records the sitting's build order (all three tasks edit `src/components/IssueRow.tsx`), not a data dependency.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.14 (the pointer is the lowest `run_issues.sequence` whose *placement* is unread, so an issue read only in another run still stops it). § 4. Interface, the telescope state table's *Fully read* row (the grey `✓ read · date` badge and a secondary action).
- Data model: derived, never stored (Hard rule 2). Read it from `live_run_issues` left-joined to `issue_progress`, in `src/db/queries.ts` (`.claude/rules/schema.md`: raw SQL there for anything joining views).
- Design: STYLE_GUIDE §9 *Next-issue strip* (a tonal `--raise` well with no ring, radius 8, padding 8; a 28×42 cover thumb with a text fallback until 4.3; the kicker *NEXT · n / N* in mono 11 caps `--faint`; the full label 13/18 600; the placement's `.inote` at most two lines; one link; the only `--brand` in the hero is *Resume*). Mockup `spine` draws the strip, *Resume #141* and the row anchor `id="p-42"`. Mockup `krakoa` shows the multi-series form, *Resume X-Men #8*. `.claude/rules/ui.md`: the verb names the issue by its label, and `#141` alone is used only on a single-series run.
- Decisions: D-40 (the feel pass: the dashboard Now hero, kicker *Up now*, is built in 2.4, not here), D-33 (desktop puts the strip in the sticky `dk-rail` hero, which arrives with 1.8; until then the hero is in the page flow).
- **Settled by the owner, 2026-10-09:**
  1. Until the issue sheet exists (3.5), the strip links to the pointer's row in the spine (`#p-…`), and 3.5 changes the target.
  2. *Resume #141* jumps to the pointer's row. It does not mark anything read.
  3. The fully-read badge shows the latest dated read in the run (`✓ read · <date>`). When every read in the run is `none`, it shows `✓ read` with no date.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): test with a run where issues 1-5 and 7 are read; assert the pointer returns issue 6. Mark issue 6 read in a different run holding it and assert the pointer still returns 6. Render the spine hero for that run and assert that the strip names issue 6 with its ordinal and its placement note, that its link's accessible name starts *Next: 6 of*, and that it contains no element styled `--brand` other than the Resume button. Mark every placement read and assert that the strip is gone and the fully-read badge is rendered.
- [ ] AC-2: The pointer skips soft-deleted placements and placements whose issue is soft-deleted (read through `live_run_issues`). It returns nothing for a run with no live placements. No column, table or migration is added: `git diff` touches nothing under `drizzle/` or `src/db/schema.ts`.
- [ ] AC-3: Given two runs with `run_progress.state = 'reading'`, the dashboard's in-progress list shows *Continue: <pointer label>* for each. Each links to `/comics/<runId>`, with a fragment equal to the `id` of the pointer's row on that run's spine. Neither page sends more queries or waves than before: the `BUDGET` entries for `/` and the run page in `test/query-budget.test.ts` are unchanged and still pass.
- [ ] AC-4: In a single-series fixture run whose pointer is `Uncanny X-Men (1963) #141`, the run hero's primary button reads *Resume #141*. In a fixture run spanning two series it reads the full label (*Resume X-Men (2019) #8*). In both, the button is the only element in the hero whose computed colour or background resolves to `--brand`, and it targets the pointer's row.
- [ ] AC-5: The spine hero meets the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*). The strip is one `<a href>` whose accessible name follows *Next: n of N, <label>, <note>*, with the note omitted when the placement has none. The kicker and label are at least 4.5:1 on `--raise` in both themes. *Resume* is a real control at least 44px tall. The fully-read badge carries the `✓` glyph and the text *read*. Screenshots of a reading run and a fully read run at every `ui.viewports` width, light and dark.

## Out of scope

- The comics dashboard's Now hero (kicker *Up now*, the lens, *Since Tuesday*, the state badge) (2.4). This task adds the pointer to the existing in-progress list only.
- The thumb bar and its *Mark #141 read* verb (1.8b), and the sticky desktop `dk-rail` (1.8).
- Real cover thumbs (4.3): until then, use the text fallback.
- The issue sheet (3.5) and the status screen's In flight tab (1.9). Both will reuse this pointer query.
- The telescope's fully-read rail (2.5b).

## Files likely touched

- `src/db/queries.ts`: the pointer (sequence, ordinal, label, notes, placement id) for `runHeader` and `inProgressRuns`, joined so neither adds a round trip.
- `src/app/comics/[runId]/page.tsx`: the spine hero with the strip, *Resume* and the fully-read state.
- `src/components/NextStrip.tsx` (new): the strip, server-rendered.
- `src/components/IssueRow.tsx`: a stable `id` anchor per row and `data-next` on the pointer row (`.iss[data-next]` already exists in CSS).
- `src/app/page.tsx`: *Continue: …* on each in-progress row.
- `src/app/globals.css`: the strip well, kicker and the hero button.
- `test/resume-pointer.test.ts` (new, DB) and `test/resume-strip.test.tsx` (new, render).

## Verification

- Automated: `test/resume-pointer.test.ts` against `TEST_DATABASE_URL`: the 1-5 and 7 fixture returns 6, a read of 6 elsewhere still returns 6, soft-deleted placements are skipped, and a fully read run returns nothing (AC-1, AC-2). `test/resume-strip.test.tsx` renders the hero for those fixtures and asserts the accessible name, the single `--brand` element, the *Resume* label in both forms, and the fully-read swap (AC-1, AC-4, AC-5). `test/query-budget.test.ts` stays green (AC-3).
- Manual: `npm run dev`, open the dashboard → expected: each mid-run row shows *Continue: <label>*, and clicking it lands on that row in the spine. Open a fully read run → expected: no strip, and a grey *✓ read* badge.

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
