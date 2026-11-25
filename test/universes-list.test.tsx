// Task 5.11b (TASK-162, F-20; D-42, D-43, D-90, D-118): the Universes list, on the TEST database and as markup.
//
// The read (AC-1, AC-2): every universe with a live book, `read / total` from `universe_progress` (a removed
// book is on no count), cut to *Started* (a book read, in hand or DNF, or a follow of Tracking or Reading) or
// *All*, in progress first, then not started, then complete; the counts that head the chips and the Series
// tab come from one aggregate over the same rows. The page (AC-2, AC-3, AC-4): each row's name links to
// /books/universes/<id> and says *N series · Reading|Tracking|On hold*; with no universes an empty slate
// names Calibre's `#superseries`; the *Series · Universes* row heads every state; loading and error.
// The browser's half is test/e2e/universes.spec.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import UniversesError from "../src/app/books/universes/error";
import Loading from "../src/app/books/universes/loading";
import UniversesList from "../src/components/UniversesList";
import type { SeriesShow, UniverseSummary } from "../src/db/queries";
import { middle } from "../src/lib/follow-offer";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const OTHER = "someone-else";

const sql = testSql();
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test'), (${OTHER}, 'Other')`;
});

type B = { id: string; status?: string | null; series?: string | null; deleted?: boolean };

/** A universe with its books; a book may sit in a series (`series`, created on first use). */
async function universe(id: string, name: string, books: B[]) {
  await sql`INSERT INTO book_universes (id, name) VALUES (${id}, ${name})`;
  for (const [n, b] of books.entries()) {
    if (b.series) await sql`INSERT INTO book_series (id, name) VALUES (${b.series}, ${`Series ${b.series}`}) ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO books (id, title, universe_id, universe_position, series_id, deleted_at)
              VALUES (${b.id}, ${`Title ${b.id}`}, ${id}, ${n + 1}, ${b.series ?? null}, ${b.deleted ? new Date() : null})`;
    if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, ${b.id}, ${b.status})`;
  }
}
const follow = (id: string, state: string, user = USER) =>
  sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${user}, ${id}, ${state})`;
const ids = async (show: SeriesShow, user = USER) => (await q.universesList(user, show)).map((u) => u.id);

// AC-1's three: one with a read book, one followed with none read, one with only To-read books.
async function three() {
  await universe("readu", "Read universe", [{ id: "r1", status: "read" }, { id: "r2" }]);
  await universe("tracku", "Tracked universe", [{ id: "t1" }, { id: "t2", status: "to_read" }]);
  await universe("todou", "To-read universe", [{ id: "d1", status: "to_read" }, { id: "d2" }]);
  await follow("tracku", "tracking");
}

describe("the Started cut (AC-1)", () => {
  it("lists the universe with a read book and the one followed with none read, not the one with only To-read books; All adds it", async () => {
    await three();
    expect((await ids("started")).sort()).toEqual(["readu", "tracku"]);
    expect((await ids("all")).sort()).toEqual(["readu", "todou", "tracku"]);
    expect(await q.universeCounts(USER)).toMatchObject({ started: 2, all: 3 });
  });

  it("`read / total` are universe_progress's, each row's, as numbers", async () => {
    await three();
    const view = await sql<{ universe_id: string; books_read: string; books_listed: string }[]>`
      SELECT universe_id, books_read::text, books_listed::text FROM universe_progress WHERE user_id = ${USER}`;
    const rows = await q.universesList(USER, "all");
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      const v = view.find((x) => x.universe_id === r.id)!;
      expect([r.read, r.total], r.id).toEqual([Number(v.books_read), Number(v.books_listed)]);
      expect(typeof r.read).toBe("number");
      expect(typeof r.total).toBe("number");
    }
    expect(rows.find((u) => u.id === "readu")).toMatchObject({ read: 1, total: 2 });
  });

  it("a book in hand (reading, listening) or a DNF starts a universe; Unlisted, Parked and no status do not", async () => {
    await universe("rdg", "Reading", [{ id: "a1", status: "reading" }]);
    await universe("lst", "Listening", [{ id: "b1", status: "listening" }]);
    await universe("dnf", "Did not finish", [{ id: "c1", status: "dnf" }]);
    await universe("unl", "Unlisted", [{ id: "u1", status: "unlisted" }]);
    await universe("prk", "Parked", [{ id: "p1" }]);
    await sql`INSERT INTO book_status (user_id, book_id, status, parked_on) VALUES (${USER}, 'p1', 'parked', '2026-11-01')`;
    await universe("non", "None", [{ id: "n1" }]);
    expect((await ids("started")).sort()).toEqual(["dnf", "lst", "rdg"]);
    expect(await q.universeCounts(USER)).toMatchObject({ started: 3, all: 6 });
  });

  it("a follow of Reading starts it; a stored off, and no follow, do not", async () => {
    await universe("fr", "Follow reading", [{ id: "x1" }]);
    await universe("fo", "Follow off", [{ id: "y1" }]);
    await universe("fn", "No follow", [{ id: "z1" }]);
    await follow("fr", "reading");
    await follow("fo", "off");
    expect(await ids("started")).toEqual(["fr"]);
  });

  it("counts only your own reads and follows, and a removed book starts nothing", async () => {
    await universe("mine", "Mine", [{ id: "m1" }]);
    await universe("gone", "Gone", [{ id: "g1", status: "read", deleted: true }, { id: "g2" }]);
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${OTHER}, 'm1', 'read')`;
    await follow("gone", "tracking", OTHER);
    expect(await ids("started")).toEqual([]);
    expect(await q.universeCounts(USER)).toMatchObject({ started: 0, all: 2 });
    expect((await ids("started", OTHER)).sort()).toEqual(["gone", "mine"]);
    expect((await q.universesList(USER, "all")).find((u) => u.id === "mine")).toMatchObject({ followState: null, read: 0 });
  });

  it("a universe with no live book is in neither count; the default is All", async () => {
    await universe("one", "One", [{ id: "o1" }]);
    await universe("ghost", "Ghost", [{ id: "h1", status: "read", deleted: true }]);
    await universe("empty", "Empty", []);
    expect((await q.universesList(USER)).map((u) => u.id)).toEqual(["one"]);
    expect(await q.universeCounts(USER)).toMatchObject({ started: 0, all: 1 });
  });
});

describe("the order, the follow and the series count", () => {
  it("lists in progress, then not started, then complete, each by name", async () => {
    await universe("a-done", "Alpha done", [{ id: "ad", status: "read" }]);
    await universe("b-none", "Beta none", [{ id: "bn1" }, { id: "bn2" }]);
    await universe("c-part", "Gamma part", [{ id: "cp1", status: "read" }, { id: "cp2" }]);
    await universe("d-part", "Delta part", [{ id: "dp1", status: "read" }, { id: "dp2" }]);
    await universe("e-none", "aardvark none", [{ id: "en" }]);
    await universe("f-done", "Zulu done", [{ id: "fd1", status: "read" }, { id: "fd2", status: "read" }]);
    expect(await ids("all")).toEqual(["d-part", "c-part", "e-none", "b-none", "a-done", "f-done"]);
  });

  it("carries the follow, a stored off reading NULL, and unread: live books neither read nor DNF", async () => {
    await universe("fol", "Fol", [{ id: "f1", status: "read" }, { id: "f2", status: "dnf" }, { id: "f3" }, { id: "f4", deleted: true }]);
    const row = async () => (await q.universesList(USER, "all")).find((u) => u.id === "fol")!;
    expect(await row()).toMatchObject({ followState: null, unread: 1, read: 1, total: 3 });
    await follow("fol", "reading");
    expect((await row()).followState).toBe("reading");
    await sql`UPDATE universe_follows SET state = 'off' WHERE universe_id = 'fol'`;
    expect((await row()).followState).toBeNull();
  });

  it("counts the distinct series its live books are in, a book in none and a removed book's series for nothing", async () => {
    await universe("multi", "Multi", [
      { id: "s1", series: "alpha" }, { id: "s2", series: "alpha" }, { id: "s3", series: "beta" }, { id: "s4" },
      { id: "s5", series: "gone", deleted: true },
    ]);
    await universe("solo", "Solo", [{ id: "n1" }]);
    const rows = await q.universesList(USER, "all");
    expect(rows.find((u) => u.id === "multi")!.series).toBe(2);
    expect(rows.find((u) => u.id === "solo")!.series).toBe(0);
  });

  it("the Series tab's count is the series with a live book; seriesCounts names the universes", async () => {
    await universe("u1", "U1", [{ id: "a", series: "s-one" }, { id: "b", series: "s-two" }]);
    await universe("u2", "U2", [{ id: "c" }]);
    await sql`INSERT INTO book_series (id, name) VALUES ('s-ghost', 'Ghost')`;
    expect((await q.universeCounts(USER)).series).toBe(2);
    expect(await q.seriesCounts(USER)).toEqual({ started: 0, all: 2, universes: 2 });
  });

  it("is zero everywhere with nothing: one row of zeroes, never none", async () => {
    expect(await q.universeCounts(USER)).toEqual({ started: 0, all: 0, series: 0 });
    expect(await q.universesList(USER, "all")).toEqual([]);
  });

  it("writes nothing (hard rule 2: the query-budget harness holds the two queries in one wave)", async () => {
    await three();
    const count = () => sql`SELECT (SELECT count(*) FROM book_status) AS s, (SELECT count(*) FROM books) AS b,
                                   (SELECT count(*) FROM universe_follows) AS f, (SELECT count(*) FROM book_universes) AS u`;
    const before = await count();
    await q.universesList(USER, "all");
    await q.universeCounts(USER);
    expect(await count()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------------------------------------
// The markup (AC-2, AC-3, AC-4)

const row = (over: Partial<UniverseSummary> = {}): UniverseSummary => ({
  id: "cosmere", name: "The Cosmere", read: 9, total: 31, followState: "reading", unread: 22, series: 3, ...over,
});
const render = (
  universes: UniverseSummary[], show: SeriesShow = "all",
  counts = { started: universes.length, all: universes.length }, seriesCount = 6,
) => renderToStaticMarkup(createElement(UniversesList, { universes, show, counts, seriesCount }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const links = (html: string) => [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)].map((m) => ({
  href: /href="([^"]*)"/.exec(m[1])![1], text: text(m[2]), current: /aria-current="(page|true)"/.exec(m[1])?.[1] ?? null,
}));

describe("a row (AC-1, AC-2)", () => {
  it("reads read / total, links its name to the universe's page and ends in a chevron, with a meter filled by the share read", () => {
    const html = render([row()]);
    expect(html).toMatch(/<a class="row-link rt" href="\/books\/universes\/cosmere">The Cosmere<\/a>/);
    expect(html).toContain('<span class="rm mono">9 / 31</span>');
    expect(html).toContain('<span class="chev" aria-hidden="true">');
    expect(html).toMatch(/<span class="meter" aria-hidden="true"><i style="width:29(\.\d+)?%"/);
  });

  it("encodes an id the way the universe's page is addressed", () => {
    expect(links(render([row({ id: "a b/c", name: "Odd" })])).find((l) => l.text === "Odd")!.href).toBe("/books/universes/a%20b%2Fc");
  });

  it("says N series and how it is followed: Reading, Tracking, and On hold once part-read (D-118)", () => {
    const line = (o: Partial<UniverseSummary>) => /<div class="rs">(.*?)<\/div>/.exec(render([row(o)]))?.[1];
    expect(line({ followState: "reading" })).toBe("3 series · Reading");
    // Followed Tracking with nothing read: Tracking. Part-read (a book read, one left): On hold, as its page says.
    expect(line({ followState: "tracking", read: 0, unread: 31, total: 31 })).toBe("3 series · Tracking");
    expect(line({ followState: "tracking", read: 9, unread: 22 })).toBe("3 series · On hold");
    // Tracking and everything read is Tracking again: nothing is left to hold.
    expect(line({ followState: "tracking", read: 31, unread: 0, total: 31 })).toBe("3 series · Tracking");
  });

  it("no follow draws the series count alone; one series reads '1 series'; none draws the follow word alone, or no line", () => {
    const line = (o: Partial<UniverseSummary>) => /<div class="rs">(.*?)<\/div>/.exec(render([row(o)]))?.[1];
    expect(line({ followState: null })).toBe("3 series");
    expect(line({ followState: null, series: 1 })).toBe("1 series");
    expect(line({ followState: "reading", series: 0 })).toBe("Reading");
    expect(line({ followState: null, series: 0 })).toBeUndefined();
  });

  it("shares `middle` with the follow control, a server-safe module", () => {
    expect(middle({ read: 1, unread: 1 })).toBe("On hold");
    expect(middle({ read: 0, unread: 5 })).toBe("Tracking");
    expect(middle({ read: 5, unread: 0 })).toBe("Tracking");
  });

  it("the meter is full for a complete universe and empty for none read", () => {
    expect(render([row({ read: 4, total: 4 })])).toMatch(/<i style="width:100%"/);
    expect(render([row({ read: 0, total: 4 })])).toMatch(/<i style="width:0%"/);
  });
});

describe("the tab row and the chips (AC-1, AC-4)", () => {
  const tabLinks = (html: string) => links(/<nav class="tabs list-tabs"[^>]*>(.*?)<\/nav>/.exec(html)![1]);

  it("Series · Universes: two links with their counts, aria-current=page on Universes, the underline on the second", () => {
    const html = render([row()], "started", { started: 4, all: 5 }, 7);
    expect(tabLinks(html)).toEqual([
      { href: "/books/series", text: "Series 7", current: null },
      { href: "/books/universes", text: "Universes 5", current: "page" },
    ]);
    expect(html).toContain('aria-label="Series and universes"');
    expect(html).toContain("--i:1;--n:2");
    expect(html).not.toContain('role="tab"');
  });

  it("Started and All are real links with their counts, aria-current on the open one", () => {
    const chips = (html: string) => links(html).filter((l) => l.href.startsWith("/books/universes") && /^(Started|All) \d/.test(l.text));
    expect(chips(render([row()], "started", { started: 4, all: 5 }))).toEqual([
      { href: "/books/universes", text: "Started 4", current: "true" },
      { href: "/books/universes?show=all", text: "All 5", current: null },
    ]);
    expect(chips(render([row()], "all", { started: 4, all: 5 })).map((c) => c.current)).toEqual([null, "true"]);
    expect(render([row()], "all", { started: 1, all: 1 })).toContain('aria-label="All, 1 universe"');
    expect(render([row()], "all", { started: 4, all: 5 })).toContain('aria-label="Started, 4 universes"');
  });

  it("has a list named for its cut", () => {
    expect(render([row()], "started")).toContain('aria-label="Started universes"');
    expect(render([row()], "all")).toContain('aria-label="All universes"');
  });
});

describe("no universes (AC-3)", () => {
  it("is one slate saying where universes come from, Calibre's #superseries, with one action to the Calibre page; no chips, no list", () => {
    const html = render([], "started", { started: 0, all: 0 });
    expect(text(html)).toContain("No universes yet");
    expect(text(html)).toContain("superseries in Calibre (#superseries)");
    const slate = /<div class="slate">(.*?)<\/div>/.exec(html)![1];
    expect(links(slate)).toEqual([{ href: "/settings/calibre", text: "Calibre sync", current: null }]);
    expect(html).not.toContain("series-chips");
    expect(html).not.toContain("series-rows");
    expect(html).not.toContain("Nothing started yet");
    // The tab row still heads it, with both counts: the way back to Series.
    expect(html).toContain('<nav class="tabs list-tabs"');
    expect(html).toContain("<h1");
  });
});

describe("nothing started", () => {
  it("draws the chips and a slate whose one action names All and its count", () => {
    const html = render([], "started", { started: 0, all: 3 });
    expect(text(html)).toContain("Nothing started yet");
    expect(text(html)).toContain("A universe shows here once you read or start a book in it, or follow it.");
    const slate = /<div class="slate">(.*?)<\/div>/.exec(html)![1];
    expect(links(slate)).toEqual([{ href: "/books/universes?show=all", text: "All 3 universes", current: null }]);
    expect(html).toContain("series-chips");
    expect(html).not.toContain("No universes yet");
    expect(html).not.toContain("series-rows");
  });
});

describe("the loading and error states", () => {
  it("the skeleton draws the title, the tab row's bar, the chips and four rows, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("sk-tabs");
    expect(html).toContain("filters genre-row series-chips");
    expect(html.match(/sk-chip/g)).toHaveLength(2);
    expect(html.match(/class="row series-row"/g)).toHaveLength(4);
    expect(html.match(/<span class="chev">/g)).toHaveLength(4);
  });

  it("the error is a grey × line and a real Try again that calls reset, nothing red", () => {
    const reset = vi.fn();
    const tree = UniversesError({ error: new Error("boom"), reset });
    const html = renderToStaticMarkup(tree);
    expect(text(html)).toContain("Couldn't load your universes. Nothing was changed.");
    expect(html).toMatch(/<p class="plan-error" role="alert"><span aria-hidden="true">×<\/span>/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
    expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);
    const press = (node: unknown): boolean => {
      if (!node || typeof node !== "object") return false;
      const el = node as { type?: unknown; props?: { onClick?: () => void; children?: unknown } };
      if (el.type === "button" && el.props?.onClick) { el.props.onClick(); return true; }
      const kids = el.props?.children;
      return (Array.isArray(kids) ? kids : [kids]).some(press);
    };
    expect(press(tree)).toBe(true);
    expect(reset).toHaveBeenCalledOnce();
  });
});
