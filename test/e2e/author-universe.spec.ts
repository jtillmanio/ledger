// @area: books
// Task 5.11 (TASK-103; D-42, D-43, D-117, D-118, D-127): an author's page and a universe's page in a real
// browser, on the TEST database. Each reads `read / total` from its progress view with a meter filled with
// --ready, lists its live books (an author's by year, a universe's under their series or in universe order)
// and marks the next unread. 2.2c's follow control sits on both: *Reading* writes one follow row, survives a
// reload, and shows in the view's follow_state; *Not following* deletes an author's row and stores a
// universe's `off` (NULL in the view); each write's Undo puts the prior state back. A universe with no live
// books is 0 / 0, an empty meter and an empty state. The UX floor: axe, contrast, 24px targets, no sideways
// scroll, nothing red, the keyboard on the radiogroup, the loading and error states, screenshots.
//
// The author, universes and books are made here, under E2E ids no other spec uses, and removed after the last
// test.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import AuthorError from "../../src/app/books/authors/[id]/error";
import UniverseError from "../../src/app/books/universes/[id]/error";
import { GroupingSkeleton } from "../../src/components/GroupingBooks";
import { testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
];

const ONCE = { tag: "@at-w390-light" };

const AUTHOR = { id: "e2e-au-author", name: "E2E Au Author" };
const OTHER = { id: "e2e-au-other", name: "E2E Au Other" };
const SERIES = { id: "e2e-au-series", name: "E2E Au Series" };
const UNIVERSE = { id: "e2e-au-uni", name: "E2E Au Universe" };
const EMPTY = { id: "e2e-au-empty", name: "E2E Au Empty" };

type Book = {
  id: string; title: string; author: string; year: number | null; status: "read" | "to_read" | null; deleted?: boolean;
  series?: string; spos?: number; universe?: string; upos?: number;
};
// The author's: 4 books, 1 read, 1 removed: 1 / 3, and 1982's the earliest-published unread.
const A_READ: Book = { id: "e2e-au-a-read", title: "E2E Au Read", author: AUTHOR.id, year: 1975, status: "read", series: SERIES.id, spos: 1 };
const A_NEXT: Book = { id: "e2e-au-a-next", title: "E2E Au Next", author: AUTHOR.id, year: 1982, status: "to_read" };
const A_LATE: Book = { id: "e2e-au-a-late", title: "E2E Au Late", author: AUTHOR.id, year: 1999, status: null };
const A_GONE: Book = { id: "e2e-au-a-gone", title: "E2E Au Gone", author: AUTHOR.id, year: 1970, status: null, deleted: true };
// The universe's, by another author: no series at #1 (the next unread), the series' #2 read and #3 to read.
const U_LOOSE: Book = { id: "e2e-au-u-loose", title: "E2E Au Loose", author: OTHER.id, year: 2001, status: null, universe: UNIVERSE.id, upos: 1 };
const U_TWO: Book = { id: "e2e-au-u-two", title: "E2E Au Two", author: OTHER.id, year: 2002, status: "read", universe: UNIVERSE.id, upos: 2, series: SERIES.id, spos: 2 };
const U_THREE: Book = { id: "e2e-au-u-three", title: "E2E Au Three", author: OTHER.id, year: 2003, status: "to_read", universe: UNIVERSE.id, upos: 3, series: SERIES.id, spos: 3 };
const BOOKS = [A_READ, A_NEXT, A_LATE, A_GONE, U_LOOSE, U_TWO, U_THREE];
const IDS = BOOKS.map((b) => b.id);

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
  // Follows go with what they follow (ON DELETE CASCADE).
  await sql`DELETE FROM book_series WHERE id = ${SERIES.id}`;
  await sql`DELETE FROM book_universes WHERE id = ANY(${[UNIVERSE.id, EMPTY.id]}::text[])`;
  await sql`DELETE FROM authors WHERE id = ANY(${[AUTHOR.id, OTHER.id]}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name}), (${OTHER.id}, ${OTHER.name})`;
    await sql`INSERT INTO book_series (id, name, author_id) VALUES (${SERIES.id}, ${SERIES.name}, ${OTHER.id})`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${UNIVERSE.id}, ${UNIVERSE.name}), (${EMPTY.id}, ${EMPTY.name})`;
    for (const b of BOOKS) {
      await sql`
        INSERT INTO books (id, title, author_id, published_year, series_id, series_position, universe_id, universe_position, deleted_at)
        VALUES (${b.id}, ${b.title}, ${b.author}, ${b.year}, ${b.series ?? null}, ${b.spos ?? null}, ${b.universe ?? null},
                ${b.upos ?? null}, ${b.deleted ? new Date() : null})`;
      if (b.status) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
    }
  });
});
test.afterAll(clean);

const authorHref = `/books/authors/${AUTHOR.id}`;
const universeHref = `/books/universes/${UNIVERSE.id}`;
const bookRows = (page: Page) => page.locator(".sp-rows > li");
const count = (page: Page) => page.locator(".sp-side .mono").first();

async function openPage(page: Page, href: string, name: string) {
  await page.goto(href);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing in the page's main resolves to --danger: a page of books is no error.
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

async function meterShare(page: Page) {
  const fill = page.locator(".sp-side .meter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await page.locator(".sp-side .meter").boundingBox())!];
  return bar.width / track.width;
}

// --- the pages' contents (AC-1, AC-2)

test("an author with 4 books, 1 read and 1 removed reads 1 / 3, a --ready meter, and marks the earliest-published unread next (AC-1, AC-2)", FLOOR, async ({ page }) => {
  await openPage(page, authorHref, AUTHOR.name);
  await expect(count(page)).toHaveText("1 / 3");
  expect(Math.abs((await meterShare(page)) - 1 / 3)).toBeLessThan(0.02);
  // Its live books by year, the year in mono; the removed one is on no list.
  await expect(bookRows(page).locator(".book-link")).toHaveText([A_READ.title, A_NEXT.title, A_LATE.title]);
  await expect(bookRows(page).locator(".sp-pos")).toHaveText(["1975", "1982", "1999"]);
  await expect(page.getByText(A_GONE.title)).toHaveCount(0);
  await expect(page.locator(".sp-tag")).toHaveCount(1);
  await expect(bookRows(page).nth(1).locator(".sp-tag")).toHaveText("Next up");
  // Where each belongs, below the title; status and dates as the series page says them.
  await expect(bookRows(page).nth(0)).toContainText(`${SERIES.name} #1`);
  await expect(bookRows(page).nth(0).locator(".sp-status")).toContainText("✓ Read");
  await expect(page.locator(".sp-rows")).toHaveAccessibleName(`Books by ${AUTHOR.name}`);
  await expect(page.getByRole("link", { name: "‹ Library" })).toHaveAttribute("href", "/books/list");
});

test("a universe reads 1 / 3 from universe_progress, its books under their series, the series' heading a link, the next unread marked (AC-1, AC-2)", FLOOR, async ({ page }) => {
  await openPage(page, universeHref, UNIVERSE.name);
  await expect(count(page)).toHaveText("1 / 3");
  expect(Math.abs((await meterShare(page)) - 1 / 3)).toBeLessThan(0.02);
  // By series is the default: the series' group, then the books in no series.
  await expect(page.getByRole("link", { name: "By series" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".gp-head")).toHaveText([SERIES.name, "Not in a series"]);
  await expect(page.locator(".gp-head").getByRole("link", { name: SERIES.name })).toHaveAttribute("href", `/books/series/${SERIES.id}`);
  const series = page.getByRole("list", { name: `Books in ${SERIES.name}` });
  await expect(series.locator(".book-link")).toHaveText([U_TWO.title, U_THREE.title]);
  await expect(series.locator(".sp-pos")).toHaveText(["#2", "#3"]);
  const loose = page.getByRole("list", { name: `Books in ${UNIVERSE.name} in no series` });
  await expect(loose.locator(".book-link")).toHaveText([U_LOOSE.title]);
  // #1 in the universe, with no status: next, though its group comes last.
  await expect(page.locator(".sp-tag")).toHaveCount(1);
  await expect(loose.locator(".sp-tag")).toHaveText("Next up");
});

test("In order lists the universe by its positions, each row naming its series (owner at plan)", ONCE, async ({ page }) => {
  await openPage(page, universeHref, UNIVERSE.name);
  await page.getByRole("link", { name: "In order" }).click();
  await expect(page).toHaveURL(new RegExp(`${universeHref}\\?order=flat$`));
  await expect(page.getByRole("link", { name: "In order" })).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".gp-head")).toHaveCount(0);
  await expect(bookRows(page).locator(".book-link")).toHaveText([U_LOOSE.title, U_TWO.title, U_THREE.title]);
  await expect(bookRows(page).locator(".sp-pos")).toHaveText(["#1", "#2", "#3"]);
  await expect(bookRows(page).nth(1)).toContainText(`${SERIES.name} #2`);
  await expect(bookRows(page).nth(0).locator(".sp-tag")).toHaveText("Next up");
});

test("a universe with no live books reads 0 / 0 with an empty meter and an empty state, never an error (AC-4)", FEEL, async ({ page }, info) => {
  await openPage(page, `/books/universes/${EMPTY.id}`, EMPTY.name);
  await expect(count(page)).toHaveText("0 / 0");
  expect(await meterShare(page)).toBe(0);
  const slate = page.locator(".slate");
  await expect(slate).toContainText(`No books in ${EMPTY.name} yet`);
  await expect(slate.getByRole("link")).toHaveCount(1);
  await expect(page.locator(".sp-rows")).toHaveCount(0);
  // No error line in the page (Next's route announcer, outside main, is an alert of its own).
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  // Nothing to follow: no control (POST /api/follows refuses following a universe with no live book).
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "universe-page-empty");
});

test("an unknown author or universe is the not-found page", ONCE, async ({ page }) => {
  for (const href of ["/books/authors/e2e-au-nope", "/books/universes/e2e-au-nope"]) {
    await page.goto(href);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.locator(".series-detail")).toHaveCount(0);
  }
});

// --- the follow control (AC-1, AC-3)

const authorFollow = () => withSql((sql) =>
  sql<{ state: string }[]>`SELECT state FROM author_follows WHERE author_id = ${AUTHOR.id}`.then((r) => r.map((x) => x.state)));
const authorView = () => withSql((sql) =>
  sql<{ follow_state: string | null }[]>`SELECT follow_state FROM author_progress WHERE author_id = ${AUTHOR.id} AND user_id = ${E2E_USER}`
    .then((r) => r[0].follow_state));
const universeFollow = () => withSql((sql) =>
  sql<{ state: string }[]>`SELECT state FROM universe_follows WHERE universe_id = ${UNIVERSE.id}`.then((r) => r[0]?.state ?? null));
const universeView = () => withSql((sql) =>
  sql<{ follow_state: string | null }[]>`SELECT follow_state FROM universe_progress WHERE universe_id = ${UNIVERSE.id} AND user_id = ${E2E_USER}`
    .then((r) => r[0].follow_state));
const resetFollows = () => withSql(async (sql) => {
  await sql`DELETE FROM author_follows WHERE author_id = ${AUTHOR.id}`;
  await sql`DELETE FROM universe_follows WHERE universe_id = ${UNIVERSE.id}`;
});
const group = (page: Page, name: string) => page.getByRole("radiogroup", { name: `Following ${name}` });
const choose = async (page: Page, name: string, label: string) => {
  await hydrated(group(page, name).locator("input").first());
  await group(page, name).getByText(label, { exact: true }).click();
};
const undo = (page: Page) => page.locator(".toast").last().getByRole("button", { name: "Undo" }).click();

test("on an author with no follow, Reading writes one author_follows row, shows in follow_state, and survives a reload; Undo leaves no row (AC-1, AC-3)", ONCE, async ({ page }) => {
  await resetFollows();
  await openPage(page, authorHref, AUTHOR.name);
  // 1 read and 2 left: part-read, so the middle reads On hold (D-118).
  await expect(group(page, AUTHOR.name).locator(".opt")).toHaveText(["Reading", "On hold", "Not following"]);
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "Not following" })).toBeChecked();
  await choose(page, AUTHOR.name, "Reading");
  await expect.poll(authorFollow).toEqual(["reading"]);
  expect(await authorView()).toBe("reading");
  await page.reload();
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "Reading" })).toBeChecked();
  // A fresh write for a live Undo: Not following deletes the row; its Undo puts Reading back.
  await choose(page, AUTHOR.name, "Not following");
  await expect.poll(authorFollow).toEqual([]);
  expect(await authorView()).toBeNull();
  await undo(page);
  await expect.poll(authorFollow).toEqual(["reading"]);
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "Reading" })).toBeChecked();
  // And the Undo of a first follow leaves no row at all.
  await resetFollows();
  await page.reload();
  await choose(page, AUTHOR.name, "Reading");
  await expect.poll(authorFollow).toEqual(["reading"]);
  await undo(page);
  await expect.poll(authorFollow).toEqual([]);
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "Not following" })).toBeChecked();
});

test("on a universe, Not following stores off and universe_progress.follow_state reads NULL; its Undo puts Reading back (AC-3)", ONCE, async ({ page }) => {
  await resetFollows();
  await withSql((sql) => sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${E2E_USER}, ${UNIVERSE.id}, 'reading')`);
  await openPage(page, universeHref, UNIVERSE.name);
  await expect(group(page, UNIVERSE.name).getByRole("radio", { name: "Reading" })).toBeChecked();
  await choose(page, UNIVERSE.name, "Not following");
  await expect.poll(universeFollow).toBe("off");
  expect(await universeView()).toBeNull();
  await expect(page.locator(".toast .toast-label").last()).toHaveText(`Not following ${UNIVERSE.name}`);
  await page.reload();
  await expect(group(page, UNIVERSE.name).getByRole("radio", { name: "Not following" })).toBeChecked();
  await choose(page, UNIVERSE.name, "Reading");
  await expect.poll(universeFollow).toBe("reading");
  expect(await universeView()).toBe("reading");
  await choose(page, UNIVERSE.name, "Not following");
  await expect.poll(universeFollow).toBe("off");
  await undo(page);
  await expect.poll(universeFollow).toBe("reading");
});

test("the radiogroup is named and works from the keyboard: an arrow key moves the choice and saves it (AC-6)", ONCE, async ({ page }) => {
  await resetFollows();
  await openPage(page, authorHref, AUTHOR.name);
  const radios = group(page, AUTHOR.name).getByRole("radio");
  await hydrated(radios.first());
  await group(page, AUTHOR.name).getByRole("radio", { name: "Not following" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "On hold" })).toBeChecked();
  await expect.poll(authorFollow).toEqual(["tracking"]);
  await expect(group(page, AUTHOR.name).getByRole("radio", { name: "On hold" })).toBeFocused();
});

test.afterAll(resetFollows);

// --- the floor (AC-6)

test("both pages meet the floor: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  // No follow reset here: this runs at every width alongside the w390 follow tests.
  await openPage(page, authorHref, AUTHOR.name);
  await expect(bookRows(page)).toHaveCount(3);
  await floor(page);
  await screenshot(page, info, "author-page");
  await openPage(page, universeHref, UNIVERSE.name);
  await expect(bookRows(page)).toHaveCount(3);
  await floor(page);
  await screenshot(page, info, "universe-page");
});

test("the error states are a neutral line, a real Try again and a way back to the Library; screenshots (AC-6)", FEEL, async ({ page }, info) => {
  for (const [href, name, kind, Error_] of [
    [authorHref, AUTHOR.name, "author", AuthorError], [universeHref, UNIVERSE.name, "universe", UniverseError],
  ] as const) {
    await openPage(page, href, name);
    await hydrated(bookRows(page).first());
    const markup = renderToStaticMarkup(Error_({ error: new Error("boom"), reset: () => {} }));
    await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
    await expect(page.locator("main").getByRole("alert")).toContainText(`Couldn't load this ${kind}. Nothing was changed.`);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "‹ Library" })).toHaveAttribute("href", "/books/list");
    await floor(page);
    await screenshot(page, info, `${kind}-page-error`);
  }
});

// The skeleton's rows are measured against a loaded row of the same lines: the author's 1999 book (the title,
// the status line).
test("the loading skeleton's row is a loaded book row's size, within 2px (AC-6)", FLOOR, async ({ page }) => {
  await openPage(page, authorHref, AUTHOR.name);
  await expect(bookRows(page)).toHaveCount(3);
  const loaded = (await bookRows(page).nth(2).boundingBox())!;
  await hydrated(bookRows(page).first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, renderToStaticMarkup(createElement(GroupingSkeleton)));
  const sk = (await page.locator(".sp-rows > li").first().boundingBox())!;
  expect(Math.abs(sk.height - loaded.height), `skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
  expect(Math.abs(sk.width - loaded.width), "width").toBeLessThanOrEqual(2);
});
