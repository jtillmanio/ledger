// Task 4.4 part 3 (F-12 / D-133): the *Calibre* page and the books dashboard's stale-sync line,
// against the TEST database. The page lists every sync run newest first with its Eastern date and
// time and its counts in, out and waiting; a run's details show each change by book; a run that
// changed nothing says so; *Not in Calibre* lists a live book with no `calibre_id`. The dashboard
// line is *Calibre last synced N days ago* only past seven Eastern days, never before a run, and
// never red. Settings links to the page.
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import type { SyncReport } from "../src/db/calibre-sync";
import { UndoProvider } from "../src/components/Undo";
import { byBook, changedNothing, lastSyncedRow, ranWhen, syncLine } from "../src/lib/calibre-log";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
  requireUserId: async () => USER,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/calibre",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

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

const empty = (over: Partial<SyncReport> = {}): SyncReport => ({
  in: [], out: [], waiting: [], gone: [], skipped: [], skippedColumns: [], notes: [], ...over,
});

const NOTHING = empty();
const CHANGED = empty({
  in: [{
    kind: "updated", calibreId: 1, bookId: "b1", title: "The Fifth Season",
    changes: [{ field: "title", from: "Fifth Season", to: "The Fifth Season" }, { field: "word count", from: 100000, to: 112000 }],
  }],
  out: [{ calibreId: 1, bookId: "b1", title: "The Fifth Season", column: "#date_read", from: "2026-03-01", to: "2026-03-17" }],
  waiting: [{ kind: "near spelling", calibreId: 5, title: "Piranesi!", author: "Susanna Clarke", bookId: "b5", bookTitle: "Piranesi" }],
});
const FRESH = empty({
  in: [{ kind: "created", calibreId: 2, bookId: "b2", title: "Gideon the Ninth", changes: [{ field: "status", from: null, to: "unlisted" }] }],
  gone: [{ bookId: "b3", title: "A Vanished Book", calibreId: 9 }],
  skippedColumns: ["#date_read"],
  skipped: [{ reason: "comic", calibreId: 40, title: "Saga #1" }],
});

async function run(at: string, report: SyncReport) {
  await sql`INSERT INTO calibre_syncs (ran_at, report) VALUES (${at}, ${sql.json(report as never)})`;
}

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO authors (id, name) VALUES ('n', 'N. K. Jemisin'), ('t', 'Tamsyn Muir')`;
  await sql`INSERT INTO books (id, title, author_id, calibre_id) VALUES
    ('b1', 'The Fifth Season', 'n', 1), ('b2', 'Gideon the Ninth', 't', 2), ('b3', 'A Vanished Book', 'n', 3)`;
  await sql`INSERT INTO books (id, title, author_id) VALUES ('loose', 'Loose Book', 'n'), ('gone', 'Deleted Loose Book', 'n')`;
  await sql`UPDATE books SET deleted_at = now() WHERE id = 'gone'`;
});

/** Three runs: nothing changed, a changed run, a fresh one. Eastern: 2 Nov 9:00 AM, 9 Nov 10:42 AM, 14 Nov 6:30 PM. */
async function threeRuns() {
  await run("2026-11-02T14:00:00Z", NOTHING);
  await run("2026-11-09T15:42:00Z", CHANGED);
  await run("2026-11-14T23:30:00Z", FRESH);
}

describe("the log's queries (AC-2, AC-4)", () => {
  it("lists runs newest first with counts taken from the report, never stored", async () => {
    await threeRuns();
    const runs = await q.calibreRuns();
    expect(runs.map((r) => [r.id, r.in, r.out, r.waiting])).toEqual([[3, 1, 0, 0], [2, 1, 1, 1], [1, 0, 0, 0]]);
    expect(runs[0].ranAt).toBe("2026-11-14T23:30:00.000Z");
  });

  it("reads the newest runs' reports in one query, newest first, and no more than asked", async () => {
    await threeRuns();
    const two = await q.calibreReports(2);
    expect(two.map((r) => r.id)).toEqual([3, 2]);
    expect(two[1].report.out[0].column).toBe("#date_read");
    expect((await q.calibreReports(10)).map((r) => r.id)).toEqual([3, 2, 1]);
    expect(await q.calibreReports(0)).toEqual([]);
  });

  it("counts a run whose report lacks a list, or holds one as something else, as 0 — never an error", async () => {
    await run("2026-11-01T14:00:00Z", { in: [], out: [] } as never); // no waiting key
    await run("2026-11-02T14:00:00Z", {} as never);
    await run("2026-11-03T14:00:00Z", { in: null, out: "x", waiting: {} } as never);
    expect((await q.calibreRuns()).map((r) => [r.in, r.out, r.waiting])).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect((await q.createdBookAuthors(10)).size).toBe(0);
  });

  it("orders by when a run ran, not by when its row was written: a later-inserted older run is last", async () => {
    await run("2026-11-14T23:30:00Z", FRESH); // id 1, the newest moment
    await run("2026-11-02T14:00:00Z", NOTHING); // id 2, an older moment written later
    await run("2026-11-09T15:42:00Z", CHANGED); // id 3
    expect((await q.calibreRuns()).map((r) => r.id)).toEqual([1, 3, 2]);
    expect((await q.calibreReports(2)).map((r) => r.id)).toEqual([1, 3]);
    expect(await q.lastCalibreSync()).toBe("2026-11-14T23:30:00.000Z");
  });

  it("the last sync is the latest run's moment, or null before any", async () => {
    expect(await q.lastCalibreSync()).toBeNull();
    await threeRuns();
    expect(await q.lastCalibreSync()).toBe("2026-11-14T23:30:00.000Z");
  });

  it("Not in Calibre is every live book with no calibre_id: the soft-deleted one is not listed", async () => {
    expect(await q.notInCalibre()).toEqual([{ id: "loose", title: "Loose Book", author: "N. K. Jemisin" }]);
  });

  it("names the author, as it stands now, of a book one of the newest runs created", async () => {
    await threeRuns();
    expect([...(await q.createdBookAuthors(10)).entries()]).toEqual([["b2", "Tamsyn Muir"]]);
    // A book soft-deleted since has none.
    await sql`UPDATE books SET deleted_at = now() WHERE id = 'b2'`;
    expect((await q.createdBookAuthors(10)).size).toBe(0);
  });

  it("looks only at the newest runs it is asked for", async () => {
    // An older run created b1; three newer runs came after it.
    await run("2026-10-01T14:00:00Z", empty({ in: [{ kind: "created", calibreId: 1, bookId: "b1", title: "The Fifth Season", changes: [] }] }));
    await threeRuns();
    expect([...(await q.createdBookAuthors(3)).keys()]).toEqual(["b2"]);
    expect([...(await q.createdBookAuthors(4)).keys()].sort()).toEqual(["b1", "b2"]);
  });
});

describe("the stale-sync line (AC-3)", () => {
  // Eastern November 2026 is EST (UTC-5): 3 a.m. UTC is 10 p.m. the evening before.
  const now = new Date("2026-11-15T17:00:00Z"); // Sun 15 Nov, noon Eastern

  it("says N days ago at 8, and nothing at 7 or 6, and nothing before any run", () => {
    expect(syncLine("2026-11-07T17:00:00Z", now)).toBe("Calibre last synced 8 days ago");
    expect(syncLine("2026-11-08T17:00:00Z", now)).toBeNull(); // 7 days
    expect(syncLine("2026-11-09T17:00:00Z", now)).toBeNull(); // 6 days
    expect(syncLine(null, now)).toBeNull();
    expect(syncLine("2026-11-01T17:00:00Z", now)).toBe("Calibre last synced 14 days ago");
  });

  it("counts Eastern days, not UTC days: a run at 10 p.m. Eastern is already tomorrow in UTC", () => {
    // 2026-11-08T03:00Z is 7 Nov 10 p.m. Eastern: 8 Eastern days before the 15th, though 7 by its UTC date.
    expect(syncLine("2026-11-08T03:00:00Z", now)).toBe("Calibre last synced 8 days ago");
    // And the same moment, a day later, is 7 days Eastern and says nothing.
    expect(syncLine("2026-11-08T03:00:00Z", new Date("2026-11-14T17:00:00Z"))).toBeNull();
  });

  it("the rendered line links to the Calibre page and is not red", async () => {
    const Line = (await import("../src/components/CalibreSyncLine")).default;
    const html = renderToStaticMarkup(<Line ranAt="2026-11-07T17:00:00Z" now={now} />);
    expect(html).toMatch(/<a [^>]*href="\/settings\/calibre"[^>]*>Calibre last synced 8 days ago<\/a>/);
    expect(html).not.toMatch(/danger|red|#[0-9a-f]{3,6}/i);
    expect(renderToStaticMarkup(<Line ranAt="2026-11-09T17:00:00Z" now={now} />)).toBe("");
    expect(renderToStaticMarkup(<Line ranAt={null} now={now} />)).toBe("");
  });
});

describe("a run's words", () => {
  it("says the moment in Eastern: 9 Nov 10:42 AM, and 6:30 PM for 23:30Z", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(ranWhen("2026-11-09T15:42:00Z", now)).toBe("9 Nov · 10:42 AM");
    expect(ranWhen("2026-11-14T23:30:00Z", now)).toBe("14 Nov · 6:30 PM");
    expect(ranWhen("2025-12-31T02:00:00Z", now)).toBe("30 Dec 2025 · 9:00 PM");
    expect(lastSyncedRow(null, now)).toBe("Not synced yet");
    expect(lastSyncedRow("2026-11-14T23:30:00Z", now)).toBe("Last synced 14 Nov");
  });

  it("groups what came in and what went out under the book, in title order", () => {
    const entries = byBook(CHANGED, new Date("2026-11-16T12:00:00Z"));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: "The Fifth Season", created: false });
    expect(entries[0].came).toEqual([
      { label: "title", from: "Fifth Season", to: "The Fifth Season" },
      { label: "word count", from: "100000", to: "112000" },
    ]);
    expect(entries[0].went).toEqual([{ label: "Date read", from: "1 Mar", to: "17 Mar" }]);
    // A created book's lines have no was.
    expect(byBook(FRESH)[0]).toMatchObject({ title: "Gideon the Ninth", created: true, came: [{ label: "status", from: null, to: "unlisted" }] });
  });

  it("a run changed nothing when nothing came in, went out, waits or is gone: skips are standing facts", () => {
    expect(changedNothing(NOTHING)).toBe(true);
    expect(changedNothing(empty({ skipped: [{ reason: "comic", calibreId: 1, title: "X" }], skippedColumns: ["#read"], notes: ["n"] }))).toBe(true);
    expect(changedNothing(CHANGED)).toBe(false);
    expect(changedNothing(FRESH)).toBe(false);
  });
});

describe("the Calibre page (AC-1 browser clauses, AC-2, AC-4)", () => {
  const render = async () => {
    const Page = (await import("../src/app/settings/calibre/page")).default;
    return renderToStaticMarkup(<UndoProvider>{await Page()}</UndoProvider>);
  };

  it("lists three runs newest first, each with its Eastern moment and its counts", async () => {
    await threeRuns();
    const html = await render();
    const at = [/14 Nov( 2026)? · 6:30 PM/, /9 Nov( 2026)? · 10:42 AM/, /2 Nov( 2026)? · 9:00 AM/].map((re) => html.search(re));
    expect(at.every((n) => n >= 0), String(at)).toBe(true);
    expect(at[0]).toBeLessThan(at[1]);
    expect(at[1]).toBeLessThan(at[2]);
    expect(html).toContain("1 in · 0 out · 0 waiting");
    expect(html).toContain("1 in · 1 out · 1 waiting");
    expect(html).toContain("0 in · 0 out · 0 waiting");
    expect(html.match(/<h1/g)).toHaveLength(1);
  });

  it("opens the newest run only, and shows each change by book", async () => {
    await threeRuns();
    const html = await render();
    expect(html.match(/<details[^>]*\sopen/g)).toHaveLength(1);
    // The changed run's details: the rename, the word count, what went back to Calibre, and what waits.
    expect(html).toContain("The Fifth Season");
    expect(html).toMatch(/Fifth Season[\s\S]*?The Fifth Season/);
    expect(html).toContain("112000");
    expect(html).toContain("Date read");
    expect(html).toContain("17 Mar");
    expect(html).toContain("Piranesi!");
    expect(html).toContain("Susanna Clarke");
    // The newest run: a new book, with the author it has now; one gone from Calibre; the skipped column's label.
    expect(html).toContain("Gideon the Ninth");
    expect(html).toContain("Tamsyn Muir");
    expect(html).toContain("A Vanished Book");
    expect(html).toContain("missing, or held until the books cutover");
  });

  it("a run that changed nothing reads that it did (once: the other two changed)", async () => {
    await threeRuns();
    expect((await render()).match(/Nothing changed\./g)).toHaveLength(1);
  });

  it("lists a live book with no calibre_id under Not in Calibre, and not a Calibre book or a deleted one", async () => {
    await threeRuns();
    const html = await render();
    const section = html.slice(html.indexOf("Not in Calibre"));
    expect(section).toContain("Loose Book");
    expect(section).toContain("N. K. Jemisin");
    expect(section).not.toContain("Deleted Loose Book");
    expect(section).not.toContain("Gideon the Ninth");
    expect(section).toMatch(/Not in Calibre[^<]*<[^>]*>[^<]*1/);
  });

  it("a report with a missing, null or non-array list still renders: the page and byBook read it as empty", async () => {
    await run("2026-11-01T14:00:00Z", { in: [], out: [] } as never);
    await run("2026-11-02T14:00:00Z", {} as never);
    await run("2026-11-03T14:00:00Z", { in: null, out: "x", waiting: {}, gone: 7, skipped: null, skippedColumns: "y", notes: {} } as never);
    const html = await render();
    expect(html.match(/Nothing changed\./g)).toHaveLength(3);
    expect(html.match(/0 in · 0 out · 0 waiting/g)).toHaveLength(3);
    expect(byBook({} as never)).toEqual([]);
    expect(byBook({ in: null, out: "x" } as never)).toEqual([]);
    expect(byBook({ in: ["x", 3, null], out: [{ calibreId: 1, bookId: "b", title: "T", column: "#read", from: false, to: true }] } as never))
      .toEqual([expect.objectContaining({ title: "T", went: [{ label: "Read", from: "no", to: "yes" }] })]);
    expect(changedNothing({} as never)).toBe(true);
  });

  it("before any run: the empty state, one line, no button and no run list", async () => {
    const html = await render();
    expect(html).toContain("No sync yet");
    expect(html).toContain("npm run calibre:sync");
    expect(html).not.toContain("Nothing changed.");
    expect(html).not.toMatch(/<button/);
    expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);
  });
});

describe("Settings (AC-4)", () => {
  const render = async () => {
    const Page = (await import("../src/app/settings/page")).default;
    return renderToStaticMarkup(<UndoProvider>{await Page()}</UndoProvider>);
  };

  it("links to the Calibre page, saying when it last synced, or that it hasn't", async () => {
    const before = await render();
    expect(before).toMatch(/<a [^>]*href="\/settings\/calibre"[^>]*>[\s\S]*Calibre[\s\S]*Not synced yet/);
    await threeRuns();
    expect(await render()).toMatch(/<a [^>]*href="\/settings\/calibre"[^>]*>[\s\S]*Calibre[\s\S]*Last synced 14 Nov/);
  });
});

describe("the error state (AC-5)", () => {
  it("Try again is a real button that calls reset, and the line has a grey × and no red", async () => {
    const CalibreError = (await import("../src/app/settings/calibre/error")).default;
    const reset = vi.fn();
    const tree = CalibreError({ error: new Error("boom"), reset });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("Couldn’t read the sync log.");
    expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
    expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);
    // Find the button in the element tree and press it.
    const press = (node: unknown): boolean => {
      if (!node || typeof node !== "object") return false;
      const el = node as { type?: unknown; props?: { onClick?: () => void; children?: unknown } };
      if (el.type === "button" && el.props?.onClick) { el.props.onClick(); return true; }
      const kids = el.props?.children;
      return (Array.isArray(kids) ? kids : [kids]).some(press);
    };
    expect(press(tree)).toBe(true);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
