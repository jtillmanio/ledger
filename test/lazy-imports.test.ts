// Task 1.30 (AC-3): Add books loads with its sheet, not with the page. Its
// tree (Search, Paste a list, By hand) was 9.4 KB of brotli on every books
// route before the first tap, and loading it lazily is what brought `/books`
// and `/books/list` back under their JS budgets (docs/02-architecture.md §
// Performance budget). A static import of any of these from a file those
// pages reach puts the bytes, and a script request, back on first load.
// The full page `/books/add` imports AddBooks statically, and may: nothing
// below reaches it, since a <Link> is not an import.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** Loaded only through `next/dynamic`, when the sheet opens. */
const LAZY = [
  "src/components/AddBooks.tsx",
  "src/components/BookSearch.tsx",
  "src/components/PasteBooks.tsx",
  "src/components/ByHand.tsx",
];

/** What `/books`, `/books/list` and `/books/status` render: the root layout, each page and its loading shell. */
const ROUTES = {
  "/books": ["src/app/layout.tsx", "src/app/books/page.tsx", "src/app/books/loading.tsx"],
  "/books/list": ["src/app/layout.tsx", "src/app/books/list/page.tsx", "src/app/books/list/loading.tsx"],
  "/books/status": ["src/app/layout.tsx", "src/app/books/status/page.tsx", "src/app/books/status/loading.tsx"],
};

const posix = (p: string) => normalize(p).split("\\").join("/");

/** A specifier as a file under src/, or null for a package. */
function resolve(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join("src", spec.slice(2))
    : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (base === null) return null;
  for (const ext of ["", ".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const file = base + ext;
    if (/\.tsx?$/.test(file) && existsSync(file)) return posix(relative(".", file));
  }
  return null;
}

/** The modules a file imports for their values: `import type` and `import()` are left out. */
export function staticImports(file: string): string[] {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, "");
  const specs: string[] = [];
  for (const m of src.matchAll(/^\s*(?:import|export)\s+(type\s+)?([\s\S]*?)\s+from\s+["']([^"']+)["']/gm)) {
    const [, typeOnly, clause, spec] = m;
    if (typeOnly) continue;
    // `import { type A, type B } from` brings in nothing at runtime either.
    const named = clause.match(/^\{([\s\S]*)\}$/);
    if (named && named[1].split(",").map((s) => s.trim()).filter(Boolean).every((s) => s.startsWith("type "))) continue;
    specs.push(spec);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]);
  return specs.flatMap((s) => resolve(file, s) ?? []);
}

/** Every file under src/ the entries reach through static imports. */
export function reach(entries: string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...staticImports(file));
  }
  return seen;
}

describe("Add books loads with its sheet (task 1.30, AC-3)", () => {
  it.each(Object.entries(ROUTES))("%s reaches none of Add books' tree through a static import", (_, entries) => {
    const reached = reach(entries);
    // The walk is not vacuous: it gets to the button and to the status control.
    expect(reached).toContain("src/components/AddBooksButton.tsx");
    expect(reached).toContain("src/components/BookStatus.tsx");
    expect(LAZY.filter((f) => reached.has(f))).toEqual([]);
  });

  it("the walk skips type-only and dynamic imports, and follows the rest", () => {
    // AddBooks imports PlanPicker's types and loads PlanPickerBody with next/dynamic.
    const fromAddBooks = staticImports("src/components/AddBooks.tsx");
    expect(fromAddBooks).toContain("src/components/BookSearch.tsx");
    expect(fromAddBooks).not.toContain("src/components/PlanPicker.tsx");
    // The full page may import it statically; nothing on the three routes reaches that page.
    expect(reach(["src/app/books/add/page.tsx"])).toContain("src/components/AddBooks.tsx");
  });
});
