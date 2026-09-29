#!/usr/bin/env bash
# Print one annotated screen from design/mockups.html by its data-id, instead
# of reading the whole ~288KB file. The WSL/Git Bash/macOS/Linux twin of
# screen.ps1. IDs are listed in design/mockups-index.md.
#
# Usage: scripts/screen.sh bulk
set -euo pipefail

id="${1:-}"
if [ -z "$id" ]; then
  echo "usage: scripts/screen.sh <screen-id>   see design/mockups-index.md" >&2
  exit 1
fi

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
file="$dir/design/mockups.html"

start="$(grep -n "data-id=\"${id}\"" "$file" | head -1 | cut -d: -f1 || true)"
if [ -z "$start" ]; then
  echo "No screen with id '$id' in design/mockups.html. See design/mockups-index.md." >&2
  exit 1
fi

offset="$(tail -n "+${start}" "$file" | grep -n '</section>' | head -1 | cut -d: -f1)"
end=$((start + offset - 1))

sed -n "${start},${end}p" "$file"
