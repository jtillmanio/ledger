---
id: TASK-049
title: 2.2 Books dashboard
status: Ready
depends_on: [TASK-011, TASK-014, TASK-046, TASK-047]
size: L
model: opus
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: 391e506
---

# TASK-049 — 2.2 Books dashboard

## Goal

`/books` becomes the books dashboard: the book in hand (or *Between books*, which names the last finish and offers the top of the plan), this quarter's books in your order, this quarter against capacity, On deck, and the year so far, with the thumb bar's book verbs.

## Context

- Roadmap: `docs/05-roadmap.md` § 2.2 Books dashboard (M10; pulled ahead of cutover by 1.25, `docs/cutover-parity.md`: 2.0 → 2.1 → 2.2 → 2.2b, then 2.3, before 1.26). The roadmap entry and its **Check:** are the contract. Features: F-22. Depends on 1.7 (TASK-011), 1.8 (TASK-014, the shell and its side rail), 2.1 (TASK-046, capacity) and 2.2e (TASK-047): the master list stops being `/books` and becomes the Library, which lands first so the list keeps a nav item. Depends on 2.1b for the *sittings* line only: 2.1b is not pulled ahead, so this task ships without that line until 2.1b lands (M9's order note).
- **Why this is one large task** (`workflow.splitPolicy: never-split`): the route, its loading state, five slots' queries, the hero, *Between books*, the strip, the thumb bar, the nav and redirect changes, the perf route and the `bdash` redraw land together, which is over 8 files across the data and UI layers.
- **Five slots, in this order** (feel pass, D-40; `design/STYLE_GUIDE.md` §14.1–14.2; `design/Ledger Feel Review.dc.html` §4), which replace "Books - v4" in `design/mockups.html` on layout and copy: **Now** (the book in hand, or *Between books*); **Up next in Qn**, a cover shelf of the current quarter's books in `ordinal` order with **Reorder** (1.9's quarter list, `src/components/PlanQuarter.tsx`, `src/components/ReorderList.tsx`; the comics shelf `src/components/QueueShelf.tsx` is the pattern); **This quarter**, the single-quarter strip (FP-D8), its planned total from 2.1's capacity figure; **On deck**; **2026 so far** (three this-year counts on `--raise`: books, pages, new authors; listens beside reads, *31 finished · 6 listened*, from `books_by_year`'s listened count, 1.23). Never the backlog. `docs/04-design.md` § 11.1 and § 12 → Books dashboard.
- **Now.** The only large thing (`--r-hero`, `--surface` until 4.2/4.3 store the art band): the cover (`--cover-hero`), the title in Newsreader (`--fs-hero-name`), the author, the page position in mono and a 6px `--ready` meter, and the time left in evenings at your own session length (*at your set pace* before sessions exist), never a date. It is never blank and never hidden. A book being listened to shows as one being read does, with the headphones glyph (1.23). **Open, ask at the plan gate: the page position.** `p. 212 of 468` and the meter need a reading position, and nothing stores one: *Log progress* opens 2.1b's session sheet (`docs/05-roadmap.md` § 2.1b), which is not pulled ahead. What Now shows for position and meter until then (none and no meter; the start date and the time left for the whole book; or a schema addition, which is a stop-and-ask) is the owner's call.
- **Between books** (§14.2, §15) replaces the old empty state: a 72px cover of the last finished book with a `--ready` check and a finished-day badge, *Between books.*, a line saying what you finished and how long it took (from 1.5's dated reads and 1.17's start; an undated finish says what, not when), the top of the current quarter's plan (the lowest-ordinal `to_read` book, D-37), and *Pick something else*. The thumb bar's verb starts the top of the plan, named.
- **Desktop** (§14.6; Feel Review §11d; `design/screenshots/desktop/07…10`): Now, *Up next in Qn* and *This quarter* in main; *On deck* and *2026 so far* in 1.8's side rail. The hero has 2.4's geometry with a 168×252 cover, the title at 32/36 (`--fs-hero-name-desk`), the page count at 32/36 mono, the meter under the lens's 480px cap. The shelf gets < > only when it overflows (1.10). *On deck* rows hide **Plan** at rest and reveal it on row hover or `:focus-within` with a fine pointer, as 2.4's *+ Up next* (FP-D15). 2.4 is not pulled ahead (owner, 2026-10-29): **this task builds what it borrows** from 2.4 rather than waiting. *Between books* drops *Finished it* from the header and names the top of the plan in full on the primary; below about 1100px it truncates and keeps the full title in its accessible name. Tablet: the 834px `bdash` frame drawn by 1.8e (TASK-028, PR #111), the horizontal hero around a 150×225 cover, *On deck* | *2026 so far* as two columns 1.5 : 1, for 768–1023px.
- **The thumb bar** (*From 1.8b*, TASK-015, PR #114): `ThumbBar`'s books configuration (`src/components/ThumbBar.tsx`) is built and unit-tested: *Log progress · ✓ finished · search*, and the header *Search · Finished it · Log pages*. Render it here wrapped in `VerbsProvider`, as the comics dashboard (`src/app/comics/(dash)/page.tsx`) does. *Log progress* stays `aria-disabled` with its reason until 2.1b, unless the plan gate's answer on position says otherwise.
- **Stop and ask before building** (the entry: the feel pass is silent): the old dashboard had a capacity card with **Rebalance** and **Accept** (2.7) and an amber unplaced-entries card with **Place them** (2.8). The feel pass draws neither. Where those decisions surface (an amber card in slot 4 when one is open, the strip's own badge, or `/books/plan` only) is the owner's call; **no capacity card and no *Place them* at any width until it is answered**.
- **The capacity number is amber past 100%, never red**, and the word "behind" appears nowhere on this screen (§ 12 → Over-commitment is a decision, not an error).
- *From the second 2026-11-02 intake (D-108, D-110):* Now's *Next in* line and *Between books*' *Or keep going* rows are 2.2d's (TASK-050), built there, not here.
- The strip is drawn here; 2.2b (TASK-051) then draws it with its rail component as a one-quarter rail. The plan keeps the strip's markup close to 2.2b's so that swap is small (M-07: one rail markup).
- Routes and nav: `src/app/books/page.tsx` is a redirect to `/books/list` today ("2.2 removes this redirect and the route table's note": `docs/02-architecture.md` § 5. Routes and data access). `src/components/nav/items.ts`: `books-dash` becomes enabled and the *Books* media switch points at `/books` (its comment names this task); `test/nav-items.test.tsx`, `test/redirect.test.ts`, `test/e2e/routes.spec.ts`. `scripts/perf/routes.mjs` measures `/books/list` as "books" until this task; `/books` joins with its budget (`scripts/perf/budget.json`; `docs/02-architecture.md` § 7).
- *2026 so far* links to Stats (6.2), which doesn't exist: the nav never leads to a screen that doesn't exist yet (`src/components/nav/items.ts`), so the plan says whether it is a link now.
- Design: `bdash` in `design/mockups.html` is superseded by the feel pass and **redrawn by this task** from it, in the same PR (`design/mockups-index.md` § Oct 2026, feel pass; standing rule 6). Reference screenshots: `design/screenshots/phone/09…12` and `desktop/07…10` (`design/screenshots/README.md`). Their figures are sample data (D-7).
- A feel-pass surface is checked more widely (`docs/04-design.md` § 10): every state at 360, 390, 412, 768, 1024 and 1280px, light and dark, reduced motion and reduced transparency; at 1440px the content box stays 1056px wide and centred; at 1280px every hover reveal is hidden at rest with a fine pointer and shown with touch.
- Decisions: D-40 (the feel pass), D-37 (levels and order), D-38, D-7, D-85 (listens), D-108, D-110, D-63. FP-D8, FP-D15. R3-12 (2.2b split out of 2.2).
- *From TASK-047 (2.2e, PR #194):* once `/books` is the dashboard, the phone reaches the Library only from it (the phone bar lists no medium items, only the media switch), so the dashboard needs a *Library* link.
- *From TASK-046 (2.1, PR #195):* the strip's figure is `planCapacity(userId, year)` in `src/db/queries.ts` (the `plan_capacity` view): the current quarter's `plannedWords` against its `capacity` (a quarter of the year's, read live from your settings) gives *615k planned · 760k a quarter*, and `readBooks` of `books` gives *3 of 7 read*. A read book still counts against the quarter it was planned in, a listen, a DNF and On deck don't, and a book with no word count and no plausible page count is in `books` and `unknownBooks` but in no word total (D-115). A year nothing is planned in reads as empty at your capacity.
- *From TASK-054 (2.2f, PR #203):* the one-tap finish is `useBookWrite` (`src/components/useBookWrite.ts`): the write, the refresh, the toast copy, the server-account Undo and *Keep going?*. *✓ finished* and *Finished it* should finish through it (`finish: initialFinish(null)` is today, Eastern, `exact`), not a second write; `src/components/FinishBook.tsx` is the pattern for focus and Retry. (arrived after the plan was approved)

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): the feel-pass screenshots (the header's widths, themes and
reduced-motion and reduced-transparency passes) of reading and *Between books* —
no horizontal scroll, the capacity rule legible, the primary action inside the
bottom 96px. The five slots render in the order above. Nothing on the screen
resolves to `--danger`. With nothing reading, Now renders *Between books* naming
the last finished book, and its offer is the current quarter's lowest-ordinal
book that is still `to_read` (D-37), named on the button; with nothing ever
finished it omits the finished line. The strip's planned total equals 2.1's
figure for that quarter. *2026 so far* has three counts, all this year.
At 1280px *On deck* and *2026 so far* are in the side rail, and **Plan** follows
2.4's hover rule for *+ Up next*.
- [ ] AC-2: Given one book *Reading* and one *Listening*, Now shows the plan's choice of the two (the rule stated in the plan) and the *Listening* one carries the headphones glyph when it is the hero; with the current quarter holding books at ordinals 1, 2, 3 where 2 is `read`, *Up next in Qn* lists 1 then 3 in that order and **Reorder** opens 1.9's reorder; *Between books*' offer skips the `read` one.
- [ ] AC-3: Given this year holds 3 text reads and 1 listen of books by 3 distinct authors first read this year, and reads in other years: *2026 so far* (the current year) shows 4 books with *1 listened*, their pages summed, and 3 new authors, and counts nothing from another year; the capacity figure past 100% renders in `--blocked` amber with no element on the page resolving to `--danger` and no text reading *behind*.
- [ ] AC-4: `GET /books` renders the dashboard (no redirect); the *Books* switch and the books *Dashboard* item link to `/books` and are current there; the Library item stays current on `/books/list`; `/` with `ledger_medium=books` still lands on `/books`.
- [ ] AC-5: The books dashboard meets the UX floor (`docs/04-design.md` § 10. The UX floor), as a feel-pass surface: its loading state (`src/app/books/loading.tsx`) is the loaded geometry in `--sunk`; *Between books* is its empty state and a dashboard with nothing planned shows an empty slate with one primary action in *Up next in Qn*; text 4.5:1 and outlines 3:1 in both themes; thumb-bar buttons 44px and nothing interactive under 24px; every control a real `<button>` or `<a href>` with a name; screenshots in every state at 360, 390, 412, 768, 1024 and 1280px, light and dark, reduced motion and reduced transparency; axe reports no new violations.

## Out of scope

- 2.2d's *Next in* line and *Or keep going* rows (TASK-050).
- 2.2b's rail component (TASK-051), the full plan rail on `/books/plan` (2.10) and the plan editor (2.3).
- The capacity card, **Rebalance**, **Accept** and *Place them* (2.7, 2.8) until the owner answers where they surface.
- The *sittings* line and measured pace (2.1b), the session sheet and *Log a session*.
- The art band (4.2/4.3), real covers (4.3), Stats (6.2).
- The comics dashboard's 2.4 work: only what this screen borrows from it is built here.

## Files likely touched

- `src/app/books/page.tsx` (the redirect goes), `src/app/books/loading.tsx` (new).
- `src/components/BooksNow.tsx`, `src/components/BetweenBooks.tsx`, `src/components/QuarterStrip.tsx` (new; names the plan's) — the hero, the between state, the strip.
- `src/db/queries.ts` — the book in hand, the last finish, the current quarter's shelf, On deck, the year's three counts; capacity from TASK-046.
- `src/components/nav/items.ts` — `books-dash` enabled, the switch's href.
- `src/app/globals.css` — the slots, from tokens only.
- `scripts/perf/routes.mjs`, `scripts/perf/budget.json` — `/books`.
- `design/mockups.html`, `design/mockups-index.md` — `bdash` redrawn from the feel pass.
- `test/books-dashboard.test.ts` (new), `test/nav-items.test.tsx`, `test/redirect.test.ts`, `test/e2e/books-dashboard.spec.ts` (new), `test/e2e/routes.spec.ts`.

## Verification

- Automated: `test/books-dashboard.test.ts` (AC-2's shelf order and offer, AC-3's counts, the strip total against TASK-046's query); `test/nav-items.test.tsx` and `test/redirect.test.ts` (AC-4); `test/e2e/books-dashboard.spec.ts` (slot order, *Between books* with and without a finish, the bottom-96px primary, no horizontal scroll, the 1280px side rail and the hover reveal with a fine pointer and with touch, `--danger` absent, axe, the feel-pass screenshots).
- Manual: `npm run dev`, open `/books` with a book *Reading* → Now shows it; finish it (then undo, leaving the dev database as found) → *Between books* names it and offers the top of the quarter by name.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- 2.2b: `QuarterStrip`'s markup and class names are what the rail component replaces with a one-quarter rail (M-07) → docs/tasks/TASK-051-plan-rail.md § Context
- 2.2d: *Next in* goes under the hero in `BooksNow.tsx`, and *Or keep going* under the offer in `BetweenBooks.tsx`; both are left as named slots → docs/tasks/TASK-050-next-in-what-you-read.md § Context
- 2.1b: Now's position, its meter and *Log progress* wait for sessions (Q1); the reason on the disabled verb names 2.1b → docs/05-roadmap.md § 2.1b (approved at plan)

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

Provisional: depends on TASK-048 for the finish offer (`src/lib/follow-offer.ts`, `UndoEntry.offer`); 2.2c lands first by M10's order.

**Answered at the plan gate (owner, 2026-11-04: as recommended):**
- Q1, Now's position, until 2.1b stores one: no `p. n of N` and no meter. Show the page count (`468 pages`, mono), *Started 21 Sep*, and *about 9 evenings at your set pace* for the whole book (its words ÷ minutes a day × words a minute, rounded up).
- Q2, the capacity card and *Place them*: `/books/plan` only. Nothing on the dashboard, and nothing built here either way.
- Q3, **Plan** on an *On deck* row moves the book to the end of the current quarter, with Undo: a new `POST /api/plan { bookId, from: "on_deck", to: <quarter> }` through `movePlan`.
- Q4, *✓ finished* / *Finished it* finishes the book in hand today in one tap, with Undo and 2.2c's *Keep going?*. A different date is set from the Library's *Finished*.

**Rules this plan sets:** the hero is the in-progress book started most recently (`started_on DESC NULLS LAST`, then *Reading* before *Listening*, then title). *2026 so far* is plain text until Stats (6.2) exists. *Pick something else* links to `/books/status?tab=next`. The lede carries a *Library* link (TASK-047's note). *This year* and *the current quarter* come from the Eastern day (`today()`, `src/lib/finish-date.ts`), passed into each query so the tests fix the date. A new author is one with a read this year and no read dated before it or undated.

**Steps**
1. Redraw `bdash` in `design/mockups.html` from the feel pass, reading and *Between books*, at 360, 834 and 1280, light and dark. Update `design/mockups-index.md`. The owner looks before step 2.
2. `src/db/queries.ts`: `booksInHand(userId)` (the rule above; cover, author, pages, words, start, `listened`, status); `lastFinish(userId)` (the latest dated read in `book_reads`, else the latest undated one, with its start and days taken; null when nothing is finished); `quarterShelf(userId, period)` (that quarter's `to_read` books by `ordinal`; `[0]` is *Between books*' offer); `onDeck(userId, limit)`; `yearSoFar(userId, year)` → `{ books, listened, pages, newAuthors }` from `book_reads`. The strip reads `planCapacity(userId, year).quarters[q-1]` (TASK-046) and nothing new.
3. Components (new): `BooksNow.tsx` (the hero: `--r-hero`, `--cover-hero`, Newsreader title, the headphones glyph for *Listening*); `BetweenBooks.tsx` (a 72px cover with a `--ready` check, the `✓ finished · Sun` badge, the line, the top of the plan, *Pick something else*; with no finish, no finished line); `QuarterStrip.tsx` (*Q4 2026 · 3 of 7 read · 615k planned · 760k a quarter*: one block per planned book at k/760 of the width, the rule at the right edge, `--blocked` past 100%, no "behind"; its markup is shaped like 2.2b's rail so TASK-051 can swap it); `PlanShelf.tsx` (client, QueueShelf's pattern: covers in order, **Reorder** → the quarter's section on `/books/status?tab=next`, ‹ › only when it overflows); `OnDeckRow.tsx` (client: the row, with **Plan** per Q3).
4. `src/components/QueueShelf.tsx` (**not in Files likely touched**): pull its pager into `useShelfPager()` so `PlanShelf` shares it. `queue.spec.ts` guards the comics side.
5. `src/components/ThumbBar.tsx` (**not in the list**): `{ kind: "books"; book: { id, title } | null; next: { id, title } | null }`. With a book: *Log progress* / *Log pages* stay `aria-disabled` with the reason *Logging pages arrives with sessions (2.1b)*; *✓ finished* / *Finished it* per Q4. Without one: the primary is *Start <title>* (writes `reading`, with Undo; full title in its name, truncated below about 1100px), or *Pick a book* → `/books/status?tab=next` with nothing planned. There is no second verb, and the header drops *Finished it*.
6. `src/app/books/page.tsx`: the dashboard in `DashboardVerbs`, `pagehead` + `HeaderVerbs`, then `dash-cols`: Now, *Up next in Qn* and *This quarter* in `dash-main`; *On deck* and *2026 so far* in `dash-side`. DOM order is the five slots. *Up next* with nothing planned is an `EmptySlate` with one primary (*Add a book*, On deck). `src/app/books/loading.tsx` (new): the loaded geometry in `--sunk`.
7. `src/components/nav/items.ts`: `books-dash` enabled; the *Books* switch → `/books`; drop the redirect comments.
8. `src/app/api/plan/route.ts` (**not in the list**): Q3's POST.
9. `src/app/globals.css`: the slots and states; tablet 768–1023 with the horizontal hero around 150×225 and *On deck* | *2026 so far* at 1.5 : 1; desktop with the 168×252 cover, 32/36 title and the 480px meter cap; the **Plan** reveal under `(hover:hover) and (pointer:fine)`, always shown on touch. Tokens only.
10. `scripts/perf/routes.mjs` + `budget.json`: today's `books` (`/books/list`) is renamed `library` and keeps its numbers; `books` is `/books`, with a budget set from the first preview measurement. `docs/02-architecture.md` § 7 mirrors both, and § 5 loses the redirect note (**not in the list**; the Context names both).

**Test strategy**
- AC-1: `test/e2e/books-dashboard.spec.ts`: "five slots in order", "Between books names the last finish; the button names the lowest-ordinal to_read book", "never finished: no finished line", "no horizontal scroll; the primary inside the bottom 96px", "nothing resolves to --danger", "1280: On deck and 2026 so far in the side rail; Plan hidden at rest with a fine pointer, shown on hover, focus-within and touch", and feel-pass screenshots at every width, light and dark, reduced motion and reduced transparency. `test/books-dashboard.test.ts`: "the strip's planned total equals planCapacity's for the quarter", "2026 so far is three counts, all this year".
- AC-2: `books-dashboard.test.ts` "the hero is the most recently started of Reading and Listening", "ordinals 1, 2 read, 3 → shelf 1 then 3", "the offer skips the read one"; the e2e spec: "a Listening hero carries the headphones glyph", "Reorder opens the quarter's reorder".
- AC-3: `books-dashboard.test.ts` "3 text reads and 1 listen by 3 new authors: 4 books, 1 listened, pages summed, 3 new authors; other years add nothing"; e2e "past 100% the figure is --blocked; no --danger; no 'behind'".
- AC-4: `test/nav-items.test.tsx` (its 2.2 cases turn round: Dashboard and the switch → `/books`, current there; Library current on `/books/list`); `test/redirect.test.ts` (`/` with `ledger_medium=books` → `/books`, as now); `test/e2e/routes.spec.ts` ("GET /books renders the dashboard", replacing the redirect assertion).
- AC-5: the e2e spec, "the loading state is the loaded geometry in --sunk", "nothing planned: one primary in Up next", `contrastFailures` in both themes, target sizes, names, axe. `test/e2e/skeletons.spec.ts` gains `/books`.

**Risks:** (1) The dashboard reads the whole user, so the spec makes its own books and parks any other in-progress E2E book, restoring it after (`workers: 1`). (2) Date-dependent: the current quarter comes from Eastern today everywhere, tests included. (3) `/books` has no budget yet; renaming the perf id restarts the Library's history under `library`. (4) Provisional on TASK-048.

**Size check:** well over 8 files, data and UI. `never-split` keeps it whole and `autonomy: attended`; Context gives the reason.

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
