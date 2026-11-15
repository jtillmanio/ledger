// Task 3.4b, 2 of 3 (TASK-076; D-101, D-122, R2-08): Top books in a real browser. A past year lists its
// first ten, a divider, then every other book read that year, none collapsed; an unranked read shows
// under *Not ranked yet*; a read with no date under *No year*; the year is in the URL and survives a
// reload; a book moves anywhere with 1.10's reorder controls, across the divider too, and its undo puts
// the order back on screen and in the database. The UX floor: axe, contrast, 44px handles on the
// phone, nothing in --danger, reduced motion, and screenshots at 360, 834 and 1280px, light and dark.
//
// The fixture is 1987, a year no other spec reads, so the list is exactly this file's: twelve reads
// ranked 1–12, two unranked, and one read with no date. Every test starts from that ranking.
import { expect, test, type Locator, type Page } from "@playwright/test";
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
// TASK-077 (This or that): 1986, three ranked reads; a book finished in the Library to rank there, one
// finished with no date, and one 1986 read left unranked for the sorter's floor.
const SORT_YEAR = 1986;
const SORT_RANKED = ["e2e-top-s1", "e2e-top-s2", "e2e-top-s3"];
const SORT_UNRANKED = "e2e-top-su";
const FIN = "e2e-top-fin";
const FIN_UNDATED = "e2e-top-fin-nodate";
const SORT_ALL = [...SORT_RANKED, SORT_UNRANKED, FIN, FIN_UNDATED];
const ALL = [...RANKED, ...UNRANKED, UNDATED, ...SORT_ALL];
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
  // 1986: s1–s3 ranked 1–3, su unranked; fin and fin-nodate back on To read with no reads.
  for (const [i, id] of SORT_RANKED.entries()) {
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, year_rank)
              VALUES (${E2E_USER}, ${id}, ${`${SORT_YEAR}-0${i + 2}-10`}, 'exact', ${i + 1})`;
  }
  await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision)
            VALUES (${E2E_USER}, ${SORT_UNRANKED}, ${`${SORT_YEAR}-08-10`}, 'exact')`;
  await sql`UPDATE book_status SET status = 'to_read', finished_on = NULL, finished_on_precision = 'none',
              started_on = NULL, started_on_precision = 'none'
            WHERE user_id = ${E2E_USER} AND book_id = ANY(${[FIN, FIN_UNDATED]})`;
});

/** 1986's reads as stored: `id:rank`, in rank order, then the unranked as `id:-`. */
const sorted = () => db(async (sql) =>
  (await sql`SELECT book_id, year_rank FROM read_events
             WHERE user_id = ${E2E_USER} AND extract(year FROM finished_on) = ${SORT_YEAR}
             ORDER BY year_rank NULLS LAST, book_id`)
    .map((r) => `${r.book_id}:${r.year_rank ?? "-"}`));

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
  const more = page.getByRole("button", { name: `More for ${titleOf(RANKED[0])}, rank 1` });
  await expect(more).toBeAttached();
  const width = page.viewportSize()!.width;
  if (width < 768) {
    // The handle and the ⋯ menu both: the shared row menu is 32px elsewhere.
    for (const button of [handle, more]) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
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

// --- Task 3.4b, 3 of 3 (TASK-077; D-101): This or that, from a finish's toast and from Not ranked yet ---

const [S1, S2, S3] = SORT_RANKED;
/** 1986 as stored with fin read: the given ranks, then whatever is unranked (fin before su, by id). */
const ranks1986 = (ranked: string[], finRanked: boolean) =>
  [...ranked.map((id, i) => `${id}:${i + 1}`), ...(finRanked ? [] : [`${FIN}:-`]), `${SORT_UNRANKED}:-`];

/** Marks a To read book Read in the Library, finished on `on` (a day), or with No date. */
async function finish(page: Page, id: string, on: string | null) {
  await page.goto("/books/list");
  const title = page.locator(".row-title", { hasText: new RegExp(`^${titleOf(id)}$`) });
  const row = page.locator(".book-row", { has: title });
  await hydrated(row.locator(".status-toggle"));
  await row.locator(".status-toggle").click();
  await row.getByRole("button", { name: "Read", exact: true }).click();
  const finished = row.getByRole("group", { name: "Finished" });
  if (on) {
    await finished.getByRole("radio", { name: "Pick a date" }).check();
    await row.getByLabel("Finished on").fill(on);
  } else {
    await finished.getByRole("radio", { name: "No date" }).check();
  }
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.locator(".toast .toast-label")).toHaveText(`${titleOf(id)}: read`);
}

const sorter = (page: Page, id: string) => page.getByRole("dialog", { name: `Rank ${titleOf(id)} in ${SORT_YEAR}` });
const pair = (page: Page, id: string) => sorter(page, id).getByRole("group", { name: "Which did you like more?" });
const rankChip = (page: Page) => page.locator(".toast").getByRole("button", { name: `Rank it in ${SORT_YEAR}` });
/** A *Not ranked yet* row's *Rank it*, named with its title (*Rank it: Hamnet*). */
const rankItOn = (page: Page, id: string) =>
  page.locator(".top-list").getByRole("button", { name: new RegExp(`^Rank it\\W+${titleOf(id)}$`) });

async function atLeast44(locator: Locator) {
  const box = (await locator.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
}

test("a dated finish offers Rank it in its year, an undated one none; the chip opens the sorter two at a time (AC-3)", ONCE, async ({ page }) => {
  await finish(page, FIN_UNDATED, null);
  await expect(page.locator(".toast").getByRole("button", { name: /^Rank it/ })).toHaveCount(0);

  await finish(page, FIN, `${SORT_YEAR}-05-10`);
  const chip = rankChip(page);
  await chip.click();
  const sheet = sorter(page, FIN);
  await expect(sheet.getByRole("heading", { level: 2 })).toBeFocused();
  // The read being placed beside one of the year's three: the middle one, #2.
  const cards = pair(page, FIN).getByRole("button");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toHaveAccessibleName(new RegExp(`^${titleOf(FIN)}\\W+Just finished$`));
  await expect(cards.nth(1)).toHaveAccessibleName(new RegExp(`^${titleOf(S2)}\\W+#2$`));
  await expect(sheet.locator(".tot-count")).toHaveText("Pick 1 of at most 2");

  // Esc closes it, writing nothing; focus goes back to the chip, still there because the sheet held its toast.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(chip).toBeFocused();
  expect(await sorted()).toEqual(ranks1986(SORT_RANKED, false));
});

test("answering the picks places a finished read where the answers say, on Top books too; focus goes to its Undo (AC-4)", ONCE, async ({ page }) => {
  await finish(page, FIN, `${SORT_YEAR}-05-10`);
  await rankChip(page).click();
  const cards = pair(page, FIN).getByRole("button");
  // Better than #2 …
  await cards.nth(0).click();
  await expect(cards.nth(1)).toHaveAccessibleName(new RegExp(`^${titleOf(S1)}\\W+#1$`));
  await expect(sorter(page, FIN).locator(".tot-count")).toHaveText("Pick 2 of at most 2");
  // … worse than #1: second, in two picks.
  await cards.nth(1).click();
  await expect(sorter(page, FIN)).toHaveCount(0);
  await expect.poll(sorted).toEqual(ranks1986([S1, FIN, S2, S3], true));
  const toast = page.locator(".toast");
  await expect(toast.locator(".toast-label")).toHaveText(`Ranked ${titleOf(FIN)}`);
  await expect(toast.locator(".toast-detail")).toHaveText(`rank 2 of 4 in ${SORT_YEAR}`);
  await expect(toast.getByRole("button", { name: "Undo" })).toBeFocused();

  await open(page, `/books/top?year=${SORT_YEAR}`);
  await expect(titles(page)).toHaveText([S1, FIN, S2, S3, SORT_UNRANKED].map(titleOf));
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(FIN)}, rank 2` })).toBeVisible();
});

test("Skip writes no rank and leaves it under Not ranked yet, whose Rank it opens the same sorter; its placement undoes (AC-4)", ONCE, async ({ page }) => {
  await finish(page, FIN, `${SORT_YEAR}-05-10`);
  const chip = rankChip(page);
  await chip.click();
  await sorter(page, FIN).getByRole("button", { name: "Skip" }).click();
  await expect(sorter(page, FIN)).toHaveCount(0);
  await expect(chip).toBeFocused();
  expect(await sorted()).toEqual(ranks1986(SORT_RANKED, false));

  await open(page, `/books/top?year=${SORT_YEAR}`);
  await expect(page.getByRole("heading", { level: 2, name: /^Not ranked yet/ })).toHaveText("Not ranked yet 2");
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(FIN)}, not ranked yet` })).toBeVisible();
  const rankIt = rankItOn(page, FIN);
  await hydrated(rankIt);
  await rankIt.click();
  const sheet = sorter(page, FIN);
  await expect(sheet.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(pair(page, FIN).getByRole("button").nth(0)).toHaveAccessibleName(new RegExp(`^${titleOf(FIN)}\\W+Not ranked yet$`));
  // Back closes it too, and focus goes back to Rank it.
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(rankIt).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/books/top\\?year=${SORT_YEAR}$`));

  // Worse than #2, worse than #3: fourth.
  await rankIt.click();
  const cards = pair(page, FIN).getByRole("button");
  await expect(cards.nth(1)).toHaveAccessibleName(/#2$/);
  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAccessibleName(/#3$/);
  await cards.nth(1).click();
  await expect.poll(sorted).toEqual(ranks1986([S1, S2, S3, FIN], true));
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(FIN)}, rank 4` })).toBeVisible();
  // One undo puts the three back as they were and the read back under Not ranked yet.
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(sorted).toEqual(ranks1986(SORT_RANKED, false));
  await expect(page.getByRole("button", { name: `Reorder ${titleOf(FIN)}, not ranked yet` })).toBeVisible();
});

test("the sorter and the toast's Rank it meet the floor: 44px named buttons, the toast live above the sheet, axe, contrast, motion, screenshots (AC-5)", ONCE, async ({ page }, info) => {
  const SHEET_AXE = AXE.filter((r) => r !== "landmark-unique" && r !== "heading-order" && r !== "select-name");
  // From the toast, on the phone: the chip is a 44px button; the toast stays live and uncovered above the
  // open sheet, whose buttons sit clear of it (D-63, D-144).
  await finish(page, FIN, `${SORT_YEAR}-05-10`);
  const chip = rankChip(page);
  await atLeast44(chip);
  await chip.click();
  const sheet = sorter(page, FIN);
  await expect(sheet.getByRole("heading", { level: 2 })).toBeFocused();
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible();
  const undo = toast.getByRole("button", { name: "Undo" });
  const u = (await undo.boundingBox())!;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.textContent, [u.x + u.width / 2, u.y + u.height / 2]))
    .toBe("Undo");
  const skip = sheet.getByRole("button", { name: "Skip" });
  const s = (await skip.boundingBox())!;
  expect(s.y + s.height).toBeLessThanOrEqual((await toast.boundingBox())!.y);
  for (const button of [...await pair(page, FIN).getByRole("button").all(), skip]) await atLeast44(button);
  await expectNoAxeViolations(page, SHEET_AXE, ".sheet");
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused();

  // From Top books, at each width and theme.
  const danger = async () => {
    const d = await tokenColour(page, "--danger");
    return page.locator(".sheet").evaluate((el, d) => [...el.querySelectorAll("*")].filter((n) => {
      const st = getComputedStyle(n);
      return [st.color, st.backgroundColor, st.borderTopColor].includes(d);
    }).length, d);
  };
  for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await open(page, `/books/top?year=${SORT_YEAR}`);
      const rankIt = rankItOn(page, SORT_UNRANKED);
      await hydrated(rankIt);
      await rankIt.click();
      const su = sorter(page, SORT_UNRANKED);
      await expect(su.getByRole("heading", { level: 2 })).toBeFocused();
      await expect(pair(page, SORT_UNRANKED).getByRole("button")).toHaveCount(2);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, SHEET_AXE, ".sheet");
      expect(await contrastFailures(page)).toEqual([]);
      expect(await danger()).toBe(0);
      if (width < 768) {
        for (const button of [...await pair(page, SORT_UNRANKED).getByRole("button").all(), su.getByRole("button", { name: "Skip" })]) {
          await atLeast44(button);
        }
        await atLeast44(rankIt);
      }
      await screenshot(page, info, `this-or-that-${width}-${colorScheme}`);
      await page.keyboard.press("Escape");
      await expect(rankIt).toBeFocused();
    }
  }

  // Motion: a new pair fades in, opacity only; under reduced motion nothing moves.
  const fade = async () => page.locator(".tot-in").first().evaluate((el) => getComputedStyle(el).animationName);
  const rankIt = rankItOn(page, SORT_UNRANKED);
  await rankIt.click();
  expect(await fade()).toBe("tot-fade");
  const keyframes = await page.evaluate(() => [...document.styleSheets].flatMap((sh) => {
    try { return [...sh.cssRules]; } catch { return []; }
  }).filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule && r.name === "tot-fade")
    .flatMap((r) => [...r.cssRules].map((k) => (k as CSSKeyframeRule).style.cssText)));
  expect(keyframes.length).toBeGreaterThan(0);
  for (const k of keyframes) expect(k).toMatch(/^opacity: [\d.]+;$/);
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await rankIt.click();
  expect(await fade()).toBe("none");
});
