---
id: TASK-016
title: 1.10 Comics Up next queue
status: Done
depends_on: [TASK-015]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c1ef176
---

# TASK-016 — 1.10 Comics Up next queue

## Goal

Runs you want to read next sit in one ordered list you control: add, reorder and remove them. The dashboard shows them as a shelf of covers with **Start** on the first. Starting or finishing a run never loses its place.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.10 Comics Up next queue (sitting 7, first). product § Requirement changes. The roadmap entry and its **Check:** are the contract. No years, quarters or capacity: don't add them.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new table and view, the add, reorder and remove writes, a keyboard-operable reorderable list, the dashboard cover shelf, and *+ Up next* / *Read next* on three surfaces.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though data model 2.16 specifies it: `run_queue(user_id → users, run_id → runs, ordinal int NOT NULL, added_at timestamptz NOT NULL DEFAULT now())`, `PRIMARY KEY (user_id, run_id)`, `UNIQUE (user_id, ordinal) DEFERRABLE INITIALLY DEFERRED`. It is added to `USER_TABLES` (Hard rule 7). The CLAUDE-CODE-PROMPTS hint is Sonnet. This draft says Opus because it is a schema change.
- Architecture: `docs/03-data-model.md` § 2. Decisions — 2.16 (the queue: membership stored, state derived; removing is a hard delete of the queue row with an undo toast; anything real can be queued, blocked runs included; placeholders and soft-deleted runs can't). `.claude/rules/schema.md` *The comics Up next queue is an ordered list, not a plan*.
- Data model: new `run_queue_state` view in `etl/views.sql` (the queue joined to `run_progress` and `run_readiness`: state `unstarted` / `reading` / `read`, readiness, blocked-by count).
- Design: `design/Ledger Feel Review.dc.html` §2 (the cover shelf), STYLE_GUIDE §7 `shelf` and §14.1 (slot 2), FP-D2, FP-D18 (the shelf stops at main's edge from 1024px). Mockup `queue` (Up next, the lifted row with its menu, Done → Stopped, the empty queue) and `status`. Reference screenshots `design/screenshots/phone/01…02`. Copy per §15 (*Ready when you are*).
- Decisions: D-40 (FP-D2, FP-D18), R1-08 (*Start* navigates, never writes), M-08 (one queue row for the status tab and *Reorder*), D-26b.
- Builds on TASK-001 (undo), TASK-003 (*Start* goes to the first unread placement's row), TASK-014 (shell, `--cover-*` tokens) and TASK-015.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): adding three runs gives ordinals 1–3; *Read next* on a fourth puts it at 1 and shifts the rest; moving #3 to the top gives a contiguous 1–4; removing #2 leaves 1–3 with no gap, and undo restores the exact prior order. Marking one placement of a queued run moves it out of the dashboard's Up next and into In flight while its `run_queue` row is unchanged. Queuing a blocked run succeeds and `run_queue_state` reports its blocked-by count. Queuing a placeholder is rejected. Two concurrent reorders never leave duplicate ordinals. The documented keyboard sequence (Space, Down, Down, Space) moves a row from position 2 to 4 with contiguous ordinals, and Esc mid-lift leaves the order unchanged. The dashboard shelf renders the queue's unstarted runs in ordinal order with **Start** on the first card only and no drag handle on any card, and **Reorder** reaches a list where that keyboard sequence works. At 1280px the shelf ends at main's edge, not the viewport's; with a fine pointer and twelve queued runs ‹ › render and › moves it by five covers, and with three queued runs they do not render.
- [x] AC-2: **Start** is a link to `/comics/<runId>#p-…` (the first unread placement's row) and sends no write: a test asserts zero `POST` requests when it is followed. Unmarking a started run back to zero read placements returns it to the shelf at its old ordinal.
- [x] AC-3: The run detail offers *+ Up next* (appends) and *Read next* (to the top). Run-list rows and the dashboard's *Ready when you are* rows offer *+ Up next*. A run that's already queued shows *In Up next · #N* with its current ordinal instead of a button. Queuing a soft-deleted run is rejected with 400.
- [x] AC-4: The drag handle is `<button class="drag">` named *Reorder <run title>, position n of N*, described by a help text, with lift, move, drop and cancel announced in an `aria-live` region. The row menu offers *Move to top · Move up · Move down · Remove*. **Remove** pushes a TASK-001 undo entry whose inverse restores the row at its old ordinal. With the queue empty, the shelf reads *Nothing queued — pick from N ready runs* (N computed) and links to *Ready, not queued*.
- [x] AC-5: `run_queue` is in `USER_TABLES`, `test/export-tables.test.ts` passes, and `npm run check:migrations` passes.
- [x] AC-6: The shelf and the queue list meet the UX floor and the feel-pass check (`docs/04-design.md` § 10. The UX floor and § *A feel-pass surface is checked more widely*): every state (populated, one card, empty, overflowing) at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion`; ‹ › only under `(hover:hover) and (pointer:fine)`, with ‹ `aria-disabled` at the start; covers fall back to the neutral placeholder; drag is behind a fine pointer and long-press on touch; axe reports no new violations.

## Out of scope

- The status screen's tabs (1.9), which reuse this task's queue row.
- Cost and leverage on *Ready, not queued* (2.6), and the comics dashboard's other slots (2.4).
- Real covers and `--art` (4.3).
- Any date, year, quarter or capacity on the queue.

## Files likely touched

- `src/db/schema.ts`: `run_queue`. `drizzle/<tag>.sql` and `drizzle/meta/*` are generated, then hand-edited for `DEFERRABLE`.
- `src/db/export-tables.ts`: add `run_queue`.
- `etl/views.sql`: `run_queue_state`. `etl/test_views.sql`: its cases.
- `src/db/writes.ts`: append, read next, move, remove (one transaction each). `src/db/queries.ts`: shelf and list reads.
- `src/app/api/queue/route.ts` (new).
- `src/components/QueueShelf.tsx` (new), `src/components/QueueList.tsx` (new, the shared queue row), `src/components/QueueButton.tsx` (new).
- `src/app/comics/page.tsx`, `src/app/comics/[runId]/page.tsx`, `src/app/comics/runs/page.tsx`: place them.
- `src/app/globals.css`: shelf, cover chip, queue row, drag states.
- `test/run-queue.test.ts` (new, DB), `test/e2e/queue.spec.ts` (new).

## Verification

- Automated: `test/run-queue.test.ts` against `TEST_DATABASE_URL` covers every ordinal move, undo of remove, the queue row surviving a mark, blocked and placeholder runs, and concurrent reorders (AC-1, AC-3, AC-5). `test/e2e/queue.spec.ts` covers the keyboard sequence and Esc, shelf order and **Start**, no write on **Start**, the 1280px edge and the ‹ › paging (AC-1, AC-2, AC-4, AC-6). `etl/test_views.sql` covers `run_queue_state`.
- Manual: on the Vercel preview, queue four runs, *Read next* a fifth, then reorder with the keyboard → expected: the order shown matches and survives a reload. Mark one placement of the first → expected: it leaves the shelf.

## Follow-ups

- Table count 32 → 33 (`run_queue`, migration 0014) → docs/03-data-model.md § 2.16 (approved at plan)
- `/comics` 5 → 6 queries in one wave (the shelf), `/comics/status` 2 → docs/02-architecture.md § Performance budget (approved at plan)
- `/comics/runs` document + RSC budget 47,000 → 57,000: the run rows' **+ Up next** measured 47,740 on PR #115's preview (median + 20%) → docs/02-architecture.md § Performance budget (approved at close-out)
- `/comics/status` holds the Up next content only; 1.9 adds the tablist, the *Status* h1, the nav flip, and `ready_hard` in *Ready, not queued* → docs/tasks/TASK-017-status-screens.md § Context
- The shelf, the side rail and `QueueBadge` are in place; `<RunStateBadge>`, the FP-D15 hover reveal on the rail's **+ Up next**, and the shelf's skeleton geometry are 2.4's → docs/05-roadmap.md § 2.4
- The blocked badge counts direct hard prerequisites (`blocked_by`); the transitive count and the shelf's *Why held?* button wait for `run_ancestors` → docs/05-roadmap.md § 2.6
- *+ Up next*'s accessible name is "Add <title> to Up next", which doesn't contain the visible "+" verbatim (ui-verifier) → not tracked: accepted as is; "Up next" is in the name, and the default axe rules pass
- `playwright-report/` (git-ignored, written by every browser run) isn't in eslint's `globalIgnores`, so `npm run lint` after a local e2e run lints the minified report → not tracked: a one-line tooling fix outside this task, offered to the owner in the PR
- *Ready, not queued* counted 29 with 12 queued of 40 ready (ui-verifier): a queued `ready_hard` run is in neither count → not tracked: correct by design (the list is `ready_all`)

## Plan

Approved by the owner 2026-10-23, with three decisions: the schema change as data model 2.16 specifies it; *Reorder* opens `/comics/status?tab=next`, which this task builds with the Up next content only (1.9 adds the other tabs and the tablist, and flips the nav item); the owner's `.claude/settings.local.json` edit is left unstaged and goes on its own `chore/` branch after this task.

**Revision 1** (owner, 2026-10-23): the Check's "› moves it by five covers" at 1280px assumes main beside the side rail (STYLE_GUIDE §14.6, main 656 at 1280 and 592 at 1024), and the dashboard had none. From 1024px the dashboard becomes main + side rail (`--aside-w`, 24px gap, 32px from 1280), with *Ready when you are* in the rail and the slots' DOM order unchanged; 2.4 builds the rest of the desktop layout around it. Smaller additions found while building: `src/components/QueueBadge.tsx` (the badge, shared by the shelf and the list until 2.4's `RunStateBadge`), `danger` on `src/components/Menu.tsx` items (only *Remove* is red), `src/app/comics/status/loading.tsx`, `test/loading-states.test.tsx`, and the dashboard thumb bar's empty verb now starts the top of Up next (STYLE_GUIDE §14.2).

### Steps

1. Schema: `runQueue` in `src/db/schema.ts` as data model 2.16 (FKs cascade). `npm run db:generate` → `drizzle/0014_*.sql`, hand-edited for `DEFERRABLE INITIALLY DEFERRED` as in 0013. `run_queue` in `USER_TABLES` and in `truncateAll` (`test/db.ts`). Create only, so no down file.
2. View: `run_queue_state` in `etl/views.sql`: the queue joined to `run_progress` and `run_readiness`: `ordinal`, `added_at`, `state` (`unstarted` / `reading` / `read`), `readiness`, `blocked_by` (direct hard prerequisites unread; the transitive count is 2.6's). Cases in `etl/test_views.sql`.
3. Writes in `src/db/writes.ts`, one transaction each behind a per-user advisory lock (the plan helpers' shape): `queueRun(userId, runId, "end" | "top")` (rejects placeholder, soft-deleted and missing runs; a queued run is left where it is), `moveQueued(userId, runId, to)` (top, up, down and the keyboard drop), `removeQueued` (answers the old ordinal), `restoreQueued(userId, runId, ordinal)` (Remove's undo).
4. `src/app/api/queue/route.ts`: POST add or restore, PATCH move, DELETE remove; 400 for a run that can't be queued.
5. Reads in `src/db/queries.ts`: `queueState(userId)` (rows plus N ready, not queued); `readyToRead`, `listRuns` and `runDetail` gain `queued_ordinal` by a LEFT JOIN. The dashboard goes from 5 to 6 queries in 1 wave; the budget is raised with its reason in `docs/02-architecture.md`.
6. Components: `QueueButton` (*+ Up next* / *Read next* / *In Up next · #N*), `QueueShelf` (cover placeholder, ordinal chip on `--overlay`, two-line title, mono meta, readiness badge; **Start** a link to `#p-<first unread>` on the first card only; ‹ › under `(hover:hover) and (pointer:fine)` only while overflowing, ‹ `aria-disabled` at the start; the empty state), `QueueList` (the shared row: `button.drag` named and described, Space / arrows / Space / Esc with an `aria-live` line, pointer drag behind a fine pointer and long-press on touch, the ⋯ menu *Move to top · Move up · Move down · Remove*, Remove with an undo entry).
7. Pages: the dashboard's slot 2 shelf after Mid-run, *Start next* renamed *Ready when you are* (§15) with *+ Up next* outside each row's link; the run detail's *+ Up next* and *Read next*; the run list's *+ Up next*; new `src/app/comics/status/page.tsx` (the queue list and *Ready, not queued*).
8. `src/app/globals.css`: shelf, chip, queue row, drag states; tokens only.

**Files**: `src/db/schema.ts`, `drizzle/0014_*.sql` + `drizzle/meta/*`, `src/db/export-tables.ts`, `etl/views.sql`, `etl/test_views.sql`, `src/db/writes.ts`, `src/db/queries.ts`, `src/app/api/queue/route.ts`, `src/components/QueueShelf.tsx`, `QueueList.tsx`, `QueueButton.tsx`, `src/app/comics/(dash)/page.tsx`, `src/app/comics/[runId]/page.tsx`, `src/app/comics/runs/page.tsx`, `src/app/globals.css`, `test/run-queue.test.ts`, `test/e2e/queue.spec.ts`. Not in *Files likely touched*: `src/app/comics/status/page.tsx` (owner decision), `test/db.ts` (truncate), `test/query-budget.test.ts` and `docs/02-architecture.md` (the budget), `scripts/lib/e2e.mjs` if the e2e seed needs more runs.

### Test strategy

- AC-1: `test/run-queue.test.ts` (ordinals 1–3, *Read next* → 1, move #3 to top, remove #2 + restore, the row unchanged by a mark, blocked queued with `blocked_by`, placeholder rejected, two concurrent `moveQueued` with no duplicate); `test/e2e/queue.spec.ts` (keyboard 2 → 4 and Esc, shelf order, Start on the first card only, no `.drag` on the shelf, Reorder reaches the list, the 1280px edge, ‹ › with 12 and none with 3).
- AC-2: e2e (Start's href, zero POSTs after following it); DB test (unmark to zero puts it back on the shelf at its old ordinal).
- AC-3: e2e (*+ Up next*, *Read next*, *In Up next · #N* on all three surfaces); DB/API test (soft-deleted → 400).
- AC-4: e2e (the handle's name, description and live-region lines; the menu items; Remove + Undo; the empty copy with N and its link).
- AC-5: `test/export-tables.test.ts`, `npm run check:migrations`.
- AC-6: e2e at every project width, light and dark, reduced motion, axe; long-press on touch checked by hand.

**Risks**: long-press can't be driven well in Playwright (manual). The shelf chip shows the queue ordinal, so a started #1 leaves the shelf starting at #2. N ready uses the dashboard's existing rule (`ready_all`, unread).

**Follow-ups (approved at plan)**: listed under `## Follow-ups`.

## Review log

Verify R1 FAIL(1: list-totals needed the UndoProvider) → R2 PASS → R3 PASS (after round-1 review fixes; lint first tripped on a generated `playwright-report/`, clean once it was removed) | Audit R1 NOT RUN (owner's uncommitted settings file) → R2 PASS | Spec R1 CHANGES (roadmap tick, `home` redraw, Follow-ups format, AC-6 long-press UNTESTED, AC-3 read rows) → R2 APPROVE | Schema R1 APPROVE (2 minor, both fixed) | UI R1 PASS (Start 44px and title-link 24px fixed) | Ready gates: CI check PASS; Lighthouse R1 FAIL (/comics/runs 47,740 > 47,000 bytes) → budget raised with the owner's OK

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 3 (R1 FAIL, R2 and R3 PASS)
- Review rounds: 2
- First-pass AC FAILs: 1 (AC-6: long-press UNTESTED)
- Plan revisions after approval: 1 (the side rail, owner-approved)
