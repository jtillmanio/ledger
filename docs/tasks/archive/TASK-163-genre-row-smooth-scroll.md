---
id: TASK-163
title: 6.26 The Library's genre row scrolls smoothly, with arrows you can hold
status: Done
depends_on: [TASK-145]
size: S
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: c80751e
---

# TASK-163 — 6.26 The Library's genre row scrolls smoothly, with arrows you can hold

## Goal

On a tablet or desktop, the Library's genre chips scroll smoothly with arrow buttons that keep scrolling while held, with no browser scrollbar.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.26 The Library's genre row scrolls smoothly, with arrows you can hold (M21 in `docs/06-tasklist.md`). Feature F-44. Its **Check:** is AC-1, verbatim; proposed in PR #342 and agreed when it merged (2026-11-25).
- Owner intake, 2026-11-24 and 2026-11-25 (*it's choppy; if I hold down on the arrow it should scroll smoothly*).
- **What exists.** The genre row is a `<div className="filters genre-row">` of links in `src/app/books/list/page.tsx` (task 4.5, D-98); `.genre-row` in `src/app/globals.css` scrolls with `overflow-x:auto` and draws the browser's scrollbar, whose Windows arrows step. `.tabrow` and `.shelf` hide theirs (`scrollbar-width:none`). The press-and-hold pattern is `src/components/Stepper.tsx` (2.0b, D-123: a hold repeats, faster after its first second, stops on release).
- **After TASK-145** (6.24, 3 of 4), which redraws the Library's phone filters (dropdown chips, the genre row below). This task keeps the phone's swipe and adds arrows only at 768px and up.
- **Budget.** The arrows are client JS on `/books/list` (`scripts/perf/budget.json`); the plan states the bytes.
- Design: `design/mockups.html` § `blist` (desktop frame gains the arrows; `ui.redrawFiles`). Rules: `.claude/rules/ui.md` (genre chips grey with text). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-98, D-123.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim):
in
the browser (0.11) at 1280px, with more genres than fit: no native
scrollbar is drawn and there is no left arrow at the start; a tap on the
right arrow moves `scrollLeft` by about the row's width over several
frames; holding it for a second moves it further than a tap and it stops on
release; at the end the right arrow goes. At 360px there are no arrows and
the row still scrolls by touch. Under reduced motion a tap moves in one
frame. Axe passes, and `/books/list` stays within its budget.
- [x] AC-2: Given the row fits without scrolling, no arrow is drawn.
- [x] AC-3: Given keyboard focus on an arrow, Enter or Space scrolls one step; tabbing through the chips scrolls each into view.
- [x] AC-4: The row meets the UX floor (`docs/04-design.md` § 10. The UX floor): arrows named, contrast 3:1 for the icon in both themes, reduced motion honoured, and screenshots at each `ui.viewports` width, light and dark.

## Out of scope

- The phone's filter layout (TASK-145).
- Arrows on any other chip row.

## Files likely touched

- `src/components/GenreRow.tsx` — new: the row, its arrows and the hold.
- `src/app/books/list/page.tsx` — draws `GenreRow`.
- `src/app/globals.css` — no native scrollbar; the arrows, tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `blist` at desktop.
- `test/e2e/library-genres.spec.ts` — AC-1 to AC-4.

## Verification

- Automated: `test/e2e/library-genres.spec.ts` at 360px and 1280px, light and dark, with reduced motion emulated for its clause; axe.
- Manual: `npm run dev` at 1280px with many genres → hold the right arrow → expected: a steady smooth scroll that stops on release.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- Five other chip rows borrow `.genre-row` and still draw the browser's scrollbar (the status screen's *On deck genre* and *Done by format*, Progress's *Medium*, the Series and Universes *Show* rows); 6.26 hid it only under `.genre-wrap`, and arrows elsewhere were out of scope → docs/05-roadmap.md § 6.31 (new; Check proposed), with its row in docs/06-tasklist.md § M21 and F-44's list
- Duration tokens read back in seconds (`--dur-4` is `.3s` after the build), so JS that reads one must parse the unit; `GenreRow` is the only reader → not tracked: said in `GenreRow`'s comment, and no other code reads a `--dur-*` token
- A hold's tab order: once the row is at its end, › is hidden, so tabbing forward from the last chip skips it (ui-verifier R1) → not tracked: accepted as is; an arrow with nothing to show is hidden by the plan (AC-2's rule), and every chip stays reachable
- The `/books/list` budget clause of the Check is not measured while Lighthouse is off (D-158); `GenreRow` is 1,320 B gzip → not tracked: stated in PR #359; the library route's Lighthouse row is the check once `LIGHTHOUSE_MODE` is on

## Plan

Approved by the owner, 2026-11-28 (Phase 1 on Opus; implementation on Sonnet). Worktree
`.claude/worktrees/task-163`, branch `task/6.26-genre-row-smooth-scroll`, test database `ledger_test_2`
(`.env.worktree`, port 3200), already built with `npm run test:db:reset`.

### Steps

1. **Tests first.** Extend `test/e2e/library-genres.spec.ts` and add `test/genre-row.test.tsx` (below);
   confirm each fails for the expected reason.
2. **`src/components/GenreRow.tsx`** (new, `"use client"`). Takes the server-rendered chip links as
   `children`, so the route's document + RSC bytes don't change.
   - Markup: `<div className="filters genre-wrap" role="group" aria-label="Genre">` holding a `‹`
     button (*Scroll genres left*), an inner `<div className="genre-row">` scroller with the
     children, and a `›` button (*Scroll genres right*). The outer div keeps `.filters` and the group
     name, so `main > .filters` (test/library-page.test.tsx, the 6.24 order test in
     library-genres.spec.ts) still lists `…, "More filters", "Genre"`.
   - Each arrow is drawn only while there is more on its side (`hidden` attribute, so it leaves the
     tab order and the accessibility tree): `scrollLeft <= 1` hides `‹`,
     `scrollLeft + clientWidth >= scrollWidth - 1` hides `›`; neither when the row fits (AC-2).
     Measured on mount, on `scroll` (passive) and by a ResizeObserver on the scroller. If a focused
     arrow becomes hidden, focus moves to the other arrow if it is shown, else to the end chip.
   - **Tap**: one step = 85% of the scroller's `clientWidth`, animated with `requestAnimationFrame`
     and an ease-out over `--dur-4` (read with `getComputedStyle`; 300ms). Not
     `scrollBy({behavior:"smooth"})`: tap and hold share one engine and a test can sample frames.
   - **Hold** (D-123's pattern from `src/components/Stepper.tsx`): `pointerdown` (primary button or
     touch) starts the step at once; if still pressed when the step ends, scrolling continues at a
     steady ~900 px/s until `pointerup` / `pointerleave` / `pointercancel` or the end. The `click`
     that follows a pointer press is swallowed (`detail > 0`); a keyboard click (`detail === 0`,
     Enter or Space) is one step (AC-3). `onContextMenu` prevented; `touch-action:manipulation`.
   - **Reduced motion** (`matchMedia("(prefers-reduced-motion: reduce)")`, read per press): a tap
     sets `scrollLeft` to the step's end in one frame; a hold repeats that step every 300ms.
   - A `focusin` handler on the scroller calls `target.scrollIntoView({ block: "nearest",
     inline: "nearest" })`, so a chip reached by Tab is scrolled fully into view, clear of the arrows
     (with `scroll-padding-inline` below) (AC-3).
   - Cancel any running animation or hold on unmount.
3. **`src/app/books/list/page.tsx`**: replace the `<div className="filters genre-row" role="group"
   aria-label="Genre">` with `<GenreRow>` around the same `<Link>`s; keep the comment, add 6.26.
4. **`src/app/globals.css`** (tokens only):
   - `.genre-wrap{position:relative;display:block}` (overrides `.filters`' flex); `.genre-row` keeps
     today's flex, `overflow-x:auto`, `overscroll-behavior-x:contain`, padding and margins, and gains
     `display:flex;gap:.375rem;scrollbar-width:none` + `.genre-row::-webkit-scrollbar{display:none}`
     (as `.tabrow`, `.shelf`).
   - `.genre-arrow{display:none}` below 768px; from 768px a 44 × 44 button, absolutely positioned
     over the row's end and vertically centred, with a fade (`::before`, gradient from the page's
     background token to transparent) and the glyph on a solid `--surface` circle in `--ink-2`
     (text-safe, so ≥ 3:1 for the icon in both themes), `:focus-visible` with `var(--focus-ring)`,
     `.genre-arrow[hidden]{display:none}`. `scroll-padding-inline:44px` on `.genre-row` from 768px.
   - Check main's background token where the row sits before choosing the fade's colour.
5. **`design/mockups.html`**: the `blist` desktop frame (around line 3930) and tablet frame (around
   line 3898) draw the `›` arrow at the genre row's right end (no `‹`: the row is at its start).
   **`design/mockups-index.md`**: the `blist` row notes the arrows (task 6.26, TASK-163).

### Files

- `src/components/GenreRow.tsx` (new): the row, its arrows and the hold.
- `src/app/books/list/page.tsx`: draws `GenreRow`.
- `src/app/globals.css`: no native scrollbar; the arrows.
- `design/mockups.html`, `design/mockups-index.md`: `blist` tablet and desktop frames gain `›`.
- `test/e2e/library-genres.spec.ts`: AC-1, AC-3, AC-4; fixture grows to 24 genres.
- `test/genre-row.test.tsx` (new; **not in Files likely touched**): AC-2 and the arrow states, with
  mocked widths. The Library's genre list doesn't follow the filters (`listCounts(userId)`), so with
  the e2e fixture the row never fits in a browser.

### Test strategy

- **AC-1** (library-genres.spec.ts, own viewports, `ONCE`):
  *"at 1280px the genre row draws no scrollbar and no ‹ at the start; a tap scrolls about its width
  over several frames, a held press further, stopping on release; › goes at the end"*: computed
  `scrollbarWidth === "none"` and `offsetHeight - clientHeight === 0` on `.genre-row`; `‹`
  `toHaveCount(0)`; a tap is sampled per `requestAnimationFrame` in `page.evaluate`, ≥ 3 distinct
  intermediate `scrollLeft` values, final delta between 0.6× and 1.0× `clientWidth`; `mouse.down`,
  wait 1000ms, `mouse.up` → delta > the tap's, and `scrollLeft` unchanged over the next 300ms;
  click `›` until it is gone (at most 6) → `‹` shown, at the end.
  *"at 360px there are no arrows and the row scrolls by touch"*: both arrows `toHaveCount(0)`; a CDP
  `Input.synthesizeScrollGesture` (`gestureSourceType: "touch"`, in a `describe` with
  `hasTouch: true`) raises `scrollLeft`.
  *"under reduced motion a tap moves in one frame"*: `emulateMedia({ reducedMotion: "reduce" })`,
  the first sampled frame already equals the final `scrollLeft`.
  Axe (`expectNoAxeViolations` with the file's `AXE` list) at 1280px with both arrows shown.
  Budget: no automated check while Lighthouse is off (`LIGHTHOUSE_MODE` unset, D-158); measure
  `GenreRow`'s minified + gzipped size (expected ~1.0–1.3 KB, under D-142's 3,000-byte per-PR limit
  and `/books/list`'s 19,800-byte JS ceiling) and state it in the PR.
- **Fixture**: `WORDS` grows from 12 to 24 NATO words (Mike … X-ray), one book each, so a 1s hold
  at 1280px can go further than a tap before the end. The phone `overflowX` assertion in the AC-6
  test moves from the group to `.genre-row`.
- **AC-2** (test/genre-row.test.tsx, happy-dom, `createRoot` + `act`): *"draws no arrow when the
  row fits"* (`scrollWidth === clientWidth`); *"draws only › at the start of a row that overflows"*;
  *"draws only ‹ at the end"*, with `scrollWidth` / `clientWidth` / `scrollLeft` stubbed on the
  scroller and a `scroll` event dispatched.
- **AC-3** (e2e, 1280px): *"Enter and Space on a focused arrow each scroll one step"*;
  *"tabbing through the chips scrolls each fully into view, clear of the arrows"*: focus the first
  chip, Tab through all, each chip's rect inside the scroller's rect and not overlapping a shown
  arrow's rect.
- **AC-4** (e2e): arrows found by role and name; `contrastFailures(page)` empty with both arrows
  shown, light and dark (the glyph is text on a solid circle); screenshots
  `library-genre-arrows-<w>-<scheme>` at 360, 390, 412, 768, 1024 and 1280, light and dark.

### Risks / open questions

- The 24-book fixture adds 12 books to the shared test database; other specs that read the Library
  filter to their own fixtures (grep `E2E Gen` and the Library's counts before pushing).
- A 44px arrow on the 36px desktop row overhangs it by 4px above and below, into the row's margin.
- `focus()` scroll with `scroll-padding-inline` varies by browser; the `focusin` + `scrollIntoView`
  handler makes it explicit.

### Size check

7 files, UI only, no schema: within the limit.

### Follow-ups found at plan

None.

### Implementation notes (Sonnet, 2026-11-28; same files and approach)

- The scrollbar and gap rules are scoped to `.genre-wrap .genre-row`: five other chip rows borrow
  `.genre-row` (Progress, Series, Universes, the status screen's), have no arrows (out of scope), and
  keep their scrollbar.
- `--dur-4` reads back as `.3s` (the build rewrites `300ms`), so the step reads the unit; a bare
  `parseFloat` made every tap one frame.
- The arrows' state is mirrored in a ref and set only on a change: `measure` runs after every render,
  and a functional `setState` there looped ("Maximum update depth exceeded").
- The glide checks for release before it moves, so nothing scrolls on the frame after a press is let
  go (the full spec's first run caught one frame's movement).
- The touch clause runs on the existing `w390-touch` project (`@at-w390-touch`) with CDP
  `Input.dispatchTouchEvent` steps; `synthesizeScrollGesture` did not scroll the row headless.
- `@at-` tests check only their own theme, so AC-4 loops light and dark itself; the screenshots are
  `library-genre-arrows-<w>-<light|dark>`. The animated tests pin `reducedMotion: "no-preference"`.
- Bytes: `GenreRow` is 2,689 B minified, 1,320 B gzip, 1,150 B brotli (esbuild, React external).
- The fade is `.genre-arrow::before`, as step 4 drew it (spec-reviewer R1: on the button's own background
  it hid the glyph from `contrastFailures`); the AC-4 test also measures each glyph on its disc.

**Plan revision 1 (after ui-verifier R1, owner's go-ahead to finish the task, 2026-11-28).** Step 2's hold
ran the tap's whole ease-out before gliding, so a hold slowed almost to a stop at ~280ms, then crept on
at a twentieth of the step's top speed: the choppiness 6.26 exists to remove. While held, the step now
hands over to the glide once its speed has fallen to the glide's (0.9 px/ms). AC-1's hold test samples
every frame and requires ≥ 0.45 px/ms from the first movement to release; it failed on the old hold
(`849, 850, 850, 850, 864…`). The glide is timed from the step's last frame (no assumed 16ms first
frame), and the test times each movement by the shorter of the two frame intervals around it, so a
sampler a frame behind the writes can't read a slow frame as a slow scroll (spec-reviewer R3).

## Review log

_Filled by /implement-task. One line per round._

- Local e2e R1 FAIL (AC-1 tap one frame: `--dur-4` read as `.3s`; render loop in `measure`; touch gesture) → R2–R4 fixed | Verify R1 PASS | CI R1 PASS (cf823e8, every project)
- Spec R1 CHANGES (AC-4 UNTESTED: the glyph's contrast skipped under the gradient) → fixed (c6a582d) | Verify R2 PASS | CI R2 PASS (c6a582d) | Spec R2 APPROVE
- Audit R1 PASS (the 360px touch clause a guard, as the Check's *still* asks)
- UI R1 PASS, noting a near-stop between a hold's step and its glide → plan revision 1 (the hand-over, and a per-frame speed test that failed on the old hold) (d448669) | Verify R3 PASS | genre spec ×3 + touch PASS | CI R3 PASS (d448669)
- Spec R3 CHANGES (the glide's first frame assumed 16ms; the speed test could read a stalled frame as slow) | UI R2 FAIL on d448669 (a ~2 px/ms spike after the hand-over), PASS on the fix → fixed (3724034); the old hold still fails the revised test | genre spec ×3 + touch PASS | Verify R4 PASS | Spec R4 APPROVE

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4 (all PASS; local e2e failed four times before the first, fixed in place)
- Review rounds: spec 4, audit 1, UI 2
- First-pass AC FAILs: 1 (AC-4's contrast clause UNTESTED)
- Plan revisions after approval: 1 (the hold's hand-over from step to glide)
