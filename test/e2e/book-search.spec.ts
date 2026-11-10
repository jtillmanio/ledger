// Task 1.4f: Add books' *Search* on Hardcover in a real browser (AC-1, AC-6),
// at every width, light and dark. The route asks Hardcover from the server,
// where page.route can't see it, so the recorded answers
// (test/fixtures/hardcover-piranesi.json) are seeded as hardcover_cache rows
// under the keys the route asks, and a 429 is its `hold` row. The server runs
// with a placeholder token (scripts/lib/e2e.mjs), so a search the cache can't
// answer would reach Hardcover, be refused, and show the error state: a
// listing is proof that no request was made. Cover images are answered here.
// This file removes what it makes.
// Task 1.22: it searches as you type (AC-1: `pir` and a pause lists without
// Enter, `pi` asks nothing, `piranesi` typed quickly is one request, counted at
// the browser), and each row's one tag is part of its accessible name (AC-3).
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { easternYear } from "../../src/lib/settings";
import RECORDED from "../fixtures/hardcover-piranesi.json";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order", "label",
];
const SEARCH_KEY = "search:piranesi";
/** What the cache answers `pir` with: the recorded piranesi answer. */
const PIR_KEY = "search:pir";
/** The library book's own search: Hardcover has nothing for it. */
const LIBRARY_KEY = "search:e2e hardcover library";
const ISBN_KEY = "isbn:9781526622426";
/** A search the cache answers with nothing. */
const NOTHING = "zzzz e2e nothing";
/** A library book a rate-limited search still lists. */
const LIBRARY = { id: "e2e-hardcover-library-book", title: "E2E Hardcover Library Book", author: "E2E Hardcover Author" };
const LIBRARY_AUTHOR_ID = "e2e-hardcover-author";
const FIXTURE_IDS = [444001, 444002, 444003, 444004, 444005];
const FIXTURE_AUTHORS = ["susanna-clarke", "luigi-ficacci", "sarah-e-lawrence"];
const PIRANESI_COVER = "https://assets.hardcover.app/edition/444001/piranesi.jpeg";
const recorded = RECORDED as unknown as Record<string, unknown>;

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

async function clean() {
  await withSql(async (sql) => {
    await sql`DELETE FROM books WHERE hardcover_id = ANY(${FIXTURE_IDS}::int[]) OR id = ${LIBRARY.id}`;
    await sql`DELETE FROM authors a WHERE a.id = ANY(${[...FIXTURE_AUTHORS, LIBRARY_AUTHOR_ID]}::text[])
      AND NOT EXISTS (SELECT 1 FROM books b WHERE b.author_id = a.id)`;
    await sql`DELETE FROM hardcover_cache
      WHERE key IN (${SEARCH_KEY}, ${PIR_KEY}, ${LIBRARY_KEY}, ${ISBN_KEY}, ${`search:${NOTHING}`}, 'hold')`;
  });
}

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    // A day old: a request would rewrite fetched_at, so an unchanged one shows none was made.
    const rows = [[SEARCH_KEY, recorded[SEARCH_KEY]], [PIR_KEY, recorded[SEARCH_KEY]], [ISBN_KEY, recorded[ISBN_KEY]],
      [`search:${NOTHING}`, { found: 0, hits: [] }], [LIBRARY_KEY, { found: 0, hits: [] }]];
    for (const [key, body] of rows) {
      await sql`INSERT INTO hardcover_cache (key, body, fetched_at)
        VALUES (${key as string}, ${sql.json(body as never)}, now() - interval '1 day')`;
    }
    await sql`INSERT INTO authors (id, name) VALUES (${LIBRARY_AUTHOR_ID}, ${LIBRARY.author})`;
    await sql`INSERT INTO books (id, title, author_id) VALUES (${LIBRARY.id}, ${LIBRARY.title}, ${LIBRARY_AUTHOR_ID})`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${LIBRARY.id}, 'to_read')`;
  });
});
test.afterAll(clean);

test.beforeEach(async ({ page }) => {
  // The recorded covers live on Hardcover's host: answered here, so no image request leaves the machine.
  await page.route("https://assets.hardcover.app/**", (route) => route.fulfill({
    status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"/>',
  }));
});

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

/** Open Add books (Search is selected) and submit a search; `typed`, type it and let the pause search instead. */
async function search(page: Page, q: string, { open = true, typed = false } = {}) {
  if (open) await page.goto("/books/add");
  const box = page.getByRole("searchbox", { name: "Title or author" });
  await hydrated(box);
  if (!typed) {
    await box.fill(q);
    await box.press("Enter");
    return;
  }
  await box.fill("");
  await box.pressSequentially(q, { delay: 40 });
}

/** The browser's requests to the search route from now on. */
function searchRequests(page: Page) {
  const seen: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/books/search") seen.push(JSON.parse(r.postData() ?? "{}").q);
  });
  return seen;
}

const fromHardcover = (page: Page) => page.getByRole("list", { name: "From Hardcover" });
const statusLine = (page: Page) => page.locator("#book-search-wait .statusline");
const searchRow = (sql: TestSql) => sql<{ fetched_at: Date }[]>`SELECT fetched_at FROM hardcover_cache WHERE key = ${SEARCH_KEY}`;

test("searching piranesi lists Hardcover's books under From Hardcover, no compilation, and meets the UX floor (AC-1, AC-6)", async ({ page }, info) => {
  await search(page, "piranesi");
  await expect(page.getByRole("heading", { name: /^From Hardcover/ })).toBeVisible();
  const rows = fromHardcover(page).getByRole("listitem");
  await expect(rows).toHaveCount(3);
  // The recorded compilation is not listed, nor the book with no author.
  await expect(page.getByText("Piranesi & Jonathan Strange and Mr Norrell")).toHaveCount(0);
  await expect(rows.first()).toContainText("Susanna Clarke · 272 pages");
  await expect(rows.first().locator(".tag")).toHaveText(["Hardcover"]);
  await expect(rows.first()).toContainText("est 75k words");
  await expect(rows.nth(2)).toContainText("Sarah E. Lawrence and John Wilton-Ely");
  // The subtitle follows the title, and the add button names the book with it.
  await expect(rows.nth(1).locator(".rsub")).toHaveText("The Complete Etchings");
  // It flows after the title in one run of text and wraps with it: never a column of its own beside the title.
  expect(await rows.nth(1).locator(".rsub").evaluate((el) => ({
    sameParent: el.parentElement === el.parentElement!.querySelector(".rt")!.parentElement,
    flex: getComputedStyle(el.parentElement!).display.includes("flex"),
  }))).toEqual({ sameParent: true, flex: false });
  await expect(page.getByRole("button", { name: "Add to Someday: Piranesi: The Complete Etchings", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to Someday: Piranesi", exact: true })).toBeVisible();
  await expect(page.getByText("Matched against your library first, then Hardcover. Searches as you type.")).toBeVisible();
  for (const target of await page.locator(".pane-search button, .pane-search input").all()) {
    if (!(await target.isVisible())) continue;
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  }
  await expect(statusLine(page)).toHaveCount(0);
  // A search result carries no status control (task 1.17b, D-131): its one verb is the add button.
  await expect(page.locator("main .status-toggle, main .status-group")).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "book-search-results");
});

test("a recorded 429 shows the rate-limited state while your library's books still list (AC-1, AC-6)", async ({ page }, info) => {
  await withSql((sql) => sql`INSERT INTO hardcover_cache (key, body) VALUES ('hold', ${sql.json({ retryAfter: 600 })})
    ON CONFLICT (key) DO UPDATE SET body = EXCLUDED.body, fetched_at = now()`);
  try {
    // Typed, not entered: the pause meets the 429 the way Enter did (task 1.22, AC-4).
    // Not a query the cache answers: a cached one never meets the hold.
    await search(page, "e2e hardcover library book", { typed: true });
    await expect(statusLine(page)).toContainText(/Hardcover is busy\. Retrying in \d+s\./);
    await expect(page.getByRole("list", { name: "In your library" }).getByRole("listitem")).toContainText([LIBRARY.title]);
    await expect(fromHardcover(page)).toHaveCount(0);
    await floor(page);
    await screenshot(page, info, "book-search-rate-limited");
  } finally {
    await withSql((sql) => sql`DELETE FROM hardcover_cache WHERE key = 'hold'`);
  }
});

test("a search with no results says so, with By hand (AC-6)", async ({ page }, info) => {
  await search(page, NOTHING);
  await expect(statusLine(page)).toContainText(`Nothing in your library or on Hardcover for ${NOTHING}.`);
  await expect(statusLine(page).getByRole("button", { name: "Add it by hand" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "book-search-nothing");
});

test("an ISBN-13 lists one result (AC-1)", ONCE, async ({ page }) => {
  await search(page, "978-1-5266-2242-6");
  await expect(fromHardcover(page).getByRole("listitem")).toHaveCount(1);
  await expect(fromHardcover(page)).toContainText("Piranesi");
  await expect(fromHardcover(page)).toContainText("Susanna Clarke");
  await expect(statusLine(page)).toHaveCount(0);
});

test("adding one creates one books row with hardcover_id and its cover; adding it again reuses it and says so; the same search again makes no request (AC-1)", ONCE, async ({ page }) => {
  const before = await withSql(searchRow);
  await search(page, "piranesi");
  const add = page.getByRole("button", { name: "Add to Someday: Piranesi", exact: true });
  await hydrated(add);
  await add.click();
  await expect(page.getByRole("button", { name: "Added to Someday: Piranesi", exact: true })).toHaveText("✓ Added to Someday");
  const created = await withSql((sql) => sql`
    SELECT b.id, b.title, b.hardcover_id, b.cover_url, b.page_count, b.published_year, s.status
    FROM books b LEFT JOIN book_status s ON s.book_id = b.id AND s.user_id = ${E2E_USER}
    WHERE b.hardcover_id = 444001 AND b.deleted_at IS NULL`);
  expect(created).toEqual([{ id: "piranesi-susanna-clarke", title: "Piranesi", hardcover_id: 444001,
    cover_url: PIRANESI_COVER, page_count: 272, published_year: 2020, status: "to_read" }]);

  // The same search again, typed this time: your copy now, Hardcover's not offered twice, and from the cache (AC-4).
  await search(page, "piranesi", { open: false, typed: true });
  const library = page.getByRole("list", { name: "In your library" });
  await expect(library.getByRole("listitem")).toHaveCount(1);
  await expect(fromHardcover(page).getByRole("listitem")).toHaveCount(2);
  await expect(statusLine(page)).toHaveCount(0);
  await library.getByRole("button", { name: "Add to Someday: Piranesi", exact: true }).click();
  await expect(page.locator(".toast-label")).toHaveText("Already in your library");
  expect(await withSql((sql) => sql`SELECT id FROM books WHERE hardcover_id = 444001`)).toHaveLength(1);

  const after = await withSql(searchRow);
  expect(after).toEqual(before);
  expect(await withSql((sql) => sql`SELECT key FROM hardcover_cache WHERE key LIKE 'search:%' ORDER BY key`))
    .toEqual([{ key: LIBRARY_KEY }, { key: PIR_KEY }, { key: SEARCH_KEY }, { key: `search:${NOTHING}` }]);
});

test("a result's Year or quarter… adds the book at the end of a quarter, and Undo makes the row addable again (task 2.3, AC-4)", ONCE, async ({ page }) => {
  const year = easternYear() + 1;
  const period = `${year}-Q2`;
  const plan = () => withSql((sql) => sql`SELECT period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${LIBRARY.id}`);
  const status = () => withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${LIBRARY.id}`);
  const last = () => withSql((sql) => sql`SELECT COALESCE(MAX(ordinal), 0)::int AS n FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${period}`)
    .then((rows) => rows[0].n as number);
  const placed = await last();

  await search(page, "e2e hardcover library");
  const row = page.getByRole("list", { name: "In your library" }).getByRole("listitem");
  const secondary = row.getByRole("button", { name: `Year or quarter…: ${LIBRARY.title}`, exact: true });
  await hydrated(secondary);
  await secondary.click();
  // A book not planned yet: the sheet has no *currently planned* badge.
  const sheet = page.getByRole("dialog", { name: LIBRARY.title });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".bdg")).toHaveCount(0);
  await sheet.getByRole("button", { name: new RegExp(`^${year}`) }).click();
  await sheet.getByRole("group", { name: `Quarter of ${year}` }).getByRole("button", { name: /^Q2/ }).click();
  await sheet.getByRole("button", { name: `Add to Q2 ${year}`, exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row.getByRole("button", { name: `Added to Q2 ${year}: ${LIBRARY.title}`, exact: true })).toHaveText(`✓ Added to Q2 ${year}`);
  await expect(page.locator(".toast-label")).toHaveText(`Added to Q2 ${year}`);
  // The book is last in the quarter, still to read.
  expect(await plan()).toEqual([{ period, ordinal: placed + 1 }]);
  expect(await status()).toEqual([{ status: "to_read" }]);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(plan).toEqual([]);
  // The row can be added again, to the default, without searching again.
  await expect(row.getByRole("button", { name: `Add to Someday: ${LIBRARY.title}`, exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await expect(row.getByRole("button", { name: `Year or quarter…: ${LIBRARY.title}`, exact: true })).not.toHaveAttribute("aria-disabled", "true");
});

test("typing pir and pausing lists results without Enter; pi asks nothing; piranesi typed quickly is one request (task 1.22, AC-1)", CORE, async ({ page }, info) => {
  await page.goto("/books/add");
  const box = page.getByRole("searchbox", { name: "Title or author" });
  await hydrated(box);
  const requests = searchRequests(page);
  await box.pressSequentially("pi", { delay: 60 });
  await page.waitForTimeout(900);
  expect(requests).toEqual([]);
  await expect(fromHardcover(page)).toHaveCount(0);

  await box.press("r");
  // Listed without Enter. (Once the add below has run, Piranesi itself is under In your library.)
  await expect(page.getByRole("listitem", { name: "Piranesi The Complete Etchings Hardcover", exact: true })).toBeVisible();
  expect(requests).toEqual(["pir"]);
  await expect(statusLine(page)).toHaveCount(0);
  await screenshot(page, info, "book-search-as-you-type");

  // Two characters again: the list clears, and nothing is asked.
  await box.press("Backspace");
  await expect(fromHardcover(page)).toHaveCount(0);
  await box.fill("");
  await box.pressSequentially("piranesi", { delay: 60 });
  await expect(page.getByRole("listitem", { name: "Piranesi The Complete Etchings Hardcover", exact: true })).toBeVisible();
  await page.waitForTimeout(900);
  expect(requests).toEqual(["pir", "piranesi"]);
});

test("a library row's tag says where it sits and a Hardcover row's says Hardcover, each part of the row's name (task 1.22, AC-3)", async ({ page }, info) => {
  await search(page, "piranesi");
  // Piranesi itself, once the add has run, is yours: Someday, under In your library.
  await expect(page.getByRole("listitem", { name: /^Piranesi (Hardcover|Someday)$/ })).toBeVisible();
  await expect(fromHardcover(page).getByRole("listitem", { name: "Piranesi The Complete Etchings Hardcover", exact: true }))
    .toBeVisible();
  await expect(page.getByRole("heading", { name: /^From Hardcover/ })).toBeVisible();

  await search(page, "e2e hardcover library", { open: false, typed: true });
  const library = page.getByRole("list", { name: "In your library" });
  await expect(library.getByRole("listitem", { name: `${LIBRARY.title} Someday`, exact: true })).toBeVisible();
  await expect(library.getByRole("listitem").locator(".tag")).toHaveText(["Someday"]);
  await expect(page.getByRole("heading", { name: /^In your library/ })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "book-search-library-tag");
});
