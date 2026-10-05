# Claude Code session plan — model, effort, and prompts per task

Companion to `TASKS.md`. For every task it gives: which model to run Claude
Code with, what effort level to set at each phase, and the Explore / Plan /
Implement prompts to paste in, following the four-phase loop in
`CLAUDE-CODE.md` §3. Review and commit (phase 4) uses one template for every
task — see below — so it isn't repeated per task.

**A note on "Fable."** Claude Code's model flag currently takes Sonnet or
Opus (whichever versions your CLI is pinned to); there's no Fable option
there, so nothing below calls for it. If a task ever needs a differently-tuned
model, that's a signal to do that piece somewhere other than Claude Code, not
a reason to force a mismatched model into the CLI.

**How to read the effort column.** Three values per task — explore effort /
plan effort / implement effort — because CLAUDE-CODE.md §5 already recommends
varying effort by phase (xhigh for implementation, high for planning and
review on the PC; high across the board on the phone). Review always runs at
**high**, same as every other task, which is why it isn't a column.

Model and effort follow task risk, not task size. A migration that's wrong in
a way nobody notices for three weeks (schema, derived views, anything
`pre-build-review.md` already caught once) gets Opus and high/xhigh effort
regardless of how small the diff is. Straightforward CRUD and layout work that
copies an established pattern gets Sonnet at a lower effort, even at size L.

---

## Read this first — TASKS.md wins over every prompt here

These prompts were written before the R0–R3 reviews and the S coherence audit
(2026-09-20 → 23) changed TASKS.md. The prompts below were corrected where the
audit found them wrong, but **`TASKS.md` is authoritative** (CLAUDE.md, *Which
document wins*): paste the prompt, and if it disagrees with the task, the task
wins and the difference is a bug in this file.

**Split tasks and their prompts.** R3 split several tasks. Where a half has no
section below, use the parent's prompt scoped to that half, and read the task's
own text in TASKS.md first:

| Task | Use |
|---|---|
| 0.8a / 0.8b | their own sections below |
| 1.3 parser and validation / **1.3c** review table and insert | the 1.3 prompt; the parser half touches no database, 1.3c does the insert |
| 1.8 app shell / **1.8b** thumb bar and contrast | the 1.8 prompt; 1.8b is the thumb bar and the contrast checks |
| 2.2 books dashboard / **2.2b** the plan rail | the 2.2 prompt; 2.2 leaves a placeholder slot, 2.2b builds the rail |
| 2.5 `layout.ts` / **2.5b** SVG and ladder | the 2.5 prompt; 2.5 is the pure geometry and its unit tests only |
| **2.0** Settings, **2.11a** cycle check | their own sections below |

**Decided since (decisions.md D-18 … D-23), and already in TASKS:** cutover
loads first, then the month of running both (D-18); no rereads inside a run,
`UNIQUE (run_id, issue_id)` stays (D-19); the prerequisite audit and 2.11a
happen before cutover (D-20); 1.5 drops `finished_year`, the year is derived
from `finished_on` (D-21); unlock cost counts **unread** issues (D-22); login
is a passphrase until task 6.13 (D-23).

---

## Changed by the R1 review (2026-09-20) — the prompts below predate it

Structural changes from `docs/review/R1-findings.md` and `decisions.md` D-7/D-8.
`TASKS.md` is authoritative; where a prompt below disagrees, the task wins.

- **New 2.0 Settings · S**, before 2.1 — no prompt below yet. It owns
  `/settings` and `reading_settings`; without it every capacity figure is a
  seeded guess.
- **New 2.11 Prerequisite audit** — since split (R3-15): **2.11a** is the
  loader cycle check (agent work, prompt below, built before cutover per D-20);
  breaking the cycles and re-classifying over-hard edges is the owner's, in
  `docs/OWNER-CHECKLIST.md`.
- **2.1b shrank to S**: after-the-fact minutes entry and *Recalculate from
  sessions* only. The start/stop timer, the timer chip, the *Tonight* card and
  *Estimated time to finish* moved to **6.12**.
- **Book status and finish date moved from 3.4 to 1.5** — "I finished a book"
  has to work in Phase 1. 3.4 is now ratings and top-books reorder.
- **No acceptance check asserts a figure copied from a mockup or from prose**
  (D-7). Readiness counts, unlock costs and capacity numbers are computed;
  checks assert relationships. The prompts for 2.6 and 2.9 below were corrected;
  if you find another literal, treat it as wrong.
- Also folded into their tasks: focus returns to the opener when a sheet closes
  (UX floor), nav renders only routes that exist (1.8), a failed write reverts
  the tick (1.8), *Start* navigates and never writes (1.10), the undo stack
  holds closures (1.2), the bare-year lane is grey until 2.8 (1.9).
- **R1-04 is settled** (D-10, migration 0004): `completed_at` is nullable with
  `completed_at_precision`, and `book_status.finished_on` is a date with
  `finished_on_precision`. `read_events` gets the same pair in 1.5.

---

## Two things in TASKS.md worth fixing before you start

Neither blocks starting Phase 0, but both will cause confusion mid-build if
they're not settled first.

1. **6.7 and 7.6 are the same task, listed twice** — both read "Release
   digest email · Vercel cron plus Resend free tier. Last, by your call ·
   S" word for word. Do it once. Since Phase 7's framing ("after Phase 4, not
   before") fits a feature that emails you about *verified* releases, I'd keep
   it as **7.6** and delete the **6.7** line rather than the reverse.
2. **6.2b is checked done but its own text describes unfinished work** — "☑
   ... What remains here is the run-list *sort* by unlock cost and by
   leverage, once the views from 2.6 exist." Either it's done and that
   sentence is stale, or it isn't done and the checkbox is wrong. I've written
   it up below as if the sort is still outstanding (folded into 2.9, which
   already renders the run list) — confirm that's right before you skip it.

---

## UI tasks — the design constraints travel with the prompt (Sept 2026)

`UI_AUDIT_REPORT.md` was folded into FEATURES.md, ARCHITECTURE §4, TASKS.md and
`design/mockups.html`. So a UI task's prompt does not restate the audit; it
points at three places, and every Explore prompt for a UI task should start with
this line:

```
read @docs/TASKS.md's "UX floor" paragraph and the task, then run
scripts/screen.sh <id> for each screen it touches and read
design/mockups-index.md's "Not shown, and why" list. tell me which parts of this
task have a drawn mockup and which do not, before proposing anything.
```

Where the mockup and the task disagree, the mockup wins — except for the items
in the index's *Not shown* list, where the task text wins and the gap is
part of the task. Implement prompts below carry only what is specific to the
task; the per-task metrics (14px cells, 24px hit areas, five badge states) are in
its TASKS.md entry.

---

## The review-and-commit prompt (phase 4, every task)

Model: whichever model you ran Implement with. Effort: **high**.

```
use the schema-reviewer subagent to review this diff against task <id>'s
acceptance criteria in TASKS.md. report gaps affecting correctness, not
style.
```

Then run `/verify`. If it's clean:

```
tick task <id> in TASKS.md, commit with a descriptive message, and open a PR
```

If `/verify` or the subagent finds something, fix it and re-run both before
committing — don't tick the box on a task whose own check hasn't passed.

For anything in Phase 1 or 3, TASKS.md's standing rule 5 also applies: run the
adversarial review pass (a subagent that sees only the diff and the task's
acceptance criteria, told to report correctness gaps only) before the
schema-reviewer pass. Both are in-scope for those two phases; schema-reviewer
alone is enough elsewhere.

---

## Master table

| Task | Size | Model | Explore | Plan | Implement |
|---|---|---|---|---|---|
| D.1 Draw a mockup screen the design doesn't have yet | L | Sonnet | medium | high | high |
| 0.1 Test harness | S | Sonnet | medium | high | high |
| 0.2 CI | S | Sonnet | low | medium | high |
| 0.3 Schema additions | M | Opus | high | high | xhigh |
| 0.4 Soft-delete everywhere | S | Sonnet | medium | high | high |
| 0.5 Volume-year normalization | S | Sonnet | low | medium | medium |
| 0.8a Read state per run — schema, ETL, views | M | Opus | high | high | xhigh |
| 0.8b Read state per run — the spine | S | Sonnet | medium | high | high |
| 1.2 Undo | S | Sonnet | medium | high | high |
| 1.1 Range marking | M | Opus | high | high | xhigh |
| 1.6 Resume pointer | S | Sonnet | low | medium | high |
| 1.3 Bulk issue entry — parser and validation | M | Opus | high | high | xhigh |
| 1.3c Bulk issue entry — review table and insert | M | Opus | high | high | xhigh |
| 1.3b Add issues from a Metron search | M | Opus | medium | high | xhigh |
| 1.4 Books bulk entry | M | Sonnet | medium | high | xhigh |
| 1.4c Add a book by search or by hand | M | Sonnet | medium | high | high |
| 1.4b Quick-capture inbox | S | Sonnet | low | medium | high |
| 1.4d Promote the wishlist into Someday | S | Sonnet | low | medium | high |
| 1.5 Dated reading log | M | Opus | high | high | xhigh |
| 1.7 One period column | M | Opus | high | high | xhigh |
| 1.8a Design tokens and control states | M | Sonnet | medium | high | high |
| 1.8 App shell | M | Sonnet | medium | high | high |
| 1.8b Thumb bar and contrast | S | Sonnet | medium | high | high |
| 1.10 Comics Up next queue | M | Sonnet | medium | high | xhigh |
| 1.9 Status screens | M | Sonnet | medium | high | high |
| 1.11 Slow down failed sign-ins (D-36) | S | Sonnet | low | medium | high |
| 2.0 Settings | S | Sonnet | low | medium | high |
| 2.1 Capacity view | M | Opus | high | high | xhigh |
| 2.1b Reading sessions — after-the-fact entry | S | Sonnet | medium | high | high |
| 2.2 Books dashboard | M | Opus | high | high | xhigh |
| 2.2b The plan rail | M | Opus | high | high | xhigh |
| 2.3 Plan editor | M | Sonnet | medium | high | xhigh |
| 2.4 Comics dashboard | L | Opus | high | high | xhigh |
| 2.5 The telescope — `layout.ts` | M | Opus | high | high | xhigh |
| 2.5b The telescope — SVG and ladder | M | Opus | high | high | xhigh |
| 2.6 Unlock cost, leverage, frontier | M | Opus | high | high | xhigh |
| 2.7 Rebalance and accepting overage | M | Opus | high | high | xhigh |
| 2.8 Place the unquartered | M | Sonnet | medium | high | high |
| 2.9 Run list, grouped (+ 6.2b sort) | M | Sonnet | medium | high | high |
| 2.10 Plan page as full-size rail | M | Sonnet | medium | high | xhigh |
| 2.11a Prerequisite cycle check (built before cutover, D-20) | S | Sonnet | medium | high | high |
| 3.1 Inline field editing | M | Sonnet | low | medium | high |
| 3.2 Create and edit runs (hand-edited why only) | M | Sonnet | medium | high | high |
| 3.3 Prereq editor | M | Opus | high | high | xhigh |
| 3.4 Book ratings and top-books reorder | S | Sonnet | low | medium | high |
| 3.5 Detail sheets — books and issues | M | Opus | high | high | xhigh |
| 3.6 Eras on the run detail | M | Opus | high | high | xhigh |
| 4.1 Metron backfill (cover_url) | M | Sonnet | medium | high | high |
| 4.2 Open Library / Hardcover backfill | M | Sonnet | medium | high | high |
| 4.3 Covers in the UI | S | Sonnet | low | medium | medium |
| 5.1 Shelves | M | Sonnet | medium | high | high |
| 5.2 Tracks page | S | Sonnet | low | medium | medium |
| 5.4 Ratings and post-read notes | S | Sonnet | low | medium | medium |
| 5.5 DNF with a reason field | S | Sonnet | low | medium | medium |
| 5.6 `edition_issues` parser | M | Opus | medium | high | xhigh |
| 6.1 Global search | M | Sonnet | medium | high | high |
| 6.2 Stats and year in review | L | Sonnet | medium | high | high |
| 6.3 Prereq graph visualization | M | Opus | medium | high | xhigh |
| 6.4 PWA: offline writes | M | Opus | medium | high | xhigh |
| 6.5 Keyboard shortcuts | S | Sonnet | low | low | medium |
| 6.6 Goodreads / StoryGraph import | M | Sonnet | medium | high | high |
| 6.8 Events page | S | Sonnet | low | medium | medium |
| 6.10 Master list: fits budget, pick one, saved views | S | Sonnet | low | medium | medium |
| 6.11 Density toggle | S | Sonnet | low | low | medium |
| 6.13 Better sign-in than one passcode | M | Opus | high | high | xhigh |
| 6.9 Revisit the theme | M | Opus | — | — | high |
| 7.1 Proposals table and API plumbing | M | Opus | high | high | xhigh |
| 7.2 Verification gate | M | Opus | high | high | xhigh |
| 7.3 Review a run's reading order | M | Opus | high | high | xhigh |
| 7.4 Review a block or track | M | Opus | high | high | xhigh |
| 7.5 Draft a new run from scratch | L | Opus | high | high | xhigh |
| 7.6 Release digest email | S | Sonnet | low | medium | medium |
| 8.1 Schema and TMDB client | M | Opus | high | high | xhigh |
| 8.2 Search and add | M | Sonnet | medium | high | high |
| 8.3 Lists and season progress | M | Opus | medium | high | xhigh |
| 8.4 Detail sheets — film, show, season | M | Sonnet | medium | high | high |
| 8.5 Franchises | M | Sonnet | medium | high | high |
| 8.6 Title shelves | S | Sonnet | low | medium | medium |
| 8.7 Watch dashboard | M | Opus | high | high | xhigh |
| 8.8 Watch status | S | Sonnet | low | medium | high |

Task 0.6 is already done and isn't repeated below.
---

## Design pass — before the UI tasks that need it

### D.1 Draw a mockup screen the design doesn't have yet
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the Sept 2026 audit's screens are all drawn (`tracks`, `queue`,
`issuedetail`, `session`, `batch`, `rebalance`, `states` and the rest — see
`design/mockups-index.md`). What is left is the *Not shown, and why* list, and any
screen a later task turns out to need. This is not application code: it edits
one HTML file and one markdown index, never `src/`. Run it per screen, before
that task's Plan phase — for example the books and watch status empty slates
before 1.9, or the dark-theme review of the new screens before 6.9.

**Explore**
```
read design/mockups-index.md's "Not shown, and why" list and run scripts/screen.sh
on the two existing screens closest to the one I name, so the new screen is
built from the same components (.group, .row, .btn, .sheet, .bdg) and not
invented. do not edit anything yet.
```

**Plan**
```
write a plan to draw <screen id> as a new <section class="screen"
data-id="<id>"> with a phone frame and a desktop frame, light theme, plus a
notes block in the same style as its neighbours. list the states it must show
(empty, loading, error where the audit names them), the touch-target and
contrast floors from TASKS.md's UX floor, and which existing screens must link to
it. do not touch src/.
```

**Implement**
```
implement the plan. use the shared media nav and sidebar markup exactly as the
other screens do, add the row to design/mockups-index.md (its line range comes
from the file, not from memory), and remove the screen from the "Not shown, and why"
list. keep the </section> of the screen as the first </section> after its
opening tag, because scripts/screen.sh depends on that. open the file at 360px
and 1280px and look at both frames yourself before showing me.
```

---

## Phase 0 — Foundation

### 0.1 Test harness
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** mostly scaffolding (Vitest + a `pg` test database), but every later
task's acceptance check depends on this being right, so the plan and
implementation still deserve full attention even though the code itself
isn't algorithmically hard.

**Explore**
```
read @docs/TASKS.md task 0.1 and @docs/CLAUDE-CODE.md section 1. is there any existing
test config in the repo (vitest.config, a __tests__ folder, a test script in
package.json)? how does the rest of the stack expect to reach Postgres — read
@src/db and .env.example — so the test database can reuse the same
connection code instead of a second copy of it.
```

**Plan**
```
write a plan for task 0.1. it needs vitest, a way to stand up a throwaway
Postgres test database (or a schema/transaction-scoped fixture against the
same Neon database — say which you're choosing and why), and one integration
test seeding three runs with two issues each, one prereq edge, asserting
run_readiness returns blocked then ready-all after the prereq is marked read.

name every file you'll create, including the vitest config and any test
helper/fixture module, and say what's out of scope (no UI tests here, no CI
yet — that's 0.2).
```

**Implement**
```
implement the plan.

write the run_readiness test first, watch it fail for the right reason (no
harness yet), then build the harness under it. run `npm test` and show me the
output — don't summarize it.
```

---

### 0.2 CI
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** `pre-build-review.md` §3 already diagnosed exactly why the committed
`.github/workflows/ci.yml` can't pass — no lockfile, no eslint config, vitest
missing, and `db:views` is CMD-only syntax reading the wrong environment. This
is "make it pass," not "build it," and the fixes are already specified.

**Explore**
```
read @docs/TASKS.md task 0.2, @.github/workflows/ci.yml, and @package.json.
confirm which of these are still true: no package-lock.json, no eslint
config, eslint and vitest not in devDependencies, no test script, and
db:views using CMD-only syntax that reads the process environment instead of
.env.
```

**Plan**
```
write a plan for task 0.2 that fixes exactly what explore confirmed:
npm install to generate and commit package-lock.json, add vitest,
@vitejs/plugin-react, eslint and eslint-config-next as devDependencies, add a
test script, and rewrite the db:views script to be portable (works in
PowerShell, Git Bash, WSL and CI, fails loudly if DATABASE_URL is unset).

name every file you'll touch. this task is "make the committed workflow
pass," not "write a new one" — don't restructure ci.yml's jobs.
```

**Implement**
```
implement the plan. open a throwaway PR and confirm the ci.yml job goes
green — paste the run URL and its conclusion, don't just say it passed.
```

---

### 0.3 Schema additions
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** one Drizzle migration carrying the remaining additions: new tables
`reading_settings`, `eras` (+ `run_issues.era_id`), `volume_rules`, `shelves`
(`kind` CHECK books|titles) and `shelf_books` — **not** `shelf_titles`, whose
`titles` target does not exist until 8.1 (R3-04) — plus `word_count_source`,
`page_count`, `books.cover_url`, `book_status.notes`, and `deleted_at` on `runs`,
`issues`, `books` **and `run_issues`** (R3-06). Get the shelves shape wrong
(`shelf_items` instead of typed tables — `ARCHITECTURE.md` §2.5e) and you're
redoing a migration against a live database later.

**Explore**
```
read @docs/TASKS.md task 0.3, @docs/FEATURES.md Part 5, @docs/ARCHITECTURE.md section 2.5e
(shelves) and section 2.10 (eras), @src/db/schema.ts, and
@docs/review/LEDGER.md rows R0-C1, R2-10, R3-04, R3-05 and R3-06. R0-C1 and
R2-10 are fixed (saveBookStatus; completed_at already nullable in 0004), and
book_status.finished_on is already a date (0004) — this task touches none of
them.

list every column and table this task must add, cross-checked against what's
already landed in migration 0002 per HANDOFF.md — I don't want to re-propose
blocks, cover_date, cover_date_source, or metron_id, which already exist.
```

**Plan**
```
write a plan for task 0.3: one Drizzle migration for exactly the additions
TASKS 0.3 lists. shelves(kind) plus shelf_books only — no shelf_titles, no
polymorphic shelf_items. run_issues.deleted_at is required. out of scope:
reading_plan (task 1.7), book_status.finished_on (already done in 0004),
issue_progress.completed_at (already nullable), the book-status route (fixed).

name every file, including the migration and any query/route files finding
2.6/2.7 touch, and say what's out of scope.
```

**Implement**
```
implement the plan. run `npm run db:generate`, read the generated SQL
yourself before applying anything, then `npm run test:db:reset`, which applies
`drizzle/*.sql` in order and re-applies views against TEST_DATABASE_URL. never
run `db:push` or anything else against DATABASE_URL — that is the live ledger.
confirm the new columns with an information_schema query, then `npm run
test:all` and show me it passes.
```

---

### 0.4 Soft-delete everywhere
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** mechanically simple (`deleted_at IS NULL` on every read, a partial
index per soft-deletable table) but touches every query file and view, so a missed spot is a silent bug rather
than a loud one. `pre-build-review.md` §3.1 flags that the schema-reviewer
subagent will wrongly flag every pre-0.4 query for this — make sure that gate
is dated correctly before you rely on the subagent here.

**Explore**
```
read @docs/TASKS.md task 0.4 and @CLAUDE.md's soft-delete rule, then
@.claude/agents/schema-reviewer.md check 3. the gate "from task 0.4
onward" was added by ledger row R0-07 — confirm it is still there before you
rely on the subagent here.

list every query file under src/db, and every view in etl/views.sql, that
reads runs, issues, run_issues or books, so we know the full surface this task
has to touch.
```

**Plan**
```
write a plan for task 0.4: add deleted_at IS NULL to every read query and
view listed in explore, plus a partial index on each of the four soft-deletable
tables (runs, issues, run_issues, books). name every file you'll change and
the three tests in the task's Check: a soft-deleted run leaves listRuns while
its issues and prereq edges still exist; a soft-deleted placement keeps its
progress row and restoring it brings the read mark back; re-adding a removed
issue restores the original row rather than inserting one.
```

**Implement**
```
implement the plan. run the soft-delete test and show the output. then grep
the codebase yourself for any remaining unfiltered read against runs, issues,
run_issues or books and fix what you find — don't rely only on the file list from the
plan.
```

---

### 0.5 Volume-year normalization
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** the hard part (67 rules across 61 series, zero unmatched) is already
done per the task's own note. What's left is two small, well-bounded string
fixes.

**Explore**
```
read @docs/TASKS.md task 0.5 and HANDOFF.md section 5. confirm the two remaining
items: normalizing leading "The" (137 vs 100 bare labels for
Amazing Spider-Man) and converting the three "X-Men (vol. 2) #177-179" labels
to "(1991)". show me the current etl/extract.py logic that would need to
change for each.
```

**Plan**
```
write a plan for task 0.5 covering exactly those two fixes in
etl/extract.py's label normalization, plus how you'll verify: re-run
etl/extract.py --volume-map, diff issues.csv against the previous extract,
confirm only the intended labels changed and the row count is identical.
```

**Implement**
```
implement the plan, run the diff yourself, and paste the diff summary (labels
changed, row count before/after) rather than describing it.
```

---

### 0.8a Read state per run — schema, ETL and views
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** it reverses a shipped decision (0.7's read-everywhere) across the
schema, the extract, the loaders and six views at once. The rollup semantics
are subtle: runs count their own placements, while blocks and tracks count
distinct issues, read if any placement in scope is read. Get it wrong and the
comics numbers quietly disagree with each other. It must land before 1.1, 1.5
and 1.6.

**Explore**
```
read @docs/TASKS.md task 0.8a, ARCHITECTURE.md 2.11 and 2.14, @src/db/schema.ts,
@etl/views.sql and the progress section of @etl/extract.py. list every view,
query, route and loader that joins issue_progress on issue_id today, and say
how each one's meaning changes when progress keys on the placement.
```

**Plan**
```
write a plan for task 0.8a: run_issues.id serial PK (assigned in sheet order,
D-16) with UNIQUE (run_id, sequence) DEFERRABLE INITIALLY DEFERRED; the
existing UNIQUE (run_id, issue_id) STAYS (D-19 — no rereads, no reread column);
issue_progress keyed (user_id, placement_id) with its precision columns and
pairing CHECK carried over unchanged; extract writes one progress row per
Completed sheet row (blank date, precision none) and drops the "completed in
one run, not another" flag; run_progress/run_readiness over the run's own
placements; block/track/catalog rollups count an issue read when any placement
in scope is read; new issue_read_runs(user_id, issue_id, run_ids[],
first_read_at, first_read_precision); /api/progress/issue takes a placement id.
the spine UI is task 0.8b, not this one.

this is a rebuild, not a data migration — confirm LEDGER_LIVE is unset first.
name every file, and list the view assertions you'll add to test_views.sql.
```

**Implement**
```
implement the plan. write the view tests first: one issue in runs A and B,
read in A only — A counts it, B doesn't, the track counts it once as read,
issue_read_runs returns {A}; an approximate first read reports approximate; a
prereq run whose issues are all read elsewhere is still unfinished; inserting
the same issue twice into one run is still rejected. then re-run extract
against both workbooks, diff the CSVs, run npm run rebuild and paste the
progress row count (76, every one NULL date / precision none).
```

---

### 0.8b Read state per run — the spine
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the hint is the whole point of per-run read state, and its
accessibility rules are easy to get subtly wrong.

**Explore**
```
read @docs/TASKS.md task 0.8b, the "Run detail — eras" frame in
design/mockups.html, and how the spine renders rows today. 0.8a must be merged.
```

**Plan / Implement**
```
the spine markup: .chk is a button with aria-pressed and an aria-label naming
the issue and "in this run"; the grey "read in <run>" hint (+N past one run)
has a sr-only "Previously read in" lead-in, is grey never green, and is hidden
on rows already read here; "+N" is a button that opens the issue sheet (3.5).
write the render tests first: B's row carries "read in A"; a row read here
shows no hint; every .chk has an accessible name and aria-pressed.
```

---

## Phase 1 — Daily use

In build order, which is not ID order (TASKS.md Phase 1, *Build order*).
1.3c uses the 1.3 prompt and 1.8b the 1.8 prompt (see the split table above);
2.11a, built at the end of this phase (D-20), has its prompt in Phase 2.

### 1.2 Undo
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** an in-memory last-action stack with Ctrl+Z and a toast — well-scoped,
but has to correctly restore `completed_at` and status together across three
different action types (single mark, range mark, status change), which is
easy to get subtly wrong on the range case.

**Explore**
```
read @docs/TASKS.md task 1.2 and whatever task 1.1 built for range marking (read
it even if you didn't build it this session — the undo stack has to cover
range marks too). what does a mark/status-change request currently return
that undo would need to restore prior state?
```

**Plan**
```
write a plan for task 1.2: an in-memory action stack, Ctrl+Z binding, and a
toast with an undo button, covering single marks, range marks, and status
changes. be explicit about what "prior state" means for each of the three
action types, including completed_at.
```

**Implement**
```
implement the plan. write the test first: mark an issue, undo, assert the
exact prior state including completed_at is restored. then do the same for a
range mark and a status change.
```

---

### 1.1 Range marking
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** shift-click on desktop and long-press on mobile have to resolve to
the same one-request range write, the date-prompt logic branches four ways
(today / picked date / spread across range / none), and the acceptance check
is a performance bar (196-row single round trip on a 641-issue run) as much as
a correctness one.

**Explore**
```
read @docs/TASKS.md task 1.1, @src/components/IssueRow.tsx, and the spine/range
interaction described in design/mockups.html for the run detail screen. how
does the existing single-issue mark-as-read request work end to end, and
where would a range-write request and its date-prompt UI live without
duplicating that path?
```

**Plan**
```
write a plan for task 1.1: shift-click and long-press both resolve to one
range-write call, never N single-issue calls; a row menu offering "mark
everything through here"; the date prompt (today / picked date / spread
across the range / no date) firing only for a range, never a single tap.

name every file you'll create or change and say what's out of scope
(unmarking a range, multi-select across runs).
```

**Implement**
```
implement the plan. write the test first: marking issues 5-200 of a seeded
run in one call, asserting 196 issue_progress rows (one per placement) and
exactly one round trip, and that an issue in the range which another run also
places stays unread in that other run (task 0.8). then open hickman-krakoa (641 issues) locally, mark a 100-issue range,
and confirm — by watching it, not assuming — there's no visible stall.

also build "Adopt N prior reads" in the run hero, acting on this run only,
previewed, undoable, with an "Original dates" mode. add the hero's copy menu
(unread / all / as ranges). test that one undo removes exactly the adopted
placements.
```

---

### 1.6 Resume pointer
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** small and fully derived — no new storage, just "lowest unread
sequence" — but it has to actually never be stored, since that's the point of
the task.

**Explore**
```
read @docs/TASKS.md task 1.6. where does run_progress or a sibling view already
expose sequence and read state per issue, so the resume pointer can be a
query rather than a column?
```

**Plan**
```
write a plan for task 1.6: a derived query or view returning the lowest
unread issue sequence per in-progress run, and the dashboard "Continue: ..."
link using it. confirm nothing gets stored.
```

**Implement**
```
implement the plan. write the test first: a run with issues 1-5 and 7 read,
assert the pointer returns issue 6.

the pointer lives on the telecard: the state badge reads "42 / 381" with no
prerequisite badge, and phone and desktop render the same badges from one
component. Resume and the thumb bar's "Mark #141 read" are the same verb.
```

---

### 1.3 Bulk issue entry with validation
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** TASKS.md calls this "the single highest-risk feature" itself — six
ordered validation rules, a grammar with real edge cases already identified
in your data (302 freeform labels, 59 series with ambiguous volumes, an
8-volume Captain America case), and nothing may write until the user
confirms. This is the task CLAUDE-CODE.md's own worked example is built
around — reuse its prompts nearly verbatim.

**Explore**
```
read @docs/TASKS.md task 1.3, @src/db/schema.ts, @src/components/IssueRow.tsx, and
the "Bulk add" section of @design/mockups.html.

how does the existing optimistic-update pattern work, and where would the
bulk-add route and its parser live?
```

**Plan**
```
write a plan for task 1.3. the six validation rules and their order are in
the task. the pipeline shape is DIAGRAMS.md section 6. the UI is the
"Bulk add" screen in design/mockups.html — match its states and copy.

name every file you'll create or change, and say what's out of scope.
```

**Implement**
```
implement the plan.

write the parser tests first, against a fixture covering all six validation
rules including the Captain America eight-volume case and a freeform label
like "Dark Reign: The Cabal".

run the tests and fix failures. address root causes — do not loosen
assertions to make a test pass.

the header and button count the real insert (expanded lines minus
duplicates), the review table has five columns (kind, line, why, check,
decision) with radiogroup decisions and aria-invalid on failures, and an
insertion preview shows three rows either side of the insertion point with an
"Insert after" picker. test the count against a 10-line paste with one
duplicate.
```

---

### 1.3b Add issues from a Metron search
**Model:** Opus · **Effort:** explore medium / plan high / implement xhigh
**Why:** it puts Metron on a live path for the first time. That means a
20/min budget, a server-only client, a cache shared with the enrichment
script, and a label normaliser that has to agree with 1.3's grammar. It also
has to reuse existing issues rather than duplicate them, and fail over
cleanly to *Type it*.

**Explore**
```
read @docs/TASKS.md task 1.3b, ARCHITECTURE.md 2.15, the "Add issues — search"
screen in design/mockups.html (scripts/screen.ps1 addsearch), the Metron
client and cache in @etl/enrich_comics.py, and whatever 1.3 built for the
review table and insert. can the TypeScript side reuse the Python cache, or
does it need its own? how does enrich map a Metron issue to our label grammar?
```

**Plan**
```
write a plan for task 1.3b: catalog-first search, then Metron on submit,
server-side only, rate-limited and cached; results rendered with cover and
cover date; "in N runs" / "already in this run" states; staged rows go through
1.3's review table and insert; a Metron result creates the issues row with
metron_id and metron-sourced cover date and cover; failure falls back to
Type it with the query carried over. name every file; say what's out of scope.
```

**Implement**
```
implement the plan against a recorded Metron fixture — no live calls in tests.
write the tests first: "thor 337-340" adds 4 issues with metron_id and
4 placements; re-search shows them as already in this run; an issue already
in another run is reused; a Metron error writes nothing and shows the
fallback; no page render calls the Metron client.

render loading, rate-limited (Retry-After countdown) and error states as
role="status" lines that each offer "Type it instead", and reuse the 1.3
insertion preview. test with a mocked 429.
```

---

### 1.4 Books bulk entry
**Model:** Sonnet · **Effort:** explore medium / plan high / implement xhigh
**Why:** same shape as 1.3 but a smaller grammar (two formats, not a full
label grammar) and it's landing after the harder task exists as a reference —
Sonnet at high effort should handle matching an established pattern; keep
implement at xhigh because trigram-similarity thresholds are the kind of
thing that looks right on the happy path and wrong on real titles.

**Explore**
```
read @docs/TASKS.md task 1.4 and whatever 1.3 built for the parser/review-table
pattern. how does 1.3's "review table (accept / fix / drop) before insert"
UI work, and can books bulk entry reuse that component rather than building a
second one?
```

**Plan**
```
write a plan for task 1.4: parse "Title — Author" and "Title (Series #N)",
match against the existing catalog, create what's missing, flag
near-duplicates by trigram similarity. reuse 1.3's review-table component if
explore confirmed it's reusable; say so explicitly if it isn't and you're
building a second one.
```

**Implement**
```
implement the plan. write the test first: a fixture of 15 lines where 9
already exist and 6 don't, asserting 6 inserts, 9 matches, zero duplicates.
run it and paste the output.
```

---

### 1.4c Add a book by search or by hand, to a destination
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** one sheet with three entry points and three destinations. It's
mostly wiring over 1.4's matcher, plus a live Open Library call. The trap is
duplicates: a by-hand book and an Open Library result for the same title must
land on one row.

**Explore**
```
read @docs/TASKS.md task 1.4c, ARCHITECTURE.md 2.15, and the "Add books" and
"Shelves" screens in design/mockups.html. what did 1.4 build for matching and
near-duplicate detection, and where do book_status, reading_plan and
shelf_books get written today?
```

**Plan**
```
write a plan for task 1.4c: one add sheet opened with a preselected
destination. this task ships Someday (to_read, no plan row — the default) and
a shelf; plan where On deck (1.7) and Year or quarter… (2.3) will slot in
without rework, but don't build them (D-37). library first,
then Open Library on submit; By hand with title and author required; create
or reuse the books row, then the destination row, in one transaction. name
every file.
```

**Implement**
```
implement the plan with a recorded Open Library fixture. tests first: an Open
Library result added to a shelf creates one books row and one shelf_books row;
adding it again by hand reuses it; a by-hand book without pages lands in
Someday (to_read, no plan row); an Open Library failure writes nothing and
leaves By hand usable.
```

---

### 1.4b Quick-capture inbox
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** one text field, zero required fields — genuinely simple. The only
sharp edge is that resolving an inbox row has to route into the *existing*
bulk-add or New Run flows rather than becoming a third entry path.

**Explore**
```
read @docs/TASKS.md task 1.4b and FEATURES.md #21. where on the dashboard should
the unresolved-count badge live per design/mockups.html, and what does
"resolving routes into bulk add or New Run" mean concretely — does it
pre-fill the raw_text into those existing forms?
```

**Plan**
```
write a plan for task 1.4b: the inbox table write path (raw_text only,
optional books/comics tag), the dashboard badge and list, and resolving a row
by pre-filling it into the existing bulk-add or New Run flow rather than
building new entry UI.
```

**Implement**
```
implement the plan. write the test first: an inbox row saves with only
raw_text set, and resolving it links book_id or run_id and stamps
resolved_at.

the kind control is Books, Comics, Watch, Unsure; a Watch note resolves to
/watch/add pre-filled. show the inbox count as a chip on each dashboard lede.
```

---

### 1.4d Promote the wishlist into Someday
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** 1.4 already built the review; this feeds it 497 lines it was not
written for. The traps are the sheet's plain-hyphen `Title - Author` form, lines
that name a series instead of a book, and running it before the final load,
which would erase the result (D-39).

**Plan / Implement**
```
read @docs/TASKS.md task 1.4d and decision D-39. write a plan: a one-off
/books/add?from=wishlist that pre-fills 1.4's paste-a-list review with the
unresolved wishlist lines (book_id IS NULL), workbook order, grouped by genre;
plain-hyphen lines parse like em-dash ones; series-looking lines are flagged
"series?"; accept creates or reuses the book as to_read (Someday, no plan row)
and sets wishlist.book_id; dismiss deletes the line. then implement it, tests
first, with the task's five-line fixture.
```

---

### 1.5 Dated reading log
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** this is an event-sourcing change to two tables you'll be querying
for years — `read_events` becomes the log, `book_status`/`issue_progress`
get projected from it rather than written directly, a re-read has to append
not overwrite, and the migration must backfill existing years to an
approximate date and stay reversible. Getting this wrong now is exactly the
kind of mistake the task's own deadline framing warns about.

**Explore**
```
read @docs/TASKS.md task 1.5, FEATURES.md #22, and decisions.md D-10 (a date
is stored with its precision; `read_events.finished_on_precision` is this
task's half of it). `completed_at` is already nullable — migration 0004 did it,
ledger row R2-10.
how do book_status and issue_progress get written today, and what would
"project from read_events" mean for each call site?
```

**Plan**
```
write a plan for task 1.5: backfill existing finished_year values to
finished_on = YYYY-07-01, precision approximate (none when there is no year),
then DROP finished_year (D-21) and move every reader to extract(year FROM
finished_on): books_by_year and the status_user_year index in etl/views.sql,
listBooks / its year filter / readWithoutYear in src/db/queries.ts, the books
page, and saveBookStatus in src/db/writes.ts. extract.py emits finished_on and
finished_on_precision instead of finished_year. make issue_progress.completed_at
user-editable. add read_events (with finished_on_precision and the pairing
CHECK) as the log; book_status and issue_progress become projections from it,
so a second read appends a row with reread_of set. comic events key on
placement_id (0.8a). own the status control (to_read → reading → read | dnf)
on the master-list row and the book sheet.

name every call site that reads or writes finished_year, book_status or
issue_progress and how it changes. the down migration must be lossless —
unlike drizzle/down/0004, a precision-none row stays none.
```

**Implement**
```
implement the plan. write the tests first: a book finished 2024-03-11 appears
in both a March 2024 and a 2024 query; a book marked read through the UI
appears under its year's chip; reading it again creates a second read_events
row with reread_of set and leaves the first intact; book_status still reports
exactly one current status; marking read leaves an existing rating intact.
then run up → down → up against the TEST database (npm run test:db:reset,
never DATABASE_URL) and assert the row values and precisions survive.
```

---

### 1.7 One period column on `reading_plan`
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** collapsing two legacy columns into one regex-checked `period` text
column that holds three of the four to-read levels (D-37) — a quarter, a bare
year, `on_deck` — while Someday stays derived (no plan row), plus views that
expose year/quarter/level so nothing else ever parses the string. Months are
gone (D-38), so `plan_granularity` is dropped too. The down migration has to
reconstruct the legacy columns without losing a row, and refuse while an
`on_deck` row exists — this is the kind of migration standing rule 3
("never edit a migration that's been applied to production") is protecting
you from having to redo.

**Explore**
```
read @docs/TASKS.md task 1.7 and ARCHITECTURE.md section 2.9. the plan starts
empty (D-13), so the migration will usually have nothing to carry — the fixture
is what matters. what does a two-year book (a 2026 row and a 2027 row for one
book) have to become under the new (user_id, book_id, period) key, and does
anything today read planned_quarter or plan_granularity directly?
```

**Plan**
```
write a plan for task 1.7: replace planned_year/planned_quarter with one
period text column, checked against ^[0-9]{4}(-Q[1-4])?$ or the literal
"on_deck" (no months, D-38). add a plan_period view exposing year, quarter,
level and ordinal, and a to_read_level view giving every to_read book its level
(quarter | year | on_deck | someday — someday is "no plan row"). drop
reading_settings.plan_granularity. the migration composes the legacy columns
into period without losing a row; the down migration reconstructs them and
raises while any on_deck row exists.

say explicitly how a bare "2027" (year committed, no quarter chosen) and
"on_deck" are represented and read back.

add ordinal (D-37): quarters only — NULL exactly when the period is not a
quarter — contiguous from 1 within each quarter, unique and deferrable like
run_queue's. plan the write helpers every later task must use — place in a
quarter (append), move to another level (closes the gap), move to Someday
(deletes the plan row, leaves book_status), reorder, move to top — and how the
migration numbers existing quarter rows (title, then book_id) and how extract
--with-plan numbers them (workbook row order). enable On deck on 1.4c's add
sheet.
```

**Implement**
```
implement the plan. write the tests first: "2027-Q1" reads back as year 2027,
quarter 1, level quarter; "2027" with a null quarter and level year;
"on_deck" with a null year and level on_deck; "2027-Q5", "2027-03" and
"someday" are rejected by the constraint; to_read_level puts a book with no
plan row at someday; and the ordinal sequence in the task's check (append,
move between quarters, move to a year or on_deck, move to top, two concurrent
reorders). run the migration against a copy of the dev database, then run the
down migration and confirm every row matches what it started as, apart from
the dropped ordinal, which comes back contiguous on the second up; the down
raises while an on_deck row exists.
```

---

### 1.8a Design tokens and control states
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the values already exist in `design/tokens.css`; the risk is carrying
them across without renaming anything, translating the dark selectors twice,
and a contrast check that passes for the wrong reason. Every later UI task
inherits whatever this gets wrong, which is why it comes before 1.8.

**Explore**
```
read @docs/TASKS.md task 1.8a, @docs/DESIGN.md, design/STYLE_GUIDE.md §4–§7,
§10 and §13, design/tokens.css, src/app/globals.css and
scripts/check-tokens.mjs. list every token tokens.css adds or changes against
globals.css, and every selector that is translated on the way in (.app,:root
becomes :root; the dark block becomes both the data-theme block and the
prefers-color-scheme block). for each class in the task's state-matrix list,
say which of hover / :active / :focus-visible / [aria-disabled="true"] it has
today. flag anything tokens.css would rename or remove: the task allows
additions and value changes only.
```

**Plan**
```
write a plan for task 1.8a. extend check-tokens.mjs first (elevation order per
theme, text tokens on every surface, paired fills, --faint-deco outlines, the
glass worst case, the 11px floor) and write the state-matrix test, then show
each one failing against today's globals.css where it should. after that, move
the values into globals.css and design/mockups.html's .app blocks in the same
commit, because test:tokens compares the two. name how you'll prove the
check's three deliberate breakages each fail, and which docs carry the --faint
and --faint-deco hexes.
```

**Implement**
```
implement the plan. no token or class is renamed or removed, and --mark and
--held stay. npm run test:tokens passes, and fails each of the three ways the
Check names; revert each breakage before committing. the radius grep returns
only var(--r-*) and 50%. screenshot /comics at 360px, light and dark, before
and after (npm run dev uses the development database): the layout must not
move, only the values. capture the dark frames the task lists into
design/mockups-index.md and close Not shown #11.
```

---

### 1.8 App shell and the thumb bar
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** layout and routing work with tokens already defined in
`globals.css` — the risk is responsive correctness (safe-area insets, a
44px minimum touch target, no horizontal scroll) rather than logic, which
plays to Sonnet's strengths at a solid effort level.

**Explore**
```
read @docs/TASKS.md task 1.8 and the token/class definitions 1.8a put in
src/app/globals.css (use them; don't define new ones). how do the current /comics, /books, and /watch routes
render today, and what's the smallest change that introduces the tab
bar/sidebar shell and the fixed .actionbar around them without rewriting each
page?
```

**Plan**
```
write a plan for task 1.8: tab bar at the top on phone, a navigation rail on a
tablet (768-1023px), the sidebar from 1024px (D-33; the width table is in the
task), .actionbar fixed to the bottom with a 44px minimum target and
env(safe-area-inset-bottom). "/" redirects to the last-touched medium, or
/comics with no history. the list screens move to /comics/runs and
/books/list.

name every route file you're adding or moving.
```

**Implement**
```
implement the plan. take screenshots at 360px and 1280px and check them
yourself before showing me: the primary action button within the bottom 96px
at 360px, no horizontal scroll at either width. write the redirect test
(last-touched medium, and /comics for a user with no history).

build the chrome from the audit: one phone media bar (Comics, Books, Watch,
search icon, aria-current), the per-medium desktop sidebar with neutral icons
and Inbox, a 44px thumb bar with the mark verb in the left slot, the batch sheet
behind "+ batch", the sync pill and skeletons at the loaded dimensions, on
1.8a's tokens. write the computed-height test first, and run axe-core over
each dashboard. the contrast checks are 1.8b's.
```

---

### 1.10 Comics Up next queue
**Model:** Sonnet · **Effort:** explore medium / plan high / implement xhigh
**Why:** a small table, but ordering is where bugs hide: contiguous ordinals
under insert-at-top, move and remove; a deferrable unique constraint; undo
restoring exact order; and the rule that starting or finishing a run never
touches the queue row. Build it before 1.9, whose comics Up next tab reads
it.

**Explore**
```
read @docs/TASKS.md task 1.10, ARCHITECTURE.md 2.16, and the Up next section of
the comics dashboard in design/mockups.html (scripts/screen.ps1 home). how
does the top-books reorder (task 3.4) or any existing ordinal column handle
renumbering, and where would + Up next hook into the run detail, run list and
dashboard rows?
```

**Plan**
```
write a plan for task 1.10: run_queue with (user_id, run_id) PK and a
deferrable unique (user_id, ordinal); run_queue_state over run_progress and
run_readiness; add (append), read next (top), move to top, drag reorder,
remove with undo — all renumbering contiguously in one transaction; the
dashboard section (first five unstarted, Start on the first, empty state
linking to ready runs). no dates, no capacity. name every file.
```

**Implement**
```
implement the plan. tests first: three adds give 1–3; read next puts a fourth
at 1; move-to-top and remove leave contiguous ordinals; undo restores exact
order; marking a queued run's first placement moves it to In flight with its
run_queue row unchanged; a blocked run can be queued and reports its
blocked-by count; a placeholder is rejected; concurrent reorders never
duplicate an ordinal. screenshot the dashboard at 360px.

the drag handle is a button and reordering works by keyboard (space lifts,
arrows move, space drops, esc cancels) with an aria-live announcement; the row
menu has move to top/up/down and remove. write the keyboard test before the
pointer handling.
```

---

### 1.9 Status screens: In flight · Up next · Done
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** one component over views that already exist, so there's no new
data. The judgement is in the tab rules: blocked runs are left out of Up
next, a bare-year plan entry sorts after its quarters, and a run read only
*elsewhere* is not Done. Build it for comics and books now so 8.8 is a
fill-in.

**Explore**
```
read @docs/TASKS.md task 1.9, ARCHITECTURE.md §4 (the status-screen table), and the
"Status" screen in design/mockups.html (scripts/screen.ps1 status). which
existing queries in src/db/queries.ts already return in-flight, ready and
finished runs, and which views give books by plan period and by year read?
```

**Plan**
```
write a plan for task 1.9: one StatusTabs component, tab in the URL,
/comics/status and /books/status, each tab's rows and order exactly as the
task's table says, counts on the tabs, Stopped collapsed under Done, dashboard
headers linking to the matching tab. nothing stored. name every file.
```

**Implement**
```
implement the plan. tests first: a partly-read run is in In flight only; a
ready unstarted run is in Up next; a blocked run is in neither but is counted
in the link; a run read only in other runs is not in Done; a '2027' plan entry
sorts after 2027's quarters and before On deck; a to_read book with no plan row
is only in the "Someday · N books" link, which opens the master list at
?level=someday; DNF shows only under Stopped;
tab counts equal row counts. screenshot at 360px.

tabs are a real tablist of links with arrow keys, the resume button names
its target, Stopped is a details element, and every tab has one primary-action
empty state.
```

---

### 1.11 Slow down failed sign-ins
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** a few lines in one route handler. The whole risk is the test: it must
prove the wait without ever waiting on a real clock.

**Explore**
```
read @docs/TASKS.md task 1.11, D-23 and D-36 in docs/review/decisions.md,
src/app/api/login/route.ts and src/lib/auth.ts. use test/health.test.ts as the
shape for importing a route handler in vitest.
```

**Plan / Implement**
```
write the vitest first, with fake timers. a wrong, an empty and a wrong-length
passcode are each still pending at 999 ms and resolve at 1000 ms, to a 303 to
/login?error=1 with no rt_session cookie. a right one resolves without
advancing the timers and sets the cookie. then add the wait to the route
handler: stateless, with no in-memory counter and no table. nothing waits on
a real clock.
```

---

## Phase 2 — The pace engine

### 2.0 Settings
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** every capacity figure reads `reading_settings`; without this screen
they are stuck on a seeded guess (R1-05).

**Explore**
```
read @docs/TASKS.md task 2.0 and the `settings` frame in design/mockups.html.
reading_settings exists from 0.3. confirm nothing else writes it.
```

**Plan / Implement**
```
/settings: minutes a day (a stepper — two labelled buttons around an <output>),
words a minute — no plan granularity, the plan is quarters only (D-38). seed
one row per user (45 min/day, 185 wpm) when none exists. flip the Settings nav item on
(1.8's NAV_ITEMS). write the tests first: a user with no row gets the defaults,
and changing 45 to 60 min/day changes 2.1's capacity view without a redeploy.
```

---

### 2.11a Prerequisite cycle check (built before cutover, D-20)
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the owner breaks the prerequisite cycles in `Comics.xlsx`; this is
what lists them, and what stops a cyclic graph from being loaded at cutover.

**Explore**
```
read @docs/TASKS.md task 2.11a and how etl/extract.py writes prereqs.csv and
unresolved.csv. do not change any other output.
```

**Plan / Implement**
```
a Tarjan pass over all extracted prereq edges (hard and soft). by default:
one "prereqs,prereq cycle" row per component larger than one in unresolved.csv,
naming its runs (hard edges first), and a red count on the console — extract
still exits 0 so rebuilds keep working during the audit. with --fail-on-cycle:
exit non-zero naming the runs. write the unittest first (a fixture with a
cycle: rows written and exit 0 by default; non-zero with the flag). then run
extract against both workbooks and diff the CSVs (standing rule 4).
```

---

### 2.1 Capacity view
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** a view summing planned word counts against capacity, with a fallback
estimate (`page_count × 275`) that has to be visibly marked `estimated` rather
than silently blended with stated counts — the acceptance check requires the
view to report what share of its own answer rests on an estimate, which is
easy to build without and hard to retrofit.

**Explore**
```
read @docs/TASKS.md task 2.1 and the reading_settings columns added in 0.3
(minutes/day, words/minute). where does word_count_source
(added in 0.3) get set today, and does anything already compute page_count ×
275 as a fallback anywhere in the codebase?
```

**Plan**
```
write a plan for task 2.1: a view summing planned word counts per year and
quarter against capacity from reading_settings (a bare year counts against its
year only; On deck and Someday count against nothing), falling back to
page_count × 275 marked estimated when a stated word count is missing. the
view (or the query reading it) must also report what share of the total
rests on estimates — say exactly which column carries that.
```

**Implement**
```
implement the plan. write the test first: 45 min/day at 185 wpm over 2027
(3,038,625 words of capacity) against a fixture plan of 3.58M words returns
118% ± 1% (4.1M would be 135% — the old figure was wrong, S-06), and the estimated-share figure
is present and correct for a mix of stated and estimated books.
```

---

### 2.1b Reading sessions
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** a start/stop timer plus after-the-fact entry is routine, but
"Recalculate from sessions" has to derive minutes/day and wpm from observed
data and then *surface drift* rather than silently overwrite the user's
typed settings — that's a judgment call encoded in behavior, worth Opus's
care even though no single piece of it is architecturally hard.

**Explore**
```
read @docs/TASKS.md task 2.1b and FEATURES.md #20. how does reading_settings get
read by the capacity view from 2.1, so "Recalculate from sessions" knows
exactly what it's proposing to change?
```

**Plan**
```
write a plan for task 2.1b: a sessions table, start/stop timer UI, and
after-the-fact entry ("read 35 minutes") attached to a book or run. a
"Recalculate from sessions" action in Settings computes minutes/day and wpm
from observed sessions and shows the drift from the typed settings rather
than overwriting them automatically — the user has to confirm the change.
```

**Implement**
```
implement the plan. write the test first: 10 sessions totalling 400 minutes
over 20 days with known word counts computes minutes/day and wpm within 1% of
hand-calculated values, and Settings shows the drift rather than silently
overwriting.

also build the session sheet, the timer chip in the thumb bar, and the
Settings controls (stepper as buttons around an output, switches with
role="switch"). keep the Tonight card and the estimated-time-to-finish line
hidden until five sessions exist, and test that threshold.
```

---

### 2.2 Books dashboard
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** five slots with real visual logic in the plan rail (blocks sized by
word count, a dashed capacity rule across all four quarter columns, hatching
rather than red for overage, a fifth lane for bare-year plan rows) and a hard
constraint that "behind" never appears as a word on the screen. Depends on
1.7, 1.8, and 2.1 — don't start this before those three are actually done,
not just planned.

**Explore**
```
read @docs/TASKS.md task 2.2 and the "Books — v4" screen in design/mockups.html.
confirm 1.7, 1.8, and 2.1 are landed — this task reads reading_plan.period,
the app shell, and the capacity view directly. check which of 2.2b (the plan
rail) and 2.1 are already ticked in TASKS.md so you don't rebuild a rail
component that exists.
```

**Plan**
```
write a plan for task 2.2: the five slots in order (reading now, plan rail,
unplaced-entries card, capacity, year so far), matching "Books — v4" exactly.
the capacity number is amber past 100%, never red, and the word "behind" does
not appear anywhere on this screen — say where you're enforcing that as a
rule, not just a convention. name the components for tasks 2.7 and 2.8
(Rebalance/Accept, Place the unquartered) that this screen wires buttons to,
even though you're not building them here.
```

**Implement**
```
implement the plan. write the test first: a quarter whose books total 892k
against a 760k capacity renders exactly the blocks past 760k as hatched, and
a book with period = '2027' renders in the fifth lane and in no column. take
screenshots at 360px and 412px and check yourself for horizontal scroll and
whether the capacity rule and every quarter label are legible before showing
me.

every plan-rail block is a named button with a 24px hit area, sub-24px
neighbours merge into a stack button, estimated counts get the dotted edge and
"~" prefix, and there is no month layout (D-38). measure every interactive
element in .planrail in a test.
```

---

### 2.3 Plan editor
**Model:** Sonnet · **Effort:** explore medium / plan high / implement xhigh
**Why:** one picker sheet with three entry points sharing state, a live
preview that has to reflect the destination period before the move commits,
and a hard rule that it always writes one `period` value, never a year
independent of a quarter — a correctness detail worth testing explicitly
even though the UI itself is standard.

**Explore**
```
read @docs/TASKS.md task 2.3 and the "Move / add to plan" sheet in
design/mockups.html. where do the three entry points (Move on a plan row,
Plan for... in the master list, Plan for... when adding a new book) currently
live, and can they share one sheet component?
```

**Plan**
```
write a plan for task 2.3: one picker sheet over the four to-read levels
(D-37) — year chips plus On deck and Someday; a year opens No quarter yet and
Q1–Q4, each chip showing that period's current word total (no month step,
D-38); a live preview card that turns amber over capacity. On deck and Someday
skip the quarter row. Someday clears the plan row without touching
book_status. every write goes through 1.7's plan helpers: a book placed in a
quarter joins the end of its order. flip 1.4c's add sheet to offer Year or
quarter…
```

**Implement**
```
implement the plan. write the tests first: moving a 150k-word book from 2027
Q1 to 2028 Q2 changes both periods' totals correctly and the preview reflects
the destination before the move is confirmed; On deck and Someday need no year
or quarter; Someday clears reading_plan only; No quarter yet writes a bare year;
the sheet always writes one period value, never a year independent of a
quarter and never a month; the
moved book takes the destination's last ordinal, the source stays contiguous,
and undo restores its old position.

the live preview is amber, never red, when a move overruns a period, and
offers "Accept as a stretch year". use the reconciled seed figures (892k, 704k,
415k, 268k against 760k).
```

---

### 2.4 Comics dashboard
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** five slots depending on the telescope (2.5) and unlock-cost/leverage
views (2.6) both existing first — don't start until those two are real, not
planned. Candidate rows show cost and leverage instead of a tier, and no
element on the page may render `--danger`.

**Explore**
```
read @docs/TASKS.md task 2.4 and the "Comics — v4" screen in design/mockups.html.
confirm 1.6, 1.8, 2.5, and 2.6 are landed — this screen embeds the telescope
component and reads run_unlock_cost/run_leverage/frontier directly. 2.4 is
assembly: check TASKS.md for which of its dependencies are ticked before you
write anything new.
```

**Plan**
```
write a plan for task 2.4: the five slots in order (telescope, also in
flight, unlocked and waiting, rest of this block, the frontier). candidate
rows show "costs N · opens N", not a tier badge, plus an owned-edition tag
where one exists. blocked runs keep the amber badge naming what's missing.
the 76-of-10,285 catalog figure appears exactly once, in .prov grey, at the
foot — nowhere else on the page.
```

**Implement**
```
implement the plan. write the tests first: a run with readiness ready_hard
renders the amber "1 soft prereq unread" badge and still appears in Unlocked
and waiting; a blocked run appears only dimmed with its true cost; no element
on the page renders --danger. screenshot at 360px and check it yourself
before showing me.

build src/components/RunStateBadge.tsx first with a snapshot test for all
five states, then use it everywhere a run appears. the reading state suppresses
prerequisite badges, and ready_hard is an outlined green, not amber. add the
empty states and the "Since Tuesday" line.
```

---

### 2.5 The telescope
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** the hardest rendering task in the app — three SVG rails with
brackets connecting the highlighted cell of each rail to the full extent of
the next, a head marker at the resume pointer, legibility rules (minimum cell
height, readable ruler ticks, not one hairline per issue), and a two-rail
fallback for a run with no block. No new tables or views — this is
pure presentation logic over data that already exists, which is exactly the
kind of task where a plausible-looking result can still be wrong in ways only
a rendered screenshot at real data scale reveals.

**Explore**
```
read @docs/TASKS.md tasks 2.5 and 2.5b, @docs/DESIGN.md section 5, the
telescope part of ARCHITECTURE §4 and DIAGRAMS.md section 3b. open
design/Telescope.dc.html: its alloc(), niceStep() and fit() are the reference
implementation. confirm block_progress,
run_progress joined to block_position, and the resume pointer (from 1.6)
give you everything the three rails need with no new query. the seed moves
while the owner audits the workbook, so build test fixtures rather than
asserting against a named run.
```

**Plan**
```
write a plan for task 2.5: three horizontal rails stacked top to bottom
(track's blocks, block's runs, run's issues; D-31, never vertical), brackets connecting each rail's highlighted cell
to the next rail's full extent, a head marker at the resume pointer, and a
three-row ladder underneath. handle the two-rail fallback for a run with no
block explicitly — don't let it be an afterthought in the implementation.
the minimum cell width, tick rule and 2-rail rules are already decided in
ARCHITECTURE §4: follow them rather than picking new ones.
```

**Implement**
```
implement the plan. write the tests first: on a fixture (a track of 7 blocks,
block 1 holding 5 runs, the second of them 381 issues with 41 read) assert
the ladder reads "block 1 of 7", "run 2 of 5", "issue 42 of 381"; render a run with block_id IS NULL and assert two rails and no
crash; render a block containing a 6-issue run and assert that cell is at
least 14px wide. screenshot at 360px and look at it yourself before showing
me — this is a task where the test can pass and the picture can still be
wrong.

put the geometry in src/components/telescope/layout.ts with allocate,
overflow and niceStep, and write these tests first: [6, 381] at H=300 gives
both cells at least 14px, 40 cells fold to at most 12 including stubs, and
heights plus gaps equal H within 0.5px. read state is run-length segments plus a
grey dashed read-elsewhere layer, the head label is "42 / 381 · #141", text is
outside the viewBox at 11px minimum, and every cell is a focusable link with a
title. build the three variants (two-rail, empty, 641 issues).
```

---

### 2.6 Unlock cost, leverage and the frontier
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** three derived views built on `run_ancestors()`, whose depth-truncation
bug `pre-build-review.md` finding 2.2 found (depth capped at 20; now 48 in etl/views.sql, R0)
— confirm the cap and add the chain test before trusting any number here, since
every "true unlock cost" figure in HANDOFF.md was computed against the buggy
version. There's also an explicit performance bar: under 200ms against the
full seed.

**Explore**
```
read @docs/TASKS.md task 2.6 and ledger rows R0-02, R2-01 and R2-04.
run_ancestors has been rewritten: UNION rather than UNION ALL with a path
array (it was exponential and timed out on 150 of 229 runs), the depth cap is
48 (D-6), and it excludes the target run itself. every unlock-cost figure in
the old docs was computed against the broken version, so treat all of them as
void — run select count(*) from run_ancestors('ewing-immortal-hulk')
yourself and baseline from what you get.
```

**Plan**
```
write a plan for task 2.6: run_unlock_cost per user = the run's own UNREAD
placements plus the unread placements of every run in run_ancestors() (D-22;
run_ancestors excludes the run itself, so add its own share explicitly),
run_leverage (direct and transitive count of
runs a given run unlocks), and frontier (ready runs, one-soft-short runs,
never-started tracks, editions covering a ready run, cheapest block to close,
next event with distance). all three are derived views, nothing stored.
```

**Implement**
```
implement the plan. write the tests RELATIONALLY, not against literals (D-7).
on a fixture A ← B ← C plus a soft edge: cost(A) = unread(A) + unread(B) +
unread(C); a run with no prerequisites costs its own unread count; marking one
issue of B read lowers cost(A) by one; a fully read run with read prerequisites
costs 0. against the seed: every run's cost equals its own unread count plus
the unread counts summed over run_ancestors(), no run appears in its own
ancestor set, and each run's direct leverage equals its count of prereqs rows.
do NOT assert 4,642 or any other literal. frontier counts update when the last
issue of a prerequisite run is marked read. time the closure query across every
run and confirm it's under 200ms — paste the actual timing.

add the "Why blocked?" path sheet and the unlock preview. test that the
ewing-defenders path's running total equals that run's run_unlock_cost (not a
literal) and that the claremont-xmen preview lists as many runs as its direct
leverage, split by resulting state.
```

---

### 2.7 Rebalance, and accepting an overage
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** four peer options, not a hierarchy of three ways to shrink the plan,
and "accepting" has to actually persist (a date on reading_settings or a
keyed plan_acceptance row) with an undo, and re-raise itself automatically if
a later change pushes the year back over the accepted total. The task's own
text calls persistence "the whole feature" — the failure mode here is
building something that looks done in a demo and resets on the next load.

**Explore**
```
read @docs/TASKS.md task 2.7. where would a plan_acceptance row naturally live —
a new small table keyed by user and year, per the task's own suggestion — and
how does the capacity card (from 2.2) currently render the .decide state it
needs to turn into .decide.settled?
```

**Plan**
```
write a plan for task 2.7: a sheet with four peer options — move the overage
into next year (and show what that does to next year), move it to On deck
(longest titles first, nothing deleted), even out the quarters (same books,
redistributed), accept as a stretch year (persisted, with Undo). accepting
renders as a settled grey card stating what was accepted and when.
```

**Implement**
```
implement the plan. write the tests first: accepting 2027 at 118% stores the
acceptance with a date and the dashboard renders .decide.settled; Undo
removes it; a later change pushing 2027 past the accepted total re-raises the
flag; "even out the quarters" leaves the year's book count unchanged.

the four options are equal-weight buttons each showing a before/after
delta, and once accepted the banner reads "accepted as a stretch year on <date>
· Undo" in a calm state. delete .capnum.over and .pace .big.behind.
```

---

### 2.8 Place the unquartered
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** a bounded, well-specified bulk flow (the plan starts empty per D-13,
so the count is whatever `plan_period` derives, never a literal) with an honest
close — the closing card has to say the year is still over capacity when it
is, not soften it. Straightforward once 2.1 exists.

**Explore**
```
read @docs/TASKS.md task 2.8. where does the books dashboard (2.2) render the
unplaced-entries card, and what does "Place them" currently link to, if
anything?
```

**Plan**
```
write a plan for task 2.8: one book at a time, four quarter buttons each
showing that quarter's current word total, plus Skip and Stop, staying on the
dashboard throughout. the closing card states plainly whether the year is
still over capacity — no softened language.
```

**Implement**
```
implement the plan. write the tests first: placing a book writes
period = '2027-Q3' and the fifth lane's count drops by one; Skip advances
without writing; stopping mid-way leaves the remainder untouched; the closing
card states the year is still over capacity when it is.
```

---

### 2.9 Run list, grouped track → block (+ 6.2b's sort)
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the grouping decision is already settled (HANDOFF §8 question 5 —
track → block, always), so this is executing a spec, not making a design
call. Fold in 6.2b's remaining piece here since it's the same screen: sorting
by unlock cost and leverage, once 2.6's views exist. Confirm with yourself
whether 6.2b is actually still open before doing this — see the note at the
top of this document.

**Explore**
```
read @docs/TASKS.md tasks 2.9 and 6.2b, and the "Run list — v4" screen in
design/mockups.html. confirm 2.6's run_unlock_cost and run_leverage views
exist and are queryable from here. how many of the 259 seeded runs have
block_id IS NULL (expect nine) and where do they need to land in the
grouping?
```

**Plan**
```
write a plan for task 2.9: two levels of grouping always — track headers with
hue and runs-read count, block bands with issue/read counts reusing the
spine's era-band component. every row carries "costs N" and "opens N" instead
of a tier badge; tier moves into the sort control alongside unlock cost,
leverage, issue count, start year. the nine block-less runs group under "No
block" at the foot of their track. cost badges are amber, never red.
```

**Implement**
```
implement the plan. write the tests first: a track with four blocks renders
four bands in block_number order and a block-less run appears in "No block";
sorting by unlock cost puts a 13-issue run with a large unread closure below a
44-issue run whose prerequisites are all read (fixture); the blocked switch
hides exactly the rows whose run_state = 'blocked' and no others, whatever that
count is (D-7 — most of the list today, and the switch defaults to shown); no
element renders --danger. screenshot at 360px.

the blocked switch says "Show N hard-blocked" and never hides ready_hard
rows; add the saved-views toolbar; the block band meter is .emeter and must be 5px
on desktop.
```

---

### 2.10 Plan page as the full-size rail
**Model:** Sonnet · **Effort:** explore medium / plan high / implement xhigh
**Why:** same geometry as the books dashboard's plan rail but taller, plus a
pixel-exact constraint (rendered block heights must sum to the quarter's word
total "to the pixel rounding") that's easy to get approximately right and
annoying to get exactly right — worth xhigh on implement even though the
component itself already exists from 2.2.

**Explore**
```
read @docs/TASKS.md task 2.10 and the "Plan by quarter — v4" screen in
design/mockups.html. confirm 1.7, 2.1, and 2.2 are landed, and how much of
2.2's plan-rail component can be reused here versus needing a taller variant.
```

**Plan**
```
write a plan for task 2.10: same rail geometry as 2.2, taller, with each
block's title and word count legible inside it. only the focused quarter
expands to rows with Move on each; the other three are summary rows. the
fifth lane is a drop target as well as a list. one consolidated empty state
("893k of room across Q2–Q4" with Suggest) rather than one per empty quarter.
```

**Implement**
```
implement the plan. write the tests first: the sum of rendered block heights
in a quarter equals that quarter's word total to the pixel rounding; a book
crossing the capacity line renders hatched and the one below it doesn't;
expanding Q2 collapses Q1; the rail and the dashboard render identical
totals from the same query. screenshot at 360px and 1280px.

add desktop drag-to-move with a ghost block and a live delta readout, keeping
the Move sheet as the keyboard and phone route; apply the estimated-count
treatment to plan rows and the book detail.
```
---

## Phase 3 — Editing

### 3.1 Inline field editing
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** the pattern already exists in `IssueRow.tsx` — this task is
extending it, not inventing it. Keep implement at high rather than xhigh
because the main risk is faithfully copying an existing optimistic/rollback
pattern, not designing a new one.

**Explore**
```
read @docs/TASKS.md task 3.1 and @src/components/IssueRow.tsx's optimistic-update
and rollback logic. which fields across the app still require a modal or a
save button today, and can they all reuse this exact pattern?
```

**Plan**
```
write a plan for task 3.1: click a field, type, blur to save, optimistic
with rollback on failure, matching IssueRow.tsx's pattern exactly. list every
field/screen you're converting.
```

**Implement**
```
implement the plan. write the test first: a failed PATCH restores the prior
value in the DOM. run it for at least two different field types (text and a
select/status field) to confirm the pattern generalizes.
```

---

### 3.2 Create and edit runs
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** routine CRUD with two rules that matter: a run's series, years and
credits are derived and shown read-only, and a typed why is stored as
`why_source = 'hand'`. **"Draft why" is not in this task** — it moved to 7.5
with the proposals table and Anthropic client from 7.1 (R3-17). Nothing here
calls Anthropic.

**Explore**
```
read @docs/TASKS.md task 3.2 and CLAUDE.md's why rule ("A why is authored, so
it is stored"; `hand` is never replaced automatically). how does run_span (task 0.6) expose the read-only
series/year fields this form needs? confirm no run form field lets you type
series or year directly — those come only from issues.
```

**Plan**
```
write a plan for task 3.2: create/edit runs with track assignment, a slug ID
derived from the title (editable, uniqueness-checked), no series/year/writer/
artist input fields (read-only from run_span and run_credit_line). the why is
typed by hand and saving stores why_source = 'hand'. no Anthropic call, no
proposals table, no "Draft why" button — those are 7.1 and 7.5.
```

**Implement**
```
implement the plan. write the tests first: create a run, assign two tracks,
assert it appears under both filters; saving a why stores hand; nothing in the
diff imports an Anthropic client.
```

---

### 3.3 Prereq editor
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** cycle detection on a live graph — reject an edge that would make
`run_ancestors` loop — is the one piece of real graph algorithm work in
Phase 3, and a bug here doesn't fail loudly, it silently corrupts every
downstream unlock-cost and readiness calculation from Phase 2.

**Explore**
```
read @docs/TASKS.md task 3.3 and the run_ancestors() definition in etl/views.sql
(post the depth-cap fix from 2.6, if that's landed). what's the cheapest
correct way to detect a would-be cycle before insert — walk run_ancestors
from the proposed target back to the proposed source, or something else?
```

**Plan**
```
write a plan for task 3.3: add/remove hard and soft prereq edges, with cycle
detection rejecting any edge — hard or soft — that would close a cycle of any
length (the same invariant as 2.11a: no strongly connected component larger
than one), returning a clear error message naming the cycle. after cutover this
is the only guard; the loader check no longer runs.
```

**Implement**
```
implement the plan. write the test first: adding A→B when B→A already exists
is rejected with a clear message. also test a longer cycle (A→B→C, then
attempting C→A) to make sure detection isn't just checking the direct
reverse edge.
```

---

### 3.4 Book ratings and top-books reorder
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** small, but the rank-reorder logic (setting rank 3 has to demote
whoever currently holds it) is a real off-by-one risk worth a specific test
rather than "should be fine."

**Explore**
```
read @docs/TASKS.md task 3.4 and ledger row R0-C1 (the POST that wiped unsent
fields). it is fixed in `saveBookStatus` — undefined keeps, null clears — so
this task must not reintroduce it. status and finish date are NOT this task:
they moved to 1.5 (R1-03).
```

**Plan**
```
write a plan for task 3.4: rating, notes, and top-books rank reorder that
demotes whatever currently holds the target rank rather than creating a
duplicate. status and finish date are 1.5's control; do not add a second one.
```

**Implement**
```
implement the plan. write the test first: setting year_rank = 3 demotes
whatever held rank 3. also test that patching only the rating leaves status
and finished_on untouched.
```

---

### 3.5 Detail sheets — books and issues
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** Next.js intercepted routes are genuinely subtle — sheet on phone,
centered modal on desktop, full page on direct load/refresh, back-button
dismissal restoring list scroll position — and this is the first task to use
that pattern, so getting the routing convention right here saves 3.5's exact
shape from being re-derived in 8.4 later.

**Explore**
```
read @docs/TASKS.md task 3.5, FEATURES.md Part 2f, and the "Book detail sheet"
mockup. how does Next.js's intercepting-routes convention
((.)folder / (..)folder) map onto /books/[id] and /comics/[runId]/[issueId]
needing sheet-on-phone, modal-on-desktop, full-page-on-direct-load?
```

**Plan**
```
write a plan for task 3.5: intercepted routes for both detail pages,
rendering a bottom sheet on phone and a centered modal on desktop when
arrived at from a list, and a full page on direct load or refresh. add
books.summary, books.subjects, issues.creators, issues.story_arc columns
(these fields already come back from the enrichment APIs and are currently
discarded). the sheet and the master list's inline editor write status
through the same code path — name that shared path explicitly.
```

**Implement**
```
implement the plan. write the tests first: the back button dismisses the
sheet and restores list scroll position; a direct visit to /books/{id}
renders the full page; a book with no summary renders with no layout shift;
the sheet and the inline editor write through the same code path (assert this
directly, don't just eyeball it).

the issue sheet uses the shared layout, and "Your record" is a table of
placements each with its own aria-pressed toggle and no "mark all". the spine's
+N hint and every issue row link to it.
```

---

### 3.6 Eras on the run detail
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** `dashboard-v4-status.md` already made the key design call here — an
era is *named* (it's a story), a block is *numbered* (it's a position); don't
give eras a number field even though it'd be tempting to copy the block
pattern. Drag-to-move issue boundaries between eras plus an `era_progress`
view mirroring `block_progress` is real interaction and derived-view work.

**Explore**
```
read @docs/TASKS.md task 3.6, the "Run detail — eras" mockup, and decisions.md
D-3 (finished eras collapse to a count). confirm the eras table from
0.3 (ordinal, name, nullable issues.era_id) is landed. how does
block_progress compute its bands today, so era_progress can mirror it exactly
rather than reimplementing the counting logic?
```

**Plan**
```
write a plan for task 3.6: add, remove, rename, reorder eras; drag an issue
boundary to move it between eras. era_progress mirrors block_progress. a run
with no eras renders a flat spine — that's the default, not an empty state.
eras get a name field, never a number field — ordinal is internal only.
```

**Implement**
```
implement the plan. write the tests first: reordering eras renumbers ordinal
contiguously; deleting an era sets its issues' era_id to null rather than
deleting the issues; era_progress returns 4 of 22 for a seeded era with 22
issues and 4 read; a run with zero eras renders every issue in document order
with no band. screenshot the run detail at 360px with and without eras.

era headers are buttons with aria-expanded and a chevron, finished eras on
runs over 100 issues collapse to "38 / 38 · all read · Show", and add the sticky
era chips and, on runs of 300+ rows, the minimap.
```

---

## Phase 4 — Enrichment

### 4.1 Metron backfill (cover_url)
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** most of this is already built — `etl/enrich_comics.py` exists and
backfills `metron_id`/`cover_date`, and its SQLite cache already holds each
issue's `image`, so `cover_url` should cost no new API requests. This is
extending a working script, not writing one from scratch.

**Explore**
```
read @docs/TASKS.md task 4.1 and etl/enrich_comics.py. confirm the SQLite cache
(etl/.metron-cache.sqlite) already stores each issue's image field from prior
runs, so adding cover_url is a read from cache, not a new request. what's the
schema change needed on issues for cover_url?
```

**Plan**
```
write a plan for task 4.1: add the cover_url column (if 0.3 hasn't already),
and have enrich_comics.py populate it from the already-cached Metron image
field. confirm rate limiting (20 req/min, 5,000/day), Retry-After handling on
429, and never overwriting a hand-entered value all still apply unchanged.
```

**Implement**
```
implement the plan. run a dry run against 50 issues first and confirm it
reports a match rate and writes nothing. then run it for real against 200
issues with the cache warm and confirm zero new API requests were made for
issues already cached.
```

---

### 4.2 Open Library and Hardcover backfill
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** two new external APIs (page counts/covers/ISBNs from Open Library,
series position from Hardcover), each needing its own rate handling and
conflict reporting against existing `series_position` — parallel work to 4.1
but for books, no existing script to extend.

**Explore**
```
read @docs/TASKS.md task 4.2 and how enrich_comics.py structures its dry-run,
caching, and resumability (etl/.metron-cache.sqlite) — reuse that shape for
the new books enrichment script rather than inventing a different one.
```

**Plan**
```
write a plan for task 4.2: etl/enrich_books.py fetching page counts, covers,
and ISBNs from Open Library, and series position from Hardcover. dry-run
mode, caching, resumability, and never overwriting a hand-entered value, all
matching enrich_comics.py's conventions. conflicts against existing
series_position get reported, not silently overwritten.
```

**Implement**
```
implement the plan. run a dry run over 100 books and paste the match-rate and
conflict report.
```

---

### 4.3 Covers in the UI
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** small and well-defined — lazy loading, aspect-locked, graceful null
handling — with a single numeric bar (Lighthouse CLS under 0.1) to check
against.

**Explore**
```
read @docs/TASKS.md task 4.3. where do book and issue covers currently render, if
at all, and what's already using next/image elsewhere in the app (reuse that
convention if it exists)?
```

**Plan**
```
write a plan for task 4.3: lazy-loaded, aspect-ratio-locked cover images with
a graceful placeholder when cover_url is null, and no layout shift.
```

**Implement**
```
implement the plan. run Lighthouse against the books and comics pages and
paste the CLS score — confirm it's under 0.1.

rows created freeform and not yet enriched render data-enrich="pending" with
a dashed cover outline and a "metadata pending" line, on the spine, the master
list and book detail.
```
---

## Phase 5 — Remaining surfaces

### 5.1 Shelves (books only)
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the schema decision is already settled — `shelf_books` and
`shelf_titles`, never a polymorphic `shelf_items` (`ARCHITECTURE.md` §2.5e,
confirmed landed in 0.3 per `dashboard-v4-status.md`). This task is CRUD and
reordering on top of a shape that's already correct.

**Explore**
```
read @docs/TASKS.md task 5.1 and ARCHITECTURE.md section 2.5e. confirm
shelf_books exists from 0.3 and how it differs from shelf_titles (used later
in 8.6) — they should be structurally identical tables for different
mediums, not shared.
```

**Plan**
```
write a plan for task 5.1: create a shelf, add books to it, reorder items.
books-only — confirm nothing here accidentally makes the component generic
enough to accept titles, which is 8.6's job with its own table.
```

**Implement**
```
implement the plan. write the test first: creating a shelf, adding three
books, reordering them, and confirming the stored order persists.
```

---

### 5.2 Tracks page
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** reads straight from an existing view (`track_progress`) — no new
derivation, just a list page.

**Explore**
```
read @docs/TASKS.md task 5.2 and confirm track_progress already exposes
everything this page needs.
```

**Plan**
```
write a plan for task 5.2: a tracks list page rendering directly from
track_progress, matching the app shell's list conventions from 1.8.
```

**Implement**
```
implement the plan and confirm the page renders correctly against the seeded
tracks.

the tracks page shows 37 tracks with completion counted in DISTINCT
issue_id, a "never opened" group, and links to the run list filtered by track.
```

---

### 5.4 Ratings and post-read notes on runs
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** small, additive fields on an existing detail page, same shape as
3.4's book rating/notes.

**Explore**
```
read @docs/TASKS.md task 5.4 and how 3.4 implemented rating/notes on books — reuse
that same field pattern for runs.
```

**Plan**
```
write a plan for task 5.4: rating and notes fields on the run detail page,
matching 3.4's pattern for books.
```

**Implement**
```
implement the plan and confirm saving and reloading a run preserves both
fields.
```

---

### 5.5 DNF with a reason field
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** one status value plus a reason field — genuinely small.

**Explore**
```
read @docs/TASKS.md task 5.5 and how status is currently modeled on book_status
and run progress, to confirm DNF fits as an existing status value rather than
needing a new column.
```

**Plan**
```
write a plan for task 5.5: a dnf status option plus a reason text field, on
both books and runs if the schema already supports status on both.
```

**Implement**
```
implement the plan and confirm setting DNF with a reason persists and
displays correctly.
```

---

### 5.6 `edition_issues` parser
**Model:** Opus · **Effort:** explore medium / plan high / implement xhigh
**Why:** freeform parsing of strings like `"Avengers #500-503 and Avengers
Finale"` into join rows is a smaller version of 1.3's risk — real text,
real ambiguity, wrong output that looks plausible. Reuse 1.3's parser
architecture rather than writing a second one from nothing.

**Explore**
```
read @docs/TASKS.md task 5.6 and whatever 1.3 built for label parsing. can
edition_issues reuse the same tokenizer/range-expansion logic, or does the
"Title #N-M and Title Finale" shape need its own grammar?
```

**Plan**
```
write a plan for task 5.6: a parser turning strings like
"Avengers #500-503 and Avengers Finale" into edition_issues join rows,
reusing 1.3's range-expansion where the shapes overlap. name the grammar for
the "and X" trailing clause explicitly — it's the part 1.3 doesn't cover.
```

**Implement**
```
implement the plan. write the tests first against a fixture of real edition
strings from the catalog covering: a plain range, a range plus one trailing
named issue, and a fully freeform edition title with no issue numbers at all.
```

---

## Phase 6 — Polish

### 6.1 Global search
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** a Ctrl+K palette across four entity types (runs, issues, books,
series, events) — standard pattern, the only real design question is
ranking/grouping results across types, which is a UI/UX call more than an
algorithmic one.

**Explore**
```
read @docs/TASKS.md task 6.1. is there an existing search index or does this need
a query hitting each table with ILIKE/trigram matching? check what 1.4 and
1.4b already built for trigram-similarity matching and reuse it if it fits.
```

**Plan**
```
write a plan for task 6.1: a Ctrl+K palette searching runs, issues, books,
series, and events, grouped by type in the results, reusing existing
trigram-matching utilities where they fit.
```

**Implement**
```
implement the plan and confirm Ctrl+K opens from anywhere in the app and a
query returns results grouped by all five entity types.

the palette takes a ">" verb mode listing "Actions on this screen" above
results, and groups results Comics, Books, Watch. test "> mark through #160" on
a run page.
```

---

### 6.2 Stats and year in review
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** five charts (books/year with plan overlaid, genre mix planned vs
read, track completion, reading velocity, publication-decade coverage) with
one explicit exclusion — no streaks. Depends on 1.5 and 2.1b actually being
done, since it reads read_events and session data.

**Explore**
```
read @docs/TASKS.md task 6.2 and FEATURES.md Part 2d. confirm 1.5 (read_events)
and 2.1b (reading sessions) are landed — this page reads both directly. what
charting approach does the rest of the app already use, if any, so this
doesn't introduce a second charting library?
```

**Plan**
```
write a plan for task 6.2: the five charts named in FEATURES.md Part 2d, each
reading from read_events/reading_plan/reading_sessions as appropriate.
explicitly confirm no streak metric appears anywhere on the page.
```

**Implement**
```
implement the plan and confirm all five charts render against seeded data
with no streak metric present anywhere.
```

---

### 6.2b Run-list sort by unlock cost and leverage
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** per the note at the top of this document, TASKS.md's checkbox for
this is inconsistent with its own text. This is folded into 2.9 above — treat
this entry as a pointer, not a separate session, unless you confirm 2.9 left
it out.

**Explore**
```
confirm whether task 2.9's implementation already includes sorting the run
list by unlock cost and leverage. if it does, this task is done — fix the
checkbox and move on rather than opening a session for it.
```

**Plan / Implement**
```
only if 2.9 didn't cover it: add unlock-cost and leverage as sort options to
the run list, reusing 2.6's views. this is small enough to skip a separate
plan-mode pass if the diff is one sort-control addition.
```

---

### 6.3 Prereq graph visualization
**Model:** Opus · **Effort:** explore medium / plan high / implement xhigh
**Why:** graph layout (nodes and edges, presumably force-directed or
hierarchical) is a different kind of rendering problem than the telescope's
fixed three-rail geometry, and TASKS.md gives it no acceptance check at all —
you'll need to write one as part of planning, which is itself worth Opus's
judgment.

**Explore**
```
read @docs/TASKS.md task 6.3. it has no acceptance check written — look at how
prereq edges and run_ancestors are modeled and propose what a meaningful
check would be (e.g., a seeded 24-edge chain renders with no overlapping
nodes and the correct edge count) before planning the feature itself.
```

**Plan**
```
write a plan for task 6.3, including the acceptance check you're proposing
since TASKS.md doesn't specify one. name the layout library or algorithm
you're using and why.
```

**Implement**
```
implement the plan against the acceptance check you defined, and confirm it
renders correctly for both a small subgraph and the full 259-run graph
without becoming illegible.
```

---

### 6.4 PWA: manifest, service worker, queued offline writes
**Model:** Opus · **Effort:** explore medium / plan high / implement xhigh
**Why:** offline write queueing is the kind of feature where the happy path
is easy and the edge cases (conflicting writes made offline and online,
replay order, what happens if the queue never flushes) are where real bugs
live — worth the extra planning care even though no single piece is large.

**Explore**
```
read @docs/TASKS.md task 6.4. which write paths (issue marking, status changes,
range marks from 1.1) need offline queueing, and how does 1.1's
single-round-trip range write interact with a queue that might replay it out
of order?
```

**Plan**
```
write a plan for task 6.4: manifest, service worker, and a queued-write
mechanism for the write paths identified in explore. say explicitly how
replay ordering and conflicting writes (same issue marked differently
offline and online) are resolved.
```

**Implement**
```
implement the plan. write the test first: going offline, marking several
issues, coming back online, and confirming all writes replay in order with no
duplicates or lost marks.

drive the sync pill from the offline queue and show "Offline · N marks
queued"; a queued write must never be silent.
```

---

### 6.5 Keyboard shortcuts
**Model:** Sonnet · **Effort:** explore low / plan low / implement medium
**Why:** four bindings (`j`/`k`/`x`/`/`) — small enough that plan mode is
optional per CLAUDE-CODE.md's own "if you could describe the diff in one
sentence, just ask for it" rule.

**Explore / Plan**
```
skip plan mode. describe the diff directly: j/k move focus between rows, x
toggles read state on the focused row, / opens the search palette from 6.1.
```

**Implement**
```
implement j/k/x/\/ as described, matching whatever row-focus convention
already exists in the list components. confirm none of the four conflict
with a browser or OS default shortcut on the pages they're active on.
```

---

### 6.6 Goodreads and StoryGraph CSV import
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** two well-known but different export formats to parse, with dedupe
against the existing catalog the main correctness risk — similar shape to
1.4's books bulk entry, reuse its matching logic.

**Explore**
```
read @docs/TASKS.md task 6.6. what do a real Goodreads export and a real
StoryGraph export look like (column names, date formats) — get a sample of
each rather than guessing the schema. how does 1.4's catalog-matching logic
work, and can it be reused here?
```

**Plan**
```
write a plan for task 6.6: parsers for both CSV formats normalizing to the
same internal shape, then reusing 1.4's matching/dedupe flow against the
existing catalog.
```

**Implement**
```
implement the plan against real sample exports from both services, and write
tests asserting correct field mapping and that already-catalogued books
don't duplicate.
```

---

### 6.8 Events page with read-it/skip verdicts
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** a list page over the existing `events`/`event_runs` tables with one
new interaction (a verdict per event) — small and well-bounded.

**Explore**
```
read @docs/TASKS.md task 6.8 and how events/event_runs are modeled. does a verdict
need a new column on events, or a new small table if it should support
per-user verdicts distinct from the shared event catalog?
```

**Plan**
```
write a plan for task 6.8: an events list page with a read-it/skip verdict
control per event, stored per-user.
```

**Implement**
```
implement the plan and confirm a verdict persists and displays correctly on
reload.
```

---

### 6.10 Master list: fits budget, pick one, saved views
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** three small controls over the master list's existing filter state. The
only judgement call is "fits" — it must use the quarter's remaining capacity
from the 2.1 view, not a number computed in the component.

**Explore**
```
read @docs/TASKS.md task 6.10, run scripts/screen.sh blist, and read how the master
list keeps its filter state (URL params or component state). where does 2.1
expose a period's remaining word capacity? which of the three controls needs a
new query and which is just a filter?
```

**Plan**
```
write a plan for task 6.10: a "Fits Q2 · 56k" chip (aria-pressed) that filters
to books whose word count fits the quarter's remaining capacity; a "Pick one"
button that returns one book from the current filter, shown as a single
highlighted row with "Another" and "Plan for…"; and a saved-views toolbar whose
views are stored URLs. say how estimated word counts are treated by "fits".
```

**Implement**
```
implement the plan. write the tests first: with 56k left in Q2, a 65k book is
excluded and a 40k book is included; Pick one never returns a book outside the
current filter; a saved view round-trips through its URL. no new column on
books.
```

---

### 6.11 Density toggle
**Model:** Sonnet · **Effort:** explore low / plan low / implement medium
**Why:** one attribute and a handful of overrides, desktop only. The risk is
letting compact leak onto the phone, where 48px rows are the point.

**Explore**
```
read @docs/TASKS.md task 6.11 and find where .iss, .row and .chk set their height and
padding in src/app/globals.css. where does Settings store per-user
preferences today?
```

**Plan**
```
write a plan for task 6.11: a Comfortable/Compact segmented control in Settings →
Appearance that sets .app[data-density="compact"], overriding .iss and .row
padding and .chk min-height to 2rem, inside a min-width media query so it can
never apply at phone width.
```

**Implement**
```
implement the plan. test that compact rows are 32px at 1280px and that the same
preference renders 48px rows at 360px.
```

---

### 7.6 Release digest email
*(See the note at the top of this document — this is the same task as the
6.7 line in Phase 6. Do it once, here.)*

**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** Vercel cron plus Resend's free tier, gated behind Phase 4/7's
verification layer per the phase ordering — mechanically simple once the data
it's summarizing is trustworthy.

**Explore**
```
read @docs/TASKS.md task 7.6 (and the identical 6.7 line — treat them as one).
what does Resend's free tier require (sender domain verification, rate
limits), and what would the digest actually summarize — new releases against
tracked series/franchises, verified through Phase 4/7's enrichment?
```

**Plan**
```
write a plan for task 7.6: a Vercel cron job querying for new releases since
the last digest, and a Resend email template. name the cron schedule and the
query it runs.
```

**Implement**
```
implement the plan and send yourself a test digest against seeded data before
wiring it to the real schedule.
```

---

### 6.9 Revisit the theme
**Model:** Opus · **Effort:** implement high (skip explore/plan — see below)
**Why:** this task already contains a fully-written prompt in TASKS.md
itself — copy it in verbatim rather than running it through explore/plan
first. It's perceptual and quantitative reasoning (contrast ratios, CVD
deltas across three deficiency types) more than software architecture, which
is why Opus is worth it here despite the task not touching much code yet.

**When:** near the end of the roadmap, per the task's own placement — "once
every screen exists and you have lived with it on a phone for a few weeks."

**Run this prompt directly** (attach `design/mockups.html` and
`src/app/globals.css`, exactly as TASKS.md specifies):
```
I have a finished single-user reading tracker — comics, books, and a film
and TV watchlist. Plain CSS custom properties, no Tailwind, no build step,
light and dark, and an Android phone at 360–412px is the primary device.
The current palette is attached in `src/app/globals.css` and every screen
is in `design/mockups.html`.

The colour system carries exactly four meanings and I want to keep the
meanings, not the hexes: read/done, where-you-are and the primary action,
*held* (a hard prerequisite unread, or a decision I have not made — over
capacity, no quarter chosen), and destructive/invalid. Nothing on a
dashboard is red. On top of that there are eight identity hues for comic
tracks and book genres, which appear as a row's left edge, as tags, as
sidebar dots, and as segments of a stacked capacity bar.

Give me **three** complete palettes as drop-in `:root` and dark-mode token
blocks, using my existing token names. They should differ in temperature and
in how much chroma the surfaces carry, not in decoration. For each one:

1. Say in one paragraph what the palette is for and what it refuses to do.
2. Show the four state colours and the eight identity hues rendered on my
   real components — a run row, a status badge set, the capacity bar, the
   telescope, the plan rail — in both themes.
3. Prove the identity hues are distinguishable: run a CVD check on the eight
   as an ordered set, report worst adjacent pair ΔE for deutan, protan and
   tritan, and state the contrast of every state colour against both
   surfaces. Fix anything under 3:1 rather than telling me about it.
4. Confirm the four state colours do not collide with any identity hue, and
   say which pairs are closest.
5. List what you changed from my current palette and why. If a current value
   is already the right answer, keep it and say so.

Do not give me one real proposal and two strawmen. Also tell me if the
honest answer is that the current palette should stay.
```

Then use the standard review-and-commit prompt once you've picked a palette
and applied it.

---

## Phase 7 — AI-assisted curation

Every task in this phase shares one rule, restated from TASKS.md: the model
proposes, Metron verifies, the user approves. No AI output reaches `issues`
or `runs` without passing the bulk-entry parser, an existence check, and an
explicit accept. That rule is why every task here is Opus at high/xhigh — the
cost of a subtle mistake is fabricated data silently entering your catalog.

### 7.1 Proposals table and API plumbing
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** the foundation every later Phase 7 task builds on, and it's also
where the `ANTHROPIC_API_KEY` first enters the server — the acceptance check
explicitly requires proving no code path returns it to a client component,
which is a security property, not just a feature.

**Explore**
```
read @docs/TASKS.md task 7.1. this task creates the app's first and only
server-side Anthropic client (3.2 no longer has one — Draft why moved to 7.5,
R3-17). confirm nothing in src/ imports an Anthropic SDK yet.
```

**Plan**
```
write a plan for task 7.1: a proposals table (id, kind, target_id, prompt,
raw_response, parsed_json, status, created_at, decided_at), a server-side
Anthropic client (the only one in the app; 7.5's Draft why reuses it), and per-user rate
limiting. name every file that touches the API key.
```

**Implement**
```
implement the plan. write the test first: a proposal round-trips correctly.
then grep the built client bundle yourself for the API key string across
every route this task touches, not just the new ones.
```

---

### 7.2 Verification gate
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** this is the safety mechanism the whole phase depends on — every
proposed issue label must pass 1.3's parser, then a Metron existence check,
classified as verified/unverified/malformed, with unverified always shown,
never silently dropped.

**Explore**
```
read @docs/TASKS.md task 7.2 and how 1.3's parser and etl/enrich_comics.py's
Metron client work. can both be called directly from a server route, or do
they need extracting into shared modules first?
```

**Plan**
```
write a plan for task 7.2: every proposed issue label runs through 1.3's
parser, then a Metron existence check, producing a verified/unverified/
malformed classification. unverified results are always returned to the UI,
never dropped.
```

**Implement**
```
implement the plan. write the test first: a fixture of 10 proposed labels
with 3 fabricated, asserting exactly 3 are flagged unverified and 0 are
written anywhere.
```

---

### 7.3 Review a run's reading order
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** the prompt has to be grounded in the run's actual data (current
issues, track siblings, prereq edges) and the response rendered as an
accept-per-row diff — accepting zero rows must write nothing, which is the
kind of no-op case that's easy to skip testing and important not to.

**Explore**
```
read @docs/TASKS.md task 7.3. what does 7.2's verification gate expect as input
shape, so this task's prompt/response format is compatible with it from the
start?
```

**Plan**
```
write a plan for task 7.3: ground the prompt with the run record, current
issues, track siblings, and prereq edges. render the response as a diff —
insert, remove, reorder, reclassify — with accept per row, running every
proposed operation through 7.2's gate before it's shown as acceptable.
```

**Implement**
```
implement the plan against a golden fixture run. write the test first:
the response parses into structured operations, and accepting zero rows
writes nothing.

render the diff as a table with columns kind, change, why, check, decision
(radiogroup), default unverified rows to Drop, and count only accepted rows in
the apply button. only Remove and Drop may use --danger.
```

---

### 7.4 Review a block or track
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** wider scope than 7.3 — gaps between runs, ordering, missing prereq
edges, misfiled runs — built on the same gate and diff pattern, so this
should be an extension of 7.3's plumbing, not a parallel implementation.

**Explore**
```
read @docs/TASKS.md task 7.4 and 7.3's implementation. how much of 7.3's
diff-and-accept UI can be reused directly for a block/track-scoped review
rather than building a second review surface?
```

**Plan**
```
write a plan for task 7.4: the same review/diff/accept pattern as 7.3, scoped
to a block or track, checking for gaps between runs, ordering issues, missing
prereq edges, and misfiled runs.
```

**Implement**
```
implement the plan. write the test first: run it against a track with a
deliberately removed prereq edge and assert the edge is proposed.
```

---

### 7.5 Draft a new run from scratch
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** the highest-stakes AI task in the phase — writer, character, or era
in, a full draft run record plus issue list out, through 7.2's gate and into
the same review table as bulk entry. This is 1.3's review table doing its
real job: verifying content that didn't come from a human paste.

**Explore**
```
read @docs/TASKS.md task 7.5. confirm the review table from 1.3 (accept / fix /
drop) can accept a fully AI-drafted run and its issue list as input, not just
pasted text — same shape, different source.
```

**Plan**
```
write a plan for task 7.5: writer/character/era input, a full draft run
record plus issue list output, through 7.2's verification gate, landing in
1.3's review table for a final human accept.
```

**Implement**
```
implement the plan. draft a run whose real composition you can verify by
hand, then report what share of the proposed issues passed the Metron check
— paste the actual figure.
```

---

## Phase 8 — Watchlist: film and television

Self-contained — needs only Phase 0 — so any task here can be pulled forward
as a change of pace between comics/books sittings.

### 8.1 Schema and TMDB client
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** the schema shape here sets the pattern every other Phase 8 task
depends on (derived `show_progress`/`franchise_progress`, never a stored
composite status), plus a server-side TMDB client with the same
never-ship-the-key requirement as the Anthropic client in Phase 7, and a
mandatory attribution footer that's a condition of the free tier, not just a
nice-to-have.

**Explore**
```
read @docs/TASKS.md task 8.1. how does 0.3's soft-delete and reading_settings
pattern translate to titles/seasons/franchises? what does TMDB's
/configuration response look like, since it needs caching once for image
base URLs?
```

**Plan**
```
write a plan for task 8.1: titles, seasons, franchises, franchise_titles,
title_status, season_status, watch_events, shelf_titles, shelves.kind, plus
show_progress and franchise_progress views. a server-side TMDB client,
TMDB_API_KEY server-only, /configuration fetched once and cached. TMDB
attribution in the footer — confirm exactly where it renders.
```

**Implement**
```
implement the plan. write the tests first: a /search/multi response parses
into titles rows for both a film and a show; /tv/{id} populates the full
seasons array in one call; no code path returns the API key to a client
component (grep the bundle yourself).

add franchises.hue and dropped-show storage: title_status accepts kind 'tv'
only with status 'dropped', and show_progress reads it first so state can be
dropped. update etl/views.sql and test both directions.
```

---

### 8.2 Search and add
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** one search box with a straightforward disambiguation requirement
(Dune 1984 vs 2021 vs Prophecy distinguishable by poster/year/kind) — UI and
API-consumption work on top of 8.1's client, not new architecture.

**Explore**
```
read @docs/TASKS.md task 8.2 and confirm 8.1's TMDB client and titles/seasons
schema are landed. what does a /search/multi response look like for an
ambiguous title like "Dune" so the UI can be designed against real data?
```

**Plan**
```
write a plan for task 8.2: one search box across films and shows, results
showing poster/year/kind, adding a show creates its season rows from the same
response, status set at add time, already-tracked titles show status and Open
instead of Add.
```

**Implement**
```
implement the plan. write the test first: adding a show with 2 seasons
creates 1 titles row and 2 seasons rows from a single TMDB call, and
re-adding updates rather than duplicating.

the empty watchlist is a full-width TMDB search with three example queries
and attribution, never "no items"; each show result has a "Watched through"
stepper; loading, rate-limited and error states match 1.3b.
```

---

### 8.3 Lists and season progress
**Model:** Opus · **Effort:** explore medium / plan high / implement xhigh
**Why:** the derivation rule is the whole feature — show status is never
stored, always computed from season_status, and the three-way transition
(watching → some seasons done → all seasons done → watched) has to hold up
under partial updates without ever writing a stale derived value into
title_status.

**Explore**
```
read @docs/TASKS.md task 8.3. how does show_progress (from 8.1) compute derived
status today, and confirm title_status only ever stores explicit user
overrides (e.g., dropped), never a value that show_progress could compute
instead.
```

**Plan**
```
write a plan for task 8.3: to-watch/watching/watched/dropped lists, with show
rows displaying derived progress ("2 of 3 seasons", next unwatched season)
from show_progress — never a stored status. inline status/date/rating at
both title and season level.
```

**Implement**
```
implement the plan. write the tests first: marking every season watched
flips the show's derived state to watched with nothing written to
title_status; marking one of three gives watching with next_season = 2; a
film with no seasons still reports correctly from title_status.
```

---

### 8.4 Detail sheets — film, show, season
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** the intercepted-route pattern already exists from 3.5 — this is
applying it to a second domain, not inventing it again, so Sonnet at a solid
effort level should carry it as long as it explicitly reuses 3.5's routing
convention rather than rederiving it.

**Explore**
```
read @docs/TASKS.md task 8.4 and how 3.5 implemented intercepted routes for
book/issue detail sheets. reuse that exact convention for /watch/[id] and
/watch/[id]/season/[n].
```

**Plan**
```
write a plan for task 8.4 reusing 3.5's sheet/modal/full-page pattern
exactly. show detail includes the season list with per-season status. the
sheet must render from cached titles/seasons data with no TMDB call.
```

**Implement**
```
implement the plan. write the tests first: the back button dismisses the
sheet and restores list scroll position; a direct visit to /watch/tv-1396
renders the full page; the sheet renders with no TMDB call (assert this
directly — check the network requests made, don't just assume caching
works).
```

---

### 8.5 Franchises
**Model:** Sonnet · **Effort:** explore medium / plan high / implement high
**Why:** two different data sources for the same concept — TMDB's
`belongs_to_collection` auto-populates film franchises, but cross-media
franchises (a film series plus its TV spinoff) have no TMDB equivalent and
are entirely hand-curated. The risk is conflating the two paths, not
algorithmic difficulty.

**Explore**
```
read @docs/TASKS.md task 8.5. what does a TMDB /collection/{id} response look
like, and confirm there's genuinely no TMDB concept linking a film collection
to a related TV show — so cross-media franchises have to be a fully separate,
hand-curated path.
```

**Plan**
```
write a plan for task 8.5: franchises with one level of nesting, films
auto-populating from TMDB collections via /collection/{id}, cross-media
franchises hand-curated with no auto-population. franchise page lists members
in release or chronological order with combined progress.
```

**Implement**
```
implement the plan. write the tests first: adding a film in a TMDB collection
offers to create or join that franchise; a hand-made franchise accepts both a
film and a show; franchise_progress counts a fully-watched show as watched
via show_progress.

the order toggle goes above the tree, child rows are links, and titles with
a null chronology_ordinal go under "unplaced in chronology".
```

---

### 8.6 Title shelves
**Model:** Sonnet · **Effort:** explore low / plan medium / implement medium
**Why:** `shelves.kind = 'titles'` with `shelf_titles` — structurally the
same as 5.1's book shelves, and the task itself flags the one thing to keep
distinct: a franchise is a fact about the work, a shelf is your opinion.

**Explore**
```
read @docs/TASKS.md task 8.6 and how 5.1 built shelf_books. shelf_titles should be
the same shape for a different medium — confirm before building a second
pattern.
```

**Plan**
```
write a plan for task 8.6: shelf_titles with the same UI as 5.1's book
shelves, keyed to shelves.kind = 'titles'.
```

**Implement**
```
implement the plan. write the test first: a book cannot be added to a title
shelf, and vice versa.
```

---

### 8.7 Watch dashboard
**Model:** Opus · **Effort:** explore high / plan high / implement xhigh
**Why:** a two-rail variant of 2.5's telescope (series' seasons, series'
position in its franchise — dropping a rail, keeping the bracket) plus an
explicit design decision to have no period control at all, which is easy for
a future session to "fix" by accident if it doesn't understand why it's
missing. Depends on 8.3.

**Explore**
```
read @docs/TASKS.md task 8.7 and ARCHITECTURE.md section 4 on why /watch has no
period control. how does 2.5's telescope component generalize to two rails
instead of three — can it be parameterized, or does it need a fork?
```

**Plan**
```
write a plan for task 8.7: the four slots (now with the two-rail telescope,
up next with film/TV and genre filters and no period control, what's
reachable, 2026 so far). state explicitly in the plan why there's no period
control, so it's documented in the diff itself and not just in
ARCHITECTURE.md.
```

**Implement**
```
implement the plan. write the tests first: a show with season 1 watched and
season 2 watching appears once in Now and not in Up next; a show with every
season watched appears in neither; the genre filter narrows the queue without
changing its order; the franchise rail renders 7 of 14 for a seeded Star Wars
franchise. screenshot at 360px.

the telecard stripe uses the franchise hue, the coarse rail is headed
"FRANCHISE · release order", and the up-next button says "Start S1". a show in
Now and its detail page must agree on state.
```

---

### 8.8 Watch status
**Model:** Sonnet · **Effort:** explore low / plan medium / implement high
**Why:** it fills in 1.9's component with film and TV rows. The only trap is
show state, which is derived from `show_progress` and never read from or
written to `title_status`.

**Explore**
```
read @docs/TASKS.md task 8.8 and what 1.9 built. what does the StatusTabs
component expect per row, and which queries from 8.3 already give watching,
to-watch and watched titles with show state derived?
```

**Plan**
```
write a plan for task 8.8: /watch/status on the 1.9 component — watching
shows and films, to-watch with the dashboard's film/TV and genre filters,
watched most recent first, dropped under Stopped. name every file.
```

**Implement**
```
implement the plan. tests first: a show with 1 of 3 seasons watched is in In
flight only; a fully watched show is in Done with nothing in title_status; a
dropped film shows only under Stopped; the genre filter narrows Up next
without reordering it.

dropped shows and films sit in a Stopped details element with a grey
"dropped" badge.
```
