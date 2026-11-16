// Task 4.4 part 3 (D-133): the *Calibre* page and the books dashboard's stale-sync line in a real
// browser. The page lists the sync runs newest first and opens the newest; a run's details show each
// change by book; *Not in Calibre* lists a book with no Calibre id and Settings links to the page.
// The dashboard says *Calibre last synced N days ago* at 8 days and not at 7 or 6, in --muted and
// never --danger, and links to the page. The UX floor (design § 10): the empty, loading and error
// states drawn, named controls, 44px summaries, contrast in both themes, axe, no sideways scroll, and
// the screenshots at 360, 834 and 1280px light and dark and the dashboard's line at every feel-pass
// width with reduced motion and reduced transparency (D-40).
//
// The log is the whole table, so each test seeds its own runs and deletes every `calibre_syncs` row
// after, and the e2e suite runs one worker: no other spec's dashboard meets a stale run.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CalibreError from "../../src/app/settings/calibre/error";
import Loading from "../../src/app/settings/calibre/loading";
import type { SyncReport } from "../../src/db/calibre-sync";
import { today } from "../../src/lib/finish-date";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

test.describe.configure({ mode: "serial" });

// Sets its own viewport and theme: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order", "landmark-one-main", "page-has-heading-one", "list", "listitem",
];

const LOOSE = "E2E Calibre Loose Book";
const DAY = today();
/** A moment `n` Eastern days ago at noon-ish Eastern (17:00Z is 12 or 1 p.m. there): its Eastern day is DAY − n. */
const daysAgo = (n: number) => new Date(Date.parse(`${DAY}T17:00:00Z`) - n * 86_400_000).toISOString();

const report = (over: Partial<SyncReport> = {}): SyncReport => ({
  in: [], out: [], waiting: [], gone: [], skipped: [], skippedColumns: [], notes: [], ...over,
});
const NOTHING = report();
const CHANGED = report({
  in: [{
    kind: "updated", calibreId: 9001, bookId: "e2e-cal-b1", title: "E2E Calibre Renamed",
    changes: [{ field: "title", from: "E2E Calibre Old Name", to: "E2E Calibre Renamed" }, { field: "word count", from: 90000, to: 112000 }],
  }],
  out: [{ calibreId: 9001, bookId: "e2e-cal-b1", title: "E2E Calibre Renamed", column: "#date_read", from: "2026-03-01", to: "2026-03-17" }],
  waiting: [{ kind: "near spelling", calibreId: 9002, title: "E2E Calibre Piranesi!", author: "E2E Susanna Clarke", bookId: "e2e-cal-b2", bookTitle: "E2E Calibre Piranesi" }],
});
const FRESH = report({
  in: [{ kind: "created", calibreId: 9003, bookId: "e2e-cal-b3", title: "E2E Calibre Gideon", changes: [{ field: "status", from: null, to: "unlisted" }] }],
  gone: [{ bookId: "e2e-cal-b4", title: "E2E Calibre Vanished", calibreId: 9004 }],
  skippedColumns: ["#date_read"],
  skipped: [{ reason: "comic", calibreId: 9005, title: "E2E Calibre Saga #1" }],
});

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

/** Replaces the whole log with these runs, oldest first. */
const seedRuns = (...runs: [string, SyncReport][]) => withSql(async (sql) => {
  await sql`DELETE FROM calibre_syncs`;
  for (const [at, r] of runs) await sql`INSERT INTO calibre_syncs (ran_at, report) VALUES (${at}, ${sql.json(r as never)})`;
});

const threeRuns = () => seedRuns([daysAgo(20), NOTHING], [daysAgo(10), CHANGED], [daysAgo(1), FRESH]);

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM calibre_syncs`;
  await sql`DELETE FROM books WHERE id LIKE 'e2e-cal-%'`;
});

test.beforeEach(clean);
test.afterAll(clean);

const looseBook = () => withSql(async (sql) => {
  await sql`INSERT INTO books (id, title) VALUES ('e2e-cal-loose', ${LOOSE})`;
});

async function open(page: Page, path = "/settings/calibre") {
  await page.goto(path);
  await expect(page.locator("h1").first()).toBeVisible();
}

/** React has hydrated the page's navigation: markup swapped in before then is thrown away when it does. */
const hydratedShell = (page: Page) =>
  hydrated(page.locator('.bar a[href="/settings"], .rail a[href="/settings"], .side a[href="/settings"]').locator("visible=true").first());

const summaries = (page: Page) => page.locator(".calibre .crun > summary");

test("lists the runs newest first with counts, the newest open, and each change by book (AC-1, AC-2)", async ({ page }) => {
  await threeRuns();
  await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Calibre");
  const runs = page.locator(".cruns > .crun");
  await expect(runs).toHaveCount(3);
  // Newest first: the day-old run's counts, then the ten-day-old, then the twenty-day-old.
  await expect(runs.nth(0).locator("summary .ccounts")).toHaveText("1 in · 0 out · 0 waiting");
  await expect(runs.nth(1).locator("summary .ccounts")).toHaveText("1 in · 1 out · 1 waiting");
  await expect(runs.nth(2).locator("summary .ccounts")).toHaveText("0 in · 0 out · 0 waiting");
  await expect(runs.nth(0).locator("summary .cwhen")).toHaveText(/ · \d{1,2}:\d{2} (AM|PM)$/);
  // The newest is open, the others closed.
  await expect(runs.nth(0)).toHaveAttribute("open", "");
  await expect(runs.nth(1)).not.toHaveAttribute("open", "");
  await expect(runs.nth(0)).toContainText("E2E Calibre Gideon");
  await expect(runs.nth(0)).toContainText("E2E Calibre Vanished");
  await expect(runs.nth(0)).toContainText("missing, or held until the books cutover");
  // Opening the second shows what came in and went out by book, and what waits.
  await runs.nth(1).locator("summary").click();
  await expect(runs.nth(1)).toContainText("E2E Calibre Renamed");
  await expect(runs.nth(1)).toContainText("E2E Calibre Old Name");
  await expect(runs.nth(1)).toContainText("112000");
  await expect(runs.nth(1)).toContainText("Date read");
  await expect(runs.nth(1)).toContainText("17 Mar");
  await expect(runs.nth(1)).toContainText("E2E Calibre Piranesi!");
  // The run that changed nothing says so.
  await runs.nth(2).locator("summary").click();
  await expect(runs.nth(2)).toContainText("Nothing changed.");
});

test("a run's details open and close from the keyboard with a named summary", async ({ page }) => {
  await threeRuns();
  await open(page);
  const back = page.locator(".calibre .lede .clink");
  expect((await back.boundingBox())!.height, "the Settings link").toBeGreaterThanOrEqual(page.viewportSize()!.width < 768 ? 44 : 24);
  const second = summaries(page).nth(1);
  await second.focus();
  await expect(second).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".cruns > .crun").nth(1)).toHaveAttribute("open", "");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cruns > .crun").nth(1)).not.toHaveAttribute("open", "");
});

test("Settings links to the Calibre page, and a book with no Calibre id is listed under Not in Calibre (AC-4)", async ({ page }) => {
  await looseBook();
  await open(page, "/settings");
  const link = page.getByRole("link", { name: /Calibre/ });
  await expect(link).toHaveAttribute("href", "/settings/calibre");
  await expect(link).toContainText("Not synced yet");
  await hydrated(link);
  await link.click();
  await expect(page).toHaveURL(/\/settings\/calibre$/);
  await expect(page.getByRole("heading", { level: 1, name: "Calibre" })).toBeVisible();
  const missing = page.locator('[data-section="not-in-calibre"]');
  await expect(missing).not.toHaveAttribute("open", "");
  await missing.locator("summary").click();
  await expect(missing).toContainText(LOOSE);
});

test("Settings says when it last synced", async ({ page }) => {
  await threeRuns();
  await open(page, "/settings");
  await expect(page.getByRole("link", { name: /Calibre/ })).toContainText(/Last synced \d{1,2} [A-Z][a-z]{2}/);
});

test("before any run: one panel, one line, no button, and the floor holds (AC-5)", async ({ page }, info) => {
  await open(page);
  const panel = page.locator(".cempty");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("No sync yet.");
  await expect(panel).toContainText("npm run calibre:sync");
  await expect(page.locator("main button")).toHaveCount(0);
  await expect(page.locator(".cruns")).toHaveCount(0);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "calibre-empty");
});

test("meets the floor with runs: 44px summaries, contrast in this theme, axe, no sideways scroll (AC-5)", async ({ page }, info) => {
  await threeRuns();
  await looseBook();
  await open(page);
  await page.locator(".cruns > .crun").nth(1).locator("summary").click();
  await page.locator('[data-section="not-in-calibre"] summary').click();
  const boxes = await summaries(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
  expect(boxes.length).toBe(4);
  for (const box of boxes) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "calibre-runs");
});

test("the Settings row is a 44px link with a name, and its link text has contrast (AC-4, AC-5)", async ({ page }) => {
  await open(page, "/settings");
  const box = (await page.getByRole("link", { name: /Calibre/ }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);
});

test("the loading state draws the loaded rows' size (AC-5)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await threeRuns();
  await looseBook();
  await open(page);
  await hydratedShell(page);
  const rows = ".calibre .crun > summary";
  const measure = (selector: string) => page.locator(selector).evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
  const loaded = await measure(rows);
  const skeleton = renderToStaticMarkup(createElement(Loading)).replace(/^<main[^>]*>|<\/main>$/g, "");
  await page.evaluate((html) => { document.querySelector("main")!.innerHTML = html; }, skeleton);
  const sk = await measure("main .crun .csum");
  expect(sk.length, "how many rows").toBe(loaded.length);
  sk.forEach((s, n) => {
    expect(Math.abs(s.width - loaded[n].width), `row ${n + 1} width`).toBeLessThanOrEqual(2);
    expect(Math.abs(s.height - loaded[n].height), `row ${n + 1} height (skeleton ${s.height}px, loaded ${loaded[n].height}px)`).toBeLessThanOrEqual(2);
  });
  expect(await page.locator("main .sk").count()).toBeGreaterThan(5);
});

test("the error state: a neutral line with a grey ×, a named Try again button, nothing red (AC-5)", ONCE, async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page);
  await hydratedShell(page);
  const error = renderToStaticMarkup(createElement(CalibreError, { error: new Error("x"), reset: () => {} })).replace(/^<main[^>]*>|<\/main>$/g, "");
  await page.evaluate((html) => { document.querySelector("main")!.innerHTML = html; }, error);
  const line = page.locator(".cerror");
  await expect(line).toContainText("Couldn’t read the sync log.");
  const button = page.getByRole("button", { name: "Try again" });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const danger = await tokenColour(page, "--danger");
  const colours = await page.locator(".cerror, .cerror *").evaluateAll((els) =>
    els.flatMap((el) => { const s = getComputedStyle(el); return [s.color, s.backgroundColor, s.borderTopColor]; }));
  expect(colours).not.toContain(danger);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await screenshot(page, info, "calibre-error");
});

// ---- the dashboard's line ----------------------------------------------------------------------

test("at 8 days the books dashboard says Calibre last synced 8 days ago, in --muted, and it links to the page (AC-3)", async ({ page }) => {
  await seedRuns([daysAgo(8), NOTHING]);
  await open(page, "/books");
  const line = page.locator(".sync-line");
  await expect(line).toHaveCount(1);
  await expect(line).toHaveText("Calibre last synced 8 days ago");
  const link = line.getByRole("link", { name: "Calibre last synced 8 days ago" });
  await expect(link).toHaveAttribute("href", "/settings/calibre");
  const muted = await tokenColour(page, "--muted");
  const danger = await tokenColour(page, "--danger");
  const style = await computedStyle(link, ["color"]);
  expect(style.color).toBe(muted);
  expect(style.color).not.toBe(danger);
  // 44px on the phone, 24px elsewhere (design § 10); the line itself stays where it was.
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(page.viewportSize()!.width < 768 ? 44 : 24);
  await hydrated(link);
  await link.click();
  await expect(page).toHaveURL(/\/settings\/calibre$/);
});

test("at 7 days and at 6 days, and before any run, the dashboard has no such line (AC-1, AC-3)", async ({ page }) => {
  for (const days of [7, 6]) {
    await seedRuns([daysAgo(days), NOTHING]);
    await open(page, "/books");
    await expect(page.locator("h1")).toHaveText("Books");
    await expect(page.getByText(/Calibre last synced/)).toHaveCount(0);
  }
  await clean();
  await open(page, "/books");
  await expect(page.getByText(/Calibre last synced/)).toHaveCount(0);
});

test("the line passes contrast and axe, and nothing red (AC-3, AC-5)", async ({ page }) => {
  await seedRuns([daysAgo(9), NOTHING]);
  await open(page, "/books");
  await expect(page.locator(".sync-line")).toBeVisible();
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE.filter((r) => r !== "list" && r !== "listitem"));
  await expectNoHorizontalScroll(page);
});

// ---- the screenshots ---------------------------------------------------------------------------

test("the page at 360, 834 and 1280px, light and dark, empty and with runs (AC-5)", ONCE, async ({ page }, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await clean();
      await open(page);
      await expect(page.locator(".cempty")).toBeVisible();
      expect(await contrastFailures(page), `${width}px ${colorScheme} empty`).toEqual([]);
      await screenshot(page, info, `calibre-empty-${width}-${colorScheme}`);

      await threeRuns();
      await looseBook();
      await open(page);
      await page.locator(".cruns > .crun").nth(1).locator("summary").click();
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme} runs`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `calibre-runs-${width}-${colorScheme}`);
    }
  }
});

test("the dashboard with the line at every feel-pass width, light and dark, with reduced motion and reduced transparency (D-40, AC-5)", ONCE, async ({ page, context }, info) => {
  await seedRuns([daysAgo(8), NOTHING]);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    for (const [width, height] of [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, "/books");
      await expect(page.locator(".sync-line")).toHaveText("Calibre last synced 8 days ago");
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `books-sync-line-${width}-${colorScheme}`);
    }
  }
});
