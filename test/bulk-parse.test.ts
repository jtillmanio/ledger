// Task 1.3: the bulk-entry parser. A pasted block of labels becomes a checked
// list for 1.3c's review table, with no database and no network (R3-12). The
// roadmap's validation table, in order: normalise, unparseable, unknown series,
// ambiguous volume, range, duplicate.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MAX_RANGE,
  SUGGEST_THRESHOLD,
  labelFor,
  normalizeLine,
  parseBulk,
  trigramSimilarity,
  type BulkLine,
} from "../src/lib/bulk-parse";

const CAP_YEARS = [1968, 1996, 1998, 2004, 2011, 2012, 2018, 2023];

const knownSeries = [
  { title: "Thor", years: [1966] },
  { title: "Captain America", years: CAP_YEARS },
  { title: "Avengers", years: [1963, 1996, 1998, 2010, 2016, 2018] },
  { title: "Fantastic Four", years: [1961, 1998, 2018] },
  { title: "Fantastic Four Annual", years: [1963] },
  { title: "Captain America: Sam Wilson", years: [] },
  { title: "Daredevil", years: [1964, 1998] },
  { title: "Astonishing Tales", years: [1970] },
  { title: "Uncanny X-Men", years: [1963, 1981] },
  { title: "X-Factor", years: [1986] },
];

const runLabels = [
  "Thor (1966) #337",
  "Captain America: Sam Wilson #3",
  "Fantastic Four (1961) #48",
  "X-Factor (1986) #6",
];

type Expect = {
  kind: BulkLine["kind"];
  flags: string[];
  labels?: string[];
  skip?: string[];
};

const thor = (n: number) => `Thor (1966) #${n}`;
const range = (fmt: (n: number) => string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => fmt(from + i));

// Forty lines, every rule at least once. `labels` are the rows in order,
// `skip` the rows whose default decision is skip (already in the run).
const FIXTURE: [string, Expect][] = [
  ["Thor (1966) #337-340", { kind: "ok", flags: ["duplicate"], labels: range(thor, 337, 340), skip: [thor(337)] }],
  ["Balder the Brave #1-4", { kind: "choice", flags: ["new_series"], labels: range((n) => `Balder the Brave #${n}`, 1, 4) }],
  ["Captain America #1", { kind: "choice", flags: ["ambiguous_volume"], labels: ["Captain America #1"] }],
  ["Thor Annual 13", { kind: "error", flags: ["unparseable"] }],
  ["  Thor  (1966)  #341–343 ", { kind: "ok", flags: [], labels: range(thor, 341, 343) }],
  ["Thor #344", { kind: "ok", flags: [], labels: [thor(344)] }],
  ["thor #345", { kind: "ok", flags: [], labels: [thor(345)] }],
  ["Captain America (1968) #100", { kind: "ok", flags: [], labels: ["Captain America (1968) #100"] }],
  ["Captain America (2004) #1-3", { kind: "ok", flags: [], labels: range((n) => `Captain America (2004) #${n}`, 1, 3) }],
  ["Avengers #1", { kind: "choice", flags: ["ambiguous_volume"], labels: ["Avengers #1"] }],
  ["Avengers (1998) #605.1", { kind: "ok", flags: [], labels: ["Avengers (1998) #605.1"] }],
  ["Thor (1966) Annual #13", { kind: "ok", flags: [], labels: ["Thor (1966) Annual #13"] }],
  ["Thor (1966) #Annual 14", { kind: "ok", flags: [], labels: ["Thor (1966) Annual #14"] }],
  ["Fantastic Four Annual (1963) #19", { kind: "ok", flags: [], labels: ["Fantastic Four Annual (1963) #19"] }],
  ["Fantastic Four Annual #20", { kind: "ok", flags: [], labels: ["Fantastic Four Annual (1963) #20"] }],
  ["Fantastic Four #48-50", { kind: "choice", flags: ["ambiguous_volume"], labels: range((n) => `Fantastic Four #${n}`, 48, 50) }],
  ["Fantastic Four (1961) #48-51", { kind: "ok", flags: ["duplicate"], labels: range((n) => `Fantastic Four (1961) #${n}`, 48, 51), skip: ["Fantastic Four (1961) #48"] }],
  ["Dark Reign: The Cabal", { kind: "error", flags: ["unparseable"] }],
  ["Astonishing Tales #1 (Mojoworld)", { kind: "error", flags: ["unparseable"] }],
  ["Captain America: Sam Wilson #1-3", { kind: "ok", flags: ["duplicate"], labels: range((n) => `Captain America: Sam Wilson #${n}`, 1, 3), skip: ["Captain America: Sam Wilson #3"] }],
  ["Captain America: Sam Wilson #3", { kind: "ok", flags: ["duplicate"], labels: ["Captain America: Sam Wilson #3"], skip: ["Captain America: Sam Wilson #3"] }],
  ["X-Factor #6", { kind: "ok", flags: ["duplicate"], labels: ["X-Factor (1986) #6"], skip: ["X-Factor (1986) #6"] }],
  ["X-Factor (1986) #1-12", { kind: "ok", flags: ["duplicate"], labels: range((n) => `X-Factor (1986) #${n}`, 1, 12), skip: ["X-Factor (1986) #6"] }],
  ["Uncanny X-Men #94", { kind: "choice", flags: ["ambiguous_volume"], labels: ["Uncanny X-Men #94"] }],
  ["Uncanny X-Men (1963) #94", { kind: "ok", flags: [], labels: ["Uncanny X-Men (1963) #94"] }],
  ["Captian America #1", { kind: "choice", flags: ["new_series"], labels: ["Captian America #1"] }],
  ["Avengers (1998) #1⁄2", { kind: "error", flags: ["unparseable"] }],
  ["Ultimate Spider-Man (2000) #½", { kind: "error", flags: ["unparseable"] }],
  ["Avengers (1998) #16.HU", { kind: "error", flags: ["unparseable"] }],
  ["Daredevil (1964) #181—183", { kind: "ok", flags: [], labels: range((n) => `Daredevil (1964) #${n}`, 181, 183) }],
  ["Daredevil #227", { kind: "choice", flags: ["ambiguous_volume"], labels: ["Daredevil #227"] }],
  ["Daredevil (1964) #12-1", { kind: "error", flags: ["bad_range"] }],
  [`Daredevil (1964) #1-${MAX_RANGE + 1}`, { kind: "error", flags: ["bad_range"] }],
  ["Ｔｈｏｒ　(1966) #346", { kind: "ok", flags: [], labels: [thor(346)] }],
  ["Deadpool (1997) #-1", { kind: "error", flags: ["unparseable"] }],
  ["Astonishing Tales (1970) #25", { kind: "ok", flags: [], labels: ["Astonishing Tales (1970) #25"] }],
  ["Astonishing Tales #26", { kind: "ok", flags: [], labels: ["Astonishing Tales (1970) #26"] }],
  ["Thor (1966)", { kind: "error", flags: ["unparseable"] }],
  ["#12", { kind: "error", flags: ["unparseable"] }],
  ["Silver Surfer (1987) #1", { kind: "choice", flags: ["new_series"], labels: ["Silver Surfer (1987) #1"] }],
];

const parse = (text: string, labels = runLabels) =>
  parseBulk(text, { knownSeries, runLabels: labels });
const one = (line: string, labels = runLabels) => {
  const out = parse(line, labels);
  expect(out).toHaveLength(1);
  return out[0];
};
const flag = <T extends BulkLine["flags"][number]["type"]>(l: BulkLine, type: T) =>
  l.flags.find((f) => f.type === type) as Extract<BulkLine["flags"][number], { type: T }> | undefined;

describe("bulk-entry parser: the 40-line fixture (AC-1)", () => {
  it("has 40 lines covering every rule", () => {
    expect(FIXTURE).toHaveLength(40);
    const seen = new Set(FIXTURE.flatMap(([, e]) => e.flags));
    for (const rule of ["unparseable", "new_series", "ambiguous_volume", "duplicate", "bad_range"]) {
      expect(seen, rule).toContain(rule);
    }
  });

  it("parses each line to its expected kind, flags, rows and skips", () => {
    const out = parse(FIXTURE.map(([line]) => line).join("\n"));
    expect(out).toHaveLength(40);
    out.forEach((got, i) => {
      const [input, want] = FIXTURE[i];
      expect(got.line, input).toBe(i + 1);
      expect(got.input, input).toBe(input);
      expect(got.kind, input).toBe(want.kind);
      expect(got.flags.map((f) => f.type).sort(), input).toEqual([...want.flags].sort());
      expect(got.rows.map((r) => r.label), input).toEqual(want.labels ?? []);
      expect(got.rows.filter((r) => r.decision === "skip").map((r) => r.label), input)
        .toEqual(want.skip ?? []);
    });
  });

  it("skips blank lines but keeps the pasted line numbers", () => {
    const out = parse("Thor #344\n\n   \nThor #345\n");
    expect(out.map((l) => [l.line, l.rows[0].label])).toEqual([[1, thor(344)], [4, thor(345)]]);
  });
});

describe("ranges and duplicates (AC-1, AC-5)", () => {
  it("expands #1-12 to 12 rows in order", () => {
    const l = one("X-Factor (1986) #1-12", []);
    expect(l.rows.map((r) => r.designator)).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    );
    expect(l.rows.every((r) => r.decision === "add")).toBe(true);
  });

  it("flags a line already in the run as duplicate, default skip", () => {
    const l = one("Thor (1966) #337");
    expect(l.kind).toBe("ok");
    expect(flag(l, "duplicate")?.labels).toEqual([thor(337)]);
    expect(l.rows).toEqual([{ label: thor(337), designator: "337", decision: "skip" }]);
  });

  it("matches the run's labels whatever their case or spacing", () => {
    const l = one("THOR (1966) #337", ["  thor  (1966) #337"]);
    expect(l.rows[0].decision).toBe("skip");
  });

  it("refuses a reversed range and one over the cap", () => {
    expect(one("Thor (1966) #340-337").kind).toBe("error");
    expect(one(`Thor (1966) #1-${MAX_RANGE}`).rows).toHaveLength(MAX_RANGE);
    expect(flag(one(`Thor (1966) #1-${MAX_RANGE + 1}`), "bad_range")).toBeDefined();
  });
});

describe("normalisation and the grammar (AC-2)", () => {
  it("normalises NFKC, trims, collapses whitespace and turns dashes into hyphens", () => {
    expect(normalizeLine("  Thor  (1966)  #337–340 ")).toBe("Thor (1966) #337-340");
    expect(normalizeLine("Daredevil\t(1964) #181—183")).toBe("Daredevil (1964) #181-183");
    expect(normalizeLine("Ｔｈｏｒ　#1")).toBe("Thor #1");
  });

  it("parses the en-dash Thor range to four rows in order", () => {
    const l = one("  Thor  (1966)  #337–340 ", []);
    expect(l.normalized).toBe("Thor (1966) #337-340");
    expect(l).toMatchObject({ kind: "ok", title: "Thor", year: 1966 });
    expect(l.rows.map((r) => r.label)).toEqual([thor(337), thor(338), thor(339), thor(340)]);
  });

  it("parses a decimal designator to one row", () => {
    const l = one("Avengers (1998) #605.1");
    expect(l.rows).toEqual([{ label: "Avengers (1998) #605.1", designator: "605.1", decision: "add" }]);
  });

  it("parses the Annual designator to one row, in the mockup's form", () => {
    for (const typed of ["Thor (1966) Annual #13", "Thor (1966) #Annual 13", "Thor Annual #13"]) {
      const l = one(typed);
      expect(l.kind, typed).toBe("ok");
      expect(l.title, typed).toBe("Thor");
      expect(l.rows, typed).toEqual([
        { label: "Thor (1966) Annual #13", designator: "Annual 13", decision: "add" },
      ]);
    }
  });

  it("keeps a known 'X Annual' series as its own title", () => {
    expect(one("Fantastic Four Annual #20").title).toBe("Fantastic Four Annual");
  });

  it("builds labels the same way for 1.3c", () => {
    expect(labelFor("Thor", 1966, "337")).toBe(thor(337));
    expect(labelFor("Balder the Brave", null, "1")).toBe("Balder the Brave #1");
    expect(labelFor("Thor", 1966, "Annual 13")).toBe("Thor (1966) Annual #13");
  });
});

describe("volume years (AC-3)", () => {
  it("flags Captain America #1 as ambiguous with all 8 volume years", () => {
    const l = one("Captain America #1");
    expect(l.kind).toBe("choice");
    expect(l.year).toBeNull();
    expect(flag(l, "ambiguous_volume")?.years).toEqual(CAP_YEARS);
  });

  it("does not flag Captain America (1968) #1", () => {
    const l = one("Captain America (1968) #1");
    expect(l.kind).toBe("ok");
    expect(l.flags).toEqual([]);
  });

  it("fills the year of a series with exactly one known volume, without flagging", () => {
    const l = one("Thor #350");
    expect(l.kind).toBe("ok");
    expect(l.flags).toEqual([]);
    expect(l.year).toBe(1966);
    expect(l.rows[0].label).toBe(thor(350));
  });

  it("leaves a series known only without a year yearless", () => {
    const l = one("Captain America: Sam Wilson #5");
    expect(l).toMatchObject({ kind: "ok", flags: [], year: null });
    expect(l.rows[0].label).toBe("Captain America: Sam Wilson #5");
  });

  it("takes the catalog's spelling of a known series", () => {
    expect(one("captain america (1968) #2").rows[0].label).toBe("Captain America (1968) #2");
  });
});

describe("freeform and new series (AC-4)", () => {
  it.each(["Dark Reign: The Cabal", "Astonishing Tales #1 (Mojoworld)"])(
    "flags %s unparseable, offering to accept the normalised text",
    (typed) => {
      const l = one(`  ${typed} `);
      expect(l.kind).toBe("error");
      expect(l.rows).toEqual([]);
      expect(flag(l, "unparseable")).toEqual({ type: "unparseable", text: typed, suggestion: null });
    },
  );

  it("suggests the label a missing # would make (the mockup's Thor Annual 13)", () => {
    expect(flag(one("Thor Annual 13"), "unparseable")?.suggestion).toBe("Thor (1966) Annual #13");
  });

  it("flags a title missing from the known series as new, with ranked suggestions", () => {
    expect(SUGGEST_THRESHOLD).toBe(0.3); // the plan's threshold: pg_trgm's default
    const l = one("Captian America #1");
    const s = flag(l, "new_series")!.suggestions;
    expect(s[0].title).toBe("Captain America");
    expect(s.length).toBeGreaterThan(1);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].similarity).toBeGreaterThanOrEqual(s[i].similarity);
    for (const x of s) {
      expect(x.similarity).toBeGreaterThanOrEqual(SUGGEST_THRESHOLD);
      expect(x.similarity).toBe(trigramSimilarity("Captian America", x.title));
    }
    // The best five known titles at or above the threshold, none below it.
    const want = knownSeries
      .map((k) => ({ title: k.title, similarity: trigramSimilarity("Captian America", k.title) }))
      .filter((k) => k.similarity >= SUGGEST_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title))
      .slice(0, 5);
    expect(s).toEqual(want);
    expect(s.map((x) => x.title)).not.toContain("Thor");
  });

  it("offers nothing for a new series like no known title", () => {
    expect(flag(one("Balder the Brave #1"), "new_series")?.suggestions).toEqual([]);
  });

  it("scores trigrams the way pg_trgm does", () => {
    expect(trigramSimilarity("Thor", "thor")).toBe(1);
    expect(trigramSimilarity("Thor", "Daredevil")).toBe(0);
    expect(trigramSimilarity("word", "two words")).toBeCloseTo(4 / 11, 5);
  });

  it("gives every line a kind 1.3c can render without re-deriving it", () => {
    const out = parse(FIXTURE.map(([line]) => line).join("\n"));
    for (const l of out) {
      const types = l.flags.map((f) => f.type);
      const want = types.some((t) => t === "unparseable" || t === "bad_range")
        ? "error"
        : types.some((t) => t === "new_series" || t === "ambiguous_volume")
          ? "choice"
          : "ok";
      expect(l.kind, l.input).toBe(want);
    }
  });
});

describe("no database, no network (AC-5)", () => {
  it("imports nothing from src/db, postgres or fetch", () => {
    const src = readFileSync(new URL("../src/lib/bulk-parse.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/@\/db|src\/db|\.\.\/db/);
    expect(src).not.toMatch(/postgres/);
    expect(src).not.toMatch(/\bfetch\b/);
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
