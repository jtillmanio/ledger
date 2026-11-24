---
id: TASK-137
title: 6.21 Redesign where the book sits, with Claude Design
status: Done
depends_on: [TASK-126]
size: M
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 9c82957
---

# TASK-137 — 6.21 Redesign where the book sits, with Claude Design

## Goal

How a book's universe, author, series and subseries read in Now, on the tablet and desktop heroes, and in `/progress`'s nested rows matches a drawing the owner picked in Claude Design, at every width and in both themes.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.21 (owner intake, 2026-11-05; D-119). Its **Check:** is AC-1, verbatim; proposed, and agreed when merged. Listed in `docs/06-tasklist.md` M21; pulled ahead of 1.26 with 6.23 (D-172). Depends on 2.2g (TASK-056, done) and 5.12 (TASK-104, TASK-105, done).
- **The drawing comes first, and from the owner.** The design tool's frames land as `design/*.dc.html`, which are in `protectedPaths` (`.claude/kit.json`: *changes come from the design tool*). Claude never edits them. The owner puts the export there, and Claude checks it and stages it as delivered, as TASK-126's plan does.
- **Depends on TASK-126 (6.23).** *From 6.23 (2026-11-18):* the mediums review's part E asks for these frames (`docs/design-briefs/2026-11-mediums-review.md`, § E, `bdash`: *where the book sits* with a long universe name, a book on three levels and a book on none, given its own frames). If the owner picks one there, this task starts from that drawing. If the owner draws 6.21 on its own instead, the plan gate drops the dependency and says which file holds the drawing. *From 6.23 (2026-11-24, TASK-126):* standalone Claude Design closes by 2026-12-14, so "Claude Design" and "the design tool" in this task mean the [Ledger canvas](https://claude.ai/artifact/UYEoW99o3cm13kYGYWpHPH) in claude.ai, with the Ledger design system (`docs/04-design.md` § 1, *In Claude*). The canvas allows no spaces in a page name; a page drawn there comes into `design/` under its repo name (the review's `Mediums-Review` is `design/Ledger Mediums Review.dc.html`). *From 6.23 (2026-11-24, PR #336, D-177):* the review is delivered, and the owner took its recommendation, so this task starts from frames E1–E6 in `design/MR-E-Review-1.dc.html` (PNGs `design/screenshots/mediums-review/{phone,tablet,desktop}/E1`–`E6-{dark,light}.png`): an 84px mono kind key per level, an indent for each deeper level, fixed meter and count columns (MR-D19, `design/STYLE_GUIDE.md` §17.8). The review came back as seventeen boards, so there is no single `Ledger Mediums Review.dc.html`; the entry is `design/MR-Main.dc.html`.
- **What exists (2.2g, 5.12).** `src/components/WhereItSits.tsx` draws up to three rows (universe, author, series, subseries), each `read / total` from the progress views with a `--ready` meter, in `src/components/BooksNow.tsx` above *Next in*. `src/components/ProgressRows.tsx` draws `/progress`'s nested rows (`src/app/progress/page.tsx`). The mockup: `design/mockups.html` § `bdash` (the *where the book sits* rows on the reading and listening frames, task 2.2g) and § `progress` (task 5.12), per `design/mockups-index.md`. Feel pass: `design/Ledger Feel Review.dc.html`, `design/LedgerDesktop.dc.html`, `design/STYLE_GUIDE.md` § 14–§ 16.
- **2.2g's Check still holds** with its row and order assertions rewritten to the chosen drawing (the entry). Its tests are in `test/books-dashboard.test.ts` and `test/e2e/books-dashboard.spec.ts`; 5.12's in `test/e2e/progress.spec.ts`.
- **The mockup follows the drawing.** `ui.redrawFiles`: `design/mockups.html` and `design/mockups-index.md` are redrawn to the chosen frames in this PR. The drawing wins on layout and copy for what it draws (D-40's order in CLAUDE.md).
- Rules: `.claude/rules/ui.md`; hard rule 6 (tokens only, every meter fills with `--ready`, nothing red on a dashboard). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-40, D-119, D-117, D-118.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim): the design tool's frames cover phone, tablet and desktop, light and dark, the owner
  picks one, and Now and `/progress` match it; 2.2g's own Check still passes with
  its row and order assertions rewritten to the chosen drawing.
- [x] AC-2: The PR names the chosen drawing's file and frame ids, and `design/mockups.html` § `bdash` and § `progress`, with their `design/mockups-index.md` rows, are redrawn to match it.
- [x] AC-3: Given a book in a universe with a long name (at least 40 characters), a series and a subseries, Now shows every level the drawing shows, and nothing scrolls sideways at 360px; given a book on no level, Now draws what the drawing draws for none (rows absent, or the drawing's empty treatment).
- [x] AC-4: Every `read / total` shown equals its progress view's figures, and every meter's fill resolves to `--ready` in both themes, on Now and on `/progress`.
- [x] AC-5: Now's rows and `/progress`'s nested rows meet the UX floor (`docs/04-design.md` § 10. The UX floor): the loading state holds their space or the plan says why no layout shift goes over budget, text 4.5:1 and meter tracks 3:1 in both themes, reduced motion respected, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark.

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

- The drawing gives each meter `role="img"` with a percentage; the build keeps it `aria-hidden`, since the `read / total` beside it is the text a screen reader reads (approved at plan) → not tracked: deliberate, the figure is the accessible text (as 2.2g built it)
- E1–E6 don't draw 1.17b's status control under the band: the frames are crops, not a decision to drop it; it stays where it is (approved at plan) → not tracked: no change intended; §17.8 changes `bdash` only by MR-D19
- E1–E6 draw the rest of the hero more compactly than the build: the page count small and grey (the build's 32px figure is the feel pass's), *Next in* and the foot in the text column at 834px and up, the band on `--art` (ui-verifier R1) → not tracked: §17.8 holds `bdash` apart from MR-D19's levels, so these are the frames' rendering, not departures; the `--art` band is already 4.2/4.3's (`globals.css` § Now)
- ui-verifier R1 could not show a universe or author row in the development data (no book in hand is in a universe or by an author followed as Reading); it set Mort to Reading for the walk and put it back → not tracked: the universe and author rows are proven by `test/e2e/books-dashboard.spec.ts` at every width, light and dark

## Plan

Approved by the owner 2026-11-24.

**The drawing.** Frames E1–E6 in `design/MR-E-Review-1.dc.html` (delivered by TASK-126, PR #336; D-177; MR-D19; `design/STYLE_GUIDE.md` §17.8; PNGs `design/screenshots/mediums-review/{phone,tablet,desktop}/E1`–`E6-{dark,light}.png`). Each level gains an 84px mono kind key (UNIVERSE, SERIES, SUBSERIES, AUTHOR; `500 11px/14px` mono, `.06em`, `--muted`), each deeper level's key indented 10px with a `--rule-2` hairline elbow; the name (wraps; links as built); a fixed 52px meter (5px, `--sunk` track, `--faint-deco` ring, `--ready` fill); `read / total` in mono, right-aligned, in a fixed column (44px in the drawing). 12/16 type. On the tablet and desktop the rows sit in the hero's text column, capped at `--lens-max`. `/progress` is **held** (§17.8; `design/mockups-index.md` sends E9 to 8.8, 9.6 and 10.3): no code change there.

**Steps**
1. `src/components/WhereItSits.tsx`: a kind key per row (text *Universe*, *Series*, *Subseries*, *Author*, capitals by CSS so a screen reader reads a word); depth = the row's place in the list (`data-depth`), an `aria-hidden` elbow on depth ≥ 1; the meter stays `aria-hidden` (the figure is the text).
2. `src/components/BooksNow.tsx`: the rows move inside `.now-band`, after `.now-body`. Phone: a second grid row under the cover and text. From 768px: the text column, under the page count, the cover spanning both rows. The status control, *Next in* and the foot stay where they are (their frames are out of scope).
3. `src/app/globals.css`: `.now-where` rewritten to one grid, `84px minmax(0,1fr) 52px minmax(44px,max-content)`, each `li` a subgrid so a longer count can't misalign the columns; the 64px and 120px meter widths go; from 768px `max-width:var(--lens-max)`. Tokens only.
4. `design/mockups.html` § `bdash`: the rows on the 390, 834 and desktop reading frames and the listening frame redrawn to the ladder. `design/mockups-index.md`: the `bdash` row says so (E1–E6, MR-D19), its pending-redraw row is cleared, and the `progress` row notes it was checked against the drawing and holds.
5. Loading (AC-5): `src/app/books/loading.tsx` unchanged, as TASK-056 argued: the skeleton can't know 0–3 rows, it is `/books`' only Suspense fallback, so the rows arrive in the same commit as the hero and replace the skeleton's nodes rather than shift them; Lighthouse's CLS gate on the preview checks it.

**Files**
- `src/components/WhereItSits.tsx` — the kind key, depth, elbow.
- `src/components/BooksNow.tsx` — the rows into the band.
- `src/app/globals.css` — the ladder's columns and type, the text column from 768px.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` redrawn; `progress` held.
- `test/books-dashboard.test.ts`, `test/e2e/books-dashboard.spec.ts` — 2.2g's row and order assertions rewritten; AC-3 to AC-5.
- `test/e2e/progress.spec.ts` — not changed: `/progress` is held and its tests already prove AC-4 and AC-5 there.

**Test strategy**
- AC-1 (2.2g's Check rewritten): `books-dashboard.spec.ts` § *where the book sits*: keys read UNIVERSE › SERIES › SUBSERIES in order, each step 10px further right; author row keyed AUTHOR; one row for a series alone; none for an unfollowed standalone and Between books; five slots in order.
- AC-2: the PR names the file and frames; the mockup and index diff.
- AC-3: the long-universe (≥ 40 chars) test at 360px asserts every level drawn and no sideways scroll; *a book on none* draws no `.now-where`.
- AC-4: figures equal the views' (existing `viewFigures`), every fill `--ready` in light and dark (the FEEL tests run in every project), meter 52px at every width, the count column's right edges aligned.
- AC-5: `floor()` (axe, contrast, targets) and screenshots at every project width, light and dark; the rows inside `.now-band`, under `.now-body` on the phone and beside the cover from 768px.
- Unit (`books-dashboard.test.ts`): keys in order, `data-depth` 0/1/2, an elbow only on depth ≥ 1, no hex.

**Risks**: subgrid support (Chromium 117+, every target browser); the tablet grid must not stretch the cover off 2:3 (the existing `align-self:flex-start` concern).

**Follow-ups** (approved at plan): see § Follow-ups.

## Review log

_Filled by /implement-task. One line per round._

- Verify R1 PASS (touched spec PASS at w390, w768, w1280, and w360, w412, w1024 with `--full`) | PR #339 opened ready | CI R1 PASS (every project, 10 shards; Vercel PASS)
- Spec R1 APPROVE | Audit R1 CHANGES (minor: the loading clause rests on the plan's argument, as AC-5 allows; no motion added; the elbow's hairline unchecked) → elbow assertion added | Verify R2 PASS
- UI R1 PASS (360–1280, light and dark; series and subseries rows on a dev book set to Reading and put back; `/progress` unchanged; 0 console errors) | schema-reviewer n/a (no schema, views or queries)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2
- Review rounds: 1 (spec, audit, UI)
- First-pass AC FAILs: 0
- Plan revisions after approval: 0
