#!/usr/bin/env bash
# Print one task's block from TASKS.md instead of reading the whole 43KB file.
# The WSL/Git Bash/macOS/Linux twin of task.ps1.
#
# Usage: scripts/task.sh 1.3
set -euo pipefail

id="${1:-}"
if [ -z "$id" ]; then
  echo "usage: scripts/task.sh <task-id>   e.g. scripts/task.sh 1.3" >&2
  exit 1
fi

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
file="$dir/docs/TASKS.md"

result="$(awk -v id="$id" '
  /^## / && !/^### / { printing = 0 }
  /^### / {
    n = split($0, a, " ")
    printing = (n >= 3 && a[3] == id) ? 1 : 0
    if (printing) found = 1
  }
  printing { print }
  END { exit (found ? 0 : 1) }
' "$file")" || {
  echo "Task '$id' not found in TASKS.md." >&2
  exit 1
}

echo "$result"
