# Outside services, accounts and tokens

Every service outside this repo that the Ledger depends on: what it does, which
account it lives under, which keys it needs, and **where each key is stored**.
Why a source was chosen over its alternatives is in
[02-architecture.md](02-architecture.md) § 10; how to set each one up the first
time is in [START-HERE.md](START-HERE.md) (step numbers below).

**No values in this file, ever.** The repo is public. This file says *where* a
value lives; the value itself lives in that store and in your password manager.
Keep one entry per row of the [token table](#every-token-and-where-it-lives) in
the password manager, named the same, so the two lists can be compared.

Checked against the repo on 2026-10-28 (`gh secret list`, `gh variable list`,
`.env.example`, the workflows and the ETL scripts). Vercel's environment
variables were not checked from here: compare them by hand with
[§ Vercel](#vercel).

## At a glance

| Service | What it does for the Ledger | Account | Keys | Plan | Status |
|---|---|---|---|---|---|
| [GitHub](#github) | Code, CI, Release, the backup runner, Dependabot | `jtillmanio` | `gh` CLI login; the Actions secrets | Free | In use |
| [Neon](#neon) | Postgres: production, development, test, one branch per PR preview | Neon project `ledger` | Connection strings; `NEON_API_KEY` | Free (10 branches; suspends after 5 idle minutes) | In use |
| [Vercel](#vercel) | Hosting, a preview per PR | Team `justin-tillman`, project `ledger` | `VERCEL_TOKEN`; `VERCEL_AUTOMATION_BYPASS_SECRET` | Hobby (non-commercial) | In use |
| [Cloudflare R2](#cloudflare-r2) | Nightly database dumps | Cloudflare account, bucket `ledger-backups` | `R2_BACKUPS_ACCESS_KEY_ID` + `R2_BACKUPS_SECRET_ACCESS_KEY` | Free tier (10 GB; 90 dumps of ~1 MB) | In use |
| [Anthropic](#anthropic-claude) | Claude Code locally; Claude's PR review and `@claude` in Actions | Your Claude subscription | `CLAUDE_CODE_OAUTH_TOKEN` | Subscription | In use |
| [Metron](#metron) | Comics metadata backfill; *Add issues* search | metron.cloud account | `METRON_USERNAME` + `METRON_PASSWORD` (or `METRON_API_TOKEN`) | Free: 20 a minute, 5,000 a day | In use |
| [Hardcover](#hardcover) | Book metadata, replacing Open Library (D-94) | hardcover.app account | `HARDCOVER_API_TOKEN` | Free: 60 a minute, 5,000 a day | Planned: tasks 1.14b (TASK-034), 1.4f |
| [Open Library](#open-library) | Book metadata today: backfill and *Add books* | None | None | Free | Retiring in 6.19 |
| [Marvel Fandom wiki](#marvel-fandom-wiki) | Story titles Metron lacks | None | None | Free | In use (ETL only) |
| [Calibre](#calibre) | Word counts, series, read dates from your ebook library | None: a local app | `CALIBRE_LIBRARY` (a folder path, not a secret) | Free | In use (ETL only) |
| [Google Sheets](#google-sheets) | `Comics.xlsx` and `Books.xlsx`, the record until cutover | Your Google account | None: exported by hand | Free | Until cutover (1.26) |
| [TMDB](#later-tmdb-musicbrainz) | Films and TV (Phase 8) | Not created yet | `TMDB_API_KEY` | Free, non-commercial | Later |
| [MusicBrainz](#later-tmdb-musicbrainz) | Music (Phase 9) | None | None | Free | Later |

Comic Vine, Google Books and the Marvel API appear in architecture § 10 as
alternatives. Nothing calls them, and they need no account.

## Every token and where it lives

There are five places a value can live. A key that appears in two of them has
to be changed in both.

| Store | What it is | How to see what's there |
|---|---|---|
| **`.env`** | Your machine, the **development** database (never production) | Open it; `.env.example` names every key |
| **`.env.live`** | Your machine, production's connection string only. Read only by `-EnvFile .env.live` | Open it yourself; Claude never reads it |
| **GitHub Actions** | Repo → Settings → Secrets and variables → Actions | `gh secret list`, `gh variable list` (names only) |
| **Vercel** | Project → Settings → Environment Variables, per scope (Production, Preview, Development) | The dashboard |
| **Neon ↔ Vercel integration** | Writes each preview's `DATABASE_URL` itself | Neon console → Integrations |

| Key | What it's for | `.env` | `.env.live` | GitHub | Vercel | Where it comes from |
|---|---|---|---|---|---|---|
| `DATABASE_URL` | The database the app or script talks to | Dev branch | Production | Secret (production) | Production + Development (production); Preview comes from the Neon integration | Neon → project → Connection details, pooled |
| `TEST_DATABASE_URL` | The only database tests may truncate | Test branch or local `*_test` | — | — (CI uses its own throwaway Postgres) | — | Neon test branch, or local Postgres |
| `OWNER_ID`, `OWNER_NAME` | Who you are (not secret) | ✓ | ✓ | — | All scopes | You choose |
| `APP_PASSCODE` | The passcode at sign-in | ✓ | — | Secret: the **Preview** passcode, for Lighthouse | Two values: your real one in Production, a second one in Preview + Development | You choose. Never put the Production one in GitHub |
| `SESSION_SECRET` | Signs the session cookie | ✓ | — | Secret (unused, see [Loose ends](#loose-ends)) | A different value in each scope | `openssl rand -base64 32` |
| `LEDGER_LIVE` | `true` makes `load` and `rebuild` refuse | `false` | `false` until cutover, then `true` | Variable, same rule | — | You set it (Step 14) |
| `LEDGER_LIVE_DB_HOST` | Production's host, so a preview refuses to build against it (not secret) | — | — | — | Preview only | The host part of production's `DATABASE_URL` |
| `NEON_API_KEY` | Release's snapshots; deleting PR branches | — | — | Secret | — | Neon → Account settings → API keys (`ledger-release`) |
| `NEON_PROJECT_ID` | Which Neon project (not secret) | — | — | Variable | — | Neon → project → Settings → General |
| `VERCEL_TOKEN` | Release promotes a build | — | — | Secret | — | Vercel → Account Settings → Tokens (`ledger-release`, team-scoped) |
| `VERCEL_SCOPE` | The Vercel team name (not secret) | — | — | Variable: `justin-tillman` | — | Your `vercel.com/<team>/ledger` URL |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Gets automation past Vercel's login wall | ✓ (for `scripts/perf` and `scripts/release.mjs` run locally) | — | Secret | — | Vercel → project → Deployment Protection → Protection Bypass for Automation |
| `PRODUCTION_URL` | Where Release and the backup ask `/api/health` (not secret) | — | — | Variable | — | Vercel project → Domains |
| `R2_BACKUPS_ACCESS_KEY_ID`, `R2_BACKUPS_SECRET_ACCESS_KEY` | Write the backup bucket, and only it | — | — | Secrets | — | Cloudflare → R2 → Manage API tokens (Object Read & Write, `ledger-backups` only) |
| `R2_ACCOUNT_ID`, `R2_BUCKET` | Which Cloudflare account and bucket (not secret) | — | — | Variables | — | Cloudflare → R2 overview |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude's PR review and `@claude` workflows | — | — | Secret | — | `/install-github-app` in Claude Code, or `claude setup-token` |
| `METRON_USERNAME`, `METRON_PASSWORD` (or `METRON_API_TOKEN`) | Metron backfill; *Add issues* search | ✓ | — | — | Production (and Preview, to search on a preview) | Your metron.cloud login |
| `HARDCOVER_API_TOKEN` | Hardcover backfill (1.14b); later *Add books* (1.4f) | Not yet | — | — | From 1.4f | hardcover.app → your account → the API page |
| `CALIBRE_LIBRARY` | The Calibre library folder (not secret) | ✓ | — | — | — | The folder holding `metadata.db` |
| `TMDB_API_KEY` | Phase 8 | Empty | — | — | From Phase 8 | themoviedb.org → account settings |

## GitHub

- **Account:** `jtillmanio`; the repo is `jtillmanio/ledger` (public, 2026-10-23).
- **On your machine:** the `gh` CLI's login (`gh auth status`). Claude Code uses
  it to push and open PRs.
- **In Actions:** the secrets and variables in the token table. Workflows:
  `ci.yml` (no secrets), `lighthouse.yml`, `release.yml`, `backup.yml`,
  `neon-preview-cleanup.yml`, `claude.yml`, `claude-pr-review.yml`.
- **Dependabot** opens dependency PRs. It runs without the repo's secrets, so
  its Neon cleanup only warns.
- **If it lapses:** a `gh` login expires rarely; `gh auth login` again.

## Neon

- **Account:** your Neon login; one project (`NEON_PROJECT_ID`).
- **Branches:** `main` is production. Then development (`.env`), `test`
  (`TEST_DATABASE_URL`), one `preview/<git branch>` per open PR, and Release's
  snapshots. The free plan allows 10.
- **Keys:** each branch's connection string, and `NEON_API_KEY` (account-wide)
  for Release and `neon-preview-cleanup.yml`.
- **The Vercel integration** (Neon → Integrations → Vercel) creates each PR's
  branch and gives the preview its `DATABASE_URL`. Nothing to copy by hand.
- **If a password is reset:** Neon → Roles → reset. Then update every store
  holding that branch's string: for production, the GitHub `DATABASE_URL`
  secret, Vercel's Production `DATABASE_URL` and `.env.live`.
- **Setup:** START-HERE Steps 6, 10e (API key), 10f (integration); the test
  branch under *Test database*.

## Vercel

- **Account:** team `justin-tillman`, project `ledger`, Hobby plan.
- **Environment variables** to compare with the dashboard:

  | Key | Production | Preview | Development |
  |---|---|---|---|
  | `DATABASE_URL` | production | from the Neon integration | ✓ |
  | `OWNER_ID`, `OWNER_NAME` | ✓ | ✓ | ✓ |
  | `APP_PASSCODE` | your real passcode | second passcode | second passcode |
  | `SESSION_SECRET` | its own value | its own value | its own value |
  | `LEDGER_LIVE_DB_HOST` | — | ✓ | — |
  | `METRON_USERNAME`, `METRON_PASSWORD` | ✓ | optional | — |
  | `TMDB_API_KEY` | Phase 8 | Phase 8 | Phase 8 |
  | `HARDCOVER_API_TOKEN` | from 1.4f | optional | — |

- **Two tokens, both in GitHub:** `VERCEL_TOKEN` (an account token, scoped to
  the team; Release uses it to promote) and `VERCEL_AUTOMATION_BYPASS_SECRET`
  (the project's bypass for its own login wall; Release, Lighthouse and the
  backup use it).
- **If `VERCEL_TOKEN` lapses:** Release's *Promote* step fails with 401 or 403.
  Make a new one (Step 10e.2) and replace the secret. Vercel asks for an expiry
  when you create a token; note it in the password manager.
- **Setup:** START-HERE Steps 10b, 10e, 10f.

## Cloudflare R2

- **Account:** your Cloudflare login; bucket `ledger-backups`.
- **Token:** one R2 API token, Object Read & Write on that bucket only. Cloudflare
  shows the secret once, at creation.
- **What uses it:** `backup.yml` only, nightly at 04:00 Eastern. It keeps the
  newest 90 dumps.
- **If it lapses:** the nightly backup goes red at the upload. Make a new token
  (Step 10d.2) and replace both `R2_BACKUPS_*` secrets.
- **Getting a dump back:** the Cloudflare dashboard → R2 → `ledger-backups`.
  START-HERE 10d, *Restoring by hand*.

## Anthropic (Claude)

- **Account:** your Claude subscription. Claude Code on your machine signs in
  with it directly.
- **In Actions:** `CLAUDE_CODE_OAUTH_TOKEN`, set 2026-10-08 by
  `/install-github-app`. `claude-pr-review.yml` reviews a PR when it leaves
  draft; `claude.yml` answers `@claude` in comments. Both skip, not fail,
  when the secret is missing.
- **If it lapses:** the review job fails on authentication. Run
  `claude setup-token` and replace the secret.

## Metron

- **Account:** metron.cloud, free.
- **Keys:** `METRON_USERNAME` + `METRON_PASSWORD` (HTTP Basic), what `.env` uses
  today. `METRON_API_TOKEN` wins if set.
- **What uses it:** `npm run enrich`, `enrich:details` and `enrich:refresh`
  (`etl/enrich_comics.py`, cached in `etl/.metron-cache.sqlite`), and *Add
  issues* search in the app (`src/lib/metron.ts`), which needs them in Vercel.
- **Limits:** 20 requests a minute, 5,000 a day. The ETL waits out a 429.
- **If you change the password:** update `.env` and Vercel.

## Hardcover

- **Account:** hardcover.app, free.
- **Key:** `HARDCOVER_API_TOKEN`, a personal token, server-side only (D-94).
  Not in `.env` or `.env.example` yet; TASK-034 adds it.
- **What will use it:** `npm run enrich:books` (1.14b, cached in
  `etl/.hardcover-cache.sqlite`), then *Add books* search (1.4f, cached in the
  `hardcover_cache` table), which needs it in Vercel.
- **Limits and terms:** 60 requests a minute, bursts of 10, 5,000 a day. The
  data may not train a public or commercial model. The API is "heavily in
  flux", so expect changes.

## Open Library

- **No account, no key.** Requests send a `User-Agent` naming the app, one a
  second.
- **What uses it today:** `npm run enrich:books` (`etl/enrich_books.py`, cached
  in `etl/.openlibrary-cache.sqlite`) and *Add books* (`src/lib/openlibrary.ts`).
- **Going away:** Hardcover replaces it (D-94). Task 6.19 removes the code, the
  cache and `books.open_library_id`.

## Marvel Fandom wiki

- **No account, no key.** `npm run titles:fandom` (`etl/fandom_titles.py`) reads
  `marvel.fandom.com`'s MediaWiki API with a `User-Agent`, for story titles
  Metron lacks. Cached in `etl/.fandom-cache.json`.

## Calibre

- **No account.** The desktop app and your library folder; `CALIBRE_LIBRARY` in
  `.env` names the folder holding `metadata.db`.
- **What uses it:** `npm run calibre` (`etl/calibre.py`) reads a temporary copy
  and never writes the library. It needs the **Count Pages** plugin's word-count
  column and the `#read_date` column.

## Google Sheets

- **Account:** your Google account, which owns the two Sheets.
- **No key.** Nothing calls Google: you export `Comics.xlsx` and `Books.xlsx`
  by hand into `etl/data/` (Step 5). After cutover (1.26) the Sheets are
  history.

## Later: TMDB, MusicBrainz

- **TMDB** (Phase 8): a free account at themoviedb.org for `TMDB_API_KEY`, in
  `.env` and Vercel. The UI has to credit TMDB and JustWatch.
- **MusicBrainz and the Cover Art Archive** (Phase 9): no account, a real
  `User-Agent`, one request a second.

## When something breaks

| Symptom | Likely key | Fix |
|---|---|---|
| Release: *Promote* 401 or 403 | `VERCEL_TOKEN` expired or wrong team | New token, START-HERE 10e.2 |
| Release, backup or Lighthouse reaches Vercel's login page | `VERCEL_AUTOMATION_BYPASS_SECRET` | Regenerate in Vercel, replace the secret and your `.env` copy |
| Release or Neon cleanup: 401 from Neon | `NEON_API_KEY` | New key, START-HERE 10e.3 |
| Nightly backup red at the upload | `R2_BACKUPS_*` | New R2 token, START-HERE 10d.2 |
| Nightly backup red at `pg_dump` | GitHub `DATABASE_URL` | Check it matches production's current string |
| Lighthouse can't sign in | GitHub `APP_PASSCODE` ≠ Vercel's Preview passcode | Make them match; redeploy the preview |
| Claude's PR review fails on auth | `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token`, replace the secret |
| *Add issues* search fails in production | Metron credentials missing in Vercel | Add them to Production, redeploy |
| `npm run enrich` gets 401 | Metron credentials in `.env` | Check the login at metron.cloud |

## Loose ends

Found while writing this, 2026-10-28. None blocks anything.

- **GitHub has a `SESSION_SECRET` secret that nothing reads.** `ci.yml` uses a
  fixed fake value instead. It can be deleted.
- **`.env.example` doesn't name `VERCEL_AUTOMATION_BYPASS_SECRET`**, though
  `.env` has it and `scripts/perf` and `scripts/release.mjs` read it.
- **`HARDCOVER_API_TOKEN` is in neither `.env` nor `.env.example`**: TASK-034
  adds it. Create the Hardcover account before that task runs.
- **Vercel's Metron credentials are unconfirmed** from here. Check the
  dashboard against [§ Vercel](#vercel).
