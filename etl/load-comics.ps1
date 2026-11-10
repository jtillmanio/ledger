<#
.SYNOPSIS
  Replace the comics catalog and comics progress from the seed, and no books
  row. Windows-native twin of load-comics.sh (task 1.29, D-128).

.DESCRIPTION
  From the books cutover (START-HERE Step 14) until the comics cutover
  (Step 14b), Comics.xlsx stays the comics record: run the comics-only extract
  (npm run extract:comics), then this. It empties and reloads every comics
  table in one transaction: runs, tracks, blocks, prerequisites, events,
  issues, placements, credits, issue_progress, edition_progress, the volume
  map, and the queue and eras (which no seed holds, so they come back empty).

  It never truncates, cascades into or writes a books table. Two tables hold
  both media: read_events loses only its comic reads, and inbox keeps every
  note; one resolved into a run keeps its link while the sheet keeps the run.

  Runs while LEDGER_LIVE is true; refuses once LEDGER_COMICS_LIVE is true in
  the env file (Step 14b sets it). Asks first unless -Yes. Only the owner runs
  it against .env.live.

.EXAMPLE
  .\etl\load-comics.ps1                          # development (.env), asks first
  .\etl\load-comics.ps1 -Yes
  .\etl\load-comics.ps1 -EnvFile .env.live       # production: the owner only
#>

[CmdletBinding()]
param(
    [string]$Seed = "seed",
    [string]$EnvFile = ".env",
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# --- load the env file into the process environment -----------------------
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

# --- the guard (1.29, D-128) ----------------------------------------------
# Once the comics are cut over (Step 14b), the app is their record too: a
# comics load would replace read marks entered only there. Checked before
# anything else is read or reached. LEDGER_LIVE is the books' flag, and this
# load leaves the books alone, so it doesn't stop it.
if ("$env:LEDGER_COMICS_LIVE".Trim().ToLower() -in @("true", "1", "yes")) {
    throw "LEDGER_COMICS_LIVE is true in $EnvFile. The app is the comics record now; a comics load would replace comics progress recorded only there. Nothing was changed."
}

foreach ($required in @("DATABASE_URL", "OWNER_ID")) {
    if (-not [Environment]::GetEnvironmentVariable($required)) {
        throw "$required is not set. Copy .env.example to .env and fill it in."
    }
}

$dbUrl     = $env:DATABASE_URL
$ownerId   = $env:OWNER_ID
$ownerName = if ($env:OWNER_NAME) { $env:OWNER_NAME } else { $ownerId }
# OWNER_ID is a key written into the progress CSVs: keep it a slug (load.ps1).
if ($ownerId -cnotmatch '^[a-z0-9_-]+$') {
    throw "OWNER_ID must be lowercase letters, digits, - or _ (it is a key): $ownerId"
}
$ownerName = $ownerName.Replace("'", "''")

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "psql not found on PATH. Install it: winget install PostgreSQL.PostgreSQL.16"
}

# The comics seed npm run extract:comics writes; a books file is never read.
$catalog  = @("tracks", "blocks", "runs", "run_tracks", "volume_rules", "issues", "run_issues",
              "creators", "issue_credits", "prereqs", "events", "event_runs", "editions")
$progress = @("issue_progress", "edition_progress")
foreach ($f in $catalog + $progress) {
    if (-not (Test-Path (Join-Path $Seed "$f.csv"))) { throw "missing $Seed/$f.csv - run npm run extract:comics first" }
}

$dbHost = ([regex]::Match($dbUrl, '@([^/:?]+)')).Groups[1].Value
Write-Host "This REPLACES every comics table in $dbHost (runs, issues, placements, read marks, the queue, eras) from $Seed. No books table is touched." -ForegroundColor Yellow
if (-not $Yes) {
    $answer = Read-Host "Type COMICS to continue"
    if ($answer -cne "COMICS") { throw "COMICS was not typed. Nothing was changed." }
}

# --- bind the $OWNER placeholder in the progress CSVs ---------------------
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("rt-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding $false

try {
    foreach ($f in $progress) {
        $text = [System.IO.File]::ReadAllText((Resolve-Path (Join-Path $Seed "$f.csv")).Path).Replace('$OWNER', $ownerId)
        [System.IO.File]::WriteAllText((Join-Path $tmp "$f.csv"), $text, $utf8)
    }

    # psql needs forward slashes in \copy paths, even on Windows.
    $seedPath = (Resolve-Path $Seed).Path.Replace('\', '/')
    $tmpPath  = $tmp.Replace('\', '/')

    # The same statements as load-comics.sh, in the same order
    # (test/load-scripts.test.ts compares them). No CASCADE anywhere.
    $sql = @"
BEGIN;

INSERT INTO users (id, name) VALUES ('$ownerId', '$ownerName')
  ON CONFLICT (id) DO NOTHING;

-- inbox holds both media: a note resolved into a run keeps its link through
-- the reload while the run is still in the sheet (run ids are its slugs).
CREATE TEMP TABLE comics_load_inbox_runs ON COMMIT DROP AS
  SELECT id, run_id FROM inbox WHERE run_id IS NOT NULL;

-- read_events holds both media: only the comic reads go with their placements.
DELETE FROM read_events WHERE placement_id IS NOT NULL;

-- Nothing outside the comics references these, and without CASCADE Postgres
-- refuses the TRUNCATE if anything ever does.
TRUNCATE issue_progress, edition_progress, run_queue, run_tracks, event_runs, prereqs,
         issue_credits, creators, events, editions, volume_rules RESTART IDENTITY;

-- inbox and read_events reference these, so they are deleted, never truncated.
DELETE FROM run_issues;
DELETE FROM eras;
DELETE FROM issues;
DELETE FROM runs;
DELETE FROM blocks;
DELETE FROM tracks;
SELECT setval(pg_get_serial_sequence('eras', 'id'), 1, false);

\copy tracks       FROM '$seedPath/tracks.csv'       CSV HEADER
\copy blocks(id,track_id,number,name) FROM '$seedPath/blocks.csv' CSV HEADER
\copy runs(id,title,tier,block_id,sequence,spine,rating,why,why_source,notes,placeholder) FROM '$seedPath/runs.csv' CSV HEADER
\copy run_tracks   FROM '$seedPath/run_tracks.csv'   CSV HEADER
\copy volume_rules(series,run_id,issue_from,issue_to,year) FROM '$seedPath/volume_rules.csv' CSV HEADER
\copy issues(id,label,cover_date,cover_date_source,story_title,story_title_source,cover_url,metron_id) FROM '$seedPath/issues.csv' CSV HEADER
\copy run_issues(id,run_id,sequence,issue_id,type,notes) FROM '$seedPath/run_issues.csv' CSV HEADER
\copy creators(id,name,metron_id) FROM '$seedPath/creators.csv' CSV HEADER
\copy issue_credits(issue_id,creator_id,role,source) FROM '$seedPath/issue_credits.csv' CSV HEADER
\copy prereqs      FROM '$seedPath/prereqs.csv'      CSV HEADER
\copy events       FROM '$seedPath/events.csv'       CSV HEADER
\copy event_runs   FROM '$seedPath/event_runs.csv'   CSV HEADER
\copy editions     FROM '$seedPath/editions.csv'     CSV HEADER

\copy issue_progress(user_id,placement_id,completed_at,completed_at_precision) FROM '$tmpPath/issue_progress.csv' CSV HEADER
\copy edition_progress FROM '$tmpPath/edition_progress.csv' CSV HEADER

UPDATE inbox SET run_id = l.run_id
  FROM comics_load_inbox_runs l
  WHERE inbox.id = l.id AND EXISTS (SELECT 1 FROM runs r WHERE r.id = l.run_id);

-- run_issues.id came from the CSV (D-16): move the serial past it (load.ps1).
SELECT setval(pg_get_serial_sequence('run_issues', 'id'),
              COALESCE((SELECT max(id) FROM run_issues), 0) + 1, false);

COMMIT;
"@

    $script = Join-Path $tmp "load-comics.sql"
    [System.IO.File]::WriteAllText($script, $sql, $utf8)

    psql $dbUrl -v ON_ERROR_STOP=1 -q -f $script
    if ($LASTEXITCODE -ne 0) { throw "comics load failed with exit code $LASTEXITCODE; the transaction rolled back, nothing was changed" }

    Write-Host "comics loaded." -ForegroundColor Green
}
finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
