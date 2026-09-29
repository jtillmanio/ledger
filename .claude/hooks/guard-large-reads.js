#!/usr/bin/env node
// PreToolUse hook (Read only): stop an accidental whole-file Read of a
// generated data file, or of design/mockups.html without offset/limit, from
// quietly burning tens of thousands of tokens of context.
//
// This only intercepts the Read tool. `cat`/`type`/Get-Content inside a Bash
// call can still dump these files — prefer head/tail/grep/psql there too.
//
// See docs/CLAUDE-CODE.md §9 ("Token and model economics") for why this exists.
// Registered in .claude/settings.json.

let raw = "";
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // can't parse the hook payload — don't block on a guess
  }

  if (input.tool_name !== "Read") process.exit(0);

  const filePath = (input.tool_input && input.tool_input.file_path) || "";
  const normalized = filePath.replace(/\\/g, "/");
  const base = normalized.split("/").pop() || normalized;

  // Generated data: rows, not rules. Query them; don't load them.
  const hardBlockPatterns = [
    /(^|\/)seed\/[^/]+$/,
    /(^|\/)cover_dates\.csv$/,
    /(^|\/)why_review\.csv$/,
    /(^|\/)volume_map\.csv$/,
    /(^|\/)workbook_run_fields\.csv$/,
    /\.xlsx$/,
    /\.metron-cache\.sqlite$/,
  ];

  for (const pattern of hardBlockPatterns) {
    if (pattern.test(normalized)) {
      return deny(
        `"${base}" is a generated data file, not something to read whole — ` +
          `it can cost tens of thousands of tokens for zero rules.\n` +
          `Query it instead: psql "$DATABASE_URL" for loaded data, or ` +
          `head/tail/grep -n/wc -l on the raw CSV.`
      );
    }
  }

  // The mockups file: fine with offset/limit, not fine whole.
  if (/(^|\/)design\/mockups\.html$/.test(normalized)) {
    const hasRange =
      input.tool_input &&
      (input.tool_input.offset !== undefined ||
        input.tool_input.limit !== undefined);
    if (!hasRange) {
      return deny(
        `design/mockups.html is ~288KB for 23 screens — reading it whole ` +
          `spends the context the actual task needs.\n` +
          `Use "scripts/screen.sh <id>" (or scripts/screen.ps1 on Windows) to ` +
          `print one screen — ids are in design/mockups-index.md.`
      );
    }
  }

  process.exit(0);
});

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })
  );
  process.exit(0);
}
