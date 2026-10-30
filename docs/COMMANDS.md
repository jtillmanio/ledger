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
npm run test:all            # test:no-e2e, then test:e2e:build: what CI runs (verify.full; D-97)
npm run test:no-e2e         # test:tokens + check:migrations + test:db:reset + vitest + test:views + test:etl:
                            # the round chain's suites, which re-run after every fix (D-97)
npm run test:db:reset       # rebuild the TEST database: drizzle-kit migrate, then etl/views.sql
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
                            # its page counts win, and each book takes its Calibre id (1.18b, D-90).
                            # --calibre-missing etl/data/calibre_missing.csv lists each workbook book
                            # Calibre doesn't have: `keep` it, or add it to Calibre (prints the undecided).
                            # Every prerequisite loop is a `prereqs,prereq cycle` row in unresolved.csv
                            # and a console count (2.11a); `-- --fail-on-cycle` exits non-zero on any,
                            # after writing every CSV (Step 14's final extract)
py etl/enrich_comics.py     # Metron: dates, cover URLs, label proposals (--dry-run first)
py etl/enrich_comics.py --details  # Metron: story titles + credits, ~8,100 requests (--dry-run first)
npm run enrich:refresh      # --details --refresh: re-ask Metron about issues it credited nobody on (cache never expires)
npm run enrich:books        # etl/enrich_books.py: Hardcover id, page count, cover URL and release year per
                            # book into etl/data/book_details.csv (task 1.14b, D-94; Open Library's was 1.14),
                            # found by the book's Calibre ISBN (many to a request), else one title-and-author
                            # search. Needs HARDCOVER_API_TOKEN in .env. A near spelling goes to
                            # book_review.csv as `hardcover`; a book two Hardcover books match goes to
                            # etl/data/hardcover_review.csv, one row per candidate: write `pick` on one and
                            # re-run. A compilation never matches. `-- --dry-run` first (100 books, writes
                            # nothing); `-- --offline` reprints the report from etl/.hardcover-cache.sqlite
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
npm run test:views          # etl/test_views.sql against TEST_DATABASE_URL; rolls back
npm run test:etl            # py -m unittest over etl/test_*.py, no network
npm run test:e2e            # the browser suite (task 0.11): Playwright + axe in Chromium, the core projects (D-80:
                            # w390 light and dark, w768, w1280, reduced motion, touch), against `next dev` on
                            # TEST_DATABASE_URL (port 3199, passcode `e2e-passcode`); refuses without it. Stop
                            # `npm run dev` first (both use .next; a dev run deletes .next/dev before it starts). Once per machine, and after a Playwright bump:
                            # `npx playwright install chromium`. Screenshots: test-results/screens/ (ignored). Pass
                            # arguments after --, e.g. `-- --project=w390-light`. A check that needs one project is
                            # tagged `{ tag: "@at-<project>" }`, never skipped on testInfo.project.name. E2E_SERVER=start
                            # serves an existing `npm run build` with `next start` instead (CI's shards do)
npm run test:e2e:full       # the same at every project, 360-1280px light and dark (E2E_SCOPE=full): what CI runs
npm run test:e2e:build      # `next build` with the suite's server environment, then the core projects against
                            # `next start` over that build (--build, D-97): no route compiles on its first
                            # request, and never a stale build. test:all's browser step; arguments after --
npm run test:tokens         # colour tokens: mockups = globals.css, hue distance, on-fill contrast; no DB
npm run check:migrations    # journal = files, drop/retype has a drizzle/down file, schema.ts fully generated,
                            # no migration already on main edited (standing rule 3); no DB
```

To print one part of a large doc without reading all of it:

```powershell
powershell -NoProfile -File scripts/task.ps1 <id>        # one task from docs/05-roadmap.md
powershell -NoProfile -File scripts/screen.ps1 <data-id> # one screen from design/mockups.html
```
