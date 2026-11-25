// @area: books
// Task 2.2e (D-110): the Library sorts, in a real browser. Choosing Length puts
// ?sort=length in the URL and reorders the list, a reload keeps both, a chip and
// the search box keep the sort, and a direction flips it. Since task 6.24 (TASK-145,
// MR-D20) Sort is a dropdown chip, as Owned is: they open and close by keyboard,
// and the loading skeleton stands for their row. The nav shows
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
  "aria-required-children", "aria-required-parent",
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

// The Sort dropdown chip (task 6.24): named by its sort and the way it runs, it opens a group of links.
const sort = (page: Page) => page.getByRole("button", { name: /^Sort: / });
const sortList = (page: Page) => page.getByRole("group", { name: "Sort", exact: true });
const titles = (page: Page) => page.locator(".book-row .row-title");
const ours = (page: Page) => titles(page).filter({ hasText: /^E2E Srt / });

async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(sort(page));
}

/** Opens the Sort chip and chooses one of its links; the chip says where the list runs now. */
async function choose(page: Page, name: string) {
  await sort(page).click();
  await sortList(page).getByRole("link", { name, exact: true }).click();
  await expect(sortList(page)).toHaveCount(0);
}

test("choosing Length updates the URL and the order, and a reload keeps both (AC-1, AC-3)", FLOOR, async ({ page }, info) => {
  await open(page, "/books/list?q=E2E%20Srt");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  // Series, the default: no word count to rank, so the titles read alphabetically.
  await expect(sort(page)).toHaveText("Sort: Series");
  await expect(ours(page)).toHaveText(["E2E Srt Aardvark", "E2E Srt Long", "E2E Srt Mid", "E2E Srt Short"]);

  await choose(page, "Length");
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/q=E2E(%20|\+)Srt/);
  await expect(ours(page)).toHaveText(BY_LENGTH);
  await expect(sort(page)).toHaveAccessibleName("Sort: Length, longest first");

  await page.reload();
  await hydrated(sort(page));
  await expect(sort(page)).toHaveText("Sort: Length");
  await expect(ours(page)).toHaveText(BY_LENGTH);

  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "library-sort-length");
});

test("a direction flips the order, the empty book still last, and the chip says which way it runs (AC-3)", async ({ page }) => {
  await open(page, "/books/list?q=E2E%20Srt&sort=length");
  await sort(page).click();
  // The current sort's two directions are in the list, the one it runs marked.
  await expect(sortList(page).getByRole("link", { name: "Longest first", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(sortList(page).getByRole("link", { name: "Shortest first", exact: true })).not.toHaveAttribute("aria-current", "true");
  await sortList(page).getByRole("link", { name: "Shortest first", exact: true }).click();
  await expect(page).toHaveURL(/dir=asc/);
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);
  await expect(sort(page)).toHaveAccessibleName("Sort: Length, shortest first");

  // A reload keeps the direction too.
  await page.reload();
  await hydrated(sort(page));
  await expect(sort(page)).toHaveAccessibleName("Sort: Length, shortest first");
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);

  // A new sort opens in its own direction.
  await choose(page, "Title");
  await expect(page).toHaveURL(/sort=title/);
  await expect(page).not.toHaveURL(/dir=/);
  await expect(sort(page)).toHaveAccessibleName("Sort: Title, A–Z");
  await choose(page, "Z–A");
  await expect(page).toHaveURL(/sort=title&dir=desc/);
  await expect(ours(page)).toHaveText(["E2E Srt Short", "E2E Srt Mid", "E2E Srt Long", "E2E Srt Aardvark"]);
});

test("every sort in the list reorders the books, each opening in its own direction (AC-3)", async ({ page }) => {
  await open(page, "/books/list?q=E2E%20Srt");
  await sort(page).click();
  await expect(sortList(page).getByRole("link")).toHaveText([
    "Series", "Title", "Author", "Length", "Published", "Finished", "Plan order", "A–Z", "Z–A",
  ]);
  await page.keyboard.press("Escape");
  for (const [name, param] of [
    ["Title", "title"], ["Author", "author"], ["Length", "length"], ["Published", "published"],
    ["Finished", "finished"], ["Plan order", "plan"], ["Series", null],
  ] as const) {
    await choose(page, name);
    await expect(sort(page)).toHaveText(`Sort: ${name}`);
    // The default sort is no parameter; every other is its own, with the direction it opens in (none here).
    if (param) await expect(page).toHaveURL(new RegExp(`sort=${param}(&|$)`));
    else await expect(page).not.toHaveURL(/sort=/);
    await expect(page).toHaveURL(/q=E2E(%20|\+)Srt/);
    await expect(ours(page)).toHaveCount(4);
  }
});

test("a chip and the search box keep the sort (AC-3)", async ({ page }) => {
  await open(page, "/books/list?sort=length&dir=asc");
  await page.getByRole("link", { name: "To read" }).click();
  await expect(page).toHaveURL(/status=to_read/);
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/dir=asc/);
  await expect(sort(page)).toHaveText("Sort: Length");
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
  await expect(sort(page)).toHaveText("Sort: Series");
  await expect(ours(page)).toHaveCount(4);
});

test("the Sort chip is named and its choices are big enough, shut and open; axe, contrast and the page's width hold (AC-5)", FLOOR, async ({ page }, info) => {
  await open(page, "/books/list?sort=length");
  const width = page.viewportSize()!.width;
  // The UX floor: 44px on the phone, nothing under 24px from the tablet up.
  const floor = width < 768 ? 44 : 24;
  const box = (await sort(page).boundingBox())!;
  expect(box.height, `Sort chip height at ${width}px`).toBeGreaterThanOrEqual(floor);
  expect(box.width).toBeGreaterThanOrEqual(24);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoHorizontalScroll(page);

  await sort(page).click();
  const links = sortList(page).getByRole("link");
  await expect(links).toHaveCount(9);
  for (const b of await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(b.height, `Sort choice height at ${width}px`).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
    expect(b.width).toBeGreaterThanOrEqual(24);
  }
  // The list stays on the screen, its right edge included, and the page doesn't scroll sideways.
  const list = (await sortList(page).boundingBox())!;
  expect(list.x).toBeGreaterThanOrEqual(0);
  expect(list.x + list.width).toBeLessThanOrEqual(width);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "library-sort-controls");
});

// AC-4 (task 6.24): both dropdowns, by keyboard alone. Runs once: nothing in it is layout.
test("the dropdowns open by Enter and Space, move by arrows and Tab, close by Esc back to the chip, and mark the current choice (AC-4)", ONCE, async ({ page }) => {
  await open(page, "/books/list?q=E2E%20Srt&sort=length&owned=audio");
  const owned = page.getByRole("button", { name: /^Owned: / });
  await hydrated(owned);
  for (const [chip, group, current, second, last] of [
    [sort(page), "Sort", "Length", "Published", "Shortest first"],
    [owned, "Owned", "Audiobook", "Ebook", "Not owned"],
  ] as const) {
    const list = page.getByRole("group", { name: group, exact: true });
    const choice = (name: string) => list.getByRole("link", { name, exact: true });
    await expect(chip).toHaveAttribute("aria-expanded", "false");

    // Enter opens it with focus on the current choice, which is the one marked.
    await chip.focus();
    await page.keyboard.press("Enter");
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await expect(choice(current)).toBeFocused();
    await expect(choice(current)).toHaveAttribute("aria-current", "true");
    await expect(list.locator('[aria-current="true"]').first()).toHaveText(current);

    // Arrows walk the choices, wrapping; Home and End jump.
    await page.keyboard.press("ArrowDown");
    await expect(choice(second)).toBeFocused();
    await page.keyboard.press("End");
    await expect(choice(last)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(list.getByRole("link").first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(choice(last)).toBeFocused();
    // Tab walks them too, as links; Tab past the last one leaves the list, shut.
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    await expect(list.getByRole("link").nth(1)).toBeFocused();

    // Esc closes it and returns focus to the chip.
    await page.keyboard.press("Escape");
    await expect(list).toHaveCount(0);
    await expect(chip).toBeFocused();
    await expect(chip).toHaveAttribute("aria-expanded", "false");

    // Space opens it too, and Esc closes it again.
    await page.keyboard.press("Space");
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await expect(choice(current)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(chip).toBeFocused();

    // ArrowDown on the chip opens it as well; Tab past the end closes it.
    await page.keyboard.press("ArrowDown");
    await expect(chip).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("End");
    await page.keyboard.press("Tab");
    await expect(list).toHaveCount(0);
  }
});

// Opening is one tap, closing is a tap anywhere else.
test("a tap outside closes a dropdown, and opening one closes the other (AC-4)", ONCE, async ({ page }) => {
  await open(page, "/books/list?q=E2E%20Srt");
  const owned = page.getByRole("button", { name: /^Owned: / });
  await hydrated(owned);
  await sort(page).click();
  await expect(sortList(page)).toBeVisible();
  await owned.click();
  await expect(page.getByRole("group", { name: "Owned", exact: true })).toBeVisible();
  await expect(sortList(page)).toHaveCount(0);
  await page.getByRole("heading", { level: 1 }).click();
  await expect(page.getByRole("group", { name: "Owned", exact: true })).toHaveCount(0);
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
    await expect(sort(page)).toHaveText("Sort: Finished");
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
test("the loading skeleton's dropdown row is as tall as the loaded one (AC-5)", ONCE, async ({ page }) => {
  // The status chips wrap as the width makes them, then the Owned and Sort row: the rows start where the skeleton's will.
  const rows = () => page.locator("main > .filters:not([role=search])").evaluateAll((els) => els.slice(0, 2).map((el) => el.getBoundingClientRect().height));
  for (const width of [360, 390, 412, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, "/books/list");
    const loaded = await rows();
    await page.evaluate((html) => { document.querySelector("main")!.outerHTML = html; }, renderToStaticMarkup(createElement(Loading)));
    const skeleton = await rows();
    // The status chips (as they wrap), then the dropdown row.
    for (const n of [0, 1]) {
      expect(Math.abs(skeleton[n] - loaded[n]), `chip row ${n} at ${width}px: loaded ${loaded[n]}, skeleton ${skeleton[n]}`).toBeLessThanOrEqual(6);
    }
  }
});
