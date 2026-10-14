// Shorten `tsc --noEmit --pretty false` output for the post-edit hook
// (.claude/kit.json verify.fast). In the middle of a multi-file change the
// whole-project typecheck is expected to fail, and the hook feeds every line
// of it back into the session after every edit; the first few errors are
// enough to act on.

/** An error starts at column 0; tsc indents the lines that elaborate it. */
export function splitErrors(output) {
  const errors = [];
  for (const line of output.replace(/\r\n/g, "\n").split("\n")) {
    if (line.trim() === "") continue;
    if (/^\s/.test(line) && errors.length) errors[errors.length - 1].push(line);
    else errors.push([line]);
  }
  return errors;
}

export function briefTsc(output, { maxErrors = 10, maxLinesPerError = 3 } = {}) {
  const errors = splitErrors(output);
  const shown = errors.slice(0, maxErrors).map((lines) => {
    if (lines.length <= maxLinesPerError) return lines.join("\n");
    return [...lines.slice(0, maxLinesPerError), "    ..."].join("\n");
  });
  const hidden = errors.length - shown.length;
  if (hidden > 0) {
    shown.push(`... and ${hidden} more (${errors.length} in all). Run npx tsc --noEmit for the full list.`);
  }
  return shown.join("\n");
}
