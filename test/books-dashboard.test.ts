// Task 2.2 (F-22, D-37, D-40, D-65, D-85): the books dashboard's five slots, read
// against the TEST database. The dashboard passes this year and the current quarter
// in (from the Eastern day), so these fix both: 2026 and 2026-Q4.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let planRoute: typeof import("../src/app/api/plan/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  planRoute = await import("../src/app/api/plan/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('a', 'Author A'), ('b', 'Author B'), ('c', 'Author C'), ('d', 'Author D'), ('e', 'Author E')`;
});

type Book = { id: string; author?: string; words?: number | null; pages?: number | null };

async function books(...list: Book[]) {
  for (const b of list) {
    await sql`INSERT INTO books (id, title, author_id, word_count, word_count_source, page_count)
      VALUES (${b.id}, ${"Title " + b.id}, ${b.author ?? null}, ${b.words ?? null},
              ${b.words == null ? null : "stated"}, ${b.pages ?? null})`;
  }
}

async function status(id: string, s: string, started: string | null = null) {
  await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
    VALUES (${USER}, ${id}, ${s}, ${started}, ${started ? "exact" : "none"})`;
}

async function plan(id: string, period: string, ordinal: number | null) {
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${USER}, ${id}, ${period}, ${ordinal})`;
}

/** A finished read in the log, with its status `read`. `on` null is an undated read. */
async function read(id: string, on: string | null, opts: { format?: "text" | "audio"; started?: string | null; precision?: "exact" | "approximate" } = {}) {
  const precision = on === null ? "none" : (opts.precision ?? "exact");
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
    VALUES (${USER}, ${id}, ${on}, ${precision}, ${opts.started ?? null}, ${opts.started ? "exact" : "none"}, ${opts.format ?? "text"})`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
    VALUES (${USER}, ${id}, 'read', ${on}, ${precision})
    ON CONFLICT (user_id, book_id) DO UPDATE SET status = 'read', finished_on = EXCLUDED.finished_on,
      finished_on_precision = EXCLUDED.finished_on_precision`;
}

describe("Now: the book in hand (AC-2)", () => {
  it("the hero is the most recently started of Reading and Listening; a Listening one says so", async () => {
    await books({ id: "r" }, { id: "l" });
    await status("r", "reading", "2026-10-01");
    await status("l", "listening", "2026-10-20");
    const hand = await q.booksInHand(USER);
    expect(hand.map((b) => [b.id, b.status])).toEqual([["l", "listening"], ["r", "reading"]]);
  });

  it("started the same day, Reading comes before Listening; an undated start is last", async () => {
    await books({ id: "l" }, { id: "r" }, { id: "u" });
    await status("l", "listening", "2026-10-20");
    await status("r", "reading", "2026-10-20");
    await status("u", "reading", null);
    expect((await q.booksInHand(USER)).map((b) => b.id)).toEqual(["r", "l", "u"]);
  });

  it("carries its words: the stated count, else pages at your words per page, else null", async () => {
    await books({ id: "s", words: 90_000, pages: 300 }, { id: "p", pages: 400 }, { id: "n" });
    await status("s", "reading", "2026-10-03");
    await status("p", "reading", "2026-10-02");
    await status("n", "reading", "2026-10-01");
    const hand = await q.booksInHand(USER);
    expect(hand.map((b) => [b.id, b.words])).toEqual([["s", 90_000], ["p", 400 * 275], ["n", null]]);
  });

  it("is empty with nothing in progress; To read, Read and DNF aren't in hand", async () => {
    await books({ id: "t" }, { id: "x" }, { id: "d" });
    await status("t", "to_read");
    await status("d", "dnf");
    await read("x", "2026-10-01");
    expect(await q.booksInHand(USER)).toEqual([]);
  });
});

describe("Up next in Qn and the offer (AC-2, AC-1)", () => {
  beforeEach(async () => {
    await books({ id: "q1", words: 92_000 }, { id: "q2", words: 30_000 }, { id: "q3", words: 144_000 });
    await status("q1", "to_read");
    await read("q2", "2026-10-05");
    await status("q3", "to_read");
    await plan("q1", "2026-Q4", 1);
    await plan("q2", "2026-Q4", 2);
    await plan("q3", "2026-Q4", 3);
  });

  it("ordinals 1, 2 (read) and 3: the shelf is 1 then 3", async () => {
    expect((await q.quarterShelf(USER, "2026-Q4")).map((b) => [b.id, b.ordinal])).toEqual([["q1", 1], ["q3", 3]]);
  });

  it("the offer is the lowest-ordinal book still to read, skipping a read one", async () => {
    await sql`UPDATE book_status SET status = 'read' WHERE book_id = 'q1'`;
    const shelf = await q.quarterShelf(USER, "2026-Q4");
    expect(shelf[0].id).toBe("q3");
  });

  it("another quarter's books, and a reading one, aren't on this quarter's shelf", async () => {
    await books({ id: "other" }, { id: "inhand" });
    await status("other", "to_read");
    await status("inhand", "reading", "2026-10-01");
    await plan("other", "2027-Q1", 1);
    await plan("inhand", "2026-Q4", 4);
    expect((await q.quarterShelf(USER, "2026-Q4")).map((b) => b.id)).toEqual(["q1", "q3"]);
  });
});

describe("This quarter: the strip's total is 2.1's figure (AC-1)", () => {
  it("its blocks are the quarter's counted books in order, and their words sum to planCapacity's", async () => {
    await books(
      { id: "q1", words: 92_000 }, { id: "q2", words: 30_000 }, { id: "q3", pages: 400 },
      { id: "q4" }, { id: "lis", words: 80_000 }, { id: "deck", words: 50_000 }, { id: "dnf", words: 70_000 },
    );
    await read("q1", "2026-10-02");
    await status("q2", "reading", "2026-10-10");
    await status("q3", "to_read");
    await status("q4", "to_read"); // no word count and no pages: a book, in no word total
    await read("lis", "2026-10-03", { format: "audio" }); // a listen runs beside the budget (D-112)
    await status("deck", "to_read");
    await status("dnf", "dnf");
    for (const [id, o] of [["q1", 1], ["q2", 2], ["q3", 3], ["q4", 4], ["lis", 5], ["dnf", 6]] as const) await plan(id, "2026-Q4", o);
    await plan("deck", "on_deck", null);

    const blocks = await q.quarterBlocks(USER, "2026-Q4");
    expect(blocks.map((b) => [b.id, b.words, b.status])).toEqual([
      ["q1", 92_000, "read"], ["q2", 30_000, "reading"], ["q3", 400 * 275, "to_read"],
    ]);
    // A stated count is not an estimate; a count from pages is (the strip dots its edge).
    expect(blocks.map((b) => [b.id, b.estimated])).toEqual([["q1", false], ["q2", false], ["q3", true]]);
    const { quarters } = await q.planCapacity(USER, 2026);
    expect(blocks.reduce((n, b) => n + b.words, 0)).toBe(quarters[3].plannedWords);
    expect(quarters[3].plannedWords).toBe(92_000 + 30_000 + 110_000);
  });
});

describe("On deck", () => {
  it("lists the To read books with no year, by title, up to the limit, with the whole count", async () => {
    await books({ id: "c" }, { id: "a" }, { id: "b" }, { id: "read" }, { id: "q" });
    for (const id of ["c", "a", "b", "q"]) await status(id, "to_read");
    await read("read", "2026-01-01");
    for (const id of ["c", "a", "b", "read"]) await plan(id, "on_deck", null);
    await plan("q", "2026-Q4", 1);
    const deck = await q.onDeck(USER, 2);
    expect(deck.rows.map((b) => b.id)).toEqual(["a", "b"]);
    expect(deck.total).toBe(3);
  });
});

describe("The book's place: universe, series and number (task 2.2j, D-134)", () => {
  // truncateAll leaves the universes (and series are cleared by the books' cascade).
  beforeEach(async () => {
    await sql`TRUNCATE book_universes CASCADE`;
    await sql`INSERT INTO book_universes (id, name) VALUES ('cosmere', 'Cosmere')`;
    await sql`INSERT INTO book_series (id, name, author_id) VALUES ('mistborn', 'Mistborn', 'a')`;
    await books({ id: "alloy", author: "a" }, { id: "plain", author: "b" }, { id: "series-only", author: "c" });
    await sql`UPDATE books SET series_id = 'mistborn', series_position = 4, universe_id = 'cosmere' WHERE id = 'alloy'`;
    await sql`UPDATE books SET series_id = 'mistborn', series_position = 1 WHERE id = 'series-only'`;
    for (const id of ["alloy", "plain", "series-only"]) await status(id, "to_read");
  });

  const place = (b: { universe: string | null; series: string | null; series_position: number | null }) =>
    [b.universe, b.series, b.series_position];

  it("onDeck returns each book's universe name, series and position; null where it has none", async () => {
    for (const id of ["alloy", "plain", "series-only"]) await plan(id, "on_deck", null);
    const rows = (await q.onDeck(USER, 10)).rows;
    expect(Object.fromEntries(rows.map((b) => [b.id, place(b)]))).toEqual({
      alloy: ["Cosmere", "Mistborn", 4],
      plain: [null, null, null],
      "series-only": [null, "Mistborn", 1],
    });
  });

  it("quarterShelf returns the same three fields for the quarter's books", async () => {
    await plan("alloy", "2026-Q4", 1);
    await plan("plain", "2026-Q4", 2);
    await plan("series-only", "2026-Q4", 3);
    const rows = await q.quarterShelf(USER, "2026-Q4");
    expect(rows.map((b) => [b.id, ...place(b)])).toEqual([
      ["alloy", "Cosmere", "Mistborn", 4],
      ["plain", null, null, null],
      ["series-only", null, "Mistborn", 1],
    ]);
  });

  it("one row per book: a universe join never doubles a row", async () => {
    await plan("alloy", "on_deck", null);
    await plan("plain", "on_deck", null);
    const deck = await q.onDeck(USER, 10);
    expect(deck.rows).toHaveLength(2);
    expect(deck.total).toBe(2);
  });
});

describe("Between books: the last finish (AC-1)", () => {
  it("is the latest dated read, with its start and the days it took", async () => {
    await books({ id: "old", pages: 100 }, { id: "new", pages: 245 }, { id: "undated" });
    await read("old", "2026-09-01");
    await read("new", "2026-11-01", { started: "2026-10-23" });
    await read("undated", null);
    const last = await q.lastFinish(USER);
    expect(last).toMatchObject({ id: "new", pages: 245, finished_on: "2026-11-01", finished_on_precision: "exact", days_taken: 9 });
  });

  it("with only undated reads, it is the latest of those, and says no date", async () => {
    await books({ id: "u1" }, { id: "u2" });
    await read("u1", null);
    await read("u2", null);
    expect(await q.lastFinish(USER)).toMatchObject({ id: "u2", finished_on: null, finished_on_precision: "none", days_taken: null });
  });

  it("a read status with no log row counts, as it does in book_reads", async () => {
    await books({ id: "legacy" });
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
      VALUES (${USER}, 'legacy', 'read', '2025-07-01', 'approximate')`;
    expect(await q.lastFinish(USER)).toMatchObject({ id: "legacy", finished_on: "2025-07-01", finished_on_precision: "approximate" });
  });

  it("is null with nothing ever finished; a DNF isn't a finish", async () => {
    await books({ id: "d" });
    await status("d", "dnf");
    expect(await q.lastFinish(USER)).toBeNull();
  });
});

describe("2026 so far: three counts, all this year (AC-3)", () => {
  it("3 text reads and 1 listen by 3 new authors: 4 books, 1 listened, pages summed, 3 new authors", async () => {
    await books(
      { id: "a1", author: "a", pages: 300 }, { id: "a2", author: "a", pages: 200 },
      { id: "b1", author: "b", pages: 150 }, { id: "c1", author: "c", pages: 400 },
      { id: "d1", author: "d", pages: 999 }, { id: "e1", author: "e", pages: 888 },
    );
    await read("a1", "2026-02-01");
    await read("a2", "2026-05-01");
    await read("b1", "2026-07-01", { precision: "approximate" });
    await read("c1", "2026-10-01", { format: "audio" });
    await read("d1", "2025-12-31"); // another year: counts nothing
    await read("e1", "2027-01-01"); // another year: counts nothing
    expect(await q.yearSoFar(USER, 2026)).toEqual({ books: 4, listened: 1, pages: 300 + 200 + 150 + 400, newAuthors: 3 });
  });

  it("an author read before this year, or with an undated read, isn't new; a reread counts again", async () => {
    await books({ id: "a0", author: "a" }, { id: "a1", author: "a", pages: 10 }, { id: "b0", author: "b" },
      { id: "b1", author: "b", pages: 20 }, { id: "c1", author: "c", pages: 30 });
    await read("a0", "2024-03-01");
    await read("a1", "2026-03-01");
    await read("b0", null);
    await read("b1", "2026-04-01");
    await read("c1", "2026-05-01");
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision) VALUES (${USER}, 'c1', '2026-09-01', 'exact')`;
    expect(await q.yearSoFar(USER, 2026)).toEqual({ books: 4, listened: 0, pages: 10 + 20 + 30 + 30, newAuthors: 1 });
  });

  it("a year with no reads is three zeros", async () => {
    expect(await q.yearSoFar(USER, 2026)).toEqual({ books: 0, listened: 0, pages: 0, newAuthors: 0 });
  });
});

describe("Plan on an On deck row: POST /api/plan (task 2.2, Q3)", () => {
  const post = (body: unknown) => planRoute.POST(new Request("http://test/api/plan", { method: "POST", body: JSON.stringify(body) }));
  const rows = () => sql`SELECT book_id, period, ordinal FROM reading_plan ORDER BY period, ordinal NULLS LAST, book_id`;

  beforeEach(async () => {
    await books({ id: "q1" }, { id: "q2" }, { id: "deck" });
    for (const id of ["q1", "q2", "deck"]) await status(id, "to_read");
    await plan("q1", "2026-Q4", 1);
    await plan("q2", "2026-Q4", 2);
    await plan("deck", "on_deck", null);
  });

  it("moves the book from On deck to the end of the quarter, and answers its place", async () => {
    const res = await post({ bookId: "deck", from: "on_deck", to: "2026-Q4" });
    expect(res.status).toBe(200);
    // Task 2.3: the answer carries the move, which is what its undo sends back.
    expect(await res.json()).toEqual({
      ok: true, move: { bookId: "deck", from: "on_deck", to: "2026-Q4", placed: true, prior: [{ period: "on_deck", ordinal: null }] },
    });
    expect(await rows()).toEqual([
      { book_id: "q1", period: "2026-Q4", ordinal: 1 }, { book_id: "q2", period: "2026-Q4", ordinal: 2 },
      { book_id: "deck", period: "2026-Q4", ordinal: 3 },
    ]);
  });

  it("its Undo is the move back, which leaves the plan as it was", async () => {
    const before = await rows();
    await post({ bookId: "deck", from: "on_deck", to: "2026-Q4" });
    expect((await post({ bookId: "deck", from: "2026-Q4", to: "on_deck" })).status).toBe(200);
    expect(await rows()).toEqual(before);
  });

  it("404 when the book isn't where it says; 400 for a missing book or a period that isn't one", async () => {
    expect((await post({ bookId: "q1", from: "on_deck", to: "2026-Q4" })).status).toBe(404);
    expect((await post({ from: "on_deck", to: "2026-Q4" })).status).toBe(400);
    expect((await post({ bookId: "deck", from: "on_deck", to: "Q4" })).status).toBe(400);
    expect((await post({ bookId: "deck", from: "on_deck", to: "on_deck" })).status).toBe(400);
    expect(await rows()).toContainEqual({ book_id: "deck", period: "on_deck", ordinal: null });
  });
});

describe("the dashboard's copy (§15: sentences, not tallies; never a date to finish by)", () => {
  let now: typeof import("../src/components/BooksNow");
  let between: typeof import("../src/components/BetweenBooks");
  beforeAll(async () => {
    now = await import("../src/components/BooksNow");
    between = await import("../src/components/BetweenBooks");
  });
  const book = (started_on: string | null, status: "reading" | "listening" = "reading") =>
    ({ title: "The Fifth Season", status, started_on, started_on_precision: started_on ? "exact" as const : "none" as const });

  it("the lede counts from the start: today, days, a week, weeks, months; with no start, what you're reading", () => {
    expect(now.nowLede(book("2026-11-08"), "2026-11-08")).toBe("Started The Fifth Season today.");
    expect(now.nowLede(book("2026-11-07"), "2026-11-08")).toBe("A day into The Fifth Season.");
    expect(now.nowLede(book("2026-11-05"), "2026-11-08")).toBe("Three days into The Fifth Season.");
    expect(now.nowLede(book("2026-10-30"), "2026-11-08")).toBe("A week into The Fifth Season.");
    expect(now.nowLede(book("2026-10-24"), "2026-11-08")).toBe("Two weeks into The Fifth Season.");
    expect(now.nowLede(book("2026-08-01"), "2026-11-08")).toBe("Three months into The Fifth Season.");
    expect(now.nowLede(book(null, "listening"), "2026-11-08")).toBe("Listening to The Fifth Season.");
  });

  it("evenings at your set pace are the book's words over a day's reading, rounded up; none with no words", () => {
    const pace = { minutesPerDay: 45, wordsPerMinute: 185 }; // 8,325 words an evening
    expect(now.evenings(146_000, pace)).toBe(18);
    expect(now.evenings(8_325, pace)).toBe(1);
    expect(now.evenings(8_326, pace)).toBe(2);
    expect(now.evenings(null, pace)).toBeNull();
  });

  const last = (over: Partial<import("../src/db/queries").LastFinish> = {}) => ({
    id: "p", title: "Piranesi", author: null, pages: 245, cover_url: null, finished_on: "2026-11-01",
    finished_on_precision: "exact" as const, days_taken: 9, listened: false, ...over,
  });
  const line = (l: ReturnType<typeof last>, today = "2026-11-08") => {
    const { lead, title, rest } = between.finishLine(l, today, new Date("2026-11-08T17:00:00Z"));
    return `${lead}${title}${rest}`;
  };

  it("the finished line says what, when and how long: the feel pass's sentence", () => {
    expect(line(last(), "2026-11-03")).toBe("You finished Piranesi on Sunday, 245 pages in nine days.");
    expect(line(last())).toBe("You finished Piranesi on 1 Nov, 245 pages in nine days.");
    expect(line(last({ finished_on: "2026-11-08" }))).toBe("You finished Piranesi today, 245 pages in nine days.");
    expect(line(last({ finished_on: "2025-07-01", finished_on_precision: "approximate", days_taken: null })))
      .toBe("You finished Piranesi in 2025, 245 pages.");
    expect(line(last({ listened: true, pages: null, days_taken: 1 }), "2026-11-02")).toBe("You listened to Piranesi yesterday, in a day.");
  });

  it("an undated finish says what, not when", () => {
    expect(line(last({ finished_on: null, finished_on_precision: "none", days_taken: null, pages: null }))).toBe("You finished Piranesi.");
    expect(between.finishBadge(last({ finished_on: null, finished_on_precision: "none" }), "2026-11-08")).toBe("✓ finished");
  });

  it("the badge names the day this past week, else the date", () => {
    expect(between.finishBadge(last(), "2026-11-03")).toBe("✓ finished · Sun");
    expect(between.finishBadge(last({ finished_on: "2026-11-08" }), "2026-11-08")).toBe("✓ finished · today");
    expect(between.finishBadge(last(), "2026-11-20", new Date("2026-11-20T17:00:00Z"))).toBe("✓ finished · 1 Nov");
  });
});

describe("the strip past capacity is amber, never red, and never says behind (AC-3, §12; task 2.2b AC-4)", () => {
  const cap = (planned: number, books = 3, read = 1) => ({
    period: "2026-Q4", year: 2026, quarter: 4, capacity: 760_000, plannedWords: planned, statedWords: planned,
    estimatedWords: 0, books, readBooks: read, unknownBooks: 0, load: planned / 760_000, estimatedShare: 0,
  });
  const blocks = [
    { id: "a", title: "A", words: 600_000, status: "read" as const, estimated: false, genre: null },
    { id: "b", title: "B", words: 212_000, status: "to_read" as const, estimated: true, genre: "Fantasy" },
  ];
  async function strip(planned: number, list = blocks) {
    const { default: QuarterStrip } = await import("../src/components/QuarterStrip");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { Window } = await import("happy-dom");
    const html = renderToStaticMarkup(createElement(QuarterStrip, { cap: cap(planned), blocks: list, inHand: null }));
    const window = new Window();
    window.document.body.innerHTML = html;
    return { html, doc: window.document };
  }
  const cssVar = (el: { getAttribute(name: string): string | null } | null, name: string) =>
    Number(new RegExp(name + String.raw`:\s*([-\d.]+)`).exec(el?.getAttribute("style") ?? "")?.[1]);

  it("812k against 760k: the figure takes the amber class with what it is over; nothing danger, nothing behind", async () => {
    const { html, doc } = await strip(812_000);
    expect(html).toMatch(/<span class="qfig over">812k planned<span class="bdg bl">52k over<\/span><\/span>/);
    expect(doc.querySelector(".planrail.strip")?.getAttribute("data-over")).toBe("true");
    // The rule moves in: the scale stretches to the plan, so 760k sits at 760/812 of the width.
    expect(cssVar(doc.querySelector(".caprule"), "--cap")).toBeCloseTo(760_000 / 812_000, 4);
    expect(html).not.toMatch(/danger|\bdg\b|behind/i);
    expect(await import("node:fs").then((fs) => fs.readFileSync("src/app/globals.css", "utf8")))
      .toMatch(/\.qfig\.over\{color:var\(--blocked\);/);
  });

  it("is the plan rail on its side: a button per book, the last block hatched exactly where it passes the rule", async () => {
    const { doc } = await strip(812_000);
    const buttons = [...doc.querySelectorAll(".planrail.strip button.qb")];
    expect(buttons.map((b) => b.getAttribute("data-book"))).toEqual(["a", "b"]);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["A, 600k words, Q4 2026", "B, 212k words, estimated, Q4 2026"]);
    // 600k ends before the rule; 212k runs 600k to 812k and the rule is at 760k, so 52k of it is over.
    expect(buttons[0].classList.contains("over")).toBe(false);
    expect(buttons[1].classList.contains("over")).toBe(true);
    expect(buttons[0].querySelector(".ov")).toBeNull();
    expect(buttons[1].querySelector(".ov")).not.toBeNull();
    expect(cssVar(buttons[1], "--ov")).toBeCloseTo(52_000 / 212_000, 4);
    expect(buttons[0].getAttribute("data-state")).toBe("read");
    expect(buttons[1].hasAttribute("data-wc")).toBe(true);
    // The hue rides in the markup, one markup for the strip and the rail (M-07).
    expect(buttons[1].getAttribute("style")).toMatch(/--hue:var\(--g[1-8]\)/);
  });

  it("at or under capacity the figure is plain: no amber, no over badge, no hatch, the rule at the right edge", async () => {
    const { html, doc } = await strip(615_000, [blocks[0], { ...blocks[1], words: 15_000 }]);
    expect(html).toContain('<span class="qfig">615k planned</span>');
    expect(html).not.toMatch(/bdg bl|data-over|class="ov"|qb over/);
    expect(cssVar(doc.querySelector(".caprule"), "--cap")).toBe(1);
  });
});

describe("a soft-deleted book is on no slot (Hard rule 4)", () => {
  it("in hand, finished, planned, On deck or read this year: once deleted, nothing counts it", async () => {
    await books({ id: "hand" }, { id: "fin", author: "a", pages: 100 }, { id: "q", words: 50_000 }, { id: "deck" });
    await status("hand", "reading", "2026-11-01");
    await read("fin", "2026-10-01");
    await status("q", "to_read");
    await status("deck", "to_read");
    await plan("q", "2026-Q4", 1);
    await plan("deck", "on_deck", null);
    await sql`UPDATE books SET deleted_at = now()`;
    expect(await q.booksInHand(USER)).toEqual([]);
    expect(await q.lastFinish(USER)).toBeNull();
    expect(await q.quarterShelf(USER, "2026-Q4")).toEqual([]);
    expect(await q.quarterBlocks(USER, "2026-Q4")).toEqual([]);
    expect(await q.onDeck(USER, 3)).toEqual({ rows: [], total: 0 });
    expect(await q.yearSoFar(USER, 2026)).toEqual({ books: 0, listened: 0, pages: 0, newAuthors: 0 });
  });
});

describe("Where the book sits (2.2g)", () => {
  type L = { kind: string; id: string; name: string; read: number; total: number };
  const levelsOf = async (id: string): Promise<L[]> =>
    (await q.booksInHand(USER)).find((b) => b.id === id)!.levels as L[];
  const kinds = async (id: string) => (await levelsOf(id)).map((l) => l.kind);
  // truncateAll leaves the universes and subseries (no other test here writes one).
  beforeEach(async () => { await sql`TRUNCATE book_universes, book_subseries CASCADE`; });

  /** The book in hand "h" (author `a`) in universe U, series S (stated 6) and subseries SS, with
   * a read sibling and an unread one in each. */
  async function world(opts: { universe?: boolean; series?: boolean; subseries?: boolean; author?: string | null } = {}) {
    const { universe = true, series = true, subseries = true, author = "a" } = opts;
    if (universe) await sql`INSERT INTO book_universes (id, name) VALUES ('u', 'Universe U')`;
    if (series) await sql`INSERT INTO book_series (id, name, total_books) VALUES ('s', 'Series S', 6)`;
    if (series && subseries) await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('ss', 'Subseries SS', 's')`;
    const put = async (id: string, readIt: boolean) => {
      await sql`INSERT INTO books (id, title, author_id, universe_id, series_id, subseries_id)
        VALUES (${id}, ${"Title " + id}, ${author}, ${universe ? "u" : null}, ${series ? "s" : null},
                ${series && subseries ? "ss" : null})`;
      if (readIt) await read(id, "2026-10-01");
    };
    await put("h", false);
    await put("r1", true);
    await put("t1", false);
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
      VALUES (${USER}, 'h', 'reading', '2026-11-01', 'exact')`;
  }
  const follow = async (kind: "universe" | "series" | "subseries" | "author", id: string, state: string) => {
    if (kind === "subseries") await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES (${id}, ${state})`;
    else await sql`INSERT INTO ${sql(kind + "_follows")} (user_id, ${sql(kind + "_id")}, state) VALUES (${USER}, ${id}, ${state})`;
  };

  it("a book in a universe, a series and a subseries has three rows, outermost first, each read / total its view's", async () => {
    await world();
    const levels = await levelsOf("h");
    expect(levels.map((l) => [l.kind, l.id, l.name])).toEqual([
      ["universe", "u", "Universe U"], ["series", "s", "Series S"], ["subseries", "ss", "Subseries SS"],
    ]);
    // The universe and subseries list 3 books (1 read); a series' total is its stated 6.
    expect(levels.map((l) => [l.read, l.total])).toEqual([[1, 3], [1, 6], [1, 3]]);
    const [uv] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM universe_progress WHERE user_id = ${USER} AND universe_id = 'u'`;
    const [sv] = await sql`SELECT books_read::int AS r, total_books::int AS t FROM series_progress WHERE user_id = ${USER} AND series_id = 's'`;
    const [bv] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM subseries_progress WHERE user_id = ${USER} AND subseries_id = 'ss'`;
    expect(levels.map((l) => [l.read, l.total])).toEqual([[uv.r, uv.t], [sv.r, sv.t], [bv.r, bv.t]]);
  });

  it("a book in a series alone has one row, its total the stated total_books", async () => {
    await world({ universe: false, subseries: false, author: null });
    expect(await levelsOf("h")).toEqual([{ kind: "series", id: "s", name: "Series S", read: 1, total: 6 }]);
  });

  it("a standalone by an author nobody follows has none, and so does one at tracking", async () => {
    await world({ universe: false, series: false });
    expect(await levelsOf("h")).toEqual([]);
    await follow("author", "a", "tracking");
    expect(await levelsOf("h")).toEqual([]);
  });

  it("a standalone by an author followed Reading has the author's row", async () => {
    await world({ universe: false, series: false });
    await follow("author", "a", "reading");
    expect(await levelsOf("h")).toEqual([{ kind: "author", id: "a", name: "Author A", read: 1, total: 3 }]);
  });

  it("a book in a universe by an author followed Reading has the universe's row and no author row", async () => {
    await world({ series: false });
    await follow("author", "a", "reading");
    expect(await kinds("h")).toEqual(["universe"]);
  });

  it("no universe, author Reading, a series and a subseries: author, series, subseries; at tracking two", async () => {
    await world({ universe: false });
    await follow("author", "a", "reading");
    expect(await kinds("h")).toEqual(["author", "series", "subseries"]);
    await sql`UPDATE author_follows SET state = 'tracking'`;
    expect(await kinds("h")).toEqual(["series", "subseries"]);
  });

  it("never more than three rows, whatever the book is in", async () => {
    await world();
    await follow("author", "a", "reading");
    expect((await levelsOf("h")).length).toBeLessThanOrEqual(3);
  });

  it("position is a fact, not a follow: unfollowed, tracking, off and reading draw the same rows and figures", async () => {
    await world();
    const base = await levelsOf("h");
    expect(base).toHaveLength(3);
    for (const state of ["tracking", "off", "reading"]) {
      await sql`DELETE FROM universe_follows`;
      await sql`DELETE FROM series_follows`;
      await sql`DELETE FROM subseries_follows`;
      await follow("universe", "u", state);
      await follow("series", "s", state);
      await follow("subseries", "ss", state);
      expect(await levelsOf("h")).toEqual(base);
    }
  });

  it("a Listening book draws the rows a Reading one does", async () => {
    await world();
    const reading = await levelsOf("h");
    await sql`UPDATE book_status SET status = 'listening' WHERE book_id = 'h'`;
    expect(await levelsOf("h")).toEqual(reading);
  });

  it("the figures are the Follow sheet's: bookGroupings reads the same counts for each kind", async () => {
    await world();
    await follow("author", "a", "reading");
    const { groupings } = (await q.bookGroupings(USER, "h"))!;
    for (const l of await levelsOf("h")) {
      const g = groupings.find((x) => x.kind === l.kind && x.id === l.id)!;
      expect([l.read, l.total]).toEqual([g.read, g.total]);
    }
  });

  it("a removed sibling leaves the counts; a book with no levels carries an empty list", async () => {
    await world();
    await sql`UPDATE books SET deleted_at = now() WHERE id = 't1'`;
    expect((await levelsOf("h")).map((l) => [l.kind, l.read, l.total])).toEqual([["universe", 1, 2], ["series", 1, 6], ["subseries", 1, 2]]);
    await sql`DELETE FROM book_status`;
    await sql`DELETE FROM read_events`;
    await sql`DELETE FROM books`;
    await sql`INSERT INTO books (id, title) VALUES ('lone', 'Lone')`;
    await status("lone", "reading", "2026-11-02");
    expect(await levelsOf("lone")).toEqual([]);
  });
});

describe("Where the book sits (2.2g): the rows' markup", () => {
  let where: typeof import("../src/components/WhereItSits");
  beforeAll(async () => { where = await import("../src/components/WhereItSits"); });
  const html = async (levels: { kind: string; id: string; name: string; read: number; total: number }[]) => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    return renderToStaticMarkup(createElement(where.default, { levels: levels as never }));
  };

  it("the fill is read over total, whole at most, and nothing for an empty total", () => {
    expect(where.fillShare(1, 4)).toBe(0.25);
    expect(where.fillShare(5, 4)).toBe(1);
    expect(where.fillShare(0, 0)).toBe(0);
    expect(where.fillShare(0, 3)).toBe(0);
  });

  it("no levels draw nothing", async () => {
    expect(await html([])).toBe("");
  });

  it("1 of 4 reads 1 / 4, the fill a quarter of the track; the meter says nothing to a screen reader", async () => {
    const out = await html([{ kind: "series", id: "s", name: "Series S", read: 1, total: 4 }]);
    expect(out).toContain("1 / 4");
    expect(out).toContain("width:25%");
    expect(out).toContain('class="now-where-name">Series S<');
    expect(out).toMatch(/<span class="emeter" aria-hidden="true">/);
    expect(out).toContain('aria-label="Where this book sits"');
    expect(out).not.toMatch(/danger|style="[^"]*#/);
  });
});
