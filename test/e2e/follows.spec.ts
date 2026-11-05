// Task 2.2c (D-108, D-116): following what you read, in a real browser, at
// every width, light and dark (AC-1, AC-3, AC-4, AC-5). A Library row's ⋯ has
// *Follow…*, which opens a sheet headed by the book's title listing its series,
// author, universe and shelf, each a radiogroup checked as stored with its
// read / total; a change saves with an Undo live over the sheet. Finishing a
// book offers *Keep going?* chips in its toast, reached by keyboard (F6, Tab,
// Enter); a chip writes Reading, and its Undo leaves the finish. The books are
// made here, under E2E ids the rest of the suite doesn't use, and removed after
// the last test; each test starts from the same rows.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot,
  toastSettled, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-fo-author", name: "E2E Fo Author" };
const UNIVERSE = { id: "e2e-fo-uni", name: "E2E Fo Universe" };
const SERIES = { id: "e2e-fo-series", name: "E2E Fo Series" };
const SHELF = { id: "e2e-fo-shelf", name: "E2E Fo Shelf" };
const BOOKS = [1, 2, 3, 4].map((n) => ({ id: `e2e-fo-${n}`, title: `E2E Fo Book ${["One", "Two", "Three", "Four"][n - 1]}`, n }));
const LOOSE = { id: "e2e-fo-loose", title: "E2E Fo Loose" };
const TWO = BOOKS[1];
const IDS = [...BOOKS.map((b) => b.id), LOOSE.id];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Follows go with what they point at (ON DELETE CASCADE).
const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM shelves WHERE id = ${SHELF.id}`;
  await sql`DELETE FROM book_series WHERE id = ${SERIES.id}`;
  await sql`DELETE FROM book_universes WHERE id = ${UNIVERSE.id}`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${UNIVERSE.id}, ${UNIVERSE.name})`;
    await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${SERIES.id}, ${SERIES.name}, ${AUTHOR.id}, 4)`;
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, genre, author_id, series_id, series_position, universe_id)
                VALUES (${b.id}, ${b.title}, 'Fantasy', ${AUTHOR.id}, ${SERIES.id}, ${b.n}, ${UNIVERSE.id})`;
    }
    await sql`INSERT INTO books (id, title, genre, author_id) VALUES (${LOOSE.id}, ${LOOSE.title}, 'Fantasy', ${AUTHOR.id})`;
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${SHELF.id}, ${SHELF.name}, ${E2E_USER}, 'books')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${SHELF.id}, ${BOOKS[1].id}, 1), (${SHELF.id}, ${BOOKS[2].id}, 2)`;
  });
});
test.afterAll(clean);

// Book One read; the rest to read; Series Tracking and Author Reading; nothing else followed.
test.beforeEach(async () => {
  await withSql(async (sql) => {
    await sql`DELETE FROM read_events WHERE book_id = ANY(${IDS}::text[])`;
    await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${BOOKS[0].id}, 'read', '2026-03-17', 'exact')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${BOOKS[0].id}, '2026-03-17', 'exact')`;
    for (const b of [...BOOKS.slice(1), LOOSE]) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
    await sql`DELETE FROM series_follows WHERE series_id = ${SERIES.id}`;
    await sql`DELETE FROM author_follows WHERE author_id = ${AUTHOR.id}`;
    await sql`DELETE FROM universe_follows WHERE universe_id = ${UNIVERSE.id}`;
    await sql`DELETE FROM shelf_follows WHERE shelf_id = ${SHELF.id}`;
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, ${SERIES.id}, 'tracking')`;
    await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${E2E_USER}, ${AUTHOR.id}, 'reading')`;
  });
});

const follows = () => withSql((sql) => sql`
  SELECT 'series' AS kind, state FROM series_follows WHERE series_id = ${SERIES.id}
  UNION ALL SELECT 'author', state FROM author_follows WHERE author_id = ${AUTHOR.id}
  UNION ALL SELECT 'universe', state FROM universe_follows WHERE universe_id = ${UNIVERSE.id}
  UNION ALL SELECT 'shelf', state FROM shelf_follows WHERE shelf_id = ${SHELF.id}
  ORDER BY 1`).then((rows) => Object.fromEntries(rows.map((r) => [r.kind, r.state])));

const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });
const toast = (page: Page) => page.locator(".toast");

async function openLibrary(page: Page) {
  await page.goto("/books/list?q=E2E%20Fo");
  await expect(bookRow(page, TWO.title)).toHaveCount(1);
}

async function openFollow(page: Page, title = TWO.title) {
  const more = page.getByRole("button", { name: `More for ${title}` });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Follow…" }).click();
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("radiogroup").first()).toBeVisible();
  return { more, sheet };
}

/** Each option and chip at least `min` px tall and wide (the UX floor; 44 in the toast). */
async function atLeast(locators: import("@playwright/test").Locator, min: number) {
  for (const box of await locators.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(min);
    expect(box.width).toBeGreaterThanOrEqual(min);
  }
}

test("Follow… opens a sheet headed by the title, each grouping checked as stored with its read / total (AC-3, AC-5)", async ({ page }, info) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page);
  const groups = sheet.getByRole("radiogroup");
  await expect(groups).toHaveCount(4);
  for (const [i, name] of [SERIES.name, AUTHOR.name, UNIVERSE.name, SHELF.name].entries()) {
    await expect(groups.nth(i)).toHaveAccessibleName(`Following ${name}`);
  }
  const checked = (i: number) => groups.nth(i).locator("input:checked").locator("..");
  await expect(checked(0)).toHaveText("Tracking");
  await expect(checked(1)).toHaveText("Reading");
  await expect(checked(2)).toHaveText("Not following");
  await expect(checked(3)).toHaveText("Not following");
  // read / total from the progress views: the series' stated 4, the author's 5 listed, the shelf's 2.
  await expect(sheet.locator(".follow-count")).toHaveText(["1 / 4", "1 / 5", "1 / 4", "0 / 2"]);

  await atLeast(sheet.locator(".opts .opt"), 24);
  // Nothing red: the checked option is --brand, never --danger.
  const { backgroundColor } = await computedStyle(checked(2), ["backgroundColor"]);
  expect(backgroundColor).not.toBe(await tokenColour(page, "--danger"));

  // Tab stays inside the sheet.
  for (let i = 0; i < 16; i++) await page.keyboard.press("Tab");
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "follow-sheet");
});

test("a book with no series lists no series row", async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page, LOOSE.title);
  await expect(sheet.getByRole("radiogroup")).toHaveCount(1);
  await expect(sheet.getByRole("radiogroup")).toHaveAccessibleName(`Following ${AUTHOR.name}`);
});

test("Esc, Back and Close each close the sheet and return focus to the row's ⋯ (AC-3)", async ({ page }) => {
  await openLibrary(page);
  let { more, sheet } = await openFollow(page);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();

  ({ more, sheet } = await openFollow(page));
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(page).toHaveURL(/\/books\/list\?q=E2E/);

  ({ more, sheet } = await openFollow(page));
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
});

test("a change saves at once, and its Undo, live over the sheet, puts back the earlier state (AC-1, AC-2)", async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page);
  const universe = sheet.getByRole("radiogroup", { name: `Following ${UNIVERSE.name}` });
  await universe.getByText("Reading").click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`Reading ${UNIVERSE.name}`);
  await expect.poll(follows).toMatchObject({ universe: "reading" });

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await follows()).universe).toBeUndefined();
  await expect(universe.locator("input:checked").locator("..")).toHaveText("Not following");
  await expect(sheet).toBeVisible();
});

test("the finish offers Keep going? chips, reached by F6 and Tab; a chip writes Reading and its Undo leaves the finish (AC-1, AC-4, AC-5)", async ({ page }, info) => {
  await openLibrary(page);
  const row = bookRow(page, TWO.title);
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  await row.getByRole("group", { name: `Status of ${TWO.title}` }).getByRole("button", { name: "Read", exact: true }).click();
  await row.getByRole("button", { name: "Save" }).click();

  const offer = toast(page).getByRole("group", { name: "Keep going?" });
  // The author is already Reading: not offered. The series is only Tracking: offered.
  await expect(offer.getByRole("button")).toHaveText([`${SERIES.name} · series`, UNIVERSE.name, `${SHELF.name} · shelf`]);
  await toastSettled(page);
  await atLeast(offer.getByRole("button"), 44);
  const { borderTopColor } = await computedStyle(offer.getByRole("button").first(), ["borderTopColor"]);
  // Following isn't reading, and nothing here is red.
  expect(borderTopColor).not.toBe(await tokenColour(page, "--ready"));
  expect(borderTopColor).not.toBe(await tokenColour(page, "--danger"));
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "finish-offer");

  // By keyboard: F6 into the toast (Undo), Tab to the first chip, Enter takes it.
  await page.keyboard.press("F6");
  await expect(toast(page).getByRole("button", { name: "Undo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(offer.getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toast(page).locator(".toast-label")).toHaveText(`Reading ${SERIES.name}`);
  await expect.poll(follows).toMatchObject({ series: "reading" });
  // Focus stays in the toast, on the first chip left.
  await expect(offer.getByRole("button").first()).toBeFocused();
  await expect(offer.getByRole("button").first()).toHaveText(UNIVERSE.name);

  // The chip's Undo puts the follow back to Tracking; the finish stays.
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(follows).toMatchObject({ series: "tracking" });
  const status = await withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${TWO.id}`);
  expect(status[0].status).toBe("read");
});
