# Start here

**This is the only document you read top to bottom.** It runs from unzipping
the project to using the app daily, in order, with every command.

Everything else is reference you open when this file sends you there:

| File                  | Open it when                                                                         |
| --------------------- | ------------------------------------------------------------------------------------ |
| `HANDOFF.md`          | Starting a new Claude conversation, or you forgot why a decision was made            |
| `CLAUDE-CODE.md`      | You're in Part 3 and want the technique — prompts, session hygiene, review standards |
| `05-roadmap.md`       | Every build session. One task at a time; `06-tasklist.md` for the order            |
| `01-product.md`       | Deciding scope                                                                       |
| `design/mockups.html` | Building any screen. Authoritative for layout and copy                               |
| `DIAGRAMS.md`         | You want the schema or data flow visually                                            |
| `03-data-model.md`    | You want the reasoning behind the schema (`02-architecture.md`: the system)          |

**No command appears in two documents.** If it's sequential, it's here.

---

## What you're signing up for

About 14 hours of your own time across roughly six weeks, most of it waiting on
Claude Code rather than typing. Ongoing cost: **$0/month**.

| Part                      | Steps | Your time                              | Elapsed   |
| ------------------------- | ----- | -------------------------------------- | --------- |
| **1. Setup**              | 1–4   | 1 hr 15 min                            | day 1     |
| **2. Migrate and deploy** | 5–10  | 2 hr 30 min                            | day 1–2   |
| **3. Build**              | 11–13 | ~12 hrs across 7 sittings              | weeks 1–8 |
| **4. Cut over**           | 14    | 1 hr, then a month of weekly checks    | weeks 8–12 |
| **5. Everything after**   | 15    | open-ended                             | ongoing   |

Steps 5 through 10 should happen close together — the migration is easier to
verify while the spreadsheet export is fresh.

---

# Part 1 — Setup

## Step 1 — Unzip the project

**~5 minutes**

1. Save `reading-tracker.zip` somewhere permanent. Not Downloads — this becomes
   a git repo you'll work in for months. `C:\dev\` or `%USERPROFILE%\projects\`
   are both fine.
2. Right-click → **Extract All**. You get a `reading-tracker` folder.
3. Open PowerShell and move into it:

```powershell
cd C:\dev\reading-tracker
dir
```

Note: the root directory name was changed from `reading-tracker` to `ledger`.

### Verify

You should see nine markdown files, plus `src/`, `etl/`, `design/`,
`.github/`, `.claude/`, `package.json`, `.env.example`.

```powershell
Test-Path etl/extract.py, src/db/schema.ts, design/mockups.html, etl/data/volume_map.csv
```

Four `True` values.

**If `.claude` and `.github` are missing:** Windows Explorer hides
dot-directories in some configurations. Check with `dir -Force`. If they really
are absent, re-extract with 7-Zip rather than the built-in extractor.

---

## Step 2 — Install the tools

**~30 minutes, mostly waiting**

Run everything in **PowerShell**, not CMD. Your prompt shows `PS C:\>` in
PowerShell.

```powershell
winget install OpenJS.NodeJS.LTS
winget install Python.Python.3.12
winget install PostgreSQL.PostgreSQL.18
winget install Git.Git
winget install GitHub.cli
```

The PostgreSQL installer asks for a superuser password. You will never use it —
this is only for the `psql` client — but write it down anyway.

**Close and reopen PowerShell**, then:

```powershell
py -m pip install pandas openpyxl
```

### Install Claude Code

```powershell
irm https://claude.ai/install.ps1 | iex
```

Close and reopen the terminal again. Claude Code runs natively on Windows; WSL
is not required. Having Git for Windows installed (above) gives it the Bash
tool via Git Bash, which this repo's `.sh` scripts want.

### Verify

```powershell
node -v          # v22.x is what CI and Vercel run (.nvmrc, package.json engines); a newer local Node works, npm just warns EBADENGINE
py -V            # Python 3.12.x
psql --version   # psql (PostgreSQL) 18.x — Neon's major; an older client works for psql, not for pg_dump
git --version    # git version 2.x
gh --version     # gh version 2.x
claude --version
py -c "import pandas, openpyxl; print('ok')"
```

All seven must succeed.

**If `psql` is not found**, the installer put it outside PATH:

```powershell
$env:Path += ";C:\Program Files\PostgreSQL\18\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")
```

Reopen PowerShell and re-check.

### Three Windows details that will otherwise cost you an hour

1. **Use `py`, not `python`.** On Windows, `python` sometimes resolves to a
   Microsoft Store stub that exits silently with no error.
2. **psql's `\copy` needs forward slashes** in paths, even on Windows.
   `etl/load.ps1` handles this; remember it if you write your own SQL.
3. **Use Windows Terminal**, not the legacy console host. It renders the Claude
   Code TUI properly; the old host mangles it.

### Set your editor

```powershell
$env:EDITOR = "code --wait"     # or notepad
[Environment]::SetEnvironmentVariable("EDITOR", "code --wait", "User")
```

This matters in Part 3 — `Ctrl+G` opens a Claude Code plan in your editor so you
can edit it before approving.

### Create three free accounts

[github.com](https://github.com) · [neon.com](https://neon.com) ·
[vercel.com](https://vercel.com). No card required for any of them. Doing this
now makes steps 6 and 10 faster.

---

## Step 3 — Review the plan

**~45 minutes · the cheapest correction point in the project**

Changing a task description costs nothing. Changing shipped code costs a
sitting. Changing a schema decision after data accumulates costs a migration.

1. Read `docs/01-product.md` end to end: the brief, the feature index and its
   rationale, and § Metrics. `docs/03-data-model.md` § 4 is the schema still
   proposed.
2. Open `design/mockups.html` in a browser — double-click it, no server needed.
   Click through all 40 screens in the left nav. Toggle **Phone/Desktop** and
   **Light/Dark** on at least the run detail and books dashboard.
3. Skim `docs/06-tasklist.md` for ordering. You don't need every acceptance check, but
   confirm the phase order matches your priorities.

### Decisions

All settled 2026-09-20 (`docs/review/decisions.md`), matching HANDOFF §8: pace in words everywhere; ranking-only ratings; finished eras collapsed with a count on runs over 100 issues; top-books capped at 10; franchises ordered by release; the run list with no track filter is grouped track → block; "watched recently" sits on the watch screen.

**Done when:** you've noted your corrections, or confirmed the plan as it
stands.

---

## Step 4 — Confirm the volume map

**~15 minutes**

`volume_map.csv` is already reviewed and complete — **67 approved rules across
61 series**, zero unmatched labels. This step is a sanity check, not work.

Open it in Excel or a text editor. If you edit it in Excel, **save as CSV
UTF-8**, not the default `CSV (Comma delimited)`, or the em dashes in the notes
column come back mangled.

### What the columns do

| Column                    | Meaning                                                                          |
| ------------------------- | -------------------------------------------------------------------------------- |
| `series`                  | The title as written in your sheet, no year, no issue number                     |
| `run_id`                  | Optional. Scopes the rule to one run — how Black Cat's two volumes are separated |
| `issue_from` / `issue_to` | Optional. Scopes by issue number — how Incredible Hulk splits at #102            |
| `proposed_year`           | The volume year to insert                                                        |
| `approved`                | `yes` applies it. Anything else is ignored                                       |
| `confidence`              | `high` / `suggested` / `review` / `low` / `resolved`                             |
| `note`                    | The evidence, usually drawn from your own run assignments                        |

Rules match most-specific-first: run + range, then run, then range, then
series-wide.

**Done when:** you've confirmed nothing looks wrong. The 533 `low` rows are
series never written with a year anywhere — almost all genuinely single-volume,
and correctly left alone.

---

# Part 2 — Migrate and deploy

## Step 5 — Export the workbooks

**~5 minutes**

1. Open the Comics sheet in Google Sheets.
2. **File → Download → Microsoft Excel (.xlsx)**.
3. Same for the Books sheet.
4. Move both into the repo root and rename them exactly:

```powershell
cd C:\dev\reading-tracker
# after moving the downloads here:
Move-Item "Comics (4).xlsx" etl\data\Comics.xlsx
Move-Item   "Books (1).xlsx"  etl\data\Books.xlsx
```

The export carries cached formula results, which is what the ETL reads. It never
evaluates a formula — which matters, because Excel can't run your Google-native
`QUERY()` and `ARRAYFORMULA()` calls.

### Verify

```powershell
py -c "import pandas as pd; x=pd.ExcelFile('etl/data/Comics.xlsx'); print(len(x.sheet_names),'tabs'); print(x.sheet_names)"
```

Expect **13 tabs** including `RUNS`, `PREREQS`, `Reading Orders`, `EVENTS`,
`TRACKS`, `Master`.

---

## Step 6 — Create the database

**~15 minutes**

1. Sign in at neon.com → **New Project**.
2. Name `reading`, Postgres 18 (CI's test container matches it), region **US East (Ohio)** — closest to you, and
   where Vercel's default functions run.
3. On the connection panel, copy the **pooled** string. It has `-pooler` in the
   hostname. The direct string works locally but exhausts connections under
   Vercel's serverless model.

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in:

| Key              | Value                                     |
| ---------------- | ----------------------------------------- |
| `DATABASE_URL`   | the pooled Neon string, in quotes         |
| `OWNER_ID`       | `justin`                                  |
| `OWNER_NAME`     | `Justin`                                  |
| `APP_PASSCODE`   | four or more random words — a passphrase, not a PIN (D-23; it is a Step 14 gate) |
| `SESSION_SECRET` | generated below                           |

```powershell
# generate SESSION_SECRET, paste the output into .env
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
```

### Verify

```powershell
$env:DATABASE_URL = (Select-String -Path .env -Pattern '^DATABASE_URL=(.*)$').Matches.Groups[1].Value.Trim('"')
psql $env:DATABASE_URL -c "select version()"
```

Expect `PostgreSQL 18.x on x86_64-pc-linux-gnu`.

| Symptom                          | Cause                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `could not translate host name`  | The string didn't copy fully. Neon's are long — check for a line break           |
| `password authentication failed` | You copied before Neon finished creating the role. Regenerate from the dashboard |
| Hangs ~10s then connects         | Normal. Free-tier compute suspends when idle and cold-starts                     |

**About the free tier:** permanent, no card, no expiry. Roughly 0.5 GB per
project against your ~14,000 rows — three orders of magnitude of headroom. Free
tiers move, so read any email Neon sends about plan changes.

---

## Step 7 — Create the tables

**~10 minutes**

```powershell
npm install
npx drizzle-kit generate
```

`generate` writes reviewable SQL into `drizzle/`. The four migrations are
already there (`0000`–`0004`), so it should report **no schema changes**. If it
asks a question or writes a new file, stop — `schema.ts` and `drizzle/` have
drifted. **Read `drizzle/0002_blocks_and_derived_run_span.sql` and
`drizzle/0003_issue_metadata.sql` before applying** — this is the only chance to
catch a schema mistake before it's applied.

- `0002` adds `blocks`, `issues.cover_date` / `cover_date_source` / `metron_id`
  and `runs.why_source`, and drops `runs.series_issues`, `start_year`,
  `end_year` and the old `runs.block`.
- `0004` adds date precision (`issue_progress.completed_at_precision`, `book_status.finished_on_precision`, `finished_on` retyped to `date`) and makes `run_issues` unique per (run, issue). It ships a hand-written reverse in `drizzle/down/`.
- `0003` makes `issues` one row per comic and moves each issue's place in a run
  to `run_issues`; adds `creators`, `issue_credits`, `issues.story_title` /
  `story_title_source` / `cover_url`; and drops `runs.writer` and `runs.artists`.
  It is hand-written (drizzle-kit would stop to ask whether dropped columns were
  renamed) and it carries data forward if a database already has rows.

```powershell
npx drizzle-kit migrate
```

`migrate` applies the exact SQL file you just reviewed. `push` recomputes its
own diff against the live database instead, so it can silently drift from what
you read — use `migrate` here.

### Verify

```powershell
psql $env:DATABASE_URL -c "\dt"
```

Expect **23 tables**: `users`, `tracks`, `blocks`, `runs`, `run_tracks`,
`issues`, `run_issues`, `creators`, `issue_credits`, `prereqs`, `events`,
`event_runs`, `editions`, `authors`, `book_series`, `books`, `releases`,
`wishlist`, `external_lists`, `issue_progress`, `edition_progress`,
`book_status`, `reading_plan`.

Task 0.3 adds 10 more, task 1.10 adds one and Phase 8 adds 6, so the finished schema is 40 tables.

`blocks`, the cover-date columns and `why_source` (task 0.6), and the issue
split, credits and story titles (task 0.7), were pulled forward out of task 0.3
— they change the shape of `runs` and `issues`, so they had to land before any
data loaded.

```powershell
psql $env:DATABASE_URL -c "\d issues"
psql $env:DATABASE_URL -c "\d run_issues"
psql $env:DATABASE_URL -c "\d runs"
```

Confirm `issues` has **no** `run_id` or `sequence`, a unique `label`, and both
`issues_cover_date_source_check` and `issues_story_title_source_check`; that
`run_issues` has foreign keys to `runs(id)` and `issues(id)`, both
`ON DELETE CASCADE`; and that `runs` has `why_source` and **no** `writer`,
`artists`, `series_issues`, `start_year` or `end_year`.

### Doing Steps 7–8 again

Until Step 14 the database is disposable — the workbooks are the truth. After
any change to the workbooks, a sidecar CSV or the schema, rebuild instead of
repeating these steps by hand:

```powershell
npm run rebuild            # asks you to type REBUILD
npm run rebuild -- -Yes    # no prompt
```

`etl/rebuild.ps1` drops the schema, runs `drizzle-kit migrate` from zero (so
every rebuild also proves the migrations apply), runs `npm run extract`
(`-SkipExtract` to reuse `seed/`), loads, runs `etl/test_views.sql`, and prints
each table's row count beside its seed CSV — any mismatch fails in red. It
never calls Metron. It refuses to run when `.env` has `LEDGER_LIVE=true`, which
you set in Step 14.

---

## Step 8 — Migrate the data

**~45 minutes of your time, plus two unattended Metron sessions · the step worth doing carefully**

### 8a. Extract

```powershell
npm run extract
```

Expected output, as of the 2026-09-16 export:

```
volume map: 61 series, 67 rules
cover dates: 8159 from Metron, 0 by hand
why review: 259 runs
label review: 0 renames accepted
issue details: 0 labels, story titles 0 from Metron, 0 by hand
issue credits: 0 credits on 0 labels

comics <- Comics.xlsx
  tracks                 37 rows -> seed/tracks.csv
  blocks                 98 rows -> seed/blocks.csv
  runs                  259 rows -> seed/runs.csv
  run_tracks            259 rows -> seed/run_tracks.csv
  issues              10273 rows -> seed/issues.csv
  run_issues          10840 rows -> seed/run_issues.csv
  creators                0 rows -> seed/creators.csv
  issue_credits           0 rows -> seed/issue_credits.csv
  workbook_run_fields    259 rows -> seed/workbook_run_fields.csv
  issue_progress         76 rows -> seed/issue_progress.csv
  prereqs               459 rows -> seed/prereqs.csv
  events                 30 rows -> seed/events.csv
  event_runs             64 rows -> seed/event_runs.csv
  editions              178 rows -> seed/editions.csv
  edition_progress      161 rows -> seed/edition_progress.csv

books <- Books.xlsx
  authors               376 rows -> seed/authors.csv
  book_series           214 rows -> seed/book_series.csv
  books                1478 rows -> seed/books.csv
  book_status          1289 rows -> seed/book_status.csv
  reading_plan          102 rows -> seed/reading_plan.csv
  releases               44 rows -> seed/releases.csv
  wishlist              497 rows -> seed/wishlist.csv
  external_lists        534 rows -> seed/external_lists.csv
  unresolved            104 rows -> seed/unresolved.csv
```

The three sidecar lines say `not found` until Step 8c creates those files.

`run_issues` is one row per line of `Reading Orders`, except that a label listed
twice in one run keeps only its first row (see `repeat placement dropped` below);
`issues` is one row per distinct label, so a crossover that sits in four runs is one issue with four
placements. The counts above are from an older export and move every time you edit the workbook
(the 2026-09-23 extract gave 10,761 placements, 10,138 issues, 258 runs; `reading_plan` is 0
since D-13). **If a count moved and you did not edit the sheet, stop** and diff
against your previous `seed/` before loading. `issues` is expected to drop as
you accept label fixes in 8c — two spellings of one comic merge into one row.

### 8b. Read `seed/unresolved.csv`

Counts are from the 2026-09-16 export. A `0` category is one the ETL still
checks for; it's listed so you know what a new row there means.

The file lists only rows that need you (D-93). The book rows are: `stale review` (a decided
`book_review.csv` row whose name has left the workbook: delete it once `enrich:books` has rekeyed),
`book_details: no such book` (a details row for a spelling that is gone: run `enrich:books`, or delete
it), `Series-tab book matches no book` and `group matches nothing` (fix the workbook or add a merge),
`calibre book held for review` (decide its `book_review.csv` row) and `calibre read for a book already
read` (that read is not loaded; log it by hand if it is a reread). What Calibre overrode is in
`seed/calibre_changes.csv`, with nothing to do.

| Rows | Category                                     | What it means                                                                                                                                                       | Action                                                                                                                                                                                                      |
| ---- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `sequence renumbered`                        | Your `Sequence` formula is `=IF($B2=$B1,F1+1,1)`, which restarts whenever a run's rows aren't contiguous. The ETL renumbers from row order — the real reading order | **Spot-check `hickman-avengers`, `bendis-initiative`, `bendis-secret-invasion` after load.** Those three are the only runs with split blocks                                                                |
| 44   | `one Metron issue under several labels`      | Two spellings of one comic (`Pulse #1` and `The Pulse #1`) matched the same Metron issue, so they load as two issues                                               | Accept the matching `label_review.csv` rows in 8c; they merge on the next extract                                                                                                                           |
| 13   | `repeat placement dropped`                   | The same label twice in one run. Extract keeps the first placement and drops the repeat (D-R2-1); the sheet had the same seven issues twice in a row, which looks like a block entered twice, not a reread. If a repeat is a real reread, note it and add it back at task 0.8 | **Fix the `Issue` cells in the sheet** if it was a mistake; otherwise nothing. `run_issues` is UNIQUE per (run, issue) until 0.8 |
| 12   | `labels share a slug`                        | Two labels differ only in punctuation (`All New, All-Different Avengers #0` / `All-New, All-Different Avengers #0`), so the second id gets `-2`                     | **Must be zero before Step 14 (D-15)** — the label is the comic's permanent id. Fix the spelling in the sheet (or accept a `name_style` proposal); if they are two different comics, give them different labels |
| 11   | `label reordered`                            | Labels like `Daredevil Annual #1 (2007)` put the year after the issue number. Reordered to canonical form                                                           | None. Informational                                                                                                                                                                                         |
| 1    | `completed in one run, not another`          | An issue ticked Completed in one run's row and not in another's. Progress belongs to the issue now, so it loads as read                                            | None, unless it wasn't actually read                                                                                                                                                                        |
| 0    | `event_runs not a known run`                 | `EVENTS!Runs Touched` holds a value that isn't a known run ID                                                                                                       | Fix the cells and re-extract, or accept the dropped associations                                                                                                                                            |
| 0    | `forward-declared prereq target`             | Prereq IDs with no `RUNS` row, loaded as placeholders so the edges survive                                                                                          | None. Expected                                                                                                                                                                                              |
| 0    | `duplicate block sequence`                   | Two runs claim the same position in the same block                                                                                                                  | **Fix the `Sequence` cells in the sheet and re-extract.** The ETL deliberately does not renumber them                                                                                                       |
| 0    | `run on multiple tracks`                     | A run on two tracks carries one block number; it is assigned to the first track listed                                                                             | Reorder the `Track` cell if the block belongs to the other track                                                                                                                                            |
| —    | `workbook writer not in credits`             | After 8c-4: the sheet's `Writer` names nobody in the run's issue credits. The sheet's value is not loaded — credits are                                              | Look at the run. Usually the sheet is wrong or the run holds another writer's tie-ins                                                                                                                       |
| —    | `keyed by pre-rename label`                  | A sidecar row still sits under a label you accepted a rename for. It was used anyway                                                                                | Re-run `py etl/enrich_comics.py` (it rekeys, cached), then re-extract                                                                                                                                       |
| —    | `stale label review`                         | An accepted rename whose old label no longer appears in the sheet — you fixed the sheet directly                                                                    | None, or blank the decision                                                                                                                                                                                 |
| —    | `sidecar row for a label not in the sheet`  | A `cover_dates` / `issue_details` / `issue_credits` row whose label no sheet row uses any more. Not loaded. If a comic with that label ever came back it would inherit the old value, so delete the row once the comic is gone for good (`(hand-entered)` marks one you typed) |

### 8c. Backfill from Metron

Everything Metron gives the ledger arrives as a CSV beside `etl/data/volume_map.csv` that
you can read, correct and re-run, and that survives every re-extract:

| File                | Keyed by | Holds                                                                  | Written by                              |
| ------------------- | -------- | ---------------------------------------------------------------------- | --------------------------------------- |
| `cover_dates.csv`   | label    | cover date, `source` (`metron` or `hand`), match status                | `py etl/enrich_comics.py`               |
| `issue_details.csv` | label    | Metron issue id, cover URL, story title + `story_title_source`         | both passes                             |
| `label_review.csv`  | label    | a proposed label, its category, and your `decision`                   | `py etl/enrich_comics.py`               |
| `issue_credits.csv` | label    | one row per creator per role, `source` (`metron` or `hand`)            | `py etl/enrich_comics.py --details`     |

All need `METRON_API_TOKEN`, or `METRON_USERNAME` and `METRON_PASSWORD`, in
`.env`. Every response is cached in `etl/.metron-cache.sqlite`, so **every
command here is safe to stop and re-run** — a re-run only pays for what it
hasn't fetched. Save CSVs as **CSV UTF-8** if you edit them in Excel.

#### 8c-1. Dates, cover URLs and label proposals

**~10 minutes of your time; 2–3 hours unattended the first time, seconds after**

```powershell
py etl/enrich_comics.py --dry-run
py etl/enrich_comics.py
```

The dry run checks fifty labels and writes nothing. Expect a match rate and a
request projection. A 401 means the credentials are wrong.

Then open `cover_dates.csv`. Rows with a blank `cover_date` have a `status` and a
`note` saying why:

| `status`                      | Meaning                                                                                                            | Action                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `matched`                     | Dated from Metron. A note starting "volume … inferred" means the label had no year and one volume was the only fit | Spot-check the inferred ones                                             |
| `ambiguous_volume`            | Several volumes fit a label with no year                                                                           | Add the year to the label or a `volume_map.csv` rule, re-extract, re-run |
| `no_series` / `not_in_series` | Metron has no series with that exact name, or not that issue                                                       | Fix the label, or enter the date by hand                                 |
| `no_number`                   | A freeform label ("Dark Reign: The Cabal") that isn't a one-shot Metron knows by that exact name                   | Enter the date by hand                                                   |

About 2,100 labels don't match. They get no date, story title or credits until
their label is fixed. Eleven runs have **no** matched issues at all —
`bendis-doomsday`, `captain-america-white`, `triumph-and-torment`,
`leeditko-strange`, `ellis-extremis`, `brand-new-day`, `squadron-supreme`,
`blue-marvel`, `liu-x-23`, `morrison-new-xmen`, `aaron-watxm` — so they'll show
no writer or artist until you fix labels or add credits by hand. `the-oath` and
`ellis-extremis` hold a whole mini-series in one label; split those rows in the
sheet.

#### 8c-2. Review the label proposals

**~20 minutes · most of it bulk decisions by category**

`label_review.csv` has a row for every label that differs from Metron's
canonical label for the same issue. Filter on `category`, fill `decision` with
`accept` or `reject` (blank counts as reject), save. Counts from the cache as of
2026-09-16:

| `category`       | Rows   | Example                                                                   | Usually                                                                                     |
| ---------------- | ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `year_added`     | ~2,325 | `AXIS: Carnage #1` → `Axis: Carnage (2014) #1`                            | Accept the category. Adds the volume year, and takes Metron's capitalization with it       |
| `name_style`     | ~1,012 | `Amazing Spider-Man (1963) #129` → `The Amazing Spider-Man (1963) #129`   | Accept for one naming style across the catalog; reject the category to keep yours          |
| `wrong_volume`   | ~237   | Dated 2015 in a run the workbook puts in 1984–85                          | **Row by row.** A proposal appears only when exactly one same-named volume fits; a blank `proposed_label` means none did. Many are origin runs whose typed span was simply wrong — reject those |
| `oneshot_number` | ~123   | `A.X.E.: Avengers` → `A.X.E.: Avengers (2022) #1`                         | Accept the category                                                                         |
| `subtitle`       | ~11    | `Incoming #1 Bar Sinister"` → `Incoming (2020) #1`                        | Row by row. Some carry notes pasted into the label; `Iron Man Annual #4 · Peter Parker…` names two issues — fix that in the sheet instead |

Nothing is renamed until you accept it, and nothing is ever renamed in the
workbook. Then:

```powershell
py etl/enrich_comics.py     # moves existing rows to the accepted labels, dates any new ones
npm run extract
```

The enrich run rekeys `cover_dates.csv`, `issue_details.csv` and
`issue_credits.csv` — hand rows included — and searches Metron once for each
newly named series. Your decisions survive every later run as long as the
proposal doesn't change; if it does, the decision is cleared and the `evidence`
column says what it was.

#### 8c-3. Story titles and credits

**~5 minutes of your time · ~7 hours of requests, spread over two days**

```powershell
py etl/enrich_comics.py --details --dry-run
py etl/enrich_comics.py --details
```

One request per matched issue — about 8,100, which is more than Metron's 5,000
a day. The script stops cleanly when the quota runs out; **run the same command
the next day** to finish. The dry run reads fifty issues, writes nothing, and
prints how many requests remain.

It fills `story_title` in `issue_details.csv` and writes `issue_credits.csv`,
keeping six roles: `writer` (Writer, Script, Story, Plot), `artist` (Artist,
Penciller, Breakdowns, Layouts), `inker`, `colorist`, `letterer`, `cover`.
Editors aren't kept. A note of `no credits on Metron` means Metron has the issue
but nobody credited on it yet.

The cache never expires, so those issues stay uncredited on every re-run. Every
month or so, ask again:

```powershell
npm run enrich:refresh     # re-requests only the issues noted `no credits on Metron`
```

It skips any page fetched in the last week, so if the quota cuts it short, the
same command picks up where it stopped. `--refresh titles` does the same for
`no story title on Metron` (about 1,300 requests), `--refresh all` for every issue.

A run's writer and artist lines are **derived from these credits** — the
workbook's `Writer` and `Artists` columns are not loaded. A creator on at least a
quarter of a run's credited issues is listed, most issues first, three at most.

#### 8c-4. Enter what Metron doesn't have

You don't need to fill every gap. Fix labels first (8c-1's `ambiguous_volume` and
`no_series` rows): once a label matches, Metron supplies the date, story title
and all six credit roles for free, and only the freeform `no_number` labels are
left to type. Then enter, in this order:

1. **Cover dates for the first and last issue of each run.** A run's years come
   from its earliest and latest `cover_date`, so two dates give the same span as
   dating every issue. A year alone (`1987`) is enough. The span will still be
   marked incomplete (`dated_issues < issue_count`); that is expected.
2. **Writer and artist credits on a few issues per run.** These are the only
   roles the run's credit line reads, and it lists creators on at least 25% of
   the run's *credited* issues, so uncredited issues cost nothing. On a run with
   one writer and one artist, two or three issues are enough. Where creators
   change, credit one or two issues for each, or the line shows only the first.
   Start with the eleven runs in 8c-1 that have no matched issues at all.
3. **Everything else is optional.** Inker, colorist, letterer and cover appear
   nowhere but the issue sheet, and it hides colorist and letterer under *More
   credits*. Story titles show only on the issue sheet.

| To add           | File                | Fill                                                                                                     |
| ---------------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| A cover date     | `cover_dates.csv`   | `cover_date` (`1987`, `1987-03` and `1987-03-15` all work), `source` = `hand`                           |
| A story title    | `issue_details.csv` | `story_title`, `story_title_source` = `hand` (add a row with just `label` if the issue has none)        |
| A credit         | `issue_credits.csv` | one row: `label`, `creator`, `role` (one of the six), `source` = `hand`; leave `metron_creator_id` blank |

Write `creator` exactly as Metron spells it (`Chris Claremont`, not `Claremont`).
With `metron_creator_id` blank, extract keys the creator on a slug of the name, so
the same spelling joins the existing Metron creator and a different one makes a
second person.

The scripts never overwrite a `hand` value. A hand credit claims its role for
that issue: once `Avengers (1998) #1` has any hand `writer` row, Metron's writer
rows for that issue are left exactly as they are, and new ones aren't added, so
list every writer the issue has. You
don't have to finish — undated issues are left out of a run's span, and an
uncredited run shows no credit line.

**Check your entries, and see what's left.** Run it before you start, and again
after each batch of hand entry:

```powershell
npm run extract              # first, if the workbook or label_review.csv changed
npm run sidecars             # report only
npm run sidecars:fix         # apply the safe fixes it reported
npm run sidecars:prune-orphans  # optional: archive-then-remove rows for labels that are gone
npm run enrich:details       # only if it promoted rows to matched; one request each
npm run check:role-outliers  # optional: flags Metron credits whose role looks mistagged
npm run titles:fandom -- --dry-run  # optional: story titles from Marvel Fandom; drop --dry-run to write,
                                    # then npm run sidecars again to refresh the checklist
```

`etl/check_sidecars.py` repairs what hand entry in Excel tends to break, and says
what it changed: a row shifted a column, a role typed in `metron_creator_id`,
`penciler` for `artist`, a blank `source`, a label missing its `#1` or spelled
with `½`, duplicate rows. It adds the Metron creator id to a hand credit whose
creator matches a Metron creator's name, and it marks a row `matched` when a
Metron issue id is already on file, so `--details` fetches that issue's credits
instead of you typing them. It never invents a value, and never deletes one
either — except a true orphan, and only when you ask for that separately (see
below). The things it can't decide — a label that matches nothing, an unknown
role, a creator spelled close to a Metron creator — are listed under *needs
you*.

A label that matches nothing usually means the issue was removed from the
workbook, or a run was deleted. Left alone, its `cover_dates.csv` /
`issue_details.csv` / `issue_credits.csv` rows — including any hand entry —
sit under *needs you* forever. `npm run sidecars:prune-orphans` clears them
out: it appends each one to `etl/data/pruned_orphans.csv` (label, which file,
everything else as JSON) and then removes it, so nothing is lost, just moved
somewhere you'd only look if you needed it back. It leaves a label mid-rename
in `label_review.csv` alone — only a label that matches nothing at all is
pruned. It's off by default and separate from `--fix`; run it deliberately,
after `npm run sidecars` has shown you what it would take.

It also writes `etl/data/metadata_todo.md`, a checklist of every issue still
missing a writer, artist or cover date, grouped by whether Metron has the issue,
with the runs that hold each one and a Marvel Fandom search link. It ends with
the story titles still missing, one line per series, which are optional. Filled
items drop off each time it runs; ticked boxes stay ticked while the item is
still listed, so tick anything you've looked for and couldn't find. An issue
whose Fandom page has a blank title (per the last `npm run titles:fandom`) isn't
counted as missing one, since there's nothing to find; the list says how many it
left out.

`etl/check_role_outliers.py` looks for the other kind of mistake: a role
attached to the wrong person rather than a role that's missing. For every
Metron creator with a clear dominant role across the whole catalog (almost
always `writer`, or almost always `cover`), it flags the rare issue where that
same creator instead sits in an interior art role (`artist`, `inker`,
`colorist`) — the shape Metron's own importer leaves behind when it credits a
painted-cover artist as the interior artist too, or a writer as an inker. It's
a heuristic, not a verdict, and it never writes anything: confirm a flagged row
against `metron.cloud/issue/<id>/` (the id is in `issue_details.csv`) before
changing a credit.

`etl/fandom_titles.py` does the story-title part of hand entry for you. For
every issue with no story title, it finds the issue's Marvel Fandom page and
copies its `StoryTitle` fields in (several stories joined with `; `). Fandom
names pages by volume (`Alias Vol 1 1`), not year, so it works out each
series' volume from the cover dates Metron gave you. A series where no volume
fits, or more than one does, is skipped and listed, not guessed. So is an
issue whose Fandom year disagrees with its cover date. Titles are written as
`hand`, exactly as if you'd typed them from Fandom, and each one is also
logged in `etl/data/fandom_titles.csv` so you can tell which ones it supplied.
It never touches a title that's already there. Lookups are cached in
`etl/.fandom-cache.json`, so a re-run costs almost nothing. Many modern issues
have no title on Fandom either; those stay on the checklist.

**Working through what it skipped.** Every run (dry runs included) rewrites
`etl/data/fandom_skipped.csv`: one row per issue it couldn't title, with the
`reason`, a `detail` (what it tried or found), a `fix` column that tells you
what to do, and a `fandom_link` to start from. Open it in Excel, filter on
`reason`, and work top down. You answer it in `etl/data/fandom_pages.csv`, a
hand-kept file with three columns: `match`, `fandom` and `note`. The next run
uses your answer instead of guessing.

| `reason` | What it means | What to put in `fandom_pages.csv` |
| --- | --- | --- |
| *more than one Fandom volume fits* | Two volumes match the cover year (`detail` lists them) | `match` = the `series` cell, `fandom` = the right one, e.g. `Thunderbolts Vol 1` |
| *no Fandom volume found* | Fandom spells the series differently (`Of`/`of`, `&`/`and`, a `/`), or files it somewhere else | Find the series on Fandom with the link; `match` = the `series` cell, `fandom` = its volume page, e.g. `X Lives of Wolverine Vol 1` |
| *no cover date to confirm the volume* | Nothing to check a volume against | Same as above: name the volume |
| *label not understood*, *no Fandom page for the issue*, *Fandom's year disagrees* | One issue is odd (a digital chapter, a numbering Fandom doesn't use) | `match` = the `label` cell, `fandom` = the issue's full page, e.g. `Siege Prologue Vol 1 1` |
| *no story title on Fandom either* | The page exists, but its title is blank | Nothing. `npm run sidecars` stops listing these as missing a title (add `-- --keep-fandom-untitled` to see them again). Type a title by hand if you find one elsewhere |

A bare volume (`Name Vol N`) fixes the whole series, and a full page (`Name Vol
N 1`) fixes that one issue. The shape of what you type tells the script which
you mean. And if you've looked yourself and Fandom has no title, put `none` in
`fandom` (with the `series` or the `label` as `match`). The script then records
it as *no story title on Fandom either* without fetching anything, and the
checklist stops asking. Prefer naming the page when you can, so the script
checks it for you. Keep `none` for pages it can't reach. You can paste the page's URL from the browser instead of typing the
name. A volume you name is still checked issue by issue against the cover dates.
A page you name for one issue is trusted as it is. Then run it again:

```powershell
npm run titles:fandom -- --dry-run   # check: the rows you answered should now say "would write"
npm run titles:fandom                # write them
npm run sidecars                     # refresh metadata_todo.md
```

Rows you answered drop out of `fandom_skipped.csv` once they're titled. A
`fandom_pages.csv` row that no longer matches anything untitled is listed as
unused. That's normal once it has done its job, but it's also how a typo in
`match` shows up.

### 8d. Review the whys

`why_review.csv` holds a drafted why for every run — 2–4 sentences on why it
matters, what it's about, the creators and the legacy — beside the workbook's
current why. For each row set `decision`:

| `decision`      | Loads                                             |
| --------------- | ------------------------------------------------- |
| `accept`        | `proposed_why`, recorded as `why_source = claude` |
| `edit`          | your text from `final_why`, recorded as `hand`    |
| `keep` or blank | the workbook's why, recorded as `hand`            |

The `check` column flags facts to confirm and data problems spotted while
drafting (wrong volumes, typos, misattributed writers). Save as **CSV UTF-8** if
you use Excel, as with the volume map.

### 8e. Re-extract

```powershell
npm run extract
```

Folds all five sidecars into `seed/`. `run_issues` matches 8a; `issues` is lower
by however many labels your accepted renames merged. The sidecar lines now read
something like:

```
label review: 3460 renames accepted
issue details: 8120 labels, story titles 7900 from Metron, 0 by hand
issue credits: 41000 credits on 8100 labels
```

### 8f. Load

The first time, after Step 7's migrate:

```powershell
.\etl\load.ps1
```

Every time after, `npm run rebuild` (see "Doing Steps 7–8 again") does the drop,
migrate, extract, load and checks in one go.

`load.ps1` reads `.env` itself — no manual exports. Truncates and reloads inside
a transaction, so re-running is safe. **That stays true until Step 14** — after
cutover, re-running would wipe data that exists only in the app. Once
`LEDGER_LIVE=true`, `load.ps1`, `load.sh` and `rebuild` all refuse to run.

Expect `loaded.` in green.

### 8g. Verify

```powershell
psql $env:DATABASE_URL -c "select state, count(*) from run_progress group by 1;"
```

Roughly 254 `unread`, 3 `reading`, 1 `read`, 1 `empty`. One more run reads as
`reading` than the sheet showed: an issue read in one run now counts in every
run that holds it.

```powershell
psql $env:DATABASE_URL -c "select count(*) from run_ancestors('ewing-immortal-hulk');"
```

Expect **82**. That's the prerequisite chain behind a 64-issue run — the query
your spreadsheet could never answer, and the one you built and abandoned a
CLOSURE tab trying to get.

```powershell
psql $env:DATABASE_URL -c "select count(*) from run_issues;"   # 10840
psql $env:DATABASE_URL -c "select count(*) from issues;"       # 10273 before label merges
psql $env:DATABASE_URL -c "select count(*) from books;"        # 1478
psql $env:DATABASE_URL -c "select run_id, issue_count, dated_issues, start_year, end_year, series_issues from run_span where run_id = 'hickman-ff';"
psql $env:DATABASE_URL -c "select * from run_credit_line where run_id = 'hickman-ff';"
psql $env:DATABASE_URL -c "select role, source, count(*) from issue_credits group by 1, 2 order by 1, 2;"
psql $env:DATABASE_URL -c "select why_source, count(*) from runs group by 1;"
npm run test:views    # silence then 'all assertions passed'
npm run test:etl
```

`hickman-ff` should read `Dark Reign: Fantastic Four #1-5; Dark Reign: The
Cabal; Fantastic Four (1961) #570-588, 600-611, 605.1; FF #1-23`, with years
once its issues are dated — or the same with volume years on every series once
you've accepted the `year_added` proposals. After 8c-3 its credit line should
name Jonathan Hickman as writer.

| Symptom                                         | Fix                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `too many connections`                          | You used the direct string, not the pooled one. Swap it in `.env`                           |
| `invalid input syntax for type integer: ""`     | A CSV column has an empty string where a number is expected. The table name is in the error |
| `violates foreign key constraint`               | An earlier `\copy` failed silently. Re-run `load.ps1` from scratch                          |
| `duplicate key value violates "issues_label_unique"` | `seed/` is from an extract older than task 0.7. Re-run `npm run extract`               |
| `column "writer" of relation "runs" does not exist` | Same: an old `seed/runs.csv`. Re-extract                                                |
| Load succeeds but `run_progress` is empty       | Views didn't apply. `psql $env:DATABASE_URL -f etl/views.sql`                               |
| `rebuild` refuses with `LEDGER_LIVE is true`    | Working as intended after cutover. Don't rebuild a live ledger                              |

---

## Step 9 — Run it locally

**~10 minutes**

```powershell
npm run dev
```

Open `http://localhost:3000`, enter your passcode, check five things:

1. The dashboard lists unlocked runs and shows Hickman progress.
2. `hickman-krakoa` renders 641 issues without a stall.
3. Tapping an issue marker fills it, and it survives a refresh.
4. `/comics?track=x-men` filters correctly.
5. `/books?q=sanderson` returns results.

| Symptom                           | Fix                                                             |
| --------------------------------- | --------------------------------------------------------------- |
| Redirect loop on `/login`         | `SESSION_SECRET` missing or empty — the cookie can't be signed  |
| `not signed in` on every page     | `OWNER_ID` doesn't match the `users` row                        |
| Blank dashboard, no errors        | `npm run db:views`                                              |
| `prepare` errors from postgres.js | `prepare: false` is required for Neon's pooler. Don't remove it |

Stop the server with `Ctrl+C`.

---

## Step 10 — Push, deploy, and back up

**~45 minutes**

### 10a. GitHub

```powershell
git config --global core.autocrlf input
git init
git add -A
git commit -m "ledger: migration, schema, v1 app, design"
gh repo create ledger --private --source=. --push
```

`core.autocrlf input` matters — without it, Windows line endings get committed
into `etl/load.sh` and break it under WSL.

**Private, not public.** `seed/` is gitignored because it holds a full copy of
your library, but the repo also carries your volume map, run list, and
eventually your reading history.

```powershell
gh repo view --web
```

Confirm `.env` and `seed/` are **absent** from the file list.

### 10b. Vercel

1. vercel.com → **Add New → Project** → import `ledger`.
2. Framework preset **Next.js**. Leave build settings alone.
3. Environment variables — all five, scoped to **Production, Preview, and
   Development**, except `DATABASE_URL`: **Production and Development only**.
   A preview gets its own copy of the database (10f), never the live one:

| Key              | Value                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`   | the Neon pooled string                                                      |
| `OWNER_ID`       | `justin`                                                                    |
| `OWNER_NAME`     | `Justin`                                                                    |
| `APP_PASSCODE`   | your passcode                                                               |
| `SESSION_SECRET` | the generated value                                                         |
| `TMDB_API_KEY`   | only once you start Phase 8 — free key from themoviedb.org account settings |

4. **Deploy.** First build takes 2–4 minutes.

Hobby is free and restricted to non-commercial personal use, which this is.

| Symptom                             | Fix                                                         |
| ----------------------------------- | ----------------------------------------------------------- |
| Build fails on `tsc`                | Run `npx tsc --noEmit` locally first                        |
| Build succeeds, runtime 500         | Env vars missing from the **Production** scope specifically |
| Login works locally, fails deployed | `secure: true` on the cookie needs HTTPS. Fine on Vercel    |

### 10c. Your phone

1. Open the URL in **Chrome on Android**.
2. Three-dot menu → **Add to Home screen**.

The passcode cookie lasts a year, so it behaves like an installed app.

**Test at real width.** A Pixel is ~412 CSS pixels, a Galaxy S ~360 — the layout
targets 360 and up. DevTools emulation gets the layout right and touch targets
wrong, so check the spine view on the actual device.

### 10d. Backups — do not skip this

Until this runs once, your Google Sheet is the only copy of eight years of
curation.

Dumps go to a Cloudflare R2 bucket of their own, not the repo (D-66).

1. Cloudflare dashboard → **R2** → **Create bucket** → name `ledger-backups`,
   location automatic. The account ID is on the R2 overview page.
2. R2 → **Manage API tokens** → **Create API token** → permission **Object
   Read & Write**, applied to **`ledger-backups` only** → **Create**. Copy the
   **Access Key ID** and **Secret Access Key**; Cloudflare shows the secret once.
3. Repo → **Settings → Secrets and variables → Actions**. Secrets:
   `DATABASE_URL` (the Neon pooled string), `R2_BACKUPS_ACCESS_KEY_ID`,
   `R2_BACKUPS_SECRET_ACCESS_KEY`. Variables: `R2_ACCOUNT_ID`, `R2_BUCKET`
   (`ledger-backups`). The job also reads `PRODUCTION_URL` and
   `VERCEL_AUTOMATION_BYPASS_SECRET`, which Release already set (10e). Or:

   ```powershell
   gh secret set R2_BACKUPS_ACCESS_KEY_ID
   gh secret set R2_BACKUPS_SECRET_ACCESS_KEY
   gh variable set R2_ACCOUNT_ID --body <account id>
   gh variable set R2_BUCKET --body ledger-backups
   ```
4. Repo → **Actions** tab → **Nightly backup** → **Run workflow**.

The job is read-only to GitHub (`permissions: contents: read`); the token from
step 2 can write only the backup bucket.

**Verify:** the run is green, `ledger-backups` holds
`reading-YYYY-MM-DD.sql.gz` of roughly 1 MB, and the run's summary page shows a
**Restore check** table and an *Uploaded* line. The job fails (red X, nothing
uploaded) when `pg_dump` fails, when the dump is nearly empty, or when the dump
does not restore cleanly (below), so a green run with a file in the bucket is a
backup that has been restored. The newest 90 dumps are kept; older ones are
deleted only after a new one uploads, so a job that stops running deletes
nothing. If the run is red, read its log first: a Neon major-version upgrade
past 18 makes the pinned client refuse, and the job says so in one line naming
the fix. Neon never upgrades a project's major version by itself — if you do,
change `PG_MAJOR` in `.github/actions/start-postgres/action.yml` the same day.
That one line sets the backup's `pg_dump`, its restore server and CI's test
database, so they always agree.

**Restore — every night, automatically** (R2-AR2, D-30). A backup you have
never restored is a hope, not a backup, so the job restores each dump before it
keeps it. Straight after `pg_dump` it loads the dump into a throwaway
PostgreSQL 18 server that lives only as long as the job (never Neon), re-applies
`etl/views.sql`, runs `etl/test_views.sql` (the same SQL tests CI runs), and
counts the rows of every table on both the restore and live Neon, which it only
reads. The views and tests come from the commit production serves (its
`/api/health`), not from `main`: `main` can hold views for a migration that
Release has not applied yet. The counts must match, and so must the number of
labels with characters a bad decode mangles (*Marvel’s Voices*, —, ½). If any
of that fails, the dump is not uploaded. Nothing to install, nothing to run by
hand.

**Run the drill on demand** (once now, and whenever you want to see it pass):
**Actions → Nightly backup → Run workflow**, tick **check only**, **Run**. Or
from the project folder:

```powershell
gh workflow run backup.yml -f check_only=true
gh run watch (gh run list --workflow backup.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

That restores and checks the newest dump in R2, with the views of the commit
production served when it was taken, and takes no new dump and uploads nothing.
Its row counts will trail live by whatever you marked since 04:00; the summary
flags those rows as *differs* and the run stays green.

**If it fails:** the restore stopping on an error, `test_views.sql` raising, or
(on the nightly run) a count differing from live each means **that night's
backup is not trustworthy**. Read the first error in the *Restore check* step.
One count off by a row or two on the nightly run means a write landed between
the dump and the check; re-run the job. Do not cut over until a run is green.

**Restoring by hand:** download a dump from the bucket in the Cloudflare
dashboard, then `gzip -dc reading-YYYY-MM-DD.sql.gz | psql <empty database>`
and `psql <that database> -f etl/views.sql`. The dumps from before D-66 are in
git history only (the `backups/` folder was emptied on 2026-10-20):
`git log --name-only -- backups/` lists them, and
`git show <commit>:backups/<file> > <file>` gets one back.

Backups live apart from the code (D-66): losing the repo or the Cloudflare
account loses one copy, and `GET /api/export` is a third.

The workflow keeps 30 days and runs at 08:00 UTC (04:00 Eastern). Your second
exit ramp is `GET /api/export`, which returns every table as JSON on demand.

**Check the export once, too** (D-17). Signed in on the desktop, open
`/api/export`, save the file, and open it: every table the app has should be a
key in it, with rows under the ones you have data in. `users` is left out on
purpose. `test/export-tables.test.ts` keeps the list complete as tables are
added, so this is a once-before-Step-14 look, not a chore.

### 10e. Releases — merging is not deploying

**~15 minutes, once.** Out of the box Vercel puts every merge to `main` live
immediately, whether CI passed or not, and leaves the schema for you to catch
up by hand. After this step a build of `main` waits, *staged*, until you run
the **Release** workflow. Release checks CI, migrates, and promotes, in that
order (Step 13).

1. **Vercel: stage production builds.** Project → **Settings → Environments →
   Production → Branch Tracking** → turn **Auto-assign Custom Production
   Domains** off. Leave **Settings → Build and Deployment → Deployment Checks**
   empty: they only work with auto-assign on, and Release checks CI itself.
2. **Vercel token.** vercel.com → **Account Settings → Tokens** → create
   `ledger-release`, scoped to the team that owns the project (`justin-tillman`).
   Release promotes through Vercel's REST API, which works with a team-scoped
   token. The `vercel` CLI does not: it fails with *User not found*.
3. **Neon API key.** Neon console → **Account settings → API keys** → create
   `ledger-release`. Then your project → **Settings → General** → copy the
   **Project ID**.
4. **GitHub.** Repo → **Settings → Secrets and variables → Actions**.
   - **Secrets:** `VERCEL_TOKEN` and `NEON_API_KEY` from steps 2–3.
     `DATABASE_URL` is already there from 10d. And
     `VERCEL_AUTOMATION_BYPASS_SECRET`: every deployment of the project,
     production included, is behind Vercel Authentication, so the smoke test
     below would only ever reach Vercel's login page. In Vercel → project →
     **Settings → Deployment Protection → Protection Bypass for Automation**,
     create the secret and paste it here. The Lighthouse workflow (task 0.10)
     uses it too, to reach every preview.
     And `APP_PASSCODE`: the **Preview and Development** passcode, which the
     Lighthouse workflow (task 0.10) posts to `/api/login` to measure the
     signed-in pages. Vercel holds two `APP_PASSCODE` values: your real
     passphrase, ticked for **Production** only, and a second passphrase,
     ticked for **Preview** and **Development**. Paste the second one here,
     never the production one, so nothing in Actions holds your production
     login. A change to either reaches a deployment only when it is next built:
     redeploy an open PR's preview after changing it.
     `SESSION_SECRET` already has its own value in each of Production,
     Preview and Development. Keep it that way: the session cookie is signed
     with it and never expires, so the cookie the workflow gets from a preview
     is accepted by previews only, never by production.
   - **Variables:** `VERCEL_SCOPE` = `justin-tillman` (the name in your
     `vercel.com/<name>/ledger` URL), `NEON_PROJECT_ID` = the ID from step 3,
     `LEDGER_LIVE` = `false` (Step 14 sets it to `true`), and `PRODUCTION_URL`
     = your production address, e.g. `https://ledger-justin-tillman.vercel.app`
     (the **Domains** list on the project's Vercel page). Not a deployment's
     own URL (`ledger-<9 characters>-justin-tillman.vercel.app`): that one is
     a single build forever, so it never serves what Release promoted. After promoting,
     Release asks `<PRODUCTION_URL>/api/health` whether the database answers,
     the views are there, and it is the build just promoted. Without the
     variable that check is skipped, with a warning.

**Verify:** **Actions → Release → Run workflow**, leave **Dry run** ticked (it
is by default), **Run**. It is green, and its summary names the build it
would promote, *CI on it: success*, and *Migrations to apply: none*.

A commit that only touches `backups/`, `docs/`, `design/`, `.github/`,
`.claude/` or Markdown shows **Canceled** in Vercel's Deployments tab. That is
`vercel.json`'s ignore step skipping a build that would change nothing, not a
failure. The build log says which files it compared.

GitHub's approval gate for deployments (environments with required reviewers)
is not available to a private repo on the free plan. Release has no second
approver: only you can start it, and it snapshots before it migrates.

### 10f. Preview databases — a PR never touches the live ledger

**~10 minutes, once.** Each PR's preview runs that PR's code on its own Neon
branch, named `preview/<git branch>` and copied from live when the branch
first deploys. The Vercel build migrates **that branch** to the PR's schema
before building (`scripts/vercel-build.mjs`). You click around real data, and
nothing you do there reaches the ledger. The live database is migrated only by
Release (Step 13). The build refuses to migrate anything it cannot prove is not
live.

1. **Vercel: take `DATABASE_URL` out of Preview.** Settings → Environment
   Variables → `DATABASE_URL` → edit → untick **Preview**. Production and
   Development keep it. The integration will not install over it.
2. **Vercel: name the live host.** Add `LEDGER_LIVE_DB_HOST`, **Preview only**,
   value the host part of your live `DATABASE_URL` (between `@` and `/`, e.g.
   `ep-…-pooler.c-2.us-east-2.aws.neon.tech`). It is a hostname, not a secret.
   A preview whose database has that host refuses to build.
3. **Neon: connect Vercel.** Neon console → your project → **Integrations →
   Vercel → Add** (the *Neon-managed* integration, for an existing project).
   Pick the `ledger` Vercel project, tick **Preview**, and tick **Automatically
   delete obsolete Neon branches**. Leave its build-command advice alone:
   `vercel.json` already runs the migration.

**Verify:** push any PR. The Vercel build log starts `vercel-build (preview):
migrate → views → next build`, and the Neon console lists `preview/<branch>`.
Open the preview: it shows your data.

| Symptom                                               | Fix                                                                                          |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `This preview has no DATABASE_URL`                    | Step 3 isn't done, or Preview isn't ticked in the integration                                |
| `LEDGER_LIVE_DB_HOST is not set`                      | Step 2                                                                                        |
| `This preview's DATABASE_URL is the live database`    | Step 1: `DATABASE_URL` is still in Preview                                                    |
| `migrate failed` after regenerating the PR's migration | The branch already ran the old one. Delete `preview/<branch>` in Neon and redeploy           |
| `migrate failed` on a migration not written for existing rows (0.8a) | Expected before cutover. Test that PR locally against `TEST_DATABASE_URL` instead |
| A reopened PR's preview can't reach its database      | Closing deleted `preview/<branch>`. Push a commit or redeploy: the branch is re-copied from live |

Neon Free allows 10 branches per project. Main, `test`, one per open PR and
Release's two snapshots fit. Step 3's option misses some closed PRs' branches,
so the **Neon preview cleanup** workflow
(`.github/workflows/neon-preview-cleanup.yml`) deletes `preview/<git branch>`
whenever a PR closes, merged or not. It needs nothing new: it uses Release's
`NEON_API_KEY` secret and `NEON_PROJECT_ID` variable. It deletes nothing but
that one branch, never live, `test` or a snapshot. A PR Dependabot closes
itself runs without secrets and only warns. Delete a leftover by hand with
`gh workflow run neon-preview-cleanup.yml -f branch=<git branch>`, or in the
Neon console.

**Done with Part 2 when:** you can mark an issue read from your phone, and the
Actions tab shows one successful backup.

---

# Part 3 — Build

Read **`CLAUDE-CODE.md`** before your first session. It covers the four-phase
loop, session hygiene, prompt patterns, and what to do when a session goes
sideways. This section is the _sequence_; that file is the _technique_.

## Test database — set this up before Step 11

**~10 minutes, once.** The tests `TRUNCATE` tables. `DATABASE_URL` in `.env` is
your development database (see *Four databases* below), and the tests are never
allowed to use it either: they read
`TEST_DATABASE_URL`, refuse to start when it is missing, and refuse when it names
the same host and database as `DATABASE_URL` (R3-02). Pick one:

**A. A Neon branch (no install).** In the Neon console: your project →
**Branches** → **Create branch** → name it `test`, parent `main`. Open the new
branch's **Connection details**, tick **Pooled connection** and copy the string.

**B. Local Postgres.** `winget install PostgreSQL.PostgreSQL.18` (or
`scoop install postgresql`), then `createdb ledger_test`. The string is
`postgresql://postgres:<your password>@localhost:5432/ledger_test`.

Then add it to `.env` (never `.env.example`):

```
TEST_DATABASE_URL="postgresql://..."
```

**Verify:**

```powershell
npm run test:db:reset     # migrates the test DB from zero and applies etl/views.sql
npm test                  # vitest: 3 test files pass
npm run test:views        # etl/test_views.sql, including the run_ancestors branching test
```

`npm run test:db:reset` **drops everything in the test database**, which is the
point. Option A (the Neon branch) is throwaway: delete and re-create it any time.

**Every session, before you open a PR:** `npm run test:all` — it rebuilds the test
database, then runs vitest, the SQL assertions and the Python tests, which is what
CI runs. To ask Claude to run it: *"run `npm run test:all` and report failures"*;
Claude Code can call any of these scripts, and none of them needs `psql`. If
`npm test` says `TEST_DATABASE_URL is not set`, that is the guard working — set the
variable, do not work around it.

## Four databases — `.env` is never production

**~10 minutes, once.** Until 2026-10-02, `.env` pointed at production, so every
local `npm run dev`, rebuild and load wrote to the live ledger. Now there are
four databases:

| Database    | Where its string lives                                          | What uses it                                                                 |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Production  | Vercel (Production), GitHub secret `DATABASE_URL`, `.env.live`   | the app, the nightly backup, Release; locally only `-EnvFile .env.live`       |
| Preview     | the Neon integration, one `preview/<git branch>` per PR (10f)    | that PR's preview                                                            |
| Test        | `TEST_DATABASE_URL` in `.env`, and CI                            | `npm test`, `npm run test:all`                                               |
| Development | `DATABASE_URL` in `.env`                                         | `npm run dev`, `rebuild`, `load.ps1`, `db:push`, `db:views`, the psql checks |

1. **Development.** Neon console → **Branches** → **Create branch** `dev` (or a
   new database), tick **Pooled connection**, and put the string in `.env` as
   `DATABASE_URL`. Load it with `npm run rebuild -- -Yes`. `.env` keeps
   `LEDGER_LIVE=false` forever: development is always disposable.
2. **`.env.live`.** Beside `.env`, a file with production's string:

   ```
   DATABASE_URL="<production's pooled string>"
   OWNER_ID="justin"
   LEDGER_LIVE=false
   ```

   It is gitignored (`.env*`), and Next.js never reads it. Exactly two commands
   use it: `npm run rebuild -- -EnvFile .env.live` before cutover (Step 13), and
   Step 14's final load. Bash twins: `ENV_FILE=.env.live bash etl/rebuild.sh`.

## Step 11 — Sittings 1–2: Phase 0

**Claude Code · ~2 sittings · `05-roadmap.md` phase 0 (milestones M1–M2)**

```powershell
cd C:\dev\reading-tracker
git checkout -b task/0.2-ci
claude
```

One task per session, in this order. Task 0.1 (the test harness) has already
landed.

| Sitting | Tasks | Result |
| ------- | ----- | ------ |
| 1 | 0.2 CI, 0.3 schema additions, 0.4 soft delete, 0.5 volume years | Every later check has a runner and CI |
| 2 | **0.8a read state per run — schema, ETL, views**, then 0.8b the spine | Reading an issue in one run leaves it unread in the others |

**This builds nothing you can look at. Do it anyway.** Every later task's
acceptance check is worthless without a runner. Skipping ahead to something
visible means you personally become the verification loop for the next six
weeks.

Task 0.3 is one migration: `reading_settings`, `eras` (+ `run_issues.era_id`),
`volume_rules`, `shelves` + `shelf_books` (not `shelf_titles` — that waits for
the watchlist), a few columns on `books` and `book_status`, and `deleted_at` on
`runs`, `issues`, `books` and `run_issues`. `sessions`, `read_events` and
`inbox` are **not** in it; they arrive with 2.1b, 1.5 and 1.4b.

**0.8a is the critical path.** Nothing in Phase 1 that marks or reads progress
(1.1, 1.5, 1.6, 1.9, 1.10) may start before it, and **you may not cut over
without it**: after Step 14 it would be a live data migration guessing which run
each old read belonged to. Its schema change is applied with `npm run rebuild`,
not `db:migrate` (see Step 13).

**Done when:** a throwaway pull request goes green on the `check` job —
typecheck, lint, tests (vitest, SQL, Python) and build — and after 0.8a,
`npm run rebuild` loads the 76 workbook reads keyed on placements. (You need the
private GitHub repo from Step 10a and `TEST_DATABASE_URL` first — see
`docs/OWNER-CHECKLIST.md`.)

## Step 12 — Sittings 3–9: Phase 1

**Claude Code · ~7 sittings over 3–6 weeks · milestones M3–M9**

The sittings are `docs/06-tasklist.md`'s milestones under the same numbers (sitting 7 is M7); where this table and the tasklist differ, the tasklist wins.

| Sitting | Tasks (in this order) | Result |
| ------- | --------------------- | ------ |
| 3 | 1.2 undo, then 1.1 range marking, 1.6 resume pointer | The app becomes pleasant to use |
| 4 | 1.3 bulk-entry parser, 1.3c review table and insert, 1.3b add from a Metron search | Adding a run is faster than the sheet. The long one |
| 5 | 1.4 books bulk entry, 1.4c add a book, 1.4b quick capture, 1.4d wishlist promotion screen, 1.5 dated log + `read_events`, 1.16 dates in `America/New_York` | Books work end to end |
| 6 | 1.7 period column, 1.8a design tokens and control states, **0.11 browser test harness**, 1.8c dashboard routes, 1.8 app shell, 1.8e tablet frames, 1.8d failed writes and skeletons, 1.8b thumb bar and contrast | The real navigation |
| 7 | 1.10 Up next queue, then 1.9 status screens, **2.11a prerequisite cycle check**, 1.12 volume map into `volume_rules`, and 1.11 failed sign-ins wait (D-36) | Phase 1 complete; extract lists the cycles for your audit |
| 8 | 1.13 book extract and merge review, 1.14 Open Library details, 1.15 series, author and universe follows, 1.18 Calibre word counts, series, tags and reads | Books load clean, with covers, page counts and real word counts; answer `book_review.csv` between 1.13 and 1.14, and again after 1.18 for Calibre's near spellings. Can be built any time before Step 14 |
| 9 | 1.4e paste a list as two fields, 1.17 start dates | A small fix to a screen in daily use, and start dates captured from cutover on |

**Task 1.5 carries a deadline.** It adds `read_events`, the re-read log, and
projects the existing status tables from it. This has to land before real
reading data accumulates — a second read of a book currently overwrites the
first, and that history cannot be reconstructed.

**2.11a is numbered in Phase 2 but built here** (D-20): it reports the
prerequisite cycles you break in `Comics.xlsx` before cutover, and Step 14's
final extract uses its `--fail-on-cycle` switch.

**0.11 is numbered in Phase 0 but built in sitting 6**, before 1.8, whose check
runs axe and reads computed styles in a browser. **1.12 and sitting 8 are the
last load changes before cutover.** 1.12 puts the volume map into the database,
and 1.13–1.15 change what the books load holds, because after Step 14's final
load nothing loads either again. Sitting 8 needs you between its tasks: answer
`etl/data/book_review.csv` after 1.13, and again after 1.14's enrich run adds
Open Library's spellings to it. 1.18 reads your Calibre library (give it the
folder) as the source of truth for word counts, series and reads (D-87): it
asks you only to settle its near spellings in `book_review.csv`, and lists in
`seed/calibre_changes.csv` where Calibre overrode the workbook or disagrees with Open
Library (nothing to do; fix it in Calibre if Calibre is wrong), and in
`seed/unresolved.csv` only what needs you (D-93). **1.17 also lands before cutover**, for 1.5's
reason: a start date not captured from the first day is lost.

**Done when:** every Phase 0 and Phase 1 task is ticked in `05-roadmap.md`, you can
add a 24-issue run by pasting a block of labels, and marking a 100-issue range
doesn't stall.

## Step 13 — Deploy what you built

**Merging is not deploying.** Vercel builds every push, but a build of `main`
sits *staged* until you run **Release** (10e). Release is also the only way a
migration reaches the live database, so the rule is one line:

> **Merge, then Release. Never migrate before the merge, and never by hand.**

After each sitting:

1. **Test the PR's preview on your Android phone**, then merge it.
2. **Before Step 14, if the PR added a migration:** pull `main` and run
   `npm run rebuild -- -EnvFile .env.live` (it migrates production from zero and
   reloads the workbook; plain `npm run rebuild` only rebuilds development). The PR's
   CI summary says whether it added one. Release refuses to migrate before
   cutover and says so. 0.8a *must* go this way: its migration re-keys progress
   and is not written to convert existing rows.
3. **Actions → Release → Run workflow**, untick **Dry run**, **Run**. Or from
   the project folder:

```powershell
gh workflow run release.yml -f dry_run=false
gh run watch (gh run list --workflow release.yml --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

Release picks the newest production build Vercel has ready for `main`, and
refuses when CI has not passed on that exact commit, when something newer on
`main` is still building, or (before cutover) when there is a migration to
apply. Then it snapshots the live database if migrating, migrates, re-applies
`etl/views.sql`, and promotes the build. Its run summary lists each step.
**Dry run** reports all of that and changes nothing. It is ticked by default,
so a release has to be asked for. Release runs from `main` only: started from
any other branch it may dry-run, and a real run refuses.

**Why this order.** Release puts the schema change in first and the new code
second. For the minute in between, the *old* code runs on the *new* schema.
An additive migration (a new table, column or view) is invisible to old code.
A drop or retype can make the old code error for that minute. For a one-user
app that is fine. When it isn't, split the change into two PRs: stop using the
column (release), then drop it (release). Migrating before the merge would be
the wrong way round: it puts live on a schema that no reviewed, CI-tested code
on `main` expects yet.

**When a release goes wrong:**

| What                                       | Do                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Refused: CI still running / newer building | Wait, run it again                                                                                   |
| Promote failed after migrating             | Run it again: nothing is left to migrate, so it only promotes                                        |
| Promote says the build was already promoted | It is live already. Nothing to do                                                                   |
| Promote: 401 or 403                        | The `VERCEL_TOKEN` secret is expired or has no access to the team: make a new one (10e step 2)       |
| Promote: 404                               | `VERCEL_SCOPE` is not the team in your `vercel.com/<team>/ledger` URL                                 |
| Smoke: *still serves* the old commit       | The promotion hasn't taken. Check the Deployments tab. If the new build is Current, run Release again |
| Smoke: the *database* or *views* check failed | Production is live but broken: Instant Rollback (above), then read the Migrate and Apply views steps |
| Smoke: *behind Vercel Authentication*      | Add `VERCEL_AUTOMATION_BYPASS_SECRET` (10e step 4). Production is already promoted; the next Release checks it |
| Smoke: *refused the protection-bypass secret* | The GitHub secret doesn't match Vercel's current one: copy it again (regenerating it invalidates the old one) |
| Smoke: *reports no commit*                 | Vercel → Settings → Environment Variables → tick **Automatically expose System Environment Variables** |
| The new code is broken                     | Vercel → Deployments → the previous one → **Instant Rollback**. Fix forward in a new PR              |
| The migration was wrong                    | Neon console → Branches → `pre-release/<time>-<sha>` → restore `main` from it; or run the migration's `drizzle/down/` file |

Anything you enter in the deployed app before Step 14 — test marks, a queue,
shelves — is erased by the next rebuild and by Step 14's final load. Use it to
try things, not to keep things.

**Never let a deploy auto-migrate.** Vercel builds on every push, and an
automatic migration on a bad push has no undo. That is why the migration is a
step of Release, which only you start, and not of the build. The one build that
migrates is a preview, on its own throwaway Neon branch (10f).

---

# Part 4 — Cut over

## Step 14 — Load for the last time, then run both for a month

**~1 hour for the switch, then a month of the app as the record (D-18)**

The order matters. The final load **truncates everything the app holds** —
progress, book status, and through `CASCADE` the queue, shelves, eras and
inbox — so it happens **first**, and `LEDGER_LIVE=true` goes on straight after.
From then on the app is the record and nothing reloads over it. The sheet is
frozen and kept only to compare numbers during the month.

### Before the switch — every box ticked

- [ ] **Step 12 is finished**, and 0.8a / 0.8b are ticked in `05-roadmap.md` (read
      state is per run). Not negotiable: after this step it cannot be done
      without guessing.
- [ ] **The prerequisite audit is done** (D-20, `OWNER-CHECKLIST.md`): after a
      fresh workbook download, `npm run extract -- --fail-on-cycle` passes.
- [ ] **No slug collisions** (D-15): `seed/unresolved.csv` has zero
      `labels share a slug` rows.
- [ ] **`APP_PASSCODE` in Vercel is four or more random words** (D-23, R2-12).
- [ ] **The last nightly backup is green, restore check included** (10d, D-30),
      and a downloaded `GET /api/export` opens and lists every table the app
      has (D-17).
- [ ] You have used the deployed app for a few days, knowing it is disposable,
      until adding a run and marking reads feels faster than the sheet. **Do not
      cut over if it doesn't** — you will drift back, and the migration will have
      been wasted effort. This is the single most common way projects like this
      fail.

### The switch

```powershell
# 1. fresh export from Google Sheets, replacing Comics.xlsx and Books.xlsx
# 2. re-extract into seed-final/ (a later --out overrides the script's), failing
#    on any prerequisite cycle, and diff against the last seed
npm run extract -- --out seed-final --fail-on-cycle
Compare-Object (Get-Content seed/run_issues.csv) (Get-Content seed-final/run_issues.csv)
Compare-Object (Get-Content seed/issues.csv) (Get-Content seed-final/issues.csv)

# 3. load into production — THIS IS THE LAST LOAD OF PRODUCTION, EVER
.\etl\load.ps1 seed-final -EnvFile .env.live
```

**Immediately after that load, set `LEDGER_LIVE=true` in `.env.live`.** With that
line set, `load.ps1`, `load.sh` and `npm run rebuild` refuse to run against
production instead of wiping what the app holds. `.env` stays `false`:
development can still be rebuilt. **Also set the repo variable `LEDGER_LIVE` to `true`**
(Settings → Secrets and variables → Actions → Variables). From then on Release
migrates the live database instead of pointing you at a rebuild.

4. Rename the sheet `Comics (archive, to 2026-XX)` and set it **read-only now**.
   Edits to it no longer reach the app; prerequisite and catalog changes are
   made in the app from here (3.1–3.3).
5. Put the app URL in a note at the top of the archived sheet.
6. **Promote the wishlist** (task 1.4d, D-39): open `/books/add?from=wishlist`
   on production and work through the 497 lines from the old To-Read tab. Each
   one you accept becomes a Someday book. It only makes sense now: any load
   before this one would have erased the result. It can take several sittings;
   the lines wait.

### The month after

Use only the app. Once a week, compare a few numbers against the frozen sheet
(runs read, a run's issue count, books read this year). A disagreement is a bug
to fix in the app, not a reason to go back to the sheet.

**Do not delete the sheet.** Ever, but especially not in the first year.

**If the app doesn't stick:** `GET /api/export` returns every table as JSON, and
the nightly `pg_dump` gives a full Postgres dump. Neither is a spreadsheet, so
budget an afternoon to convert — but nothing is trapped.

**Done when:** a month has passed, the weekly comparisons agree, and you've gone
two weeks without opening the sheet.

---

# Part 5 — Everything after

## Step 15 — Phases 2 through 7

**Claude Code · open-ended · `05-roadmap.md` (milestones M10–M25)**

| Phase | Contents                                                                                    | Why this order                                                                                                          |
| ----- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2     | Settings, pace engine, sessions, books dashboard, plan editor, comics dashboard, true unlock cost, run and block completion (2.12, D-40) | Highest remaining value. Answers "is 2027 overcommitted" and "what does this run really cost". (2.11a was already built in Step 12) |
| 3     | Editing: inline fields, runs, prereqs, ratings, detail sheets, eras (book status moved to 1.5) | Lets you maintain the catalog in the app                                                                                |
| 4     | Metron and Open Library enrichment, covers                                                  | Makes it feel like a product. Prerequisite for Phase 7                                                                  |
| 5     | Shelves, tracks page, eras, ratings, DNF, `edition_issues`                                  | Fills in remaining surfaces                                                                                             |
| 6     | Stats, search, PWA, shortcuts, events, reading-session timer, better sign-in (6.13)          | Polish, in any order                                                                                                    |
| 7     | AI review and drafting, then the release digest                                             | Needs Phase 4's verification layer to be trustworthy                                                                    |
| 8     | Watchlist: TMDB client, search and add, season progress, detail sheets, franchises, shelves | **Self-contained — needs only Phase 0.** Pull it forward any time as a change of pace between the heavier comics phases |

**True unlock cost is task 2.6 now** (the old 6.2b was absorbed into it). It
counts the issues you still have to read to finish a run, prerequisites
included (D-22). The figure once quoted here (Immortal Hulk behind 4,173) is
withdrawn (R1-01); the real number is meaningful once your prerequisite audit is
done, which Step 14 already requires. Given that reaching Immortal Hulk is one
of your stated priorities, build 2.6 early in Phase 2.

## Ongoing maintenance

| Cadence                                      | Task                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| Monthly                                      | `npm outdated`, bump patch and minor versions                             |
| Quarterly                                    | Actions → Nightly backup: recent runs green (each restores its dump, 10d) |
| On a Next.js major release                   | Read the upgrade guide before bumping. This is the one that will bite you |
| When Neon or Vercel email about plan changes | Read it. Free tiers move                                                  |
| Before any risky change                      | `GET /api/export`                                                         |

## Optional: metadata enrichment

After cutover, covers and page counts:

```powershell
py etl/enrich_books.py                 # (task 4.2 — not built yet) Open Library: no key, send a real User-Agent
```

Comics cover dates, cover URLs, story titles and credits were backfilled in
Step 8c. Issues you add in the app after cutover need task 4.1, which writes to
the database directly instead of the sidecar CSVs. Enrichment never
overwrites a hand-entered value, and **word counts are never fetched** — no API
exposes them. See `architecture § Metadata sources.
