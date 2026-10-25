<#
.SYNOPSIS
  Drop the database, recreate it from the migrations, extract, load, verify.

.DESCRIPTION
  For the months before cutover, when the Google Sheets are still the source of
  truth and the database is disposable. One command replaces:

    drop everything -> npx drizzle-kit migrate -> npm run extract
    -> .\etl\load.ps1 (loads and applies views) -> etl/test_views.sql

  and then compares every table's row count against its seed CSV.

  Never calls Metron: py etl/enrich_comics.py stays a separate, deliberate step.

  Reads -EnvFile (default .env, the development database). Production's
  connection string lives in .env.live, and only `-EnvFile .env.live` reaches it
  (START-HERE Step 13).

  Refuses to run when the env file has LEDGER_LIVE=true. Set that in .env.live at
  cutover (START-HERE Step 14) and this script can never wipe progress that
  exists only in the app.

.EXAMPLE
  .\etl\rebuild.ps1                 # asks you to type REBUILD
  .\etl\rebuild.ps1 -Yes            # no prompt
  .\etl\rebuild.ps1 -SkipExtract    # reuse seed/ as it is
  npm run rebuild -- -Yes
  npm run rebuild -- -EnvFile .env.live   # production, before cutover only
#>

[CmdletBinding()]
param(
    [switch]$Yes,
    [switch]$SkipExtract,
    [string]$Seed = "seed",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

function Invoke-Checked([string]$what, [scriptblock]$block) {
    & $block
    if ($LASTEXITCODE -ne 0) { throw "$what failed with exit code $LASTEXITCODE" }
}

# --- load .env into the process environment -------------------------------
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2].Trim().Trim('"').Trim("'"), "Process")
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
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "psql not found on PATH. Install it: winget install PostgreSQL.PostgreSQL.16"
}

# --- the guard ------------------------------------------------------------
if ("$env:LEDGER_LIVE".Trim().ToLower() -in @("true", "1", "yes")) {
    throw "LEDGER_LIVE is true in $EnvFile. The app is the source of truth now; rebuilding would destroy progress recorded only there. Nothing was changed."
}

$dbUrl = $env:DATABASE_URL
$dbHost = ([regex]::Match($dbUrl, '@([^/:?]+)')).Groups[1].Value
Write-Host "This DROPS every table in $dbHost and reloads from the workbooks." -ForegroundColor Yellow
if (-not $Yes) {
    $answer = Read-Host "Type REBUILD to continue"
    if ($answer -cne "REBUILD") { Write-Host "Cancelled. Nothing was changed."; exit 1 }
}

# --- 1. drop --------------------------------------------------------------
Step "1/5 drop schema"
Invoke-Checked "drop" {
    psql $dbUrl -v ON_ERROR_STOP=1 -q -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
}

# --- 2. migrate -----------------------------------------------------------
# The committed migrations, from zero: every rebuild also proves they apply.
Step "2/5 migrate"
Invoke-Checked "drizzle-kit migrate" { npx drizzle-kit migrate }

# --- 3. extract -----------------------------------------------------------
if ($SkipExtract) {
    Step "3/5 extract (skipped: using $Seed as it is)"
} else {
    Step "3/5 extract"
    Invoke-Checked "extract" { npm run extract }
}

# --- 4. load --------------------------------------------------------------
Step "4/5 load"
& "$PSScriptRoot\load.ps1" -Seed $Seed -EnvFile $EnvFile

# --- 5. verify ------------------------------------------------------------
Step "5/5 verify"
Invoke-Checked "test_views.sql" { psql $dbUrl -v ON_ERROR_STOP=1 -q -f etl/test_views.sql }

$tables = @("tracks", "blocks", "runs", "run_tracks", "volume_rules", "issues", "run_issues", "creators",
            "issue_credits", "prereqs", "events", "event_runs", "editions", "issue_progress",
            "edition_progress", "authors", "book_series", "books", "book_status",
            "reading_plan", "releases", "wishlist", "external_lists")
$query = ($tables | ForEach-Object { "SELECT '$_', count(*) FROM $_" }) -join " UNION ALL "
$actual = @{}
psql $dbUrl -At -F "," -c $query | ForEach-Object {
    $name, $count = $_.Split(",")
    $actual[$name] = [int]$count
}

$failed = 0
Write-Host ("{0,-18} {1,8} {2,8}" -f "table", "seed", "loaded")
foreach ($t in $tables) {
    $csv = Join-Path $Seed "$t.csv"
    $expected = if (Test-Path $csv) { @(Import-Csv $csv).Count } else { $null }
    $ok = $expected -eq $actual[$t]
    if (-not $ok) { $failed++ }
    Write-Host ("{0,-18} {1,8} {2,8}" -f $t, $expected, $actual[$t]) -ForegroundColor $(if ($ok) { "Gray" } else { "Red" })
}
if ($failed) { throw "$failed table(s) loaded a different row count than their seed CSV." }

psql $dbUrl -c "SELECT state, count(*) FROM run_progress GROUP BY 1 ORDER BY 1;"
Write-Host "rebuilt." -ForegroundColor Green
