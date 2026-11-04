// Task 1.17 (data model 2.18): a book's start and a run's span in a real
// browser, at every width, light and dark (AC-4, AC-5, AC-6). The master list's
// rows carry *Started …* and, once read, the finish and the days taken; the
// status control's date line has *Started …* and *Finished …* as buttons named
// with their dates, each opening the four named radio inputs, a start after
// the finish refused with the reason under the control; the run hero and the
// comics Done tab carry the run's span. The books and runs are made here, under
// E2E ids the rest of the suite doesn't use, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { markRead, testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label",
];

const READING = { id: "e2e-start-reading", title: "E2E Started Book" };
const READ = { id: "e2e-start-read", title: "E2E Finished Book" };
const UNDATED = { id: "e2e-start-undated", title: "E2E Undated Book" };
const BOOKS = [READING, READ, UNDATED];
/** Reads in March and September 2026: one run with an issue left, one read through. */
const RUNS = [
  { id: "e2e-span-open", title: "E2E Span Open", read: [true, true, false] },
  { id: "e2e-span-done", title: "E2E Span Done", read: [true, true, true] },
];
const READ_AT = ["2026-03-05T05:00:00Z", "2026-09-10T04:00:00Z", "2026-09-20T04:00:00Z"];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id = ANY(${BOOKS.map((b) => b.id)}::text[])`;
  await sql`DELETE FROM runs WHERE id = ANY(${RUNS.map((r) => r.id)}::text[])`;
  await sql`DELETE FROM issues WHERE id LIKE 'e2e-span-%'`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) await sql`INSERT INTO books (id, title, genre) VALUES (${b.id}, ${b.title}, 'Fantasy')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
              VALUES (${E2E_USER}, ${READING.id}, 'reading', '2026-10-21', 'exact')`;
    // Read: finishing moved the start onto the read (data model 2.18).
    for (const [b, start, sp] of [[READ, "2026-03-01", "exact"], [UNDATED, null, "none"]] as const) {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${b.id}, 'read', '2026-03-17', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
                VALUES (${E2E_USER}, ${b.id}, '2026-03-17', 'exact', ${start}, ${sp})`;
    }
    for (const r of RUNS) {
      await sql`INSERT INTO runs (id, title) VALUES (${r.id}, ${r.title})`;
      for (const [i, read] of r.read.entries()) {
        const issue = `${r.id}-${i + 1}`;
        await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${`${r.title} (2026) #${i + 1}`})`;
        await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${r.id}, ${i + 1}, ${issue})`;
        if (read) await markRead(sql, E2E_USER, r.id, issue, { at: READ_AT[i] });
      }
    }
  });
});
test.afterAll(clean);

const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });

test("the master list: a book being read shows its start, a finished one its start, finish and days taken (AC-4)", async ({ page }, info) => {
  await page.goto("/books/list");
  await expect(bookRow(page, READING.title).locator(".row-dates")).toHaveText(/^Started 21 Oct( 2026)?$/);
  await expect(bookRow(page, READ.title).locator(".row-dates"))
    .toHaveText(/^Started 1 Mar( 2026)? · finished 17 Mar( 2026)? · 16 days$/);
  // A none start shows no start and no days.
  await expect(bookRow(page, UNDATED.title).locator(".row-dates")).toHaveCount(0);

  // Grey, no state colour: dates are information, not read or held.
  const { color } = await computedStyle(bookRow(page, READ.title).locator(".row-dates"), ["color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(color, token).not.toBe(await tokenColour(page, token));

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "start-dates-list");
});

test("the date line: Started and Finished are buttons named with their dates; Started opens named radios, focus returns (AC-6)", async ({ page }, info) => {
  await page.goto("/books/list");
  const row = bookRow(page, READ.title);
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  const started = row.getByRole("button", { name: "Started 1 March 2026" });
  await expect(started).toBeVisible();
  await expect(row.getByRole("button", { name: "Finished 17 March 2026" })).toBeVisible();
  expect(await started.evaluate((el) => el.tagName)).toBe("BUTTON");
  expect((await started.boundingBox())!.height).toBeGreaterThanOrEqual(24);

  await started.click();
  const group = row.getByRole("group", { name: "Started" });
  for (const name of ["Today", "Pick a date", "Year only", "No date"]) {
    await expect(group.getByRole("radio", { name })).toBeVisible();
  }

  // A start after the finish: the reason under the control, announced; Save can't write it.
  await group.getByRole("radio", { name: "Pick a date" }).check();
  await row.locator('input[type="date"]').fill("2026-03-20");
  const reason = row.locator(".sheet-reason");
  await expect(reason).toHaveText("That's after the day you finished.");
  await expect(reason).toHaveAttribute("aria-live", "polite");
  await expect(row.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
  const { color } = await computedStyle(reason, ["color"]);
  expect(color).not.toBe(await tokenColour(page, "--danger"));

  await expectNoHorizontalScroll(page);
  // From the top: scrolled down to the open control, the sticky bar sits over a
  // filter chip, and axe's target-size counts a chip under it as obscured (the
  // control grew with *Listening*, task 1.23). The control stays open.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await row.scrollIntoViewIfNeeded();
  await screenshot(page, info, "start-dates-control");

  await page.keyboard.press("Escape");
  await expect(group).toHaveCount(0);
  await expect(started).toBeFocused();
  const stored = await withSql((sql) => sql`SELECT started_on::text AS on FROM read_events WHERE book_id = ${READ.id}`);
  expect(stored).toEqual([{ on: "2026-03-01" }]);
});

test("the run hero's span line: Started Mar 2026 while unread remain, Mar–Sep 2026 once read (AC-5)", async ({ page }, info) => {
  await page.goto(`/comics/${RUNS[0].id}`);
  await expect(page.locator(".runhero-span")).toHaveText("Started Mar 2026");
  await page.goto(`/comics/${RUNS[1].id}`);
  const span = page.locator(".runhero-span");
  await expect(span).toHaveText("Mar–Sep 2026");
  const { color } = await computedStyle(span, ["color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(color, token).not.toBe(await tokenColour(page, token));

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "start-dates-run-hero");
});

test("Done tabs: the run's row shows its span, the book's row its dates (AC-4, AC-5)", async ({ page }, info) => {
  await page.goto("/comics/status?tab=done");
  const run = page.locator(".row", { has: page.locator(".row-title", { hasText: RUNS[1].title }) });
  await expect(run.locator(".row-sub")).toContainText("Read Mar–Sep 2026");
  await expectNoAxeViolations(page, AXE);
  await screenshot(page, info, "start-dates-comics-done");

  await page.goto("/books/status?tab=done");
  const book = page.locator(".row", { has: page.locator(".row-title", { hasText: READ.title }) });
  await expect(book.locator(".row-dates")).toHaveText(/^Started 1 Mar( 2026)? · finished 17 Mar( 2026)? · 16 days$/);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "start-dates-books-done");
});
