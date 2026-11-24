---
id: TASK-137
title: 6.21 Redesign where the book sits, with Claude Design
status: Ready
depends_on: [TASK-126]
size: M
model: opus
autonomy: attended
ui: true
plan_status: none
planned_at_commit:
---

# TASK-137 — 6.21 Redesign where the book sits, with Claude Design

## Goal

How a book's universe, author, series and subseries read in Now, on the tablet and desktop heroes, and in `/progress`'s nested rows matches a drawing the owner picked in Claude Design, at every width and in both themes.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.21 (owner intake, 2026-11-05; D-119). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M21; pulled ahead of 1.26 with 6.23 (D-172). Depends on 2.2g (TASK-056, done) and 5.12 (TASK-104, TASK-105, done).
- **The drawing comes first, and from the owner.** The design tool's frames land as `design/*.dc.html`, which are in `protectedPaths` (`.claude/kit.json`: *changes come from the design tool*). Claude never edits them. The owner puts the export there, and Claude checks it and stages it as delivered, as TASK-126's plan does.
- **Depends on TASK-126 (6.23).** *From 6.23 (2026-11-18):* the mediums review's part E asks for these frames (`docs/design-briefs/2026-11-mediums-review.md`, § E, `bdash`: *where the book sits* with a long universe name, a book on three levels and a book on none, given its own frames). If the owner picks one there, this task starts from that drawing. If the owner draws 6.21 on its own instead, the plan gate drops the dependency and says which file holds the drawing. *From 6.23 (2026-11-24, TASK-126):* standalone Claude Design closes by 2026-12-14, so "Claude Design" and "the design tool" in this task mean the [Ledger canvas](https://claude.ai/artifact/KMTyE4DuUvZPYH4pbuHHCu) in claude.ai, with the Ledger design system (`docs/04-design.md` § 1, *In Claude*). The canvas allows no spaces in a page name; a page drawn there comes into `design/` under its repo name (the review's `Mediums-Review` is `design/Ledger Mediums Review.dc.html`).
- **What exists (2.2g, 5.12).** `src/components/WhereItSits.tsx` draws up to three rows (universe, author, series, subseries), each `read / total` from the progress views with a `--ready` meter, in `src/components/BooksNow.tsx` above *Next in*. `src/components/ProgressRows.tsx` draws `/progress`'s nested rows (`src/app/progress/page.tsx`). The mockup: `design/mockups.html` § `bdash` (the *where the book sits* rows on the reading and listening frames, task 2.2g) and § `progress` (task 5.12), per `design/mockups-index.md`. Feel pass: `design/Ledger Feel Review.dc.html`, `design/LedgerDesktop.dc.html`, `design/STYLE_GUIDE.md` § 14–§ 16.
- **2.2g's Check still holds** with its row and order assertions rewritten to the chosen drawing (the entry). Its tests are in `test/books-dashboard.test.ts` and `test/e2e/books-dashboard.spec.ts`; 5.12's in `test/e2e/progress.spec.ts`.
- **The mockup follows the drawing.** `ui.redrawFiles`: `design/mockups.html` and `design/mockups-index.md` are redrawn to the chosen frames in this PR. The drawing wins on layout and copy for what it draws (D-40's order in CLAUDE.md).
- Rules: `.claude/rules/ui.md`; hard rule 6 (tokens only, every meter fills with `--ready`, nothing red on a dashboard). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-40, D-119, D-117, D-118.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the design tool's frames cover phone, tablet and desktop, light and dark, the owner
  picks one, and Now and `/progress` match it; 2.2g's own Check still passes with
  its row and order assertions rewritten to the chosen drawing.
- [ ] AC-2: The PR names the chosen drawing's file and frame ids, and `design/mockups.html` § `bdash` and § `progress`, with their `design/mockups-index.md` rows, are redrawn to match it.
- [ ] AC-3: Given a book in a universe with a long name (at least 40 characters), a series and a subseries, Now shows every level the drawing shows, and nothing scrolls sideways at 360px; given a book on no level, Now draws what the drawing draws for none (rows absent, or the drawing's empty treatment).
- [ ] AC-4: Every `read / total` shown equals its progress view's figures, and every meter's fill resolves to `--ready` in both themes, on Now and on `/progress`.
- [ ] AC-5: Now's rows and `/progress`'s nested rows meet the UX floor (`docs/04-design.md` § 10. The UX floor): the loading state holds their space or the plan says why no layout shift goes over budget, text 4.5:1 and meter tracks 3:1 in both themes, reduced motion respected, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- Drawing the frames: the owner, in Claude Design (6.23's part E, or a 6.21 session).
- Editing `design/*.dc.html`, `design/STYLE_GUIDE.md` or `design/tokens.css` by hand.
- Any change to the progress views or a new column: the rows read what 2.2g and 5.12 read.
- The other part E frames (*Next in*, *the book's place*, the listening hero): their own entries.

## Files likely touched

- `src/components/WhereItSits.tsx`, `src/components/BooksNow.tsx` — Now and the heroes.
- `src/components/ProgressRows.tsx` — `/progress`'s nested rows.
- `src/app/globals.css` — tokens only.
- `src/app/books/loading.tsx`, `src/app/progress/loading.tsx` — the rows' space, if the drawing changes it.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` and `progress` redrawn.
- `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts`, `test/e2e/progress.spec.ts` — 2.2g's assertions rewritten; AC-3 to AC-5.

## Verification

- Automated: `test/e2e/books-dashboard.spec.ts` and `test/e2e/progress.spec.ts` with axe at the `@floor` and `@feel` projects (AC-1's 2.2g clause, AC-3 to AC-5); `test/books-dashboard.test.ts` (AC-4).
- Manual: the ui-verifier compares Now and `/progress` with the chosen frames at 360, 768 and 1280px, light and dark → expected: the levels, their order, their type and the meters match the drawing. The owner's preview walk confirms it (AC-1, *the owner picks one*).

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
