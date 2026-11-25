---
id: TASK-145
title: 6.24 Built screens follow the mediums review (3 of 4) — the Library's dropdown chips
status: Done
depends_on: []
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 0a772cc
---

# TASK-145 — 6.24 Built screens follow the mediums review (3 of 4) — the Library's dropdown chips

## Goal

On the phone, the Library's *Owned* and *Sort* controls fit on one row as dropdown chips, with the genre row below, so the filters take less height and nothing scrolls sideways.

## Context

- Roadmap: `docs/05-roadmap.md` § 6.24 Built screens follow the mediums review (M21). Feature F-44. Its **Check:** is AC-1, verbatim; proposed, and agreed when merged.
- **Split, 3 of 4.** TASK-143 does the finish toast, TASK-144 grey *Remove* and the steppers, TASK-146 the remaining mockup frames and ticks 6.24.
- **The departure** (MR-D20, frame E7 in `design/MR-E-Review-2.dc.html`; `design/STYLE_GUIDE.md` §17.8–§17.9): Library at the phone puts *Owned* and *Sort* in dropdown chips on one row, and draws the genre row.
- **What exists.** `src/app/books/list/page.tsx` draws the Library: the status chips (*Everything* …), `BookSort` (`src/components/BookSort.tsx`, `src/lib/library-sort.ts`'s `parseSort`, `libraryHref`), the *Owned* chips (links, each carrying `aria-current`, task 4.9), and the genre chip row (task 4.5, D-98, `genreChipHref`). Every filter is a link in the URL, so a reload keeps it; keep that. A menu exists to copy: `src/components/Menu.tsx` (the row `⋯` menus).
- **Width.** Which widths get the dropdowns is the frame's: E7 is the phone; the plan says what 768px and up draw (the frames held `blist`'s wider layout, §17.8).
- **Budget.** `/books/list` is in `scripts/perf/budget.json` (0.14c). A dropdown that needs client code adds JS to the route; the plan says how it stays within its ceiling (a `<details>` disclosure of links needs none).
- Design: `design/mockups.html` § `blist` (phone), redrawn from E7 (`ui.redrawFiles`; `design/mockups-index.md` lists it as 6.24's).
- Rules: `.claude/rules/ui.md` (hue never names navigation; genre chips grey with text). UX floor: `docs/04-design.md` § 10. The UX floor. Decisions: D-98, D-177.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves *the Library shows Owned and Sort as dropdown chips in one row and the genre row, and nothing scrolls sideways*, and redraws `blist`. TASK-143, TASK-144 and TASK-146 prove the rest):
browser test at 360px, light and dark: *Remove from Listen next* resolves to
no `--danger` colour; finishing a book in a series shows one *Now reading*
chip and *+N · Follow…*, and *Keep going?* is in the *Follow…* sheet; the
batch and finish sheets' stepper buttons resolve to `--sunk`; the Library
shows *Owned* and *Sort* as dropdown chips in one row and the genre row, and
nothing scrolls sideways; `design/mockups.html`'s `blist`, `status`,
`finishoffer`, `batch` and `settings` frames are redrawn from the review and
it gains the six 834px frames.
- [x] AC-2: At 360px, the *Owned* and *Sort* chips' boxes share one top edge, each chip names its current choice (*Owned: Any*, *Sort: Title* or the frame's words), and `document.documentElement.scrollWidth` equals the viewport width.
- [x] AC-3: Given the *Owned* chip, when it is opened and *Owned* is chosen, then the URL carries the owned filter and the list shows exactly the owned books, as the chips did; the same for each sort and direction, and a reload keeps both.
- [x] AC-4: Each dropdown opens and closes by keyboard (Enter or Space opens, Esc closes and returns focus to its chip), its choices are reachable by Tab or arrows, and the current choice is marked for assistive tech (`aria-current` or `aria-checked`).
- [ ] AC-5: The Library's filters meet the UX floor (`docs/04-design.md` § 10. The UX floor): every chip at least 44px tall, text 4.5:1 in both themes, no hue on a chip, axe reports no new violations, and screenshots at each `ui.viewports` width, light and dark; `/books/list` stays within its byte budget.

## Out of scope

- What the filters do: the owned, sort and genre rules are 4.9's, 1.15's and 4.5's, unchanged.
- The status chips row (*Everything* …) and search.
- The finish toast (TASK-143), grey *Remove* and the steppers (TASK-144), the other frames (TASK-146).

## Files likely touched

- `src/app/books/list/page.tsx` — the one row.
- `src/components/BookSort.tsx` — *Sort* as a dropdown chip.
- a new `src/components/ChipMenu.tsx` (or the page inline) — *Owned* as a dropdown chip; the *Owned* chips are inline links in `page.tsx` today.
- `src/app/globals.css` — tokens only.
- `design/mockups.html`, `design/mockups-index.md` — `blist`.
- `test/library-page.test.tsx`, `test/e2e/library-owned.spec.ts`, `test/e2e/library-sort.spec.ts`, `test/e2e/library-genres.spec.ts` — AC-1's clause, AC-2 to AC-5.

## Verification

- Automated: `test/e2e/library-owned.spec.ts` and `test/e2e/library-sort.spec.ts` rewritten to the dropdowns (AC-3, AC-4); a 360px layout test for AC-2 and the genre row; axe at each width.
- Manual: the ui-verifier opens `/books/list` at 360px, 768px and 1280px, light and dark → expected: E7's one row at the phone, the plan's layout wider, every filter still works.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- E7 also draws a *Genre ▾* dropdown chip, an *All genres* chip and a count on each genre chip (*Fantasy · 212*); the task and MR-D20 name only *Owned* and *Sort*, so they are not built here (approved at plan, owner 2026-11-25) → docs/05-roadmap.md § 6.28 (new)
- The plan's test strategy named `test/library-sort.test.ts` for the choice-list tests; that file needs the database, so they are in `test/library-page.test.tsx` (pure functions, no database) → not tracked: done in this PR (plan revision, test location only)

## Plan

Approved 2026-11-25 (owner). Owner's answers at the gate: **dropdowns at every width** (one markup; `blist`'s wider frames redrawn to match), and E7's extras (*Genre ▾*, *All genres*, genre counts) **left out**, with a roadmap item.

**Approach.** A new client `ChipMenu`: a chip-shaped `<button aria-expanded>` that opens a short list of links, `aria-current="true"` on the current choice. Enter/Space open it (native button), ArrowUp/Down/Home/End and Tab move through it, Esc closes it and returns focus to the chip, a click elsewhere closes it. The links are drawn only while open and built in the client from the URL's params (as `BookSort` builds its options now), so the document + RSC carry two chips and the params, not the choices: `/books/list`'s doc + RSC shrinks (the four *Owned* links and the select's options go), and the JS grows by about 1 KB, under one PR's 3,000-byte limit (D-175). Not `role="menu"`: a disclosure of links (navigation), so `aria-current` is the right mark.

Steps:

1. `src/lib/library-sort.ts`: pure `ownedChoices(params)` (*Any · Physical · Audiobook · Ebook · Not owned*) and `sortChoices(params, sort, dir)` (the seven sorts, each opening in its own direction, then the current sort's two directions), each `{ label, href, current }` through `libraryHref`, so every other filter, the search and the sort ride along; plus the chip words (*Owned: Any*, *Owned: Physical*, *Sort: Length*) and the Sort chip's accessible name with its direction (*Sort: Length, longest first*).
2. `src/components/ChipMenu.tsx` (new): the dropdown chip above, modelled on `Menu.tsx`.
3. `src/components/BookSort.tsx`: *Sort* as a `ChipMenu`; the select and the reverse chip go (the reverse's two directions are in the menu: a third chip doesn't fit at 360px). A second export, `BookOwned`, draws *Owned* the same way.
4. `src/app/books/list/page.tsx`: status chips → (Parked line) → (To read levels) → one row, `role="group"` named *More filters*, holding *Owned ▾* and *Sort ▾* → the genre row. The four *Owned* chip links go. Filter rules unchanged (4.9, 1.15, 4.5).
5. `src/app/globals.css`: the dropdown chip (caret, 44px tall on the phone, 28px+ from 768px as the genre chips; grey, no hue; *on* state `--ink` border as `aria-current` chips) and its panel (the `.menu` surface, choices 44px on the phone). Tokens only.
6. `src/components/Skeleton.tsx`, `src/app/books/list/loading.tsx`: the skeleton's first group loses the Sort; a two-chip line stands for the new row, so nothing moves when the list lands.
7. `design/mockups.html` § `blist` (the phone frames that draw *Owned* or *Sort*, the tablet and desktop frames) and `design/mockups-index.md`: redrawn from E7 as built, with a notes line (6.24, MR-D20).

**Files** (13; over the 8-file size check: the tests and the redraw are required in the same PR, the task is already a quarter of 6.24, no schema; kept whole, owner-approved)

- `src/lib/library-sort.ts` — the choice lists and chip words.
- `src/components/ChipMenu.tsx` (new) — the dropdown chip.
- `src/components/BookSort.tsx` — *Sort* and *Owned* as dropdown chips.
- `src/app/books/list/page.tsx` — the one row.
- `src/app/globals.css` — the chip and its panel.
- `src/components/Skeleton.tsx`, `src/app/books/list/loading.tsx` — the skeleton follows the rows (not in "Files likely touched").
- `design/mockups.html`, `design/mockups-index.md` — `blist`.
- `test/library-sort.test.ts` (not in "Files likely touched"), `test/library-page.test.tsx`, `test/e2e/library-owned.spec.ts`, `test/e2e/library-sort.spec.ts`, `test/e2e/library-genres.spec.ts` — the tests.

**Test strategy** (written first, failing)

- AC-1 (this clause): `test/e2e/library-genres.spec.ts` › *the Owned and Sort dropdown chips share one row above the genre row at 360px, light and dark, and nothing scrolls sideways*; `test/library-page.test.tsx` › *draws Owned and Sort as dropdown chips in one row, then the genre row, and no Owned chip links*. The `blist` redraw: the mockups diff, checked by spec-reviewer.
- AC-2: the same e2e test: equal `top` of the two chips' boxes, chip text *Owned: Any* / *Sort: Series*, `scrollWidth === innerWidth`.
- AC-3: `test/library-sort.test.ts` › the choice lists' hrefs and `current`; `test/e2e/library-owned.spec.ts` › *each Owned choice lists exactly its books, keeps the status and sort, and survives a reload*; `test/e2e/library-sort.spec.ts` › *each sort and both directions from the Sort menu, and a reload keeps them*.
- AC-4: `test/e2e/library-sort.spec.ts` › *the dropdowns open by Enter and Space, move by arrows and Tab, close by Esc back to the chip, and mark the current choice* (both chips).
- AC-5: `test/e2e/library-owned.spec.ts` FLOOR test rewritten: chips and choices ≥ 44px at the phone, axe, `contrastFailures`, no hue on a chip (computed border/text colours are `--faint-deco`/`--muted`/`--ink`); screenshots at 360/390/412/768/1024/1280 light and dark (the ONCE test); the skeleton-height test updated. The byte budget: CI's Lighthouse on the preview (D-175), or reported as not run while `LIGHTHOUSE_MODE` is off.

Risks and open questions:

- The byte budget is measured only on the preview; the design above lowers doc + RSC and adds ~1 KB of JS.
- The phone's native select picker goes; the menu replaces it (the frame's choice).
- Tests that pinned `#library-sort`, the *Sort* combobox, the reverse link or the *Owned* group are rewritten, not deleted: each assertion moves to the menu.

## Review log

Verify R1 FAIL (control-states.test.ts: a `border-radius` that wasn't a `--r-*` token) → R2 PASS (tsc, lint, `test:no-e2e`) | CI R1 FAIL (library-sort and library-owned floor tests, w768, w1024, w1280-light: axe target-size counted the first row's title link against the open list) → R2 PASS (all ten shards; the run was cancelled by the fix's push, so the fix is the gate) | Audit R1 PASS | Spec R1 CHANGES (AC-5 no-hue assertion unwritten) → R2 APPROVE | UI R1 PASS (360 to 1280px, light and dark, 0 console errors) | Schema n/a | Drift R1 update first (behind 1; both changed `design/mockups.html`, `design/mockups-index.md`, `src/app/globals.css`; main changed `src/db/queries.ts`) → rebased | Lighthouse not run (`LIGHTHOUSE_MODE` is not set)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 2 (plus 1 CI fix round)
- Review rounds: 2 (spec-reviewer; test-auditor and ui-verifier 1 each)
- First-pass AC FAILs: 1 (AC-5's no-hue check, found by spec-reviewer)
- Plan revisions after approval: 1 (the choice-list tests are in `test/library-page.test.tsx`, not `test/library-sort.test.ts`, which needs the database)
