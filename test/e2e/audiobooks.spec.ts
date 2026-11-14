// Task 1.23 (D-85): a listen in a real browser, at every width, light and dark
// (AC-1, AC-4, AC-6). A master-list row with a listen carries the headphones
// glyph, an image named *Listened*, and its reads and listens counted apart; a
// book only read on the page shows no glyph; one being listened to shows the
// glyph named *Listening*; the status control offers *Listening* beside
// *Reading*; In flight lists a Listening book under its own *Listening* heading.
// The books are made here, under E2E ids the rest of the suite doesn't use, and
// removed after the last test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "svg-img-alt",
];

const BOTH = { id: "e2e-au-both", title: "E2E Au Twice Read Once Heard" };
const HEARD = { id: "e2e-au-heard", title: "E2E Au Heard Once" };
const SEEN = { id: "e2e-au-seen", title: "E2E Au Read Once" };
const NOW = { id: "e2e-au-now", title: "E2E Au Listening Now" };
const EYES = { id: "e2e-au-eyes", title: "E2E Au Reading Now" };
const BOOKS = [BOTH, HEARD, SEEN, NOW, EYES];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql((sql) => sql`DELETE FROM books WHERE id = ANY(${BOOKS.map((b) => b.id)}::text[])`);

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
    for (const [b, status] of [[BOTH, "read"], [HEARD, "read"], [SEEN, "read"], [NOW, "listening"], [EYES, "reading"]] as const) {
      const done = status === "read";
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision, started_on, started_on_precision)
                VALUES (${E2E_USER}, ${b.id}, ${status}, ${done ? "2026-03-17" : null}, ${done ? "exact" : "none"},
                        ${done ? null : "2026-10-21"}, ${done ? "none" : "exact"})`;
    }
    for (const [b, on, format] of [
      [BOTH, "2022-05-01", "text"], [BOTH, "2024-05-01", "audio"], [BOTH, "2026-03-17", "text"],
      [HEARD, "2026-03-17", "audio"], [SEEN, "2026-03-17", "text"],
    ] as const) {
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, ${b.id}, ${on}, 'exact', ${format})`;
    }
  });
});
test.afterAll(clean);

const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });
const glyphs = (scope: Locator) => scope.locator('svg[role="img"].listen');

/** The glyph draws in its text's colour, never a state colour of its own. */
async function inheritsText(page: Page, glyph: Locator) {
  const own = await glyph.evaluate((el) => {
    const s = getComputedStyle(el);
    return { stroke: s.stroke, parent: getComputedStyle(el.parentElement!).color };
  });
  expect(own.stroke).toBe(own.parent);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(own.stroke, token).not.toBe(await tokenColour(page, token));
}

test("the master list: the glyph and the counts, apart (AC-1, AC-4, AC-6)", async ({ page }, info) => {
  await page.goto("/books/list?q=E2E%20Au");
  const both = bookRow(page, BOTH.title);
  await expect(glyphs(both)).toHaveCount(1);
  await expect(glyphs(both)).toHaveAccessibleName("Listened");
  await expect(both.locator(".row-reads")).toHaveText("Read 2× · Listened 1×");

  const heard = bookRow(page, HEARD.title);
  await expect(glyphs(heard)).toHaveAccessibleName("Listened");
  await expect(heard.locator(".row-reads")).toHaveText("Listened 1×");

  // A book only read on the page shows none.
  const seen = bookRow(page, SEEN.title);
  await expect(glyphs(seen)).toHaveCount(0);
  await expect(seen.locator(".row-reads")).toHaveText("Read 1×");

  const now = bookRow(page, NOW.title);
  await expect(glyphs(now)).toHaveAccessibleName("Listening");
  await expect(now.locator(".row-reads")).toHaveCount(0);
  await expect(glyphs(bookRow(page, EYES.title))).toHaveCount(0);

  // An image with a name, never colour alone, in the text's own colour.
  expect(await glyphs(both).evaluate((el) => el.tagName.toLowerCase())).toBe("svg");
  await inheritsText(page, glyphs(both));
  const { color } = await computedStyle(both.locator(".row-reads"), ["color"]);
  for (const token of ["--ready", "--blocked", "--danger"]) expect(color, token).not.toBe(await tokenColour(page, token));

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "audiobooks-list");
});

test("the Reading chip lists Reading and Listening books both (AC-4)", CORE, async ({ page }) => {
  await page.goto("/books/list?status=reading&q=E2E%20Au");
  await expect(page.locator(".book-row .row-title")).toHaveText([NOW.title, EYES.title]);
});

test("the status control offers Listening beside Reading, a real button with its name (AC-4, AC-6)", async ({ page }, info) => {
  await page.goto("/books/list?q=E2E%20Au");
  const row = bookRow(page, NOW.title);
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  const group = row.getByRole("group", { name: `Status of ${NOW.title}` });
  await expect(group.getByRole("button")).toHaveText(["To read", "Reading", "Listening", "Read", "DNF"]);
  const listening = group.getByRole("button", { name: "Listening" });
  await expect(listening).toHaveAttribute("aria-pressed", "true");
  expect((await listening.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  await expect(glyphs(row)).toHaveAccessibleName("Listening");
  await inheritsText(page, glyphs(row));

  await expectNoHorizontalScroll(page);
  // The page scrolled to the open control; at the top the sticky bar (and, since 2.2i, its 44px tab
  // row) covers none of the chips, so axe's target-size judges the links, not the bar over them.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "audiobooks-control");
});

test("In flight lists a Listening book under Listening, not Reading (AC-1, AC-6)", async ({ page }, info) => {
  await page.goto("/books/status");
  const reading = page.locator('section[data-flight="reading"]');
  const listening = page.locator('section[data-flight="listening"]');
  await expect(listening.getByRole("heading", { level: 2 })).toHaveText(/^Listening\s*\d+ books?$/);
  await expect(listening.locator(".row-title", { hasText: NOW.title })).toHaveCount(1);
  await expect(reading.locator(".row-title", { hasText: NOW.title })).toHaveCount(0);
  await expect(reading.locator(".row-title", { hasText: EYES.title })).toHaveCount(1);
  // Reading comes first.
  const heads = await page.locator("section[data-flight] h2").allTextContents();
  expect(heads.map((h) => h.split(/\s/)[0])).toEqual(["Reading", "Listening"]);
  const glyph = glyphs(listening.locator(".row", { has: page.locator(".row-title", { hasText: NOW.title }) }));
  await expect(glyph).toHaveAccessibleName("Listening");
  await inheritsText(page, glyph);

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "audiobooks-in-flight");
});

test("Done: a book with a listen carries the glyph named Listened; one only read, none (AC-6)", async ({ page }, info) => {
  await page.goto("/books/status?tab=done");
  const row = (title: string) => page.locator(".row", { has: page.locator(".row-title", { hasText: title }) });
  await expect(glyphs(row(HEARD.title))).toHaveAccessibleName("Listened");
  await expect(glyphs(row(SEEN.title))).toHaveCount(0);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "audiobooks-done");
});
