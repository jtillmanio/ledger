---
id: TASK-159
title: 5.7b Coming out lets a book go (1 of 2) — Remove
status: Ready
depends_on: []
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-159 — 5.7b Coming out lets a book go (1 of 2) — Remove

## Goal

A book on Coming out can be removed from its row's menu, and Undo brings it back.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.7b Coming out lets a book go: Remove, and Calibre having it (M17 in `docs/06-tasklist.md`). Feature F-37. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- **Split, 1 of 2.** This part is *Remove*; TASK-160 is the sync writing Unlisted when Calibre has the book.
- **D-185.** *Remove* soft-deletes the book (hard rule 4): on Coming out it has no status by definition (`wantedReleases`, `src/db/queries.ts`), so nothing else holds it. Undo clears `deleted_at`. The add flows' undos already soft-delete books they created (`src/db/writes.ts`, `undoAddBooks`): the pattern. A book that gained a status or a plan row since is refused (409), never removed.
- **What exists.** `src/app/books/releases/page.tsx` draws each row inside `GotIt` (`src/components/GotIt.tsx`), with no `⋯` menu; `src/components/BookRowMenu.tsx` and `src/components/Menu.tsx` are the row menus elsewhere; the dashboard's line is `src/components/ComingOutLine.tsx`. *Remove* is grey, never `--danger` (6.24, D-177).
- Design: `design/mockups.html` § `releases`; the frame gains the menu (`ui.redrawFiles`). Rules: `.claude/rules/ui.md`. UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-35, D-185, D-177.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim; this part proves *Remove*, TASK-160 the sync):
with the test database: *Remove* on a Coming out row sets the book's
`deleted_at`, the row leaves the list and the dashboard line's counts drop
by one, and Undo brings both back. A sync whose payload matches a wanted
book writes its `book_status` as `unlisted`, lists it under *in*, and the
book is gone from Coming out and listed under the Library's *Unlisted*; a
matched book already To read keeps its status. At 360px *Remove* resolves
to no `--danger` colour, and axe passes.
- [ ] AC-2: Given a book removed from Coming out, it appears in no Library filter, search or plan suggestion, and its `releases` row is kept.
- [ ] AC-3: Given a removed book that a later add brings back (Add books finds it by title and author), it is restored, never created twice.
- [ ] AC-4: Coming out meets the UX floor (`docs/04-design.md` § 10. The UX floor): the menu is a named button, 44 px targets at phone widths, focus moves to the next row after a removal, contrast in both themes, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The sync writing Unlisted (TASK-160).
- Removing a book from anywhere but Coming out.

## Files likely touched

- `src/db/writes.ts` — `removeWanted` and its undo, under the add flows' lock.
- `src/app/api/releases/route.ts` — new: `DELETE` (remove) and its undo; or a new action on `src/app/api/books/route.ts` (the plan's).
- `src/app/books/releases/page.tsx`, `src/components/GotIt.tsx` — the row's `⋯` menu with *Remove*.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `releases` gains the menu.
- `test/releases.test.ts`, `test/e2e/releases.spec.ts` — AC-1's *Remove* clauses, AC-2 to AC-4.

## Verification

- Automated: `test/releases.test.ts` on the test database; `test/e2e/releases.spec.ts` with axe at 360px and 1280px, light and dark.
- Manual: `npm run dev`, Coming out → `⋯` → *Remove* → Undo → expected: the row leaves and comes back, the dashboard's count with it.

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
