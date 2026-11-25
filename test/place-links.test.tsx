// @vitest-environment node
// Task 5.9b, 2 of 3 (TASK-141; F-38, D-134): the status rows (In flight, Done), Listen next, Top books, Coming
// out and Parked draw a book's place line through `BookPlace`, read against the TEST database and rendered
// with the pages themselves, then parsed back with happy-dom. A book in a series, by an author, in a universe
// links all three names (the series link named by the series alone, `#n` after it); a standalone book draws
// no series or universe link. The browser's half (a press on a link, drag, axe, the widths) is
// test/e2e/{status,top-books,parked,releases,follows}.spec.ts.
import { Window } from "happy-dom";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql, truncateAll } from "./db";

const USER = "test-user";
const TODAY = "2026-11-17";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => USER }));
vi.mock("@/lib/finish-date", async (orig) => ({ ...(await orig<typeof import("../src/lib/finish-date")>()), today: () => TODAY }));

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

/** Per surface: a book in a series, by an author, in a universe (`s…`), and a standalone with an author only (`o…`). */
const SURFACES = ["flight", "done", "listen", "top", "release", "parked"] as const;

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Reader')`;
  await sql`INSERT INTO authors (id, name) VALUES ('au', 'Ursula Fixture')`;
  await sql`INSERT INTO book_universes (id, name) VALUES ('un', 'Fixture World')`;
  await sql`INSERT INTO book_series (id, name, author_id) VALUES ('se', 'The Fixture Cycle', 'au')`;
  for (const s of SURFACES) {
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position, universe_id)
              VALUES (${`s-${s}`}, ${`Serial ${s}`}, 'au', 'se', 2, 'un')`;
    await sql`INSERT INTO books (id, title, author_id) VALUES (${`o-${s}`}, ${`Lone ${s}`}, 'au')`;
  }
  const status = (s: string, st: string) => sql`
    INSERT INTO book_status (user_id, book_id, status) SELECT ${USER}, id, ${st} FROM unnest(${[`s-${s}`, `o-${s}`]}::text[]) id`;
  await status("flight", "reading");
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            SELECT ${USER}, id, 'read', '2026-03-02', 'exact' FROM unnest(${["s-done", "o-done"]}::text[]) id`;
  await status("listen", "to_read");
  await sql`INSERT INTO listen_queue (book_id, position) VALUES ('s-listen', 1), ('o-listen', 2)`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            SELECT ${USER}, id, 'read', '2026-03-02', 'exact' FROM unnest(${["s-top", "o-top"]}::text[]) id`;
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank)
            VALUES (${USER}, 's-top', '2026-03-02', 'exact', 1), (${USER}, 'o-top', '2026-04-02', 'exact', NULL)`;
  await sql`INSERT INTO releases (book_id, release_date) VALUES ('s-release', '2026-12-01'), ('o-release', '2026-12-02')`;
  await sql`INSERT INTO book_status (user_id, book_id, status, parked_on)
            SELECT ${USER}, id, 'parked', '2026-06-01' FROM unnest(${["s-parked", "o-parked"]}::text[]) id`;
});

async function doc(html: string) {
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document;
}

async function render(Page: (p: never) => Promise<unknown>, props: unknown) {
  const { UndoProvider } = await import("../src/components/Undo");
  return doc(renderToStaticMarkup(createElement(UndoProvider, null, (await Page(props as never)) as never)));
}

type Doc = Awaited<ReturnType<typeof doc>>;

/** A book's place links, as `[name, href]`, read from its row: the one holding its title. */
function placeLinks(d: Doc, rowSelector: string, title: string) {
  const row = [...d.querySelectorAll(rowSelector)].find((r) => r.textContent?.includes(title));
  expect(row, `a row for ${title}`).toBeTruthy();
  const line = row!.querySelector(".row-sub, .qplace")!;
  return { text: line.textContent, links: [...line.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]) };
}

const SERIAL = {
  text: "Ursula Fixture · Fixture World · The Fixture Cycle #2",
  links: [["Ursula Fixture", "/books/authors/au"], ["Fixture World", "/books/universes/un"], ["The Fixture Cycle", "/books/series/se"]],
};
const LONE = { text: "Ursula Fixture", links: [["Ursula Fixture", "/books/authors/au"]] };

describe("a book's place line on the status rows, lists and Coming out (AC-2)", () => {
  it("In flight links the author, universe and series, the series named by itself; a standalone has only its author", async () => {
    const { default: Status } = await import("../src/app/books/status/page");
    const d = await render(Status, { searchParams: Promise.resolve({ tab: "inflight" }) });
    expect(placeLinks(d, ".row", "Serial flight")).toEqual(SERIAL);
    expect(placeLinks(d, ".row", "Lone flight")).toEqual(LONE);
  });

  it("Done draws the same links", async () => {
    const { default: Status } = await import("../src/app/books/status/page");
    const d = await render(Status, { searchParams: Promise.resolve({ tab: "done" }) });
    expect(placeLinks(d, ".row", "Serial done")).toEqual(SERIAL);
    expect(placeLinks(d, ".row", "Lone done")).toEqual(LONE);
  });

  it("Listen next draws the same links on its queue rows", async () => {
    const { default: Status } = await import("../src/app/books/status/page");
    const d = await render(Status, { searchParams: Promise.resolve({ tab: "next" }) });
    expect(placeLinks(d, ".qrow", "Serial listen")).toEqual(SERIAL);
    expect(placeLinks(d, ".qrow", "Lone listen")).toEqual(LONE);
  });

  it("Coming out draws the same links", async () => {
    const { default: Releases } = await import("../src/app/books/releases/page");
    const d = await render(Releases, {});
    expect(placeLinks(d, ".row", "Serial release")).toEqual(SERIAL);
    expect(placeLinks(d, ".row", "Lone release")).toEqual(LONE);
  });

  it("Parked draws the same links", async () => {
    const { default: Parked } = await import("../src/app/parked/page");
    const d = await render(Parked, {});
    expect(placeLinks(d, ".parked-row", "Serial parked")).toEqual(SERIAL);
    expect(placeLinks(d, ".parked-row", "Lone parked")).toEqual(LONE);
  });
});

describe("Top books (AC-2)", () => {
  it("draws the place line's links on a ranked and an unranked row, the same text as before", async () => {
    const { default: Top } = await import("../src/app/books/top/page");
    const d = await render(Top, { searchParams: Promise.resolve({ year: "2026" }) });
    expect(placeLinks(d, "ol.queue > li", "Serial top")).toEqual(SERIAL);
    expect(placeLinks(d, "ol.queue > li", "Lone top")).toEqual(LONE);
  });

  it("keeps a place link out of the drag handle: the links are in the row body, the handle is its own button", async () => {
    const { default: Top } = await import("../src/app/books/top/page");
    const d = await render(Top, { searchParams: Promise.resolve({ year: "2026" }) });
    const li = [...d.querySelectorAll("ol.queue > li")].find((r) => r.textContent?.includes("Serial top"))!;
    const links = [...li.querySelectorAll(".qplace a")];
    expect(links.length).toBe(3);
    for (const a of links) {
      expect(a.closest("button, [role=button]")).toBeNull();
      expect(a.closest(".qbody")).not.toBeNull();
    }
  });
});

describe("the queries carry the ids the links need (AC-2)", () => {
  it("returns author_id, series_id and universe_id on every list this task draws, null for a standalone's series and universe", async () => {
    const q = await import("../src/db/queries");
    const ids = (r: { author_id: string | null; series_id: string | null; universe_id: string | null }) =>
      [r.author_id, r.series_id, r.universe_id];
    const pick = <T extends { title: string }>(rows: T[], title: string) => rows.find((r) => r.title === title)!;
    const lists: [string, { title: string; author_id: string | null; series_id: string | null; universe_id: string | null }[], string][] = [
      ["booksInFlight", await q.booksInFlight(USER), "flight"],
      ["booksDone", await q.booksDone(USER), "done"],
      ["booksListenNext", await q.booksListenNext(USER), "listen"],
      ["topBooksYear", await q.topBooksYear(USER, 2026), "top"],
      ["wantedReleases", await q.wantedReleases(USER, TODAY), "release"],
      ["parkedBooks", await q.parkedBooks(USER), "parked"],
    ];
    for (const [name, rows, s] of lists) {
      expect(ids(pick(rows, `Serial ${s}`)), `${name}: serial`).toEqual(["au", "se", "un"]);
      expect(ids(pick(rows, `Lone ${s}`)), `${name}: lone`).toEqual(["au", null, null]);
    }
    const sorted = await q.rankSorterRead(USER, (await sql<{ id: number }[]>`SELECT id FROM read_events WHERE book_id = 's-top'`)[0].id);
    expect(ids(sorted!.read)).toEqual(["au", "se", "un"]);
  });
});
