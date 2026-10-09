---
id: TASK-016
title: 1.10 Comics Up next queue
status: Draft
depends_on: [TASK-015]
size: L
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-016 — 1.10 Comics Up next queue

## Goal

Runs you want to read next sit in one ordered list you control: add, reorder and remove them. The dashboard shows them as a shelf of covers with **Start** on the first. Starting or finishing a run never loses its place.

## Context

- Roadmap: `docs/TASKS.md` § 1.10 Comics Up next queue (sitting 7, first). FEATURES Part 2i. The roadmap entry and its **Check:** are the contract. No years, quarters or capacity: don't add them.
- **Why this is one large task** (`workflow.splitPolicy: never-split`): a new table and view, the add, reorder and remove writes, a keyboard-operable reorderable list, the dashboard cover shelf, and *+ Up next* / *Read next* on three surfaces.
- **Schema change, stop and ask at plan time** (CLAUDE.md), though ARCHITECTURE 2.16 specifies it: `run_queue(user_id → users, run_id → runs, ordinal int NOT NULL, added_at timestamptz NOT NULL DEFAULT now())`, `PRIMARY KEY (user_id, run_id)`, `UNIQUE (user_id, ordinal) DEFERRABLE INITIALLY DEFERRED`. It is added to `USER_TABLES` (Hard rule 7). The CLAUDE-CODE-PROMPTS hint is Sonnet. This draft says Opus because it is a schema change.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.16 (the queue: membership stored, state derived; removing is a hard delete of the queue row with an undo toast; anything real can be queued, blocked runs included; placeholders and soft-deleted runs can't). `.claude/rules/schema.md` *The comics Up next queue is an ordered list, not a plan*.
- Data model: new `run_queue_state` view in `etl/views.sql` (the queue joined to `run_progress` and `run_readiness`: state `unstarted` / `reading` / `read`, readiness, blocked-by count).
- Design: `design/Ledger Feel Review.dc.html` §2 (the cover shelf), STYLE_GUIDE §7 `shelf` and §14.1 (slot 2), FP-D2, FP-D18 (the shelf stops at main's edge from 1024px). Mockup `queue` (Up next, the lifted row with its menu, Done → Stopped, the empty queue) and `status`. Reference screenshots `design/screenshots/phone/01…02`. Copy per §15 (*Ready when you are*).
- Decisions: D-40 (FP-D2, FP-D18), R1-08 (*Start* navigates, never writes), M-08 (one queue row for the status tab and *Reorder*), D-26b.
- Builds on TASK-001 (undo), TASK-003 (*Start* goes to the first unread placement's row), TASK-014 (shell, `--cover-*` tokens) and TASK-015.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): adding three runs gives ordinals 1–3; *Read next* on a fourth puts it at 1 and shifts the rest; moving #3 to the top gives a contiguous 1–4; removing #2 leaves 1–3 with no gap, and undo restores the exact prior order. Marking one placement of a queued run moves it out of the dashboard's Up next and into In flight while its `run_queue` row is unchanged. Queuing a blocked run succeeds and `run_queue_state` reports its blocked-by count. Queuing a placeholder is rejected. Two concurrent reorders never leave duplicate ordinals. The documented keyboard sequence (Space, Down, Down, Space) moves a row from position 2 to 4 with contiguous ordinals, and Esc mid-lift leaves the order unchanged. The dashboard shelf renders the queue's unstarted runs in ordinal order with **Start** on the first card only and no drag handle on any card, and **Reorder** reaches a list where that keyboard sequence works. At 1280px the shelf ends at main's edge, not the viewport's; with a fine pointer and twelve queued runs ‹ › render and › moves it by five covers, and with three queued runs they do not render.
- [ ] AC-2: **Start** is a link to `/comics/<runId>#p-…` (the first unread placement's row) and sends no write: a test asserts zero `POST` requests when it is followed. Unmarking a started run back to zero read placements returns it to the shelf at its old ordinal.
- [ ] AC-3: The run detail offers *+ Up next* (appends) and *Read next* (to the top). Run-list rows and the dashboard's *Ready when you are* rows offer *+ Up next*. A run that's already queued shows *In Up next · #N* with its current ordinal instead of a button. Queuing a soft-deleted run is rejected with 400.
- [ ] AC-4: The drag handle is `<button class="drag">` named *Reorder <run title>, position n of N*, described by a help text, with lift, move, drop and cancel announced in an `aria-live` region. The row menu offers *Move to top · Move up · Move down · Remove*. **Remove** pushes a TASK-001 undo entry whose inverse restores the row at its old ordinal. With the queue empty, the shelf reads *Nothing queued — pick from N ready runs* (N computed) and links to *Ready, not queued*.
- [ ] AC-5: `run_queue` is in `USER_TABLES`, `test/export-tables.test.ts` passes, and `npm run check:migrations` passes.
- [ ] AC-6: The shelf and the queue list meet the UX floor and the feel-pass check (`docs/TASKS.md` § *The UX floor, for every UI task* and § *A feel-pass surface is checked more widely*): every state (populated, one card, empty, overflowing) at 360, 390, 412, 768, 1024 and 1280px, light and dark, plus `prefers-reduced-motion`; ‹ › only under `(hover:hover) and (pointer:fine)`, with ‹ `aria-disabled` at the start; covers fall back to the neutral placeholder; drag is behind a fine pointer and long-press on touch; axe reports no new violations.

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
