# A stand-in for schtasks.exe, for test/calibre-sync-schedule.test.ts (task
# 4.4, TASK-082): the real scheduler is never touched by a test. It keeps its
# tasks in the JSON file FAKE_SCHTASKS_STATE, one per /TN, and answers /Create
# as schtasks does: a task name already there is refused unless /F replaces it.
$state = $env:FAKE_SCHTASKS_STATE
$tasks = @{}
if (Test-Path $state) {
  (Get-Content $state -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $tasks[$_.Name] = $_.Value }
}
if ($args[0] -ne "/Create") { Write-Error "fake schtasks: only /Create"; exit 2 }
$opts = @{}
$force = $false
for ($i = 1; $i -lt $args.Count; $i++) {
  if ($args[$i] -eq "/F") { $force = $true; continue }
  $opts[$args[$i]] = $args[$i + 1]
  $i++
}
$name = $opts["/TN"]
if ($tasks.ContainsKey($name) -and -not $force) {
  [Console]::Error.WriteLine("ERROR: Cannot create a file when that file already exists.")
  exit 1
}
$tasks[$name] = [ordered]@{ schedule = $opts["/SC"]; day = $opts["/D"]; time = $opts["/ST"]; run = $opts["/TR"] }
$tasks | ConvertTo-Json -Depth 4 | Set-Content -Path $state -Encoding utf8
Write-Output "SUCCESS: The scheduled task `"$name`" has successfully been created."
exit 0
