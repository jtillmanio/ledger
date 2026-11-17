// Task 2.2e (D-110): the Library sorts, in a real browser. Choosing Length puts
// ?sort=length in the URL and reorders the list, a reload keeps both, a chip and
// the search box keep the sort, and the reverse link flips it. The nav shows
// Library where it draws medium items. The books are made here under an E2E
// title the rest of the suite doesn't use, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import Loading from "../../src/app/books/list/loading";
import { FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria", "target-size", "label",
  "select-name",
];
/** In length order; `none` has no word count and comes last either way. */
const BOOKS = [
  { id: "e2e-srt-long", title: "E2E Srt Long", words: 500_000 },
  { id: "e2e-srt-mid", title: "E2E Srt Mid", words: 300_000 },
  { id: "e2e-srt-short", title: "E2E Srt Short", words: 90_000 },
  { id: "e2e-srt-none", title: "E2E Srt Aardvark", words: null },
];
const BY_LENGTH = ["E2E Srt Long", "E2E Srt Mid", "E2E Srt Short", "E2E Srt Aardvark"];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql((sql) => sql`DELETE FROM books WHERE id = ANY(${BOOKS.map((b) => b.id)}::text[])`);

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, word_count, word_count_source)
                VALUES (${b.id}, ${b.title}, ${b.words}, ${b.words ? "stated" : null})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
  });
});
test.afterAll(clean);

const sort = (page: Page) => page.getByRole("combobox", { name: "Sort" });
const titles = (page: Page) => page.locator(".book-row .row-title");
const ours = (page: Page) => titles(page).filter({ hasText: /^E2E Srt / });

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(sort(page));
}

test("choosing Length updates the URL and the order, and a reload keeps both (AC-1)", FLOOR, async ({ page }, info) => {
  await open(page, "/books/list?q=E2E%20Srt");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  // Series, the default: no word count to rank, so the titles read alphabetically.
  await expect(sort(page)).toHaveValue("series");
  await expect(ours(page)).toHaveText(["E2E Srt Aardvark", "E2E Srt Long", "E2E Srt Mid", "E2E Srt Short"]);

  await sort(page).selectOption("length");
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/q=E2E(%20|\+)Srt/);
  await expect(ours(page)).toHaveText(BY_LENGTH);

  await page.reload();
  await hydrated(sort(page));
  await expect(sort(page)).toHaveValue("length");
  await expect(ours(page)).toHaveText(BY_LENGTH);

  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "library-sort-length");
});

test("the reverse link flips the order, the empty book still last, and says which way it goes (AC-1, AC-5)", async ({ page }) => {
  await open(page, "/books/list?q=E2E%20Srt&sort=length");
  const reverse = page.getByRole("link", { name: "Longest first; reverse to shortest first" });
  await expect(reverse).toBeVisible();
  await reverse.click();
  await expect(page).toHaveURL(/dir=asc/);
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);
  await expect(page.getByRole("link", { name: "Shortest first; reverse to longest first" })).toBeVisible();
  await expect(sort(page)).toHaveValue("length");

  // A new sort opens in its own direction.
  await sort(page).selectOption("title");
  await expect(page).toHaveURL(/sort=title/);
  await expect(page).not.toHaveURL(/dir=/);
  await expect(page.getByRole("link", { name: "A–Z; reverse to Z–A" })).toBeVisible();
});

test("a chip and the search box keep the sort (AC-3)", async ({ page }) => {
  await open(page, "/books/list?sort=length&dir=asc");
  await page.getByRole("link", { name: "To read" }).click();
  await expect(page).toHaveURL(/status=to_read/);
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/dir=asc/);
  await expect(sort(page)).toHaveValue("length");
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);

  await page.getByRole("searchbox", { name: "Search books" }).pressSequentially("E2E Srt", { delay: 40 });
  await expect(page).toHaveURL(/q=E2E(%20|\+)Srt/);
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/status=to_read/);
  await expect(titles(page)).toHaveCount(4);
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);
});

test("an unknown sort opens the list in its default order (AC-2)", async ({ page }) => {
  await page.goto("/books/list?q=E2E%20Srt&sort=banana&dir=sideways");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(sort(page)).toHaveValue("series");
  await expect(ours(page)).toHaveCount(4);
});

test("Sort is a named select and the reverse a named link, none under 24px, text 4.5:1 (AC-5)", FLOOR, async ({ page }, info) => {
  await open(page, "/books/list?sort=length");
  const reverse = page.getByRole("link", { name: /^Longest first; reverse/ });
  for (const control of [sort(page), reverse]) {
    const box = (await control.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "library-sort-controls");
});

test("the nav says Library where it draws medium items, and the heading says it everywhere (AC-1, AC-4)", ONCE, async ({ page }, info) => {
  const h1 = page.getByRole("heading", { level: 1 });
  // The phone's media switch marks Books, and since 2.2i its tab row lists Library once, marked current.
  for (const width of [360, 412]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/books/list");
    await expect(h1).toHaveText("Library");
    await expect(page.getByRole("navigation", { name: "Media" }).getByRole("link", { name: "Books" })).toHaveAttribute("aria-current", "page");
    const tab = page.getByRole("navigation", { name: "Screens" }).getByRole("link", { name: "Library" });
    await expect(page.getByRole("link", { name: "Library" })).toHaveCount(1);
    await expect(tab).toHaveAttribute("aria-current", "page");
    await screenshot(page, info, `library-nav-${width}`);
  }
  // From 768px the rail, then the sidebar, list Library and mark it current.
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/books/list");
    await expect(h1).toHaveText("Library");
    const library = page.getByRole("link", { name: "Library" });
    await expect(library).toHaveCount(1);
    await expect(library).toHaveAttribute("aria-current", "page");
    await expect(library).toHaveAttribute("href", "/books/list");
    await screenshot(page, info, `library-nav-${width}`);
  }
  // On the status screen it is listed and not current.
  await page.goto("/books/status");
  await expect(page.getByRole("link", { name: "Library" })).not.toHaveAttribute("aria-current", "page");
});

// Task 3.4b (D-122, R2-08): a year's reading is found on Top books, so the Library draws no year chip
// and no No year, and an old ?year= link lists everything. The books are two read books with exact
// finish dates in two years, under a title the other tests here don't filter on.
const YEARS = [
  { id: "e2e-yr-2024", title: "E2E Yr Newer", on: "2024-05-01" },
  { id: "e2e-yr-2023", title: "E2E Yr Older", on: "2023-05-01" },
];

test("the Library draws no year chip or No year, ignores ?year=, and Finished still sorts newest first (AC-1, AC-2)", ONCE, async ({ page }) => {
  await withSql(async (sql) => {
    await sql`DELETE FROM books WHERE id = ANY(${YEARS.map((b) => b.id)}::text[])`;
    for (const b of YEARS) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${b.id}, 'read', ${b.on}, 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, ${b.id}, ${b.on}, 'exact', 'text')`;
    }
  });
  try {
    await open(page, "/books/list?year=2024&sort=finished&q=E2E%20Yr");
    // ?year=2024 is not a filter any more: the 2023 book is listed too, the 2024 one first (Finished, newest first).
    await expect(titles(page)).toHaveText(["E2E Yr Newer", "E2E Yr Older"]);
    await expect(sort(page)).toHaveValue("finished");
    // The status chips are still drawn, so an empty .filters is not what passes.
    await expect(page.locator(".filters").getByRole("link", { name: "Everything" })).toBeVisible();
    await expect(page.locator(".filters").getByRole("link", { name: "Read", exact: true })).toBeVisible();
    // No chip, or any link on the page, carries ?year=, and nothing says No year.
    await expect(page.locator('a[href*="year="]')).toHaveCount(0);
    await expect(page.locator(".filters").getByText(/no year/i)).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^20\d\d, \d+ read$/ })).toHaveCount(0);
    // Everything is the current chip, as with no filter.
    await expect(page.locator(".filters").getByRole("link", { name: "Everything" })).toHaveAttribute("aria-current", "true");
  } finally {
    await withSql((sql) => sql`DELETE FROM books WHERE id = ANY(${YEARS.map((b) => b.id)}::text[])`);
  }
});

// Sets its own viewports: runs once, in w390-light.
test("the loading skeleton's first chip group is as tall as the loaded one, Sort included (AC-5)", ONCE, async ({ page }) => {
  // The status chips and the Sort, wrapping as the width makes them: the rows start where the skeleton's will.
  const group = () => page.locator(".filters:not([role=search])").first().evaluate((el) => el.getBoundingClientRect().height);
  for (const width of [360, 390, 412, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/books/list");
    const loaded = await group();
    await page.evaluate((html) => { document.querySelector("main")!.outerHTML = html; }, renderToStaticMarkup(createElement(Loading)));
    const skeleton = await group();
    expect(Math.abs(skeleton - loaded), `first chip group at ${width}px: loaded ${loaded}, skeleton ${skeleton}`).toBeLessThanOrEqual(6);
  }
});
