import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// etl/rebuild.ps1 runs `npm run extract`; its bash twin spells the command out.
// The two must hand extract the same arguments, or a rebuild on one shell skips
// a sidecar the other applies (rebuild.sh lost --book-review when 1.13 added it).
const root = join(__dirname, "..");

function extractArgs(command: string): string[] {
  const words = command.replace(/\\\r?\n/g, " ").trim().split(/\s+/);
  const at = words.indexOf("etl/extract.py");
  if (at < 0) throw new Error(`no etl/extract.py in: ${command}`);
  return words.slice(at + 1).map((w) => (w === '"$SEED"' ? "seed" : w));
}

describe("rebuild.sh extract", () => {
  it("passes the same arguments as npm run extract", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const sh = readFileSync(join(root, "etl", "rebuild.sh"), "utf8");
    const line = sh.match(/^\s*\$\{PYTHON:-python3\} etl\/extract\.py(?:[^\n]*\\\r?\n)*[^\n]*$/m);
    expect(line, "rebuild.sh has no extract.py command").not.toBeNull();
    expect(extractArgs(line![0])).toEqual(extractArgs(pkg.scripts.extract));
  });
});
