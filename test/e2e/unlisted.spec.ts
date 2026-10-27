// Task 1.21 (D-83, D-86): the master list's Unlisted books in a real browser,
// at every width, light and dark: off *Everything*, on a chip of their own
// whose name carries the count, found by a search; a grey badge that is no
// state colour; *Add to Someday*, a real button, with the UX floor. Then, once,
// the promote: the row leaves the Unlisted list for the empty state, and Undo
// brings it back with focus. The book is test/e2e/global-setup.ts's, put back
// to Unlisted before each test and after the last.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql } from "../db";
import {
  computedStyle, contrastFailures, E2E_UNLISTED_ID, E2E_UNLISTED_TITLE, expectNoAxeViolations, expectNoHorizontalScroll,
  hydrated, screenshot, tokenColour,
} from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order",
];

/** Whatever a test did, the book is Unlisted again, with no plan row. */
async function reset() {
  const sql = testSql();
  try {
    await sql`DELETE FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${E2E_UNLISTED_ID}`;
    await sql`UPDATE book_status SET status = 'unlisted' WHERE user_id = ${E2E_USER} AND book_id = ${E2E_UNLISTED_ID}`;
  } finally {
    await sql.end();
  }
}

test.beforeEach(reset);
test.afterAll(reset);

const titles = (page: Page) => page.locator(".book-row .row-title");
const row = (page: Page) => page.locator(".book-row", { has: page.locator(".row-title", { hasText: E2E_UNLISTED_TITLE }) });
const addToSomeday = (page: Page) => row(page).getByRole("button", { name: "Add to Someday" });

test("Everything leaves it out; the Unlisted chip, named with its count, lists it; a search finds it", async ({ page }) => {
  await page.goto("/books/list");
  await expect(titles(page).first()).toBeVisible();
  await expect(titles(page).filter({ hasText: E2E_UNLISTED_TITLE })).toHaveCount(0);

  const chip = page.getByRole("link", { name: "Unlisted, 1 book" });
  await expect(chip).toHaveAttribute("href", "/books/list?status=unlisted");
  await expect(chip).toHaveText("Unlisted 1");
  await chip.click();
  await expect(page).toHaveURL(/\/books\/list\?status=unlisted$/);
  await expect(titles(page)).toHaveText([E2E_UNLISTED_TITLE]);
  await expect(page.getByRole("link", { name: "Unlisted, 1 book" })).toHaveAttribute("aria-current", "true");

  await page.goto(`/books/list?q=${encodeURIComponent("Unlisted Book")}`);
  await expect(titles(page)).toHaveText([E2E_UNLISTED_TITLE]);
});

test("the Unlisted list meets the floor: a grey badge, a real Add to Someday at least 24px tall", async ({ page }, info) => {
  await page.goto("/books/list?status=unlisted");
  const badge = row(page).locator(".status-toggle");
  await expect(badge).toHaveText("Status: unlisted");
  // Unlisted is a level, not a state: grey, never ready, held or danger.
  const { color, "background-color": background } = await computedStyle(badge, ["color", "background-color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) {
    const state = await tokenColour(page, token);
    expect(color, token).not.toBe(state);
    expect(background, token).not.toBe(state);
  }

  const add = addToSomeday(page);
  expect(await add.evaluate((el) => el.tagName)).toBe("BUTTON");
  const box = await add.boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(24);

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "unlisted-list");
});

test("Add to Someday takes the row off the Unlisted list; Undo brings it back, focused", ONCE, async ({ page }, info) => {
  await page.goto("/books/list?status=unlisted");
  const add = addToSomeday(page);
  await hydrated(add);
  await add.click();

  // The list is empty now: the empty state, and the chip is gone with its last book.
  await expect(titles(page)).toHaveCount(0);
  await expect(page.locator(".empty")).toHaveText("Nothing matches. Try a broader filter.");
  await expect(page.getByRole("link", { name: /^Unlisted,/ })).toHaveCount(0);
  await expectNoAxeViolations(page, AXE);
  await screenshot(page, info, "unlisted-empty");
  const sql = testSql();
  try {
    expect(await sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${E2E_UNLISTED_ID}`)
      .toEqual([{ status: "to_read" }]);
  } finally {
    await sql.end();
  }

  await page.locator(".toast-undo").click();
  await expect(titles(page)).toHaveText([E2E_UNLISTED_TITLE]);
  await expect(addToSomeday(page)).toBeFocused();
});
