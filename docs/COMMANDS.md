# Commands

Every project command, moved out of `CLAUDE.md` so it doesn't load into every
session. `CLAUDE.md` keeps the everyday ones. `.claude/kit.json` is the single
source of truth for the kit's verification commands (`verify.fast` runs after
every edit, `verify.full` is what the test-runner agent runs); keep it in sync
with this list. Its commands run under `cmd.exe /c` because the hooks run them
that way.

```powershell
npm run dev                 # local, needs .env
npm run clean:dev           # delete .next/dev (next dev's output and Turbopack cache) with `npm run dev` stopped:
                            # a stale one reloads a page in a Fast Refresh loop. test:e2e clears it before every dev run
npm test                    # vitest; needs TEST_DATABASE_URL (never DATABASE_URL), refuses without it
npm run test:all            # test:no-e2e, then test:e2e:build: everything, by hand; no gate needs it (D-141)
npm run test:no-e2e         # test:tokens + check:migrations + test:db:reset + vitest + test:views + test:etl:
                            # verify.full's suites, which re-run after every fix (D-141: the browser suite is CI's)
node scripts/test-files.mjs <files> [-- <playwright args>]
                            # the given test files, any runner; specs in one project (w390-light) unless the args
                            # name a --project. /verify runs the specs a branch touched this way; the test-auditor too
npm run test:db:reset       # rebuild the TEST database: drizzle-kit migrate, then etl/views.sql
node scripts/worktree-slot.mjs  # worktree setup runs it: this worktree's own test database and e2e port
                            # in .env.worktree (ledger_test_2 / 3200, ...), loaded before .env; no-op in the main checkout
npm run lint                # eslint, zero warnings
npx tsc --noEmit            # typecheck
node scripts/tsc-brief.mjs  # the same typecheck, first 10 errors only (the post-edit hook's verify.fast)
npm run db:generate         # after editing src/db/schema.ts
npm run db:push             # apply schema.ts to DATABASE_URL with no migration — pre-cutover only, by hand
npm run db:views            # re-apply etl/views.sql to DATABASE_URL (node, not psql); rebuild and Release do it for you
npm run extract             # etl/extract.py with every sidecar CSV (see below); clears seed/ first;
                            # add --with-plan to also load the workbook's To-Read tabs (off by default);
                            # --book-review etl/data/book_review.csv proposes book, author and series
                            # pairs that may be one (merge / separate / blank), applies only `merge`,
                            # and prints `N book pairs await review`. Workbook reads aren't loaded (D-41):
                            # seed/workbook_reads.csv lists them for hand entry. A To-Read tab for 2028
                            # or later loads nothing either; seed/workbook_plans.csv lists its titles.
                            # Nor does a placeholder title (Untitled, TBA, TBD) where a book
                            # would load: seed/workbook_placeholders.csv lists each one.
                            # --calibre-books folds in npm run calibre's sidecar: Calibre's reads are
                            # seed/read_events.csv, and seed/calibre_created.csv (not loaded) lists the
                            # books only Calibre has. Calibre's superseries are the universes (the
                            # workbook's universe tabs only follow), its subseries are book_subseries,
                            # and each book takes its Calibre id (1.18b, D-90). Its #pages fills a page
                            # count Hardcover gives none (1.14c, D-130).
                            # --calibre-missing etl/data/calibre_missing.csv lists each workbook book
                            # Calibre doesn't have: `keep` it, or add it to Calibre (prints the undecided).
                            # --book-hold etl/data/book_hold.csv holds each workbook book Hardcover doesn't
                            # know (no hardcover or hand row in book_details.csv) and Calibre doesn't have:
                            # no book, status, plan or release row until you `keep` it or enrich:books finds
                            # it; prints `N books held for review` (1.20). seed/held_books.csv (not loaded)
                            # lists them for enrich:books and calibre, which still look them up.
                            # --wishlist-review etl/data/wishlist_review.csv settles the old To-Read tab
                            # (1.27, D-111): a line naming a book by title and author is that book (an
                            # Unlisted or statusless one loads at Someday); every other line is a row to
                            # decide, `create`, `link` (to `near`) or `drop`; prints the undecided.
                            # Every prerequisite loop is a `prereqs,prereq cycle` row in unresolved.csv
                            # and a console count (2.11a); `-- --fail-on-cycle` exits non-zero on any,
                            # after writing every CSV (Step 14's final extract)
py etl/enrich_comics.py     # Metron: dates, cover URLs, label proposals (--dry-run first)
py etl/enrich_comics.py --details  # Metron: story titles + credits, ~8,100 requests (--dry-run first)
npm run enrich:refresh      # --details --refresh: re-ask Metron about issues it credited nobody on (cache never expires)
npm run enrich:books        # etl/enrich_books.py: Hardcover id, page counts, cover URL and release year per
                            # book into etl/data/book_details.csv (task 1.14b, D-94; Open Library's was 1.14),
                            # found by the book's Calibre ISBN (many to a request), else one title-and-author
                            # search. Needs HARDCOVER_API_TOKEN in .env. A near spelling goes to
                            # book_review.csv as `hardcover`; a book two Hardcover books match goes to
                            # etl/data/hardcover_review.csv, one row per candidate: write `pick` on one and
                            # re-run. A compilation never matches. `-- --dry-run` first (100 books, writes
                            # nothing); `-- --offline` runs from etl/.hardcover-cache.sqlite alone and still
                            # rewrites the sidecars (not a dry run)
npm run calibre             # etl/calibre.py (task 1.18): the Calibre library (CALIBRE_LIBRARY in .env, or
                            # `-- --library <folder>`) into etl/data/calibre_books.csv, read from a temp copy
                            # of metadata.db (never written). Calibre is the source of truth (D-87): its word
                            # counts, series and reads load over the workbook's, and the books only Calibre
                            # has come in at Unlisted. A near spelling goes to book_review.csv as `calibre`
                            # (the one decision). Each run prints what changed in Calibre since the last;
                            # extract lists what Calibre overrode (a word count, series or type; a
                            # Hardcover series that differs) in seed/calibre_changes.csv, nothing to do (D-93),
                            # and what needs you (a held book, a read not loaded) in unresolved.csv.
                            # #superseries, #subseries and #pages are read too, by lookup name
                            # (--superseries-column, --subseries-column, --pages-column); a book renamed
                            # in Calibre stays one book, matched on its Calibre id (1.18b). #genre too
                            # (--genre-column): every value, as seed/book_genres.csv (1.18c).
                            # `-- --dry-run` first (the match rate and the changes, writes nothing);
                            # the series check asks Hardcover (by ISBN first, the cache shared with
                            # enrich:books; 1.14b), and `-- --offline`, or no HARDCOVER_API_TOKEN, asks it
                            # nothing new. Re-run after any library change,
                            # in this order: extract, calibre, extract, enrich:books, extract (the created
                            # books get their Hardcover details like any other)
npm run sidecars            # etl/check_sidecars.py: validate the issue sidecars, write etl/data/metadata_todo.md
                            # and etl/data/creator_review.csv (close creator names to accept or reject);
                            # an issue fandom_skipped.csv says has a blank Fandom title isn't listed as
                            # missing one (--keep-fandom-untitled lists them); checks book_review.csv's
                            # columns, decisions and merge keeps first, with or without seed/
npm run sidecars:fix        # same, and apply the safe fixes (shifted columns, role spellings, label keys, creator ids)
npm run sidecars:prune-orphans  # same, plus archive-then-remove sidecar rows for labels gone from the workbook
npm run check:role-outliers # etl/check_role_outliers.py: flag Metron credits whose role looks mistagged (report only)
npm run titles:fandom       # etl/fandom_titles.py: fill missing story titles from Marvel Fandom as `hand` (--dry-run first);
                            # writes fandom_skipped.csv (what it couldn't, and why); reads hand-kept
                            # fandom_pages.csv (series -> `Name Vol N`, label -> `Name Vol N issue`)
.\etl\load.ps1              # PowerShell loader; etl/load.sh is the WSL/Git Bash twin
npm run rebuild             # drop, migrate from zero, extract, load, test_views, row counts;
                            # .env (development) by default, `-- -EnvFile .env.live` is production
                            # etl/rebuild.ps1; refuses when LEDGER_LIVE=true; twin etl/rebuild.sh
npm run extract:comics      # extract --comics-only (task 1.29, D-128): Comics.xlsx and the comics sidecars into
                            # the comics seed files of seed/ (COMICS_SEED), its report in comics_unresolved.csv;
                            # every books file in seed/ stays as it was. No books flag with it
npm run load:comics         # etl/load-comics.ps1 (twin: npm run load:comics:bash, etl/load-comics.sh): replace
                            # the comics catalog and comics progress from seed/, books untouched, in one
                            # transaction with no CASCADE; asks you to type COMICS (`-- -Yes` skips it).
                            # Runs while LEDGER_LIVE=true; refuses when LEDGER_COMICS_LIVE=true.
                            # .env by default; see "Comics only" below
npm run test:views          # etl/test_views.sql against TEST_DATABASE_URL; rolls back
npm run test:etl            # py -m unittest over etl/test_*.py, no network
npm run test:e2e            # the browser suite (task 0.11): Playwright + axe in Chromium, the core projects (D-80:
                            # w390 light and dark, w768, w1280, reduced motion, touch), against `next dev` on
                            # TEST_DATABASE_URL (port 3199, or a worktree's E2E_PORT; passcode `e2e-passcode`); refuses without it. Stop
                            # `npm run dev` first (both use .next; a dev run deletes .next/dev before it starts). Once per machine, and after a Playwright bump:
                            # `npx playwright install chromium`. Screenshots: test-results/screens/ (ignored). Pass
                            # arguments after --, e.g. `-- --project=w390-light`. A check that needs one project is
                            # tagged `{ tag: "@at-<project>" }`, never skipped on testInfo.project.name. E2E_SERVER=start
                            # serves an existing `npm run build` with `next start` instead (CI's shards do)
npm run test:e2e:full       # the same at every project, 360-1280px light and dark (E2E_SCOPE=full): what CI runs
npm run test:e2e:build      # `next build` with the suite's server environment, then the core projects against
                            # `next start` over that build (--build, D-97): no route compiles on its first
                            # request, and never a stale build. test:all's browser step; arguments after --.
                            # Reproduces a CI failure against a build: `-- <spec> --project=<p> -g "<fragment>"`
npm run test:tokens         # colour tokens: mockups = globals.css, hue distance, on-fill contrast; no DB
npm run check:migrations    # journal = files, drop/retype has a drizzle/down file, schema.ts fully generated,
                            # no migration already on main edited (standing rule 3); no DB
```

To print one part of a large doc without reading all of it:

```powershell
powershell -NoProfile -File scripts/task.ps1 <id>        # one task from docs/05-roadmap.md
powershell -NoProfile -File scripts/screen.ps1 <data-id> # one screen from design/mockups.html
```

## Refreshing the data

Every step from your workbooks and Calibre to a loaded **development**
database, in order, with what to review after each. Run it after a fresh
workbook export, after changing Calibre, or once a month for Metron's new
credits. It ends at development: production's last load is Step 14's
(`docs/START-HERE.md`), and nothing here is aimed at it.

### Before you start

- Fresh exports saved over `etl/data/Comics.xlsx` and `etl/data/Books.xlsx`
  (`docs/START-HERE.md` Step 5).
- `.env` holds `DATABASE_URL` (development), `METRON_USERNAME` and
  `METRON_PASSWORD` (or `METRON_API_TOKEN`), `HARDCOVER_API_TOKEN` and
  `CALIBRE_LIBRARY` (`docs/SERVICES.md`).
- Close every sidecar you have open in Excel; save edits as **CSV UTF-8**.
- Work on a branch: the sidecars you change get committed at the end.

### The traps

- **`--offline` is not a dry run.** It asks the API nothing new, but still
  rewrites the sidecars from the cache. Only `--dry-run` writes nothing.
- **`rebuild` and `load` truncate and reload** every progress table, and through
  `CASCADE` everything that references a run, issue or book. `npm run rebuild`
  asks you to type `REBUILD`; `.\etl\load.ps1` does **not** ask. Both refuse
  once the env file says `LEDGER_LIVE=true`.
- **`.env` is development, never production.** Never add `-EnvFile .env.live`
  or `ENV_FILE=.env.live` to anything here.
- **Commit the sidecars in `etl/data/`**, never `seed/`, `etl/.*-cache.sqlite`
  or `etl/.fandom-cache.json` (`.claude/rules/git.md` § Staging).
- **A hand row is never overwritten.** A cover date, story title or book detail
  whose `source` isn't the script's own, and every credit of a `(label, role)`
  with any `hand` credit, are left alone. An accepted label rename moves hand
  rows to the new label; it doesn't change them.

### Comics

**1. Extract.** Clears `seed/` and writes it from the workbooks and every
sidecar. The enrich scripts read their labels from `seed/issues.csv`.

```powershell
npm run extract
```

Review `seed/unresolved.csv` (START-HERE 8b says what each category means).
A prerequisite cycle is a `prereqs,prereq cycle` row.

**2. Metron: dates, cover URLs and label proposals.** The dry run checks 50
labels and writes nothing. The real run writes `cover_dates.csv`,
`issue_details.csv` (Metron id, cover URL) and `label_review.csv`. 20 requests a
minute, 5,000 a day: 2–3 hours the first time, seconds after. Cached in
`etl/.metron-cache.sqlite`: stop and re-run freely.

```powershell
npm run enrich -- --dry-run
npm run enrich
```

Review `label_review.csv` and `cover_dates.csv` (table below).

**3. Apply the label decisions.** The enrich run moves every sidecar row to the
labels you accepted, hand rows included, and dates the new ones (cached; one
search per newly named series). Extract then merges the renamed issues.

```powershell
npm run enrich
npm run extract
```

**4. Metron: story titles and credits.** One request per matched issue: about
8,100 the first time (~7 hours over two days, past the 5,000-a-day quota; it
stops cleanly, run the same command the next day), then only new issues. Fills
`story_title` in `issue_details.csv` and writes `issue_credits.csv`. The dry run
reads 50 issues and prints how many requests remain.

```powershell
npm run enrich:details -- --dry-run
npm run enrich:details
```

**5. Re-ask about uncredited issues** (monthly). The cache never expires, so an
issue Metron hadn't credited stays uncredited until this re-requests it. Skips
pages fetched in the last week, so a run the quota cut short resumes.
`-- titles` does the same for missing story titles (~1,300 requests).

```powershell
npm run enrich:refresh
```

**6. Extract**, so the checks below see the current labels.

```powershell
npm run extract
```

**7. Check the sidecars.** Report first, then apply the safe fixes it listed
(shifted columns, role spellings, label keys, creator ids). Writes
`etl/data/metadata_todo.md` and `etl/data/creator_review.csv`; `--fix` also
rewrites the issue sidecars. If it promoted rows to `matched`, fetch their
credits (one request each).

```powershell
npm run sidecars
npm run sidecars:fix
npm run enrich:details               # only if sidecars:fix promoted rows to matched
npm run sidecars:prune-orphans       # optional: archives to pruned_orphans.csv, then removes
npm run check:role-outliers          # optional: report only, writes nothing
```

Review `creator_review.csv` and `metadata_todo.md`.

**8. Story titles from Marvel Fandom.** Fills missing titles as `hand` in
`issue_details.csv` and logs them in `fandom_titles.csv`. Every run, the dry
run included, rewrites `fandom_skipped.csv`. Cached in
`etl/.fandom-cache.json`, so a re-run asks only about what it hasn't seen.

```powershell
npm run titles:fandom -- --dry-run
npm run titles:fandom
npm run sidecars                     # refresh metadata_todo.md
```

Review `fandom_skipped.csv`.

**9. Whys.** Nothing in the pipeline writes `why_review.csv`; decide its rows
whenever you like. The next extract loads them.

### Books

The order is **extract, calibre, extract, enrich:books, extract**. Calibre
matches its books against `seed/books.csv`, so it needs a current extract. The
books only Calibre has exist only after the extract that follows it, and
`enrich:books` reads `seed/books.csv` too: without that second extract it never
sees them. The last extract folds the details in. If step 6 ran after your
last workbook change, it counts as the first extract.

Every extract also holds back a workbook book that Hardcover doesn't know (no
`hardcover` or `hand` row in `book_details.csv`) and Calibre doesn't have: it
is no book until you look at it, and `etl/data/book_hold.csv` lists it (task
1.20). Calibre and `enrich:books` read `seed/held_books.csv` beside
`seed/books.csv`, so a held book is still matched and looked up, and the
extract after the run that finds it loads it.

**10. Extract** (skip if step 6 is current).

```powershell
npm run extract
```

**11. Calibre.** Reads a temp copy of the library (never the library itself).
The dry run prints the match rate and what changed in Calibre, writes nothing
and asks Hardcover nothing. The real run writes `calibre_books.csv` and appends
`calibre` and `calibre rename` rows to `book_review.csv`, and asks Hardcover
about each series: ISBNs many to a request, then one search for a book none
found (60 a minute, 5,000 a day; stops at 3,000 requests, `--max-requests`).
Shared cache `etl/.hardcover-cache.sqlite`: a re-run asks nothing twice, and a
run over an unchanged library changes no byte. Without `HARDCOVER_API_TOKEN`
it checks series from the cache only.

```powershell
npm run calibre -- --dry-run
npm run calibre
```

**12. Extract.** Creates the Calibre-only books at Unlisted
(`seed/calibre_created.csv`, not loaded), loads Calibre's reads, and writes
`seed/calibre_changes.csv`, `etl/data/calibre_missing.csv` and
`etl/data/book_hold.csv` (a held book is in `book_hold.csv`, never in
`calibre_missing.csv`). Every extract also rewrites
`etl/data/wishlist_review.csv`, the old To-Read tab's lines that name no book
(1.27, D-111).

```powershell
npm run extract
```

Review `book_review.csv` (`calibre` rows), `calibre_missing.csv`,
`seed/calibre_changes.csv` and `seed/unresolved.csv`. Leave `book_hold.csv`
and `wishlist_review.csv` until step 14: the next step may find held books,
and which lines name a book, and what each row's `near` is, can change until
then.

**13. Hardcover details.** The dry run looks up 100 books and writes nothing.
The real run writes `book_details.csv` (Hardcover id, page count, cover URL,
release year), appends `hardcover` rows to `book_review.csv` and writes
`hardcover_review.csv`. About one request a second: a few dozen ISBN requests,
then one search per book with no ISBN (5,000 a day; stops at 3,000,
`--max-requests`), the held books (`seed/held_books.csv`) included. Cached and
resumable; a run that stops early keeps the rows of the books it didn't reach.

```powershell
npm run enrich:books -- --dry-run
npm run enrich:books
```

Review `book_review.csv` (`hardcover` rows) and `hardcover_review.csv`.

**14. Extract**, folding the details into the books. A held book Hardcover
found loads now and leaves `book_hold.csv`.

```powershell
npm run extract
```

Review `book_hold.csv`: write `keep` on each book you want loaded anyway (it
prints `N books held for review`), and extract again. A held book you'd rather
match: fix its title or author in the workbook, or `merge` its
`book_review.csv` row, then `enrich:books` and extract.

Then decide `wishlist_review.csv`, once the holds are settled: `create`, `link`
(the line is the `near` book) or `drop` on each row. Filter on `reason` and
fill `decision` down to decide a group at once. Extract again, and repeat
until it prints `0 undecided`. Cutover waits on that (1.26).

### What to review, and what to re-run after

Blank is always undecided. Re-run the listed commands after you save.

| File | Written by | Your decision | Then |
| --- | --- | --- | --- |
| `etl/data/book_review.csv` | extract, calibre, enrich:books | `merge` applies the pair (`keep` names the spelling or author that survives); `separate` keeps two. Reasons below | extract; after a `hardcover` merge, enrich:books (moves its details row) and extract. `npm run sidecars` checks the file |
| `etl/data/hardcover_review.csv` | enrich:books | `pick` on the one right candidate for each book | enrich:books, extract |
| `etl/data/calibre_missing.csv` | extract | `keep` keeps the book out of Calibre for good; or add it to Calibre | after adding: calibre, extract |
| `etl/data/book_hold.csv` | extract | `keep` loads a book Hardcover doesn't know and Calibre doesn't have; blank holds it (no book, status, plan or release row). It leaves the file once Hardcover or Calibre has it | extract; after a workbook fix or a `merge`: enrich:books, extract |
| `etl/data/wishlist_review.csv` | extract | Each old To-Read line that names no book: `create` makes the row's `title` and `author` (edit them first if the line is off) at Someday; `link` says the line is the `near` book (`Title - Author`; edit it to point at another), which goes to Someday if it was Unlisted or had no status; `drop` loads nothing. `reason` says why it is here: `similar`, `series`, `no author` or `new`. Filter on `reason` and fill a column down to decide a group at once. Cutover waits until none is blank (1.27, D-111) | extract |
| `seed/calibre_changes.csv` | extract | Nothing: Calibre won. Where Calibre is wrong, fix it in Calibre | calibre, extract |
| `seed/unresolved.csv` | extract | Only what needs you; START-HERE 8b lists each category | extract, after the fix |
| `etl/data/label_review.csv` | enrich | `accept` renames to Metron's label; `reject` or blank keeps yours | enrich (moves the rows), extract |
| `etl/data/why_review.csv` | nobody (drafted once) | `accept` loads `proposed_why` as `claude`; `edit` loads your `final_why` as `hand`; `keep` or blank the workbook's, as `hand` | extract |
| `etl/data/creator_review.csv` | sidecars | `accept` (or `yes`) makes the name an alias of that Metron creator; `reject` (`no`) is never proposed again | sidecars:fix, extract |
| `etl/data/cover_dates.csv` | enrich | Rows with a blank date say why in `status`: fix the label or `volume_map.csv`, or type `cover_date` with `source` = `hand` | a label fix: extract, enrich, extract; a hand date: sidecars, extract |
| `etl/data/metadata_todo.md` | sidecars | Fill the gaps it lists as `hand` rows in `cover_dates.csv`, `issue_details.csv` or `issue_credits.csv`; tick what you looked for and couldn't find | sidecars, extract |
| `etl/data/fandom_skipped.csv` | titles:fandom | Answer in `fandom_pages.csv`: `match` (the `series` or `label` cell), `fandom` (a volume, an issue page, its URL, or `none`) | titles:fandom (dry run first), sidecars, extract |

`book_review.csv`'s reasons:

| `reason` | The pair | `merge` | `separate` |
| --- | --- | --- | --- |
| `same title` | One title under two authors | One book, under the author in `keep` | Two books |
| `similar` | Two workbook spellings of a book, author or series | One, spelled as `keep` | Two |
| `calibre` | Your spelling (`a`) and Calibre's (`b`), held until decided | Your book takes Calibre's spelling (`keep` is filled in) | Calibre's becomes its own book |
| `calibre rename` | A book you renamed in Calibre; written already decided `merge` | Nothing to do: it stays one book under the new title | — |
| `hardcover` | Your spelling (`a`) and Hardcover's (`b`) | Your book takes Hardcover's spelling | Yours stays as typed |
| `open library` | 1.14's, before Hardcover: enrich:books drops the undecided ones | As `hardcover` | As `hardcover` |

### Load development, and commit

**15. Load.** `rebuild` drops the schema, migrates from zero, extracts again
(`-- -SkipExtract` reuses `seed/`), loads, runs `etl/test_views.sql` and prints
each table's row count beside its seed CSV. Type `REBUILD` when it asks. It
never calls Metron or Hardcover.

```powershell
npm run rebuild
```

`.\etl\load.ps1` reloads `seed/` into a schema that is already current, with
no prompt. Spot-check with START-HERE 8g's queries.

Then commit what changed in `etl/data/`, staged by path:

```powershell
git status --short etl/data
git add etl/data/<each changed sidecar>
```

## Comics only, after the books cutover

From the books cutover (START-HERE Step 14, roadmap 1.26) until the comics
cutover (Step 14b, 1.28), `Comics.xlsx` stays the comics record while the app
is the books record (D-128). `rebuild` and `load` refuse once
`LEDGER_LIVE=true`; these two bring the sheet's comics in and leave every book
alone (task 1.29).

**1. Extract the comics.** A fresh `Comics.xlsx` export saved over
`etl/data/Comics.xlsx`, and the comics sidecars refreshed as in *Comics*
above (steps 2–9: each `npm run extract` there becomes `npm run extract:comics`).

```powershell
npm run extract:comics
```

It rewrites only the comics seed files in `seed/`; `books.csv` and the rest of
the books seed, `unresolved.csv` and `calibre_changes.csv` are left exactly as
they were. Review `seed/comics_unresolved.csv`; `-- --fail-on-cycle` works
here too.

**2. Load the comics.** Replaces runs, tracks, blocks, prerequisites, events,
issues, placements, credits, editions, the volume map, `issue_progress` and
`edition_progress`, in one transaction; the queue and eras come back empty
(no seed holds them). It never truncates, cascades into or writes a books
table: `read_events` loses only its comic reads, and an inbox note resolved
into a run keeps its link while the run is still in the sheet. A mark made in
the app's comics screens is replaced: the sheet is the comics record until
Step 14b. Type `COMICS` when it asks. If any row fails, nothing changes.

```powershell
npm run load:comics                         # development (.env)
npm run load:comics -- -EnvFile .env.live   # production: you, never Claude
```

Bash: `bash etl/load-comics.sh [--yes] [seed-dir]`, with `ENV_FILE=` for the
env file. Once Step 14b sets `LEDGER_COMICS_LIVE=true` in `.env.live`, both
refuse against production and change nothing.
