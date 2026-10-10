---
id: TASK-001
title: 1.2 Undo
status: Done
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: e5abd2d
---

# TASK-001 — 1.2 Undo

## Goal

Any mark made in the app can be taken back for eight seconds, from a toast that says what just happened or with `Ctrl+Z`. Undo puts back exactly what was there before, including a read's original date.

## Context

- Roadmap: `docs/TASKS.md` § 1.2 Undo (sitting 3, built first: 1.1's check asserts undo, R3-10). The roadmap entry and its **Check:** are the contract.
- Architecture: `docs/ARCHITECTURE.md` § 2. Decisions — 2.14 (read state belongs to the placement; "range marks, undo and the thumb bar act on placements in the current run only") and 2.17 (a date is stored with its precision).
- Data model: `src/db/schema.ts` `issueProgress` (`completed_at`, `completed_at_precision`, and the CHECK that pairs them); `.claude/rules/schema.md` § *A date is stored with its precision*.
- Design: STYLE_GUIDE §14.3 *The mark answers back* and §9 *Toast* (`--toast-bg`, `--toast-ink`, Undo in `--toast-link` 700, second line in `--toast-muted` mono 12/16, `role="status"`); copy per §15. Reference screenshots `design/screenshots/phone/03…08` (the mark storyboard). Mockup frames `spine` and `range` (`scripts/screen.ps1 spine`) carry the old one-line toast, so this task redraws them (standing rule 6).
- Decisions: D-40 (the feel pass and its toast copy), R1-09 (one closure-based stack with three later users), R3-10 (build order), D-9 (no cross-device revalidation).
- **One interface, three later users** (R1-09). The stack holds `{ label: string, undo: () => Promise<void> }`, never progress rows: 1.1 pushes a range mark as one entry, 1.10 a queue-order snapshot, 1.3/1.4c an insert.
- **Split with 1.8b.** This task owns the stack, `Ctrl+Z`, the toast's content and its 8-second lifetime. 1.8b owns the toast's position above the thumb bar, the 2px countdown bar, the enter animation, and the rule that a new toast commits the old one. 2.7's *Undo acceptance* is a different, persisted control and shares nothing with this one.
- **The roadmap says undo covers status changes**, but no screen changes a book's status yet: `POST /api/progress/book` has no caller in `src/`. The stack's closure interface covers that case, and the task that adds a status control pushes its own entry.
- **Date write approved by the owner, 2026-10-09** (CLAUDE.md *Stop and ask before … changing how any stored date is written*). Undoing an untick puts back the row's original `completed_at` and precision exactly, never `now()` / `exact`. Today `POST /api/progress/issue` only ever inserts `now()` / `exact`, so the plan says how the prior pair travels to the inverse and is written back. No other date write changes.
- **Status changes, settled 2026-10-09:** the closure interface is the whole of the status-change coverage here. The task that adds a book-status control pushes its own entry.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): test asserts mark → undo restores exact prior state, including `completed_at`. Test that an entry pushed with an arbitrary inverse closure runs it on undo, so the stack is not coupled to progress rows. A mark's toast reads the label, then the run's new read count *of* its total *in* the run's title.
- [x] AC-2: Given an unread placement, when it is marked read and then undone, the `issue_progress` row for that placement no longer exists. Given a placement read with `completed_at = 2026-03-14` and precision `approximate`, when it is unticked and then undone, the row is back with `completed_at = 2026-03-14` and precision `approximate`, not `now()` / `exact`. Given a placement read with precision `none`, the restored row is NULL / `none`.
- [x] AC-3: Given an entry pushed as `{ label: "x", undo: fn }` where `fn` is a spy that touches no progress table, pressing the toast's **Undo** calls `fn` exactly once and pops the entry. A second press does nothing. `Ctrl+Z` (and `⌘Z` on macOS) undoes the newest entry the same way, except while focus is in a text input, textarea or contenteditable.
- [x] AC-4: In a fixture run titled *Uncanny X-Men* with 3 of 10 placements read, all from one series, marking the fourth (`Uncanny X-Men (1963) #141`) shows a toast whose first line is `#141 read` and whose second line is `4 of 10 in Uncanny X-Men`, with `role="status"`, then **Undo**. In a fixture run spanning two series, the first line is the full label (`X-Men (2019) #8 read`). After **Undo**, the row's `aria-pressed` and the page's read count are back to their pre-mark values.
- [x] AC-5: The toast leaves after 8 seconds (fake timers: still present at 7.9s, gone at 8.1s), and its **Undo** is unavailable from then on. A failed inverse request leaves the row in its pre-undo state on screen, matching the database, and says so. It is never silently reverted.
- [x] AC-6: The spine and its toast meet the UX floor (`docs/TASKS.md` § *The UX floor, for every UI task*): **Undo** is a real `<button>` named *Undo* and at least 24px; toast text is at least 4.5:1 on `--toast-bg` in both themes; under `prefers-reduced-motion` the toast still appears and leaves, with no movement; screenshots of a toast on the spine at every `ui.viewports` width, light and dark.

## Out of scope

- The toast's position, countdown bar, enter animation and one-toast-at-a-time commit rule (1.8b), and the failed-write error toast with *Retry* (1.8).
- Range marking and its undo entry (1.1, which pushes onto this stack), queue reorder undo (1.10), and undo for inserts (1.3c, 1.4c).
- 2.7's persisted *Undo acceptance* banner. Don't share a component with it.
- Dashboard steps of the mark (lens cell, *Since Tuesday* stack): they don't exist until 2.4, and 2.4 wires them into the inverse.
- A book-status control. Nothing in the UI changes book status yet.
- Persisting the stack across reloads. It lives in memory only.

## Files likely touched

- `src/components/Undo.tsx` (new): the undo stack (context provider), the `Ctrl+Z` listener and the toast.
- `src/components/IssueRow.tsx`: push an entry on each tick and untick, with the toast's label and count line.
- `src/app/comics/[runId]/page.tsx`: pass the run title and total to the list, and mount the provider (or `src/app/layout.tsx`, if the provider is app-wide).
- `src/app/api/progress/issue/route.ts`: let the inverse restore a prior `completed_at` and precision (approved, see Context).
- `src/app/globals.css`: `.toast` content styles on the existing `--toast-*` tokens.
- `design/mockups.html`, `design/mockups-index.md`: redraw the `spine` toast with the two-line copy (`ui.redrawFiles`).
- `test/undo.test.tsx` (new), `test/placement-progress.test.ts`: the tests below.

## Verification

- Automated: `test/undo.test.tsx` (happy-dom, the pattern in `test/spine-toggle.test.tsx`), covering the closure-only entry (AC-3), the toast copy for single- and multi-series fixtures (AC-4) and the 8s lifetime with fake timers (AC-5). `test/placement-progress.test.ts` covers mark → undo and untick → undo against `TEST_DATABASE_URL`, asserting `completed_at` and precision for the `exact`, `approximate` and `none` cases (AC-2).
- Manual: `npm run dev`, open a run, tick a row → expected: a two-line toast with **Undo**. Press `Ctrl+Z` → expected: the row unticks and the read count drops by one. Untick a row that has a date, then Undo → expected: the issue sheet or the database shows the original date.

## Plan

Approved by the owner 2026-10-09.

**Steps**

1. `src/components/Undo.tsx` (new): `UndoProvider` + `useUndo().push({ label, detail?, undo })`. An in-memory closure stack; each entry expires 8s after its push. The toast shows the newest live entry: `role="status"`, line 1 the label, line 2 `detail` (mono, `--toast-muted`), a real `<button>Undo</button>`. Undo / `Ctrl+Z` / `⌘Z` (no Shift or Alt; not while focus is in an input, textarea or contenteditable) pops the newest entry before awaiting it, so a second press can't run it twice. A rejected `undo()` shows *Couldn't undo #141 read. Nothing changed.* and changes nothing on screen.
2. `src/app/layout.tsx`: mount the provider app-wide (1.10 and 1.3c/1.4c push from other screens).
3. `src/app/api/progress/issue/route.ts`: every response returns `prior`, the row as it was before the write (`{ completedAt: text, precision }`, or `null`), read with `DELETE … RETURNING completed_at::text` (or `INSERT … ON CONFLICT DO NOTHING` plus a select): text keeps the microseconds a JS `Date` drops. New optional `restore` (only with `completed: true`) upserts that exact pair back through `::timestamptz`; the precision must be one of the three, NULL exactly with `none`, otherwise 400. The owner-approved date write; no other write changes.
4. `src/components/IssueRow.tsx`: a client `RunSpine` owns the rows and renders the `n of N read` line, the server-rendered prereqs (`children`), then the list, so the layout doesn't change. Each tick or untick pushes an entry: `#141 read` on a single-series run, otherwise the full label; an untick reads `#141 unread`. Line 2 is `4 of 10 in <run title>`. The inverse POSTs `prior` back, and the row and the count change only once it succeeds.
5. `src/lib/format.ts` (not in "Files likely touched"): `issueNumber()` / `singleSeries()`, the same label regex as `run_span` in `etl/views.sql`. 1.8b's *Mark #141 read* verb reuses them.
6. `src/app/comics/[runId]/page.tsx`: use `RunSpine`, pass the title.
7. `src/app/globals.css`: `.toast` fixed to the bottom (safe area, the 720px column; 1.8b moves it above the thumb bar), `--toast-*` tokens only, Undo at least 44px, no animation (nothing for reduced motion to turn off).
8. `design/mockups.html`: the two-line toast on the `spine` frames (phone and desktop), the `range` toast redrawn in two lines, the mockup's `.toast` on the `--toast-*` tokens; the `design/mockups-index.md` row updated.

**Test strategy**

- AC-1, AC-2 — `test/placement-progress.test.ts`, against `TEST_DATABASE_URL`: mark → undo leaves no row; untick → undo for `exact` (a `now()` read, microseconds included), `approximate` 2026-03-14 and NULL/`none` brings back an identical `completed_at::text` and precision; a bad `restore` is a 400.
- AC-3, AC-4, AC-5 — `test/undo.test.tsx` (new, happy-dom): a closure-only entry with a spy that touches no progress table; one press calls it once, a second press or `Ctrl+Z` doesn't; `Ctrl+Z` and `⌘Z` work, but not from an input, a textarea or a contenteditable; the 10-issue *Uncanny X-Men* fixture shows `#141 read` / `4 of 10 in Uncanny X-Men`, and after Undo `aria-pressed` and the count are back; the multi-series fixture shows `X-Men (2019) #8 read`; after an untick, Undo sends `restore` equal to `prior`; with fake timers the toast is there at 7.9s and gone at 8.1s, and Undo does nothing afterwards; a failed inverse leaves the row as it was and says so.
- AC-6 — `npm run test:tokens` (already checks the toast's ink, second line and link on `--toast-bg`); ui-verifier checks the button size, reduced motion and screenshots at every `ui.viewports` width, light and dark.
- `test/spine-toggle.test.tsx` gets the provider wrapper.

**Risks / open questions**

- The Check says line 2 ends in the run's *title*. The real run is *Claremont — Uncanny X-Men*, so the toast reads `… in Claremont — Uncanny X-Men`, not the style guide's `in Uncanny X-Men`. Following the Check.
- `Ctrl+Z` can undo older entries that are still live (a stack) until 1.8b's rule that a new toast commits the old one.
- Size: about 11 files, UI and API together. `splitPolicy` is `never-split`, so the task stays whole and attended.
- Candidate decision (proposed in the PR): the progress route returns `prior` and accepts `restore` as the way any inverse round-trips a stored date.

**Revisions after approval**

1. Step 8: the toast is drawn on the desktop `spine` frame only. The phone frame has Hide read on, so #140 has already folded into the *+3 read* stub there, and STYLE_GUIDE §9 says a ticked row folds only once its toast has closed: a `#140 read` toast on that frame would contradict it. The mockup note says so. (Spec review R1.)
2. Step 3: reading `prior` and the write now share one transaction (`SELECT … FOR UPDATE`), and a restore date that passes the shape check but that Postgres can't read (`2026-02-30`) is a 400, not a 500. (Schema review R1.)

## Review log

- Verify R1 PASS | Audit R1 PASS (FAILS-TO-LOAD at base for the new Undo module; DB tests DISCRIMINATING)
- Spec R1 CHANGES (plan gap: phone spine frame toast; stray whitespace in format.ts) | Schema R1 CHANGES (MAJOR: unreadable restore date gave 500; MINOR: prior read outside a transaction)
- Verify R2 PASS | Spec R2 APPROVE | Schema R2 APPROVE | UI R1 PASS (8/8 at 360, 390, 412, 768, 1024, 1280, light and dark, against the development DB with the owner's approval)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 2
- First-pass AC FAILs: 0
- Plan revisions after approval: 2
