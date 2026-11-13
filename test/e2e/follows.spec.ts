// Task 2.2c (D-108, D-116): following what you read, in a real browser, at
// every width, light and dark (AC-1, AC-3, AC-4, AC-5). A Library row's ⋯ has
// *Follow…*, which opens a sheet headed by the book's title listing its series,
// subseries, author, universe and shelf, each a radiogroup checked as stored
// with its read / total; a change saves with an Undo live over the sheet.
// Finishing a book offers *Keep going?* chips in its toast, reached by keyboard
// (F6, Tab, Enter); a chip writes Reading, and its Undo leaves the finish.
// Task 2.2h (D-117, D-118): a finish from Reading follows the series, subseries
// and universe itself, and the toast's *Now reading* row has a chip each that
// turns that one off; the finish's Undo restores every follow; the middle
// option reads *On hold* on something part-read. The books are made here,
// under E2E ids the rest of the suite doesn't use, and removed after the last
// test; each test starts from the same rows.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot,
  toastSettled, tokenColour,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-fo-author", name: "E2E Fo Author" };
const UNIVERSE = { id: "e2e-fo-uni", name: "E2E Fo Universe" };
const SERIES = { id: "e2e-fo-series", name: "E2E Fo Series" };
const SUBSERIES = { id: "e2e-fo-era", name: "E2E Fo Era" };
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
  await sql`DELETE FROM book_subseries WHERE id = ${SUBSERIES.id}`;
  await sql`DELETE FROM book_series WHERE id = ${SERIES.id}`;
  await sql`DELETE FROM book_universes WHERE id = ${UNIVERSE.id}`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

// Books One to Three are the subseries (task 2.2h); Four isn't in it.
test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${UNIVERSE.id}, ${UNIVERSE.name})`;
    await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${SERIES.id}, ${SERIES.name}, ${AUTHOR.id}, 4)`;
    await sql`INSERT INTO book_subseries (id, name, series_id) VALUES (${SUBSERIES.id}, ${SUBSERIES.name}, ${SERIES.id})`;
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, author_id, series_id, series_position, universe_id, subseries_id)
                VALUES (${b.id}, ${b.title}, ${AUTHOR.id}, ${SERIES.id}, ${b.n}, ${UNIVERSE.id},
                        ${b.n < 4 ? SUBSERIES.id : null})`;
    }
    await sql`INSERT INTO books (id, title, author_id) VALUES (${LOOSE.id}, ${LOOSE.title}, ${AUTHOR.id})`;
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${SHELF.id}, ${SHELF.name}, ${E2E_USER}, 'books')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${SHELF.id}, ${BOOKS[1].id}, 1), (${SHELF.id}, ${BOOKS[2].id}, 2)`;
  });
});
test.afterAll(clean);

// Book One read; the rest to read; Series Tracking and Author Reading; nothing else followed.
test.beforeEach(async () => {
  await withSql(async (sql) => {
    await sql`UPDATE book_series SET name = ${SERIES.name} WHERE id = ${SERIES.id}`;
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
    await sql`DELETE FROM subseries_follows WHERE subseries_id = ${SUBSERIES.id}`;
    await sql`DELETE FROM author_follows WHERE author_id = ${AUTHOR.id}`;
    await sql`DELETE FROM universe_follows WHERE universe_id = ${UNIVERSE.id}`;
    await sql`DELETE FROM shelf_follows WHERE shelf_id = ${SHELF.id}`;
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, ${SERIES.id}, 'tracking')`;
    await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${E2E_USER}, ${AUTHOR.id}, 'reading')`;
  });
});

const follows = () => withSql((sql) => sql`
  SELECT 'series' AS kind, state FROM series_follows WHERE series_id = ${SERIES.id}
  UNION ALL SELECT 'subseries', state FROM subseries_follows WHERE subseries_id = ${SUBSERIES.id}
  UNION ALL SELECT 'author', state FROM author_follows WHERE author_id = ${AUTHOR.id}
  UNION ALL SELECT 'universe', state FROM universe_follows WHERE universe_id = ${UNIVERSE.id}
  UNION ALL SELECT 'shelf', state FROM shelf_follows WHERE shelf_id = ${SHELF.id}
  ORDER BY 1`).then((rows) => Object.fromEntries(rows.map((r) => [r.kind, r.state])));
const statusOf = (id: string) =>
  withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`)
    .then((rows) => rows[0]?.status);
const setStatus = (id: string, status: string) =>
  withSql((sql) => sql`UPDATE book_status SET status = ${status}, started_on = ${status === "reading" ? "2026-11-01" : null},
                       started_on_precision = ${status === "reading" ? "exact" : "none"}
                       WHERE user_id = ${E2E_USER} AND book_id = ${id}`);

const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });
const toast = (page: Page) => page.locator(".toast");
const nowRow = (page: Page) => toast(page).getByRole("group", { name: "Now reading" });
const keepRow = (page: Page) => toast(page).getByRole("group", { name: "Keep going?" });

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

/** Sets Book Two to Read from its Library row's status control. */
async function finishInLibrary(page: Page, title = TWO.title) {
  const row = bookRow(page, title);
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  await row.getByRole("group", { name: `Status of ${title}` }).getByRole("button", { name: "Read", exact: true }).click();
  await row.getByRole("button", { name: "Save" }).click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`${title}: read`);
}

/** Each option and chip at least `min` px tall and wide (the UX floor; 44 in the toast). */
async function atLeast(locators: Locator, min: number) {
  for (const box of await locators.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(min);
    expect(box.width).toBeGreaterThanOrEqual(min);
  }
}

test("Follow… opens a sheet headed by the title, each grouping checked as stored with its read / total (AC-3, AC-5; 2.2h AC-5)", async ({ page }, info) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page);
  const groups = sheet.getByRole("radiogroup");
  await expect(groups).toHaveCount(5);
  for (const [i, name] of [SERIES.name, SUBSERIES.name, AUTHOR.name, UNIVERSE.name, SHELF.name].entries()) {
    await expect(groups.nth(i)).toHaveAccessibleName(`Following ${name}`);
  }
  const checked = (i: number) => groups.nth(i).locator("input:checked").locator("..");
  // The series is Tracking with 1 of 4 read: part-read, so its middle option reads On hold (D-118).
  await expect(checked(0)).toHaveText("On hold");
  await expect(checked(1)).toHaveText("Not following");
  await expect(checked(2)).toHaveText("Reading");
  await expect(checked(3)).toHaveText("Not following");
  await expect(checked(4)).toHaveText("Not following");
  // read / total from the progress views: the series' stated 4, the subseries' 3, the author's 5 listed, the shelf's 2.
  await expect(sheet.locator(".follow-count")).toHaveText(["1 / 4", "1 / 3", "1 / 5", "1 / 4", "0 / 2"]);

  await atLeast(sheet.locator(".opts .opt"), 24);
  // Nothing red: the checked option is --brand, never --danger.
  const { backgroundColor } = await computedStyle(checked(3), ["backgroundColor"]);
  expect(backgroundColor).not.toBe(await tokenColour(page, "--danger"));

  // Tab stays inside the sheet.
  for (let i = 0; i < 20; i++) await page.keyboard.press("Tab");
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "follow-sheet");
});

test("the middle option reads On hold at 1 of 4 read and Tracking at 0 of 4 and 4 of 4, tracking stored each time (2.2h AC-5)", CORE, async ({ page }) => {
  const series = async () => {
    await openLibrary(page);
    const { sheet } = await openFollow(page);
    const group = sheet.getByRole("radiogroup", { name: `Following ${SERIES.name}` });
    const middle = group.locator(".opt").nth(1);
    return { sheet, group, middle };
  };
  const first = await series();
  let { middle } = first;
  await expect(middle).toHaveText("On hold");
  await expect(first.group.locator("input:checked").locator("..")).toHaveText("On hold");
  expect((await follows()).series).toBe("tracking");

  // 0 of 4: Book One back to To read.
  await setStatus(BOOKS[0].id, "to_read");
  ({ middle } = await series());
  await expect(middle).toHaveText("Tracking");
  expect((await follows()).series).toBe("tracking");

  // 4 of 4: every book read.
  for (const b of BOOKS) await setStatus(b.id, "read");
  ({ middle } = await series());
  await expect(middle).toHaveText("Tracking");
  expect((await follows()).series).toBe("tracking");
});

test("a book with no series lists no series or subseries row", CORE, async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page, LOOSE.title);
  await expect(sheet.getByRole("radiogroup")).toHaveCount(1);
  await expect(sheet.getByRole("radiogroup")).toHaveAccessibleName(`Following ${AUTHOR.name}`);
});

test("Esc, Back and Close each close the sheet and return focus to the row's ⋯ (AC-3)", CORE, async ({ page }) => {
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

test("a change saves at once, and its Undo, live over the sheet, puts back the earlier state (AC-1, AC-2)", CORE, async ({ page }) => {
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

test("Not following on a series is kept as off and shows as Not following; on the author it deletes the row (2.2h AC-4)", CORE, async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openFollow(page);
  await sheet.getByRole("radiogroup", { name: `Following ${SERIES.name}` }).getByText("Not following").click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`Not following ${SERIES.name}`);
  await expect.poll(async () => (await follows()).series).toBe("off");
  await sheet.getByRole("radiogroup", { name: `Following ${AUTHOR.name}` }).getByText("Not following").click();
  await expect.poll(async () => (await follows()).author).toBeUndefined();
  // Its Undo puts the row back at reading.
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await follows()).author).toBe("reading");
});

test("a past read logged from To read follows nothing and offers Keep going? chips, reached by F6 and Tab; a chip writes Reading and its Undo leaves the finish (AC-1, AC-4, AC-5; 2.2h)", async ({ page }, info) => {
  await openLibrary(page);
  await finishInLibrary(page);

  // The author is already Reading: not offered. The series is only Tracking: offered.
  await expect(keepRow(page).getByRole("button"))
    .toHaveText([`${SERIES.name} · series`, `${SUBSERIES.name} · subseries`, UNIVERSE.name, `${SHELF.name} · shelf`]);
  await expect(nowRow(page)).toHaveCount(0);
  expect(await follows()).toEqual({ series: "tracking", author: "reading" });
  await toastSettled(page);
  await atLeast(keepRow(page).getByRole("button"), 44);
  const { borderTopColor } = await computedStyle(keepRow(page).getByRole("button").first(), ["borderTopColor"]);
  // Following isn't reading, and nothing here is red.
  expect(borderTopColor).not.toBe(await tokenColour(page, "--ready"));
  expect(borderTopColor).not.toBe(await tokenColour(page, "--danger"));
  // The toast and its chips; the page behind it is checked with the sheet's test.
  await expectNoAxeViolations(page, AXE, ".toast-region");
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "finish-offer");

  // By keyboard: F6 into the toast (Undo), Tab to the first chip, Enter takes it.
  await page.keyboard.press("F6");
  await expect(toast(page).getByRole("button", { name: "Undo" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(keepRow(page).getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(toast(page).locator(".toast-label")).toHaveText(`Reading ${SERIES.name}`);
  await expect.poll(follows).toMatchObject({ series: "reading" });
  // Focus stays in the toast, on the first chip left.
  await expect(keepRow(page).getByRole("button").first()).toBeFocused();
  await expect(keepRow(page).getByRole("button").first()).toHaveText(`${SUBSERIES.name} · subseries`);

  // The chip's Undo puts the follow back to Tracking; the finish stays.
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(follows).toMatchObject({ series: "tracking" });
  expect(await statusOf(TWO.id)).toBe("read");
});

test.describe("a finish from Reading follows (2.2h)", () => {
  test.beforeEach(() => setStatus(TWO.id, "reading"));

  test("the toast says Now reading, a chip each, reached by F6 and Tab; a chip turns one off and its Undo restores reading (AC-1, AC-3, AC-6)", async ({ page }, info) => {
    await openLibrary(page);
    await finishInLibrary(page);
    await expect.poll(follows).toEqual({ series: "reading", subseries: "reading", universe: "reading", author: "reading" });
    // One chip each, named Stop following; Keep going? keeps the shelf (the author is Reading already).
    await expect(nowRow(page).getByRole("button")).toHaveText([
      `${SERIES.name} · series ×`, `${SUBSERIES.name} · subseries ×`, `${UNIVERSE.name} ×`,
    ].map((t) => `Stop following ${t}`));
    await expect(nowRow(page).getByRole("button").first()).toHaveAccessibleName(`Stop following ${SERIES.name} · series`);
    await expect(keepRow(page).getByRole("button")).toHaveText([`${SHELF.name} · shelf`]);
    await toastSettled(page);
    await atLeast(toast(page).locator(".toast-chip"), 44);
    for (const chip of await nowRow(page).getByRole("button").all()) {
      const { borderTopColor } = await computedStyle(chip, ["borderTopColor"]);
      expect(borderTopColor).not.toBe(await tokenColour(page, "--danger"));
      expect(borderTopColor).not.toBe(await tokenColour(page, "--ready"));
    }
    await expectNoAxeViolations(page, AXE, ".toast-region");
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "finish-now-reading");

    // F6 into the toast, Tab to the first Now reading chip, Enter turns the series off.
    await page.keyboard.press("F6");
    await expect(toast(page).getByRole("button", { name: "Undo" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nowRow(page).getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(toast(page).locator(".toast-label")).toHaveText(`Not following ${SERIES.name}`);
    await expect(toast(page).locator(".toast-detail")).toHaveText("series · was reading");
    await expect.poll(follows).toEqual({ series: "off", subseries: "reading", universe: "reading", author: "reading" });
    // The chips left ride along, focus on the first.
    await expect(nowRow(page).getByRole("button").first()).toBeFocused();
    await expect(nowRow(page).getByRole("button")).toHaveCount(2);
    await expect(keepRow(page).getByRole("button")).toHaveCount(1);

    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(follows).toMatchObject({ series: "reading" });
    expect(await statusOf(TWO.id)).toBe("read");
  });

  test("the finish's Undo restores the book and every follow it changed (AC-3)", CORE, async ({ page }) => {
    await openLibrary(page);
    await finishInLibrary(page);
    await expect(nowRow(page)).toBeVisible();
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(follows).toEqual({ series: "tracking", author: "reading" });
    await expect.poll(() => statusOf(TWO.id)).toBe("reading");
  });

  test("In flight's Finished follows the same, and its toast says so (2.2f's finish)", CORE, async ({ page }) => {
    await page.goto("/books/status");
    const button = page.getByRole("button", { name: `Finished ${TWO.title}`, exact: true });
    await hydrated(button);
    await button.click();
    await expect(nowRow(page).getByRole("button")).toHaveCount(3);
    await expect.poll(follows).toEqual({ series: "reading", subseries: "reading", universe: "reading", author: "reading" });
  });

  test("on the last book left in a Reading series, Done with still shows and writes tracking; nothing else followed, no Now reading (AC-3)", CORE, async ({ page }) => {
    await withSql(async (sql) => {
      await sql`UPDATE series_follows SET state = 'reading' WHERE series_id = ${SERIES.id}`;
      await sql`UPDATE book_status SET status = 'read' WHERE user_id = ${E2E_USER} AND book_id = ANY(${[BOOKS[2].id, BOOKS[3].id]}::text[])`;
    });
    await openLibrary(page);
    await finishInLibrary(page);
    await expect(nowRow(page)).toHaveCount(0);
    await keepRow(page).getByRole("button", { name: `Done with ${SERIES.name}` }).click();
    await expect.poll(async () => (await follows()).series).toBe("tracking");
  });

  test("at 360 the toast fits with a long series name and four chips (AC-6)", async ({ page }, info) => {
    const long = "E2E Fo Series The Stormlight Archive Of Very Long Names Indeed";
    await withSql((sql) => sql`UPDATE book_series SET name = ${long} WHERE id = ${SERIES.id}`);
    await openLibrary(page);
    await finishInLibrary(page);
    await expect(toast(page).locator(".toast-chip")).toHaveCount(4);
    await toastSettled(page);
    const width = page.viewportSize()!.width;
    const box = (await toast(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    for (const chip of await toast(page).locator(".toast-chip").all()) {
      const b = (await chip.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
    }
    await expectNoHorizontalScroll(page);
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "finish-now-reading-long");
  });
});
