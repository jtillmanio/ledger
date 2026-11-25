// @area: books
// Task 5.7, 1 of 2 (TASK-099; D-35): Coming out in a real browser. A book released yesterday sits under Out now,
// one due next month under its month, one with any status row (the Unlisted book, a read one) never shows;
// Got it moves a book to Someday with no reload and one to_read row, Undo puts the row back and leaves no row;
// the nav item is current on the page in whichever bar the width draws; and the page meets the UX floor.
// The books are test/e2e/global-setup.ts's (two of the Library's, with releases, and the Unlisted book).
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql } from "../db";
import {
  E2E_RELEASE_MONTH_ID, E2E_RELEASE_MONTH_TITLE, E2E_RELEASE_OUT_ID, E2E_RELEASE_OUT_TITLE, E2E_UNLISTED_TITLE,
  FLOOR, computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order", "label-content-name-mismatch",
];

/** Whatever a test did, both books are as global-setup left them: no status row. */
async function reset() {
  const sql = testSql();
  try {
    await sql`DELETE FROM book_status WHERE user_id = ${E2E_USER} AND book_id IN (${E2E_RELEASE_OUT_ID}, ${E2E_RELEASE_MONTH_ID})`;
  } finally {
    await sql.end();
  }
}

test.beforeEach(reset);
test.afterAll(reset);

async function statusRows(id: string) {
  const sql = testSql();
  try {
    return await sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
  } finally {
    await sql.end();
  }
}

/** The month heading the month book's stored release date falls under: *December 2026*. */
async function monthHeading() {
  const sql = testSql();
  try {
    const [{ release_date }] = await sql`SELECT release_date FROM releases WHERE book_id = ${E2E_RELEASE_MONTH_ID}`;
    return new Date(`${release_date}T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  } finally {
    await sql.end();
  }
}

const section = (page: Page, heading: string) =>
  page.locator("section", { has: page.getByRole("heading", { level: 2, name: heading }) });
const gotIt = (page: Page, title: string) => page.getByRole("button", { name: `Got it: ${title}` });
const rowTitles = (page: Page) => page.locator(".book-row .row-title");

test("Out now holds the book released yesterday, its month the one due next month, and no book with a status", async ({ page }) => {
  await page.goto("/books/releases");
  await expect(page.getByRole("heading", { level: 1, name: "Coming out" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(/^Out now/);
  await expect(section(page, "Out now").locator(".row-title")).toHaveText([E2E_RELEASE_OUT_TITLE]);
  await expect(section(page, await monthHeading()).locator(".row-title")).toHaveText([E2E_RELEASE_MONTH_TITLE]);
  // The Unlisted book has a release and a status row: not wanted.
  await expect(rowTitles(page).filter({ hasText: E2E_UNLISTED_TITLE })).toHaveCount(0);
  await expect(rowTitles(page)).toHaveCount(2);
});

test("a book that is already read never appears", ONCE, async ({ page }) => {
  const sql = testSql();
  try {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${E2E_RELEASE_OUT_ID}, 'read', '2026-01-10', 'exact')`;
  } finally {
    await sql.end();
  }
  await page.goto("/books/releases");
  await expect(rowTitles(page)).toHaveText([E2E_RELEASE_MONTH_TITLE]);
  await expect(page.getByRole("heading", { level: 2, name: /^Out now/ })).toHaveCount(0);
});

test("Coming out is current on its page in whichever bar the width draws", async ({ page }) => {
  await page.goto("/books/releases");
  const current = page.locator('a[href="/books/releases"][aria-current="page"]:visible');
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Coming out");
});

test("the page meets the floor: Got it is a real, named button of at least 24px (44px on a phone), no overflow, contrast and axe", FLOOR, async ({ page }, info) => {
  await page.goto("/books/releases");
  const button = gotIt(page, E2E_RELEASE_OUT_TITLE);
  await expect(button).toHaveText("Got it");
  expect(await button.evaluate((el) => el.tagName)).toBe("BUTTON");
  const box = await button.boundingBox();
  const phone = (page.viewportSize()?.width ?? 0) < 768;
  expect(box!.height).toBeGreaterThanOrEqual(phone ? 44 : 24);
  expect(box!.width).toBeGreaterThanOrEqual(24);

  // The date is mono, and the verb is the brand's primary colour, never a state colour.
  const date = page.locator(".book-row .row-meta").first();
  expect((await computedStyle(date, ["font-family"]))["font-family"]).toMatch(/mono/i);
  const { "background-color": background } = await computedStyle(button, ["background-color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(background, token).not.toBe(await tokenColour(page, token));

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "releases");
});

test("Got it removes the row with no reload and writes one to_read row; Undo brings it back and leaves no row", ONCE, async ({ page }, info) => {
  await page.goto("/books/releases");
  const button = gotIt(page, E2E_RELEASE_OUT_TITLE);
  await hydrated(button);
  // A marker on the window: a reload would lose it.
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });

  await button.click();
  await expect(rowTitles(page).filter({ hasText: E2E_RELEASE_OUT_TITLE })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: /^Out now/ })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  expect(await statusRows(E2E_RELEASE_OUT_ID)).toEqual([{ status: "to_read" }]);
  // The month book is untouched, and focus went to a button, not the body.
  await expect(rowTitles(page)).toHaveText([E2E_RELEASE_MONTH_TITLE]);
  await expect(gotIt(page, E2E_RELEASE_MONTH_TITLE)).toBeFocused();
  await expect(page.locator(".toast")).toContainText(`${E2E_RELEASE_OUT_TITLE}: to read`);
  await expect(page.locator(".toast")).toContainText("Was coming out");
  await screenshot(page, info, "releases-got-it");

  await page.locator(".toast-undo").click();
  await expect(section(page, "Out now").locator(".row-title")).toHaveText([E2E_RELEASE_OUT_TITLE]);
  await expect.poll(() => statusRows(E2E_RELEASE_OUT_ID)).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});

// Task 5.7, 2 of 2 (TASK-100): the add sheet's Coming out destination, and the dashboard's line.
const ADDED_TITLE = "TASK-100 Waiting Book";

/** The Eastern day (D-67), and the 15th of the month after it: *next month*, as AC-2 says. */
function easternDays() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-15` : `${y}-${String(m + 1).padStart(2, "0")}-15`;
  const heading = new Date(`${next}T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return { today, next, heading };
}

/** The book the add test makes, gone whatever happened (test database only). */
async function dropAdded() {
  const sql = testSql();
  try {
    await sql`DELETE FROM books WHERE title = ${ADDED_TITLE}`;
  } finally {
    await sql.end();
  }
}

/** Add books' full page on By hand, with Coming out chosen. */
async function comingOutByHand(page: Page) {
  await page.goto("/books/add");
  const byHand = page.getByRole("button", { name: "By hand" });
  await hydrated(byHand);
  await byHand.click();
  await page.getByRole("group", { name: "Add to" }).getByRole("button", { name: "Coming out" }).click();
}

test("By hand to Coming out with a date next month: the page lists it under that month, and Undo takes it away (AC-2)", ONCE, async ({ page, context }) => {
  await dropAdded();
  try {
    const { next, heading } = easternDays();
    await comingOutByHand(page);
    await page.locator("#hand-title").fill(ADDED_TITLE);
    await page.locator("#hand-author").fill("Hand Author");
    await page.getByLabel("Release date").fill(next);
    await page.getByRole("button", { name: "Add to Coming out" }).click();
    await expect(page.locator(".toast-label")).toHaveText("Added to Coming out");

    const sql = testSql();
    try {
      const rows = await sql`SELECT b.id, r.release_date, (SELECT count(*)::int FROM book_status s WHERE s.book_id = b.id) AS statuses
                             FROM books b JOIN releases r ON r.book_id = b.id WHERE b.title = ${ADDED_TITLE} AND b.deleted_at IS NULL`;
      expect(rows.map((r) => [r.release_date, r.statuses])).toEqual([[next, 0]]);
    } finally {
      await sql.end();
    }
    const list = await context.newPage();
    await list.goto("/books/releases");
    await expect(section(list, heading).locator(".row-title").filter({ hasText: ADDED_TITLE })).toHaveCount(1);

    await page.locator(".toast-undo").click();
    // Undo removed both: the release, and the book it made (soft-deleted).
    await expect.poll(async () => {
      const sql = testSql();
      try {
        return (await sql`SELECT (SELECT count(*)::int FROM releases r WHERE r.book_id = b.id) AS releases, b.deleted_at IS NOT NULL AS removed
                          FROM books b WHERE b.title = ${ADDED_TITLE}`).map((r) => [r.releases, r.removed]);
      } finally {
        await sql.end();
      }
    }).toEqual([[0, true]]);
    await list.reload();
    await expect(list.locator(".row-title").filter({ hasText: ADDED_TITLE })).toHaveCount(0);
  } finally {
    await dropAdded();
  }
});

test("the books dashboard's line counts what the page lists: out now and coming this month, linking there (AC-1, AC-4)", async ({ page }) => {
  await page.goto("/books/releases");
  // The rows, not the loading skeleton (the page streams in behind loading.tsx).
  await expect(rowTitles(page).first()).toBeVisible();
  const count = async (heading: RegExp) => {
    const head = page.getByRole("heading", { level: 2, name: heading });
    return (await head.count()) === 0 ? 0 : Number(await head.locator(".n").textContent());
  };
  const out = await count(/^Out now/);
  // This month's group, as the page heads it (*November 2026*): only books due after today.
  const { today } = easternDays();
  const month = new Date(`${today.slice(0, 7)}-15T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const thisMonth = await count(new RegExp(`^${month}`));

  await page.goto("/books");
  const line = page.locator('[data-slot="rollup"] .coming-out a');
  const parts = [out > 0 && `${out} out now`, thisMonth > 0 && `${thisMonth} coming this month`].filter(Boolean);
  // global-setup's books: one released yesterday, so the line is there.
  expect(out).toBeGreaterThan(0);
  await expect(line).toHaveText(`${parts.join(" · ")} →`);
  await expect(line).toHaveAttribute("href", "/books/releases");
  await expect(line).toHaveAccessibleName(parts.join(" · "));
});

test("the destination and the line meet the floor: labelled, refused under the field, named, no red, axe and contrast (AC-6)", FLOOR, async ({ page }, info) => {
  await comingOutByHand(page);
  const date = page.getByLabel("Release date");
  await expect(date).toHaveAttribute("type", "date");
  const none = page.getByRole("checkbox", { name: "No date yet" });
  await expect(none).toBeVisible();
  // Keyboard: Space ticks No date yet; typing a day unticks it.
  await none.focus();
  await page.keyboard.press("Space");
  await expect(none).toBeChecked();
  await date.fill("2027-03-04");
  await expect(none).not.toBeChecked();
  await date.fill("");
  await page.locator("#hand-title").fill("Never Sent");
  await page.locator("#hand-author").fill("Hand Author");
  await page.getByRole("button", { name: "Add to Coming out" }).click();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await expect(date).toBeFocused();
  await expect(page.locator("#release-date-err")).toHaveText("! Pick a release date, or No date yet");
  // Under the field, at its left edge, at every width (ui-verifier, 1024px and up: it sat beside No date yet).
  const field = (await date.boundingBox())!;
  const refusal = (await page.locator("#release-date-err").boundingBox())!;
  expect(Math.abs(refusal.x - field.x)).toBeLessThan(2);
  expect(refusal.y).toBeGreaterThanOrEqual(field.y + field.height);
  const box = await none.boundingBox();
  expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(24);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "add-coming-out");

  await page.goto("/books");
  const line = page.locator('[data-slot="rollup"] .coming-out a');
  await expect(line).toBeVisible();
  expect(await line.evaluate((el) => el.tagName)).toBe("A");
  const { color } = await computedStyle(line, ["color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(color, token).not.toBe(await tokenColour(page, token));
  expect((await line.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "bdash-coming-out");
});

// --- Task 5.9b, 2 of 3 (TASK-141; F-38, D-134): a row's place line links its names ---------------------------------

test("5.9b AC-1, AC-2, AC-4: a wanted book links its author, universe and series; one with no series or universe links its author only", FLOOR, async ({ page }, info) => {
  const sql = testSql();
  const ids = { au: "e2e-rl-au", un: "e2e-rl-un", se: "e2e-rl-se" };
  const wipe = async () => {
    await sql`DELETE FROM books WHERE id LIKE 'e2e-rl-%'`;
    await sql`DELETE FROM book_series WHERE id = ${ids.se}`;
    await sql`DELETE FROM book_universes WHERE id = ${ids.un}`;
    await sql`DELETE FROM authors WHERE id = ${ids.au}`;
  };
  try {
    await wipe();
    await sql`INSERT INTO authors (id, name) VALUES (${ids.au}, 'Rl Author')`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${ids.un}, 'Rl World')`;
    await sql`INSERT INTO book_series (id, name, author_id) VALUES (${ids.se}, 'Rl Cycle', ${ids.au})`;
    await sql`INSERT INTO books (id, title, author_id, series_id, series_position, universe_id)
              VALUES ('e2e-rl-serial', 'E2E Rl Serial', ${ids.au}, ${ids.se}, 6, ${ids.un})`;
    await sql`INSERT INTO books (id, title, author_id) VALUES ('e2e-rl-lone', 'E2E Rl Lone', ${ids.au})`;
    await sql`INSERT INTO releases (book_id, release_date) VALUES ('e2e-rl-serial', '2020-01-01'), ('e2e-rl-lone', '2020-01-02')`;

    await page.goto("/books/releases");
    const line = (title: string) => page.locator(".book-row", { hasText: title }).locator(".row-sub");
    // Visible first: a streamed page holds its content in a hidden node until it swaps in, and a role query skips it.
    await expect(line("E2E Rl Serial")).toBeVisible();
    await expect(line("E2E Rl Lone")).toBeVisible();
    const hrefs = (title: string) => line(title).getByRole("link").evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
    await expect(line("E2E Rl Serial")).toHaveText("Rl Author · Rl World · Rl Cycle #6");
    expect(await hrefs("E2E Rl Serial")).toEqual([
      ["Rl Author", `/books/authors/${ids.au}`], ["Rl World", `/books/universes/${ids.un}`], ["Rl Cycle", `/books/series/${ids.se}`],
    ]);
    await expect(line("E2E Rl Serial").getByRole("link", { name: "Rl Cycle", exact: true })).toBeVisible();
    expect(await hrefs("E2E Rl Lone")).toEqual([["Rl Author", `/books/authors/${ids.au}`]]);
    for (const link of await line("E2E Rl Serial").getByRole("link").all()) {
      expect((await link.boundingBox())!.height, "each place link is 24px or more").toBeGreaterThanOrEqual(24);
    }
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "5.9b-releases-links");
  } finally {
    await wipe();
    await sql.end();
  }
});
