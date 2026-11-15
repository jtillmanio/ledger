// @vitest-environment happy-dom
// The Library draws no year chip (task 3.4b, D-122, R2-08). A year's reading, and a
// read with no finish date, are found on Top books' year switcher; `/books/list`
// keeps the status, genre and Unlisted chips and the Finished sort. `?year=` is
// no longer a parameter, so an old link opens the whole list.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCss } from "../scripts/lib/css-rules.mjs";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));

const listBooks = vi.hoisted(() => vi.fn<(userId: string, options: Record<string, unknown>) => Promise<unknown[]>>(async () => []));
vi.mock("@/db/queries", () => ({
  listBooks,
  OWNED_FILTERS: ["physical", "audio", "ebook", "none"],
  seriesProgress: async () => [],
  listCounts: async () => ({ unlisted: 0, genres: [] }),
  inboxCount: async () => 0,
}));

const { default: Books } = await import("../src/app/books/list/page");

async function render(search: Record<string, string> = {}): Promise<Document> {
  const html = renderToStaticMarkup(await Books({ searchParams: Promise.resolve(search) }));
  return new DOMParser().parseFromString(html, "text/html");
}

beforeEach(() => listBooks.mockClear());

describe("the Library's year chips are gone", () => {
  it("draws no chip that filters by year, and no No year chip", async () => {
    const doc = await render();
    const chips = [...doc.querySelectorAll<HTMLAnchorElement>("a.chip")];
    // The status chips are still there: the page did not lose its chip row.
    expect(chips.map((a) => a.textContent)).toEqual(expect.arrayContaining(["Everything", "Reading", "To read", "Read"]));
    expect(chips.filter((a) => (a.getAttribute("href") ?? "").includes("year="))).toEqual([]);
    expect(chips.filter((a) => /no year/i.test(a.textContent ?? ""))).toEqual([]);
    expect(doc.body.textContent).not.toMatch(/no year/i);
  });

  it("ignores ?year=2024 and ?year=none: listBooks is asked for neither", async () => {
    for (const year of ["2024", "none"]) {
      listBooks.mockClear();
      const doc = await render({ year });
      expect(listBooks).toHaveBeenCalledTimes(1);
      const options = listBooks.mock.calls[0]![1] as Record<string, unknown>;
      expect(options).not.toHaveProperty("year");
      expect(options).not.toHaveProperty("noYear");
      // Nothing else on the page carries the old param either: Everything is current, as with no filter.
      expect(doc.querySelector('a.chip[aria-current="true"]')?.textContent).toBe("Everything");
      for (const a of doc.querySelectorAll("a")) expect(a.getAttribute("href") ?? "").not.toContain("year=");
    }
  });

  it("still passes the Finished sort on to listBooks", async () => {
    await render({ sort: "finished", dir: "asc" });
    expect(listBooks.mock.calls[0]![1]).toMatchObject({ sort: "finished", dir: "asc" });
  });
});

describe("the chip count rule", () => {
  // The Unlisted chip still shows a count (`.chip .n`), so the rule keeps its rule between label and number (D-71).
  it("splits the count from the label with an outline-token rule and at least 8px each side", () => {
    const rules = parseCss(readFileSync("src/app/globals.css", "utf8"));
    const rule = rules.find((r) => r.media.length === 0 && r.selectors.includes(".chip .n"));
    expect(rule).toBeDefined();
    const rem = (v: string | undefined) => Number(/^([\d.]+)rem$/.exec(v ?? "")?.[1] ?? 0);
    expect(rem(rule!.decls["margin-left"])).toBeGreaterThanOrEqual(0.5);
    expect(rem(rule!.decls["padding-left"])).toBeGreaterThanOrEqual(0.5);
    expect(rule!.decls["border-left"]).toBe("1px solid var(--faint-deco)");
  });
});
