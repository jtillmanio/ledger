// Task 5.12, 2 of 2 (TASK-105; F-69, D-108, D-109, D-118, D-119): the /progress page in a real browser, on the TEST
// database. One page beside Inbox with two tabs, *In the middle of · Completed*, and a chip per medium
// (*All · Books · Comics*). A series followed Reading with 2 of 5 read, a shelf followed Reading with 1 of 3 and a run
// with 3 of 10 read are in the middle, each with its kind, `read / total` and next thing; the series nests under its
// universe, which is listed beside it; *On hold* is a collapsed button that opens onto the series followed Tracking;
// *Completed* holds the 5-of-5 series and the 10-of-10 run with the month they finished. The *Books* chip hides the
// run, *Comics* the books rows; the tab and the chip are in the URL and survive a reload; nothing is written. The UX
// floor: axe, contrast, 24px targets, no sideways scroll, nothing red, each tab's empty state, the error state, the
// loading skeleton at the loaded size, the tablist and the chips by keyboard, screenshots. (TASK-104's
// test/progress-page.test.ts proves which rows belong where and their counts; this proves the page.)
//
// The fixtures are made here under E2E ids no other spec uses, and removed after the last test. The database holds
// real rows too, so rows are found by name, never by index on the whole list.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import ProgressError from "../../src/app/progress/error";
import ProgressLoading from "../../src/app/progress/loading";
import { ProgressEmpty } from "../../src/components/ProgressRows";
import { markRead, testSql, type TestSql } from "../db";
import {
  FEEL, FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique",
  "duplicate-id-aria", "target-size", "heading-order", "label", "aria-required-children", "aria-required-parent",
  "aria-required-attr",
];

const ONCE = { tag: "@at-w390-light" };
// What the page does (rows, chips, On hold, Completed) is checked once; how it fits and looks (D-161) runs at every layout:
// the nesting's indent, the floor, the skeleton's size and the nav's current item are `@floor`, the states `@feel`.
const AUTHOR = { id: "e2e-pg-author", name: "E2E Pg Author" };
const UNI = { id: "e2e-pg-uni", name: "E2E Pg Universe" };

type SeriesFx = { id: string; name: string; total: number; read: number; on: string; follow: "reading" | "tracking" | null; universe?: string };
const title = (id: string, n: number) => `E2E Pg ${id} Book ${n}`;
// 2 of 5 read, followed reading, its five books in the universe: in the middle, nested under it.
const PART: SeriesFx = { id: "e2e-pg-part", name: "E2E Pg Part", total: 5, read: 2, on: "2026-01-10", follow: "reading", universe: UNI.id };
// 2 of 5 read, followed tracking: on hold.
const HOLD: SeriesFx = { id: "e2e-pg-hold", name: "E2E Pg Hold", total: 5, read: 2, on: "2026-01-12", follow: "tracking" };
// 5 of 5 read, never followed: completed, finished in March.
const DONE: SeriesFx = { id: "e2e-pg-done", name: "E2E Pg Done", total: 5, read: 5, on: "2026-03-10", follow: null };
const SERIES = [PART, HOLD, DONE];
// A shelf of 3 books, 1 read, followed reading.
const SHELF = { id: "e2e-pg-shelf", name: "E2E Pg Shelf", total: 3, read: 1 };
// Runs: 3 of 10 read (in the middle) and 10 of 10 (completed, finished in February).
const RUN = { id: "e2e-pg-run", name: "E2E Pg Run", total: 10, read: 3, at: "2026-02-10T12:00:00Z" };
const RUN_DONE = { id: "e2e-pg-rundone", name: "E2E Pg RunDone", total: 10, read: 10, at: "2026-02-12T12:00:00Z" };
const RUNS = [RUN, RUN_DONE];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  const runs = RUNS.map((r) => r.id);
  await sql`DELETE FROM issue_progress WHERE placement_id IN (SELECT id FROM run_issues WHERE run_id = ANY(${runs}::text[]))`;
  await sql`DELETE FROM run_issues WHERE run_id = ANY(${runs}::text[])`;
  await sql`DELETE FROM issues WHERE id LIKE 'e2e-pg-%'`;
  await sql`DELETE FROM runs WHERE id = ANY(${runs}::text[])`;
  await sql`DELETE FROM book_status WHERE book_id LIKE 'e2e-pg-%'`;
  await sql`DELETE FROM shelf_books WHERE book_id LIKE 'e2e-pg-%'`;
  await sql`DELETE FROM books WHERE id LIKE 'e2e-pg-%'`;
  // Follows go with their series, universe and shelf (ON DELETE CASCADE).
  await sql`DELETE FROM shelves WHERE id = ${SHELF.id}`;
  await sql`DELETE FROM book_series WHERE id = ANY(${SERIES.map((s) => s.id)}::text[])`;
  await sql`DELETE FROM book_universes WHERE id = ${UNI.id}`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

async function read(sql: TestSql, bookId: string, on: string) {
  await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
            VALUES (${E2E_USER}, ${bookId}, 'read', ${on}, 'exact')`;
}

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${UNI.id}, ${UNI.name})`;
    await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${E2E_USER}, ${UNI.id}, 'reading')`;
    for (const s of SERIES) {
      await sql`INSERT INTO book_series (id, name, author_id, total_books) VALUES (${s.id}, ${s.name}, ${AUTHOR.id}, ${s.total})`;
      for (let n = 1; n <= s.total; n++) {
        const id = `${s.id}-${n}`;
        await sql`INSERT INTO books (id, title, author_id, series_id, series_position, universe_id, universe_position)
                  VALUES (${id}, ${title(s.id.slice(7), n)}, ${AUTHOR.id}, ${s.id}, ${n}, ${s.universe ?? null}, ${s.universe ? n : null})`;
        if (n <= s.read) await read(sql, id, s.on);
      }
      if (s.follow) await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, ${s.id}, ${s.follow})`;
    }
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${SHELF.id}, ${SHELF.name}, ${E2E_USER}, 'books')`;
    for (let n = 1; n <= SHELF.total; n++) {
      const id = `${SHELF.id}-${n}`;
      await sql`INSERT INTO books (id, title, author_id) VALUES (${id}, ${title("shelf", n)}, ${AUTHOR.id})`;
      await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${SHELF.id}, ${id}, ${n})`;
      if (n <= SHELF.read) await read(sql, id, "2026-01-14");
    }
    await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES (${SHELF.id}, 'reading')`;
    for (const r of RUNS) {
      await sql`INSERT INTO runs (id, title) VALUES (${r.id}, ${r.name})`;
      for (let n = 1; n <= r.total; n++) {
        await sql`INSERT INTO issues (id, label) VALUES (${`${r.id}-${n}`}, ${`${r.name} (2020) #${n}`})`;
        await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${r.id}, ${n}, ${`${r.id}-${n}`})`;
      }
      for (let n = 1; n <= r.read; n++) await markRead(sql, E2E_USER, r.id, `${r.id}-${n}`, { at: r.at });
    }
  });
});
test.afterAll(clean);

const main = (page: Page) => page.locator("main");
/** A row's own box (`.prog-item`), found by its name: a nested row is not inside its parent's. */
const item = (page: Page, name: string) =>
  page.locator(".prog-item").filter({ has: page.locator(".prog-name", { hasText: new RegExp(`^${name}$`) }) });
const tablist = (page: Page) => main(page).getByRole("tablist", { name: "Progress" });
const chips = (page: Page) => main(page).getByRole("group", { name: "Medium" });

async function open(page: Page, query = "") {
  await page.goto(`/progress${query}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Progress");
  await hydrated(tablist(page).getByRole("tab").first());
}

/** Puts a state's static markup in place of the loaded page's <main>, so it gets the real CSS, fonts and width. */
async function swapMain(page: Page, markup: string) {
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing in the page's main resolves to --danger: progress is no error.
  const danger = await tokenColour(page, "--danger");
  const red = await main(page).evaluate((m, d) => [...m.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor].includes(d);
  }).map((el) => el.outerHTML.slice(0, 80)), danger);
  expect(red).toEqual([]);
  // Every control a real, named button or link, at least 24px.
  const small = await main(page).evaluate((m) => [...m.querySelectorAll("a[href], button, input")]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return (r.width !== 0 || r.height !== 0) && (r.width < 24 || r.height < 24);
    }).map((el) => el.outerHTML.slice(0, 80)));
  expect(small).toEqual([]);
}

test("opens on In the middle of with the series, the shelf and the run: kind, read / total and next (AC-1, AC-2)", ONCE, async ({ page }) => {
  await open(page);
  await expect(tablist(page).getByRole("tab", { name: /^In the middle of/ })).toHaveAttribute("aria-selected", "true");

  const part = item(page, PART.name);
  await expect(part.locator(".prog-kind")).toHaveText("series");
  await expect(part.locator(".rm")).toHaveText("2 / 5");
  await expect(part.locator(".prog-next")).toHaveText(`Next: ${title("part", 3)}`);
  // The meter fills with --ready, to the share read.
  const fill = part.locator(".emeter i");
  await expect(fill).toHaveCSS("background-color", await tokenColour(page, "--ready"));
  const [bar, track] = [(await fill.boundingBox())!, (await part.locator(".emeter").boundingBox())!];
  expect(Math.abs(bar.width / track.width - 0.4)).toBeLessThan(0.02);

  const shelf = item(page, SHELF.name);
  await expect(shelf.locator(".prog-kind")).toHaveText("shelf");
  await expect(shelf.locator(".rm")).toHaveText("1 / 3");
  await expect(shelf.locator(".prog-next")).toContainText("Next: E2E Pg shelf Book");

  const run = item(page, RUN.name);
  await expect(run.locator(".prog-kind")).toHaveText("run");
  await expect(run.locator(".rm")).toHaveText("3 / 10");
  await expect(run.locator(".prog-next")).toHaveText(`Next: ${RUN.name} (2020) #4`);

  // Neither the series followed Tracking nor the finished ones are above On hold.
  await expect(item(page, HOLD.name).filter({ visible: true })).toHaveCount(0);
  await expect(item(page, DONE.name)).toHaveCount(0);
  await expect(item(page, RUN_DONE.name)).toHaveCount(0);
});

test("a series nests beneath the universe listed beside it, indented (AC-1, D-119)", FLOOR, async ({ page }) => {
  await open(page);
  const uni = item(page, UNI.name);
  await expect(uni.locator(".prog-kind")).toHaveText("universe");
  await expect(uni.locator(".rm")).toHaveText("2 / 5");
  const inside = page.locator(".prog-li").filter({ has: uni }).locator("> .prog-kids").locator(".prog-item");
  await expect(inside.filter({ has: page.locator(".prog-name", { hasText: PART.name }) })).toHaveCount(1);
  // It is a list of its own, named for its parent, and drawn indented from the universe's own row.
  await expect(page.locator(".prog-li").filter({ has: uni }).locator("> .prog-kids")).toHaveAccessibleName(`In ${UNI.name}`);
  const [outer, nested] = [(await uni.boundingBox())!, (await item(page, PART.name).boundingBox())!];
  expect(nested.x - outer.x).toBeGreaterThanOrEqual(20);
  // The series is not also a row of its own at the top level.
  await expect(page.locator(".prog-rows > .prog-li > .prog-item .prog-name", { hasText: PART.name })).toHaveCount(0);
});

test("the Books chip hides the run, Comics the books rows; the chip and the tab survive a reload (AC-1, AC-2)", ONCE, async ({ page }) => {
  await open(page);
  await expect(chips(page).getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
  await chips(page).getByRole("link", { name: "Books", exact: true }).click();
  await expect(page).toHaveURL(/\/progress\?medium=books$/);
  await expect(item(page, PART.name)).toHaveCount(1);
  await expect(item(page, RUN.name)).toHaveCount(0);
  await page.reload();
  await expect(chips(page).getByRole("link", { name: "Books", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(item(page, RUN.name)).toHaveCount(0);

  await chips(page).getByRole("link", { name: "Comics", exact: true }).click();
  await expect(page).toHaveURL(/\/progress\?medium=comics$/);
  await expect(item(page, RUN.name)).toHaveCount(1);
  for (const name of [PART.name, SHELF.name, UNI.name]) await expect(item(page, name)).toHaveCount(0);

  // The tab keeps the chip, and the chip keeps the tab.
  await tablist(page).getByRole("tab", { name: /^Completed/ }).click();
  await expect(page).toHaveURL(/\/progress\?tab=completed&medium=comics$/);
  await page.reload();
  await expect(tablist(page).getByRole("tab", { name: /^Completed/ })).toHaveAttribute("aria-selected", "true");
  await expect(chips(page).getByRole("link", { name: "Comics", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(item(page, RUN_DONE.name)).toHaveCount(1);
  await expect(item(page, DONE.name)).toHaveCount(0);
  await chips(page).getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(/\/progress\?tab=completed$/);
});

test("On hold is a collapsed button with its count; it opens onto the series followed Tracking at 2 / 5 (AC-3)", ONCE, async ({ page }) => {
  await open(page);
  const hold = page.getByRole("button", { name: /^On hold/ });
  await expect(hold).toHaveAttribute("aria-expanded", "false");
  await expect(hold.locator(".n")).not.toHaveText("0");
  // Below In the middle of, closed: its rows are not drawn.
  const [above, below] = [(await item(page, RUN.name).boundingBox())!, (await hold.boundingBox())!];
  expect(below.y).toBeGreaterThan(above.y);
  await expect(item(page, HOLD.name).filter({ visible: true })).toHaveCount(0);

  await hold.click();
  await expect(hold).toHaveAttribute("aria-expanded", "true");
  const held = item(page, HOLD.name);
  await expect(held).toBeVisible();
  await expect(held.locator(".rm")).toHaveText("2 / 5");
  await expect(held.locator(".prog-kind")).toHaveText("series");
  // The count is the rows it draws, and the series is not above it.
  const shown = await page.locator("#hold-rows .prog-item").count();
  await expect(hold.locator(".n")).toHaveText(String(shown));
  await expect(page.locator(".prog-rows[aria-label='In the middle of'] .prog-name", { hasText: HOLD.name })).toHaveCount(0);

  await hold.click();
  await expect(hold).toHaveAttribute("aria-expanded", "false");
  await expect(held.filter({ visible: true })).toHaveCount(0);
});

test("Completed lists the 5-of-5 series and the 10-of-10 run with their finish's month; a row with a page is a link (AC-4)", ONCE, async ({ page }) => {
  await open(page, "?tab=completed");
  const done = item(page, DONE.name);
  await expect(done.locator(".rm")).toHaveText("5 / 5");
  await expect(done.locator(".prog-next")).toHaveText("finished Mar 2026");
  await expect(done.getByRole("link", { name: DONE.name, exact: true })).toHaveAttribute("href", `/books/series/${DONE.id}`);
  const run = item(page, RUN_DONE.name);
  await expect(run.locator(".rm")).toHaveText("10 / 10");
  await expect(run.locator(".prog-next")).toHaveText("finished Feb 2026");
  await expect(run.getByRole("link", { name: RUN_DONE.name, exact: true })).toHaveAttribute("href", `/comics/${RUN_DONE.id}`);
  // The meters are full, and the rows part-read are not here.
  const [bar, track] = [(await done.locator(".emeter i").boundingBox())!, (await done.locator(".emeter").boundingBox())!];
  expect(Math.abs(bar.width - track.width)).toBeLessThanOrEqual(1);
  for (const name of [PART.name, HOLD.name, SHELF.name, RUN.name]) await expect(item(page, name)).toHaveCount(0);
  // Completed names no next thing.
  await expect(page.locator(".prog-next", { hasText: /^Next:/ })).toHaveCount(0);
});

test("a row opens its page where one exists: series, universe, shelf and a run at its resume pointer (AC-4)", ONCE, async ({ page }) => {
  await open(page);
  await expect(item(page, PART.name).getByRole("link", { name: PART.name, exact: true })).toHaveAttribute("href", `/books/series/${PART.id}`);
  await expect(item(page, UNI.name).getByRole("link", { name: UNI.name, exact: true })).toHaveAttribute("href", `/books/universes/${UNI.id}`);
  await expect(item(page, SHELF.name).getByRole("link", { name: SHELF.name, exact: true })).toHaveAttribute("href", `/books/shelves/${SHELF.id}`);
  // In the middle, a run opens at its next issue's row (#p-4 after three read).
  await expect(item(page, RUN.name).getByRole("link", { name: RUN.name, exact: true })).toHaveAttribute("href", `/comics/${RUN.id}#p-4`);
  await item(page, PART.name).getByRole("link", { name: PART.name, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/series/${PART.id}$`));
});

test("opening the page writes nothing: every follow and progress table is as it was (AC-1)", ONCE, async ({ page }) => {
  const counts = () => withSql(async (sql) => {
    const out: Record<string, number> = {};
    for (const t of ["series_follows", "universe_follows", "author_follows", "shelf_follows", "book_status", "issue_progress", "reading_plan"]) {
      out[t] = Number((await sql.unsafe(`SELECT count(*)::int AS n FROM ${t}`))[0].n);
    }
    return out;
  });
  const before = await counts();
  for (const query of ["", "?tab=completed", "?medium=books", "?tab=completed&medium=comics"]) {
    await open(page, query);
    // Opening On hold is a client toggle, not a write; it is checked where it is drawn.
    if (query === "") await page.getByRole("button", { name: /^On hold/ }).click();
  }
  expect(await counts()).toEqual(before);
});

test("Progress is current on /progress in the tab row, the rail and the sidebar, whichever this width draws (AC-5)", FLOOR, async ({ page }) => {
  await open(page);
  const current = page.locator('a[aria-current="page"][href="/progress"]').filter({ visible: true });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText("Progress");
  await expect(page.locator('a[aria-current="page"][href="/inbox"]').filter({ visible: true })).toHaveCount(0);
  // Beside Inbox, after it.
  const links = await page.locator('nav[aria-label="Screens"] a, nav[aria-label="Main"] a').and(page.locator('[href="/inbox"], [href="/progress"]')).filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(links).toEqual(["/inbox", "/progress"]);
});

test("the books and comics dashboards' rollups link to Progress with the chip chosen (AC-5)", ONCE, async ({ page }) => {
  await page.goto("/books");
  const books = page.locator('[data-slot="rollup"] a[href="/progress?medium=books"]');
  await expect(books).toHaveText(/In the middle of · Completed/);
  await books.click();
  await expect(page).toHaveURL(/\/progress\?medium=books$/);
  await expect(chips(page).getByRole("link", { name: "Books", exact: true })).toHaveAttribute("aria-current", "true");

  await page.goto("/comics");
  const comics = page.locator('main a[href="/progress?medium=comics"]');
  await expect(comics).toHaveText(/In the middle of · Completed/);
  await comics.click();
  await expect(page).toHaveURL(/\/progress\?medium=comics$/);
  await expect(chips(page).getByRole("link", { name: "Comics", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(item(page, RUN.name)).toHaveCount(1);
});

test("the tablist and the chips work by keyboard, each with a name (AC-6)", ONCE, async ({ page }) => {
  await open(page);
  const middle = tablist(page).getByRole("tab", { name: /^In the middle of/ });
  const completed = tablist(page).getByRole("tab", { name: /^Completed/ });
  await middle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\/progress\?tab=completed$/);
  await expect(completed).toBeFocused();
  await expect(completed).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(page).toHaveURL(/\/progress$/);
  await expect(middle).toBeFocused();
  await page.keyboard.press("End");
  await expect(completed).toBeFocused();
  // The panel is named for its tab, and only the selected tab has one.
  await expect(main(page).getByRole("tabpanel")).toHaveAccessibleName(/^Completed/);

  // A chip is a link reached by Tab and opened with Enter.
  const books = chips(page).getByRole("link", { name: "Books", exact: true });
  await books.focus();
  await expect(books).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/progress\?tab=completed&medium=books$/);
  await expect(chips(page).getByRole("link", { name: "Books", exact: true })).toHaveAttribute("aria-current", "true");
});

test("each tab's count is the rows it draws under the chip (AC-2)", ONCE, async ({ page }) => {
  await open(page, "?medium=comics");
  const rows = await page.locator(".prog-rows[aria-label='In the middle of'] .prog-item").count();
  await expect(tablist(page).getByRole("tab", { name: /^In the middle of/ }).locator(".n")).toHaveText(String(rows));
  await tablist(page).getByRole("tab", { name: /^Completed/ }).click();
  await expect(page).toHaveURL(/tab=completed/);
  await expect(item(page, RUN_DONE.name)).toBeVisible();
  const completed = await page.locator(".prog-rows[aria-label='Completed'] .prog-item").count();
  await expect(tablist(page).getByRole("tab", { name: /^Completed/ }).locator(".n")).toHaveText(String(completed));
});

test("the floor on In the middle of, On hold open: axe, contrast, 24px targets, nothing red, no sideways scroll; screenshots (AC-1, AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  await floor(page);
  await screenshot(page, info, "progress-middle");
  await page.getByRole("button", { name: /^On hold/ }).click();
  await expect(item(page, HOLD.name)).toBeVisible();
  // Open adds a button state and rows: axe and sideways scroll again, not a second contrast and screenshot pass.
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
});

test("the floor on Completed; screenshots (AC-4, AC-6)", ONCE, async ({ page }, info) => {
  await open(page, "?tab=completed");
  await expect(item(page, DONE.name)).toBeVisible();
  await floor(page);
  await screenshot(page, info, "progress-completed");
});

// A state is rendered to static markup and put in place of the loaded page's <main>, so it gets the real CSS, fonts
// and width. An empty state is a feel-pass surface (design § 10): the first runs `@feel`, at every width including 412px;
// the others, drawn by the same component with other copy, run once (D-161's suite-time budget).
const EMPTIES = [
  { name: "the middle", tab: "middle", medium: "all", title: "Nothing in the middle.", action: "Open the Library", href: "/books/list", tags: FEEL },
  { name: "the middle of Comics", tab: "middle", medium: "comics", title: "Nothing in the middle.", action: "Open Runs", href: "/comics/runs", tags: ONCE },
  { name: "Completed", tab: "completed", medium: "all", title: "Nothing completed yet.", action: "Open the Library", href: "/books/list", tags: ONCE },
] as const;
for (const e of EMPTIES) {
  test(`the empty state of ${e.name}: calm, one action, ${e.action}; the floor; screenshots (AC-6)`, e.tags, async ({ page }, info) => {
    await open(page);
    // The shared database always holds rows, so the empty state's own markup stands in for the loaded <main>.
    await swapMain(page, renderToStaticMarkup(createElement("main", { className: "progress-page" },
      createElement("div", { className: "series-head" }, createElement("h1", null, "Progress")),
      createElement(ProgressEmpty, { tab: e.tab, medium: e.medium }))));
    const slate = page.locator(".slate");
    await expect(slate).toContainText(e.title);
    await expect(slate.getByRole("link")).toHaveCount(1);
    await expect(slate.getByRole("link", { name: e.action })).toHaveAttribute("href", e.href);
    await floor(page);
    await screenshot(page, info, `progress-empty-${e.tab}-${e.medium}`);
  });
}

test("the error state: a neutral line and a real Try again; the floor; screenshots (AC-6)", ONCE, async ({ page }, info) => {
  await open(page);
  await swapMain(page, renderToStaticMarkup(ProgressError({ error: new Error("boom"), reset: () => {} })));
  await expect(main(page).getByRole("alert")).toContainText("Couldn't load your progress. Nothing was changed.");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "progress-error");
});

test("the loading skeleton's row is the loaded row's size, within 2px (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  const loaded = (await item(page, PART.name).boundingBox())!;
  const shelf = (await item(page, SHELF.name).boundingBox())!;
  await swapMain(page, renderToStaticMarkup(createElement(ProgressLoading)));
  const sk = (await page.locator(".prog-item").first().boundingBox())!;
  // A series and a shelf each have a name line, the meter and one Next line: the skeleton's size.
  expect(Math.abs(loaded.height - shelf.height), "loaded rows differ").toBeLessThanOrEqual(2);
  expect(Math.abs(sk.height - loaded.height), `skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
  await screenshot(page, info, "progress-loading");
});
