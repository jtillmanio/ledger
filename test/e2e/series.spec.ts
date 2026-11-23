// @area: books
// Task 5.9, 1 of 2 (TASK-101; D-26, D-90, R1-06): the Series list in a real browser, on the TEST database. A
// row reads `read / total`, its meter fills with --ready, and it names the lowest-position unread book; a
// complete series names none; one with more read than its stated total reads `4 / 3` with a full meter.
// The rows come in progress first, then not started, then complete. Series is current in the tab row, the
// rail and the sidebar. The UX floor: axe, contrast, 24px targets, no sideways scroll, nothing red, the
// empty and error states in place, the loading skeleton at the loaded size, screenshots.
//
// Task 5.9, 2 of 3 (TASK-102; F-38, D-117, D-118, D-127): each row's name links to the series' own page,
// /books/series/<id>, which lists only that series' books in order with their status, marks the next unread,
// draws a grey gap row for each position the series states and the library lacks (its *Add* opens Add books with
// the series' name), and places 2.2c's follow control (a write saves at once, survives a reload, and its Undo
// puts the prior state back; *Not following* is a stored off that series_progress reads as NULL). A series with no
// live books is an empty slate; an unknown id is the not-found page. The same floor, at every width.
//
// The series and books are made here, under E2E ids no other spec uses, and removed after the last test.
// The database holds real series too, so rows are found by name, never by index on the whole list.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import SeriesDetailError from "../../src/app/books/series/[id]/error";
import SeriesDetailLoading from "../../src/app/books/series/[id]/loading";
import SeriesError from "../../src/app/books/series/error";
import SeriesList from "../../src/components/SeriesList";
import SeriesLoading from "../../src/app/books/series/loading";
import { testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

const AUTHOR = { id: "e2e-se-author", name: "E2E Se Author" };
type Book = { id: string; title: string; pos: number; status: "read" | "reading" | "to_read" | null; deleted?: boolean };
const book = (series: string, n: number, status: Book["status"]): Book =>
  ({ id: `e2e-se-${series}-${n}`, title: `E2E Se ${series} Book ${n}`, pos: n, status });
// 3 of 5 stated, the next one the 4th; nothing read of 2 listed (no stated total); every book read; 4 read of a stated 3.
const PART = { id: "e2e-se-part", name: "E2E Se Part", total: 5 as number | null,
  books: [book("part", 1, "read"), book("part", 2, "read"), book("part", 3, "read"), book("part", 4, "to_read"), book("part", 5, null)] };
const NONE = { id: "e2e-se-none", name: "E2E Se None", total: null, books: [book("none", 1, "to_read"), book("none", 2, null)] };
const DONE = { id: "e2e-se-done", name: "E2E Se Done", total: null, books: [book("done", 1, "read"), book("done", 2, "read")] };
const OVER = { id: "e2e-se-over", name: "E2E Se Over", total: 3 as number | null,
  books: [book("over", 1, "read"), book("over", 2, "read"), book("over", 3, "read"), book("over", 4, "read")] };
const SERIES = [PART, NONE, DONE, OVER];

// The series' own page (TASK-102), under names the list's order test (E2E Se) doesn't see.
const pbook = (series: string, n: number, status: Book["status"], deleted = false): Book =>
  ({ id: `e2e-sp-${series}-${n}`, title: `E2E Sp ${series} Book ${n}`, pos: n, status, deleted });
// Positions 1 (read), 2 (reading) and 4 (no status) of a stated 4: #3 is a gap and #4 the next unread (#2 is in hand).
const GAP = { id: "e2e-sp-gap", name: "E2E Sp Gap", total: 4 as number | null,
  books: [pbook("gap", 1, "read"), pbook("gap", 2, "reading"), pbook("gap", 4, null)] };
// No stated total: positions 1 and 4 draw no gap rows.
const OPEN = { id: "e2e-sp-open", name: "E2E Sp Open", total: null,
  books: [pbook("open", 1, "to_read"), pbook("open", 4, null)] };
// A removed book: its position (2) is a gap and it is on no count.
const SOFT = { id: "e2e-sp-soft", name: "E2E Sp Soft", total: 3 as number | null,
  books: [pbook("soft", 1, "read"), pbook("soft", 2, "read", true), pbook("soft", 3, null)] };
// A stated total and no book at all: the empty state, no gap rows.
const EMPTY = { id: "e2e-sp-empty", name: "E2E Sp Empty", total: 2 as number | null, books: [] as Book[] };
// 1 of 3 read: part-read, so the middle choice reads On hold. The follow tests write to it.
const FOLLOW = { id: "e2e-sp-follow", name: "E2E Sp Follow", total: 3 as number | null,
  books: [pbook("follow", 1, "read"), pbook("follow", 2, null), pbook("follow", 3, null)] };
const PAGES = [GAP, OPEN, SOFT, EMPTY, FOLLOW];
const ALL = [...SERIES, ...PAGES];
const IDS = ALL.flatMap((s) => s.books.map((b) => b.id));

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
  // Follows go with their series (ON DELETE CASCADE).
  await sql`DELETE FROM book_series WHERE id = ANY(${ALL.map((s) => s.id)}::text[])`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    for (const s of ALL) {
      await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${s.id}, ${s.name}, ${AUTHOR.id}, ${s.total})`;
      for (const b of s.books) {
        await sql`INSERT INTO books (id, title, author_id, series_id, series_position, deleted_at)
                  VALUES (${b.id}, ${b.title}, ${AUTHOR.id}, ${s.id}, ${b.pos}, ${b.deleted ? new Date() : null})`;
        if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
      }
    }
  });
});
test.afterAll(clean);

const rows = (page: Page) => page.locator(".series-rows > li");
const rowOf = (page: Page, name: string) => rows(page).filter({ has: page.locator(".rt", { hasText: new RegExp(`^${name}$`) }) });

async function open(page: Page) {
  await page.goto("/books/series");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Series");
  await expect(rowOf(page, PART.name)).toHaveCount(1);
}

/**
 * Puts a state's static markup in place of the loaded page's <main>, so it gets the real CSS, fonts and width.
 * Swapped before hydration, the markup no longer matches and React regenerates the page over it.
 */
async function swapMain(page: Page, markup: string) {
  await hydrated(rows(page).first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing in the page's main resolves to --danger: a series is no error.
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
      return (r.width !== 0 || r.height !== 0) && (r.width < 24 || r.height < 24);
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
}

test("a part-read series reads 3 / 5, its meter filled with --ready, and names the lowest-position unread book (AC-1)", FLOOR, async ({ page }) => {
  await open(page);
  const part = rowOf(page, PART.name);
  await expect(part.locator(".rm")).toHaveText("3 / 5");
  await expect(part.locator(".rs").first()).toHaveText(AUTHOR.name);
  await expect(part.locator(".series-next")).toHaveText(`Next up${PART.books[3].title}#4`);
  const fill = part.locator(".meter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await part.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width / track.width - 0.6)).toBeLessThan(0.02);
  // Its name is the row's one link, to the series' page, and the row ends in a chevron (TASK-102).
  await expect(part.getByRole("link")).toHaveCount(1);
  await expect(part.getByRole("link", { name: PART.name, exact: true })).toHaveAttribute("href", `/books/series/${PART.id}`);
  await expect(part.locator(".chev")).toBeVisible();
});

test("a series with no stated total counts its listed books; a complete one names none (AC-1)", FLOOR, async ({ page }) => {
  await open(page);
  const none = rowOf(page, NONE.name);
  await expect(none.locator(".rm")).toHaveText("0 / 2");
  await expect(none.locator(".series-next")).toContainText(NONE.books[0].title);
  const done = rowOf(page, DONE.name);
  await expect(done.locator(".rm")).toHaveText("2 / 2");
  await expect(done.locator(".series-next")).toHaveCount(0);
  await expect(done).toContainText("All read");
});

test("in progress first, then not started, then complete, each by name (AC-2)", FLOOR, async ({ page }) => {
  await open(page);
  const names = await rows(page).locator(".rt").allTextContents();
  expect(names.filter((n) => n.startsWith("E2E Se "))).toEqual([PART.name, NONE.name, DONE.name, OVER.name]);
});

test("4 read of a stated 3 reads 4 / 3 and the meter is full, not overflowing (AC-3)", FLOOR, async ({ page }) => {
  await open(page);
  const over = rowOf(page, OVER.name);
  await expect(over.locator(".rm")).toHaveText("4 / 3");
  const [bar, track] = [(await over.locator(".meter i").boundingBox())!, (await over.locator(".meter").boundingBox())!];
  expect(Math.abs(bar.width - track.width)).toBeLessThanOrEqual(1);
  expect(bar.x + bar.width).toBeLessThanOrEqual(track.x + track.width + 1);
});

test("Series is current in the tab row, the rail and the sidebar, whichever this width draws (AC-4)", FLOOR, async ({ page }) => {
  await open(page);
  const current = page.locator('a[aria-current="page"][href="/books/series"]').filter({ visible: true });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Series");
  await expect(page.locator('a[aria-current="page"][href="/books/shelves"]').filter({ visible: true })).toHaveCount(0);
});

test("the floor on the list: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  await floor(page);
  await screenshot(page, info, "series-list");
});

// A state is rendered to static markup and put in place of the loaded page's <main>, so it gets the real CSS,
// fonts and width. An empty state is a feel-pass surface (design § 10): `@feel` runs it at 412px too, so the
// screenshots cover every `ui.viewports` width.
test("the empty state: No series yet and one action, Add a book, to /books/add; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await open(page);
  // The shared database always holds series, so the empty list's own markup stands in for the loaded <main>.
  await swapMain(page, renderToStaticMarkup(createElement(SeriesList, { series: [] })));
  const slate = page.locator(".slate");
  await expect(slate).toContainText("No series yet");
  await expect(slate.getByRole("link", { name: "Add a book" })).toHaveAttribute("href", "/books/add");
  await expect(page.getByRole("link", { name: "Add a book" })).toHaveCount(1);
  await floor(page);
  await screenshot(page, info, "series-empty");
});

test("the error state: a neutral line and a real Try again; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(SeriesError({ error: new Error("boom"), reset: () => {} })));
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load your series. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "series-error");
});

// The skeleton's first row is measured against a loaded row of the same lines: Done's (the name and count, the
// author, one *All read* line) is two .rs lines, as the skeleton draws.
test("the loading skeleton's row is the loaded row's size, within 2px (AC-6)", FLOOR, async ({ page }) => {
  await open(page);
  const loaded = (await rowOf(page, PART.name).boundingBox())!;
  const done = (await rowOf(page, DONE.name).boundingBox())!;
  await swapMain(page, renderToStaticMarkup(createElement(SeriesLoading)));
  const sk = (await page.locator(".series-rows > li").first().boundingBox())!;
  // Part and Done each have a name line, an author line and one more line (Next up / All read): the skeleton's size.
  expect(Math.abs(loaded.height - done.height), "loaded rows differ").toBeLessThanOrEqual(2);
  expect(Math.abs(sk.height - done.height), `skeleton ${sk.height}px, loaded ${done.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(sk.width - done.width), "width").toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------------------------------------
// A series' own page (TASK-102)

const ONCE = { tag: "@at-w390-light" };
const href = (id: string) => `/books/series/${id}`;
const bookRows = (page: Page) => page.locator(".sp-rows > li");
const spFollow = () => withSql((sql) => sql<{ state: string }[]>`SELECT state FROM series_follows WHERE series_id = ${FOLLOW.id}`.then((r) => r[0]?.state));
const spProgress = () => withSql((sql) =>
  sql<{ follow_state: string | null }[]>`SELECT follow_state FROM series_progress WHERE series_id = ${FOLLOW.id} AND user_id = ${E2E_USER}`.then((r) => r[0].follow_state));

async function openPage(page: Page, s: { id: string; name: string }) {
  await page.goto(href(s.id));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(s.name);
}

test("a list row's name opens the series' page, which shows only that series' books (AC-1)", ONCE, async ({ page }) => {
  await open(page);
  await rowOf(page, GAP.name).getByRole("link", { name: GAP.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${href(GAP.id)}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(GAP.name);
  await expect(page.getByRole("link", { name: "‹ Series" })).toHaveAttribute("href", "/books/series");
  // Only this series' three books (and its one gap row): none of another series' titles.
  const titles = await bookRows(page).locator(".book-link").allTextContents();
  expect(titles).toEqual(GAP.books.map((b) => b.title));
  await expect(page.locator(".sp-rows")).toHaveAccessibleName(`Books in ${GAP.name}`);
  await expect(page.getByText(PART.books[0].title)).toHaveCount(0);
});

test("positions 1, 2 and 4 of 4 list #1, #2, a grey gap row for #3 and #4, each with its status, and mark #4 next unread (AC-1, AC-2)", ONCE, async ({ page }) => {
  await openPage(page, GAP);
  const rows = bookRows(page);
  await expect(rows).toHaveCount(4);
  await expect(rows.locator(".sp-pos")).toHaveText(["#1", "#2", "#3", "#4"]);
  await expect(rows.nth(0)).toContainText(GAP.books[0].title);
  await expect(rows.nth(0).locator(".sp-status")).toContainText("✓ Read");
  await expect(rows.nth(1)).toContainText(GAP.books[1].title);
  await expect(rows.nth(1).locator(".sp-status")).toContainText("◐ Reading");
  await expect(rows.nth(2)).toHaveClass(/sp-gap/);
  await expect(rows.nth(2)).toContainText("#3 not in your library");
  await expect(rows.nth(3)).toContainText(GAP.books[2].title);
  await expect(rows.nth(3).locator(".sp-status")).toContainText("Not on your list");
  // #2 is in hand, not unread: the marker names #4, and only #4.
  await expect(page.locator(".sp-tag")).toHaveText("Next up");
  await expect(rows.nth(3).locator(".sp-tag")).toHaveText("Next up");
  await expect(page.locator(".sp-side .mono").first()).toHaveText("1 / 4");
  // A book's title opens its sheet.
  await expect(rows.nth(0).getByRole("link", { name: GAP.books[0].title })).toHaveAttribute("href", `/book/${GAP.books[0].id}`);
});

test("the gap row is grey, never green or red, and its Add is a named link of 24px or more (AC-1, AC-6)", ONCE, async ({ page }) => {
  await openPage(page, GAP);
  const gap = page.locator(".sp-gap");
  await expect(gap).toHaveCount(1);
  await expect(gap.locator(".rt")).toHaveCSS("color", await tokenColour(page, "--faint"));
  const [ready, danger] = [await tokenColour(page, "--ready"), await tokenColour(page, "--danger")];
  const used = await gap.evaluate((li) => [li, ...li.querySelectorAll("*")].flatMap((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor];
  }));
  expect(used).not.toContain(ready);
  expect(used).not.toContain(danger);
  const add = gap.getByRole("link", { name: `Add #3 of ${GAP.name}` });
  await expect(add).toHaveText("Add");
  const box = (await add.boundingBox())!;
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
});

test("Add on the gap row opens Add books with the series named (AC-3)", ONCE, async ({ page }) => {
  await openPage(page, GAP);
  const add = page.locator(".sp-gap").getByRole("link", { name: `Add #3 of ${GAP.name}` });
  await hydrated(add);
  await add.click();
  await expect(page).toHaveURL(/\/books\/add\?q=E2E(%20|\+)Sp(%20|\+)Gap$/);
  await expect(page.locator("#book-q")).toHaveValue(GAP.name);
});

test("a series with no stated total draws no gap rows, however its positions run (AC-3)", ONCE, async ({ page }) => {
  await openPage(page, OPEN);
  await expect(bookRows(page)).toHaveCount(2);
  await expect(page.locator(".sp-gap")).toHaveCount(0);
  await expect(bookRows(page).locator(".sp-pos")).toHaveText(["#1", "#4"]);
});

test("a removed book is absent and its position is a gap (AC-3)", ONCE, async ({ page }) => {
  await openPage(page, SOFT);
  await expect(bookRows(page).locator(".sp-pos")).toHaveText(["#1", "#2", "#3"]);
  await expect(bookRows(page).nth(1)).toHaveClass(/sp-gap/);
  await expect(page.getByText(SOFT.books[1].title)).toHaveCount(0);
  // Its read is on no count: 1 of 3.
  await expect(page.locator(".sp-side .mono").first()).toHaveText("1 / 3");
});

// The page streams behind its loading.tsx, so the status is sent before the lookup: the page is Next's not-found.
test("an unknown series is the not-found page (AC-4)", ONCE, async ({ page }) => {
  await page.goto(href("e2e-sp-nope"));
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.locator(".series-detail")).toHaveCount(0);
});

test("Series is current on a series' page too, whichever nav this width draws (AC-4)", ONCE, async ({ page }) => {
  await openPage(page, GAP);
  await expect(page.locator('a[aria-current="page"][href="/books/series"]').filter({ visible: true })).toHaveCount(1);
});

test("a series with no live books is an empty slate whose one action is Add a book, with no gap rows (AC-6)", FEEL, async ({ page }, info) => {
  await openPage(page, EMPTY);
  const slate = page.locator(".slate");
  await expect(slate).toContainText("No books in this series yet");
  await expect(slate.getByRole("link", { name: "Add a book" })).toHaveAttribute("href", `/books/add?q=${encodeURIComponent(EMPTY.name)}`);
  await expect(page.locator(".sp-gap")).toHaveCount(0);
  await expect(page.locator(".sp-rows")).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "series-page-empty");
});

test("the series page meets the floor: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-6)", FLOOR, async ({ page }, info) => {
  await openPage(page, GAP);
  await expect(bookRows(page)).toHaveCount(4);
  await floor(page);
  await screenshot(page, info, "series-page");
});

test("the error state is a neutral line, a real Try again and a way back to every series; the floor; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  await openPage(page, GAP);
  await expect(bookRows(page)).toHaveCount(4);
  const markup = renderToStaticMarkup(SeriesDetailError({ error: new Error("boom"), reset: () => {} }));
  await hydrated(bookRows(page).first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load this series. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "‹ Series" })).toHaveAttribute("href", "/books/series");
  await floor(page);
  await screenshot(page, info, "series-page-error");
});

// The skeleton's rows are measured against a loaded row of the same lines: #4's (the title, the status line).
test("the series page's loading skeleton row is a loaded book row's size, within 2px (AC-6)", FLOOR, async ({ page }) => {
  await openPage(page, GAP);
  await expect(bookRows(page)).toHaveCount(4);
  const loaded = (await bookRows(page).nth(3).boundingBox())!;
  await hydrated(bookRows(page).first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, renderToStaticMarkup(createElement(SeriesDetailLoading)));
  const sk = (await page.locator(".sp-rows > li").first().boundingBox())!;
  expect(Math.abs(sk.height - loaded.height), `skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(sk.width - loaded.width), "width").toBeLessThanOrEqual(2);
});

// --- the follow control (AC-5): FOLLOW is 1 of 3 read, so its middle choice reads On hold.
const group = (page: Page) => page.getByRole("radiogroup", { name: `Following ${FOLLOW.name}` });
const resetFollow = () => withSql((sql) => sql`DELETE FROM series_follows WHERE series_id = ${FOLLOW.id}`);
const choose = async (page: Page, label: string) => {
  await hydrated(group(page).locator("input").first());
  await group(page).getByText(label, { exact: true }).click();
};

test("the follow control is 2.2c's: Reading, On hold on a part-read series, Not following, checked as stored (AC-5)", ONCE, async ({ page }) => {
  await resetFollow();
  await openPage(page, FOLLOW);
  await expect(group(page).locator(".opt")).toHaveText(["Reading", "On hold", "Not following"]);
  await expect(group(page).getByRole("radio", { name: "Not following" })).toBeChecked();
});

test("choosing Reading writes one series_follows row, still checked after a reload; Undo puts the prior state back (AC-5)", ONCE, async ({ page }) => {
  await resetFollow();
  await openPage(page, FOLLOW);
  await choose(page, "Reading");
  await expect.poll(spFollow).toBe("reading");
  await expect(page.locator(".toast .toast-label").last()).toHaveText(`Reading ${FOLLOW.name}`);
  expect(await withSql((sql) => sql`SELECT 1 FROM series_follows WHERE series_id = ${FOLLOW.id}`)).toHaveLength(1);
  await page.reload();
  await expect(group(page).getByRole("radio", { name: "Reading" })).toBeChecked();
  // The toast went with the page: change again for an Undo that is live, Reading to Tracking and back.
  await choose(page, "On hold");
  await expect.poll(spFollow).toBe("tracking");
  await page.locator(".toast").last().getByRole("button", { name: "Undo" }).click();
  await expect.poll(spFollow).toBe("reading");
  await expect(group(page).getByRole("radio", { name: "Reading" })).toBeChecked();
});

test("the Undo of a first follow leaves the series not followed (AC-5)", ONCE, async ({ page }) => {
  await resetFollow();
  await openPage(page, FOLLOW);
  await choose(page, "Reading");
  await expect.poll(spFollow).toBe("reading");
  await page.locator(".toast").last().getByRole("button", { name: "Undo" }).click();
  await expect.poll(spProgress).toBeNull();
  await expect(group(page).getByRole("radio", { name: "Not following" })).toBeChecked();
});

test("Not following stores off and series_progress.follow_state reads NULL; its Undo puts Reading back (AC-5)", ONCE, async ({ page }) => {
  await withSql((sql) => sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, ${FOLLOW.id}, 'reading')
                              ON CONFLICT (user_id, series_id) DO UPDATE SET state = 'reading'`);
  await openPage(page, FOLLOW);
  await expect(group(page).getByRole("radio", { name: "Reading" })).toBeChecked();
  expect(await spProgress()).toBe("reading");
  await choose(page, "Not following");
  await expect.poll(spFollow).toBe("off");
  expect(await spProgress()).toBeNull();
  await expect(page.locator(".toast .toast-label").last()).toHaveText(`Not following ${FOLLOW.name}`);
  await page.reload();
  await expect(group(page).getByRole("radio", { name: "Not following" })).toBeChecked();
  // Undo is live only in the page that wrote: go back to Reading, then off again, then Undo that.
  await choose(page, "Reading");
  await expect.poll(spFollow).toBe("reading");
  await choose(page, "Not following");
  await expect.poll(spFollow).toBe("off");
  await page.locator(".toast").last().getByRole("button", { name: "Undo" }).click();
  await expect.poll(spFollow).toBe("reading");
});

test.afterAll(resetFollow);
