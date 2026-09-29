# Print one task's block from TASKS.md instead of reading the whole 43KB file.
# The native-PowerShell twin of task.sh.
#
# Usage: .\scripts\task.ps1 1.3

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Id
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$path = Join-Path (Join-Path $repoRoot "docs") "TASKS.md"

$printing = $false
$found = $false

foreach ($line in Get-Content -Path $path) {
    if ($line -match '^##\s' -and $line -notmatch '^###\s') {
        $printing = $false
    }
    if ($line -match '^###\s') {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 3 -and $parts[2] -eq $Id) {
            $printing = $true
            $found = $true
        } else {
            $printing = $false
        }
    }
    if ($printing) { $line }
}

if (-not $found) {
    Write-Error "Task '$Id' not found in TASKS.md."
    exit 1
}
