// @area: shared
// Task 5.17b, part 2 of 2 (TASK-123; D-132, D-152): *Physical copy* and *Audiobook* in Add books' Search and By
// hand, in a real browser. The two chips are in every mode and keep their choice when you switch (AC-2); a
// result's button and By hand's submit say *Add to Physical copy* / *Add to Audiobook* (AC-3); each add writes
// what the roadmap Check says and its Undo takes back exactly that (AC-1); and Search with a format chosen
// meets the UX floor (AC-5). Search asks Hardcover from the server, where page.route can't see it, so the
// answers are seeded as hardcover_cache rows under the keys the route asks (test/e2e/book-search.spec.ts does
// the same). The books are made here under `E2E Oadd` titles, which no other spec uses, and removed after.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { FLOOR, computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour } from "./helpers";

// Writes: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order", "label",
];

const AUTHOR_ID = "e2e-oadd-author";
const AUTHOR = "E2E Oadd Author";
/** Library books: one with a status, one that has its paper copy already, one to listen to, one only the floor test reads. */
const STATUSED = { id: "e2e-oadd-statused", title: "E2E Oadd Statused", status: "reading" };
const HAS = { id: "e2e-oadd-has-copy", title: "E2E Oadd Has Copy", status: "read" };
const LISTEN = { id: "e2e-oadd-listen", title: "E2E Oadd Listen", status: "to_read" };
const FLOOR_BOOK = { id: "e2e-oadd-floor", title: "E2E Oadd Floor", status: "read" };
/** The Hardcover result: not in the library until an add makes it. */
const HC = { id: 446001, title: "E2E Oadd Hardcover Tale", author: "E2E Oadd Hardcover Author" };
const HC_QUERY = "e2e oadd hardcover";
/** Typed books (By hand), one a test. */
const TYPED = { title: "E2E Oadd Typed", author: "E2E Oadd Typed Author" };
const TYPED_UNDO = { title: "E2E Oadd Typed Undo", author: "E2E Oadd Typed Author" };
const CALIBRE = { title: "E2E Oadd Calibre", author: "E2E Oadd Typed Author" };

const LIBRARY_QUERIES = [STATUSED, HAS, LISTEN, FLOOR_BOOK].map((b) => `search:${b.title.toLowerCase()}`);
const HC_KEY = `search:${HC_QUERY}`;

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
    await sql`DELETE FROM books WHERE title LIKE 'E2E Oadd%' OR hardcover_id = ${HC.id}`;
    await sql`DELETE FROM authors WHERE name LIKE 'E2E Oadd%'`;
    await sql`DELETE FROM hardcover_cache WHERE key = ANY(${[...LIBRARY_QUERIES, HC_KEY]}::text[])`;
  });
}

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    // A day old: a request would rewrite fetched_at, and the placeholder token would be refused.
    for (const key of LIBRARY_QUERIES) {
      await sql`INSERT INTO hardcover_cache (key, body, fetched_at) VALUES (${key}, ${sql.json({ found: 0, hits: [] })}, now() - interval '1 day')`;
    }
    const hit = {
      document: {
        id: String(HC.id), title: HC.title, subtitle: null, author_names: [HC.author], compilation: false, users_count: 12,
        release_year: 2021, pages: 300, image: { url: null }, featured_series: {}, series_names: [], slug: "e2e-oadd-hardcover-tale",
      },
    };
    await sql`INSERT INTO hardcover_cache (key, body, fetched_at)
      VALUES (${HC_KEY}, ${sql.json({ found: 1, hits: [hit] } as never)}, now() - interval '1 day')`;
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR_ID}, ${AUTHOR})`;
    for (const b of [STATUSED, HAS, LISTEN, FLOOR_BOOK]) {
      await sql`INSERT INTO books (id, title, author_id) VALUES (${b.id}, ${b.title}, ${AUTHOR_ID})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
    }
    await sql`INSERT INTO owned_copies (book_id, format) VALUES (${HAS.id}, 'physical')`;
  });
});
test.afterAll(clean);

/** What the library says a book owns, by id or by title. */
const copiesOf = (bookId: string) =>
  withSql((sql) => sql<{ format: string }[]>`SELECT format FROM owned_copies WHERE book_id = ${bookId} ORDER BY format`)
    .then((rows) => rows.map((r) => r.format));
const statusOf = (bookId: string) =>
  withSql((sql) => sql<{ status: string }[]>`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${bookId}`)
    .then((rows) => rows.map((r) => r.status));
/** A book made by an add, found by its title: live or not, its status, its copies. */
const madeBook = (title: string) => withSql((sql) => sql<{ id: string; gone: boolean; status: string | null; copies: string[] }[]>`
  SELECT b.id, b.deleted_at IS NOT NULL AS gone, s.status,
         COALESCE(array_agg(oc.format ORDER BY oc.format) FILTER (WHERE oc.format IS NOT NULL), '{}') AS copies
  FROM books b LEFT JOIN book_status s ON s.book_id = b.id AND s.user_id = ${E2E_USER}
  LEFT JOIN owned_copies oc ON oc.book_id = b.id
  WHERE b.title = ${title} GROUP BY b.id, s.status`);

const addTo = (page: Page) => page.getByRole("group", { name: "Add to" });
const chip = (page: Page, name: string) => addTo(page).getByRole("button", { name, exact: true });
const mode = (page: Page, name: string) => page.getByRole("group", { name: "Add by" }).getByRole("button", { name, exact: true });
const toast = (page: Page) => page.locator(".toast-region");
const toastLabel = (page: Page) => page.locator(".toast-region .toast-label");

/** Opens Add books and waits until its controls answer. */
async function open(page: Page) {
  await page.goto("/books/add");
  await hydrated(mode(page, "Paste a list"));
}

/** Search for `q` (the cache answers it) with `format` chosen in Add to. */
async function search(page: Page, q: string, format: "Physical copy" | "Audiobook") {
  await open(page);
  await chip(page, format).click();
  await expect(chip(page, format)).toHaveAttribute("aria-pressed", "true");
  const box = page.getByRole("searchbox", { name: "Title or author" });
  await box.fill(q);
  await box.press("Enter");
}

const resultButton = (page: Page, says: string, title: string) => page.getByRole("button", { name: `${says}: ${title}`, exact: true });

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

test("Physical copy and Audiobook are in Add to in all three modes, and the choice survives switching (AC-2)", ONCE, async ({ page }) => {
  await open(page);
  // Search, the opening mode, offers both.
  await expect(chip(page, "Physical copy")).toHaveAttribute("aria-pressed", "false");
  await expect(chip(page, "Audiobook")).toHaveAttribute("aria-pressed", "false");

  await mode(page, "Paste a list").click();
  await chip(page, "Physical copy").click();
  await expect(chip(page, "Physical copy")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Audiobook")).toHaveAttribute("aria-pressed", "false");

  for (const next of ["Search", "By hand", "Paste a list", "Search"]) {
    await mode(page, next).click();
    await expect(mode(page, next)).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Physical copy"), `Physical copy in ${next}`).toHaveAttribute("aria-pressed", "true");
    await expect(chip(page, "Audiobook"), `Audiobook in ${next}`).toBeVisible();
    await expect(chip(page, "Someday"), `Someday in ${next}`).toHaveAttribute("aria-pressed", "false");
  }

  // *Coming out* is Search's and By hand's: Paste a list puts it back on Someday, as before.
  await chip(page, "Coming out").click();
  await mode(page, "Paste a list").click();
  await expect(chip(page, "Someday")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "Coming out")).toHaveCount(0);
});

test("Audiobook chosen: a library result says Add to Audiobook, the toast names the book with an Undo, and its Library row ends Audiobook (AC-3)", ONCE, async ({ page }) => {
  await search(page, LISTEN.title, "Audiobook");
  const add = resultButton(page, "Add to Audiobook", LISTEN.title);
  await hydrated(add);
  await add.click();
  await expect(resultButton(page, "Added to Audiobook", LISTEN.title)).toHaveText("✓ Added to Audiobook");
  await expect(toastLabel(page)).toHaveText("Added to Audiobook");
  await expect(toast(page)).toContainText(LISTEN.title);
  await expect(toast(page).getByRole("button", { name: "Undo" })).toBeVisible();
  expect(await copiesOf(LISTEN.id)).toEqual(["audio"]);
  // A book you own is not one you've listed or moved: its status stays.
  expect(await statusOf(LISTEN.id)).toEqual(["to_read"]);

  await page.goto(`/books/list?q=${encodeURIComponent(LISTEN.title)}`);
  const row = page.locator(".book-row").filter({ has: page.locator(".row-title", { hasText: new RegExp(`^${LISTEN.title}$`) }) });
  await expect(row.locator(".row-sub")).toHaveText(`${AUTHOR} · Audiobook`);
});

test("By hand with Physical copy chosen: the submit says Add to Physical copy, and the typed book is Unlisted and Physical in the Library (AC-3, AC-1)", ONCE, async ({ page }) => {
  await open(page);
  await chip(page, "Physical copy").click();
  await mode(page, "By hand").click();
  await expect(chip(page, "Physical copy")).toHaveAttribute("aria-pressed", "true");
  await page.locator("#hand-title").fill(TYPED.title);
  await page.locator("#hand-author").fill(TYPED.author);
  const submit = page.getByRole("button", { name: "Add to Physical copy", exact: true });
  await expect(submit).toBeVisible();
  await submit.click();
  await expect(toastLabel(page)).toHaveText("Added to Physical copy");
  await expect(toast(page)).toContainText(TYPED.title);

  // One unlisted book, with its copy and no plan.
  const [made, ...rest] = await madeBook(TYPED.title);
  expect(rest).toEqual([]);
  expect(made).toMatchObject({ gone: false, status: "unlisted", copies: ["physical"] });

  // The Library lists it under the Unlisted chip and under the Physical one.
  for (const filters of [{ status: "unlisted" }, { owned: "physical" }] as Record<string, string>[]) {
    await page.goto(`/books/list?${new URLSearchParams({ ...filters, q: TYPED.title })}`);
    await expect(page.locator(".book-row .row-title").filter({ hasText: new RegExp(`^${TYPED.title}$`) })).toHaveCount(1);
  }
});

test("a library book with a status gets one physical row and keeps its status; Undo removes the row and nothing else (AC-1)", ONCE, async ({ page }) => {
  await search(page, STATUSED.title, "Physical copy");
  const add = resultButton(page, "Add to Physical copy", STATUSED.title);
  await hydrated(add);
  await add.click();
  await expect(toastLabel(page)).toHaveText("Added to Physical copy");
  expect(await copiesOf(STATUSED.id)).toEqual(["physical"]);
  expect(await statusOf(STATUSED.id)).toEqual(["reading"]);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => copiesOf(STATUSED.id)).toEqual([]);
  expect(await statusOf(STATUSED.id)).toEqual(["reading"]);
  // The result is addable again.
  await expect(resultButton(page, "Add to Physical copy", STATUSED.title)).not.toHaveAttribute("aria-disabled", "true");
});

test("a book that has the paper copy: Undo of an Audiobook add leaves the paper row, and a second Physical add writes nothing and offers no Undo (AC-1)", ONCE, async ({ page }) => {
  await search(page, HAS.title, "Audiobook");
  const add = resultButton(page, "Add to Audiobook", HAS.title);
  await hydrated(add);
  await add.click();
  await expect(toastLabel(page)).toHaveText("Added to Audiobook");
  expect(await copiesOf(HAS.id)).toEqual(["audio", "physical"]);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => copiesOf(HAS.id)).toEqual(["physical"]);

  // It has the paper copy already: nothing is written, the toast says so, and there is nothing to undo.
  await chip(page, "Physical copy").click();
  const again = resultButton(page, "Add to Physical copy", HAS.title);
  await again.click();
  await expect(toastLabel(page)).toHaveText("Already in your library");
  await expect(toast(page)).toContainText(`${HAS.title} · already owned on paper`);
  await expect(toast(page).getByRole("button", { name: "Undo" })).toHaveCount(0);
  expect(await copiesOf(HAS.id)).toEqual(["physical"]);
  expect(await statusOf(HAS.id)).toEqual(["read"]);
});

test("a Hardcover result creates one unlisted book with its physical row; Undo removes what the add made (AC-1)", ONCE, async ({ page }) => {
  await search(page, HC_QUERY, "Physical copy");
  const add = resultButton(page, "Add to Physical copy", HC.title);
  await hydrated(add);
  await add.click();
  await expect(toastLabel(page)).toHaveText("Added to Physical copy");
  const [made, ...rest] = await madeBook(HC.title);
  expect(rest).toEqual([]);
  expect(made).toMatchObject({ gone: false, status: "unlisted", copies: ["physical"] });
  expect(await withSql((sql) => sql`SELECT id FROM books WHERE hardcover_id = ${HC.id} AND deleted_at IS NULL`)).toHaveLength(1);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await madeBook(HC.title))[0]).toMatchObject({ gone: true, status: null, copies: [] });
});

test("a typed book the library lacks creates one unlisted book with its row; Undo removes what the add made (AC-1)", ONCE, async ({ page }) => {
  await open(page);
  await chip(page, "Physical copy").click();
  await mode(page, "By hand").click();
  await page.locator("#hand-title").fill(TYPED_UNDO.title);
  await page.locator("#hand-author").fill(TYPED_UNDO.author);
  await page.getByRole("button", { name: "Add to Physical copy", exact: true }).click();
  await expect(toastLabel(page)).toHaveText("Added to Physical copy");
  expect(await madeBook(TYPED_UNDO.title)).toMatchObject([{ gone: false, status: "unlisted", copies: ["physical"] }]);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => (await madeBook(TYPED_UNDO.title))[0]).toMatchObject({ gone: true, status: null, copies: [] });
});

test("Undo of an add to Someday whose created book has since gained a Calibre id says it couldn't, and changes nothing (AC-1)", ONCE, async ({ page }) => {
  await open(page);
  await mode(page, "By hand").click();
  await page.locator("#hand-title").fill(CALIBRE.title);
  await page.locator("#hand-author").fill(CALIBRE.author);
  await page.getByRole("button", { name: "Add to Someday", exact: true }).click();
  await expect(toastLabel(page)).toHaveText("Added to Someday");
  const [made] = await madeBook(CALIBRE.title);
  expect(made).toMatchObject({ gone: false, status: "to_read" });

  // The library gained a Calibre copy of it meanwhile (a negative id: no real Calibre book has one).
  await withSql((sql) => sql`UPDATE books SET calibre_id = -9411 WHERE id = ${made.id}`);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(toastLabel(page)).toHaveText("Couldn't undo Added to Someday. Nothing changed.");
  expect(await madeBook(CALIBRE.title)).toMatchObject([{ id: made.id, gone: false, status: "to_read" }]);
});

test("Search with Physical copy chosen meets the UX floor: named toggles of 32px or more on a phone, axe, no sideways scroll, nothing on --danger (AC-5)", FLOOR, async ({ page }, info) => {
  await search(page, FLOOR_BOOK.title, "Physical copy");
  await expect(resultButton(page, "Add to Physical copy", FLOOR_BOOK.title)).toBeVisible();
  const phone = (page.viewportSize()?.width ?? 0) < 768;

  // Every Add to choice is a real button with a name and a pressed state; the chosen one is the only one pressed.
  const chips = await addTo(page).getByRole("button").all();
  expect(chips.length).toBeGreaterThanOrEqual(7);
  expect(await addTo(page).getByRole("button", { pressed: true }).allTextContents()).toEqual(["Physical copy"]);
  for (const c of chips) {
    const box = (await c.boundingBox())!;
    // 32px on a phone, as every Add to chip is (design §10: small buttons 32px, 24px absolute floor; owner, TASK-123).
    expect(box.height, await c.innerText()).toBeGreaterThanOrEqual(phone ? 32 : 24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  for (const name of ["Physical copy", "Audiobook"]) {
    const { "background-color": bg, color, "border-color": border } = await computedStyle(chip(page, name), ["background-color", "color", "border-color"]);
    for (const token of ["--danger", "--danger-soft"]) {
      const danger = await tokenColour(page, token);
      expect([bg, color, border], `${name} against ${token}`).not.toContain(danger);
    }
  }
  await floor(page);
  await screenshot(page, info, "add-owned-search");
  // The narrowest phone the design names (360px): the seven chips wrap, nothing scrolls sideways.
  if (info.project.name === "w390-light") {
    await page.setViewportSize({ width: 360, height: 780 });
    await expectNoHorizontalScroll(page);
    await screenshot(page, info, "add-owned-search-360");
  }
});
