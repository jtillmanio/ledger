// Task 5.1, 2 of 3 (TASK-096; D-26, D-139, R1-06, R1-07): the Shelves list and a shelf's page in a real
// browser, on the TEST database. The list row reads `read / total`, its meter fills with --ready, and it
// names the next three unread in shelf order (design § 14 → Shelves); a shelf with every book read names
// none. A shelf's page draws its description only when it has one; a note saves in place, survives a
// reload and renders under its row, and the same book on another shelf shows none (the roadmap's
// **Check (the context part)**). *Move to top* reorders without a reload, the order survives one, and
// Undo puts it back. Shelves is current in the tab row, the rail and the sidebar on both routes, and
// *+ Add to shelf* opens Add books with the shelf chosen. *+ New shelf* makes one, Undo removes it, a name
// in use says why. The UX floor: axe, contrast, 24px targets, no sideways scroll, nothing red, the empty
// shelf, reduced motion, screenshots.
//
// The shelves and books are made here, under E2E ids no other spec uses, and removed after the last
// test; each test starts from the same rows.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import ListLoading from "../../src/app/books/shelves/loading";
import ShelfLoading from "../../src/app/books/shelves/[id]/loading";
import { testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Writes, and what it checks doesn't change with the width: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-sh-author", name: "E2E Sh Author" };
const WORDS = ["One", "Two", "Three", "Four", "Five", "Six"];
const BOOKS = WORDS.map((w, i) => ({ id: `e2e-sh-${i + 1}`, title: `E2E Sh Book ${w}` }));
const [B1, B2, B3, B4, B5, B6] = BOOKS;
const IDS = BOOKS.map((b) => b.id);
const DESCRIPTION = "The order to read them in, tie-ins where they fall.";
// Five books, the 1st and 3rd read; every book read; no description, sharing Book Two with Five; no books.
const FIVE = { id: "e2e-sh-five", name: "E2E Sh Five", books: [B1, B2, B3, B4, B5] };
const DONE = { id: "e2e-sh-done", name: "E2E Sh Done", books: [B1, B3] };
const BARE = { id: "e2e-sh-bare", name: "E2E Sh Bare", books: [B2, B6] };
const EMPTY = { id: "e2e-sh-empty", name: "E2E Sh Empty", books: [] as typeof BOOKS };
const SHELVES = [FIVE, DONE, BARE, EMPTY];
const NEW_NAME = "E2E Sh Made Here";

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Shelf rows and follows go with their shelf (ON DELETE CASCADE).
const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM shelves WHERE id = ANY(${SHELVES.map((s) => s.id)}::text[])
              OR (user_id = ${E2E_USER} AND name = ${NEW_NAME})`;
  await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    for (const b of BOOKS) await sql`INSERT INTO books (id, title, author_id) VALUES (${b.id}, ${b.title}, ${AUTHOR.id})`;
    for (const b of [B1, B3]) {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${b.id}, 'read', '2026-01-15', 'exact')`;
    }
    for (const b of [B2, B4, B5, B6]) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
  });
});
test.afterAll(clean);

// Every test starts from the same shelves: Five's description, no notes, the order as listed, no follow.
test.beforeEach(async () => {
  await withSql(async (sql) => {
    await sql`DELETE FROM shelves WHERE id = ANY(${SHELVES.map((s) => s.id)}::text[])
                OR (user_id = ${E2E_USER} AND name = ${NEW_NAME})`;
    for (const s of SHELVES) {
      await sql`INSERT INTO shelves (id, name, user_id, kind, description)
                VALUES (${s.id}, ${s.name}, ${E2E_USER}, 'books', ${s === FIVE ? DESCRIPTION : null})`;
      for (const [i, b] of s.books.entries()) {
        await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${s.id}, ${b.id}, ${i + 1})`;
      }
    }
  });
});

const stored = (shelf: string) => withSql(async (sql) =>
  (await sql<{ book_id: string }[]>`
    SELECT book_id, note FROM shelf_books WHERE shelf_id = ${shelf} ORDER BY ordinal, book_id`).map((r) => r.book_id));
const noteOf = (shelf: string, book: string) => withSql(async (sql) =>
  (await sql<{ note: string | null }[]>`SELECT note FROM shelf_books WHERE shelf_id = ${shelf} AND book_id = ${book}`)[0]?.note ?? null);

const listRow = (page: Page, name: string) => page.locator(".shelf-rows > li").filter({ has: page.getByRole("link", { name, exact: true }) });
const bookRows = (page: Page) => page.locator(".shelf-books ol.queue > li");

async function open(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing in the page's main resolves to --danger: a shelf is no error.
  const danger = await tokenColour(page, "--danger");
  const red = await page.locator("main").evaluate((main, d) => [...main.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor].includes(d);
  }).map((el) => el.outerHTML.slice(0, 80)), danger);
  expect(red).toEqual([]);
  // Every control a real, named button or link, at least 24px.
  const small = await page.locator("main").evaluate((main) => [...main.querySelectorAll("a[href], button, input, textarea")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      if (el.matches("input[type=radio]")) return false; // the radio's 32px label is its target
      return r.width < 24 || r.height < 24;
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
}

test("the list: 2 / 5, a meter filled with --ready, and the next three unread in shelf order; an all-read shelf names none (AC-2)", FLOOR, async ({ page }) => {
  await open(page, "/books/shelves");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Shelves");
  const five = listRow(page, FIVE.name);
  await expect(five.locator(".rm")).toHaveText("2 / 5");
  await expect(five.locator(".shelf-next li")).toHaveText([B2.title, B4.title, B5.title]);
  const fill = five.locator(".meter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await five.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width / track.width - 0.4)).toBeLessThan(0.02);

  const done = listRow(page, DONE.name);
  await expect(done.locator(".rm")).toHaveText("2 / 2");
  await expect(done.locator(".shelf-next li")).toHaveCount(0);
  await expect(done.locator(".rs")).toHaveText(/All read/);
  // A row opens its shelf.
  await five.getByRole("link", { name: FIVE.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/shelves/${FIVE.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(FIVE.name);
});

test("a note saves in place, survives a reload and renders under its row; the shelf with no description draws no line for one; another shelf holding the book shows no note (AC-1)", ONCE, async ({ page }) => {
  await open(page, `/books/shelves/${FIVE.id}`);
  await expect(page.locator(".shelf-desc")).toHaveText(DESCRIPTION);
  const two = bookRows(page).nth(1);
  await expect(two.locator(".qtitle")).toHaveText(B2.title);
  const add = two.getByRole("button", { name: `Add a note on ${B2.title}` });
  await hydrated(add);
  await add.click();
  const field = page.getByRole("textbox", { name: `Note on ${B2.title}` });
  await expect(field).toBeFocused();
  await field.fill("After Book One: sets up the Wolves");
  // Blur saves: no Save button.
  await page.getByRole("heading", { level: 1 }).click();
  await expect(two.locator(".shelf-note")).toHaveText("After Book One: sets up the Wolves");
  await expect.poll(() => noteOf(FIVE.id, B2.id)).toBe("After Book One: sets up the Wolves");
  await expect(page.locator(".toast")).toContainText(`Saved the note on ${B2.title}`);

  await page.reload();
  await expect(bookRows(page).nth(1).locator(".shelf-note")).toHaveText("After Book One: sets up the Wolves");

  // Bare holds Book Two too, and has no description: no note, and no description line, not even an empty one.
  await open(page, `/books/shelves/${BARE.id}`);
  await expect(bookRows(page).first().locator(".qtitle")).toHaveText(B2.title);
  await expect(bookRows(page).first().locator(".shelf-note")).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Add a note on ${B2.title}` })).toBeVisible();
  await expect(page.locator(".shelf-desc")).toHaveCount(0);
  // Nothing empty sits between the name and what follows it.
  const empties = await page.locator("main .shelf-headtext > *").evaluateAll((els) =>
    els.filter((el) => !(el.textContent ?? "").trim()).map((el) => el.outerHTML.slice(0, 80)));
  expect(empties).toEqual([]);
  expect(await noteOf(BARE.id, B2.id)).toBeNull();
});

test("Esc leaves a note as it was; Undo takes a saved note back off (AC-1)", ONCE, async ({ page }) => {
  await open(page, `/books/shelves/${FIVE.id}`);
  const add = page.getByRole("button", { name: `Add a note on ${B4.title}` });
  await hydrated(add);
  await add.click();
  const field = page.getByRole("textbox", { name: `Note on ${B4.title}` });
  await field.fill("Not this");
  await field.press("Escape");
  await expect(add).toBeFocused();
  expect(await noteOf(FIVE.id, B4.id)).toBeNull();

  await add.click();
  await field.fill("Read it in winter");
  await field.press("Enter");
  await expect(page.getByRole("button", { name: `Note on ${B4.title}: Read it in winter` })).toBeFocused();
  await expect.poll(() => noteOf(FIVE.id, B4.id)).toBe("Read it in winter");
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => noteOf(FIVE.id, B4.id)).toBeNull();
  await expect(page.getByRole("button", { name: `Add a note on ${B4.title}` })).toBeVisible();
});

test("a description is written in place, and clearing it leaves no line (AC-1)", ONCE, async ({ page }) => {
  await open(page, `/books/shelves/${BARE.id}`);
  const add = page.getByRole("button", { name: `Add a description of ${BARE.name}` });
  await hydrated(add);
  await add.click();
  await page.getByRole("textbox", { name: `Description of ${BARE.name}` }).fill("Twos and sixes");
  await page.getByRole("textbox", { name: `Description of ${BARE.name}` }).press("Enter");
  await expect(page.locator(".shelf-desc")).toHaveText("Twos and sixes");
  await page.reload();
  await expect(page.locator(".shelf-desc")).toHaveText("Twos and sixes");
  const desc = page.getByRole("button", { name: `Description of ${BARE.name}: Twos and sixes` });
  await hydrated(desc);
  await desc.click();
  await page.getByRole("textbox", { name: `Description of ${BARE.name}` }).fill("");
  await page.getByRole("textbox", { name: `Description of ${BARE.name}` }).press("Enter");
  await expect(page.locator(".shelf-desc")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".shelf-desc")).toHaveCount(0);
});

test("Move to top puts the last book first without a reload, and the order survives one (AC-3)", ONCE, async ({ page }) => {
  await open(page, `/books/shelves/${FIVE.id}`);
  const before = FIVE.books.map((b) => b.title);
  await expect(bookRows(page).locator(".qtitle")).toHaveText(before);
  const more = page.getByRole("button", { name: `More for ${B5.title}` });
  await hydrated(more);
  const loads = await page.evaluate(() => performance.getEntriesByType("navigation").length);
  await more.click();
  await page.getByRole("menuitem", { name: "Move to top" }).click();
  const after = [B5, B1, B2, B3, B4].map((b) => b.title);
  await expect(bookRows(page).locator(".qtitle")).toHaveText(after);
  expect(await page.evaluate(() => performance.getEntriesByType("navigation").length)).toBe(loads);
  await expect.poll(() => stored(FIVE.id)).toEqual([B5, B1, B2, B3, B4].map((b) => b.id));
  await expect(page.locator(".toast")).toContainText(`Moved ${B5.title}`);

  await page.reload();
  await expect(bookRows(page).locator(".qtitle")).toHaveText(after);
});

test("Undo straight after Move to top restores the original order on screen and in the database (AC-3)", ONCE, async ({ page }) => {
  await open(page, `/books/shelves/${FIVE.id}`);
  const more = page.getByRole("button", { name: `More for ${B5.title}` });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Move to top" }).click();
  await expect.poll(() => stored(FIVE.id)).toEqual([B5, B1, B2, B3, B4].map((b) => b.id));
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(bookRows(page).locator(".qtitle")).toHaveText(FIVE.books.map((b) => b.title));
  await expect.poll(() => stored(FIVE.id)).toEqual(FIVE.books.map((b) => b.id));
});

test("Shelves is current in the nav on the list and on a shelf's page; + Add to shelf opens Add books with that shelf chosen (AC-4)", FLOOR, async ({ page }) => {
  for (const url of ["/books/shelves", `/books/shelves/${FIVE.id}`]) {
    await open(page, url);
    // The phone's tab row, the tablet's rail or the desktop's sidebar: whichever this width draws.
    const current = page.locator('a[aria-current="page"][href="/books/shelves"]').filter({ visible: true });
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Shelves");
  }
  const add = page.getByRole("link", { name: "+ Add to shelf" });
  await expect(add).toHaveAttribute("href", `/books/add?shelf=${FIVE.id}`);
  await add.click();
  await expect(page).toHaveURL(new RegExp(`/books/add\\?shelf=${FIVE.id}$`));
  await expect(page.getByRole("button", { name: FIVE.name, pressed: true })).toBeVisible();
});

test("+ New shelf makes one and Undo removes it; a name in use writes nothing and says why", ONCE, async ({ page }) => {
  await open(page, "/books/shelves");
  const count = () => withSql(async (sql) =>
    Number((await sql`SELECT count(*) FROM shelves WHERE user_id = ${E2E_USER} AND name = ${NEW_NAME}`)[0].count));
  const open_ = page.getByRole("button", { name: "+ New shelf" });
  await hydrated(open_);
  await open_.click();
  const name = page.getByRole("textbox", { name: "Shelf name" });
  await expect(name).toBeFocused();
  await name.fill(NEW_NAME);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("link", { name: NEW_NAME, exact: true })).toBeVisible();
  expect(await count()).toBe(1);
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("link", { name: NEW_NAME, exact: true })).toHaveCount(0);
  await expect.poll(count).toBe(0);

  // A name you already have, in another case: refused, with the reason under the field.
  await page.getByRole("button", { name: "+ New shelf" }).click();
  await name.fill(FIVE.name.toUpperCase());
  await page.getByRole("button", { name: "Create" }).click();
  const why = page.locator("#new-shelf-why");
  await expect(why).toContainText(`You already have a shelf called ${FIVE.name}.`);
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAttribute("aria-describedby", "new-shelf-why");
  expect(await withSql(async (sql) =>
    Number((await sql`SELECT count(*) FROM shelves WHERE user_id = ${E2E_USER} AND lower(name) = lower(${FIVE.name})`)[0].count))).toBe(1);
});

test("the floor on the list and a shelf's page: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page, "/books/shelves");
  await floor(page);
  await screenshot(page, info, "shelves-list");

  await open(page, `/books/shelves/${FIVE.id}`);
  await hydrated(page.getByRole("button", { name: `More for ${B5.title}` }));
  await floor(page);
  // Reduced motion: no row transition while one moves (the w390-reduced-motion project).
  if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    const durations = await bookRows(page).evaluateAll((lis) => lis.map((li) => getComputedStyle(li).transitionDuration));
    expect(durations.every((d) => d.split(",").every((x) => parseFloat(x) === 0))).toBe(true);
  }
  await screenshot(page, info, "shelf-page");
});

// An empty state is a feel-pass surface (design § 10): `@feel` runs it at 412px too, so the screenshots
// cover every `ui.viewports` width.
test("an empty shelf: one primary action, + Add to shelf, and no list; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await open(page, `/books/shelves/${EMPTY.id}`);
  const slate = page.locator(".slate");
  await expect(slate).toContainText("Nothing on this shelf yet");
  await expect(page.getByRole("link", { name: "+ Add to shelf" })).toHaveCount(1);
  await expect(slate.getByRole("link", { name: "+ Add to shelf" })).toBeVisible();
  await expect(bookRows(page)).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "shelf-empty");
});

// A skeleton is rendered to static markup and put in place of the loaded page's <main>, so it gets the
// real CSS, fonts and width; its first row is measured against a loaded row of the same lines: Done's
// (one *All read* line) on the list, Book One's (title, author and status, *Add a note*) on a shelf.
test("each loading skeleton's row is the loaded row's size, within 2px (AC-6)", FLOOR, async ({ page }) => {
  const cases = [
    {
      url: "/books/shelves", Loading: ListLoading, rows: ".shelf-rows > li", loaded: () => listRow(page, DONE.name),
      ready: () => page.getByRole("button", { name: "+ New shelf" }),
    },
    {
      url: `/books/shelves/${FIVE.id}`, Loading: ShelfLoading, rows: ".shelf-books ol.queue > li", loaded: () => bookRows(page).first(),
      ready: () => page.getByRole("button", { name: `More for ${B5.title}` }),
    },
  ];
  for (const c of cases) {
    await open(page, c.url);
    // Swapped before hydration, the markup no longer matches and React regenerates the page over the skeleton.
    await hydrated(c.ready());
    const loaded = (await c.loaded().boundingBox())!;
    const html = renderToStaticMarkup(createElement(c.Loading));
    await page.evaluate((markup) => { document.querySelector("main")!.outerHTML = markup; }, html);
    const sk = (await page.locator(c.rows).first().boundingBox())!;
    expect(Math.abs(sk.height - loaded.height), `${c.url}: skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
    expect(Math.abs(sk.width - loaded.width), `${c.url} width`).toBeLessThanOrEqual(2);
  }
});

// The page streams behind its loading.tsx, so the status is sent before the lookup: the page is Next's not-found.
test("a shelf that isn't one renders the not-found page", ONCE, async ({ page }) => {
  await page.goto("/books/shelves/e2e-sh-nope");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator(".shelf-page")).toHaveCount(0);
});
