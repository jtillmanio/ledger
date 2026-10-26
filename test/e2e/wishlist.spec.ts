// Task 1.4d: the wishlist review in a real browser (AC-3, AC-4), at every width,
// light and dark: one table per genre in the sheet's order, glyph and text on
// every line, named radiogroups, Dismiss that isn't red, no sideways scroll, no
// axe violation and no failing contrast; then Apply, which writes, and the
// empty slate. This file seeds its own lines and removes everything it makes.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order", "label",
];
const AUTHOR = "e2e-wish-author";
const LINES: [string, string][] = [
  ["Fantasy", "E2E Wish Saga - E2E Wish Author"],
  ["Fantasy", "E2E Wish One - E2E Wish Author"],
  ["Fantasy", "E2E Wish Classic"],
  ["Sci-Fi", "E2E Wish Two — E2E Wish Author"],
];

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

async function clean() {
  await db(async (sql) => {
    await sql`DELETE FROM wishlist WHERE genre IN ('Fantasy', 'Sci-Fi')`;
    await sql`DELETE FROM books WHERE author_id = ${AUTHOR}`;
    await sql`DELETE FROM authors WHERE id = ${AUTHOR}`;
  });
}

test.beforeAll(async () => {
  await clean();
  await db(async (sql) => {
    for (const [genre, raw] of LINES) await sql`INSERT INTO wishlist (genre, raw_entry) VALUES (${genre}, ${raw})`;
  });
});

test.afterAll(clean);

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

async function open(page: Page) {
  await page.goto("/books/add?from=wishlist");
  await expect(page.getByRole("heading", { level: 1, name: "Your wishlist" })).toBeVisible();
}

test("one table per genre in the sheet's order, with glyph and text on every line (AC-4)", async ({ page }, info) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Fantasy3 lines", "Sci-Fi1 line"]);
  await expect(page.locator(".review .vl")).toHaveText([
    "E2E Wish Saga - E2E Wish Author", "E2E Wish One - E2E Wish Author", "E2E Wish Classic", "E2E Wish Two - E2E Wish Author",
  ]);
  await expect(page.locator(".review .vcheck")).toHaveText(["series?", "new", "new", "new"]);
  // The line with no author is held until someone decides; the rest default to a creation.
  await expect(page.locator(".review .vd")).toHaveText(["!", "✓", "!", "✓"]);
  await expect(page.getByRole("img", { name: "Needs a choice" })).toHaveCount(2);
  for (const group of await page.getByRole("radiogroup").all()) await expect(group).toHaveAccessibleName(/^Decision, line \d+$/);
  // Dismiss removes a staging line, not a book: it is never the red choice.
  await expect(page.getByText("Dismiss", { exact: true })).toHaveCount(4);
  await expect(page.locator("label.opt.no")).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "wishlist-review");
});

test("an edited line is asked about again before Apply (AC-2)", async ({ page }) => {
  await open(page);
  const edit = page.getByRole("button", { name: /^Edit line \d+: E2E Wish Classic/ });
  await hydrated(edit);
  await edit.click();
  await page.getByRole("textbox", { name: /^Line text/ }).fill("E2E Wish Three - E2E Wish Author");
  await page.getByRole("button", { name: "Save line" }).click();
  await expect(page.getByRole("button", { name: "Apply" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#wl-reason")).toHaveText("Check 1 line first");
  await page.getByRole("button", { name: "Check 1 line" }).click();
  await expect(page.locator(".review .vcheck").nth(2)).toHaveText("new");
  await expect(page.locator("#wl-reason")).toHaveCount(0);
});

test("Apply writes, and with nothing left the slate has one way back (AC-1, AC-3)", ONCE, async ({ page }, info) => {
  await open(page);
  const apply = page.getByRole("button", { name: "Apply" });
  await hydrated(apply);
  // Dismiss the series and the line with no author; the other two become books.
  await page.getByRole("radiogroup", { name: /^Decision, line/ }).nth(0).getByLabel("Dismiss").check();
  await page.getByRole("radiogroup", { name: /^Decision, line/ }).nth(2).getByLabel("Dismiss").check();
  await apply.click();
  await expect(page.locator(".slate")).toContainText("Nothing is left on your wishlist.");
  await expect(page.locator(".slate .btn")).toHaveCount(1);
  await expect(page.locator(".slate a.btn")).toHaveAttribute("href", "/books/add");
  await expect(page.locator(".review-status")).toHaveText("2 books created at Someday · 2 lines dismissed.");
  await floor(page);
  await screenshot(page, info, "wishlist-empty");

  const rows = await db(async (sql) => ({
    books: (await sql`SELECT b.id, s.status, (SELECT count(*) FROM reading_plan p WHERE p.book_id = b.id)::int AS plan
                      FROM books b JOIN book_status s ON s.book_id = b.id AND s.user_id = ${E2E_USER}
                      WHERE b.author_id = ${AUTHOR} ORDER BY b.id`),
    wishlist: (await sql`SELECT raw_entry, book_id IS NOT NULL AS linked FROM wishlist ORDER BY id`),
  }));
  expect(rows.books.map((b) => [b.status, b.plan])).toEqual([["to_read", 0], ["to_read", 0]]);
  expect(rows.wishlist).toEqual([
    { raw_entry: "E2E Wish One - E2E Wish Author", linked: true },
    { raw_entry: "E2E Wish Two — E2E Wish Author", linked: true },
  ]);
  // Reloading doesn't bring a line back.
  await page.reload();
  await expect(page.locator(".slate")).toContainText("Nothing is left on your wishlist.");
});
