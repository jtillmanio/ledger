# Decisions log

**The log of record is [`docs/review/decisions.md`](review/decisions.md)**
(D-1 onward, owner-settled). Read it first. A new decision goes there as the
next D-number, never here, and supersedes an old one by a new row that says so.

This file exists because the kit's skills and agents read `docs/decisions.md`
at a fixed path. It holds only the stack and hosting choices the D-log never
recorded, as K-rows (so the IDs cannot collide with D-n), each extracted from
the document that made it. Data-model decisions are `docs/ARCHITECTURE.md`
§ 2. Decisions (2.1–2.17) and are not repeated here.

Claude must not reopen or work against any of these unless the owner asks.

| ID | Date | Decision | Why | Rejected alternatives | Revisit if |
|----|------|----------|-----|-----------------------|------------|
| K-1 | ≤ 2026-09-20 | Next.js 16 App Router with React 19, server components by default; Node 22, one version everywhere (`.nvmrc` = `engines.node` = Vercel). | Server components render the 641-issue Krakoa run without shipping it to the client twice. (extracted from `docs/ARCHITECTURE.md` § 3. Stack; `.github/workflows/ci.yml`) | not recorded | not recorded |
| K-2 | ≤ 2026-09-20 | Postgres 18 on Neon's free tier; four databases (production, one Neon branch per PR preview, test, development), and `.env` is never production. | Recursive CTEs, `FILTER` and array aggregation are load-bearing. (extracted from `docs/ARCHITECTURE.md` § 3. Stack; `CLAUDE.md` § Non-obvious rules, *Four databases*) | not recorded | First-tap cold starts still annoy after skeletons: the fix is a paid plan with suspend off, not an architecture change (`docs/ARCHITECTURE.md` § 5. Operational posture) |
| K-3 | ≤ 2026-09-20 | `postgres.js` with `prepare: false`. | Required by Neon's transaction-mode pooler. (extracted from `docs/ARCHITECTURE.md` § 3. Stack) | not recorded | The pooler mode changes |
| K-4 | ≤ 2026-09-20 | Drizzle for schema and writes, with migrations generated into git (`drizzle-kit generate`); raw SQL in `src/db/queries.ts` for anything joining views. Migrations are forward-only; one that drops or retypes a column ships a hand-written `drizzle/down/<tag>.sql`. | Generated SQL is reviewable. (extracted from `docs/ARCHITECTURE.md` § 3. Stack; `CLAUDE.md` § Style and § Workflow; `docs/TASKS.md` § Standing rules, rule 3) | not recorded | not recorded |
| K-5 | ≤ 2026-10-02 | Hosted on Vercel. A merge is not a deploy: the hand-run Release workflow checks CI, snapshots Neon, migrates, re-applies views, promotes and smoke-tests `/api/health`. | One gated path for a migration to reach the live database. (extracted from `CLAUDE.md` § Non-obvious rules, *A merge is not a deploy*; `docs/START-HERE.md` Step 13) | not recorded | not recorded |
| K-6 | ≤ 2026-09-20 | The workbook migration and enrichment are Python (`etl/*.py`, pandas + openpyxl), writing sidecar CSVs keyed by label. | Sidecars survive every re-extract. (extracted from `docs/ARCHITECTURE.md` § 2.13; `package.json` scripts) | not recorded | not recorded |
| K-7 | ≤ 2026-09-20 | Metadata sources: Metron for comics (Comic Vine as fallback only), Open Library and Hardcover for books, TMDB for film and TV. Only add flows call an API live; no page render does. | Curation is the asset; the APIs fill in what sits below the label. (extracted from `docs/ARCHITECTURE.md` § 6. Metadata sources) | Comic Vine as primary: 200 requests/hour | not recorded |
| K-8 | 2026-09-30 | CI is GitHub Actions job `check` (`ci.yml`): typecheck, lint, token checks, migration checks, test-DB reset, Vitest, SQL view tests, Python unittests, build, against a `postgres:18` service. Lighthouse runs on every preview (task 0.10). | The same gate as `npm run test:all` and `/verify`, so a broken migration cannot ship green. (extracted from `.github/workflows/ci.yml`; `docs/TASKS.md` 0.1, 0.2, 0.10) | not recorded | not recorded |
