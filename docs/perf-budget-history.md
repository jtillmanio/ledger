# Performance budget: the history

Moved here from `docs/02-architecture.md` § Operational posture, *Performance
budget*, by task 0.13 (D-142), which replaced the rule these paragraphs worked
under: since 0.13 a preview fails first on what its PR grows over main's last
measured run, and a ceiling is raised only by a decision. The architecture doc
keeps the rule and the table; this file keeps how the numbers got there, each
paragraph as it was written (`docs/archive/` is frozen, so it lives here).

## The rule before 0.13

The numbers are `scripts/perf/budget.json`
(`test/perf.test.ts` holds this table to it); each is the median
measured on 0.10's own preview plus 20%, and the accessibility score is the
one measured. Raising one needs a reason here. A new page, at any depth,
adds its route to `scripts/perf/routes.mjs` and its row here, or is listed
as unmeasured with a reason in `test/perf.test.ts` (task 0.14c). Task 0.13 (D-142)
replaces this rule, after 1.30: a preview fails on what its PR adds over
main's last run, the shared JS is budgeted once, ceilings are the
measurement plus 25% and rise only by decision, and requests to another
origin are not budgeted. Until it lands, the rule above holds.

## The last table under that rule

The numbers `scripts/perf/budget.json` held when 0.13 replaced them. JS bytes
were each route's whole JS, the shared framework and layout (about 140 KB)
included.

| Route | Document + RSC bytes | JS bytes | Requests | Accessibility ≥ |
|---|---|---|---|---|
| `/login` | 8,000 | 170,000 | 30 | 100 |
| `/comics` | 30,500 | 170,000 | 41 | 100 |
| `/comics/runs` | 57,000 | 170,000 | 38 | 100 |
| `/comics/status` | 24,000 | 175,000 | 35 | 100 |
| `/books/status` | 24,000 | 175,400 | 35 | 100 |
| `/progress` | 24,000 | 175,400 | 35 | 100 |
| `/parked` | 24,000 | 175,400 | 35 | 100 |
| `/comics/bendis-disassembled` | 26,800 | 172,000 | 50 | 100 |
| `/comics/busiek-avengers` | 28,000 | 171,000 | 72 | 100 |
| `/books` | 19,000 | 175,000 | 36 | 100 |
| `/books/list` | 80,000 | 170,000 | 64 | 100 |
| `/books/plan` | 24,000 | 177,700 | 40 | 100 |
| `/inbox` | 16,000 | 173,000 | 31 | 100 |
| `/settings` | 16,800 | 173,000 | 32 | 100 |
| `/watch` | 12,500 | 173,000 | 28 | 100 |
| `/books/releases` | 8,500 | 162,900 | 19 | 100 |
| `/books/shelves` | 8,700 | 160,100 | 19 | 100 |
| `/books/shelves/[id]` | 9,700 | 167,100 | 21 | 100 |
| `/books/add` | 9,400 | 177,300 | 19 | 100 |
| `/books/top` | 10,100 | 164,900 | 28 | 100 |
| `/book/[id]` | 9,400 | 181,900 | 25 | 100 |
| `/comics/bendis-disassembled/add` | 22,300 | 172,200 | 18 | 100 |
| `/settings/calibre` | 8,300 | 170,900 | 21 | 100 |

## Each number, and each raise (tasks 0.10 to 0.14c, PR #80 to #319)

Task 0.14c (TASK-114) measures every page, at any depth: `test/perf.test.ts` fails on a `page.tsx`
under `src/app` that no route measures and that its unmeasured list (each with a reason) doesn't
name. The old check read only top-level folders, so eight nested pages went unmeasured; they are the
last eight rows. Each number is a hand run's measurement of PR #319's preview plus about 5%
(2026-11-23, `LIGHTHOUSE_MODE` off: the owner allowed a hand run, D-158), one load per route.
Live had no shelf, so a shelf's page is a second hand run's, on a shelf made on the preview's own
branch; live needs a shelf of its own before the next measured run, or that route fails as not
measured. The first run found the book's page asking
for `GET /api/progress/book/read` on every load (its status control is drawn open and loaded the
reads); since 0.14c the page hands the control its read count, and the reads load only when *All
reads* is pressed. A shelf's and a book's ids are the owner's data,
so those two routes take the first link on the page that lists them (`/books/shelves`, the Library)
and log the path they chose; when live has none, the route fails as not measured. A book's page is
measured both ways under one id: the Lighthouse load is the full page (a reload or a shared link),
and the tap is the sheet a Library row opens through the `@modal` intercept. Unmeasured, with their
reasons in the test: the sheet's own intercept page, and the series, a series', an author's and a
universe's pages (5.9, 5.11), which roadmap 0.14e measures.

Task 5.15 (TASK-111) adds `/parked`, the parked review, at `/books/status`'s numbers: a list of book
rows whose verbs are client buttons and whose plan picker loads only when *Plan…* is pressed. Its tap
starts on the Library's *Parked* filter, which always links to it (it has no nav item).

Task 4.3 (TASK-085, PR #269) raised the two run routes' requests, and the
large run's document + RSC: every spine row now draws a cover box, and a row
whose issue has a `cover_url` holds a lazy `<img>`, so the images within the
browser's lazy-load distance of the first screen are fetched on the load
(Metron's host, hotlinked, D-94). The PR's preview measured
`/comics/bendis-disassembled` at 42 requests (the budget was 38) and
`/comics/busiek-avengers` at 56 (33) and 26,490 bytes of document + RSC
(26,000), the bytes being each row's cover URL in the payload. The budgets
are those medians plus about 20%: 50 requests for the small run, 72 for the
large, 28,000 bytes for the large. The bytes of the small run and every JS
number are unchanged, and `/books/list` stayed inside its 64 (59 measured).

Measured on 0.10's preview (2026-10-07, Lighthouse 13.5.0, Chrome 154),
median of three: document + RSC 6,479 / 38,598 / 20,637 / 16,684 /
39,279 bytes in the row order above, JS 141,241–142,506 bytes on every
route (the shared framework chunks), 24–31 requests, accessibility 100 everywhere,
CLS at most 0.04. The bytes barely move between runs (under 1%), so 20%
is room for a real change, not noise. `/inbox` (task 1.4b) is set the
same way from PR #80's preview (2026-10-13, Lighthouse 13.5.0): document +
RSC 8.7 KB, JS 140.7 KB, 23 requests, accessibility 100, CLS 0.003.
Task 1.8c moved the run list to `/comics/runs`, which keeps the 47,000 that
`/comics` was set to (it is the same screen); task 1.10 raised it to 57,000:
every run row gained **+ Up next** (a client button named for its run, AC-3),
and the list measured 47,740 bytes on PR #115's preview, so the budget is that
median plus 20%, the rule above. `/comics` is now the
dashboard: 28,000 is the median of its first preview's Lighthouse run
(23,046 bytes, PR #108) plus 20%. `/books` is measured at `/books/list`,
since Lighthouse sends the session as a `Cookie` header and a redirect
drops it; it kept the 48,000 `/books` had until the live ledger gained
book covers (task 1.14's Open Library details, loaded 2026-10-27; Hardcover's since D-94, Open Library removed in 6.19). Seven
covers now load on its first screen, and each costs three requests
(covers.openlibrary.org redirects through archive.org to an image server):
PR #145's preview measured 50,248–50,320 bytes and 44 requests in three
runs, against 44.6 KB and 21 without covers, so the budget is that median
plus 20%, 60,000 bytes and 53 requests. Cover sizes and *Show covers* are
task 4.3's. The nav's Books link pointed at
`/books/list` until task 2.2 (now `/books`, the dashboard), and its Ledger link (`/`, a redirect) is not prefetched: a
page that prefetched a redirect never reached network idle in the tap
runner, and made 55 requests against a budget of 35. `/watch` (task 1.8) is
the shell and an empty slate, so it starts from `/inbox`'s numbers (the same
weight of page); it is tapped from `/comics` on the media bar's link.
`/settings` (task 2.0) starts from the same numbers: two small reads, three
steppers and a card, tapped from `/comics` on the gear or the rail's foot.
Task 2.0 also raised `/inbox`, `/watch` and the large run to 12,500, 12,500
and 22,500 bytes. The shell's Settings links (the phone bar's gear, the
rail's and sidebar's foot) are `<Link>`s, which the old Export `<a>` was
not, so every page now prefetches `/settings`' loading shell: two requests,
283 + 1,084 bytes on `/inbox` in PR #193's Lighthouse run, 1.4 KB a page.
That run measured 12,218 (`/inbox`), 11,806 (`/watch`) and 21,857 (the large
run) against the old 11,000, 11,000 and 21,000; each new budget is the old
one plus 1.5 KB. The other pages stayed inside theirs. The prefetch is the
point of a `loading.tsx` (a tap shows the skeleton at once), so it stays.
Task 2.2c (PR #197) raised `/comics` to 36 requests and `/books/list` to
66,000 bytes and 58 requests. Every route loads one more script: the
toast's *Keep going?* support (F6, D-116, and the lazily loaded
`ToastOffer`) tipped Turbopack into splitting the layout's shared chunk in
two (24.7 and 13.9 KB built, where it was one of 37.7 KB), about 1 KB more
JS, and `/comics` was at its 35. `/books/list` measured 62,927 bytes and 55
requests on PR #197's preview, against 52,323 and 47 on PR #195's: each
row's `⋯` (the *Follow…* menu) is about 1.5 KB of that and the script one
request; the rest is the preview's data (a 920 KB document against 731 KB,
2,475 more DOM nodes of which the `⋯` is about 2,000, and two more covers on
the first screen at three requests each). The new numbers are that run plus
about 5%.
Task 2.2i (PR #201, D-126) added the phone's tab row. Its links are on
screen at phone width, so Next prefetches each one's loading shell (a tap
on Status or Add shows the skeleton at once); only comics Add is
`noPrefetch`. The hidden rail and sidebar are still never prefetched. That
is a few more requests on every route and about 0.9 KB of RSC for each
link prefetched. Measured on the preview, document + RSC bytes and requests
(median of three): `/comics` 29,286 and 39, `/comics/runs` 36 requests,
a small run 25,550 bytes, the large run 24,752 and 31, `/books/list`
66,956 and 61, `/inbox` 15,241 and 29, `/settings` 15,297 and 30. Each new
budget is that median plus about 5%: `/comics` 30,500 and 41, `/comics/runs`
38 requests, small run 26,800, large run 26,000 and 33, `/books/list`
70,000 and 64, `/inbox` and `/settings` 16,000 and 31 and 32. `/inbox` and
`/settings` rise most because they draw the last medium's whole row, and
they have no other page weight to hide it in. The other routes stayed inside
theirs.
Task 2.2 made `/books` the books dashboard, so the route list measures it as
`books`, tapped from `/comics` on the media switch, and the Library as
`library`, which keeps `/books/list`'s numbers and is tapped from the
dashboard (its nav item is the books medium's). `/books` measured 17.7 KB
of document + RSC, 166.0 KB of JS and 34 requests on PR #206's preview
(median of three; accessibility 100, CLS 0.002), so its budget is that plus
about 5%: 19,000 bytes and 36 requests, with JS at `/books/status`' 175,000
(its client parts: the shelf's pager, On deck's **Plan**, the finish and
start verbs). Its queries are
one wave: `planCapacity` takes the page's settings read, so a year with
nothing planned costs no second round trip. Task 2.2d took it from 9 to 10:
*Or keep going* reads `follow_next` beside the rest, leaving out the
quarter's offer by `quarterShelf`'s own rule rather than waiting for it,
and Now's *Next in* is part of `booksInHand`'s read, not a query of its own.
Task 1.17b (PR #222, D-131) put the book status control on Now and on the
status screens, and made it ask the dates: *Reading* opens *Started*, *Read*
opens *Started* and *Finished* together. Its client code (the two pickers, the
refusal reasons, the start re-date) ships with every Library row and with
Now. PR #222's preview measured `/books` at 175,918 bytes of JS and
`/books/list` at 171,581 bytes and 65 requests (median of three). Making the
read list a lazy chunk saved under 250 bytes and added the one request, so
the budgets were raised to `/books` 177,000, `/books/list` 173,000 and 65
requests, each the measured number plus under 1%. This is a stopgap, not a
new floor: a roadmap item (1.30) brings the two routes back under their
old budgets.
Task 2.3's picker sheet (PR #224) put *Year or quarter…* on Add books and
on each search result. With the picker itself loaded only when it opens, as
the Library row's *Plan for…* loads it, the preview measured `/books` at
177,149 bytes of JS (median of three), so the owner raised `/books` to
177,200 (2026-11-10), the same kind of stopgap with 1.30's target
unchanged. For 1.30: `AddBooksButton` imports `AddBooks` statically, so
every page with an Add button ships Search, *Paste a list* and *By hand*
before the sheet opens; loading it with the sheet is the likeliest large
saving.
PR #232 (D-144) made an open sheet lift its buttons clear of the undo
toast, which needs the toast's height measured in the always-loaded undo
provider. Its preview measured `/books` at 177,359, `/books/list` at 173,068
and `/books/status` at 175,045 bytes of JS (median of three), so the owner
raised them to 177,400, 173,100 and 175,100 (2026-11-10): the same stopgap,
1.30's targets unchanged.
PR #233 (a CI-only change: no app code) then measured `/books` at 177,416
and `/books/list` at 173,118 bytes of JS, 57 and 50 bytes above #232's
preview of the same app code, and `/books/status` at about 175,000: build
to build noise, with no headroom left to absorb it. The owner raised all
three by 300 bytes, to 177,700, 173,400 and 175,400 (2026-11-10), the same
stopgap with 1.30's targets unchanged; 0.13 (D-142) replaces this kind of
ceiling with a gate on what each PR adds.
Task 1.30 put `/books` back to 175,000 and `/books/list` to 170,000 bytes
and 64 requests (the old budgets). Measured first: main's last run (PR
#216) had `/books` at 177,069 bytes of JS and `/books/list` at 172,836 and
65 requests, and a source-mapped build showed that one chunk all three
books routes loaded, 9.4 KB of brotli, was Add books' whole tree (Search,
*Paste a list*, *By hand*), shipped with every Add books button before
anyone opened it. `AddBooksButton` now loads it with the sheet
(`next/dynamic`, which draws the sheet's skeleton meanwhile), and
`test/lazy-imports.test.ts` fails if a static import brings it back. A local
build took about 10.5 KB of brotli and one script off each books route; the
status control (`BookStatus`, `FinishDate`, about 3.5 KB) stayed as it was.
PR #236's preview measured `/books` at 165,095 bytes of JS and 35
requests and `/books/list` at 161,143 bytes and 64 (median of three), so
the old budgets hold with room to spare.
`/books/status` shrank by as much, and keeps its 175,400 until 0.13
re-bases the ceilings.
Task 4.5 (PR #252, D-149) drew the Library's genre chips from the data,
about forty top-level genres instead of ten fixed ones, and named each
row's subgenre (*Epic Fantasy*) on nearly every one of its 500 rows.
Recent previews had `/books/list` at about 67.2 KB of document + RSC;
PR #252's measured 70,249 bytes (median of three), and leaving out the
unselected chips' `aria-current="false"` saved only 65 of them under
compression. The owner raised it to that median plus about 5%, 74,000
(2026-11-13).
Task 3.5 (TASK-079, PR #275, D-157) made each Library row's title a link
to its book's sheet, and added the detail-sheet slot (`@modal`) that every
route's payload now carries. With a `<Link>` per row `/books/list`
measured 76,775 bytes; a plain `<a>` opened by one wrapper
(`SheetLinks`) saved only 313 of them, since the cost is each row's
`/book/{id}`, so it measured 76,462. `/settings`, the route with the least
room, went from about 15,700 to 16,077 with the slot. The owner chose to
trim, remeasure and raise only what was still over (2026-11-16): both to
that median plus about 5%, `/books/list` 80,000 and `/settings` 16,800.
