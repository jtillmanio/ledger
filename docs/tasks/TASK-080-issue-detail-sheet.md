---
id: TASK-080
title: 3.5 Detail sheets (3 of 3) — the issue sheet, every run that places it
status: In progress
depends_on: [TASK-078, TASK-079]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 77d8dd8
---

# TASK-080 — 3.5 Detail sheets (3 of 3) — the issue sheet, every run that places it

## Goal

Tapping an issue opens a sheet with its story, credits and dates, and every run it sits in with its read state there, so a reader can mark it read in one more run, deliberately, one run at a time.

## Context

- Roadmap: `docs/05-roadmap.md` § 3.5 Detail sheets — books and issues (M14). The entry and its **Check:** are the contract. Feature F-29. This part's merge ticks the entry.
- **Split, 3 of 3.** TASK-078 stored the story arc (and the store date, if approved); TASK-079 built the route sheet. This part is `/comics/[runId]/[issueId]` on the same frame: a sheet from the run detail (`src/app/@modal/(.)comics/[runId]/[issueId]/page.tsx`), a full page on a direct load (`src/app/comics/[runId]/[issueId]/page.tsx`). The run page stays a full page.
- **Your record** (design § 13 → *The issue sheet*; data model 2.14; mockup `issuedetail`, `powershell -NoProfile -File scripts/screen.ps1 issuedetail`): a table of every run that places the issue, run · position · read state · date. Read runs a green tick and a date, unread runs a grey ring, the run you came from marked *this run*. Each row has its own `aria-pressed` toggle that marks that placement through the existing write (`/api/progress/issue`, `src/db/writes.ts`), with its undo; there is no *mark all* and nothing propagates (`.claude/rules/schema.md` → *Read state is per run*). DNF in the status editor is grey.
- **Credits are selective** (the entry): Writer, Penciller (role `artist`) and Inker (only when the issue has one) by default; Cover only when the cover artist differs from the penciller; Colorist and Letterer under a *More credits* disclosure. All six roles stay in `issue_credits`; `run_credit_line` is unchanged.
- **Dates** (spine v2): a *Dates* group lists *Cover date* (`issues.cover_date`, `Mon YYYY`) and, when it differs and only if TASK-078 added it, *Published* (`issues.store_date`). Both grey. An undated issue renders no *Dates* group and no `—`.
- Also on the sheet: hero, story title (`issues.story_title`), story arc (TASK-078), collecting editions (`editions`). Links to reading sources, if they ever arrive, go here and nowhere else (STYLE_GUIDE § 12).
- **What links to it**: the spine's grey `+N` / *read in …* hint and every issue row (`src/components/IssueRow.tsx`), and the master list's collapsed row, whose full record is this sheet.
- **Stop and ask at plan time:** the Check's *Opening Why blocked? from inside an issue sheet leaves exactly one sheet in the DOM, and Back returns to the issue sheet* needs 2.6's *Why blocked?* sheet (`/comics/[runId]/path`, roadmap § 2.6, M12), which is not built. Whether this part waits for 2.6, builds the clause's test against another sheet the issue sheet can open, or carries the clause to 2.6 is the owner's call.
- Decisions: D-19, D-33, D-34, D-63, D-129, UX-N10, UX-N12. Hard rules 3 and 6.
- *From TASK-079 (3.5, PR #275), open question for the plan:* the route above, `@modal/(.)comics/[runId]/[issueId]`, would catch `/comics/[runId]/add` as an issue called `add` (D-157): Next 16 applies an intercepting route's rewrite ahead of the static routes beside it, which is why the book's route became `/book/[id]`. Pick a route with no static sibling (an `/issue/…` segment, say) and say how it reads the Check's wording. The frame to reuse is `src/components/RouteSheet.tsx` with `SheetHeading`, mounted as the segment's `layout.tsx` so the skeleton gives way inside one sheet; a plain `router.refresh()` inside it stays soft once the route has no static sibling.
- *From TASK-079 (3.5, PR #275):* the cover → hero morph through the View Transitions API (`view-transition-name: cover-{id}`, the entry's progressive enhancement) was left for this part, to build once for both sheets; without support it is the plain enter the book sheet has now.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves the issue clauses: three runs listed with one read, marking a second writes exactly one `issue_progress` row, one sheet in the DOM after *Why blocked?* (as settled at the plan gate), *Cover date* in `Mon YYYY`, and no *Dates* group for an undated issue. TASK-079 proves the book clauses): test that the back button dismisses the sheet and restores list
scroll position; that a direct visit to `/books/{id}` renders the full page;
that a book with no summary renders without a layout shift; and that the sheet
and the master list's inline editor write status through the same code path.
Test that an issue placed in three runs, read in one, lists three runs with one
read, and that marking a second from the sheet writes exactly one
`issue_progress` row. Opening *Why blocked?* from inside an issue sheet leaves
exactly one sheet in the DOM, and Back returns to the issue sheet. An issue
with a `cover_date` renders *Cover date* in `Mon YYYY`. An undated issue
renders no *Dates* group and no `—`.
- [ ] AC-2: Given an issue placed in three runs and read in one, opened from one of the unread runs, *Your record* lists three rows, the read one with a green tick and its date, the other two grey rings, the opening run marked *this run*; pressing one unread row's toggle sets `aria-pressed="true"`, writes one `issue_progress` row for that placement and no other, and its undo removes it.
- [ ] AC-3: An issue whose cover artist is its penciller renders no Cover row; one with a different cover artist renders it; one with no inker credit renders no Inker row; Colorist and Letterer render only inside the *More credits* disclosure.
- [ ] AC-4: An issue with `cover_date` 1981-01-01 renders *Cover date* `Jan 1981`; an undated one renders no *Dates* group and no `—`; *Published* renders only when a store date exists and differs.
- [ ] AC-5: Loading `/comics/{runId}/{issueId}` directly renders the full page; from the run detail the sheet opens over the spine and Back returns to the spine at its scroll position with focus on the row that opened it.
- [ ] AC-6: The issue sheet and full page meet the UX floor (`docs/04-design.md` § 10. The UX floor): loading and error states drawn; each placement toggle is a real button named with its run and position, 44px on the phone; the *More credits* disclosure is a real button with `aria-expanded`; read state carries a glyph and text, not colour alone; text 4.5:1 in both themes; axe reports no new violations; screenshots at 360px, 834px and 1280px, light and dark.

## Out of scope

- The book sheet (TASK-079).
- 2.6's *Why blocked?* path sheet itself.
- `issues.summary` (4.1) and the comic series page (5.13).
- A placement's drafted note (7.8).

## Files likely touched

- `src/app/@modal/(.)comics/[runId]/[issueId]/page.tsx` (new), `src/app/comics/[runId]/[issueId]/page.tsx` (new).
- `src/components/IssueDetail.tsx` (new) — the content and *Your record*.
- `src/components/IssueRow.tsx` — rows and the `+N` hint link to the sheet.
- `src/db/queries.ts` — one issue's placements with read state, credits, editions.
- `test/issue-detail.test.tsx` (new), `test/e2e/issue-detail.spec.ts` (new), `test/spine.test.tsx`.

## Verification

- Automated: `test/issue-detail.test.tsx` (AC-3, AC-4), `test/e2e/issue-detail.spec.ts` (AC-1's issue clauses, AC-2, AC-5, axe) on the test database.
- Manual: on the dev database, open an issue that sits in several runs from its spine, mark it read in a second run from the sheet → that run's spine shows it read and the first run's is unchanged; undo it, leaving the data as found.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Candidate decision: the Check's *Why blocked?* clause (one sheet in the DOM, Back returns to the issue sheet) is proven by 2.6, which builds that sheet as a pane in the issue sheet's dialog (D-171); 3.5 ticks on this part's merge (approved at plan)
- 2.6: *Why blocked?* opened from inside the issue sheet is a pane (D-171), and 2.6's test proves 3.5's clause (approved at plan)
- The cover → hero morph (`view-transition-name: cover-{id}`) for both sheets: Next 16 offers it only through React's experimental `<ViewTransition>` and `experimental.viewTransition`; a new phase-3 roadmap item (approved at plan)
- *Collected in* on the issue sheet needs `edition_issues` (5.6); until then the section isn't drawn (approved at plan)
- DNF grey in the status editor: issues have no status editor, so nothing to draw (approved at plan)
- The master list's collapsed row: it is the books Library's, which already opens the book sheet (TASK-079) (approved at plan)

## Plan

Approved 2026-11-23 (owner: "approve plan with recommendations").

**Route (D-157).** `/comics/[runId]/issue/[issueId]`: no static sibling beside the `issue` segment, so `/comics/x/add` is never caught, and the run you came from is in the URL (*this run*). The Check's `/comics/{runId}/{issueId}` is read as this route. An issue the run doesn't place (live), or an unknown or removed issue, is not found.

**Steps**
1. `issueDetail(userId, runId, issueId)` in `src/db/queries.ts`: the issue's facts (label, story title, story arc, cover and store dates, cover URL, pending), its credits by role (name order), and every live placement (run id and title, sequence, the run's live placement count, placement id, read state and `readWhen` date, `this`), *this run* first then by run title. Null when the issue is gone or the run doesn't place it.
2. `src/components/IssueDetail.tsx` (server): hero (cover, label as `SheetHeading`, story title · cover date, an `arc · …` tag per arc, *in N runs*); *Dates* (*Cover date* `Mon YYYY`; *Published* only when a store date exists and its month differs; neither → no group, no `—`); *Credits* (Writer, Penciller = `artist`, Inker only when present, Cover only when its names differ from the penciller's; Colorist and Letterer under *More credits*); *Your record*. Plus `IssueDetailSkeleton`.
3. `src/components/IssueRecord.tsx` (client): one row per placement, a ✓ (`--ready`) or ○ (grey) glyph with text, *this run* marked, a `aria-pressed` button named `Mark read in <run>, issue n of N` (44px on the phone) through `markPlacement` (the spine's one write path and undo), `router.refresh()` on save and undo so the spine behind follows. No *mark all*. Also `MoreCredits`, a real `aria-expanded` button.
4. Routes: `src/app/@modal/(.)comics/[runId]/issue/[issueId]/` `layout.tsx` (`RouteSheet label="Issue"`), `page.tsx`, `loading.tsx`, `error.tsx`; `src/app/comics/[runId]/issue/[issueId]/` `page.tsx`, `loading.tsx`, `error.tsx`.
5. `src/components/IssueRow.tsx`: each row's label links to the sheet (its click doesn't set a range anchor), and the `+N` is a link to it (design § 14 *Run detail*), replacing the in-place disclosure.
6. `src/app/globals.css`: the record rows, glyphs, toggle size, disclosure, label link.
7. Companions of a new route: `scripts/perf/routes.mjs` + `scripts/perf/budget.json` (an `issue` route, resolved from the small run); `scripts/lib/ci-scope.mjs` (`@modal/(.)comics/` → comics, `IssueDetail`/`IssueRecord` comics components, `RouteSheet` shared now both media use it).

**Files outside "Files likely touched"**: the route's `layout/loading/error` files, `IssueRecord.tsx`, `globals.css`, `scripts/perf/routes.mjs`, `scripts/perf/budget.json`, `scripts/lib/ci-scope.mjs` (+ `test/ci-scope.test.ts` if it pins the lists), `test/issue-detail-query.test.ts`. The route moved off `[issueId]` directly (D-157). `design/mockups.html` is not redrawn: the spine's `+N` and label look the same; only the element behind them changes.

**Test strategy**
- AC-1 (issue clauses), AC-2: `test/e2e/issue-detail.spec.ts` "an issue in three runs read in one lists three rows…", "marking a second run writes exactly one issue_progress row, and Undo removes it"; `test/issue-detail-query.test.ts` (three runs, one read, positions, this run, soft-deleted placement left out, not-found cases). The *Why blocked?* clause: carried to 2.6 (decision at plan).
- AC-3, AC-4: `test/issue-detail.test.tsx` (credits rows, disclosure; Cover date `Jan 1981`, undated → no Dates and no `—`, Published only when it differs); AC-4 also in the e2e spec.
- AC-5: e2e "a direct load is the full page", "from the spine the sheet opens; Back returns to the spine's scroll with focus on the row link".
- AC-6: e2e floor test (loading and error drawn, toggle names and 44px, `aria-expanded`, glyph + text, contrast, axe, screenshots 360/834/1280 light and dark); `test/issue-detail.test.tsx` for the skeleton and error markup.
- `test/spine.test.tsx`: the label and `+N` link to `/comics/{run}/issue/{issue}`.

**Plan revision 1 (Phase 2)**: the label link would have swallowed a mouse shift-click that finishes a range, so a shift-click on it with a fine pointer goes to the row (`IssueRow.tsx`), proved by a new test in `test/range-sheet.test.tsx` (a file outside the list). The perf guard also needed the sheet's intercept listed as unmeasured in `test/perf.test.ts` and the route's row in `docs/02-architecture.md`'s Performance budget table (`test/perf.test.ts` mirrors it), and the new spec estimated times in `test/e2e/shard-times.json` (as PR #313 did), since `test/e2e-shards.test.ts` prices an untimed spec at 15 s per project and the 8-shard plan tipped past 3%.

**Risks**: the intercept with a dynamic `[runId]` ahead of a static `issue` segment (proven in the e2e spec, and `/comics/x/add` checked still to load); undo after the sheet closed refreshes the spine through the router.

**Size**: about 20 files, over the split threshold; kept whole on the owner's approval: it is already 3 of 3, seven are thin route wrappers, the perf and CI entries must ship with the route, and a sheet with no spine link can't be reached.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
