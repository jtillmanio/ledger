// Task 5.1, 3 of 3 (TASK-097; D-139, R1-07): *New shelf…* in Add books' *Shelf…* picker, in a real
// browser on the TEST database. The roadmap's **Check (the new-shelf part):** *New shelf…* with a new
// name writes one `shelves` row and one `shelf_books` row; Undo leaves neither; a name already in use
// writes nothing and says why. From the Library's Add books sheet: the toast names the shelf, Shelves
// lists it `0 / 1`, and Undo takes the place and the shelf off the list (AC-2). A name in use is refused
// under the field, which keeps focus, with no row written (AC-3). The UX floor for the control: a
// labelled field, the refusal announced, axe, contrast in both themes, 24px targets, no sideways scroll,
// screenshots (AC-5).
//
// The book, the shelf whose name is taken and the search's empty Hardcover answer are made here, under
// E2E ids no other spec uses, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// Writes, and what it checks doesn't change with the width: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-ns-author", name: "E2E Ns Author" };
const BOOK = { id: "e2e-ns-book", title: "E2E Ns Book" };
const QUERY = "e2e ns book";
/** Hardcover's answer for the query, cached: the search never leaves the machine. */
const CACHE_KEY = `search:${QUERY}`;
const TAKEN = { id: "e2e-ns-dark-tower", name: "E2E Ns Dark Tower" };
const NEW_NAME = "E2E Ns Made Here";

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// A shelf's rows go with it (ON DELETE CASCADE).
const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM shelves WHERE user_id = ${E2E_USER} AND name IN (${TAKEN.name}, ${NEW_NAME})`;
  await sql`DELETE FROM book_status WHERE book_id = ${BOOK.id}`;
  await sql`DELETE FROM books WHERE id = ${BOOK.id}`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
  await sql`DELETE FROM hardcover_cache WHERE key = ${CACHE_KEY}`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    await sql`INSERT INTO books (id, title, author_id) VALUES (${BOOK.id}, ${BOOK.title}, ${AUTHOR.id})`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${BOOK.id}, 'to_read')`;
    await sql`INSERT INTO hardcover_cache (key, body) VALUES (${CACHE_KEY}, ${sql.json({ found: 0, hits: [] })})`;
  });
});
test.afterAll(clean);

// Every test starts with the taken name's shelf, empty, and no shelf of the new name.
test.beforeEach(async () => {
  await withSql(async (sql) => {
    await sql`DELETE FROM shelves WHERE user_id = ${E2E_USER} AND name IN (${TAKEN.name}, ${NEW_NAME})`;
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${TAKEN.id}, ${TAKEN.name}, ${E2E_USER}, 'books')`;
  });
});

/** The shelves called `name`, and the books on them. */
const rows = (name: string) => withSql(async (sql) => ({
  shelves: (await sql<{ id: string }[]>`SELECT id FROM shelves WHERE user_id = ${E2E_USER} AND name = ${name}`).map((r) => r.id),
  placed: (await sql<{ book_id: string }[]>`
    SELECT sb.book_id FROM shelf_books sb JOIN shelves s ON s.id = sb.shelf_id
    WHERE s.user_id = ${E2E_USER} AND s.name = ${name}`).map((r) => r.book_id),
}));
/** Every shelf the book is on. */
const shelvesOfBook = () => withSql(async (sql) =>
  (await sql<{ shelf_id: string }[]>`SELECT shelf_id FROM shelf_books WHERE book_id = ${BOOK.id}`).map((r) => r.shelf_id));

const dialog = (page: Page) => page.getByRole("dialog");
const nameField = (page: Page) => dialog(page).getByRole("textbox", { name: "Shelf name" });
const addButton = (page: Page) => dialog(page).locator(".res-add").first();

/** The Library's Add books sheet, the book found, and *Shelf…* → *New shelf…* with `name` typed. */
async function newShelf(page: Page, name: string) {
  await page.goto("/books/list");
  const open = page.getByRole("button", { name: "Add books" });
  await hydrated(open);
  await open.click();
  const box = dialog(page).getByRole("searchbox", { name: "Title or author" });
  await hydrated(box);
  await box.fill(QUERY);
  await box.press("Enter");
  await expect(addButton(page)).toHaveAccessibleName(`Add to Someday: ${BOOK.title}`);
  await dialog(page).getByRole("button", { name: "Shelf…" }).click();
  const choice = dialog(page).getByRole("group", { name: "Your shelves" }).getByRole("button").last();
  await expect(choice).toHaveText("New shelf…");
  await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
  await expect(nameField(page)).toBeFocused();
  await nameField(page).fill(name);
  await expect(addButton(page)).toHaveAccessibleName(`Add to ${name}: ${BOOK.title}`);
}

test("a new name writes one shelves row and one shelf_books row; the toast names it, Shelves lists it 0 / 1, and Undo leaves neither (AC-1, AC-2)", ONCE, async ({ page, context }) => {
  await newShelf(page, NEW_NAME);
  await addButton(page).click();
  const toast = page.locator(".toast");
  await expect(toast.locator(".toast-label")).toHaveText(`Added to ${NEW_NAME}`);
  // A library result: the book is reused, and the shelf is new.
  await expect(toast.locator(".toast-detail")).toHaveText(`${BOOK.title} · already in your library · new shelf`);
  const made = await rows(NEW_NAME);
  expect(made).toEqual({ shelves: ["e2e-ns-made-here"], placed: [BOOK.id] });
  // Add to is the shelf it made now.
  await expect(dialog(page).getByRole("button", { name: NEW_NAME, pressed: true }).first()).toBeVisible();

  // Hovering holds the toast while Shelves is read in another tab.
  await toast.hover();
  const shelves = await context.newPage();
  await shelves.goto("/books/shelves");
  const row = shelves.locator(".shelf-rows > li").filter({ has: shelves.getByRole("link", { name: NEW_NAME, exact: true }) });
  await expect(row.locator(".rm")).toHaveText("0 / 1");

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => rows(NEW_NAME)).toEqual({ shelves: [], placed: [] });
  expect(await shelvesOfBook()).toEqual([]);
  await shelves.reload();
  await expect(shelves.getByRole("heading", { level: 1 })).toHaveText("Shelves");
  await expect(shelves.getByRole("link", { name: NEW_NAME, exact: true })).toHaveCount(0);
  await shelves.close();
});

test("a name already in use writes nothing and says why under the field, which keeps focus (AC-1, AC-3)", ONCE, async ({ page }) => {
  await newShelf(page, TAKEN.name);
  await addButton(page).click();
  const why = dialog(page).locator("#addto-new-why");
  await expect(why).toHaveText(`! You already have a shelf called ${TAKEN.name}.`);
  await expect(why).toHaveAttribute("role", "alert");
  await expect(nameField(page)).toBeFocused();
  await expect(nameField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(nameField(page)).toHaveAttribute("aria-describedby", "addto-new-why");
  expect(await rows(TAKEN.name)).toEqual({ shelves: [TAKEN.id], placed: [] });
  expect(await shelvesOfBook()).toEqual([]);
  await expect(page.locator(".toast-label")).toHaveCount(0);
  // Typing again clears the reason.
  await nameField(page).press("End");
  await nameField(page).pressSequentially(" 2");
  await expect(why).toHaveCount(0);
});

test("the floor with the field and its refusal: axe, contrast in light and dark, 24px targets, no sideways scroll; screenshots (AC-5)", FLOOR, async ({ page }, info) => {
  await newShelf(page, TAKEN.name);
  await addButton(page).click();
  await expect(dialog(page).locator("#addto-new-why")).toBeVisible();
  // The refusal is written nowhere: this is the floor of the refused state, not a write.
  expect(await rows(TAKEN.name)).toEqual({ shelves: [TAKEN.id], placed: [] });

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // The field's label is visible text, not only a name.
  await expect(dialog(page).locator('label[for="addto-new-name"]')).toBeVisible();
  // Every control in the sheet a real, named button, link or input, at least 24px.
  const small = await dialog(page).evaluate((sheet) => [...sheet.querySelectorAll("a[href], button, input, textarea")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return r.width < 24 || r.height < 24;
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
  // A long shelf name on the result's primary wraps its row: Year or quarter… stays inside the card, unclipped.
  const card = (await dialog(page).locator(".res").first().boundingBox())!;
  for (const button of await dialog(page).locator(".res").first().locator(".res-btns .btn").all()) {
    const box = (await button.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
  }
  await screenshot(page, info, "add-new-shelf-refused");
});
