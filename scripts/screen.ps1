# Print one annotated screen from design/mockups.html by its data-id, instead
# of reading the whole ~288KB file. The native-PowerShell twin of screen.sh.
# IDs are listed in design/mockups-index.md.
#
# Usage: .\scripts\screen.ps1 bulk

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Id
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$path = Join-Path $repoRoot "design\mockups.html"
$lines = Get-Content -Path $path

$startIdx = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "data-id=`"$Id`"") {
        $startIdx = $i
        break
    }
}

if ($startIdx -eq -1) {
    Write-Error "No screen with id '$Id' in design/mockups.html. See design/mockups-index.md."
    exit 1
}

for ($j = $startIdx; $j -lt $lines.Count; $j++) {
    Write-Output $lines[$j]
    if ($lines[$j] -match '</section>') { break }
}
