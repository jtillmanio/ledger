// @area: books
// Task 5.11b (TASK-162; F-20, D-26, D-42, D-43, D-90, D-118): the Universes list in a real browser, on the TEST
// database. `/books/universes` opens on *Started* (a book read, in hand or DNF, or a follow of Tracking or
// Reading) with *All* a tap away; each row links to `/books/universes/<id>` and reads `read / total` as
// `universe_progress` does, with *N series · Reading|Tracking|On hold* (D-118) and a meter filled with --ready.
// The Series page's *Universes* tab opens it and carries `aria-current="page"` there; Series stays current in
// the nav. The UX floor: axe, contrast, 44px targets at phone widths, no sideways scroll, nothing red, the
// empty, nothing-started and error states in place, the loading skeleton at the loaded size, screenshots.
//
// The universes and books are made here, under E2E ids no other spec uses, and removed after the last test.
// The database holds real universes too, so rows are found by name, never by index on the whole list.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import UniversesError from "../../src/app/books/universes/error";
import UniversesLoading from "../../src/app/books/universes/loading";
import UniversesList from "../../src/components/UniversesList";
import { testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

type Book = { id: string; title: string; status: "read" | "reading" | "to_read" | null; series?: string };
const book = (u: string, n: number, status: Book["status"], series?: string): Book =>
  ({ id: `e2e-un-${u}-${n}`, title: `E2E Un ${u} Book ${n}`, status, series });
type Uni = { id: string; name: string; follow: "reading" | "tracking" | null; books: Book[] };

// AC-1's three: one with a read book, one followed with none read, one with only To-read books. READ also sits in
// two series, and is followed Reading; HOLD is followed Tracking and part-read (*On hold*, AC-2).
const READ: Uni = { id: "e2e-un-read", name: "E2E Un Read", follow: "reading",
  books: [book("read", 1, "read", "e2e-un-ser-a"), book("read", 2, null, "e2e-un-ser-a"), book("read", 3, "to_read", "e2e-un-ser-b"), book("read", 4, null)] };
const TRACK: Uni = { id: "e2e-un-track", name: "E2E Un Track", follow: "tracking", books: [book("track", 1, null), book("track", 2, "to_read")] };
const TODO: Uni = { id: "e2e-un-todo", name: "E2E Un Todo", follow: null, books: [book("todo", 1, "to_read"), book("todo", 2, "to_read")] };
const HOLD: Uni = { id: "e2e-un-hold", name: "E2E Un Hold", follow: "tracking", books: [book("hold", 1, "read"), book("hold", 2, null)] };
const UNIS = [READ, TRACK, TODO, HOLD];
const SERIES = ["e2e-un-ser-a", "e2e-un-ser-b"];
const IDS = UNIS.flatMap((u) => u.books.map((b) => b.id));

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  const ids = UNIS.map((u) => u.id);
  await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[]) OR universe_id = ANY(${ids}::text[])`;
  // Follows go with their universe (ON DELETE CASCADE).
  await sql`DELETE FROM book_universes WHERE id = ANY(${ids}::text[])`;
  await sql`DELETE FROM book_series WHERE id = ANY(${SERIES}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const s of SERIES) await sql`INSERT INTO book_series (id, name) VALUES (${s}, ${`E2E Un ${s}`})`;
    for (const u of UNIS) {
      await sql`INSERT INTO book_universes (id, name) VALUES (${u.id}, ${u.name})`;
      for (const [n, b] of u.books.entries()) {
        await sql`INSERT INTO books (id, title, universe_id, universe_position, series_id) VALUES (${b.id}, ${b.title}, ${u.id}, ${n + 1}, ${b.series ?? null})`;
        if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
      }
      if (u.follow) await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${E2E_USER}, ${u.id}, ${u.follow})`;
    }
  });
});
test.afterAll(clean);

const rows = (page: Page) => page.locator(".series-rows > li");
const rowOf = (page: Page, name: string) => rows(page).filter({ has: page.locator(".rt", { hasText: new RegExp(`^${name}$`) }) });
const chip = (page: Page, name: "Started" | "All") => page.locator(".series-chips").getByRole("link", { name: new RegExp(`^${name},`) });
const chipCount = async (page: Page, name: "Started" | "All") => Number(await chip(page, name).locator(".n").textContent());
const tab = (page: Page, name: "Series" | "Universes") => page.locator(".list-tabs").getByRole("link", { name: new RegExp(`^${name} `) });

/** The list, on *Started* (the page's own address) or on *All* (`?show=all`; TODO is not started). */
async function open(page: Page, all = false) {
  await page.goto(all ? "/books/universes?show=all" : "/books/universes");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Universes");
  await expect(rowOf(page, READ.name)).toHaveCount(1);
}

/**
 * Puts a state's static markup in place of the loaded page's <main>, so it gets the real CSS, fonts and width.
 * Swapped before hydration, the markup no longer matches and React regenerates the page over it.
 */
async function swapMain(page: Page, markup: string) {
  await hydrated(rows(page).first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing in the page's main resolves to --danger: a universe is no error.
  const danger = await tokenColour(page, "--danger");
  const red = await page.locator("main").evaluate((main, d) => [...main.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor].includes(d);
  }).map((el) => el.outerHTML.slice(0, 80)), danger);
  expect(red).toEqual([]);
  // Every control a real, named button or link, at least 24px.
  const small = await page.locator("main").evaluate((main) => [...main.querySelectorAll("a[href], button, input, textarea")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width !== 0 || r.height !== 0) && (r.width < 24 || r.height < 24);
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
}

const ONCE = { tag: "@at-w390-light" };
const progress = (id: string) => withSql((sql) => sql<{ read: number; total: number }[]>`
  SELECT books_read::int AS read, books_listed::int AS total FROM universe_progress WHERE universe_id = ${id} AND user_id = ${E2E_USER}`.then((r) => r[0]));

test("Started lists the read, the followed and the part-read universes, not the To-read one; All adds it; each row links with read / total as universe_progress has (AC-1)", ONCE, async ({ page }) => {
  await open(page);
  await expect(chip(page, "Started")).toHaveAttribute("aria-current", "true");
  for (const u of [READ, TRACK, HOLD]) await expect(rowOf(page, u.name)).toHaveCount(1);
  await expect(rowOf(page, TODO.name)).toHaveCount(0);
  const started = await rows(page).count();
  expect(await chipCount(page, "Started")).toBe(started);
  await chip(page, "All").click();
  await expect(page).toHaveURL(/\/books\/universes\?show=all$/);
  for (const u of UNIS) await expect(rowOf(page, u.name)).toHaveCount(1);
  const all = await rows(page).count();
  expect(await chipCount(page, "All")).toBe(all);
  expect(all).toBeGreaterThan(started);
  await expect(chip(page, "All")).toHaveAttribute("aria-current", "true");
  // Each row's name is its one link, to /books/universes/<id>, and its `read / total` is the view's.
  for (const u of UNIS) {
    const row = rowOf(page, u.name);
    await expect(row.getByRole("link")).toHaveCount(1);
    await expect(row.getByRole("link", { name: u.name, exact: true })).toHaveAttribute("href", `/books/universes/${u.id}`);
    const p = (await progress(u.id))!;
    await expect(row.locator(".rm")).toHaveText(`${p.read} / ${p.total}`);
    await expect(row.locator(".chev")).toBeVisible();
  }
  await expect(rowOf(page, READ.name).locator(".rm")).toHaveText("1 / 4");
});

test("any other ?show= shows Started; All survives a reload, and Back returns to Started (AC-1)", ONCE, async ({ page }) => {
  await page.goto("/books/universes?show=bogus");
  await expect(chip(page, "Started")).toHaveAttribute("aria-current", "true");
  await expect(rowOf(page, READ.name)).toHaveCount(1);
  await expect(rowOf(page, TODO.name)).toHaveCount(0);
  await open(page);
  await chip(page, "All").click();
  await expect(page).toHaveURL(/show=all$/);
  await page.reload();
  await expect(chip(page, "All")).toHaveAttribute("aria-current", "true");
  await expect(rowOf(page, TODO.name)).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/books\/universes$/);
  await expect(chip(page, "Started")).toHaveAttribute("aria-current", "true");
  await expect(rowOf(page, TODO.name)).toHaveCount(0);
});

test("the Series page's Universes tab opens the list and carries aria-current there; Series carries it on Series; Back returns to Series (AC-1)", ONCE, async ({ page }) => {
  await page.goto("/books/series");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Series");
  await expect(tab(page, "Series")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "Universes")).not.toHaveAttribute("aria-current");
  await expect(page.locator(".list-tabs a")).toHaveCount(2);
  await hydrated(tab(page, "Universes"));
  await tab(page, "Universes").click();
  await expect(page).toHaveURL(/\/books\/universes$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Universes");
  await expect(tab(page, "Universes")).toHaveAttribute("aria-current", "page");
  await expect(tab(page, "Series")).not.toHaveAttribute("aria-current");
  // A push, not a replace: Back is the tab it came from.
  await page.goBack();
  await expect(page).toHaveURL(/\/books\/series$/);
  await expect(tab(page, "Series")).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(tab(page, "Universes")).toHaveAttribute("aria-current", "page");
  // Each tab's count is the other list's All chip.
  const universes = await chipCount(page, "All");
  await tab(page, "Series").click();
  await expect(page).toHaveURL(/\/books\/series$/);
  await expect(tab(page, "Universes").locator(".n")).toHaveText(String(universes));
});

test("Series stays current in the nav on the Universes list, and a universe's own page is not the list (AC-1)", ONCE, async ({ page }) => {
  await open(page);
  // The nav's item (the rail, the sidebar or the phone's tab row), not the in-page row: the row's Series isn't current here.
  const nav = page.locator('a[href="/books/series"]:not(.list-tabs > a)').filter({ visible: true });
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute("aria-current", "page");
  // No nav item of its own (the Started chip and the tab, both in <main>, share the address).
  await expect(page.locator('a[href="/books/universes"]:not(main a)')).toHaveCount(0);
});

test("a row's name opens the universe's own page, and Back returns to the list on the same cut (AC-1)", ONCE, async ({ page }) => {
  await open(page, true);
  await rowOf(page, TODO.name).getByRole("link", { name: TODO.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/universes/${TODO.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(TODO.name);
  await page.goBack();
  await expect(page).toHaveURL(/\/books\/universes\?show=all$/);
  await expect(chip(page, "All")).toHaveAttribute("aria-current", "true");
});

test("a universe followed Tracking and part-read says On hold; Tracking with none read says Tracking; Reading says Reading; with its series count (AC-2)", ONCE, async ({ page }) => {
  await open(page);
  await expect(rowOf(page, HOLD.name).locator(".rs")).toHaveText("On hold");
  await expect(rowOf(page, TRACK.name).locator(".rs")).toHaveText("Tracking");
  await expect(rowOf(page, READ.name).locator(".rs")).toHaveText("2 series · Reading");
  // The universe's own page says the same through its follow control (5.11): the middle option reads On hold.
  await rowOf(page, HOLD.name).getByRole("link", { name: HOLD.name, exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: `Following ${HOLD.name}` }).locator(".opt")).toHaveText(["Reading", "On hold", "Not following"]);
  await expect(page.getByRole("radio", { name: "On hold" })).toBeChecked();
});

test("a row's meter fills with --ready by the share read (AC-4)", ONCE, async ({ page }) => {
  await open(page);
  const read = rowOf(page, READ.name);
  const fill = read.locator(".meter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await read.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width / track.width - 0.25)).toBeLessThan(0.02);
  const track0 = (await rowOf(page, TRACK.name).locator(".meter i").boundingBox());
  expect(track0?.width ?? 0).toBeLessThan(1);
});

test("the tabs and chips are links of 44px at phone widths, the floor on both cuts; screenshots (AC-1, AC-4)", FLOOR, async ({ page }, info) => {
  const phone = page.viewportSize()!.width < 768;
  for (const all of [false, true]) {
    await open(page, all);
    await expect(page.locator(".series-chips [aria-current]")).toHaveCount(1);
    await expect(page.locator('.list-tabs [aria-current="page"]')).toHaveCount(1);
    for (const target of [tab(page, "Series"), tab(page, "Universes"), chip(page, "Started"), chip(page, "All")]) {
      const box = (await target.boundingBox())!;
      expect(box.height, "target height").toBeGreaterThanOrEqual(phone ? 44 : 24);
    }
    await floor(page);
    await screenshot(page, info, all ? "universes-all" : "universes-started");
  }
});

// A state is rendered to static markup and put in place of the loaded page's <main>, so it gets the real CSS,
// fonts and width. An empty state is a feel-pass surface (design § 10): `@feel` runs it at 412px too, so the
// screenshots cover every `ui.viewports` width. The shared database always holds universes, so the empty
// list's own markup stands in for the loaded <main>.
test("the empty state: No universes yet, naming Calibre's #superseries, one action to Calibre sync, the tab row kept; the floor; screenshots (AC-3, AC-4)", FEEL, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(createElement(UniversesList, { universes: [], show: "started", counts: { started: 0, all: 0 }, seriesCount: 3 })));
  const slate = page.locator(".slate");
  await expect(slate).toContainText("No universes yet");
  await expect(slate).toContainText("#superseries");
  await expect(slate.getByRole("link")).toHaveCount(1);
  await expect(slate.getByRole("link", { name: "Calibre sync" })).toHaveAttribute("href", "/settings/calibre");
  await expect(page.locator(".series-chips")).toHaveCount(0);
  await expect(page.locator(".list-tabs")).toHaveCount(1);
  await expect(tab(page, "Series").locator(".n")).toHaveText("3");
  await floor(page);
  await screenshot(page, info, "universes-empty");
});

test("nothing started: the chips and a slate that names All and its count, never a blank page; the floor; screenshots (AC-4)", FEEL, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(createElement(UniversesList, { universes: [], show: "started", counts: { started: 0, all: 3 }, seriesCount: 3 })));
  const slate = page.locator(".slate");
  await expect(slate).toContainText("Nothing started yet");
  await expect(slate.getByRole("link", { name: "All 3 universes" })).toHaveAttribute("href", "/books/universes?show=all");
  await expect(page.locator(".series-chips a")).toHaveCount(2);
  await floor(page);
  await screenshot(page, info, "universes-nothing-started");
});

test("the error state: a neutral line and a real Try again; the floor; screenshots (AC-4)", FEEL, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(UniversesError({ error: new Error("boom"), reset: () => {} })));
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load your universes. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "universes-error");
});

// The skeleton's first row is measured against a loaded row of the same lines: READ's (the name and count, one
// line of series and follow, the meter).
test("the loading skeleton is the loaded size: the tab row, the chips and a row, within 2px (AC-4)", FLOOR, async ({ page }) => {
  await open(page);
  const loaded = (await rowOf(page, READ.name).boundingBox())!;
  const tabs = (await page.locator(".list-tabs").boundingBox())!;
  const chips = (await page.locator(".series-chips").boundingBox())!;
  const firstRow = (await rows(page).first().boundingBox())!;
  await swapMain(page, renderToStaticMarkup(createElement(UniversesLoading)));
  const skTabs = (await page.locator(".sk-tabs").boundingBox())!;
  const skChips = (await page.locator(".series-chips").boundingBox())!;
  const sk = (await page.locator(".series-rows > li").first().boundingBox())!;
  expect(Math.abs(skTabs.height - tabs.height), `skeleton tabs ${skTabs.height}px, loaded ${tabs.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(skChips.y - skTabs.y - (chips.y - tabs.y)), "chips under the tabs").toBeLessThanOrEqual(2);
  expect(Math.abs(skChips.height - chips.height), `skeleton chips ${skChips.height}px, loaded ${chips.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs((sk.y - skChips.y) - (firstRow.y - chips.y)), "list under the chips").toBeLessThanOrEqual(2);
  expect(Math.abs(sk.height - loaded.height), `skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(sk.width - loaded.width), "width").toBeLessThanOrEqual(2);
});
