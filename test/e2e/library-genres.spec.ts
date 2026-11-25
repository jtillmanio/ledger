// @area: books
// Task 4.5 (D-98, AC-2, AC-3, AC-6): the Library's genre chips are Calibre's top-level genres, read
// through book_genre_tree, in a browser. A chip finds a book tagged only with a subgenre of it, the row
// names that subgenre, and the chips are real named links, 44px on the phone, in one row that scrolls
// sideways without the page scrolling. The books are made here under E2E genre names the rest of the
// suite doesn't use, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "landmark-unique", "duplicate-id-aria", "target-size",
];

/** Twelve top-level genres, enough to run past a 360px row; Alpha's two books are tagged below it only. */
const WORDS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima"];
const BOOKS = [
  ...WORDS.slice(1).map((w) => ({ id: `e2e-gen-${w.toLowerCase()}`, title: `E2E Gen ${w} book`, genres: [`E2E Gen ${w}`] })),
  { id: "e2e-gen-sub", title: "E2E Gen Subgenre only", genres: ["E2E Gen Alpha.E2E Gen Epic"] },
  { id: "e2e-gen-deep", title: "E2E Gen Deeper only", genres: ["E2E Gen Alpha.E2E Gen Epic.E2E Gen Dragons"] },
];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Their genres and statuses first: book_genres and book_status reference the book.
const clean = () => withSql(async (sql) => {
  const ids = BOOKS.map((b) => b.id);
  await sql`DELETE FROM book_genres WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM book_status WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${ids}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      for (const g of b.genres) await sql`INSERT INTO book_genres (book_id, genre) VALUES (${b.id}, ${g})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
  });
});
test.afterAll(clean);

const genres = (page: Page) => page.getByRole("group", { name: "Genre" });
const chip = (page: Page, name: string) => genres(page).getByRole("link", { name, exact: true });

async function open(page: Page, path = "/books/list") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(chip(page, "E2E Gen Alpha")).toBeVisible();
}

test("a top-level chip lists the books tagged only with its subgenres, each row naming its own (AC-2, AC-3)", async ({ page }) => {
  await open(page);
  await chip(page, "E2E Gen Alpha").click();
  await expect(page).toHaveURL(/genre=E2E(\+|%20)Gen(\+|%20)Alpha/);
  await expect(chip(page, "E2E Gen Alpha")).toHaveAttribute("aria-current", "true");
  const rows = page.locator(".book-row");
  await expect(rows.locator(".row-title")).toHaveText(["E2E Gen Deeper only", "E2E Gen Subgenre only"]);
  // The deepest path's last segment.
  await expect(rows.filter({ hasText: "E2E Gen Subgenre only" }).locator(".row-sub")).toHaveText("E2E Gen Epic");
  await expect(rows.filter({ hasText: "E2E Gen Deeper only" }).locator(".row-sub")).toHaveText("E2E Gen Dragons");

  // A deeper path, from the URL: the subgenre's books, not its parent's others.
  await page.goto("/books/list?genre=E2E%20Gen%20Alpha.E2E%20Gen%20Epic.E2E%20Gen%20Dragons");
  await expect(page.locator(".book-row .row-title")).toHaveText(["E2E Gen Deeper only"]);
});

test("the genre chips are named links in one row that scrolls sideways, never the page; none under 24px, 44px on the phone (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  const width = page.viewportSize()!.width;
  const links = genres(page).getByRole("link");
  // Each of ours, by its full name (a top-level chip's text is its whole path).
  for (const w of WORDS) await expect(chip(page, `E2E Gen ${w}`)).toHaveCount(1);
  const floor = width < 768 ? 44 : 24;
  for (const box of await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height, `chip height at ${width}px`).toBeGreaterThanOrEqual(floor);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  // One line: every chip on the first chip's row.
  const tops = await links.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size, "chip rows").toBe(1);
  if (width < 768) {
    // On the phone the row runs past its box and scrolls itself.
    const row = await genres(page).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflow: getComputedStyle(el).overflowX }));
    expect(row.scroll).toBeGreaterThan(row.client);
    expect(row.overflow).toBe("auto");
  }
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "library-genres");
});

// Task 6.24 (TASK-145, MR-D20, frame E7, AC-1, AC-2): Owned and Sort are two dropdown chips on one row, above the
// genre row, each naming its choice; nothing scrolls sideways. Sets its own viewports and themes: runs once.
test("the Owned and Sort dropdown chips share one row above the genre row at every width, light and dark, and nothing scrolls sideways (AC-1, AC-2, AC-5)", ONCE, async ({ page }, info) => {
  const owned = page.getByRole("button", { name: /^Owned: / });
  const sort = page.getByRole("button", { name: /^Sort: / });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, "/books/list?genre=E2E%20Gen%20Alpha");
      const label = `${width}px ${colorScheme}`;
      await expect(owned).toHaveText("Owned: Any");
      await expect(sort).toHaveText("Sort: Series");
      // One row: the chips' boxes share a top edge, and the genre row is below it.
      const [o, s, g] = await Promise.all([owned.boundingBox(), sort.boundingBox(), genres(page).boundingBox()]);
      expect(o!.y, `chip tops at ${label}`).toBe(s!.y);
      expect(g!.y, `genre row under the chips at ${label}`).toBeGreaterThanOrEqual(o!.y + o!.height);
      // The chips are in the "More filters" group, which comes before the genres in the page.
      const order = await page.locator("main > .filters:not([role=search])").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
      expect(order.slice(-2)).toEqual(["More filters", "Genre"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scrollWidth at ${label}`).toBe(width);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), label).toEqual([]);
      await screenshot(page, info, `library-dropdowns-${width}-${colorScheme}`);

      // Each opens within the screen, and the page still doesn't scroll sideways.
      for (const [chip, group] of [[owned, "Owned"], [sort, "Sort"]] as const) {
        await hydrated(chip);
        await chip.click();
        const box = (await page.getByRole("group", { name: group, exact: true }).boundingBox())!;
        expect(box.x, `${group} list at ${label}`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${group} list at ${label}`).toBeLessThanOrEqual(width);
        await expectNoHorizontalScroll(page);
        expect(await contrastFailures(page), `${group} open at ${label}`).toEqual([]);
        await screenshot(page, info, `library-dropdowns-${group.toLowerCase()}-${width}-${colorScheme}`);
        await page.keyboard.press("Escape");
      }
    }
  }
});

// Sets its own viewports and themes: runs once, in w390-light.
test("the genre row at 360, 834 and 1280px, light and dark: no sideways page scroll (AC-6)", ONCE, async ({ page }, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, "/books/list?genre=E2E%20Gen%20Alpha");
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `library-genres-${width}-${colorScheme}`);
    }
  }
});
