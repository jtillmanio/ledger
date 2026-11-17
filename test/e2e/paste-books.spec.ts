// Task 1.4e: Paste a list's title and author cells in a real browser (AC-1, AC-6),
// at every width, light and dark: two pasted columns draw as named Title and
// Author inputs, a line with no author gets its author typed into its cell (the
// reason goes, the line is asked again and adds with that author), no sideways
// scroll, no axe violation, no failing contrast. Task 5.17 (3 of 3): *Physical
// copy* in Add to, the confirm naming it, and a paste of two books you have and
// one you don't, written and undone in one. This file removes what it makes.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

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

/** Task 5.17: two books the library has (one Reading, one with no status), pasted with one it doesn't. */
const OWN_AUTHOR = "E2E Own Author";
const OWN_HAVE: [id: string, title: string, status: string | null][] = [
  ["e2e-own-marigold-lighthouse-e2e-own-author", "E2E Own Marigold Lighthouse", "reading"],
  ["e2e-own-cobalt-orchard-e2e-own-author", "E2E Own Cobalt Orchard", null],
];
const OWN_PASTE = ["E2E Own Marigold Lighthouse - E2E Own Author", "E2E Own Cobalt Orchard - E2E Own Author", "E2E Own Quiet Harbor Winter - E2E Own Author"].join("\n");

async function clean() {
  const sql: TestSql = testSql();
  try {
    await sql`DELETE FROM books WHERE title LIKE 'E2E Paste%' OR title LIKE 'E2E Own%'`;
    await sql`DELETE FROM authors WHERE name IN (${AUTHOR}, ${OWN_AUTHOR})`;
    await sql`INSERT INTO authors (id, name) VALUES ('e2e-own-author', ${OWN_AUTHOR})`;
    for (const [id, title, status] of OWN_HAVE) {
      await sql`INSERT INTO books (id, title, author_id) VALUES (${id}, ${title}, 'e2e-own-author')`;
      if (status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id}, ${status})`;
    }
  } finally {
    await sql.end();
  }
}

async function removeAll() {
  const sql: TestSql = testSql();
  try {
    await sql`DELETE FROM books WHERE title LIKE 'E2E Paste%' OR title LIKE 'E2E Own%'`;
    await sql`DELETE FROM authors WHERE name IN (${AUTHOR}, ${OWN_AUTHOR})`;
  } finally {
    await sql.end();
  }
}

test.beforeAll(clean);
test.afterAll(removeAll);

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

test("two pasted columns are Title and Author cells with names, the no-author reason tied to its cell (AC-1, AC-6)", FLOOR, async ({ page }, info) => {
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
  // The sticky action bar rides over whatever is scrolled under it: put the review in the middle, as a reader would.
  await page.getByRole("textbox", { name: "Title, line 2" }).evaluate((el) => el.scrollIntoView({ block: "center" }));
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

/** Task 5.17: Add books on Paste a list, *Physical copy* chosen, the three lines pasted and checked. */
async function pasteOwned(page: Page) {
  await page.goto("/books/add");
  const paste = page.getByRole("group", { name: "Add by" }).getByRole("button", { name: "Paste a list" });
  await hydrated(paste);
  await paste.click();
  const addTo = page.getByRole("group", { name: "Add to" });
  await expect(addTo.getByRole("button", { name: "Audiobook" })).toHaveAttribute("aria-pressed", "false");
  await addTo.getByRole("button", { name: "Physical copy" }).click();
  await expect(addTo.getByRole("button", { name: "Physical copy" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: /^One book per line/ }).fill(OWN_PASTE);
  await page.getByRole("button", { name: "Check 3 lines" }).click();
  await expect(page.locator(".review .vcheck")).toHaveText(["in library", "in library", "new"]);
}

test("Physical copy is a named, pressed choice and the confirm names it, at the UX floor (task 5.17, AC-5)", FLOOR, async ({ page }, info) => {
  await pasteOwned(page);
  await expect(page.locator(".review .vm")).toContainText([
    "In your library: marks it as owned on paper.", "In your library: marks it as owned on paper.", "New: creates the book, Unlisted.",
  ]);
  await expect(page.getByRole("button", { name: "Add 3 books to Physical copy" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "paste-owned");
});

test("three lines to Physical copy, two matched and one new, write three rows and one unlisted book; one Undo removes all of it (task 5.17, AC-1)", ONCE, async ({ page }, info) => {
  await pasteOwned(page);
  for (const [width, height] of [[360, 780], [1280, 800]]) {
    await page.setViewportSize({ width, height });
    await expectNoHorizontalScroll(page);
    await screenshot(page, info, `paste-owned-${width}`);
  }
  await page.getByRole("button", { name: "Add 3 books to Physical copy" }).click();
  await page.waitForURL(/\/books\/list\?owned=physical/);
  await expect(page.locator(".toast-region .toast-label")).toHaveText("3 books added to Physical copy");

  const sql: TestSql = testSql();
  try {
    const rows = async () => (await sql<{ title: string; format: string; status: string | null; deleted: boolean }[]>`
      SELECT b.title, oc.format, s.status, b.deleted_at IS NOT NULL AS deleted
      FROM books b LEFT JOIN owned_copies oc ON oc.book_id = b.id
      LEFT JOIN book_status s ON s.book_id = b.id AND s.user_id = ${E2E_USER}
      WHERE b.title LIKE 'E2E Own%' ORDER BY b.title`)
      .map((r) => [r.title, r.format, r.status, r.deleted]);
    expect(await rows()).toEqual([
      ["E2E Own Cobalt Orchard", "physical", null, false],
      ["E2E Own Marigold Lighthouse", "physical", "reading", false],
      ["E2E Own Quiet Harbor Winter", "physical", "unlisted", false],
    ]);
    // The Library's Physical filter lists all three, the new one Unlisted (D-152).
    for (const title of ["E2E Own Cobalt Orchard", "E2E Own Marigold Lighthouse", "E2E Own Quiet Harbor Winter"]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }
    await screenshot(page, info, "paste-owned-library");

    await page.locator(".toast-region").getByRole("button", { name: "Undo" }).click();
    await expect.poll(rows).toEqual([
      ["E2E Own Cobalt Orchard", null, null, false],
      ["E2E Own Marigold Lighthouse", null, "reading", false],
      ["E2E Own Quiet Harbor Winter", null, null, true],
    ]);
  } finally {
    await sql.end();
  }
});
