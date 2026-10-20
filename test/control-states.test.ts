// Task 1.8a (UX-N01; AC-1, AC-3, AC-5): every interactive class answers hover,
// press, keyboard focus and being unavailable the same way, and globals.css only
// uses the radius scale. The matrix is design/Specimen.dc.html B5; the rules are
// read out of globals.css, so a class that loses a state fails here.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compounds, parseCss, type CssRule } from "../scripts/lib/css-rules.mjs";

type Rule = CssRule;
const rules: Rule[] = parseCss(readFileSync("src/app/globals.css", "utf8"));

// `subject` tests the last compound (the element the state lands on); `within`
// tests the compounds before it. \b-style bounds keep `.row` apart from `.rows`
// and `.row-link`.
const bound = (cls: string) => new RegExp(`${cls.replace(".", "\\.")}(?![\\w-])`);
type Entry = { name: string; subject: RegExp; within?: RegExp };
const MATRIX: Entry[] = [
  { name: ".btn", subject: bound(".btn") },
  { name: ".iconbtn", subject: bound(".iconbtn") },
  { name: ".chip", subject: bound(".chip") },
  { name: ".seg button", subject: /^button(?![\w-])/, within: bound(".seg") },
  { name: ".bar .tab", subject: bound(".tab"), within: bound(".bar") },
  { name: ".side a", subject: /^a(?![\w-])/, within: bound(".side") },
  { name: ".row", subject: bound(".row") },
  { name: ".switch", subject: bound(".switch") },
  { name: ".stepper button", subject: /^button(?![\w-])/, within: bound(".stepper") },
];

function rulesFor(entry: Entry, state: string): Rule[] {
  return rules.filter((r) =>
    r.selectors.some((sel) => {
      const parts: string[] = compounds(sel);
      const last = parts[parts.length - 1] ?? "";
      if (!last.includes(state) || !entry.subject.test(last)) return false;
      return entry.within ? entry.within.test(parts.slice(0, -1).join(" ")) : true;
    }),
  );
}

const STATES = {
  hover: ":hover",
  active: ":active",
  focus: ":focus-visible",
  disabled: '[aria-disabled="true"]',
} as const;

describe("control states (UX-N01)", () => {
  for (const entry of MATRIX) {
    describe(entry.name, () => {
      it("has a hover rule inside @media (hover:hover)", () => {
        const found = rulesFor(entry, STATES.hover);
        expect(found.length).toBeGreaterThan(0);
        for (const r of found) expect(r.media.join(" ")).toContain("(hover:hover)");
      });

      it("has a pressed rule that moves 1px down", () => {
        const found = rulesFor(entry, STATES.active);
        expect(found.length).toBeGreaterThan(0);
        expect(found.some((r) => /translateY\(1px\)/.test(r.decls.transform ?? ""))).toBe(true);
      });

      it("has a :focus-visible rule drawn with --focus-ring", () => {
        const found = rulesFor(entry, STATES.focus);
        expect(found.length).toBeGreaterThan(0);
        expect(found.some((r) => (r.decls["box-shadow"] ?? "").includes("var(--focus-ring)"))).toBe(true);
      });

      it('has an [aria-disabled="true"] rule that dims it and shows not-allowed', () => {
        const found = rulesFor(entry, STATES.disabled);
        expect(found.length).toBeGreaterThan(0);
        expect(found.some((r) => r.decls.opacity !== undefined && /not-allowed/.test(r.decls.cursor ?? ""))).toBe(true);
      });
    });
  }

  it("each state-matrix control has hover, active, focus-visible and aria-disabled rules", () => {
    const missing = MATRIX.flatMap((e) =>
      Object.entries(STATES)
        .filter(([, state]) => rulesFor(e, state).length === 0)
        .map(([name]) => `${e.name} ${name}`),
    );
    expect(missing).toEqual([]);
  });

  it("a hover rule never lands on an unavailable control", () => {
    for (const e of MATRIX) {
      for (const r of rulesFor(e, STATES.hover)) {
        const subjects = r.selectors.filter((s) => compounds(s).at(-1)?.includes(":hover") && e.subject.test(compounds(s).at(-1) ?? ""));
        for (const s of subjects) expect(s, `${e.name} hover`).toContain(':not([aria-disabled="true"])');
      }
    }
  });
});

describe("radius scale (UX-N04)", () => {
  it("border-radius values are var(--r-*) or 50%", () => {
    const bad: string[] = [];
    for (const r of rules) {
      const v = r.decls["border-radius"];
      if (v === undefined) continue;
      const parts = v.split(/\s+(?![^(]*\))/);
      if (!parts.every((p) => /^var\(--r-[\w-]+\)$/.test(p) || p === "50%")) bad.push(`${r.selectors.join(", ")}: ${v}`);
    }
    expect(bad).toEqual([]);
  });

  it("the raw-text grep agrees: nothing but var(--r-*) and 50% follows border-radius:", () => {
    const text = readFileSync("src/app/globals.css", "utf8");
    const values = [...new Set([...text.matchAll(/border-radius:([^;}]+)/g)].map((m) => m[1].trim()))];
    for (const v of values) expect(v).toMatch(/^(var\(--r-[\w-]+\)|50%)( (var\(--r-[\w-]+\)|50%))*$/);
  });
});

describe("reduced motion (AC-3)", () => {
  const reduced = rules.filter((r) => r.media.some((m) => m.includes("prefers-reduced-motion")));

  it("the reduced-motion block stops animation on everything but .spin", () => {
    const stop = reduced.find((r) => r.selectors.includes("*:not(.spin)"));
    expect(stop, "a *:not(.spin) rule").toBeDefined();
    expect(stop!.decls.animation).toMatch(/^none\s*!important$/);
    expect(stop!.selectors).toEqual(expect.arrayContaining(["*::before", "*::after"]));
  });

  it(".spin keeps spinning: no reduced-motion rule names it or stops it", () => {
    for (const r of reduced) {
      if (r.selectors.includes("*:not(.spin)")) continue;
      if (r.decls.animation !== undefined) expect(r.selectors.join(",")).not.toMatch(/\.spin/);
    }
    const spin = rules.find((r) => r.selectors.includes(".spin") && r.media.length === 0);
    expect(spin?.decls.animation).toMatch(/^spin\b/);
  });
});
