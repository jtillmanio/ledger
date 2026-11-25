// @area: books
// Task 5.14 (TASK-107, F-59): the listen queue in a real browser. Up next lists
// *Listen next* after every level of the plan, in queue order, and is absent
// with nothing queued; *Queue to listen* on a Library row's `⋯`, on the book
// sheet and on an Add books result puts a book at its end with an undo toast;
// *Move to top* (1.10's controls) reorders it without a reload and the order
// survives one; Done's *Listened* chip keeps only the books with an audio read,
// is current and in the URL, and *All* lists both; each tab's count is its rows.
// The UX floor at 360 and 1280px, light and dark (AC-6). The books are made
// here, under ids the rest of the suite doesn't use, and removed after the last
// test; the browser suite runs one file at a time, so no other spec sees them.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Every test here writes, or sets its own viewport and theme: once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order",
];

const P = "e2e-lq-";
const ONE = { id: `${P}one`, title: "E2E Lq One" };
const TWO = { id: `${P}two`, title: "E2E Lq Two" };
const THREE = { id: `${P}three`, title: "E2E Lq Three" };
const PLANNED = { id: `${P}planned`, title: "E2E Lq Planned" };
const LATER = { id: `${P}later`, title: "E2E Lq Later" };
const EYE = { id: `${P}eye`, title: "E2E Lq Read By Eye" };
const EAR = { id: `${P}ear`, title: "E2E Lq Listened To" };
const BOOKS = [ONE, TWO, THREE, PLANNED, LATER, EYE, EAR];
// A books shelf holding ONE: its *Remove from shelf* is the grey the review drew (MR-D16), the reference for *Remove from Listen next*.
const SHELF = { id: `${P}shelf`, name: "E2E Lq Shelf" };
const QUEUED = [ONE, TWO, THREE];

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => db(async (sql) => {
  await sql`DELETE FROM shelves WHERE id = ${SHELF.id}`;
  await sql`DELETE FROM books WHERE id LIKE ${P + "%"}`;
});

/** The queue as stored: the seeded three at 1–3, nothing else. */
const resetQueue = () => db(async (sql) => {
  await sql`DELETE FROM listen_queue`;
  for (const [i, b] of QUEUED.entries()) await sql`INSERT INTO listen_queue (book_id, position) VALUES (${b.id}, ${i + 1})`;
});

const stored = () => db(async (sql) =>
  (await sql`SELECT book_id, position FROM listen_queue ORDER BY position`).map((r) => `${r.book_id}:${r.position}`));

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await clean();
  await db(async (sql) => {
    for (const b of BOOKS) await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
    for (const b of [ONE, TWO, THREE, PLANNED, LATER]) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${PLANNED.id}, '2027-Q1', 1)`;
    for (const [b, format, on] of [[EYE, "text", "2026-03-01"], [EAR, "audio", "2026-04-01"]] as const) {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${b.id}, 'read', ${on}, 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, ${b.id}, ${on}, 'exact', ${format})`;
    }
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${SHELF.id}, ${SHELF.name}, ${E2E_USER}, 'books')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${SHELF.id}, ${ONE.id}, 1)`;
  });
  await resetQueue();
});
test.afterAll(async () => {
  await db((sql) => sql`DELETE FROM listen_queue`);
  await clean();
});

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const panel = (page: Page) => page.getByRole("tabpanel");
const counted = async (page: Page, name: string) => Number(await tab(page, name).locator(".n").textContent());
const listenNext = (page: Page) => page.locator("section[data-listen-next]");
const queueTitles = (page: Page) => listenNext(page).locator(".qtitle");
const toast = (page: Page) => page.locator(".toast");

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("tablist", { name: "Status" })).toBeVisible();
}

test("Up next lists Listen next in queue order, after the plan, and each tab's count equals its rows (AC-1)", ONCE, async ({ page }) => {
  await open(page, "/books/status?tab=next");
  const heads = panel(page).getByRole("heading", { level: 2 });
  await expect(heads).toHaveText([/^2027 · Q1\s*1 book$/, /^Listen next\s*3 books$/]);
  await expect(queueTitles(page)).toHaveText([ONE.title, TWO.title, THREE.title]);
  // After every level of the plan: the Someday row comes before it.
  const someday = panel(page).getByRole("link", { name: /^Someday · / });
  expect(await someday.evaluate((a, section) => Boolean(a.compareDocumentPosition(section!) & Node.DOCUMENT_POSITION_FOLLOWING),
    await listenNext(page).elementHandle())).toBe(true);
  // The places named are the rows drawn, 1 to N.
  for (const [i, b] of QUEUED.entries()) {
    await expect(listenNext(page).locator(".drag").nth(i)).toHaveAccessibleName(`Reorder ${b.title}, position ${i + 1} of 3 in Listen next`);
  }
  expect(await counted(page, "Up next")).toBe(4);
  expect(await counted(page, "Up next")).toBe(await panel(page).locator("li.qrow").count());
});

test("Listen next with nothing queued is absent, not an empty heading (AC-6)", ONCE, async ({ page }) => {
  await db((sql) => sql`DELETE FROM listen_queue`);
  try {
    await open(page, "/books/status?tab=next");
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText([/^2027 · Q1\s*1 book$/]);
    await expect(listenNext(page)).toHaveCount(0);
    await expect(page.getByText("Listen next")).toHaveCount(0);
    expect(await counted(page, "Up next")).toBe(1);
    // The control: one queued book brings the group back, so the absence above is the empty queue's, not a missing group.
    await db((sql) => sql`INSERT INTO listen_queue (book_id, position) VALUES (${ONE.id}, 1)`);
    await page.reload();
    await expect(listenNext(page).getByRole("heading", { level: 2 })).toHaveText(/^Listen next\s*1 book$/);
    await expect(queueTitles(page)).toHaveText([ONE.title]);
    expect(await counted(page, "Up next")).toBe(2);
  } finally {
    await resetQueue();
  }
});

test("Queue to listen from a row's ⋯ raises an undo toast and lists it last; Undo takes it off (AC-2)", ONCE, async ({ page }) => {
  await page.goto(`/books/list?q=${encodeURIComponent(LATER.title)}`);
  const more = page.getByRole("button", { name: `More for ${LATER.title}`, exact: true });
  await hydrated(more);
  await more.click();
  const item = page.getByRole("menu", { name: `More for ${LATER.title}` }).getByRole("menuitem", { name: "Queue to listen", exact: true });
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await item.click();
  await expect(toast(page).locator(".toast-label")).toHaveText("Added to Listen next");
  await expect(toast(page)).toContainText(LATER.title);
  await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`, `${LATER.id}:4`]);

  // Up next in a second tab, while the toast stays live in this one (the undo stack is the page's memory).
  await toast(page).hover();
  const upNext = await page.context().newPage();
  try {
    await open(upNext, "/books/status?tab=next");
    await expect(queueTitles(upNext)).toHaveText([ONE.title, TWO.title, THREE.title, LATER.title]);
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`]);
    await upNext.reload();
    await expect(queueTitles(upNext)).toHaveText([ONE.title, TWO.title, THREE.title]);
  } finally {
    await upNext.close();
  }
});

test("a book already queued stays where it is, and the menu says so", ONCE, async ({ page }) => {
  await page.goto(`/books/list?q=${encodeURIComponent(TWO.title)}`);
  const more = page.getByRole("button", { name: `More for ${TWO.title}`, exact: true });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Queue to listen", exact: true }).click();
  await expect(toast(page).locator(".toast-label")).toHaveText("Already in Listen next");
  await expect(toast(page).getByRole("button", { name: "Undo" })).toHaveCount(0);
  expect(await stored()).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`]);
});

test("Move to top on the third redraws Listen next as 3, 1, 2 without a reload, and a reload keeps it (AC-3)", ONCE, async ({ page }) => {
  try {
    await open(page, "/books/status?tab=next");
    await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });
    const more = listenNext(page).getByRole("button", { name: `More for ${THREE.title}`, exact: true });
    await hydrated(more);
    // The row's ⋯ is 44px on the phone (the UX floor), as on Top books and Shelves; this project is 390px wide.
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await more.click();
    const menu = page.getByRole("menu", { name: `More for ${THREE.title}` });
    await expect(menu.getByRole("menuitem")).toHaveText(["Move to top", "Move up", "Remove from Listen next"]);
    for (const it of await menu.getByRole("menuitem").all()) expect((await it.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await menu.getByRole("menuitem", { name: "Move to top" }).click();
    await expect(queueTitles(page)).toHaveText([THREE.title, ONE.title, TWO.title]);
    await expect.poll(stored).toEqual([`${THREE.id}:1`, `${ONE.id}:2`, `${TWO.id}:3`]);
    expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);

    await page.reload();
    await expect(queueTitles(page)).toHaveText([THREE.title, ONE.title, TWO.title]);
  } finally {
    await resetQueue();
  }
});

test("the handle's keyboard route moves a book, with no motion under reduced motion (AC-6)", ONCE, async ({ page }) => {
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page, "/books/status?tab=next");
    const handle = listenNext(page).locator(".drag").first();
    await hydrated(handle);
    await expect(handle).toHaveAccessibleName(`Reorder ${ONE.title}, position 1 of 3 in Listen next`);
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowDown");
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running"
      && !(a as CSSAnimation).animationName?.startsWith("toast")).length)).toBe(0);
    await page.keyboard.press("Space");
    await expect(queueTitles(page)).toHaveText([TWO.title, ONE.title, THREE.title]);
    await expect.poll(stored).toEqual([`${TWO.id}:1`, `${ONE.id}:2`, `${THREE.id}:3`]);
  } finally {
    await resetQueue();
  }
});

test("Remove from Listen next takes it off; Undo puts it back where it was", ONCE, async ({ page }) => {
  await open(page, "/books/status?tab=next");
  const more = listenNext(page).getByRole("button", { name: `More for ${TWO.title}`, exact: true });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Remove from Listen next" }).click();
  await expect(queueTitles(page)).toHaveText([ONE.title, THREE.title]);
  await expect.poll(stored).toEqual([`${ONE.id}:1`, `${THREE.id}:2`]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(queueTitles(page)).toHaveText([ONE.title, TWO.title, THREE.title]);
  await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`]);
});

test("Remove from Listen next reads grey like Remove from shelf, in no --danger colour, light and dark at 360px (AC-1, AC-2)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    // The reference: a shelf's *Remove from shelf* (task 5.1b), grey because the book stays in the library.
    await page.goto(`/books/shelves/${SHELF.id}`);
    const shelfMore = page.getByRole("button", { name: `More for ${ONE.title}`, exact: true });
    await hydrated(shelfMore);
    await shelfMore.click();
    const shelfItem = page.getByRole("menuitem", { name: "Remove from shelf", exact: true });
    const reference = (await computedStyle(shelfItem, ["color"])).color;
    await expect(shelfItem).not.toHaveClass(/danger/);

    await open(page, "/books/status?tab=next");
    const more = listenNext(page).getByRole("button", { name: `More for ${TWO.title}`, exact: true });
    await hydrated(more);
    await more.click();
    const item = page.getByRole("menuitem", { name: "Remove from Listen next", exact: true });
    // Menu items carry no icon (Menu.tsx), so the text colour is the whole of it.
    const { color } = await computedStyle(item, ["color"]);
    await expect(item).not.toHaveClass(/danger/);
    expect(color, `${colorScheme}: the colour of Remove from shelf`).toBe(reference);
    expect(color, `${colorScheme}: not --danger`).not.toBe(await tokenColour(page, "--danger"));
    expect(await contrastFailures(page), `${colorScheme} menu open`).toEqual([]);
  }
});

test("the book sheet and an Add books result queue too, each with its undo", ONCE, async ({ page }) => {
  try {
    await page.goto(`/book/${LATER.id}`);
    const sheetButton = page.getByRole("button", { name: `Queue to listen: ${LATER.title}`, exact: true });
    await hydrated(sheetButton);
    expect((await sheetButton.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await sheetButton.click();
    await expect(toast(page).locator(".toast-label")).toHaveText("Added to Listen next");
    await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`, `${LATER.id}:4`]);
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`]);

    await page.goto("/books/add");
    const box = page.getByRole("searchbox");
    await hydrated(box);
    await box.fill(LATER.title);
    await page.keyboard.press("Enter");
    const result = page.getByRole("button", { name: `Queue to listen: ${LATER.title}`, exact: true });
    await expect(result).toBeVisible();
    await result.click();
    await expect(toast(page).locator(".toast-label")).toHaveText("Added to Listen next");
    await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`, `${LATER.id}:4`]);
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect.poll(stored).toEqual([`${ONE.id}:1`, `${TWO.id}:2`, `${THREE.id}:3`]);
  } finally {
    await resetQueue();
  }
});

test("Done's Listened chip lists only the listened book, is current and in the URL; All lists both (AC-1, AC-4)", ONCE, async ({ page }) => {
  await open(page, "/books/status?tab=done");
  const chips = panel(page).getByRole("group", { name: "Done by format" });
  const titles = panel(page).locator(".row-title");
  await expect(chips.getByRole("link")).toHaveText(["All", "Listened"]);
  await expect(chips.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "true");
  await expect(titles.filter({ hasText: /^E2E Lq/ })).toHaveText([EAR.title, EYE.title]);
  for (const chip of await chips.getByRole("link").all()) expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(24);

  await chips.getByRole("link", { name: "Listened" }).click();
  await expect(page).toHaveURL(/\/books\/status\?tab=done&format=audio$/);
  await expect(chips.getByRole("link", { name: "Listened" })).toHaveAttribute("aria-current", "true");
  await expect(chips.getByRole("link", { name: "All" })).not.toHaveAttribute("aria-current", "true");
  await expect(titles.filter({ hasText: /^E2E Lq/ })).toHaveText([EAR.title]);
  // Each row the chip keeps has an audio read; the count is the rows it draws.
  const listened = await db(async (sql) => (await sql`
    SELECT count(DISTINCT st.book_id)::int AS n FROM book_status st JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
    WHERE st.user_id = ${E2E_USER} AND st.status IN ('read', 'dnf')
      AND EXISTS (SELECT 1 FROM read_events e WHERE e.book_id = st.book_id AND e.format = 'audio')`)[0].n as number);
  expect(await counted(page, "Done")).toBe(listened);
  expect(await counted(page, "Done")).toBe(await titles.count());

  await page.reload();
  await expect(chips.getByRole("link", { name: "Listened" })).toHaveAttribute("aria-current", "true");
  await chips.getByRole("link", { name: "All" }).click();
  await expect(page).toHaveURL(/\/books\/status\?tab=done$/);
  await expect(titles.filter({ hasText: /^E2E Lq/ })).toHaveText([EAR.title, EYE.title]);
  expect(await counted(page, "Done")).toBe(await titles.count());
});

// `ui.viewports` in .claude/kit.json: the open menu is checked at each of them (task 6.24, AC-4).
const WIDTHS = [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]] as const;

test("the Listen next row menu open, at each width, light and dark: axe, contrast and screenshots (task 6.24, AC-4)", ONCE, async ({ page }, info) => {
  for (const [width, height] of WIDTHS) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await open(page, "/books/status?tab=next");
      const more = listenNext(page).getByRole("button", { name: `More for ${TWO.title}`, exact: true });
      await hydrated(more);
      await more.click();
      await expect(page.getByRole("menuitem", { name: "Remove from Listen next", exact: true })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `menu ${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `listen-menu-${width}-${colorScheme}`);
      await page.keyboard.press("Escape");
    }
  }
});

test("Up next and Done at 360 and 1280px, light and dark: axe, contrast and screenshots (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      for (const [path, name] of [["/books/status?tab=next", "up-next"], ["/books/status?tab=done&format=audio", "done-listened"]] as const) {
        await open(page, path);
        await expect(panel(page)).toBeVisible();
        // The scan covers the new UI: Listen next's rows on Up next, the chosen Listened chip on Done.
        if (name === "up-next") await expect(queueTitles(page)).toHaveText([ONE.title, TWO.title, THREE.title]);
        else await expect(page.getByRole("group", { name: "Done by format" }).getByRole("link", { name: "Listened" }))
          .toHaveAttribute("aria-current", "true");
        await expectNoHorizontalScroll(page);
        await expectNoAxeViolations(page, AXE);
        expect(await contrastFailures(page), `${name} ${width}px ${colorScheme}`).toEqual([]);
        await screenshot(page, info, `listen-${name}-${width}-${colorScheme}`);
      }
    }
  }
});
