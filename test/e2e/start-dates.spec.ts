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

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label",
];

const READING = { id: "e2e-start-reading", title: "E2E Started Book" };
const READ = { id: "e2e-start-read", title: "E2E Finished Book" };
const UNDATED = { id: "e2e-start-undated", title: "E2E Undated Book" };
/** Task 1.17b: a to-read book the control asks the dates of, and a book read twice. */
const ASK = { id: "e2e-start-ask", title: "E2E Ask Dates Book" };
const TWICE = { id: "e2e-start-twice", title: "E2E Read Twice Book" };
const BOOKS = [READING, READ, UNDATED, ASK, TWICE];
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

// Task 1.17b (D-131): the status control asks the dates, in the browser on the Library row (the same control
// is on Now and the status screens: books-dashboard.spec.ts, status.spec.ts). Own books, put back before each test.
test.describe("the status control asks the dates (1.17b)", () => {
  const todayEastern = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const daysAgo = (n: number) => new Date(Date.parse(`${todayEastern()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

  test.beforeEach(() => withSql(async (sql) => {
    await sql`DELETE FROM book_status WHERE book_id = ANY(${[ASK.id, TWICE.id]}::text[])`;
    await sql`DELETE FROM read_events WHERE book_id = ANY(${[ASK.id, TWICE.id]}::text[])`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${ASK.id}, 'to_read')`;
    // Two reads, a text read then a listen; the status holds the listen's finish.
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${TWICE.id}, 'read', '2025-03-19', 'exact')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
              VALUES (${E2E_USER}, ${TWICE.id}, '2022-07-01', 'approximate', '2022-06-03', 'exact', 'text'),
                     (${E2E_USER}, ${TWICE.id}, '2025-03-19', 'exact', '2025-03-02', 'exact', 'audio')`;
  }));

  const state = (id: string) => withSql(async (sql) => {
    const [r] = await sql`SELECT status, started_on::text AS started_on, started_on_precision AS sp, finished_on::text AS finished_on
                          FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
    return { ...r };
  });
  const reads = (id: string) => withSql(async (sql) =>
    [...await sql`SELECT started_on::text AS started_on, finished_on::text AS finished_on FROM read_events
                  WHERE book_id = ${id} ORDER BY id`].map((r) => ({ ...r })));
  async function expand(page: Page, title: string) {
    const row = bookRow(page, title);
    await hydrated(row.locator(".status-toggle"));
    await row.locator(".status-toggle").click();
    return row;
  }

  test("Reading opens Started on Today; an earlier day writes started_on, exact; Undo restores the status and start before (AC-1)", ONCE, async ({ page }) => {
    await page.goto("/books/list");
    const row = await expand(page, ASK.title);
    await row.getByRole("button", { name: "Reading", exact: true }).click();
    const group = row.getByRole("group", { name: "Started" });
    await expect(group.getByRole("radio", { name: "Today" })).toBeChecked();

    const day = daysAgo(3);
    await group.getByRole("radio", { name: "Pick a date" }).check();
    await row.getByLabel("Started on").fill(day);
    await row.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => state(ASK.id)).toMatchObject({ status: "reading", started_on: day, sp: "exact" });
    await expect(row.getByRole("button", { name: `Started ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}` })).toBeVisible();

    const undo = page.locator(".toast").getByRole("button", { name: "Undo" });
    await expect(undo).toHaveCount(1);
    await undo.click();
    await expect.poll(() => state(ASK.id)).toMatchObject({ status: "to_read", started_on: null, sp: "none" });
  });

  test("Esc on Started keeps today's start and sends no second write (AC-2)", ONCE, async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/api/progress/")) posts.push(r.url()); });
    await page.goto("/books/list");
    const row = await expand(page, ASK.title);
    const reading = row.getByRole("button", { name: "Reading", exact: true });
    await reading.click();
    await expect(row.getByRole("group", { name: "Started" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(row.getByRole("group", { name: "Started" })).toHaveCount(0);
    await expect(reading).toBeFocused();
    expect(await state(ASK.id)).toMatchObject({ status: "reading", started_on: todayEastern(), sp: "exact" });
    expect(posts).toHaveLength(1);
  });

  test("Read opens both; a start after the finish is refused and writes nothing; confirming writes one read_events row with both dates (AC-1, AC-3)", ONCE, async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/api/progress/")) posts.push(r.url()); });
    await page.goto("/books/list");
    const row = await expand(page, ASK.title);
    await row.getByRole("button", { name: "Read", exact: true }).click();
    const started = row.getByRole("group", { name: "Started" });
    const finished = row.getByRole("group", { name: "Finished" });
    await expect(started.getByRole("radio", { name: "No date" })).toBeChecked();
    await expect(finished.getByRole("radio", { name: "Today" })).toBeChecked();

    await started.getByRole("radio", { name: "Pick a date" }).check();
    await row.getByLabel("Started on").fill(daysAgo(5));
    await finished.getByRole("radio", { name: "Pick a date" }).check();
    await row.getByLabel("Finished on").fill(daysAgo(6));
    const reason = row.locator(".sheet-reason").first();
    await expect(reason).toHaveText("That's after the day you finished.");
    await expect(reason).toHaveAttribute("aria-live", "polite");
    const save = row.getByRole("button", { name: "Save" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    await expect(save).toHaveAttribute("aria-describedby", /.+/);
    const { color } = await computedStyle(reason, ["color"]);
    expect(color).not.toBe(await tokenColour(page, "--danger"));
    await save.click({ force: true });
    expect(posts).toEqual([]);
    expect(await state(ASK.id)).toMatchObject({ status: "to_read" });
    expect(await reads(ASK.id)).toEqual([]);

    await finished.getByRole("radio", { name: "Today" }).check();
    await expect(reason).toHaveText("");
    await save.click();
    await expect.poll(() => reads(ASK.id)).toEqual([{ started_on: daysAgo(5), finished_on: todayEastern() }]);
    expect(await state(ASK.id)).toMatchObject({ status: "read", finished_on: todayEastern() });
  });

  test("a book with two reads lists both under All reads (2); re-dating the first changes only its row, the second its row and book_status (AC-1, AC-4)", ONCE, async ({ page }) => {
    await page.goto("/books/list");
    const row = await expand(page, TWICE.title);
    const toggle = row.getByRole("button", { name: "All reads (2)" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    const list = row.getByRole("list", { name: `All reads of ${TWICE.title}` });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("img", { name: "Listened" })).toHaveCount(1);

    await list.getByRole("button", { name: "Started 3 June 2022, read 1" }).click();
    await list.getByRole("radio", { name: "Pick a date" }).check();
    await list.getByLabel("Started on").fill("2022-06-10");
    await list.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => reads(TWICE.id)).toEqual([
      { started_on: "2022-06-10", finished_on: "2022-07-01" }, { started_on: "2025-03-02", finished_on: "2025-03-19" },
    ]);
    expect((await state(TWICE.id)).finished_on).toBe("2025-03-19");

    await list.getByRole("button", { name: "Finished 19 March 2025, read 2" }).click();
    await list.getByRole("radio", { name: "Pick a date" }).check();
    await list.getByLabel("Finished on").fill("2025-03-25");
    await list.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => reads(TWICE.id)).toEqual([
      { started_on: "2022-06-10", finished_on: "2022-07-01" }, { started_on: "2025-03-02", finished_on: "2025-03-25" },
    ]);
    expect((await state(TWICE.id)).finished_on).toBe("2025-03-25");
  });

  test("a book with one read shows no All reads line (AC-4)", ONCE, async ({ page }) => {
    await page.goto("/books/list");
    const row = await expand(page, READ.title);
    await expect(row.getByRole("button", { name: "Finished 17 March 2026" })).toBeVisible();
    await expect(row.getByRole("button", { name: /^All reads/ })).toHaveCount(0);
  });

  test("Read's two pickers and the read list meet the floor at every width: 44px options, focus back, axe, contrast, no sideways scroll (AC-6)", async ({ page }, info) => {
    await page.goto("/books/list");
    const ask = await expand(page, ASK.title);
    const read = ask.getByRole("button", { name: "Read", exact: true });
    await read.click();
    const finished = ask.getByRole("group", { name: "Finished" });
    await expect(finished.getByRole("radio", { name: "Today" })).toBeVisible();
    if (page.viewportSize()!.width < 768) {
      for (const radio of await ask.getByRole("radio").all()) expect((await radio.locator("xpath=..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page)).toEqual([]);
    await ask.scrollIntoViewIfNeeded();
    await screenshot(page, info, "start-dates-read-both");
    await page.keyboard.press("Escape");
    await expect(finished).toHaveCount(0);
    await expect(read).toBeFocused();

    const twice = await expand(page, TWICE.title);
    await twice.getByRole("button", { name: "All reads (2)" }).click();
    const list = twice.getByRole("list", { name: `All reads of ${TWICE.title}` });
    const first = list.getByRole("button", { name: "Started 3 June 2022, read 1" });
    await first.click();
    if (page.viewportSize()!.width < 768) {
      for (const radio of await list.getByRole("radio").all()) expect((await radio.locator("xpath=..").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    // Every control in the list is a real button with a name, at least 24px.
    for (const b of await list.getByRole("button").all()) {
      expect(await b.evaluate((el) => el.tagName)).toBe("BUTTON");
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    }
    await expectNoHorizontalScroll(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page)).toEqual([]);
    await twice.scrollIntoViewIfNeeded();
    await screenshot(page, info, "start-dates-all-reads");
    await page.keyboard.press("Escape");
    await expect(first).toBeFocused();
    // Nothing in the control resolves to --danger.
    const danger = await tokenColour(page, "--danger");
    const hits = await twice.locator("*").evaluateAll((els, d) => els.filter((el) => {
      const cs = getComputedStyle(el);
      return [cs.color, cs.backgroundColor].includes(d);
    }).map((el) => el.className), danger);
    expect(hits).toEqual([]);
  });
});
