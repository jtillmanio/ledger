# Ledger

A private tracker for three media types.

| | |
|---|---|
| **Comics** | 10,138 issues placed 10,761 times across 258 runs (2026-09-23 extract), with a prerequisite graph 21 levels deep and creator credits from Metron |
| **Books** | 1,478 titles with per-year planning, word-count capacity budgeting, and series completion |
| **Film & TV** | TMDB-backed watchlist — franchises, shows, seasons. Starts empty |

Replaces two Google Sheets that outgrew being spreadsheets: the comics workbook
was a three-table relational schema simulated with `COUNTIFS`, and its
dependency graph needed a recursive CTE that Sheets couldn't provide.

---

## Where to start

**New here, or resuming in a fresh conversation? → [HANDOFF.md](docs/HANDOFF.md)**
**Ready to build? → [START-HERE.md](docs/START-HERE.md)**

Every other document is reference. None of them need reading front to back.

| Document | Its one job | Read it when |
|---|---|---|
| **[START-HERE.md](docs/START-HERE.md)** | **The linear runbook.** Unzip → install → migrate → deploy → build → cut over. Every command, in order | You're doing the work. This is the only doc you read top to bottom |
| **[HANDOFF.md](docs/HANDOFF.md)** | **Full project context.** Objectives, every decision and why, data findings, what's open | Starting a new chat, or you forgot why something is the way it is |
| **[CLAUDE-CODE.md](docs/CLAUDE-CODE.md)** | **Technique, not sequence.** How to drive Claude Code — the loop, hygiene, prompts, review standards | Before your first build session, then by section |
| **[TASKS.md](docs/TASKS.md)** | **The backlog.** 51 tasks in 9 phases, each with a pass/fail check | Every build session. One task at a time |
| **[FEATURES.md](docs/FEATURES.md)** | **Scope and rationale.** What's in, what's out, metadata APIs, metrics, schema additions | Deciding what to build, or looking up a schema addition |
| **[design/mockups.html](design/mockups.html)** | **40 annotated screens.** Authoritative for layout and copy | Building any screen. Open it in a browser |
| **[DIAGRAMS.md](docs/DIAGRAMS.md)** | **Visual reference.** ERDs, derived layer, runtime, validation pipeline | Orienting to the schema or a data flow |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | **The reasoning.** Why the schema looks like this, what each sheet artifact became | Questioning a structural decision |
| **[CLAUDE.md](CLAUDE.md)** | **Session context.** Auto-loaded by Claude Code | Never directly — it loads itself |

**No command appears in two documents.** Anything sequential lives in
`docs/START-HERE.md`.

---

## What's in the box

```
CLAUDE.md          auto-loaded session context

docs/
  START-HERE.md    the runbook — start here to build
  HANDOFF.md       full project context — start here in a new chat
  CLAUDE-CODE.md   how to drive Claude Code (+ CLAUDE-CODE-PROMPTS.md)
  TASKS.md         51 tasks, 9 phases, each with an acceptance check
  FEATURES.md      scope, APIs, metrics, schema additions
  DIAGRAMS.md      11 Mermaid diagrams
  ARCHITECTURE.md  schema rationale and sheet-to-table mapping
  review/          UI audit report

design/
  mockups.html     40 annotated screens, phone + desktop, light + dark

etl/
  extract.py       Sheets export + sidecar CSVs -> normalized CSVs, with an unresolved report
  volumes.py       proposes a volume year for labels written without one
  enrich_comics.py Metron backfill: dates, covers, label proposals, story titles, credits
  views.sql        every formula column from the workbook, as Postgres views
  load.ps1         psql loader for Windows, idempotent
  load.sh          the same loader for WSL, Git Bash, macOS, Linux
  data/            workbook exports (Comics.xlsx, Books.xlsx) and sidecar CSVs:
                   volume_map, cover_dates, issue_details, issue_credits,
                   label_review, why_review
  rebuild.ps1      drop, migrate, extract, load, verify — until cutover (+ rebuild.sh)

src/
  db/schema.ts     23 tables; catalog shared, progress keyed by user
  db/queries.ts    every read the UI performs
  app/             dashboard, runs, run detail with check-off, books, login

.claude/           /verify skill, schema-reviewer subagent
.github/workflows/ CI and nightly pg_dump backup
```

---

## Stack

Next.js 16 · Postgres on Neon · Drizzle · Vercel Hobby · plain CSS.
**$0/month.**

## Quick start

The full version with verification steps is `docs/START-HERE.md`. The short form:

```powershell
Copy-Item .env.example .env; notepad .env
npm install
npm run rebuild -- -Yes      # migrate, extract, load, verify
npm run dev
```

macOS, Linux, or WSL: `py` → `python3`, and `npm run rebuild` → `bash etl/rebuild.sh --yes`.

## Three things not to get wrong

1. **Task 1.5 (`read_events`) must land before real reading data accumulates.**
   A second read currently overwrites the first, and that history cannot be
   reconstructed.
2. **Do not cut over from Sheets before Phase 1 finishes.** Bulk entry has to
   exist, or adding a run is slower than the spreadsheet.
3. **Never let a deploy auto-migrate.** Vercel builds on every push, and there
   is no undo.
