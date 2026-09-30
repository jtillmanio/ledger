#!/usr/bin/env bash
# Print one task's block from TASKS.md instead of reading the whole file.
# The WSL/Git Bash/macOS/Linux twin of task.ps1.
#
# A task is either a heading (`### ☐ 1.3 …`, printed up to the next heading)
# or a list item (`- ☐ 5.7 …` in Phases 5 and 6, printed with its indented
# lines, blank lines inside it included).
#
# Usage: scripts/task.sh 1.3 [path/to/TASKS.md]
set -euo pipefail

id="${1:-}"
if [ -z "$id" ]; then
  echo "usage: scripts/task.sh <task-id> [file]   e.g. scripts/task.sh 1.3" >&2
  exit 1
fi

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
file="${2:-$dir/docs/TASKS.md}"

result="$(awk -v id="$id" '
  function stop() { mode = ""; pend = 0 }
  /^## / { stop() }
  /^### / {
    n = split($0, a, " ")
    if (n >= 3 && a[3] == id) { mode = "h"; found = 1; print } else stop()
    next
  }
  mode == "l" {
    if ($0 ~ /^[[:space:]]*$/) { pend++; next }
    if ($0 ~ /^[[:space:]]/) { for (; pend > 0; pend--) print ""; print; next }
    stop()
  }
  /^- / {
    n = split($0, a, " ")
    if (n >= 3 && a[3] == id) { mode = "l"; pend = 0; found = 1; print; next }
  }
  mode == "h" { print }
  END { exit (found ? 0 : 1) }
' "$file")" || {
  echo "Task '$id' not found in $(basename "$file")." >&2
  exit 1
}

echo "$result"
