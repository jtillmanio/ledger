// @area: books
// Task 5.17, part 2 of 3 (TASK-093, D-121, D-132, D-152): what you own, in the Library, in a browser.
// A row's `⋯` carries *I own it on paper* and *I own the audiobook*: each writes one owned_copies row of its
// format, the sub-line says so without a reload, and the toast's Undo removes the row. The *Owned* dropdown chip
// (task 6.24, MR-D20: *Any · Physical · Audiobook · Ebook · Not owned*) lists exactly its books, combines with a
// status chip and a sort, keeps the search, and survives a reload; every other link keeps `owned`, and
// *Everything* clears it.
// The books are made here under `E2E Own` titles the rest of the suite doesn't use, removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, toastSettled, tokenColour,
} from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "link-name", "button-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-required-children", "aria-required-parent", "landmark-unique", "duplicate-id-aria",
  "target-size",
];

type Fixture = {
  id: string; title: string; status: string; owned?: ("physical" | "audio")[]; calibre?: number; gone?: boolean;
};
// Calibre ids below zero: no Calibre book the test database may hold has one.
const BOOKS: Fixture[] = [
  { id: "e2e-own-paper", title: "E2E Own Paper", status: "read", owned: ["physical"] },
  { id: "e2e-own-audio", title: "E2E Own Audio", status: "read", owned: ["audio"] },
  { id: "e2e-own-ebook", title: "E2E Own Ebook", status: "read", calibre: -9301 },
  { id: "e2e-own-all", title: "E2E Own All Three", status: "read", owned: ["physical", "audio"], calibre: -9302 },
  { id: "e2e-own-none", title: "E2E Own Nothing", status: "read" },
  { id: "e2e-own-paper-next", title: "E2E Own Paper Next", status: "to_read", owned: ["physical"] },
  { id: "e2e-own-gone", title: "E2E Own Gone", status: "read", owned: ["physical"], calibre: -9303, gone: true },
  { id: "e2e-own-toggle", title: "E2E Own Toggle", status: "to_read" },
];
const TOGGLE = BOOKS.find((b) => b.id === "e2e-own-toggle")!;

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const ids = BOOKS.map((b) => b.id);
// What references the book first: owned_copies and book_status.
const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM owned_copies WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM book_status WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${ids}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, calibre_id, deleted_at)
                VALUES (${b.id}, ${b.title}, ${b.calibre ?? null}, ${b.gone ? new Date() : null})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${b.status})`;
      for (const f of b.owned ?? []) await sql`INSERT INTO owned_copies (book_id, format) VALUES (${b.id}, ${f})`;
    }
  });
});
test.afterAll(clean);

const ownedRows = (bookId: string) =>
  withSql((sql) => sql<{ format: string }[]>`SELECT format FROM owned_copies WHERE book_id = ${bookId} ORDER BY format`)
    .then((rows) => rows.map((r) => r.format));

// The Owned dropdown chip (task 6.24): named by its choice, it opens a group of links.
const ownedChip = (page: Page) => page.getByRole("button", { name: /^Owned: / });
const ownedList = (page: Page) => page.getByRole("group", { name: "Owned", exact: true });
const sortChip = (page: Page) => page.getByRole("button", { name: /^Sort: / });
/** Opens the Owned chip and chooses one of its links. */
async function chooseOwned(page: Page, name: string) {
  await hydrated(ownedChip(page));
  await ownedChip(page).click();
  await ownedList(page).getByRole("link", { name, exact: true }).click();
  await expect(ownedList(page)).toHaveCount(0);
}
/** Opens the Sort chip and chooses one of its links. */
async function chooseSort(page: Page, name: string) {
  await hydrated(sortChip(page));
  await sortChip(page).click();
  await page.getByRole("group", { name: "Sort", exact: true }).getByRole("link", { name, exact: true }).click();
}
/** The status row: the `.filters` that holds *Everything*. */
const statusChip = (page: Page, name: string) => page.locator(".filters")
  .filter({ has: page.getByRole("link", { name: "Everything", exact: true }) }).getByRole("link", { name, exact: true });
const titles = (page: Page) => page.locator(".book-row .row-title");
const row = (page: Page, title: string) => page.locator(".book-row").filter({ has: page.locator(".row-title", { hasText: new RegExp(`^${title}$`) }) });
const toast = (page: Page) => page.locator(".toast");

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(ownedChip(page)).toBeVisible();
}

/** Opens a row's `⋯` and answers its menu. */
async function menu(page: Page, title: string) {
  const more = page.getByRole("button", { name: `More for ${title}`, exact: true });
  await hydrated(more);
  await more.click();
  return page.getByRole("menu", { name: `More for ${title}`, exact: true });
}

test("each toggle writes its row, the sub-line says so without a reload, and Undo takes it back (AC-1, AC-2)", async ({ page }) => {
  await open(page, `/books/list?q=${encodeURIComponent(TOGGLE.title)}`);
  await expect(titles(page)).toHaveText([TOGGLE.title]);
  const sub = row(page, TOGGLE.title).locator(".row-sub");
  await expect(sub).toHaveText("");
  // A full page load would drop this.
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });

  for (const [format, item, word, unItem, said] of [
    ["physical", "I own it on paper", "Physical", "I don't own it on paper", "You own it on paper"],
    ["audio", "I own the audiobook", "Audiobook", "I don't own the audiobook", "You own the audiobook"],
  ] as const) {
    await (await menu(page, TOGGLE.title)).getByRole("menuitem", { name: item, exact: true }).click();
    await expect(sub).toHaveText(word);
    await expect(toast(page).locator(".toast-label")).toHaveText(said);
    await expect(toast(page)).toContainText(TOGGLE.title);
    expect(await ownedRows(TOGGLE.id)).toEqual([format]);

    // The item now says which way it goes.
    const m = await menu(page, TOGGLE.title);
    await expect(m.getByRole("menuitem", { name: unItem, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(sub).toHaveText("");
    await expect.poll(() => ownedRows(TOGGLE.id)).toEqual([]);
  }

  // Both at once name both, and *I don't own it on paper* removes the paper row alone; its Undo puts it back.
  await (await menu(page, TOGGLE.title)).getByRole("menuitem", { name: "I own it on paper", exact: true }).click();
  await expect(sub).toHaveText("Physical");
  await (await menu(page, TOGGLE.title)).getByRole("menuitem", { name: "I own the audiobook", exact: true }).click();
  await expect(sub).toHaveText("Physical · Audiobook");
  await (await menu(page, TOGGLE.title)).getByRole("menuitem", { name: "I don't own it on paper", exact: true }).click();
  await expect(sub).toHaveText("Audiobook");
  await expect(toast(page).locator(".toast-label")).toHaveText("You don't own it on paper");
  expect(await ownedRows(TOGGLE.id)).toEqual(["audio"]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(sub).toHaveText("Physical · Audiobook");
  await expect.poll(() => ownedRows(TOGGLE.id)).toEqual(["audio", "physical"]);

  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);

  // Leave the book as found.
  await withSql((sql) => sql`DELETE FROM owned_copies WHERE book_id = ${TOGGLE.id}`);
});

test("a book with an ebook, a paper copy and an audiobook names all three (AC-2)", async ({ page }) => {
  await open(page, `/books/list?q=${encodeURIComponent("E2E Own All Three")}`);
  await expect(row(page, "E2E Own All Three").locator(".row-sub")).toHaveText("Physical · Audiobook · Ebook");
});

test("each Owned choice lists exactly its books, with Read and Title, and survives a reload (AC-1, AC-3)", async ({ page }) => {
  await open(page, `/books/list?status=read&sort=title&q=${encodeURIComponent("E2E Own")}`);
  // Every live read book of ours, the soft-deleted one nowhere.
  await expect(titles(page)).toHaveText(["E2E Own All Three", "E2E Own Audio", "E2E Own Ebook", "E2E Own Nothing", "E2E Own Paper"]);

  const expected: [string, string, string[]][] = [
    ["Physical", "physical", ["E2E Own All Three", "E2E Own Paper"]],
    ["Audiobook", "audio", ["E2E Own All Three", "E2E Own Audio"]],
    ["Ebook", "ebook", ["E2E Own All Three", "E2E Own Ebook"]],
    ["Not owned", "none", ["E2E Own Nothing"]],
  ];
  for (const [name, value, books] of expected) {
    await chooseOwned(page, name);
    await expect(page).toHaveURL(new RegExp(`owned=${value}`));
    await expect(page).toHaveURL(/status=read/);
    await expect(page).toHaveURL(/sort=title/);
    await expect(ownedChip(page)).toHaveText(`Owned: ${name}`);
    await expect(statusChip(page, "Read")).toHaveAttribute("aria-current", "true");
    await expect(titles(page)).toHaveText(books);

    await page.reload();
    await hydrated(ownedChip(page));
    await expect(ownedChip(page)).toHaveText(`Owned: ${name}`);
    await expect(statusChip(page, "Read")).toHaveAttribute("aria-current", "true");
    await expect(sortChip(page)).toHaveText("Sort: Title");
    await expect(titles(page)).toHaveText(books);
    // The list marks the choice made, and only it.
    await ownedChip(page).click();
    await expect(ownedList(page).getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "true");
    await expect(ownedList(page).locator('[aria-current="true"]')).toHaveCount(1);
    await page.keyboard.press("Escape");
  }

  // Any is the way back: it drops owned, and the rest stays.
  await chooseOwned(page, "Any");
  await expect(page).not.toHaveURL(/owned=/);
  await expect(page).toHaveURL(/status=read/);
  await expect(ownedChip(page)).toHaveText("Owned: Any");
  await expect(titles(page)).toHaveCount(5);
});

test("Read + Physical + Title from the URL; a status chip and the sort keep owned, Everything clears it (AC-3)", async ({ page }) => {
  await open(page, "/books/list?status=read&sort=title&owned=physical");
  await expect(statusChip(page, "Read")).toHaveAttribute("aria-current", "true");
  await expect(ownedChip(page)).toHaveText("Owned: Physical");
  // Only read physical books, in title order: ours among them, the to-read and the deleted one not.
  const shown = await titles(page).allTextContents();
  expect(shown.filter((t) => t.startsWith("E2E Own"))).toEqual(["E2E Own All Three", "E2E Own Paper"]);
  for (const sub of await page.locator(".book-row .row-sub").allTextContents()) expect(sub).toContain("Physical");
  expect(shown).toEqual([...shown].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })));

  await statusChip(page, "To read").click();
  await expect(page).toHaveURL(/status=to_read/);
  await expect(page).toHaveURL(/owned=physical/);
  await expect(titles(page).filter({ hasText: "E2E Own Paper Next" })).toHaveCount(1);
  await expect(titles(page).filter({ hasText: /^E2E Own Paper$/ })).toHaveCount(0);

  await chooseSort(page, "Length");
  await expect(page).toHaveURL(/sort=length/);
  await expect(page).toHaveURL(/owned=physical/);
  await expect(ownedChip(page)).toHaveText("Owned: Physical");

  await statusChip(page, "Everything").click();
  await expect(page).not.toHaveURL(/owned=/);
  await expect(page).not.toHaveURL(/status=/);
  await expect(ownedChip(page)).toHaveText("Owned: Any");
});

test("an Owned choice with no match draws the list's empty state (AC-5)", async ({ page }) => {
  await open(page, `/books/list?q=${encodeURIComponent("E2E Own Nothing")}`);
  await chooseOwned(page, "Audiobook");
  await expect(page).toHaveURL(/owned=audio/);
  await expect(page.locator(".rows .empty").first()).toHaveText("Nothing matches. Try a broader filter.");
  await expect(titles(page)).toHaveCount(0);
});

test("the Owned chip, its choices and the row's menu items are named and big enough; axe and contrast hold (AC-5)", FLOOR, async ({ page }, info) => {
  await open(page, `/books/list?owned=physical&q=${encodeURIComponent("E2E Own")}`);
  const width = page.viewportSize()!.width;
  // The UX floor: 44px on the phone, nothing interactive under 24px from the tablet up.
  const floor = width < 768 ? 44 : 24;
  const box = (await ownedChip(page).boundingBox())!;
  expect(box.height, `Owned chip height at ${width}px`).toBeGreaterThanOrEqual(floor);
  expect(box.width).toBeGreaterThanOrEqual(24);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);

  // No hue (.claude/rules/ui.md): shut, the chip is grey (--muted text, --faint-deco outline); open, it is --ink.
  const colours = () => ownedChip(page).evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, border: cs.borderTopColor };
  });
  expect(await colours(), "shut chip").toEqual({ color: await tokenColour(page, "--muted"), border: await tokenColour(page, "--faint-deco") });

  await hydrated(ownedChip(page));
  await ownedChip(page).click();
  // Chips fade between states, so wait for the colour to settle.
  await expect.poll(colours, { message: "open chip" }).toEqual({ color: await tokenColour(page, "--ink"), border: await tokenColour(page, "--ink") });
  // The choice made (Physical, from the URL) is --ink too, never a hue.
  await expect(ownedList(page).getByRole("link", { name: "Physical", exact: true })).toHaveCSS("color", await tokenColour(page, "--ink"));
  const choices = ownedList(page).getByRole("link");
  await expect(choices).toHaveText(["Any", "Physical", "Audiobook", "Ebook", "Not owned"]);
  for (const b of await choices.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(b.height, `Owned choice height at ${width}px`).toBeGreaterThanOrEqual(floor);
    expect(b.width).toBeGreaterThanOrEqual(24);
  }
  await expectNoHorizontalScroll(page);
  // Open, the list covers the first rows' links: axe checks the list and the chip, as for a toast.
  await expectNoAxeViolations(page, AXE, ".chipmenu");
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "library-owned-chip");
  await page.keyboard.press("Escape");

  const m = await menu(page, "E2E Own Paper");
  const items = m.getByRole("menuitem");
  await expect(items.filter({ hasText: "I don't own it on paper" })).toHaveCount(1);
  await expect(items.filter({ hasText: "I own the audiobook" })).toHaveCount(1);
  for (const box of await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height, `menu item height at ${width}px`).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "library-owned-menu");
  await page.keyboard.press("Escape");
});

// Sets its own viewports and themes: runs once, in w390-light. A toggle and its toast, then the Undo, so the
// data is left as found.
test("the Owned row, the sub-line, the menu and the toast at 360, 834 and 1280px, light and dark (AC-5)", ONCE, async ({ page }, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, `/books/list?owned=physical&q=${encodeURIComponent("E2E Own")}`);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `library-owned-${width}-${colorScheme}`);

      await (await menu(page, "E2E Own Paper")).getByRole("menuitem", { name: "I own the audiobook", exact: true }).click();
      await expect(row(page, "E2E Own Paper").locator(".row-sub")).toHaveText("Physical · Audiobook");
      await toastSettled(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme} toast`).toEqual([]);
      await screenshot(page, info, `library-owned-toast-${width}-${colorScheme}`);
      await toast(page).getByRole("button", { name: "Undo" }).click();
      await expect(row(page, "E2E Own Paper").locator(".row-sub")).toHaveText("Physical");
      await expect.poll(() => ownedRows("e2e-own-paper")).toEqual(["physical"]);
    }
  }
});
