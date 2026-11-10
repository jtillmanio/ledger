// Task 2.3, part 2 (F-23, D-37, D-38, D-63, R3-08): the plan picker in a real browser, on a Library row's
// ⋯ → *Plan for…*, against the TEST database. The sheet lists the next five years then On deck and
// Someday; a year opens *No quarter yet* and Q1–Q4, each chip carrying its period's current total as
// plan_capacity gives it; a quarter fills the preview with its total after the move before anything is
// written; over capacity the preview is amber with the amount over, never red. Confirming moves the book
// through TASK-063's writes with an Undo. The books are made here under E2E ids the rest of the suite
// doesn't use, and removed after the last test. Add books' side of the picker is
// test/add-book-sheet.test.tsx and book-search.spec.ts. Figures are the fixture's own (D-7).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { DEFAULT_SETTINGS, easternYear, formatWords, wordsPerYear } from "../../src/lib/settings";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

// The years relative to now, as the chips offer them: Y+1 and Y+2 are the roadmap Check's 2027 and 2028.
const Y = easternYear();
const NEXT = `${Y + 1}-Q1`;
const LATER = `${Y + 2}-Q2`;
const HUGE = `${Y + 3}-Q1`;

const AUTHOR = { id: "e2e-pk-author", name: "E2E Pk Author" };
const BOOKS = [
  { id: "e2e-pk-a", title: "E2E Pk Alpha", words: 100_000, plan: [NEXT, 1] },
  { id: "e2e-pk-b", title: "E2E Pk Bravo", words: 150_000, plan: [NEXT, 2] },
  { id: "e2e-pk-c", title: "E2E Pk Charlie", words: 80_000, plan: [NEXT, 3] },
  { id: "e2e-pk-d", title: "E2E Pk Delta", words: 120_000, plan: [LATER, 1] },
  { id: "e2e-pk-s", title: "E2E Pk Someday", words: 90_000, plan: null },
  { id: "e2e-pk-g", title: "E2E Pk Giant", words: 900_000, plan: null },
] as const;
const [A, B, C, D, S, G] = BOOKS;
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
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
  await sql`DELETE FROM authors WHERE id = ${AUTHOR.id}`;
});

// The E2E user's reading settings, as an earlier spec left them (settings.spec.ts writes them): put
// aside for this file, so every capacity here is the default one (45 min × 185 wpm, a quarter about
// 760k), and put back after. The suite runs one file at a time (workers: 1), so nothing races this.
let savedSettings: Record<string, unknown> | undefined;

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    [savedSettings] = await sql`SELECT * FROM reading_settings WHERE user_id = ${E2E_USER}`;
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    await sql`INSERT INTO authors (id, name) VALUES (${AUTHOR.id}, ${AUTHOR.name})`;
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, author_id, word_count, word_count_source)
                VALUES (${b.id}, ${b.title}, ${AUTHOR.id}, ${b.words}, 'stated')`;
    }
  });
});
test.afterAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    if (savedSettings) await sql`INSERT INTO reading_settings ${sql(savedSettings)}`;
  });
});

// Every test starts from the same plan: A, B, C in the next year's Q1, D in the later year's Q2, the rest Someday.
test.beforeEach(async () => {
  await withSql(async (sql) => {
    await sql`DELETE FROM reading_plan WHERE book_id = ANY(${IDS}::text[])`;
    await sql`DELETE FROM book_status WHERE book_id = ANY(${IDS}::text[])`;
    for (const b of BOOKS) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
      if (b.plan) {
        await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${b.id}, ${b.plan[0]}, ${b.plan[1]})`;
      }
    }
  });
});

const planOf = (id: string) =>
  withSql((sql) => sql`SELECT period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${id} ORDER BY period`)
    .then((rows) => rows.map((r) => [r.period as string, r.ordinal as number | null]));
const quarterOf = (period: string) =>
  withSql((sql) => sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${period}
                       AND book_id = ANY(${IDS}::text[]) ORDER BY ordinal`)
    .then((rows) => rows.map((r) => [r.book_id as string, r.ordinal as number]));
const statusOf = (id: string) =>
  withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`).then((rows) => rows[0]?.status);
/** A period's planned words from plan_capacity, which is what the chips and the preview must agree with. */
const totalOf = (period: string) =>
  withSql((sql) => sql`SELECT planned_words FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`)
    .then((rows) => Number(rows[0]?.planned_words ?? 0));
const capacityOf = (period: string) =>
  withSql((sql) => sql`SELECT capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`)
    .then((rows) => (rows[0] ? Number(rows[0].capacity)
      : wordsPerYear(DEFAULT_SETTINGS, Number(period.slice(0, 4))) / (period.includes("-Q") ? 4 : 1)));
/** Words as the preview prints them: 1,010k. */
const k = (words: number) => `${Math.round(words / 1000).toLocaleString("en-US")}k`;

const toast = (page: Page) => page.locator(".toast");
const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });

async function openLibrary(page: Page) {
  await page.goto("/books/list?q=E2E%20Pk");
  await expect(bookRow(page, S.title)).toHaveCount(1);
}

async function openPlan(page: Page, title: string) {
  const more = page.getByRole("button", { name: `More for ${title}` });
  await hydrated(more);
  await more.click();
  await page.getByRole("menuitem", { name: "Plan for…" }).click();
  const sheet = page.getByRole("dialog", { name: title });
  await expect(sheet).toBeVisible();
  // The chips and the book have loaded.
  await expect(sheet.locator(".pp-sum").first()).toBeVisible();
  return { more, sheet };
}

const chip = (sheet: Locator, name: string | number) => sheet.getByRole("button", { name: new RegExp(`^${name}`) });
const primary = (sheet: Locator) => sheet.locator(".pp .btnrow .btn:not(.sec)");

/** Waits out the chips' colour transitions, so a contrast measurement sees the colours they settle on. */
const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));

/** Picks `year` then `quarter` ("Q3", or "No quarter yet"). */
async function pick(sheet: Locator, year: number, quarter?: string) {
  await chip(sheet, year).click();
  if (quarter) await chip(sheet.getByRole("group", { name: `Quarter of ${year}` }), quarter).click();
}

test("Plan for… opens on the next five years then On deck and Someday; a year shows No quarter yet and Q1–Q4, each with its total (AC-2)", CORE, async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openPlan(page, S.title);
  const row = sheet.getByRole("group", { name: "Move to" });
  await expect(row.getByRole("button")).toHaveCount(7);
  const names = await row.getByRole("button").evaluateAll((els) => els.map((el) => el.firstChild?.textContent));
  expect(names).toEqual([0, 1, 2, 3, 4].map((i) => String(Y + i)).concat(["On deck", "Someday"]));
  await expect(sheet.locator(".pp-quarters")).toHaveCount(0);
  // The year chips carry plan_capacity's totals.
  for (let i = 0; i < 5; i++) {
    await expect(row.getByRole("button").nth(i).locator(".pp-sum")).toHaveText(formatWords(await totalOf(String(Y + i))));
  }

  await chip(sheet, Y + 1).click();
  await expect(chip(sheet, Y + 1)).toHaveAttribute("aria-pressed", "true");
  const quarters = sheet.getByRole("group", { name: `Quarter of ${Y + 1}` });
  const labels = await quarters.getByRole("button").evaluateAll((els) => els.map((el) => el.firstChild?.textContent));
  expect(labels).toEqual(["No quarter yet", "Q1", "Q2", "Q3", "Q4"]);
  const periods = [`${Y + 1}`, ...[1, 2, 3, 4].map((q) => `${Y + 1}-Q${q}`)];
  for (const [i, period] of periods.entries()) {
    await expect(quarters.getByRole("button").nth(i).locator(".pp-sum")).toHaveText(formatWords(await totalOf(period)));
  }
  // Nothing is written by looking.
  expect(await planOf(S.id)).toEqual([]);
});

test("a quarter fills the preview with its total plus the book's words before anything is written; the primary names it (AC-2)", CORE, async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openPlan(page, S.title);
  await expect(primary(sheet)).toHaveAttribute("aria-disabled", "true");
  await pick(sheet, Y + 1, "Q3");
  const period = `${Y + 1}-Q3`;
  const preview = sheet.locator(".pp-preview");
  await expect(preview.locator(".pp-name")).toHaveText(`Q3 ${Y + 1} after the move`);
  await expect(preview.locator(".pp-figure"))
    .toHaveText(`${k((await totalOf(period)) + S.words)} of ${k(await capacityOf(period))}`);
  await expect(preview).not.toHaveAttribute("data-over", "true");
  await expect(primary(sheet)).toHaveText(`Move to Q3 ${Y + 1}`);
  await expect(primary(sheet)).not.toHaveAttribute("aria-disabled", "true");
  expect(await planOf(S.id)).toEqual([]);
});

test("moving a 150k book from the next year's Q1 to the later year's Q2: previewed first, both totals move by 150k, it goes last, Undo puts it back (AC-1)", CORE, async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/plan") bodies.push(req.postDataJSON());
  });
  const before = { q1: await totalOf(NEXT), q2: await totalOf(LATER) };
  await openLibrary(page);
  const { more, sheet } = await openPlan(page, B.title);
  // It opens on the year the book is planned in, with its quarter chosen: that is where it is.
  await expect(chip(sheet, Y + 1)).toHaveAttribute("aria-pressed", "true");
  await expect(primary(sheet)).toHaveAttribute("aria-disabled", "true");
  await expect(sheet.locator(".sheet-reason")).toHaveText("It's already there.");
  await expect(sheet.locator(".bdg")).toHaveText(`planned · Q1 ${Y + 1}`);

  await pick(sheet, Y + 2, "Q2");
  await expect(sheet.locator(".pp-figure")).toHaveText(`${k(before.q2 + B.words)} of ${k(await capacityOf(LATER))}`);
  // The preview is not the move: the plan is as it was.
  expect(await quarterOf(NEXT)).toEqual([[A.id, 1], [B.id, 2], [C.id, 3]]);
  expect(bodies).toEqual([]);

  await primary(sheet).click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`Moved to Q2 ${Y + 2}`);
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await quarterOf(NEXT)).toEqual([[A.id, 1], [C.id, 2]]);
  expect(await quarterOf(LATER)).toEqual([[D.id, 1], [B.id, 2]]);
  expect(await totalOf(NEXT)).toBe(before.q1 - B.words);
  expect(await totalOf(LATER)).toBe(before.q2 + B.words);
  // The sheet writes one period value, never a year apart from a quarter, never a month.
  expect(bodies).toEqual([{ bookId: B.id, from: NEXT, to: LATER }]);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => quarterOf(NEXT)).toEqual([[A.id, 1], [B.id, 2], [C.id, 3]]);
  expect(await quarterOf(LATER)).toEqual([[D.id, 1]]);
  expect(await totalOf(NEXT)).toBe(before.q1);
  expect(await totalOf(LATER)).toBe(before.q2);
});

test("On deck and Someday need no year or quarter: no quarter row, no total; Someday clears the plan row and leaves book_status (AC-1, AC-3)", CORE, async ({ page }) => {
  await openLibrary(page);
  let { sheet } = await openPlan(page, B.title);
  await chip(sheet, "On deck").click();
  await expect(sheet.locator(".pp-quarters")).toHaveCount(0);
  await expect(sheet.locator(".pp-figure")).toHaveCount(0);
  await expect(primary(sheet)).toHaveText("Move to On deck");
  await primary(sheet).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => planOf(B.id)).toEqual([["on_deck", null]]);
  expect(await quarterOf(NEXT)).toEqual([[A.id, 1], [C.id, 2]]);

  ({ sheet } = await openPlan(page, B.title));
  await chip(sheet, "Someday").click();
  await expect(sheet.locator(".pp-quarters")).toHaveCount(0);
  await expect(sheet.locator(".pp-figure")).toHaveCount(0);
  await expect(primary(sheet)).toHaveText("Move to Someday");
  await primary(sheet).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => planOf(B.id)).toEqual([]);
  expect(await statusOf(B.id)).toBe("to_read");

  // From a quarter straight to Someday closes the quarter up too.
  ({ sheet } = await openPlan(page, A.title));
  await chip(sheet, "Someday").click();
  await primary(sheet).click();
  await expect.poll(() => planOf(A.id)).toEqual([]);
  expect(await quarterOf(NEXT)).toEqual([[C.id, 1]]);
  expect(await statusOf(A.id)).toBe("to_read");
});

test("No quarter yet writes a bare year (AC-1)", CORE, async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/plan") bodies.push(req.postDataJSON());
  });
  await openLibrary(page);
  const { sheet } = await openPlan(page, S.title);
  await pick(sheet, Y + 3, "No quarter yet");
  await expect(primary(sheet)).toHaveText(`Move to ${Y + 3}`);
  await expect(sheet.locator(".pp-name")).toHaveText(`${Y + 3} after the move`);
  await primary(sheet).click();
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => planOf(S.id)).toEqual([[`${Y + 3}`, null]]);
  expect(bodies).toEqual([{ bookId: S.id, from: "someday", to: `${Y + 3}` }]);
});

test("over capacity the preview is amber with the amount over and a disabled Accept, never red (AC-3)", async ({ page }, info) => {
  await openLibrary(page);
  const { sheet } = await openPlan(page, G.title);
  await pick(sheet, Y + 3, "Q1");
  const preview = sheet.locator(".pp-preview");
  const capacity = await capacityOf(HUGE);
  const planned = (await totalOf(HUGE)) + G.words;
  await expect(preview).toHaveAttribute("data-over", "true");
  await expect(preview.locator(".pp-figure")).toHaveText(`${k(planned)} of ${k(capacity)} · over ${k(planned - capacity)}`);
  const accept = preview.getByRole("button", { name: "Accept as a stretch year" });
  await expect(accept).toHaveAttribute("aria-disabled", "true");
  await expect(accept).toHaveAccessibleDescription("Accepting a stretch year arrives with 2.7.");
  expect((await computedStyle(preview, ["background-color"]))["background-color"]).toBe(await tokenColour(page, "--blocked-soft"));
  expect((await computedStyle(preview.locator(".pp-figure"), ["color"])).color).toBe(await tokenColour(page, "--blocked"));

  // Nothing on the sheet resolves to --danger.
  const danger = await tokenColour(page, "--danger");
  const painted = await sheet.evaluate((el) => [el, ...el.querySelectorAll("*")].flatMap((n) => {
    const s = getComputedStyle(n);
    return [s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor, s.outlineColor];
  }));
  expect(painted).not.toContain(danger);
  // The one new colour pair, --blocked text on --blocked-soft, measured as drawn (light and dark projects both run this).
  await settled(page);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await screenshot(page, info, "plan-picker-over");

  // A target that fits is plain again: the year itself (about 3,040k), as no quarter can hold 900k.
  // Wait for its figure first: while the total is being worked out data-over is unset too, so the
  // flag alone would pass before the answer came back (it did, for Q3, which is over).
  const year = String(Y + 3);
  const yearTotal = (await totalOf(year)) + G.words;
  const yearCapacity = await capacityOf(year);
  expect(yearTotal).toBeLessThan(yearCapacity);
  await chip(sheet.getByRole("group", { name: `Quarter of ${Y + 3}` }), "No quarter yet").click();
  await expect(preview.locator(".pp-figure")).toHaveText(`${k(yearTotal)} of ${k(yearCapacity)}`);
  await expect(preview).not.toHaveAttribute("data-over", "true");
});

test("Esc, Back, Cancel and a confirm each close the sheet and return focus to the row's ⋯ (AC-5)", CORE, async ({ page }) => {
  await openLibrary(page);
  let { more, sheet } = await openPlan(page, S.title);
  await expect(sheet.getByRole("heading", { name: S.title })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();

  ({ more, sheet } = await openPlan(page, S.title));
  await page.goBack();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  await expect(page).toHaveURL(/\/books\/list\?q=E2E/);

  ({ more, sheet } = await openPlan(page, S.title));
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
  expect(await planOf(S.id)).toEqual([]);

  ({ more, sheet } = await openPlan(page, S.title));
  await chip(sheet, "On deck").click();
  await primary(sheet).click();
  await expect(sheet).toHaveCount(0);
  await expect(more).toBeFocused();
});

test("Tab stays inside the sheet, every chip is a button with a name and its pressed state, and each target is big enough (AC-5)", async ({ page }) => {
  await openLibrary(page);
  const { sheet } = await openPlan(page, S.title);
  await chip(sheet, Y + 1).click();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Tab");
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 30; i++) await page.keyboard.press("Shift+Tab");
  expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  const chips = sheet.locator(".pp-chip");
  expect(await chips.count()).toBe(12);
  for (const el of await chips.all()) {
    await expect(el).toHaveJSProperty("tagName", "BUTTON");
    expect(await el.getAttribute("aria-pressed")).toMatch(/^(true|false)$/);
    expect((await el.innerText()).trim().length).toBeGreaterThan(0);
  }
  // 44px under 1024px, 32px from there; nothing interactive under 24px.
  const wide = (page.viewportSize()?.width ?? 0) >= 1024;
  for (const box of await chips.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(wide ? 32 : 44);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  for (const box of await sheet.locator("button").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(24);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
});

test("text is 4.5:1 and the chip outlines 3:1; axe finds nothing; the page does not scroll sideways (AC-5)", async ({ page }, info) => {
  await openLibrary(page);
  const { sheet } = await openPlan(page, S.title);
  await pick(sheet, Y + 1, "Q3");
  await expect(sheet.locator(".pp-figure")).toBeVisible();
  await settled(page);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);

  // An unpressed chip's outline against the sheet it sits on: WCAG 1.4.11, 3:1.
  const ratio = await sheet.locator(".pp-chip[aria-pressed=false]").first().evaluate((el) => {
    const parse = (css: string) => {
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const edge = parse(getComputedStyle(el).borderTopColor);
    const ground = parse(getComputedStyle(el.closest(".sheet")!).backgroundColor);
    const [hi, lo] = [lum(edge), lum(ground)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
  await screenshot(page, info, "plan-picker");
});

// Sets its own viewport and scheme: runs once, in w390-light, and takes each of the three widths in both themes.
test("screenshots at 360, 834 and 1280px, light and dark, with no horizontal scroll and nothing failing contrast (AC-5)", { tag: "@at-w390-light" }, async ({ page }, info) => {
  test.setTimeout(120_000);
  await openLibrary(page);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      const { sheet } = await openPlan(page, S.title);
      await pick(sheet, Y + 1, "Q3");
      await expect(sheet.locator(".pp-figure")).toBeVisible();
      await expectNoHorizontalScroll(page);
      await settled(page);
      expect(await contrastFailures(page), `${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `plan-picker-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    }
  }
});
