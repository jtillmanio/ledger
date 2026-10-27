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

// Task 1.15: universes and the three follow tables. A universe is a target of
// books.universe_id, so it loads before books; each follow loads after its
// target and after the owner's users row, with $OWNER bound like the other
// per-user CSVs.
const FOLLOWS = [
  ["series_follows", "series_id", /\\+copy book_series\b/],
  ["author_follows", "author_id", /\\+copy authors\b/],
  ["universe_follows", "universe_id", /\\+copy book_universes\b/],
] as const;

describe.each(["load.ps1", "load.sh"])("%s, task 1.15", (name) => {
  const text = read(name);
  const at = (re: RegExp) => {
    const i = text.search(re);
    expect(i, String(re)).toBeGreaterThan(-1);
    return i;
  };

  it("truncates the four tables with the others", () => {
    const truncate = /TRUNCATE[\s\S]*?RESTART IDENTITY CASCADE;/.exec(text)![0];
    for (const t of ["book_universes", "series_follows", "author_follows", "universe_follows"]) {
      expect(truncate).toMatch(new RegExp(`\\b${t}\\b`));
    }
  });

  it("copies book_universes before books, and books with universe_id", () => {
    const universes = at(/\\+copy book_universes FROM '[^']*book_universes\.csv' CSV HEADER/);
    expect(universes).toBeLessThan(at(/\\+copy books\(/));
    expect(text).toMatch(/\\+copy books\([^)]*\buniverse_id\b[^)]*\) FROM '[^']*books\.csv'/);
  });

  it.each(FOLLOWS)("copies %s after its target from the bound CSV", (table, column, target) => {
    const copy = at(new RegExp(`\\\\+copy ${table}\\(user_id,${column},state\\) FROM '[^']*(tmp|Path)[^']*/${table}\\.csv' CSV HEADER`));
    expect(copy).toBeGreaterThan(at(target));
    expect(copy).toBeGreaterThan(at(/INSERT INTO users/));
    const bind = /(?:foreach \(\$f in @\(|for f in )([^);]*)/.exec(text)![1];
    expect(bind).toContain(table);
  });
});

// Task 1.18: Calibre's reads (D-73, D-87) are the first
// read_events extract writes. Each loads after its book and the owner's users
// row, from the bound CSV, without its id: the serial numbers them.
describe.each(["load.ps1", "load.sh"])("%s, task 1.18", (name) => {
  const text = read(name);
  const at = (re: RegExp) => {
    const i = text.search(re);
    expect(i, String(re)).toBeGreaterThan(-1);
    return i;
  };

  it("truncates read_events with the others", () => {
    const truncate = /TRUNCATE[\s\S]*?RESTART IDENTITY CASCADE;/.exec(text)![0];
    expect(truncate).toMatch(/\bread_events\b/);
  });

  it("copies read_events after books and the owner, from the bound CSV", () => {
    const copy = at(/\\+copy read_events\(user_id,book_id,finished_on,finished_on_precision\) FROM '[^']*(tmp|Path)[^']*\/read_events\.csv' CSV HEADER/);
    expect(copy).toBeGreaterThan(at(/\\+copy books\(/));
    expect(copy).toBeGreaterThan(at(/INSERT INTO users/));
    const bind = /(?:foreach \(\$f in @\(|for f in )([^);]*)/.exec(text)![1];
    expect(bind).toContain("read_events");
  });
});

// Task 1.18: every extract folds in the Calibre sidecar (one since D-87).
// rebuild.ps1 runs `npm run extract`; rebuild.sh spells the arguments out.
describe("the Calibre sidecar reaches extract", () => {
  const extract = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts.extract as string;
  it.each([["npm run extract", extract], ["rebuild.sh", read("rebuild.sh")]])("%s passes it", (_, text) => {
    expect(text).toMatch(/--calibre-books etl\/data\/calibre_books\.csv/);
    expect(text).not.toMatch(/--calibre-(review|reads)\b/);
  });
});

describe.each(["rebuild.ps1", "rebuild.sh"])("%s", (name) => {
  it("counts read_events against the seed", () => {
    expect(read(name)).toMatch(/\bread_events\b/);
  });

  it("counts volume_rules against the seed", () => {
    expect(read(name)).toMatch(/\bvolume_rules\b/);
  });

  it.each(["book_universes", "series_follows", "author_follows", "universe_follows"])(
    "counts %s against the seed", (table) => {
      expect(read(name)).toMatch(new RegExp(`\\b${table}\\b`));
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
