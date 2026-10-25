import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Task 1.12: extract writes seed/volume_rules.csv, and the load and rebuild
// twins (PowerShell and bash) must each load and count it. Neither script can
// run here (they aim at the development database), so the text is checked.
const root = join(__dirname, "..");
const read = (name: string) => readFileSync(join(root, "etl", name), "utf8");

const COPY = /\\+copy volume_rules\(series,run_id,issue_from,issue_to,year\) FROM '[^']*volume_rules\.csv' CSV HEADER/;

describe.each(["load.ps1", "load.sh"])("%s", (name) => {
  const text = read(name);

  it("copies volume_rules after runs, with the table's columns in order", () => {
    expect(text).toMatch(COPY);
    const runs = text.search(/\\+copy runs\(/);
    expect(runs).toBeGreaterThan(-1);
    expect(text.search(COPY)).toBeGreaterThan(runs);
  });

  it("truncates volume_rules with the other catalog tables", () => {
    const truncate = /TRUNCATE[\s\S]*?RESTART IDENTITY CASCADE;/.exec(text)![0];
    expect(truncate).toMatch(/\bvolume_rules\b/);
  });

  it("still refuses against production before it touches the database", () => {
    const guard = text.search(/LEDGER_LIVE/);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(text.search(/psql/));
  });
});

describe.each(["rebuild.ps1", "rebuild.sh"])("%s", (name) => {
  it("counts volume_rules against the seed", () => {
    expect(read(name)).toMatch(/\bvolume_rules\b/);
  });
});

describe("the seed CSV header", () => {
  it("is the table's column order, which the \\copy lists", () => {
    const extract = read("extract.py");
    expect(extract).toContain('["series", "run_id", "issue_from", "issue_to", "year"]');
    const schema = readFileSync(join(root, "src", "db", "schema.ts"), "utf8");
    const table = /pgTable\("volume_rules"[\s\S]*?\}\);/.exec(schema)![0];
    const columns = [...table.matchAll(/^\s+\w+: \w+\("(\w+)"/gm)].map((m) => m[1]).filter((c) => c !== "id");
    expect(columns).toEqual(["series", "run_id", "issue_from", "issue_to", "year"]);
  });
});
