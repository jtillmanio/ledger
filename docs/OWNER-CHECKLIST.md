# Owner checklist

Things only the owner can do or decide. No agent task waits on an agent guessing
these. Tick them here; START-HERE has the commands.

## Before Phase 0 can finish

- [x] **Create the private GitHub repository** and push (R3-01). *Done, verified
      2026-09-30: the repo is private, `.gitignore` covers `.env`, `seed/` and
      `*.dump`, the `DATABASE_URL` secret is set and the nightly backup is green.* Task 0.2's check
      (a throwaway PR) and the nightly backup both need it. Confirm it is
      **private** — `backup.yml` commits database dumps into it — and that
      `.gitignore` covers `.env`, `seed/`, `*.dump` and any sidecar CSV you would
      not publish. Add the `DATABASE_URL` secret for the backup workflow.
- [x] **Create the test database and set `TEST_DATABASE_URL`** in `.env` (R3-02,
      D-R3-2). START-HERE → *Test database*. Until this is set, `npm test` refuses
      to run — by design. *Done: `npm run test:all` passed locally on 2026-09-30.*

## Releases (START-HERE 10e), before the next merge to `main`

- [x] **Vercel:** turn off *Auto-assign Custom Production Domains* (Settings →
      Environments → Production). Until then a merge still goes live at once.
      *Done: confirmed by the owner, 2026-10-02.*
- [x] **Secrets** `VERCEL_TOKEN` and `NEON_API_KEY`, **variables**
      `VERCEL_SCOPE`, `NEON_PROJECT_ID` and `LEDGER_LIVE=false`. *Done, verified
      2026-10-02 with `gh secret list` / `gh variable list`; also set are
      `VERCEL_AUTOMATION_BYPASS_SECRET` and `PRODUCTION_URL`, which the smoke test
      needs.*
- [x] **One dry run of Release** is green (Actions → Release → Dry run). *Done:
      run 36625396477, 2026-09-29: CI success, no migrations to apply.*
- [ ] At Step 14, set the `LEDGER_LIVE` variable to `true` alongside `.env.live`.
- [x] **Preview databases (10f):** `DATABASE_URL` out of Vercel's Preview
      scope, `LEDGER_LIVE_DB_HOST` in it, Neon's Vercel integration installed.
      Until then, previews of branches that include this change fail to build.
      *Done, verified 2026-10-02: the previews for #37 and #38 built.
      `scripts/vercel-build.mjs` refuses a preview with no integration database,
      with `LEDGER_LIVE_DB_HOST` unset, or with the live host.* *The
      integration does delete a preview's branch when its PR closes, seen
      2026-10-20 on #106: merged 15:09:00 UTC, and from 15:09:12 the still-running
      preview answered every page with `28P01 password authentication failed`
      while Lighthouse was still measuring. So a Lighthouse run that finishes
      after the merge fails for that reason alone; wait for it before merging.*

## Prerequisite audit (data work in `Comics.xlsx`, PREREQS tab)

The dashboards' readiness numbers are wrong until this is done (D-7). Nothing is
blocked on it: 2.4, 2.6 and 2.9 assert relationships, not counts.

- [x] **Break the hard-only cycle** of five runs: `gillen-uncanny`,
      `aaron-watxm`, `remender-xmen`, `axis`, `schism-regensis` (R0-01).
- [x] **Break the soft and mixed cycles** in the ~100-run component. **Done
      2026-10-25:** a fresh download passes `--fail-on-cycle` (0 cycles) and
      HANDOFF § Migrated data has the counts. Task 2.11a's
      loader check names each one as a `prereqs,prereq cycle` row in
      `seed/unresolved.csv` (runs first, then hard edges, then soft) after
      `npm run extract`. On the tracked 2026-09-29 `Comics.xlsx` it reports
      **0 cycles** (10 of the worksheet's 13 edges are reversed or deleted
      there): confirm on a fresh download with `npm run extract -- --fail-on-cycle`,
      then record the ready / blocked counts in HANDOFF (2.11a's Check).
      `/comics/<run>` shows a run under "Read these first" only if it is a
      genuine ancestor (the self-listing bug is fixed, R2-04).
- [ ] **Reclassify hard → soft where the dependency is taste, not comprehension.**
      230 of ~440 edges are hard, which leaves most runs blocked. A hard edge
      should mean *this is incomprehensible without that*; a recommendation is a
      soft edge. Work down from the runs with the largest `run_leverage` once 2.6
      exists; before then, start from the runs most often named as prerequisites.

## Decisions waiting on you

- [x] **Rereads (at task 0.8a).** Extract dropped 13 repeated placements in 4
      runs (`zdarsky-asm` had the same seven issues twice in a row). If any were a
      deliberate reread, 0.8a can bring them back with an explicit marker. The
      list is in `seed/unresolved.csv`, reason `repeat placement dropped`.
- [x] **Passcode (R2-12).** `POST /api/login` has no throttle. *Decided
      2026-10-02 (D-36): task 1.11 adds the one-second failure delay before
      cutover.* A passphrase of four or more words in `APP_PASSCODE` is still a
      Step 14 gate.
- [ ] **Books' reading position (from TASK-017, 1.9, PR #117).**
      Roadmap 1.9 asks for books In flight *with words left*, but nothing
      stores how far into a book you are, so 1.9 shows the word count. If
      you want words left, where should the position live (a page or percent
      on `book_status`, or a log of sessions), and which task builds it? It
      is a schema column, so it waits for your yes.

## Actions from follow-ups

Things only you can do that a PR left behind: secrets, dashboard and hosting
settings, production data. Claude adds each with where it came from; only you
tick them.

- [x] Once 0.11 (TASK-013) merges, run `npx playwright install chromium` in the
      repo after your next `npm ci`. Without the browser, `npm run test:all`
      fails at the e2e step; CI installs its own (from TASK-013, PR #98).
- [x] Set `METRON_API_TOKEN` (or `METRON_USERNAME` and `METRON_PASSWORD`, as
      in `.env.example`) in Vercel for Preview and Production. Without them Add
      issues' Search answers from your catalog only and says *Metron isn't set up
      here*. Needed before the 1.3b preview can search Metron (from TASK-006,
      PR #75). *Done: `METRON_USERNAME` and `METRON_PASSWORD`, confirmed by the
      owner, 2026-10-20.*
- [x] Create the `ledger-backups` R2 bucket and its bucket-scoped token, and
      add `R2_BACKUPS_ACCESS_KEY_ID`, `R2_BACKUPS_SECRET_ACCESS_KEY` (secrets)
      and `R2_ACCOUNT_ID`, `R2_BUCKET` (variables), as in START-HERE 10d.
      Until then every nightly backup fails at its upload (from D-66,
      `fix/backup-r2`). *Done: confirmed by the owner, 2026-10-20; nightly run
      39428179799 passed "Upload to R2 and prune" and "Restore check".*
- [x] Once a nightly backup is green in R2, decide whether to `git rm -r
      backups/` (it is a protected path, so only on your word). Removing it
      empties the folder, not the history: the old dumps stay restorable from
      git either way (from D-66, `fix/backup-r2`). *Done on the owner's word,
      2026-10-20, in `chore/owner-checklist-backups`; START-HERE 10d's
      "Restoring by hand" now says how to get one back from history.*
- [x] After 1.16 merges, run `npm run db:migrate` against the development
      database (`.env`) so its picked-day reads move to Eastern midnight (until
      then one dated the 1st reads a month early). When Release applies 0012 to
      production, don't save a picked date (range sheet, *Change date…*) until
      it has promoted the new build: the old build still writes a UTC midnight,
      which 0012 has already passed (from TASK-025, PR #94). *Done on
      development, 2026-10-20: all 14 migrations applied, through
      `0013_plan_period`. The production caution stands for the next Release.*
- [x] Decide the 43 `open library` rows in `etl/data/book_review.csv`: `merge`
      takes Open Library's spelling (`keep` is filled in), `separate` keeps yours.
      Some are real typos (*Inheritence*, *Seasons of Mists*), some are Open
      Library's padded titles (*… CD*, *[Dramatized Adaptation]*). Several
      unmatched books are author typos in `Books.xlsx` (*J.R.R. Tolkein*, *Terry
      Pratchet*, *Bernard Cornwall*, *James Ilsington*): fix the cell, or `merge`
      the author row extract proposes. Then `npm run enrich:books` (free from the
      cache except for changed names) and `npm run extract` (from TASK-022,
      PR #130). *Since 1.14b (PR #165), `enrich:books` drops the undecided
      `open library` rows and keeps the decided ones: decide any you care about
      before 1.14b's real run below; the rest lapse with it.*
- [ ] After 1.18 merges, settle what the first Calibre run left (from TASK-030,
      PR #150):
      - Decide the 246 `calibre` rows in `etl/data/book_review.csv`. `merge`
        takes Calibre's spelling (`keep` is filled in), and `separate` makes
        them two books. Many are workbook typos (*Rexa Aslan*, *Hitchhikier*,
        *Bernard Cornwall*). Until you decide a row, its Calibre book is held,
        and 14 of them carry a read.
      - Read `seed/calibre_changes.csv` after `npm run extract` (D-93; these
        were `calibre_books` rows in `unresolved.csv`). 98 series and 41 word counts were replaced by
        Calibre's, and 21 series differ from Open Library's (Narnia's
        chronological versus publication order, for one). Where Calibre is
        wrong, fix it in Calibre.
      - Re-run `npm run calibre` when Open Library answers again. 1,898 series
        weren't checked yet (it dropped the connections). The run is free
        from the cache for the rest.
      - Then run `npm run extract`, `npm run enrich:books` and
        `npm run extract`, so the 3,210 new books get their Open Library
        details.
      - *D-94 (2026-10-28):* 1.14b replaces Open Library's details and series
        check with Hardcover's, so the two Open Library re-runs above can wait
        for it instead.
- [x] Create a Hardcover API token (hardcover.app, your account's API Access
      page, with the narrowest read scope it offers) and set `HARDCOVER_API_TOKEN` in `.env`.
      1.14b's runs need it. Before 1.4f's preview, set it in Vercel for Preview
      and Production too; without it Add books searches your library only
      (D-94).
- [x] Before 1.14b's real run, fill the missing ISBNs in Calibre: select the
      books with no ISBN, *Edit metadata → Download metadata*, check what it
      found, then `npm run calibre`. About 345 Calibre books have none (fan
      fiction never does) (D-94).
- [ ] After 1.14b merges, the real run (from TASK-034, PR #165),
      in this order: `npm run extract` (calibre matches against
      `seed/books.csv`, so it needs a current one), `npm run calibre -- --dry-run`,
      `npm run calibre` (its series check asks Hardcover now
      and rewrites `calibre_books.csv` with a `hardcover` column; until it
      runs, extract notes no series differences), `npm run extract`,
      `npm run enrich:books -- --dry-run`, `npm run enrich:books` (a few dozen
      ISBN requests, then a search for each book with none; 5,000 a day), and
      `npm run extract`. It replaces the 2,061 Open Library rows in
      `book_details.csv`. Then decide the `hardcover` rows in
      `book_review.csv`, write `pick` on one row per book in
      `etl/data/hardcover_review.csv`, and run `enrich:books` and `extract`
      again. A compilation never matches (D-99): a collection like *Brief
      Cases* gets a `hand` row in `book_details.csv` if you want its details.
      Commit the sidecars the run writes. The same order, with what to review
      after each step: `docs/COMMANDS.md` § Refreshing the data. *Since 1.20
      (PR #168): every extract holds the books Hardcover
      doesn't know and Calibre doesn't have, and `enrich:books` still looks
      them up, so decide `etl/data/book_hold.csv` after the last extract,
      below.*
- [ ] After 1.20 merges and 1.14b's real run above, decide the books held in
      `etl/data/book_hold.csv` (from TASK-031, PR #168).
      Each is a workbook book Hardcover doesn't know and Calibre doesn't have:
      until you write `keep` it is no book, with no status, plan or release
      row. 181 were held on 2026-10-30, before the full run (100 of them on
      your to-read lists); the run will match some. `lookup` shows the search
      tried. For a typo, fix the title or author in `Books.xlsx` (or `merge`
      its `book_review.csv` row), then `npm run enrich:books`; for a book you
      want as it is, `keep`; then `npm run extract`.
- [ ] After 1.18b merges, settle what Calibre's groupings showed (from TASK-032,
      PR #162):
      - Decide the 181 rows in `etl/data/calibre_missing.csv`: workbook books
        Calibre doesn't have. `keep` keeps one out of Calibre; adding it to
        Calibre clears its row at the next `npm run calibre` and `npm run extract`.
        *Since 1.20 (PR #168): all 181 moved to
        `book_hold.csv`, the item above, because none has a Hardcover row yet.
        A book stays in `calibre_missing.csv` only once Hardcover knows it.*
      - Read the new `unresolved.csv` rows after `npm run extract`:
        - Seven workbook universe memberships Calibre doesn't share. *White
          Sand* Vols. 1–3, *White Sand* and *Horneater* aren't in Calibre;
          *The Lightning Theif* (a typo in the Riordanverse tab) and *The Sun
          and the Stars* aren't either.
        - *Of Kings and Killers* / *Of Killers and Kings* and *Of Dawn and
          Darkness* / *Of Darkness and Dawn* are two Calibre books each, merged
          into one Ledger book in `book_review.csv`. Merge them in Calibre, or
          separate the rows.
        - *Wars of Light and Shadow* and *War of Light and Shadow* are two
          series in Calibre, so one subseries sits under both.
        - *The Sunlit Man* has a `#subseries` but no series in Calibre.
- [ ] After 1.18c merges, fix four stray genres in Calibre's `#genre` (from
      TASK-033, PR #164). Each loads as a top-level genre today:
      - `l` on *Everything Is Tuberculosis* (John Green), and `i` on *Patterns
        of Evidence: The Exodus* (Timothy P. Mahoney): one letter each.
      - `Ecomonics` on 37 books and `Scie` on one: likely `Economics` and
        `Science`.
      Correct them in Calibre, then run `npm run calibre` and `npm run extract`.

## Approvals from follow-ups

Planning-doc edits and candidate decisions waiting for your yes
(`workflow.decisions` is `propose`). Tick one, or say "approve <item>" in a
session, and that session or the next `/track-follow-ups` run makes the change
and notes where it went.

- [x] Update `docs/03-data-model.md` § 2. Decisions and `docs/HANDOFF.md`
      § What each spreadsheet artifact became: the `To-Read 20XX` tabs row
      becomes "tabs before 2028; later tabs load nothing (D-70)" (from
      TASK-021, PR #97). *Approved by the owner 2026-10-20; done in
      `chore/owner-checklist-backups` (PR #106), both rows.*

---

# Closure sweep, 2026-09-20

A pass over R0–R3 against the repo as it stands, checking each review's own
pass criteria rather than its verdict. Verified by running things, not by
reading the ledger. **Verdict: not yet — four items below, then go.**

What is confirmed good: `run_ancestors` is the UNION rewrite and excludes the
target (R2-01, R2-04); `load.ps1`, `load.sh`, `rebuild.ps1` and `rebuild.sh`
all carry the `LEDGER_LIVE` guard (R2-02); `backup.yml` has `set -euo pipefail`
and a size assertion (R2-03); migration `0004` carries both precision columns
with the pairing CHECK and the `run_issues` UNIQUE (D-10, D-12); `--faint` is
`#606979` and `--faint-deco` exists (R0-08); `npx tsc --noEmit` and
`npm run lint` both pass clean; `npm run test:etl` is 36 tests, OK; every
command in CLAUDE.md's block resolves to a real script. `seed/` holds 10,285
issues / 10,822 placements / 259 runs / 1,478 books, matching CLAUDE.md,
README, HANDOFF and ARCHITECTURE.

`npm test` refuses with *TEST_DATABASE_URL is not set* — the guard behaving as
designed, and the reason the SQL and vitest suites could not be re-run here.

## Fix before the first task

- [x] **`/verify` tells the agent to write to the live database (new, HIGH).**
      `.claude/skills/verify/SKILL.md` ends with *"If the schema changed in this
      branch, also confirm the views still apply: `npm run db:push && npm run
      db:views`."* Both target `DATABASE_URL` — `drizzle.config.ts:7` for push,
      `scripts/sql.mjs live` for views — which is the Neon ledger. `db:push`
      alters and drops columns without a migration and has no `LEDGER_LIVE`
      guard, so after Step 14 a routine pre-PR verification can reshape live
      tables. Every review's write-path enumeration (R2 area E) covered
      `load.ps1`, `rebuild` and the API routes; none covered the skill.
      Smallest fix: change those two lines to `npm run test:db:reset` (which
      already applies migrations then `views.sql`, against `TEST_DATABASE_URL`
      only) and delete `db:push` from the skill. Consider also marking
      `db:push` in CLAUDE.md's command block as live-only-by-hand.

- [x] **The authority hierarchy was decided but never written down (R0 pass
      criterion, unmet).** D-1 settled it on 2026-09-20; `grep -i authority
      CLAUDE.md docs/05-roadmap.md` returns nothing. R0's third pass criterion is
      literally "the authority hierarchy is written into CLAUDE.md", and it is
      the rule that stops an agent believing FEATURES over `schema.ts`. Paste
      D-1 into CLAUDE.md as its own short section.

- [ ] **16 duplicate issue rows from case-only label variants (one-way door).**
      `seed/unresolved.csv` flags 16 `labels share a slug` rows and every one is
      the same comic spelled two ways: *Journey Into Mystery (2011)* #623–#636
      vs *Journey into Mystery*, *Marvel NOW! Point One* vs *Marvel Now!*, and
      *Marvel Graphic Novel #27: Emperor Doom* vs *… #27 - Emperor Doom*. They
      load as `…-623` and `…-623-2`, so the catalog total is 16 too high and
      reading one leaves its twin unread. Trivial now (fix the spelling in
      `Comics.xlsx`, re-extract, confirm the 16 flags are gone); after cutover
      it means hand-moving `issue_progress` rows with no script to do it. This
      is R2's `issues.id` door, still marked **unsure — owner call**.

- [x] **Confirm the three remaining one-way doors in `decisions.md` (R2 pass
      criterion, unmet).** R2's register has ten doors; `reading_plan`'s PK and
      date precision were since settled in roadmap 1.7 and D-10, and read-state
      grain is settled by 0.8a. Three are still unconfirmed: `issues.id`
      (the item above), **placement-id stability** — 0.8a assigns
      `run_issues.id` as a serial in sheet order, which is only safe because
      nothing reloads after cutover, so write that down — and the **export
      format**, `GET /api/export`, which omits `users` and is your exit ramp.
      One line each in `decisions.md` closes the criterion.

## Before Step 14, not before development

- [x] **The restore drill can't be run on this machine as written.** START-HERE
      10d is the accepted alternative to a restore task (D-14), and it calls
      `createdb`, `psql` and `dropdb`. R3 proved `psql` and `docker` are both
      absent here. Either install the Postgres client tools (you need them for
      the test database anyway) or rewrite 10d around `scripts/sql.mjs`, and
      then actually run it once against a real dump.
      **Resolved 2026-09-29 (D-30):** neither. The nightly backup job restores
      every dump into a scratch Postgres and checks it before committing it, so
      the drill runs in CI and nothing needs installing here.

- [x] Passcode throttle (R2-12) — already listed above, repeated here because it
      is the other Step 14 gate.

## Bookkeeping, no action needed from me to proceed

- [x] **`docs/review/UI_AUDIT_REPORT.md` has no ledger rows.** Its findings were
      never given individual statuses, though several clearly landed (`--faint`
      contrast, the `.emeter` rename, the telescope cell floor, 44px targets —
      all now CLAUDE.md rules). R0's "every prior finding has a status" is met
      for `claude/*.md` (R0-13, accepted unverifiable) but not for this file.
      Either triage it into LEDGER.md or declare it superseded by the CLAUDE.md
      rules and TASKS' UX floor. Residual v3 drift in `design/mockups.html` is
      now down to two `240k` figures and one `Home` tab label.

- [x] **`CLAUDE-CODE.md` and `CLAUDE-CODE-PROMPTS.md` were never reviewed.** No
      review file mentions either, yet they are what you will drive Claude Code
      with. Two stale spots found by spot-check: PROMPTS:834 and :1338 still say
      the plan holds **175 real rows** (D-13 made the plan start empty, and
      roadmap 2.8 was corrected); CLAUDE-CODE.md:2 calls `ci.yml` "the same four
      checks" when the file is one job of eight steps. PROMPTS also still points
      at the absent `claude/*.md` files (R0-13). A read-through of the HORIZON
      prompts against current TASKS is worth one sitting.

- [x] **No closure (C) review was run.** R0–R3 each produced BLOCKER and HIGH
      fixes, which is the protocol's trigger for it. This section is that check,
      done by verification rather than by a fifth review; if you want the formal
      artifact, it would add little beyond the four items above.

- [x] `.claude/settings.local.json` glanced at (R3 process note). It holds six
      permission entries and a `docs/` additional-directory, all benign; no
      `bypassPermissions`. `.claude/settings.json` is the read-guard hook only.

## ~~Still blocked on the two Phase 0 items at the top~~

*Resolved 2026-09-30:* the private repo (R3-01) and the test database (R3-02)
both exist, `npm run test:all` runs locally, and CI runs on every PR (task 0.2).

---

# Second pass, 2026-09-21

Done since yesterday, verified: `/verify` no longer writes to the live database
(it calls `test:db:reset` now); the authority hierarchy is in CLAUDE.md as
*"Which document wins (D-1)"*; the three one-way doors are `decisions.md` D-15,
D-16 and D-17; the UI audit is triaged at the foot of LEDGER.md; the drift in
`CLAUDE-CODE.md` and `CLAUDE-CODE-PROMPTS.md` is fixed (details at the bottom).

## The duplicates are not fixed in the file the ETL reads

- [ ] **Re-download the workbook, then re-extract.** `seed/unresolved.csv` was
      last written 2026-09-21 02:04, but every other file in `seed/` is from the
      2026-09-20 15:18 extract, and `etl/data/Comics.xlsx` has not changed since
      14:12 the day before. The local workbook still holds both spellings —
      14 `Journey Into Mystery (2011)` rows against 28 `Journey into Mystery`
      rows, and `Marvel Now! Point One #1` beside `Marvel NOW! Point One #1` —
      and `seed/issues.csv` still carries `journey-into-mystery-2011-623-2` and
      the other 15 twins. So the sheet edits went into Google Sheets and the
      `.xlsx` here is stale, or `unresolved.csv` was tidied by hand. Either way
      the fix is unverified until `npm run extract` runs against a freshly
      downloaded workbook and prints no `labels share a slug` rows.

## The two genuine collisions

Both are the same shape and both have the same answer, because **the label is
the primary key** (`issues.id` is its slug — now D-15). Two different comics may
not share a label, so one of each pair has to be spelled differently in the
sheet. Neither is a reread, so neither is an 0.8a case.

- [ ] **`X-23 (2010) #1`, twice in `liu-x-23` at sequences 1 and 2.** Your own
      Notes cell already settles it: sequence 1 is *"A separate one-shot, also
      numbered #1, that reconnects Laura to the NYX cast and sets up the
      ongoing"*, `Recommended`; sequence 2 is the ongoing's #1, `Core`. Rename
      the first to **`X-23: One-Shot (2010) #1`** — or whatever Metron's series
      name for it is, which is the better arbiter — and leave the ongoing alone.
      The note stays useful either way.

- [ ] **`X-Men Annual (2023) #1`, twice in `hickman-krakoa` at sequences 411 and
      457.** This one has no note and no type, and 46 placements separate them,
      which is consistent with two different annuals rather than a paste error.
      Look both up in Metron, take each one's canonical series name, and write
      the two distinct labels into the sheet. If it turns out they are the same
      comic in two places, it is a genuine reread instead, and task 0.8a's
      `run_issues.reread` marker is the right home for it — say so and 0.8a will
      drop the UNIQUE deliberately rather than by accident.

  Two riders on both. A hand-disambiguated label will not match Metron exactly,
  so `enrich_comics.py` may later propose renaming it back — reject that
  proposal in `label_review.csv` when it appears, or the collision returns. And
  any sidecar row already keyed to the old label needs rekeying; cheap now,
  since the sidecars are barely populated (D-5).

## Dark Reign: The Cabal — nothing to do

The sheet already says what you want: `hickman-ff` has `Completed = True` for it,
`bendis-dark-reign` has `False`. Today's flag exists only because read state is
still issue-keyed, so extract collapses the two into one global "read" and
reports the disagreement. Task 0.8a keys progress on the placement and the flag
disappears by construction. It is the cleanest fixture in the workbook for that
task, so I would name it in 0.8a's acceptance check:

- [ ] **Add to task 0.8a's check:** after `npm run rebuild`, *Dark Reign: The
      Cabal* reads as read in `hickman-ff` and unread in `bendis-dark-reign`,
      and `issue_read_runs` returns `{hickman-ff}` for it.

## The two you asked about

**Passcode (R2-12).** Nothing to decide today — it is a Step 14 gate, not a
development one. `POST /api/login` compares the submitted code to `APP_PASSCODE`
with no delay and no attempt limit, and a success hands over `GET /api/export`,
which is the whole ledger. What you need before go-live is one of these, and I
would take the first: set `APP_PASSCODE` in Vercel to **four or more random
words** (long enough that no throttle is needed), or ask for the one-second
delay on a failed attempt as a small task. Say which and I will either write it
into START-HERE Step 14 or add the task.

**The restore drill.** The problem is not the procedure, it is that you cannot
run it: START-HERE 10d calls `createdb`, `psql` and `dropdb`, and R3 proved none
of them are installed here. You need the Postgres client tools anyway if the
test database ends up local rather than a Neon branch, so:

- [x] **Install the PostgreSQL client tools** (the Windows installer's
      *Command Line Tools* component is enough — it gives you `psql`, `pg_dump`,
      `createdb`, `dropdb`), then run START-HERE 10d once against a real dump
      before Step 14. If you would rather not install anything, say so and I
      will rewrite 10d around `scripts/sql.mjs`, which needs only node — but
      `pg_dump` has no node equivalent, and the nightly backup already depends
      on it running in CI rather than here.
      **Superseded 2026-09-29 (D-30):** the drill now runs inside the nightly
      backup job, so the restore no longer needs these tools.

## What I changed in the prompt docs

`CLAUDE-CODE-PROMPTS.md` had nine prompts pointing at `claude/*.md` files that
do not exist (R0-13), so pasting them sent the agent hunting for
`pre-build-review.md`, `dashboard-v4-status.md` and `derived-run-fields.md`.
Each now points at the ledger row, decisions entry or CLAUDE.md rule that
actually holds the content. Also fixed: task 0.3's prompt told the agent to run
`npm run db:push` against "the dev database" and verify with `psql \d+ books` —
the same live-write hazard as the `/verify` one, now `test:db:reset` plus an
information_schema check; task 2.6's prompt described `run_ancestors` as capped
at 20 and asked the agent to confirm it was "raised to 50" (it is 48, and R2-01
rewrote the function entirely, so the prompt now says every old cost figure is
void); and 1.7 and 2.8 still promised 175 real plan rows, which D-13 made empty.
`CLAUDE-CODE.md` described `ci.yml` as "four checks" — it is one job of eight
steps, now listed — and its repo table was missing `.claude/rules/` and the
read-guard hook.

---

# Third pass, 2026-09-23 (S coherence audit)

Decided today (`decisions.md` D-18 … D-23) and written into TASKS, CLAUDE.md,
START-HERE and the prompts: load first, then run both for a month; no rereads
inside a run; prerequisite audit before cutover; finish year derived; unlock
cost counts unread issues; passphrase login now, better sign-in later (6.13).
START-HERE Steps 11–14 were rewritten, and **Step 14 now opens with a checklist
of gates**. The items below are the ones only you can do.

## Still blocking Phase 0 (unchanged)

- [x] **Private GitHub repo** (R3-01) — top of this file. Done 2026-09-30.
- [x] **`TEST_DATABASE_URL`** (R3-02) — top of this file. Done 2026-09-30. PostgreSQL 18 is
      already installed here through scoop (`psql`, `createdb` work), so the
      local option is `createdb ledger_test` plus the line in `.env`.

## Workbook, before cutover

- [x] **Run `py etl/enrich_comics.py --dry-run`, then without it.** Done: the
      sidecars were rekeyed at 01:29–01:45, after the 01:05 extract. An extract
      against the current sidecars reports **0** *keyed by pre-rename label* rows
      (was 5,428) and dates 10,120 issues (was 10,063). **Run `npm run extract`
      once** so `seed/` catches up with them.
- [x] **One `labels share a slug` row is left** in `seed/unresolved.csv`. Must be
      zero before Step 14 (D-15). It is `Ultimate Spider-Man (2000) #12` vs
      `#1⁄2` — not a misspelling: the id slug drops the fraction slash, so *#½*
      becomes `12`. (`Avengers (1998) #1⁄2` has the same shape but nothing to
      collide with.) **Fixed in extract (D-24):** a re-extract reports 0 slug
      collisions. `seed/` shows it after your next `npm run extract`.
- [x] **Relabel `X-Men Annual (2023) #1`** — done in the sheet: `#1 (Feb)` and
      `#1 (Nov)`. `X-23 (2010) #1` likewise became `#1 (May)` and `#1 (Nov)`.
- [x] **Soft and mixed prerequisite cycles** (74 runs in one component; the
      hard-only cycle is gone). A Step 14 gate (D-20). **You don't have to wait
      for 2.11a:** `docs/review/prereq-cycle-worksheet-2026-09-24.csv` lists the
      13 edges (11 soft, 2 hard) where a run "needs" something published after
      it. Deleting or reversing those 13 — any mix — removes every cycle
      (checked). Decide each in the sheet's PREREQS tab, then re-extract:
      2.11a now names every cycle left as a `prereqs,prereq cycle` row in
      `seed/unresolved.csv`. On the tracked 2026-09-29 `Comics.xlsx` there are
      **0** (10 of the 13 reversed or deleted, the graph acyclic). Confirm on a
      fresh download with `npm run extract -- --fail-on-cycle` (exit 0), then
      record the ready / blocked counts in HANDOFF. **Done 2026-10-25:** the
      fresh download passes, and the counts are in HANDOFF § Migrated data.
- [ ] **Answer `etl/data/book_review.csv`** (from task 1.13). For each pair,
      decide `merge` (and pick the `keep` spelling) or `separate`. An
      undecided pair loads as two rows. On the 2026-10-08 workbook, expect
      about 110 book, 40 author and 60 series pairs, a one-time pass: a
      decision survives every re-extract. Fixing a typo in the sheet itself
      works too.
- [ ] **Run `npm run enrich:books -- --dry-run`, then without it** (from task
      1.14). Then answer the `open library` rows it adds to `book_review.csv`
      and re-extract.

## Before Step 14

- [ ] Set `APP_PASSCODE` in Vercel to four or more random words (D-23).
- [ ] See one **Nightly backup** run go green with its *Restore check* step
      (START-HERE 10d, D-30; a manual run with *check only* ticked does the
      same without a new dump) and open one `/api/export` download.

## After Step 14's final load

- [ ] **Enter your reads in the app** (task 1.13, D-41: no read state loads from
      the workbook). `seed/workbook_reads.csv` lists each 2021–2025 Read-tab
      title with its year and any Top Books rank. Mark each one read through
      1.4c and 1.5; a book never on the master list is added by search. The
      top-10 ranks wait for 3.4.

- [ ] Promote the wishlist (START-HERE Step 14, *The switch* item 6; task 1.4d,
      D-39): work through `/books/add?from=wishlist` on production. When it
      shows nothing left, ask for the `chore/` PR that drops `wishlist` and
      `extract.py`'s `wishlist.csv`.

## Small questions for later, when their task starts

- [x] **1.4:** how similar must two titles be to flag a near-duplicate book?
      (`pg_trgm` similarity; 0.4 is a common starting point.) **0.4 (D-25), in roadmap 1.4.**
- [x] **0.8a:** add *Dark Reign: The Cabal* (read in `hickman-ff`, unread in
      `bendis-dark-reign`) to its check, as suggested in the second pass? **Yes (D-26), in 0.8a's check.**
- [x] **Fraction issue numbers in ids:** should extract slug `#1⁄2` as
      `…-1-2` (or `…-half`) instead of `…-12`? That fixes the last slug
      collision at the root rather than by relabelling in the sheet, and changes
      exactly two issue ids, harmlessly before cutover. It is an identity rule
      (D-15), so it waits for your yes. **Yes (D-24): done in extract, tested.**
- [ ] **9 orphaned sidecar rows** (new `unresolved.csv` reason, *sidecar row for
      a label not in the sheet*; none hand-typed): 4 in `cover_dates.csv`, 5 in
      `issue_details.csv`, for labels such as `Punisher: The End` and `Tales to
      Astonish (1959) #90`. Delete them if those comics are gone for good.
- [x] **Constraints R2 suggested** (schema changes, so they need your OK):
      `CHECK (type IN ('hard','soft'))` on `prereqs` before 3.3 lets you type
      edges, and the same kind of check on `events.verdict` and `runs.tier`.
      **Yes (D-27): specified in task 0.3's migration, values taken from the
      data** (verdicts are `read-it`, `tie-ins-only`, `summary-is-fine`).

## Optional cleanups — done by Claude, 2026-09-23

- [x] **Row counts in the narrative docs** — HANDOFF, README, FEATURES,
      ARCHITECTURE, `.claude/rules/ui.md` and the schema-reviewer agent now carry
      the 2026-09-23 extract (258 runs, 10,138 issues, 10,758 placements, 438
      edges, 21 levels deep). Dated findings (what the sheet looked like at
      migration) were left as history.
- [x] **Book title index (R2 L-2)** — the btree misnamed `books_title_trgm` is
      replaced by a real trigram index (`pg_trgm`, GIN on `books.title`) that
      the title search and task 1.4 can both use. `etl/views.sql`, asserted in
      `etl/test_views.sql`. Applies to the live database at your next
      `npm run db:views` or rebuild.
- [x] **Owner name / id in the loaders (R2 L-5)** — `load.sh` passes them as psql
      variables (an apostrophe in `OWNER_NAME` is proven safe), and both loaders
      refuse an `OWNER_ID` that isn't a slug. Yours is.
- [x] **Series list on `/books` (R2 L-7)** — prints the total, shows 40, and links
      to *Show all N* keeping your filters. `src/lib/series-list.ts`, tested.
- [x] **Orphaned sidecar rows (R2 L-8)** — extract now reports them (never
      deletes: some could be hand-typed). Tested; the diff against both workbooks
      changed nothing else in the output.
- [x] **Backup vs. a Neon upgrade (R2 L-9)** — the nightly job checks the server's
      major version first and fails with one line naming the change to make.
- [x] **Node version (R3 LOW 6)** — 22 everywhere: `package.json` `engines` (which
      Vercel follows), a new `.nvmrc`, and CI reads it. Your local Node 26 still
      works; npm prints an `EBADENGINE` warning on install.
