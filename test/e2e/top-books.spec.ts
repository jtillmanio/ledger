// Task 3.4b, 2 of 3 (TASK-076; D-101, D-122, R2-08): Top books in a real browser. A past year lists its
// first ten, a divider, then every other book read that year, none collapsed; an unranked read shows
// under *Not ranked yet*; a read with no date under *No year*; the year is in the URL and survives a
// reload; a book moves anywhere with 1.10's reorder controls, across the divider too, and its undo puts
// the order back on screen and in the database. The UX floor: axe, contrast, 44px handles on the
// phone, nothing in --danger, reduced motion, and screenshots at 360, 834 and 1280px, light and dark.
//
// The fixture is 1987, a year no other spec reads, so the list is exactly this file's: twelve reads
// ranked 1–12, two unranked, and one read with no date. Every test starts from that ranking.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Writes or sets its own viewport: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const YEAR = 1987;
const PAGE = `/books/top?year=${YEAR}`;
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order", "label", "select-name",
];

const pad = (n: number) => String(n).padStart(2, "0");
const RANKED = Array.from({ length: 12 }, (_, i) => `e2e-top-${pad(i + 1)}`);
const UNRANKED = ["e2e-top-u1", "e2e-top-u2"];
const UNDATED = "e2e-top-undated";
const ALL = [...RANKED, ...UNRANKED, UNDATED];
const titleOf = (id: string) => `Top ${id.slice("e2e-top-".length)}`;

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** The fixture's reads, ranked as at the start: e2e-top-01 … 12 at 1 … 12, u1 and u2 not, one undated. */
const reset = () => db(async (sql) => {
  await sql`DELETE FROM read_events WHERE user_id = ${E2E_USER} AND book_id = ANY(${ALL})`;
  for (const [i, id] of RANKED.entries()) {
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank, format)
              VALUES (${E2E_USER}, ${id}, ${`${YEAR}-${pad((i % 12) + 1)}-15`}, 'exact', ${i + 1}, ${i === 1 ? "audio" : "text"})`;
  }
  for (const [i, id] of UNRANKED.entries()) {
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${id}, ${`${YEAR}-0${i + 1}-20`}, 'exact')`;
  }
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
            VALUES (${E2E_USER}, ${UNDATED}, NULL, 'none')`;
});

/** 1987's ranking as stored: `id:rank`, in rank order, then the unranked as `id:-`. */
const stored = () => db(async (sql) =>
  (await sql`SELECT book_id, year_rank FROM read_events
             WHERE user_id = ${E2E_USER} AND extract(year FROM finished_on) = ${YEAR}
             ORDER BY year_rank NULLS LAST, book_id`)
    .map((r) => `${r.book_id}:${r.year_rank ?? "-"}`));
const START = [...RANKED.map((id, i) => `${id}:${i + 1}`), ...UNRANKED.map((id) => `${id}:-`)];

test.beforeAll(async () => {
  await db(async (sql) => {
    await sql`INSERT INTO books (id, title) SELECT id, 'Top ' || substr(id, 9) FROM unnest(${ALL}::text[]) id
              ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO book_status (user_id, book_id, status) SELECT ${E2E_USER}, id, 'read' FROM unnest(${ALL}::text[]) id
              ON CONFLICT (user_id, book_id) DO NOTHING`;
  });
});

test.beforeEach(reset);

test.afterAll(async () => {
  await db(async (sql) => {
    await sql`DELETE FROM read_events WHERE user_id = ${E2E_USER} AND book_id = ANY(${ALL})`;
    await sql`DELETE FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ANY(${ALL})`;
    await sql`DELETE FROM books WHERE id = ANY(${ALL})`;
  });
});

const rows = (page: Page) => page.locator(".top-list ol.queue > li");
const titles = (page: Page) => rows(page).locator(".qtitle");

async function open(page: Page, url = PAGE) {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  // Nothing on the page resolves to --danger: a ranking is not an error.
  const danger = await tokenColour(page, "--danger");
  const red = await page.locator("main").evaluate((main, d) => [...main.querySelectorAll("*")].filter((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor, s.outlineColor].includes(d);
  }).map((el) => el.outerHTML.slice(0, 80)), danger);
  expect(red).toEqual([]);
}

test("a past year lists its first ten, a divider, then every other read, none collapsed; Not ranked yet; No year (AC-1)", async ({ page }, info) => {
  await open(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Best of ${YEAR}`);
  await expect(titles(page)).toHaveText([...RANKED, ...UNRANKED].map(titleOf));
  for (const li of await rows(page).all()) await expect(li).toBeVisible();

  // One divider, heading the eleventh row: the first ten above it.
  await expect(page.locator(".rankdiv")).toHaveCount(1);
  await expect(rows(page).nth(10).locator(".rankdiv")).toBeVisible();
  await expect(rows(page).nth(10).locator(".qtitle")).toHaveText(titleOf(RANKED[10]));
  // The unranked reads under their heading.
  const head = page.getByRole("heading", { level: 2, name: /^Not ranked yet/ });
  await expect(head).toBeVisible();
  await expect(rows(page).nth(12).locator(".rankhead")).toBeVisible();
  await expect(rows(page).nth(12).locator(".qtitle")).toHaveText(titleOf(UNRANKED[0]));
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(UNRANKED[1])}, not ranked yet` })).toBeVisible();
  // A listen is ranked like any read, with its glyph.
  await expect(rows(page).nth(1).getByRole("img", { name: "Listened" })).toBeVisible();
  await floor(page);
  await screenshot(page, info, "top-books-year");

  // No year: the switcher's last option, the read with no date, no handle.
  const year = page.getByRole("combobox", { name: "Year" });
  await hydrated(year);
  await year.selectOption({ label: "No year" });
  await page.waitForURL("**/books/top?year=none");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No year");
  await expect(titles(page)).toContainText([titleOf(UNDATED)]);
  await expect(page.locator(".top-list button.drag")).toHaveCount(0);
  await floor(page);
  await screenshot(page, info, "top-books-no-year");
});

test("the chosen year is in the URL and survives a reload (AC-3)", { tag: "@core" }, async ({ page }) => {
  await open(page, "/books/top");
  const year = page.getByRole("combobox", { name: "Year" });
  // Newest first, No year last.
  const values = await year.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(values.at(-1)).toBe("none");
  const years = values.slice(0, -1).map(Number);
  expect(years).toEqual([...years].sort((a, b) => b - a));
  expect(years).toContain(YEAR);

  await hydrated(year);
  await year.selectOption(String(YEAR));
  await page.waitForURL(`**${PAGE}`);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Best of ${YEAR}`);
  await expect(page.getByRole("combobox", { name: "Year" })).toHaveValue(String(YEAR));
});

test("the keyboard moves rank 11 to rank 4: fourth, in the top ten, the old 10 below the divider; Undo restores it (AC-4)", ONCE, async ({ page }) => {
  await open(page);
  const handle = page.getByRole("button", { name: `Reorder ${titleOf(RANKED[10])}, rank 11` });
  await hydrated(handle);
  await handle.focus();
  await page.keyboard.press("Space");
  for (let k = 0; k < 7; k++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");

  const moved = [...RANKED.slice(0, 3), RANKED[10], ...RANKED.slice(3, 10), RANKED[11]];
  await expect.poll(stored).toEqual([...moved.map((id, i) => `${id}:${i + 1}`), ...UNRANKED.map((id) => `${id}:-`)]);
  await expect(titles(page)).toHaveText([...moved, ...UNRANKED].map(titleOf));
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(RANKED[10])}, rank 4` })).toBeVisible();
  // The old tenth is now eleventh: the row the divider heads.
  await expect(rows(page).nth(10).locator(".qtitle")).toHaveText(titleOf(RANKED[9]));
  await expect(rows(page).nth(10).locator(".rankdiv")).toBeVisible();
  await expect(page.locator(".toast")).toContainText(`Moved ${titleOf(RANKED[10])}`);
  await expect(page.locator(".toast")).toContainText("rank 4");

  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(stored).toEqual(START);
  await expect(titles(page)).toHaveText([...RANKED, ...UNRANKED].map(titleOf));
});

test("the row menu moves rank 11 to rank 4, and moving an unranked read up ranks it; each undo restores (AC-4)", ONCE, async ({ page }) => {
  await open(page);
  // Rank 11 → 4: seven times Move up from its menu, each one a write.
  for (let rank = 11; rank > 4; rank--) {
    const more = page.getByRole("button", { name: `More for ${titleOf(RANKED[10])}` });
    await hydrated(more);
    await more.click();
    await page.getByRole("menuitem", { name: "Move up" }).click();
    await expect(page.getByRole("button", { name: `Reorder ${titleOf(RANKED[10])}, rank ${rank - 1}` })).toBeVisible();
  }
  const moved = [...RANKED.slice(0, 3), RANKED[10], ...RANKED.slice(3, 10), RANKED[11]];
  await expect.poll(stored).toEqual([...moved.map((id, i) => `${id}:${i + 1}`), ...UNRANKED.map((id) => `${id}:-`)]);
  await expect(rows(page).nth(3).locator(".qtitle")).toHaveText(titleOf(RANKED[10]));
  await expect(rows(page).nth(10).locator(".qtitle")).toHaveText(titleOf(RANKED[9]));
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(RANKED[10])}, rank 5` })).toBeVisible();

  // The first unranked read, moved up one place past the heading, lands above rank 12: ranked 12th,
  // the old 12th now 13th.
  await reset();
  await open(page);
  const more = page.getByRole("button", { name: `More for ${titleOf(UNRANKED[0])}` });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Move up" }).click();
  await expect.poll(stored).toEqual([
    ...RANKED.slice(0, 11).map((id, i) => `${id}:${i + 1}`), `${UNRANKED[0]}:12`, `${RANKED[11]}:13`, `${UNRANKED[1]}:-`,
  ]);
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(UNRANKED[0])}, rank 12` })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /^Not ranked yet/ })).toHaveText("Not ranked yet 1");
  // Its undo takes it back out of the ranking: not ranked yet again, not a move to an old rank.
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(stored).toEqual(START);
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(UNRANKED[0])}, not ranked yet` })).toBeVisible();
});

test("handles are 44px named buttons on the phone; reduced motion stops the move animation (AC-6)", { tag: "@core" }, async ({ page }) => {
  await open(page);
  const handle = page.getByRole("button", { name: `Reorder ${titleOf(RANKED[0])}, rank 1` });
  await expect(handle).toHaveClass(/\bdrag\b/);
  await expect(page.getByRole("button", { name: `More for ${titleOf(RANKED[0])}` })).toBeVisible();
  const width = page.viewportSize()!.width;
  if (width < 768) {
    const box = (await handle.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    const durations = await rows(page).evaluateAll((lis) => lis.map((li) => getComputedStyle(li).transitionDuration));
    expect(durations.every((d) => d.split(",").every((x) => parseFloat(x) === 0))).toBe(true);
  }
});

test("screenshots at 360, 834 and 1280px, light and dark: the floor at each (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await open(page);
      await floor(page);
      await screenshot(page, info, `top-books-${width}-${colorScheme}`);
    }
  }
  // On the desktop the year control sits in the rail, beside the list.
  const list = (await page.locator(".top-list").boundingBox())!;
  const rail = (await page.locator(".top-ctl").boundingBox())!;
  expect(rail.x).toBeGreaterThan(list.x + list.width - 1);
});
