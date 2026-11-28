// @area: shared
// Task 1.17c (TASK-152, D-191): *Add a past read* on a Read book's date line, in a real browser. It opens
// *Started*, *Finished* and *Format* together; a start after the finish is refused under *Started* and
// nothing is sent; a confirm logs one more read (*All reads (2)*, the new read by its year, a listen with
// its glyph), and the toast's Undo takes it back. A past read finished after the latest moves the book's
// finish line, and its Undo puts the old one back. The write itself is TASK-151's (test/past-read.test.ts).
// The book is made here, under an E2E id the rest of the suite doesn't use, and put back before each test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  FEEL, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot,
} from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label",
];

const BOOK = { id: "e2e-past-read", title: "E2E Past Read Book" };

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

test.beforeAll(() => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id = ${BOOK.id}`;
  await sql`INSERT INTO books (id, title) VALUES (${BOOK.id}, ${BOOK.title})`;
}));
test.afterAll(() => withSql((sql) => sql`DELETE FROM books WHERE id = ${BOOK.id}`));

// A book read once: started 1 March 2024, finished 10 March 2024, on the page.
test.beforeEach(() => withSql(async (sql) => {
  await sql`DELETE FROM book_status WHERE book_id = ${BOOK.id}`;
  await sql`DELETE FROM read_events WHERE book_id = ${BOOK.id}`;
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${E2E_USER}, ${BOOK.id}, 'read', '2024-03-10', 'exact')`;
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
            VALUES (${E2E_USER}, ${BOOK.id}, '2024-03-10', 'exact', '2024-03-01', 'exact', 'text')`;
}));

const reads = () => withSql(async (sql) =>
  [...await sql`SELECT finished_on::text AS finished_on, finished_on_precision AS fp, format FROM read_events
                WHERE book_id = ${BOOK.id} ORDER BY finished_on`].map((r) => ({ ...r })));
const finish = () => withSql(async (sql) => {
  const [r] = await sql`SELECT finished_on::text AS finished_on FROM book_status WHERE book_id = ${BOOK.id}`;
  return r.finished_on as string;
});

async function expand(page: Page) {
  await page.goto("/books/list");
  const row = page.locator(".book-row", { has: page.locator(".row-title", { hasText: BOOK.title }) });
  await hydrated(row.locator(".status-toggle"));
  await row.locator(".status-toggle").click();
  return row;
}

/** Step *Year only*'s year back to `year` (it opens on this one). */
async function stepTo(page: Page, row: ReturnType<Page["locator"]>, year: number) {
  const stepper = row.getByRole("group", { name: "Year finished" });
  const shown = stepper.locator("output");
  while (Number(await shown.textContent()) > year) {
    const was = await shown.textContent();
    await stepper.getByRole("button", { name: "Earlier" }).click();
    await expect(shown).not.toHaveText(was!);
  }
}

test("Add a past read opens Started, Finished and Format; a start after the finish is refused, nothing sent; the floor at every width, Esc back to the button (AC-1, AC-4)", FEEL, async ({ page }, info) => {
  const puts: string[] = [];
  page.on("request", (r) => { if (r.method() === "PUT" && r.url().includes("/api/progress/")) puts.push(r.url()); });
  const row = await expand(page);
  const add = row.getByRole("button", { name: "Add a past read" });
  await expect(add).toHaveAttribute("aria-expanded", "false");
  await add.click();
  await expect(add).toHaveAttribute("aria-expanded", "true");

  const started = row.getByRole("group", { name: "Started" });
  const finished = row.getByRole("group", { name: "Finished" });
  const format = row.getByRole("group", { name: "Format" });
  await expect(started.getByRole("radio", { name: "No date" })).toBeChecked();
  await expect(finished.getByRole("radio", { name: "Today" })).toBeChecked();
  await expect(format.getByRole("radio", { name: "Read" })).toBeChecked();
  await expect(format.getByRole("radio", { name: "Listened" })).not.toBeChecked();

  // A start after the finish: the reason under *Started*, announced; Save says why and sends nothing.
  await started.getByRole("radio", { name: "Pick a date" }).check();
  await row.getByLabel("Started on").fill("2019-06-10");
  await finished.getByRole("radio", { name: "Pick a date" }).check();
  await row.getByLabel("Finished on").fill("2019-06-01");
  const reason = row.locator(".sheet-reason").first();
  await expect(reason).toHaveText("That's after the day you finished.");
  await expect(reason).toHaveAttribute("aria-live", "polite");
  const save = row.getByRole("button", { name: "Save" });
  await expect(save).toHaveAttribute("aria-disabled", "true");
  await expect(save).toHaveAttribute("aria-describedby", /.+/);
  await save.click({ force: true });
  expect(puts).toEqual([]);
  expect(await reads()).toHaveLength(1);

  // Every control is a real, named button or radio; 44px at phone widths.
  if (page.viewportSize()!.width < 768) {
    for (const radio of await row.locator(".past-read").getByRole("radio").all()) {
      expect((await radio.locator("xpath=..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    for (const b of [add, save, row.getByRole("button", { name: "Cancel" })]) {
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await expectNoHorizontalScroll(page);
  // From the top, as start-dates.spec.ts does: the sticky bar over a chip reads as an obscured target.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await row.scrollIntoViewIfNeeded();
  await screenshot(page, info, "past-read-form");

  await page.keyboard.press("Escape");
  await expect(format).toHaveCount(0);
  await expect(add).toBeFocused();
  expect(puts).toEqual([]);
});

test("a listen finished Year only 2019: All reads (2), the new read by its year with the Listened glyph; focus back on Add a past read (AC-2, AC-4)", ONCE, async ({ page }) => {
  const row = await expand(page);
  const add = row.getByRole("button", { name: "Add a past read" });
  await add.click();
  await row.getByRole("group", { name: "Finished" }).getByRole("radio", { name: "Year only" }).check();
  await stepTo(page, row, 2019);
  await row.getByRole("group", { name: "Format" }).getByRole("radio", { name: "Listened" }).check();
  await row.getByRole("button", { name: "Save" }).click();

  await expect.poll(reads).toEqual([
    { finished_on: "2019-07-01", fp: "approximate", format: "audio" },
    { finished_on: "2024-03-10", fp: "exact", format: "text" },
  ]);
  expect(await finish()).toBe("2024-03-10");
  await expect(add).toBeFocused();
  await expect(row.getByRole("group", { name: "Format" })).toHaveCount(0);

  const toggle = row.getByRole("button", { name: "All reads (2)" });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const list = row.getByRole("list", { name: `All reads of ${BOOK.title}` });
  await expect(list.getByRole("listitem")).toHaveCount(2);
  const first = list.getByRole("listitem").first();
  await expect(first.getByRole("button", { name: "Finished 2019, approximate, read 1" })).toBeVisible();
  await expect(first.getByRole("img", { name: "Listened" })).toHaveCount(1);
  await expect(list.getByRole("listitem").nth(1).getByRole("img")).toHaveCount(0);
  // The book's finish line is the latest read's, unchanged.
  await expect(row.getByRole("button", { name: "Finished 10 March 2024", exact: true })).toBeVisible();
  await expect(page.locator(".toast")).toContainText(`${BOOK.title}: past read added`);
});

test("Undo takes the past read back: one read, the finish line as before (AC-3)", ONCE, async ({ page }) => {
  const row = await expand(page);
  await row.getByRole("button", { name: "Add a past read" }).click();
  await row.getByRole("group", { name: "Finished" }).getByRole("radio", { name: "Year only" }).check();
  await stepTo(page, row, 2019);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByRole("button", { name: "All reads (2)" })).toBeVisible();

  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(reads).toEqual([{ finished_on: "2024-03-10", fp: "exact", format: "text" }]);
  await expect(row.getByRole("button", { name: /^All reads/ })).toHaveCount(0);
  await expect(row.getByRole("list", { name: `All reads of ${BOOK.title}` })).toHaveCount(0);
  await expect(row.getByRole("button", { name: "Finished 10 March 2024", exact: true })).toBeVisible();
  expect(await finish()).toBe("2024-03-10");
});

test("a past read finished after the latest moves the finish line to it; Undo puts 10 March 2024 back (AC-1, AC-3)", ONCE, async ({ page }) => {
  const row = await expand(page);
  await row.getByRole("button", { name: "Add a past read" }).click();
  await row.getByRole("group", { name: "Finished" }).getByRole("radio", { name: "Pick a date" }).check();
  await row.getByLabel("Finished on").fill("2025-01-05");
  await row.getByRole("button", { name: "Save" }).click();

  await expect(row.getByRole("button", { name: "Finished 5 January 2025", exact: true })).toBeVisible();
  expect(await finish()).toBe("2025-01-05");
  await expect(row.getByRole("button", { name: "All reads (2)" })).toBeVisible();

  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(row.getByRole("button", { name: "Finished 10 March 2024", exact: true })).toBeVisible();
  expect(await finish()).toBe("2024-03-10");
  expect(await reads()).toEqual([{ finished_on: "2024-03-10", fp: "exact", format: "text" }]);
});

test("a book that isn't Read has no Add a past read (AC-1)", ONCE, async ({ page }) => {
  await withSql((sql) => sql`UPDATE book_status SET status = 'reading', finished_on = NULL, finished_on_precision = 'none'
                             WHERE book_id = ${BOOK.id}`);
  const row = await expand(page);
  await expect(row.getByRole("button", { name: /^Started/ })).toBeVisible();
  await expect(row.getByRole("button", { name: "Add a past read" })).toHaveCount(0);
});
