---
id: TASK-105
title: 5.12 In the middle of, and completed (2 of 2) — the /progress page, its tabs and chips
status: Review
depends_on: [TASK-104]
size: M
model: sonnet
autonomy: attended
ui: true
plan_status: approved
planned_at_commit: ae89713
---

# TASK-105 — 5.12 In the middle of, and completed (2 of 2) — the /progress page, its tabs and chips

## Goal

One page, beside Inbox, shows everything you're in the middle of and everything you've completed, books and comics together or one medium at a time, with the bigger things nesting their parts beneath them.

## Context

- Roadmap: `docs/05-roadmap.md` § 5.12 In the middle of, and completed: one page for every medium (M17). D-109, D-108, D-118, D-119. Feature F-69. Its **Check:** is the contract.
- **Split, 2 of 2.** TASK-104 built the rows. This part draws them, and **its merge ticks 5.12**.
- **One page, `/progress`, two tabs: *In the middle of · Completed***, in the global part of the nav beside Inbox (`NAV_ITEMS`, `group: "global"`, `src/components/nav/items.ts`; the phone's tab row shows Inbox from the global group today: the plan says where *Progress* sits there, per 2.2i's `tabRowItems`), with a chip per medium (*All · Books · Comics*; *Watch*, *Music* and *Games* once they exist). The tabs follow the status screens' tablist (`src/components/StatusTabs.tsx`); the tab and chip are in the URL so a reload keeps them. It replaces the old plan of a group on 1.9's books *In flight* tab: In flight keeps the books and runs in hand.
- **On hold** is a collapsed group under *In the middle of*, with its count, labelled as 2.2h's control labels it (*On hold*).
- **Each row**: the medium's glyph, the kind (*series*, *universe*, *author*, *shelf*, *run*, *track*), the name, `read / total` in mono, an `.emeter` filled with `--ready`, and on *In the middle of* the next thing named. *Completed* shows the finish's month (*finished Mar 2026*). A row opens its page where one exists (5.9's series page, 5.11's author and universe pages, 5.1's shelf page, 5.2's track page, the run); where none exists yet it is not a link (the plan lists which exist when it is written).
- **Rows nest** (D-119): a series under a listed universe sits indented beneath it, and a subseries beneath its series, as 2.2g's rows do in Now (`src/components/WhereItSits.tsx`). A row whose parent isn't listed stands on its own.
- **Links in:** the books and comics dashboards' rollups link here (`src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx`, the `rollup` slot), keeping the five slots' order.
- **Empty states are calm:** *Nothing in the middle. Follow a series as Reading to see it here* with *Open the Library* (2.2e); the plan writes *Completed*'s against the frame.
- **Not drawn yet:** the mockup gains `/progress` at phone, tablet and desktop widths before it is built, and `design/mockups-index.md` lists it (`ui.redrawFiles`); this PR draws it first.
- Architecture: add `/progress` to `docs/02-architecture.md` § 5.
- Design: `design/STYLE_GUIDE.md` § 14–§ 16 (the feel pass: empty and caught-up states, completion has no celebration); `docs/04-design.md` § 10 The UX floor; `.claude/rules/ui.md`.
- Decisions: D-40, D-108, D-109, D-118, D-119, D-120; R1-06.
- *From TASK-104 (5.12, PR #297):* the rows are `progressRows(userId)` in `src/db/queries.ts`, one read-only statement returning `{ middle, onHold, completed }` of `ProgressRow` (`medium` books|comics, `kind`, `id`, `name`, `read`, `total`, `next`, `parentKind`, `parentId`, `lastOn`, `finishedMonth`), each list newest read first. `next` is `{ id, label, ordinal }`: a book (`ordinal` null), or a run's resume pointer (the issue, its label, the `#p-n` ordinal). Decided at TASK-104's plan gate:
  - (a) subseries are rows of their own, `kind: "subseries"`, nested under their series;
  - (b) a track names no next thing;
  - (c) runs never nest under tracks;
  - (d) a series whose stated `total_books` is above its live books, all read, is on neither tab.

  Nesting is one level, and only under a parent listed in the same section. A series' parent is the universe most of its books that have one are in. Nothing nests under an author: the roadmap's nesting names only universe → series → subseries, though D-119's meters put a followed author outermost. Build the tree from `parentKind`/`parentId`: a child doesn't always sort directly beneath its parent. `finishedMonth` is `YYYY-MM`, the Eastern month. `/progress` goes into `test/query-budget.test.ts` here, as one query in one wave. The statement was not timed at real scale (the test database holds fixtures only), so watch its time on the dev data in the UI walk.

## Acceptance criteria

- [x] AC-1 (roadmap **Check:**, verbatim; this part proves, in the browser (0.11) on the test database: the *Books* chip hides the run, a series under a listed universe nests beneath it, *On hold* drawn below *In the middle of*, and the screenshots. TASK-104 proves the membership and counts):
a series followed `reading` with 2 of 5 read is under *In the
middle of* and the same series unfollowed is not; a series with 5 of 5
read is under *Completed* whether followed or not, and a one-book
series read is not; an author appears only when followed; a shelf
followed `reading` with 1 of 3 read appears; a run with 3 of 10 read is
under *In the middle of*, and with 10 of 10 under *Completed*; the
*Books* chip hides the run; nothing is written; each row's counts equal
its view's. A series followed `tracking` with 2 of 5 read is under *On
hold* and not above it, and at 0 of 5 it is on neither; a series under a
listed universe nests beneath it. Screenshots at 360px and 1280px.
- [x] AC-2: Given the Check's fixtures, `/progress` opens on *In the middle of* with the series, the shelf and the run, each with its kind, `read / total` and next thing; *Books* hides the run and *Comics* hides the books rows; the choice and the tab survive a reload.
- [x] AC-3: *On hold* is collapsed with its count, a real button with `aria-expanded`; expanding it lists the tracking series at 2 of 5.
- [x] AC-4: *Completed* lists the 5-of-5 series and the 10-of-10 run, each with *finished <Mon YYYY>*; a row with a page is a link to it.
- [x] AC-5: *Progress* shows in the global part of the rail and the sidebar beside Inbox and in the phone's navigation, current on `/progress`; the books and comics dashboards' rollups link to it; `design/mockups.html` draws `/progress` at phone, tablet and desktop, and `design/mockups-index.md` lists it (task 5.12).
- [x] AC-6: The page meets the UX floor (`docs/04-design.md` § 10): each tab's empty state with one action, loading skeletons, an error state, the tablist and chips operable by keyboard with names, targets ≥ 24px, contrast in light and dark, nothing red, screenshots at 360px and 1280px (and the other `ui.viewports` widths).

## Out of scope

- The queries (TASK-104).
- Pages that don't exist yet (5.2's tracks page, 5.9, 5.11): rows link where a page exists.
- Watch, music and games rows (8.8, 9.6, 10.3).

## Files likely touched

- `src/app/progress/page.tsx`, `src/app/progress/loading.tsx` (new).
- `src/components/ProgressRows.tsx` (new; the name is the plan's) — rows, nesting, the *On hold* group.
- `src/components/nav/items.ts` — the *Progress* item.
- `src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx` — the rollup links.
- `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.
- `test/nav-items.test.tsx`, `test/e2e/progress.spec.ts` (new).

## Verification

- Automated: `test/e2e/progress.spec.ts` (AC-1's browser clauses, AC-2 to AC-5, axe; screenshots at each width), `test/nav-items.test.tsx`.
- Manual: on the dev database, Inbox's neighbour *Progress* → *In the middle of* → a followed series and a part-read run; *Books* → the run goes; *Completed* → finished months.

## Follow-ups

_Work noticed during this task and deliberately left out. Each bullet ends `→ <path> § <section>` (where it was placed) or `→ not tracked: <reason>`. See `.claude/skills/track-follow-ups/classify.md`; the PR's Follow-ups section is copied from here._

- The phone tab row's new shape (medium items, then Inbox, then Progress) makes D-120's text out of date → docs/OWNER-CHECKLIST.md § Approvals from follow-ups (PR #300)
- A track row draws no meter (D-29; roadmap 5.12's "each row an `.emeter`" has this one exception, owner's call at spec review) → docs/OWNER-CHECKLIST.md § Approvals from follow-ups (PR #300)
- The `progress` perf budget (24,000 / 175,400 / 35 / 100) is Books status's, copied, never measured: Lighthouse is off (D-158), and its first run on the owner's switch shows whether it holds → not tracked: the budget is a ceiling, and a run on the owner's switch reports any overage
- Subseries and track rows have no page yet, so they are text → not tracked: already in this task's Out of scope; the rows link where a page exists, so 5.2's track page and a subseries page need no change here
- `progressRows` answered in 250–730 ms on the dev data (ui-verifier; the dashboards about 100–215 ms), 19 On hold rows drawn hidden → not tracked: nothing near a problem; watch it as the library grows
- The mockup index's line ranges drift (17 rows were already off on main) → not tracked: the scripts compute them fresh, and the index says so

## Plan

Approved by the owner 2026-11-20, kept whole: it is already 2 of 2, the mockup must be drawn in this PR, and
its merge ticks 5.12. Over the 8-file line (10 source files) with `splitPolicy: split`; the owner chose
not to split further.

### Steps

1. **`src/lib/progress.ts` (new, pure):** `parseProgressTab(?tab=)` → `middle` (default) | `completed`;
   `parseMedium(?medium=)` → `all` (default) | `books` | `comics`; `progressHref(tab, medium)` that keeps
   the other (`/progress`, `?tab=completed`, `?medium=books`, both); `byMedium(rows, medium)`; `nestRows(rows)`
   → a tree from `parentKind`/`parentId` (children under their parent in list order, a parent keeps its own
   place; a subseries can sit two deep, under a series under a universe); `rowHref(row, tab)`: series
   `/books/series/<id>`, universe `/books/universes/<id>`, author `/books/authors/<id>`, shelf
   `/books/shelves/<id>`, run `/comics/<id>` (with `#p-<next.ordinal>` on *In the middle of*), subseries and
   track null (no page yet: not links); `finishedLabel("2026-03")` → `finished Mar 2026`.
2. **A shared tablist:** `src/components/Tablist.tsx` (new, client) is `StatusTabs`' strip made generic:
   `tabs: { key, name, href, count }[]`, `selected`, `label`, `panelId`, the same arrow, Home and End keys,
   links with `replace` and `scroll={false}`, and the sliding ink. `StatusTabs.tsx` becomes a thin wrapper and
   renders the same markup as now. In `globals.css`, `.tab-ink` width becomes `calc(100% / var(--n,3))`, with
   `--n` set by `Tablist`.
3. **The page:** `src/app/progress/page.tsx` (server, `force-dynamic`, metadata *Progress · Ledger*) reads
   `searchParams` and `requireUserId`, then makes one `progressRows(userId)` call. h1 *Progress*. The tabs are
   *In the middle of · Completed*, each with its row count under the chip (On hold isn't counted in the tab;
   it carries its own). The chips row is *All · Books · Comics*, real links in `.filters` `role="group"`
   `aria-label="Medium"` with `aria-current` on the chosen one, so the tab and chip are both in the URL. Also
   `src/app/progress/loading.tsx` (h1, `sk-tabs`, chip and row skeletons at the loaded size) and
   `src/app/progress/error.tsx` (as the author page's).
4. **`src/components/ProgressRows.tsx` (new):** a nested list. Each row: the medium's glyph (`book` or
   `book-open` from the sprite, with an sr-only *Books* or *Comics*), the kind as a grey badge (*series,
   subseries, universe, author, shelf, run, track*), the name (a link where `rowHref` gives one, else text),
   `read / total` in mono, an `.emeter` filled with `--ready` (`fillShare` from `WhereItSits`), and below it
   `Next: {label}` on *In the middle of* (none on a track or with `next` null) or *finished Mon YYYY* on
   *Completed* (none with no month). Children are indented (`ul` inside the parent's `li`). *On hold* is a
   small client disclosure (`OnHold`): a real `<button aria-expanded>` *On hold* with its count in mono,
   collapsed at first, below the middle rows, drawing the same rows when open; absent with none under the
   chip.
5. **Empty states** (`EmptySlate`, one action each): *In the middle of*, All and Books: *Nothing in the
   middle.* *Follow a series as Reading to see it here.* **Open the Library** (`/books/list`); Comics:
   *Nothing in the middle.* *Runs you start land here.* **Open Runs** (`/comics/runs`). *Completed*: *Nothing
   completed yet.* *A series, shelf or run with every book or issue read lands here.* with the same action
   for its chip. On hold still draws under an empty middle.
6. **Nav:** in `src/components/nav/items.ts`, `{ id: "progress", label: "Progress", href: "/progress", icon:
   "chart-no-axes-gantt", enabled: true, group: "global" }` after Inbox. `tabRowItems` ends with every global
   item (… Inbox, Progress) rather than Inbox alone, so the phone's tab row shows it. In
   `src/components/nav/Icons.tsx`, the lucide `chart-no-axes-gantt` path is added to `IconName` and the
   sprite.
7. **Rollup links:** in `src/app/books/page.tsx`, a grey link line in the `year-so-far` (rollup) slot after
   `ComingOutLine`: *In the middle of · Completed →* to `/progress?medium=books`. In
   `src/app/comics/(dash)/page.tsx`, which has no `data-slot="rollup"`, the link goes on the *All runs* line
   under the totals rollup: *In the middle of · Completed* to `/progress?medium=comics`. The order of the five
   slots doesn't change.
8. **Docs:** `design/mockups.html` gains a `progress` section with phone 360 (middle with nesting and On hold
   collapsed, then open; Completed; the empty middle), tablet 834 (*Progress* current on the rail) and
   desktop (current in the sidebar) frames, with notes. `design/mockups-index.md` lists `progress`.
   `docs/02-architecture.md` § 5 gets the `/progress` route row, and § 7's query counts get `/progress` 1.

### Files

- New: `src/lib/progress.ts`, `src/components/Tablist.tsx`, `src/components/ProgressRows.tsx`,
  `src/app/progress/page.tsx`, `src/app/progress/loading.tsx`, `src/app/progress/error.tsx`.
- Changed: `src/components/StatusTabs.tsx` (delegates to Tablist), `src/components/nav/items.ts`,
  `src/components/nav/Icons.tsx`, `src/app/globals.css` (`.tab-ink` width, the progress rows, indent, On
  hold), `src/app/books/page.tsx`, `src/app/comics/(dash)/page.tsx`.
- Docs: `design/mockups.html`, `design/mockups-index.md`, `docs/02-architecture.md`.
- Tests: `test/progress-lib.test.ts` (new), `test/e2e/progress.spec.ts` (new), `test/nav-items.test.tsx`,
  `test/query-budget.test.ts`, `test/e2e/tab-row.spec.ts` (its expectations once Progress joins the row).
- Not in "Files likely touched": Tablist, StatusTabs, Icons, globals.css, lib/progress, error.tsx,
  query-budget.test.ts, tab-row.spec.ts.

### Test strategy

- AC-1, AC-2: `test/e2e/progress.spec.ts`, seeding the Check's fixtures under E2E ids: *In the middle of*
  lists the reading series, the shelf and the run, each with its kind, `read / total` and next thing; the
  *Books* chip hides the run, and *Comics* hides the books rows; the tab and chip survive a reload; the
  series under a listed universe is inside the universe's row, indented; nothing is written (row counts in
  the follow and progress tables are unchanged). Membership and counts are TASK-104's
  (`test/progress-page.test.ts`).
- AC-3: the same spec: *On hold* is a button with `aria-expanded="false"` and its count; after a click it is
  `true` and lists the tracking series at 2 / 5, and the series is not above it.
- AC-4: the same spec: *Completed* lists the 5-of-5 series and the 10-of-10 run, each with `finished {Mon YYYY}`;
  the series is a link to `/books/series/<id>`, and the run to `/comics/<id>`.
- AC-5: `test/nav-items.test.tsx`: *Progress* is after Inbox in the rail and the sidebar and last in
  `tabRowItems`, current on `/progress` in each. The e2e spec: the books and comics dashboards' rollup links
  open `/progress` with the chip chosen. The mockup section and its index row are checked by hand and by
  spec-reviewer.
- AC-6: the e2e spec: axe; each tab's empty state with one action (on a fixture-free chip or a cleared
  fixture); the loading skeletons (rendered `loading.tsx`) and the error state (rendered `error.tsx`);
  keyboard on the tablist (←/→) and the chips (Tab, Enter); contrast; targets ≥ 24px; nothing red; no
  sideways scroll; screenshots at every `ui.viewports` width.
- `test/progress-lib.test.ts`: tab and medium parsing, hrefs keeping the other parameter, nesting (two
  deep, an orphan stands alone, children placed under a parent listed after them), `rowHref` per kind, the
  month label.
- `test/query-budget.test.ts`: `/progress` is 1 query in 1 wave.

### Risks

- One more global item could crowd the 768px rail at short heights; `shell.spec` and the screenshots will
  show it.
- Changing `tabRowItems` changes the existing expectations in `nav-items.test.tsx` and `tab-row.spec.ts`.
- `progressRows` hasn't been timed at real scale: time it on the development data during the UI walk.
- StatusTabs' refactor must keep `status.spec.ts` green; it is run in one project before the PR.

## Review log

_Filled by /implement-task. One line per round._

Verify R1 FAIL (perf.test.ts: route list) → R2 PASS | CI R1 FAIL (releases.spec, w1280-light: the Progress link shared `.coming-out`) → fixed | Verify R3 PASS | CI R2 FAIL (e2e-budget 6.1 > 6.0 min a shard) → behaviour tests retagged | CI R3 FAIL (e2e-budget, 6.1) → states and the Completed floor run once, markup.spec additions dropped | Rebased on 69064bc (task 5.15), Verify R4 PASS | Audit R1 PASS (markup.spec additions non-discriminating: dropped) | Spec R1 CHANGES (track meter vs D-29) → owner chose no meter → fixed | UI R1 PASS (comics link was ink, not grey → fixed)

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds: 4
- Review rounds: 2
- First-pass AC FAILs: 0 (one rule violation, D-29)
- Plan revisions after approval: 0
