// @vitest-environment node
// Task 2.10 (F-23, D-37, D-104, D-7): /books/plan, read against the TEST database and rendered with the
// page itself, then parsed back with happy-dom. Figures in the fixture are the fixture's own (D-7): what is
// asserted is a relationship to the capacity the view reports. The browser's half (the rail's pixels, the
// picker opening, axe) is test/e2e/plan-rail.spec.ts.
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { kWords } from "../src/lib/plan-rail";
import { testSql, truncateAll } from "./db";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));
// The 10th of May 2027: Q2 is this quarter.
vi.mock("@/lib/finish-date", async (orig) => ({ ...(await orig<typeof import("../src/lib/finish-date")>()), today: () => "2027-05-10" }));

const USER = "test-user";
const sql = testSql();
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

type Seed = { id: string; title: string; period: string; ordinal: number | null; words?: number; pages?: number; author?: string; series?: string; position?: number };

async function seed(books: Seed[]) {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Ursula Fixture')`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('se', 'The Fixture Cycle', 'au')`;
  for (const b of books) {
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source, page_count)
      VALUES (${b.id}, ${b.title}, ${b.author ? "au" : null}, ${b.series ? "se" : null}, ${b.position ?? null},
              ${b.words ?? null}, ${b.words == null ? null : "stated"}, ${b.pages ?? null})`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${b.id}, 'to_read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${b.id}, ${b.period}, ${b.ordinal})`;
  }
}

async function page(search: { year?: string } = {}) {
  const { default: Plan } = await import("../src/app/books/plan/page");
  const html = renderToStaticMarkup(await Plan({ searchParams: Promise.resolve(search) }));
  const window = new Window();
  window.document.body.innerHTML = html;
  return { html, doc: window.document };
}

/** Q1 holds books; Q2–Q4 are empty. Q1 is behind: today is in Q2. */
const Q1_ONLY: Seed[] = [
  { id: "a", title: "Alpha", period: "2027-Q1", ordinal: 1, words: 200_000 },
  { id: "b", title: "Bravo", period: "2027-Q1", ordinal: 2, words: 150_000 },
];

/** Q2 (this quarter) holds three books whose ordinal order is not their title order; Q3 is over; Q4 empty. */
const MIXED: Seed[] = [
  ...Q1_ONLY,
  { id: "z", title: "Zulu", period: "2027-Q2", ordinal: 1, words: 120_000, author: "au", series: "se", position: 2 },
  { id: "m", title: "Mike", period: "2027-Q2", ordinal: 2, pages: 400 },
  { id: "k", title: "Kilo", period: "2027-Q2", ordinal: 3 },
  { id: "q1", title: "Quebec", period: "2027-Q3", ordinal: 1, words: 500_000 },
  { id: "q2", title: "Quartz", period: "2027-Q3", ordinal: 2, words: 400_000 },
  { id: "yr", title: "Yearly", period: "2027", ordinal: null, words: 90_000 },
];

describe("the open quarter and the summary rows (AC-3)", () => {
  beforeEach(() => seed(MIXED));

  it("opens exactly one quarter, this one, with its books in ordinal order and a Move named for each", async () => {
    const { doc } = await page();
    const open = doc.querySelectorAll(".plan-open");
    expect(open).toHaveLength(1);
    expect(open[0].getAttribute("data-period")).toBe("2027-Q2");
    // Ordinal order, not title order: Zulu, Mike, Kilo.
    const rows = [...open[0].querySelectorAll(".plan-row")];
    expect(rows.map((r) => r.querySelector(".row-title")?.textContent)).toEqual(["Zulu", "Mike", "Kilo"]);
    expect(rows.map((r) => r.getAttribute("data-book"))).toEqual(["z", "m", "k"]);
    const moves = [...open[0].querySelectorAll("button.plan-move")];
    expect(moves.map((m) => m.getAttribute("aria-label"))).toEqual(["Move Zulu", "Move Mike", "Move Kilo"]);
    for (const m of moves) expect(m.textContent).toBe("Move");
    expect(rows[0].querySelector(".row-sub")?.textContent).toBe("Ursula Fixture · The Fixture Cycle #2");
  });

  it("draws each of the other three as one summary button, collapsed, with its total, book count and room", async () => {
    const { doc } = await page();
    const sums = [...doc.querySelectorAll("button.plan-sum")];
    expect(sums.map((s) => s.getAttribute("data-period"))).toEqual(["2027-Q1", "2027-Q3", "2027-Q4"]);
    for (const s of sums) expect(s.getAttribute("aria-expanded")).toBe("false");
    const { quarters } = await q.planCapacity(USER, 2027);
    const q1 = sums[0];
    expect(q1.textContent).toContain("Q1 2027");
    expect(q1.textContent).toContain(kWords(350_000));
    expect(q1.textContent).toContain("2 books");
    expect(q1.textContent).toContain(`${kWords(quarters[0].capacity - 350_000)} room`);
    expect(sums[2].textContent).toContain("0 books");
    // The open quarter's heading says its words against its capacity.
    expect(doc.querySelector(".plan-open h2")?.textContent).toContain(`${kWords(quarters[1].plannedWords)} of ${kWords(quarters[1].capacity)}`);
    // Move is on the open quarter's rows only.
    expect(doc.querySelectorAll("button.plan-move")).toHaveLength(3);
  });

  it("leaves the fifth lane's books and On deck out of every list: rows are quarters' books", async () => {
    const { doc } = await page();
    expect(doc.querySelector('[data-book="yr"].plan-row')).toBeNull();
    // ...but the year's book is a block in the rail's fifth lane.
    expect(doc.querySelector('.qcol.nq [data-book="yr"]')).not.toBeNull();
  });

  it("an estimated count reads ~ on its row, and a book with none says so", async () => {
    const { doc } = await page();
    const words = (id: string) => doc.querySelector(`.plan-row[data-book="${id}"] .rm`);
    expect(words("z")?.textContent).toBe("120k");
    expect(words("z")?.hasAttribute("data-wc")).toBe(false);
    // 400 pages at 275 words a page.
    expect(words("m")?.textContent).toBe("~110k");
    expect(words("m")?.getAttribute("data-wc")).toBe("estimated");
    expect(words("k")?.textContent).toBe("no count");
  });

  it("starts on this quarter this year, and on Q1 in a later year", async () => {
    expect((await page()).doc.querySelector(".plan-open")?.getAttribute("data-period")).toBe("2027-Q2");
    const later = (await page({ year: "2028" })).doc;
    expect(later.querySelector(".plan-open")?.getAttribute("data-period")).toBe("2028-Q1");
    expect(later.querySelectorAll("button.plan-sum")).toHaveLength(3);
  });
});

describe("a row names the author, the universe, then the series and number (task 2.2j, D-134)", () => {
  beforeEach(async () => {
    // truncateAll leaves the universes, and truncating them cascades to the books: clear them first.
    await sql`TRUNCATE book_universes CASCADE`;
    await seed(MIXED);
    await sql`INSERT INTO book_universes (id, name) VALUES ('un', 'Fixture Universe')`;
    await sql`UPDATE books SET universe_id = 'un' WHERE id = 'z'`;
  });

  it("planRows returns the universe's name, null for a book in none", async () => {
    const rows = await q.planRows(USER, 2027);
    expect(rows.find((r) => r.id === "z")?.universe).toBe("Fixture Universe");
    expect(rows.find((r) => r.id === "m")?.universe).toBeNull();
    expect(rows).toHaveLength(new Set(rows.map((r) => r.id + r.period)).size);
  });

  it("the open quarter's row reads the same line the dashboard does", async () => {
    const { doc } = await page();
    expect(doc.querySelector('.plan-row[data-book="z"] .row-sub')?.textContent)
      .toBe("Ursula Fixture · Fixture Universe · The Fixture Cycle #2");
  });
});

describe("one empty state, not one per empty quarter (AC-4)", () => {
  beforeEach(() => seed(Q1_ONLY));

  it("names the room across Q2–Q4: each quarter's capacity summed, less what they hold", async () => {
    const { doc } = await page();
    const { quarters } = await q.planCapacity(USER, 2027);
    const room = quarters.slice(1).reduce((n, c) => n + c.capacity - c.plannedWords, 0);
    const line = doc.querySelectorAll(".plan-room-line");
    expect(line).toHaveLength(1);
    expect(line[0].textContent).toBe(`${kWords(room)} of room across Q2–Q4`);
    // 2.10b's Suggest opens the planning sheet at the quarter ahead with the most room: Q2–Q4 are empty, so the first.
    expect(doc.querySelector(".plan-room-sub")?.textContent).toBe("Suggest opens the planning sheet at the quarter with the most room.");
    const suggest = doc.querySelector(".plan-room button.plan-suggest");
    expect(suggest?.textContent).toBe("Suggest");
    expect(suggest?.getAttribute("data-plan-target")).toBe("2027-Q2");
    expect(doc.querySelector('.plan-room a[href="/books/list"]')).toBeNull();
  });

  it("opens the planning sheet from the header and from every quarter (task 2.10b, AC-2)", async () => {
    const { doc } = await page();
    expect(doc.querySelector('.plan-head button[data-plan-target="2027"]')?.textContent).toBe("Plan 2027…");
    // Beside it, + Add books (the mockup's desktop header; TASK-069's follow-up).
    expect([...doc.querySelectorAll(".plan-head-acts button")].map((b) => b.textContent)).toEqual(["Plan 2027…", "+ Add books"]);
    expect([...doc.querySelectorAll("button.plan-this")].map((b) => b.getAttribute("data-plan-target")).sort())
      .toEqual(["2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);
  });

  it("Suggest skips a quarter already past and picks the roomiest ahead", async () => {
    // Q2 (this quarter) takes a book: Q3 and Q4 are equal and emptier, so Suggest opens Q3; Q1, past, is never chosen.
    await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES ('sug', 'Suggest Holder', 50000, 'stated')`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'sug', 'to_read')`;
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, 'sug', '2027-Q2', 1)`;
    const { doc } = await page();
    expect(doc.querySelector(".plan-room button.plan-suggest")?.getAttribute("data-plan-target")).toBe("2027-Q3");
  });

  it("draws no empty state of its own for the open quarter or a summary row", async () => {
    const { doc, html } = await page();
    // The open quarter (Q2) is empty: heading only, no list, no message.
    expect(doc.querySelector(".plan-open")?.getAttribute("data-period")).toBe("2027-Q2");
    expect(doc.querySelectorAll(".plan-open .plan-row")).toHaveLength(0);
    expect(doc.querySelectorAll(".plan-open ul")).toHaveLength(0);
    expect(doc.querySelectorAll(".empty")).toHaveLength(0);
    expect(doc.querySelectorAll(".plan-room")).toHaveLength(1);
    expect(html.match(/of room/g)).toHaveLength(1);
  });

  it("counts the quarters ahead that hold books: what they hold comes off their capacity", async () => {
    await seed([
      ...Q1_ONLY,
      { id: "c", title: "Charlie", period: "2027-Q2", ordinal: 1, words: 100_000 },
      { id: "d", title: "Delta", period: "2027-Q3", ordinal: 1, words: 100_000 },
      { id: "e", title: "Echo", period: "2027-Q4", ordinal: 1, words: 100_000 },
    ]);
    const { quarters } = await q.planCapacity(USER, 2027);
    const room = quarters.slice(1).reduce((n, c) => n + c.capacity - c.plannedWords, 0);
    expect((await page()).doc.querySelector(".plan-room-line")?.textContent).toBe(`${kWords(room)} of room across Q2–Q4`);
  });

  it("is not drawn when no quarter ahead has room", async () => {
    await seed([
      ...Q1_ONLY,
      { id: "c", title: "Charlie", period: "2027-Q2", ordinal: 1, words: 900_000 },
      { id: "d", title: "Delta", period: "2027-Q3", ordinal: 1, words: 900_000 },
      { id: "e", title: "Echo", period: "2027-Q4", ordinal: 1, words: 900_000 },
    ]);
    expect((await page()).doc.querySelectorAll(".plan-room")).toHaveLength(0);
  });
});

describe("amber for over, never red (AC-4)", () => {
  beforeEach(() => seed(MIXED));

  it("an over quarter's badges are .bdg.bl everywhere, and nothing on the page is a danger class", async () => {
    const { doc, html } = await page();
    const { quarters } = await q.planCapacity(USER, 2027);
    const over = quarters[2].plannedWords - quarters[2].capacity;
    expect(over).toBeGreaterThan(0);
    const q3 = doc.querySelector('button.plan-sum[data-period="2027-Q3"] .bdg');
    expect(q3?.className).toBe("bdg bl");
    expect(q3?.textContent).toBe(`over ${kWords(over)}`);
    // The rail's footer badges are the same amber.
    for (const badge of doc.querySelectorAll(".qfoot .bdg.bl")) expect(badge.className).toContain("bl");
    expect(html).not.toMatch(/danger|\bdg\b|#[0-9a-f]{3,8}\b/i);
    // A quarter with room says so in grey, not in amber.
    expect(doc.querySelector('button.plan-sum[data-period="2027-Q4"] .bdg')?.className).toBe("bdg dn");
  });
});

describe("the rail and the dashboard read the same totals (AC-1)", () => {
  beforeEach(() => seed(MIXED));

  it("a quarter's footer on this page and the dashboard strip's figure both come from planCapacity", async () => {
    const { doc } = await page();
    const { quarters } = await q.planCapacity(USER, 2027);
    const { default: QuarterStrip } = await import("../src/components/QuarterStrip");
    const blocks = await q.quarterBlocks(USER, "2027-Q3");
    const strip = new Window();
    strip.document.body.innerHTML = renderToStaticMarkup(createElement(QuarterStrip, { cap: quarters[2], blocks, inHand: null }));
    const planned = kWords(quarters[2].plannedWords);
    expect(strip.document.querySelector(".qfigs .qfig")?.textContent).toContain(`${planned} planned`);
    expect(doc.querySelector('.qcol[data-period="2027-Q3"] .qfoot .mono')?.textContent).toContain(planned);
    // ...and the words of the blocks each draws add up to that same total.
    const sum = (rows: { words: number }[]) => rows.reduce((n, r) => n + r.words, 0);
    expect(sum(blocks)).toBe(quarters[2].plannedWords);
    expect(sum((await q.planRail(USER, 2027)).filter((r) => r.period === "2027-Q3"))).toBe(quarters[2].plannedWords);
    expect(sum((await q.planRows(USER, 2027)).filter((r) => r.period === "2027-Q3" && r.words !== null) as { words: number }[]))
      .toBe(quarters[2].plannedWords);
  });
});

describe("the year switch", () => {
  beforeEach(() => seed(MIXED));

  it("links this year and the next four, and marks the one shown", async () => {
    const { doc } = await page();
    const chips = [...doc.querySelectorAll('nav[aria-label="Year"] a')];
    expect(chips.map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("aria-current")])).toEqual([
      ["2027", "/books/plan", "true"],
      ["2028", "/books/plan?year=2028", "false"],
      ["2029", "/books/plan?year=2029", "false"],
      ["2030", "/books/plan?year=2030", "false"],
      ["2031", "/books/plan?year=2031", "false"],
    ]);
    expect([...(await page({ year: "2029" })).doc.querySelectorAll('nav[aria-label="Year"] a[aria-current="true"]')].map((a) => a.textContent)).toEqual(["2029"]);
  });

  it("reads an out-of-range or malformed year as this year", async () => {
    for (const year of ["1999", "2040", "soon", "2027.5"]) {
      const { doc } = await page({ year });
      expect(doc.querySelector('nav[aria-label="Year"] a[aria-current="true"]')?.textContent, year).toBe("2027");
      expect(doc.querySelector(".planrail")?.getAttribute("aria-label"), year).toBe("Plan 2027");
    }
  });

  it("heads the page Plan, with the year's running total under it", async () => {
    const { doc } = await page();
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    expect(doc.querySelector("h1")?.textContent).toBe("Plan");
    const { year } = await q.planCapacity(USER, 2027);
    expect(doc.querySelector(".plan-total")?.textContent).toBe(`${year.books} books · ${kWords(year.plannedWords)} of ${kWords(year.capacity)}`);
    expect((await page({ year: "2030" })).doc.querySelector(".plan-total")?.textContent).toBe("2030: nothing planned");
  });
});

describe("a book that was removed or has no quarter is no row (Hard rule 4)", () => {
  beforeEach(() => seed(MIXED));

  it("a soft-deleted book is in no row and no block", async () => {
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'z'`;
    const { doc } = await page();
    expect(doc.querySelector('[data-book="z"]')).toBeNull();
  });
});
