// @vitest-environment node
// Task 3.4b, 2 of 3 (TASK-076; D-101, D-122, R2-08): /books/top, read against the TEST database and
// rendered with the page itself, then parsed back with happy-dom. A year is its whole list: the top ten,
// one divider, the rest of the ranks, then *Not ranked yet*, none behind a disclosure. The switcher
// holds every year with a finished read, newest first, then *No year*. The browser's half (moving a
// book, its undo, axe, the widths) is test/e2e/top-books.spec.ts.
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));
// The 10th of May 2026: 2026 is this year, *so far*.
vi.mock("@/lib/finish-date", async (orig) => ({ ...(await orig<typeof import("../src/lib/finish-date")>()), today: () => "2026-05-10" }));

const USER = "test-user";
const sql = testSql();
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  process.env.DATABASE_URL = requireTestUrl();
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const pad = (n: number) => String(n).padStart(2, "0");
/** 2024's fourteen reads: t01–t12 ranked 1–12 (ranked out of finish order), u1 and u2 not. */
const RANKED = Array.from({ length: 12 }, (_, i) => `t${pad(i + 1)}`);
const title = (id: string) => `Book ${id}`;

async function read(id: string, on: string | null, rank: number | null = null, format: "text" | "audio" = "text") {
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank, format)
            VALUES (${USER}, ${id}, ${on}, ${on ? "exact" : "none"}, ${rank}, ${format})`;
}

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  const ids = [...RANKED, "u1", "u2", "now", "old", "undated", "statusonly", "gone"];
  await sql`INSERT INTO books (id, title) SELECT id, 'Book ' || id FROM unnest(${ids}::text[]) id`;
  await sql`INSERT INTO book_status (user_id, book_id, status) SELECT ${USER}, id, 'read' FROM unnest(${ids}::text[]) id
            WHERE id <> 'statusonly'`;
  // Ranked in reverse of their finish order: the list follows the rank, never the date.
  for (const [i, id] of RANKED.entries()) await read(id, `2024-${pad(12 - i)}-01`, i + 1, i === 2 ? "audio" : "text");
  await read("u2", "2024-02-10");
  await read("u1", "2024-01-10");
  await read("now", "2026-03-02");
  await read("old", "2019-06-01");
  await read("undated", null);
  // A read its status holds alone (D-65), in 2019: listed, and counted in its year.
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${USER}, 'statusonly', 'read', '2019-08-01', 'exact')`;
  // A removed book's read is in no year.
  await read("gone", "2023-04-04");
  await sql`UPDATE books SET deleted_at = now() WHERE id = 'gone'`;
});

async function page(search: { year?: string } = {}) {
  const { default: Top } = await import("../src/app/books/top/page");
  const { UndoProvider } = await import("../src/components/Undo");
  const html = renderToStaticMarkup(createElement(UndoProvider, null, await Top({ searchParams: Promise.resolve(search) })));
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document;
}

type Doc = Awaited<ReturnType<typeof page>>;
const rows = (doc: Doc) => [...doc.querySelectorAll("ol.queue > li")];
const titles = (doc: Doc) => rows(doc).map((li) => li.querySelector(".qtitle")?.textContent?.trim());
const options = (doc: Doc) => [...doc.querySelectorAll(".topyear option")].map((o) => [o.getAttribute("value"), o.textContent]);
const selected = (doc: Doc) => doc.querySelector(".topyear option[selected]")?.getAttribute("value");

describe("a year's whole list (AC-2)", () => {
  it("2024 lists ranks 1–10, one divider, ranks 11–12, then Not ranked yet with the 2 unranked: 14 rows, none collapsed", async () => {
    const doc = await page({ year: "2024" });
    expect(titles(doc)).toEqual([...RANKED, "u1", "u2"].map(title));
    expect(rows(doc)).toHaveLength(14);
    // No disclosure: only the row menus' ⋯ buttons say aria-expanded.
    expect(doc.querySelectorAll("details, [hidden], [aria-expanded]:not(.rowmenu-btn)")).toHaveLength(0);

    const dividers = doc.querySelectorAll(".rankdiv");
    expect(dividers).toHaveLength(1);
    // The divider heads the eleventh row: ten above it.
    expect(rows(doc).findIndex((li) => li.querySelector(".rankdiv"))).toBe(10);
    expect(dividers[0].getAttribute("role")).toBe("separator");

    const head = doc.querySelectorAll(".rankhead");
    expect(head).toHaveLength(1);
    expect(head[0].tagName).toBe("H2");
    expect(head[0].textContent).toBe("Not ranked yet 2");
    expect(rows(doc).findIndex((li) => li.querySelector(".rankhead"))).toBe(12);

    // The rank sits on the cover, 1–12; an unranked read has none.
    expect(rows(doc).map((li) => li.querySelector(".rankno")?.textContent ?? null))
      .toEqual([...RANKED.map((_, i) => String(i + 1)), null, null]);
  });

  it("names each handle and row menu with the title and its rank, or not ranked yet", async () => {
    const doc = await page({ year: "2024" });
    const handles = [...doc.querySelectorAll("button.drag")].map((b) => b.getAttribute("aria-label"));
    expect(handles).toEqual([
      ...RANKED.map((id, i) => `Reorder ${title(id)}, rank ${i + 1}`),
      `Reorder ${title("u1")}, not ranked yet`, `Reorder ${title("u2")}, not ranked yet`,
    ]);
    const menus = [...doc.querySelectorAll("button.rowmenu-btn")].map((b) => b.getAttribute("aria-label"));
    expect(menus).toEqual([
      ...RANKED.map((id, i) => `More for ${title(id)}, rank ${i + 1}`),
      `More for ${title("u1")}, not ranked yet`, `More for ${title("u2")}, not ranked yet`,
    ]);
    // A listen is ranked like any read, with the headphones glyph (1.23).
    expect(rows(doc)[2].querySelector('svg.listen[aria-label="Listened"]')).not.toBeNull();
  });

  it("draws no divider when ten or fewer are ranked, and no Not ranked yet when every read is", async () => {
    await sql`UPDATE read_events SET year_rank = NULL WHERE book_id IN ('t11', 't12')`;
    let doc = await page({ year: "2024" });
    expect(doc.querySelectorAll(".rankdiv")).toHaveLength(0);
    expect(doc.querySelector(".rankhead")?.textContent).toBe("Not ranked yet 4");
    await sql`UPDATE read_events SET year_rank = 1 WHERE book_id = 'now'`;
    doc = await page({ year: "2026" });
    expect(doc.querySelectorAll(".rankhead, .rankdiv")).toHaveLength(0);
  });
});

describe("the year switcher (AC-3)", () => {
  it("lists exactly the years with a finished read, newest first, then No year", async () => {
    const doc = await page();
    // 2023's only read is of a removed book.
    expect(options(doc)).toEqual([["2026", "2026"], ["2024", "2024"], ["2019", "2019"], ["none", "No year"]]);
  });

  it("leaves No year out when no read is undated", async () => {
    await sql`DELETE FROM read_events WHERE book_id = 'undated'`;
    await sql`DELETE FROM book_status WHERE book_id = 'undated'`;
    expect(options(await page()).map(([v]) => v)).toEqual(["2026", "2024", "2019"]);
  });

  it("opens on this year, whose heading says so far", async () => {
    const doc = await page();
    expect(doc.querySelector("h1")?.textContent).toBe("Best of 2026 so far");
    expect(doc.querySelector(".top-ctl .ctl .mono")?.textContent).toBe("1 read so far");
    expect(selected(doc)).toBe("2026");
  });

  it("takes the year from the URL: a past year has no so far", async () => {
    const doc = await page({ year: "2024" });
    expect(doc.querySelector("h1")?.textContent).toBe("Best of 2024");
    expect(doc.querySelector(".top-ctl .ctl .mono")?.textContent).toBe("14 read");
    expect(selected(doc)).toBe("2024");
  });

  it("counts a read its status holds alone in its year", async () => {
    const doc = await page({ year: "2019" });
    expect(titles(doc)).toEqual([title("old"), title("statusonly")]);
  });

  it("opens a year with no read, or a nonsense one, on the newest year", async () => {
    for (const year of ["1999", "2023", "abc"]) {
      const doc = await page({ year });
      expect(selected(doc), year).toBe("2026");
      expect(doc.querySelector("h1")?.textContent, year).toBe("Best of 2026 so far");
    }
    // This year with no read yet: the newest year with one.
    await sql`DELETE FROM read_events WHERE book_id = 'now'`;
    expect(selected(await page())).toBe("2024");
  });

  it("No year lists the undated reads, with no handle: there is no year to rank in", async () => {
    const doc = await page({ year: "none" });
    expect(doc.querySelector("h1")?.textContent).toBe("No year");
    expect(selected(doc)).toBe("none");
    expect(titles(doc)).toEqual([title("undated")]);
    expect(doc.querySelectorAll("button.drag")).toHaveLength(0);
  });
});

describe("what a year counts (D-65, R2-08)", () => {
  it("lists a reread in each year it was read, and nothing of another user's", async () => {
    await read("now", "2019-02-02");
    await sql`INSERT INTO users (id, name) VALUES ('someone', 'Else')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank)
              VALUES ('someone', 'u1', '2025-05-05', 'exact', 1), ('someone', 'old', NULL, 'none', NULL)`;
    expect(titles(await page({ year: "2019" }))).toEqual([title("now"), title("old"), title("statusonly")]);
    expect(titles(await page({ year: "2026" }))).toEqual([title("now")]);
    const doc = await page();
    // 2025 is someone else's only.
    expect(options(doc).map(([v]) => v)).toEqual(["2026", "2024", "2019", "none"]);
    expect(titles(await page({ year: "none" }))).toEqual([title("undated")]);
  });

  it("counts a year-only finish in its year, with no month, and an undated status-only read under No year", async () => {
    await sql`UPDATE read_events SET finished_on = '2019-07-01', finished_on_precision = 'approximate' WHERE book_id = 'old'`;
    await sql`UPDATE book_status SET finished_on = NULL, finished_on_precision = 'none' WHERE book_id = 'statusonly'`;
    const y2019 = await page({ year: "2019" });
    expect(titles(y2019)).toEqual([title("old")]);
    expect(rows(y2019)[0].querySelector(".qwords")).toBeNull();
    expect(titles(await page({ year: "none" }))).toEqual([title("statusonly"), title("undated")]);
  });

  it("lists a tie a re-dated read left in read order, as rankRead renumbers it", async () => {
    // t05 re-dated in from another year with its rank 2: two reads at 2, the later-logged one second.
    await sql`UPDATE read_events SET year_rank = 2 WHERE book_id = 't05'`;
    const order = titles(await page({ year: "2024" }));
    expect(order.slice(0, 4)).toEqual([title("t01"), title("t02"), title("t05"), title("t03")]);
  });
});

describe("the states (AC-6)", () => {
  it("empty: no finished read says so, with one action", async () => {
    await sql`DELETE FROM read_events`;
    await sql`UPDATE book_status SET status = 'to_read', finished_on = NULL, finished_on_precision = 'none'`;
    const doc = await page();
    expect(doc.querySelector("h1")?.textContent).toBe("Top books");
    expect(doc.querySelector(".top-empty p")?.textContent).toMatch(/^Nothing finished yet/);
    expect([...doc.querySelectorAll(".top-empty a")].map((a) => a.getAttribute("href"))).toEqual(["/books/list"]);
    expect(doc.querySelector(".topyear")).toBeNull();
  });

  it("loading: the loaded geometry, busy, ten rows", async () => {
    const { default: Loading } = await import("../src/app/books/top/loading");
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(Loading));
    const doc = window.document;
    expect(doc.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(doc.querySelectorAll(".top-page ol.queue > li.qrow")).toHaveLength(10);
    expect(doc.querySelectorAll(".top-ctl .sk-select")).toHaveLength(1);
  });

  it("error: a neutral alert and Try again, nothing danger", async () => {
    const { default: TopError } = await import("../src/app/books/top/error");
    const window = new Window();
    window.document.body.innerHTML = renderToStaticMarkup(createElement(TopError, { error: new Error("x"), reset: () => {} }));
    const doc = window.document;
    expect(doc.querySelector('[role="alert"]')?.textContent).toMatch(/Couldn.t load your top books/);
    expect(doc.querySelector("button")?.textContent).toBe("Try again");
    expect(doc.body.innerHTML).not.toMatch(/danger/);
  });
});
