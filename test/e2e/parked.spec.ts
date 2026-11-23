// @area: books
// Task 5.15, part 2 of 4 (TASK-109, F-66, D-105): Parked in a real browser.
// *Park* sits on a book's status control and its row's `⋯` for a book To read,
// Reading or Listening, grey as DNF is, never on a Read, DNF or Unlisted one;
// parking a planned book raises the Library's *Parked · N* chip without a reload,
// and the toast's Undo puts it back in its quarter at its place, its row
// focused. The chip lists a parked book, the Library box finds it with its grey
// *parked* badge, and Add books' search tags it *Parked*. The UX floor at 360
// and 1280px, light and dark (AC-6). The books are made here, under ids the
// rest of the suite doesn't use, and removed after the last test; the browser
// suite runs one file at a time, so no other spec sees them.
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
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order",
];

const P = "e2e-pk-";
/** A quarter no other spec plans in: the three are its 1–3. */
const QUARTER = "2031-Q1";
const FIRST = { id: `${P}first`, title: "E2E Pk First" };
const SECOND = { id: `${P}second`, title: "E2E Pk Second" };
const THIRD = { id: `${P}third`, title: "E2E Pk Third" };
const READING = { id: `${P}reading`, title: "E2E Pk Reading" };
const LISTENING = { id: `${P}listening`, title: "E2E Pk Listening" };
const READ = { id: `${P}read`, title: "E2E Pk Read" };
const DNF = { id: `${P}dnf`, title: "E2E Pk Stopped" };
const UNLISTED = { id: `${P}unlisted`, title: "E2E Pk Unlisted" };
/** Parked before the suite starts: the chip, the search and the floor read it. */
const AWAY = { id: `${P}away`, title: "E2E Pk Put Away" };
const PLANNED = [FIRST, SECOND, THIRD];
const STATUSES: [typeof FIRST, string][] = [
  [FIRST, "to_read"], [SECOND, "to_read"], [THIRD, "to_read"], [READING, "reading"], [LISTENING, "listening"],
  [READ, "read"], [DNF, "dnf"], [UNLISTED, "unlisted"],
];

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => db((sql) => sql`DELETE FROM books WHERE id LIKE ${P + "%"}`);

/** Every book as the suite starts it: the three planned at 1–3, the rest at their status, AWAY parked. */
const reset = () => db(async (sql) => {
  await sql`DELETE FROM reading_plan WHERE book_id LIKE ${P + "%"}`;
  for (const [b, status] of STATUSES) {
    await sql`UPDATE book_status SET status = ${status}, parked_on = NULL WHERE user_id = ${E2E_USER} AND book_id = ${b.id}`;
  }
  await sql`UPDATE book_status SET status = 'parked', parked_on = '2026-10-01' WHERE user_id = ${E2E_USER} AND book_id = ${AWAY.id}`;
  for (const [i, b] of PLANNED.entries()) {
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${b.id}, ${QUARTER}, ${i + 1})`;
  }
});

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await clean();
  await db(async (sql) => {
    for (const [b, status] of [...STATUSES, [AWAY, "to_read"] as const]) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${status})`;
    }
  });
  await reset();
});
test.beforeEach(reset);
test.afterAll(clean);

/** What the database holds for a book: its status, and each plan row as `period:ordinal`. */
const stored = (id: string) => db(async (sql) => {
  const [s] = await sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
  const plan = await sql`SELECT period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
  return { status: s?.status as string, plan: plan.map((r) => `${r.period}:${r.ordinal}`) };
});
const quarter = () => db(async (sql) => (await sql`
  SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${QUARTER} ORDER BY ordinal`)
  .map((r) => `${r.book_id}:${r.ordinal}`));
const parkedCount = () => db(async (sql) => (await sql`
  SELECT count(*)::int AS n FROM book_status st JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
  WHERE st.user_id = ${E2E_USER} AND st.status = 'parked'`)[0].n as number);

const row = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: new RegExp(`^${title}$`) }) });
const badge = (page: Page, title: string) => row(page, title).locator(".status-toggle");
const group = (page: Page, title: string) => page.getByRole("group", { name: `Status of ${title}` });
const parkedChip = (page: Page) => page.locator(".filters a.chip", { hasText: /^Parked/ });
const toast = (page: Page) => page.locator(".toast");
const titles = (page: Page) => page.locator(".book-row .row-title");

/** Open a row's status control. */
async function expand(page: Page, title: string) {
  await hydrated(badge(page, title));
  await badge(page, title).click();
  await expect(group(page, title)).toBeVisible();
}

/** The `⋯`'s items for a row. */
async function menuItems(page: Page, title: string) {
  const more = page.getByRole("button", { name: `More for ${title}`, exact: true });
  await hydrated(more);
  await more.click();
  const items = await page.getByRole("menu", { name: `More for ${title}` }).getByRole("menuitem").allTextContents();
  await page.keyboard.press("Escape");
  return items;
}

test("Park on a planned book raises Parked · N without a reload; Undo puts it back at 2 in its quarter (AC-1, AC-2)", ONCE, async ({ page }) => {
  const before = await parkedCount();
  await page.goto(`/books/list?q=${encodeURIComponent(SECOND.title)}`);
  await expect(parkedChip(page)).toHaveAttribute("aria-label", `Parked, ${before} ${before === 1 ? "book" : "books"}`);
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });

  await expand(page, SECOND.title);
  await group(page, SECOND.title).getByRole("button", { name: "Park", exact: true }).click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`${SECOND.title}: parked`);
  await expect(toast(page)).toContainText("Was to read");
  // N up by one, the row's badge says it, and the page was never reloaded.
  await expect(parkedChip(page)).toHaveAttribute("aria-label", `Parked, ${before + 1} books`);
  await expect(parkedChip(page).locator(".n")).toHaveText(String(before + 1));
  await expect(badge(page, SECOND.title)).toHaveText("Status: parked");
  await expect(group(page, SECOND.title).getByRole("button", { name: "Park", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
  expect(await stored(SECOND.id)).toEqual({ status: "parked", plan: [] });
  expect(await quarter()).toEqual([`${FIRST.id}:1`, `${THIRD.id}:2`]);

  // Under the chip, in a second tab, while the toast stays live in this one (the undo stack is the page's memory).
  await toast(page).hover();
  const other = await page.context().newPage();
  try {
    await other.goto("/books/list");
    await parkedChip(other).click();
    await expect(other).toHaveURL(/\/books\/list\?status=parked$/);
    await expect(parkedChip(other)).toHaveAttribute("aria-current", "true");
    const ours = titles(other).filter({ hasText: /^E2E Pk/ });
    await expect(ours).toHaveCount(2);
    expect((await ours.allTextContents()).sort()).toEqual([AWAY.title, SECOND.title].sort());
  } finally {
    await other.close();
  }

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(badge(page, SECOND.title)).toHaveText("Status: to read");
  await expect(parkedChip(page)).toHaveAttribute("aria-label", `Parked, ${before} ${before === 1 ? "book" : "books"}`);
  expect(await stored(SECOND.id)).toEqual({ status: "to_read", plan: [`${QUARTER}:2`] });
  expect(await quarter()).toEqual([`${FIRST.id}:1`, `${SECOND.id}:2`, `${THIRD.id}:3`]);
});

test("a park takes the row off To read; its Undo brings it back between the other two, its badge focused", ONCE, async ({ page }) => {
  await page.goto(`/books/list?status=to_read&level=quarter&sort=plan&q=${encodeURIComponent("E2E Pk")}`);
  await expect(titles(page)).toHaveText([FIRST.title, SECOND.title, THIRD.title]);
  await expand(page, SECOND.title);
  await group(page, SECOND.title).getByRole("button", { name: "Park", exact: true }).click();
  await expect(titles(page)).toHaveText([FIRST.title, THIRD.title]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(titles(page)).toHaveText([FIRST.title, SECOND.title, THIRD.title]);
  await expect(badge(page, SECOND.title)).toBeFocused();
  expect(await quarter()).toEqual([`${FIRST.id}:1`, `${SECOND.id}:2`, `${THIRD.id}:3`]);
});

test("Park is offered for To read, Reading and Listening, on the control and the ⋯, and not for Read, DNF or Unlisted (AC-3)", ONCE, async ({ page }) => {
  for (const [b, offered] of [[FIRST, true], [READING, true], [LISTENING, true], [READ, false], [DNF, false], [UNLISTED, false]] as const) {
    await page.goto(`/books/list?q=${encodeURIComponent(b.title)}`);
    await expand(page, b.title);
    const park = group(page, b.title).getByRole("button", { name: "Park", exact: true });
    await expect(park, b.title).toHaveCount(offered ? 1 : 0);
    expect((await menuItems(page, b.title)).includes("Park"), b.title).toBe(offered);
    if (!offered) continue;
    // Grey, as DNF is: parking is not a warning, held or destructive.
    expect(await park.evaluate((el) => el.tagName)).toBe("BUTTON");
    expect((await park.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    const style = await computedStyle(park, ["color", "background-color", "border-top-color"]);
    for (const token of ["--danger", "--blocked"]) {
      const state = await tokenColour(page, token);
      for (const [prop, value] of Object.entries(style)) expect(value, `${b.title} ${prop} ${token}`).not.toBe(state);
    }
  }
  // Pressed, on a Parked book, it is still grey: the muted fill DNF's has.
  await page.goto("/books/list?status=parked");
  await expand(page, AWAY.title);
  const pressed = group(page, AWAY.title).getByRole("button", { name: "Park", exact: true });
  await expect(pressed).toHaveAttribute("aria-pressed", "true");
  const fill = (await computedStyle(pressed, ["background-color"]))["background-color"];
  expect(fill).toBe(await tokenColour(page, "--muted"));
  for (const token of ["--danger", "--blocked", "--brand"]) expect(fill, token).not.toBe(await tokenColour(page, token));
  await expect(badge(page, AWAY.title)).toHaveText("Status: parked");
});

test("Park from a Reading row's ⋯ is the same write: toast, Undo back to Reading", ONCE, async ({ page }) => {
  await page.goto(`/books/list?q=${encodeURIComponent(READING.title)}`);
  const more = page.getByRole("button", { name: `More for ${READING.title}`, exact: true });
  await hydrated(more);
  await more.click();
  const item = page.getByRole("menu", { name: `More for ${READING.title}` }).getByRole("menuitem", { name: "Park", exact: true });
  expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await item.click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`${READING.title}: parked`);
  await expect(toast(page)).toContainText("Was reading");
  await expect(badge(page, READING.title)).toHaveText("Status: parked");
  expect((await stored(READING.id)).status).toBe("parked");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(badge(page, READING.title)).toHaveText("Status: reading");
  expect((await stored(READING.id)).status).toBe("reading");
});

test("the Library box finds a parked book with its parked badge; Add books' search tags it Parked (AC-1, AC-4)", ONCE, async ({ page }) => {
  await page.goto("/books/list");
  await expect(titles(page).filter({ hasText: AWAY.title })).toHaveCount(0);
  const box = page.getByRole("searchbox", { name: "Search books" });
  await hydrated(box);
  await box.fill(AWAY.title);
  await expect(titles(page)).toHaveText([AWAY.title]);
  await expect(badge(page, AWAY.title)).toHaveText("Status: parked");

  await page.goto("/books/add");
  const search = page.getByRole("searchbox");
  await hydrated(search);
  await search.fill(AWAY.title);
  await page.keyboard.press("Enter");
  const yours = page.getByRole("list", { name: "In your library" }).getByRole("listitem")
    .filter({ hasText: AWAY.title });
  await expect(yours.locator(".tag")).toHaveText("Parked");
});

test("Parked at 360 and 1280px, light and dark: the chip and Park are real, ≥ 24px, axe and contrast clean; with none, the empty state (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto("/books/list?status=parked");
      const chip = parkedChip(page);
      await expect(chip).toHaveAttribute("aria-current", "true");
      await expect(chip).toBeVisible();
      expect(await chip.evaluate((el) => el.tagName)).toBe("A");
      expect((await chip.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      await expand(page, AWAY.title);
      const park = group(page, AWAY.title).getByRole("button", { name: "Park", exact: true });
      expect((await park.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `parked-list-${width}-${colorScheme}`);
    }
  }

  // Nothing parked: no chip, and the filter by URL draws the list's empty state.
  expect(await parkedCount(), "only this suite's book is parked").toBe(1);
  await db((sql) => sql`UPDATE book_status SET status = 'to_read', parked_on = NULL WHERE user_id = ${E2E_USER} AND book_id = ${AWAY.id}`);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/books/list?status=parked");
  await expect(page.locator(".rows .empty")).toHaveText("Nothing matches. Try a broader filter.");
  await expect(parkedChip(page)).toHaveCount(0);
  await screenshot(page, info, "parked-empty-360-light");
});
