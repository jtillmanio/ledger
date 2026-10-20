// @vitest-environment happy-dom
// /books' year chips (owner, 2026-10-20): `2024 12` read as one number, because
// the count sat 6px from the year in the same grey. The count is now split from
// its label by a rule in the outline token (D-71), and each chip's name says
// what the number is: a year counts reads, not books (D-65).
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseCss } from "../scripts/lib/css-rules.mjs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));
vi.mock("@/db/queries", () => ({
  listBooks: async () => [],
  // Two genres in 2024: the chip sums them.
  yearSummary: async () => [
    { year: 2024, genre: "Fantasy", books: 7, words: 0 },
    { year: 2024, genre: "Horror", books: 5, words: 0 },
    { year: 2023, genre: "Fantasy", books: 3, words: 0 },
  ],
  seriesProgress: async () => [],
  readWithoutYear: async () => 4,
  inboxCount: async () => 0,
}));

const { default: Books } = await import("../src/app/books/list/page");

async function chips(): Promise<HTMLAnchorElement[]> {
  const html = renderToStaticMarkup(await Books({ searchParams: Promise.resolve({}) }));
  const doc = new DOMParser().parseFromString(html, "text/html");
  return [...doc.querySelectorAll<HTMLAnchorElement>('a.chip[href^="/books/list?year="]')];
}

describe("year chips", () => {
  it("name each count as reads, the year first", async () => {
    const names = (await chips()).map((a) => a.getAttribute("aria-label"));
    expect(names).toEqual(["2024, 12 read", "2023, 3 read", "No year, 4 read"]);
  });

  it("keep the count in its own element", async () => {
    for (const a of await chips()) expect(a.querySelector(".n")?.textContent).toMatch(/^\d+$/);
  });

  it("split the count from the year with an outline-token rule and at least 8px each side", () => {
    const rules = parseCss(readFileSync("src/app/globals.css", "utf8"));
    const rule = rules.find((r) => r.media.length === 0 && r.selectors.includes(".chip .n"));
    expect(rule).toBeDefined();
    const rem = (v: string | undefined) => Number(/^([\d.]+)rem$/.exec(v ?? "")?.[1] ?? 0);
    expect(rem(rule!.decls["margin-left"])).toBeGreaterThanOrEqual(0.5);
    expect(rem(rule!.decls["padding-left"])).toBeGreaterThanOrEqual(0.5);
    expect(rule!.decls["border-left"]).toBe("1px solid var(--faint-deco)");
  });
});
