# Print one roadmap entry (docs/05-roadmap.md) instead of reading the whole file.
# The native-PowerShell twin of task.sh.
#
# A task is either a heading (`### ☐ 1.3 …`, printed up to the next heading)
# or a list item (`- ☐ 5.7 …` in Phases 5 and 6, printed with its indented
# lines, blank lines inside it included).
#
# Usage: .\scripts\task.ps1 1.3 [path\to\roadmap.md]

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Id,
    [Parameter(Position = 1)]
    [string]$Path
)

if (-not $Path) {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $Path = Join-Path (Join-Path $repoRoot "docs") "05-roadmap.md"
}

$mode = ''       # '' not printing, 'h' a heading task, 'l' a list-item task
$pending = 0     # blank lines held inside a list item until more of it follows
$found = $false

# -Encoding UTF8: Windows PowerShell 5.1 otherwise reads the file as ANSI and
# the checkbox glyphs come out as mojibake.
foreach ($line in Get-Content -Path $Path -Encoding UTF8) {
    if ($line -match '^##\s') { $mode = ''; $pending = 0 }
    if ($line -match '^###\s') {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 3 -and $parts[2] -eq $Id) {
            $mode = 'h'; $found = $true; $line
        } else {
            $mode = ''; $pending = 0
        }
        continue
    }
    if ($mode -eq 'l') {
        if ($line -match '^\s*$') { $pending++; continue }
        if ($line -match '^\s') {
            while ($pending -gt 0) { ''; $pending-- }
            $line
            continue
        }
        $mode = ''; $pending = 0
    }
    if ($line -match '^-\s') {
        $parts = $line -split '\s+'
        if ($parts.Count -ge 3 -and $parts[2] -eq $Id) {
            $mode = 'l'; $pending = 0; $found = $true; $line
            continue
        }
    }
    if ($mode -eq 'h') { $line }
}

if (-not $found) {
    Write-Error "Task '$Id' not found in $(Split-Path -Leaf $Path)."
    exit 1
}
