// Task 5.9, 1 of 2 (TASK-101; D-26, D-90, R1-06): the Series list in a real browser, on the TEST database. A
// row reads `read / total`, its meter fills with --ready, and it names the lowest-position unread book; a
// complete series names none; one with more read than its stated total reads `4 / 3` with a full meter.
// The rows come in progress first, then not started, then complete. Series is current in the tab row, the
// rail and the sidebar. The UX floor: axe, contrast, 24px targets, no sideways scroll, nothing red, the
// empty and error states in place, the loading skeleton at the loaded size, screenshots. The row's link and
// a series' own page are TASK-102's.
//
// The series and books are made here, under E2E ids no other spec uses, and removed after the last test.
// The database holds real series too, so rows are found by name, never by index on the whole list.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import SeriesError from "../../src/app/books/series/error";
import SeriesList from "../../src/components/SeriesList";
import SeriesLoading from "../../src/app/books/series/loading";
import { testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-se-author", name: "E2E Se Author" };
type Book = { id: string; title: string; pos: number; status: "read" | "to_read" | null };
const book = (series: string, n: number, status: Book["status"]): Book =>
  ({ id: `e2e-se-${series}-${n}`, title: `E2E Se ${series} Book ${n}`, pos: n, status });
// 3 of 5 stated, the next one the 4th; nothing read of 2 listed (no stated total); every book read; 4 read of a stated 3.
const PART = { id: "e2e-se-part", name: "E2E Se Part", total: 5 as number | null,
  books: [book("part", 1, "read"), book("part", 2, "read"), book("part", 3, "read"), book("part", 4, "to_read"), book("part", 5, null)] };
const NONE = { id: "e2e-se-none", name: "E2E Se None", total: null, books: [book("none", 1, "to_read"), book("none", 2, null)] };
const DONE = { id: "e2e-se-done", name: "E2E Se Done", total: null, books: [book("done", 1, "read"), book("done", 2, "read")] };
const OVER = { id: "e2e-se-over", name: "E2E Se Over", total: 3 as number | null,
  books: [book("over", 1, "read"), book("over", 2, "read"), book("over", 3, "read"), book("over", 4, "read")] };
const SERIES = [PART, NONE, DONE, OVER];
const IDS = SERIES.flatMap((s) => s.books.map((b) => b.id));

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM book_series WHERE id = ANY(${SERIES.map((s) => s.id)}::text[])`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    for (const s of SERIES) {
      await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${s.id}, ${s.name}, ${AUTHOR.id}, ${s.total})`;
      for (const b of s.books) {
        await sql`INSERT INTO books (id, title, author_id, series_id, series_position) VALUES (${b.id}, ${b.title}, ${AUTHOR.id}, ${s.id}, ${b.pos})`;
        if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
      }
    }
  });
});
test.afterAll(clean);

const rows = (page: Page) => page.locator(".series-rows > li");
const rowOf = (page: Page, name: string) => rows(page).filter({ has: page.locator(".rt", { hasText: new RegExp(`^${name}$`) }) });

async function open(page: Page) {
  await page.goto("/books/series");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Series");
  await expect(rowOf(page, PART.name)).toHaveCount(1);
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
  // Nothing in the page's main resolves to --danger: a series is no error.
  const danger = await tokenColour(page, "--danger");
  const red = await page.locator("main").evaluate((main, d) => [...main.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor].includes(d);
  }).map((el) => el.outerHTML.slice(0, 80)), danger);
  expect(red).toEqual([]);
  // Every control a real, named button or link, at least 24px (the list has none yet; the empty state has one).
  const small = await page.locator("main").evaluate((main) => [...main.querySelectorAll("a[href], button, input, textarea")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width !== 0 || r.height !== 0) && (r.width < 24 || r.height < 24);
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
}

test("a part-read series reads 3 / 5, its meter filled with --ready, and names the lowest-position unread book (AC-1)", FLOOR, async ({ page }) => {
  await open(page);
  const part = rowOf(page, PART.name);
  await expect(part.locator(".rm")).toHaveText("3 / 5");
  await expect(part.locator(".rs").first()).toHaveText(AUTHOR.name);
  await expect(part.locator(".series-next")).toHaveText(`Next up${PART.books[3].title}#4`);
  const fill = part.locator(".meter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await part.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width / track.width - 0.6)).toBeLessThan(0.02);
  // Not a link yet: the series' own page is TASK-102's.
  await expect(part.getByRole("link")).toHaveCount(0);
});

test("a series with no stated total counts its listed books; a complete one names none (AC-1)", FLOOR, async ({ page }) => {
  await open(page);
  const none = rowOf(page, NONE.name);
  await expect(none.locator(".rm")).toHaveText("0 / 2");
  await expect(none.locator(".series-next")).toContainText(NONE.books[0].title);
  const done = rowOf(page, DONE.name);
  await expect(done.locator(".rm")).toHaveText("2 / 2");
  await expect(done.locator(".series-next")).toHaveCount(0);
  await expect(done).toContainText("All read");
});

test("in progress first, then not started, then complete, each by name (AC-2)", FLOOR, async ({ page }) => {
  await open(page);
  const names = await rows(page).locator(".rt").allTextContents();
  expect(names.filter((n) => n.startsWith("E2E Se "))).toEqual([PART.name, NONE.name, DONE.name, OVER.name]);
});

test("4 read of a stated 3 reads 4 / 3 and the meter is full, not overflowing (AC-3)", FLOOR, async ({ page }) => {
  await open(page);
  const over = rowOf(page, OVER.name);
  await expect(over.locator(".rm")).toHaveText("4 / 3");
  const [bar, track] = [(await over.locator(".meter i").boundingBox())!, (await over.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width - track.width)).toBeLessThanOrEqual(1);
  expect(bar.x + bar.width).toBeLessThanOrEqual(track.x + track.width + 1);
});

test("Series is current in the tab row, the rail and the sidebar, whichever this width draws (AC-4)", FLOOR, async ({ page }) => {
  await open(page);
  const current = page.locator('a[aria-current="page"][href="/books/series"]').filter({ visible: true });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Series");
  await expect(page.locator('a[aria-current="page"][href="/books/shelves"]').filter({ visible: true })).toHaveCount(0);
});

test("the floor on the list: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  await floor(page);
  await screenshot(page, info, "series-list");
});

// A state is rendered to static markup and put in place of the loaded page's <main>, so it gets the real CSS,
// fonts and width. An empty state is a feel-pass surface (design § 10): `@feel` runs it at 412px too, so the
// screenshots cover every `ui.viewports` width.
test("the empty state: No series yet and one action, Add a book, to /books/add; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await open(page);
  // The shared database always holds series, so the empty list's own markup stands in for the loaded <main>.
  await swapMain(page, renderToStaticMarkup(createElement(SeriesList, { series: [] })));
  const slate = page.locator(".slate");
  await expect(slate).toContainText("No series yet");
  await expect(slate.getByRole("link", { name: "Add a book" })).toHaveAttribute("href", "/books/add");
  await expect(page.getByRole("link", { name: "Add a book" })).toHaveCount(1);
  await floor(page);
  await screenshot(page, info, "series-empty");
});

test("the error state: a neutral line and a real Try again; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(SeriesError({ error: new Error("boom"), reset: () => {} })));
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load your series. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "series-error");
});

// The skeleton's first row is measured against a loaded row of the same lines: Done's (the name and count, the
// author, one *All read* line) is two .rs lines, as the skeleton draws.
test("the loading skeleton's row is the loaded row's size, within 2px (AC-6)", FLOOR, async ({ page }) => {
  await open(page);
  const loaded = (await rowOf(page, PART.name).boundingBox())!;
  const done = (await rowOf(page, DONE.name).boundingBox())!;
  await swapMain(page, renderToStaticMarkup(createElement(SeriesLoading)));
  const sk = (await page.locator(".series-rows > li").first().boundingBox())!;
  // Part and Done each have a name line, an author line and one more line (Next up / All read): the skeleton's size.
  expect(Math.abs(loaded.height - done.height), "loaded rows differ").toBeLessThanOrEqual(2);
  expect(Math.abs(sk.height - done.height), `skeleton ${sk.height}px, loaded ${done.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(sk.width - done.width), "width").toBeLessThanOrEqual(2);
});
