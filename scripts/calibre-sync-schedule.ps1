<#
.SYNOPSIS
  The Calibre sync's weekly run and desktop shortcut (task 4.4, D-133).

.DESCRIPTION
  Run once by the owner (docs/OWNER-CHECKLIST.md):

    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/calibre-sync-schedule.ps1            # the weekly run
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/calibre-sync-schedule.ps1 -Shortcut  # and the shortcut

  Registers one Windows Task Scheduler task, "Ledger Calibre sync", weekly
  (Sunday 09:00 unless -Day / -Time say otherwise), that runs this script with
  -Run: `npm run calibre:sync` in this repo, appended to
  %LOCALAPPDATA%\Ledger\calibre-sync.log, and nothing else. Registering again
  replaces the task (schtasks /F), never adds a second. -Shortcut also puts
  "Calibre sync" on the desktop, which runs the sync in a window that stays
  open. -WhatIf says what it would do and does nothing. Nothing else runs in
  the background (D-133). -Schtasks names another schtasks, for the test
  (test/calibre-sync-schedule.test.ts); the real scheduler is never touched by
  a test.
#>
[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")]
  [string]$Day = "SUN",
  [ValidatePattern("^\d{2}:\d{2}$")]
  [string]$Time = "09:00",
  [switch]$Shortcut,
  [switch]$Run,
  [string]$Schtasks = "schtasks.exe"
)
$ErrorActionPreference = "Stop"
$TaskName = "Ledger Calibre sync"
$Command = "npm run calibre:sync"
$repo = Split-Path -Parent $PSScriptRoot
$self = $PSCommandPath

if ($Run) {
  # What the weekly task runs.
  if ($PSCmdlet.ShouldProcess($repo, $Command)) {
    $dir = Join-Path $env:LOCALAPPDATA "Ledger"
    New-Item -ItemType Directory -Force $dir | Out-Null
    $log = Join-Path $dir "calibre-sync.log"
    Add-Content -Path $log -Value "=== $(Get-Date -Format s) $Command" -Encoding utf8
    Set-Location $repo
    cmd.exe /c "$Command >> `"$log`" 2>&1"
    exit $LASTEXITCODE
  }
  exit 0
}

# schtasks reads /TR as one command line: quote the script's path only when it has a space.
$q = if ($self -match " ") { '\"' } else { "" }
$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $q$self$q -Run"
$create = @("/Create", "/TN", $TaskName, "/SC", "WEEKLY", "/D", $Day, "/ST", $Time, "/TR", $action, "/F")
if ($PSCmdlet.ShouldProcess($TaskName, "register weekly ($Day $Time): $Command")) {
  & $Schtasks @create
  if ($LASTEXITCODE -ne 0) { throw "schtasks could not register '$TaskName' (exit $LASTEXITCODE)" }
  Write-Host "Registered '$TaskName': $Command every $Day at $Time (log: %LOCALAPPDATA%\Ledger\calibre-sync.log)."
}

if ($Shortcut) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $link = Join-Path $desktop "Calibre sync.lnk"
  if ($PSCmdlet.ShouldProcess($link, "create a shortcut that runs $Command")) {
    $shell = New-Object -ComObject WScript.Shell
    $s = $shell.CreateShortcut($link)
    $s.TargetPath = "powershell.exe"
    $s.Arguments = "-NoProfile -ExecutionPolicy Bypass -NoExit -Command `"Set-Location '$repo'; $Command`""
    $s.WorkingDirectory = $repo
    $s.Description = "Sync the Ledger with Calibre, both ways (task 4.4)"
    $s.Save()
    Write-Host "Shortcut: $link"
  }
}
