<#
.SYNOPSIS
  Load the extracted CSVs into Postgres. Windows-native equivalent of load.sh.

.DESCRIPTION
  Safe to re-run: truncates the catalog and progress tables first, so the
  Google Sheet stays the source of truth until you cut over.

.EXAMPLE
  .\etl\load.ps1
  .\etl\load.ps1 -Seed seed -EnvFile .env
  .\etl\load.ps1 -Seed seed-final -EnvFile .env.live   # Step 14's final load, production
#>

[CmdletBinding()]
param(
    [string]$Seed = "seed",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

# --- load .env into the process environment -------------------------------
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name  = $Matches[1]
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
} else {
    Write-Warning "$EnvFile not found; relying on existing environment variables."
}

foreach ($required in @("DATABASE_URL", "OWNER_ID")) {
    if (-not [Environment]::GetEnvironmentVariable($required)) {
        throw "$required is not set. Copy .env.example to .env and fill it in."
    }
}

# --- the guard (R2-02) ----------------------------------------------------
# This script TRUNCATEs every progress table. Once the app is the source of
# truth (LEDGER_LIVE=true, START-HERE Step 14) it must never run: it would erase
# every read mark, book status and plan row entered since cutover.
if ("$env:LEDGER_LIVE".Trim().ToLower() -in @("true", "1", "yes")) {
    throw "LEDGER_LIVE is true in $EnvFile. The app is the source of truth now; loading would truncate progress recorded only there. Nothing was changed."
}

$dbUrl     = $env:DATABASE_URL
$ownerId   = $env:OWNER_ID
$ownerName = if ($env:OWNER_NAME) { $env:OWNER_NAME } else { $ownerId }
# OWNER_ID is a key written into the progress CSVs: keep it a slug, so a comma
# or quote in it cannot corrupt them (load.sh checks the same).
if ($ownerId -cnotmatch '^[a-z0-9_-]+$') {
    throw "OWNER_ID must be lowercase letters, digits, - or _ (it is a key): $ownerId"
}
# The values are interpolated into SQL below; double any single quote.
$ownerId   = $ownerId.Replace("'", "''")
$ownerName = $ownerName.Replace("'", "''")

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "psql not found on PATH. Install it: winget install PostgreSQL.PostgreSQL.16"
}

# --- bind the $OWNER placeholder in the progress CSVs ---------------------
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("rt-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null

try {
    foreach ($f in @("issue_progress", "edition_progress", "book_status", "reading_plan")) {
        $src = Join-Path $Seed "$f.csv"
        if (-not (Test-Path $src)) { throw "missing $src - run etl/extract.py first" }
        (Get-Content $src -Raw).Replace('$OWNER', $ownerId) |
            Set-Content (Join-Path $tmp "$f.csv") -NoNewline -Encoding utf8
    }

    # psql needs forward slashes in \copy paths, even on Windows.
    $seedPath = (Resolve-Path $Seed).Path.Replace('\', '/')
    $tmpPath  = $tmp.Replace('\', '/')

    $sql = @"
BEGIN;

INSERT INTO users (id, name) VALUES ('$ownerId', '$ownerName')
  ON CONFLICT (id) DO NOTHING;

TRUNCATE issue_progress, edition_progress, book_status, reading_plan,
         run_tracks, event_runs, prereqs, issue_credits, creators,
         run_issues, issues, events, editions,
         runs, blocks, tracks, releases, wishlist, external_lists,
         books, book_series, authors, shelves RESTART IDENTITY CASCADE;

\copy tracks       FROM '$seedPath/tracks.csv'       CSV HEADER
\copy blocks(id,track_id,number,name) FROM '$seedPath/blocks.csv' CSV HEADER
\copy runs(id,title,tier,block_id,sequence,spine,rating,why,why_source,notes,placeholder) FROM '$seedPath/runs.csv' CSV HEADER
\copy run_tracks   FROM '$seedPath/run_tracks.csv'   CSV HEADER
\copy issues(id,label,cover_date,cover_date_source,story_title,story_title_source,cover_url,metron_id) FROM '$seedPath/issues.csv' CSV HEADER
\copy run_issues(id,run_id,sequence,issue_id,type,notes) FROM '$seedPath/run_issues.csv' CSV HEADER
\copy creators(id,name,metron_id) FROM '$seedPath/creators.csv' CSV HEADER
\copy issue_credits(issue_id,creator_id,role,source) FROM '$seedPath/issue_credits.csv' CSV HEADER
\copy prereqs      FROM '$seedPath/prereqs.csv'      CSV HEADER
\copy events       FROM '$seedPath/events.csv'       CSV HEADER
\copy event_runs   FROM '$seedPath/event_runs.csv'   CSV HEADER
\copy editions     FROM '$seedPath/editions.csv'     CSV HEADER

\copy authors     FROM '$seedPath/authors.csv'     CSV HEADER
\copy book_series FROM '$seedPath/book_series.csv' CSV HEADER
\copy books(id,title,author_id,series_id,series_position,genre,book_type,word_count,word_count_source,published_year) FROM '$seedPath/books.csv' CSV HEADER
\copy releases    FROM '$seedPath/releases.csv'    CSV HEADER
\copy wishlist(genre,raw_entry,book_id) FROM '$seedPath/wishlist.csv' CSV HEADER
\copy external_lists(source,year,rank,raw_title,book_id) FROM '$seedPath/external_lists.csv' CSV HEADER

\copy issue_progress(user_id,placement_id,completed_at,completed_at_precision) FROM '$tmpPath/issue_progress.csv' CSV HEADER
\copy edition_progress FROM '$tmpPath/edition_progress.csv' CSV HEADER
\copy book_status(user_id,book_id,status,finished_year,year_rank,rating) FROM '$tmpPath/book_status.csv' CSV HEADER
\copy reading_plan     FROM '$tmpPath/reading_plan.csv'     CSV HEADER

-- run_issues.id came from the CSV (extract numbers placements in sheet order,
-- D-16), so the serial never advanced: move it past them, or the first
-- placement the app adds collides with a loaded one.
SELECT setval(pg_get_serial_sequence('run_issues', 'id'),
              COALESCE((SELECT max(id) FROM run_issues), 0) + 1, false);

COMMIT;
"@

    $script = Join-Path $tmp "load.sql"
    Set-Content -Path $script -Value $sql -Encoding utf8

    psql $dbUrl -v ON_ERROR_STOP=1 -f $script
    if ($LASTEXITCODE -ne 0) { throw "load failed with exit code $LASTEXITCODE" }

    psql $dbUrl -v ON_ERROR_STOP=1 -f "etl/views.sql"
    if ($LASTEXITCODE -ne 0) { throw "views failed with exit code $LASTEXITCODE" }

    Write-Host "loaded." -ForegroundColor Green
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
