// Task 1.4e: Paste a list's title and author cells in a real browser (AC-1, AC-6),
// at every width, light and dark: two pasted columns draw as named Title and
// Author inputs, a line with no author gets its author typed into its cell (the
// reason goes, the line is asked again and adds with that author), no sideways
// scroll, no axe violation, no failing contrast. This file removes what it makes.
import { expect, test, type Page } from "@playwright/test";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order", "label",
];
const AUTHOR = "E2E Paste Author";
const PASTE = [
  "E2E Paste One\tE2E Paste Author",
  "E2E Paste - Two\tE2E Paste Author",
  "E2E Paste Three",
].join("\n");

async function clean() {
  const sql: TestSql = testSql();
  try {
    await sql`DELETE FROM books WHERE title LIKE 'E2E Paste%'`;
    await sql`DELETE FROM authors WHERE name = ${AUTHOR}`;
  } finally {
    await sql.end();
  }
}

test.beforeAll(clean);
test.afterAll(clean);

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

/** Open Add books and paste the list; the textarea is filled the way a paste fills it. */
async function paste(page: Page) {
  await page.goto("/books/add");
  const box = page.getByRole("textbox", { name: /^One book per line/ });
  await hydrated(box);
  await box.fill(PASTE);
}

test("two pasted columns are Title and Author cells with names, the no-author reason tied to its cell (AC-1, AC-6)", async ({ page }, info) => {
  await paste(page);
  await expect(page.getByRole("textbox", { name: /^Title, line \d$/ })).toHaveCount(3);
  await expect(page.getByRole("textbox", { name: "Title, line 2" })).toHaveValue("E2E Paste - Two");
  await expect(page.getByRole("textbox", { name: "Author, line 1" })).toHaveValue(AUTHOR);
  const author = page.getByRole("textbox", { name: "Author, line 3" });
  await expect(author).toHaveValue("");
  await expect(author).toHaveAccessibleDescription("No author. Type one in this cell.");
  // Every cell is a target of at least 24px.
  for (const cell of await page.locator(".review input.txt").all()) {
    expect((await cell.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  }
  await floor(page);
  await screenshot(page, info, "paste-cells");
});

test("typing the author clears the reason, asks the line again, and adds it with that author (AC-1)", ONCE, async ({ page }, info) => {
  await paste(page);
  await page.getByRole("button", { name: "Check 3 lines" }).click();
  await expect(page.locator(".review .vcheck")).toHaveText(["new", "new", "new"]);
  const author = page.getByRole("textbox", { name: "Author, line 3" });
  await expect(page.locator("#author-why-3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add 2 books" })).toBeVisible();

  await author.fill(AUTHOR);
  await expect(page.locator("#author-why-3")).toHaveCount(0);
  await expect(author).not.toHaveAttribute("aria-describedby");
  // Only line 3 is asked again.
  await expect(page.locator(".review .vcheck")).toHaveText(["new", "new", "unverified"]);
  await page.getByRole("button", { name: "Check 1 line" }).click();
  await expect(page.locator(".review .vcheck")).toHaveText(["new", "new", "new"]);
  const add = page.getByRole("button", { name: "Add 3 books" });
  await expect(add).toBeVisible();
  await screenshot(page, info, "paste-cells-fixed");
  await add.click();
  await page.waitForURL(/\/books\/list/);

  const sql: TestSql = testSql();
  try {
    const rows = await sql`SELECT b.title, a.name AS author FROM books b JOIN authors a ON a.id = b.author_id
                           WHERE b.title LIKE 'E2E Paste%' ORDER BY b.title`;
    expect(rows.map((r) => [r.title, r.author])).toEqual([
      ["E2E Paste - Two", AUTHOR], ["E2E Paste One", AUTHOR], ["E2E Paste Three", AUTHOR],
    ]);
  } finally {
    await sql.end();
  }
});
