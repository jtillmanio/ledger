// Task 3.5, 2 of 3 (TASK-079): the book sheet in a real browser. `/book/[id]`
// from a list is a sheet over it (an intercepted route): Back closes it with the
// list's scroll and focus where they were (AC-1, AC-2); a direct load or a
// refresh is the full page, an unknown or removed book not found (AC-1, AC-3);
// the sheet and the Library row write status through the one route (AC-1);
// a book with no summary moves nothing (AC-5, CLS 0); and the UX floor (AC-6):
// focus on the heading and back on the opener by Esc, Back, the scrim and the
// close, the page behind inert but the undo toast, a drag that dismisses past
// a third and springs back short of it, opacity alone under reduced motion,
// axe, contrast, and screenshots at 360, 834 and 1280px, light and dark.
// The books are made here, under E2E ids the rest of the suite doesn't use, and
// removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "aria-dialog-name", "landmark-unique",
  "duplicate-id-aria", "target-size", "label", "svg-img-alt",
];

const PREFIX = "E2E Bd";
const LIST = `/books/list?q=${encodeURIComponent(PREFIX)}`;
/** Forty-five plain to-read books, so the Library scrolls past its 40th row. */
const FILLER = Array.from({ length: 45 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { id: `e2e-bd-${n}`, title: `${PREFIX} ${n}` };
});
const FEATURE = { id: "e2e-bd-feature", title: `${PREFIX} Feature` };
const PLAIN = { id: "e2e-bd-plain", title: `${PREFIX} Plain` };
const GONE = { id: "e2e-bd-gone", title: `${PREFIX} Gone` };
const IDS = [...FILLER, FEATURE, PLAIN, GONE].map((b) => b.id);

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql((sql) => sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`);

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of FILLER) await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${b.id}, ${b.title}, 90000, 'stated')`;
    await sql`INSERT INTO books (id, title, published_year, page_count, word_count, word_count_source, summary, subjects)
              VALUES (${FEATURE.id}, ${FEATURE.title}, 2010, 412, 65000, 'estimated',
                      ${"A world of stone and storms.\n\nA second paragraph."}, ${["Epic fantasy", "Magic"]})`;
    await sql`INSERT INTO books (id, title, published_year, page_count) VALUES (${PLAIN.id}, ${PLAIN.title}, 1999, 300)`;
    await sql`INSERT INTO books (id, title, deleted_at) VALUES (${GONE.id}, ${GONE.title}, now())`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${FEATURE.id}, 'read', '2025-03-17', 'exact')`;
    for (const [start, finish, format] of [
      ["2022-04-20", "2022-05-01", "text"], ["2024-04-10", "2024-05-01", "audio"], ["2025-03-01", "2025-03-17", "text"],
    ] as const) {
      await sql`INSERT INTO read_events (user_id, book_id, started_on, started_on_precision, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, ${FEATURE.id}, ${start}, 'exact', ${finish}, 'exact', ${format})`;
    }
  });
});
test.afterAll(clean);

const rowLink = (page: Page, title: string) => page.locator(".book-row .row-title").getByRole("link", { name: title, exact: true });
const sheet = (page: Page) => page.getByRole("dialog");

/** Open a book's sheet from the Library, as a tap does, once its link is live. */
async function openFrom(page: Page, title: string) {
  const link = rowLink(page, title);
  await hydrated(link);
  await link.click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).getByRole("heading", { level: 2, name: title })).toBeVisible();
  // Measured once it has risen: the enter is a translate (or a scale) over --dur-4.
  await expect.poll(() => sheet(page).evaluate((el) =>
    el.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
}

test("opens over the Library past its 40th row; Back closes it with the list's scroll and focus where they were (AC-1, AC-2)", async ({ page }) => {
  await page.goto(LIST);
  const target = FILLER[41];
  const link = rowLink(page, target.title);
  await hydrated(link);
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  await link.click();

  await expect(page).toHaveURL(new RegExp(`/book/${target.id}$`));
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(target.title);
  // The list is still rendered behind it, and it is the heading that has focus.
  await expect(page.locator(".book-row")).toHaveCount(FILLER.length + 2);
  await expect(dialog.getByRole("heading", { level: 2, name: target.title })).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(LIST);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await expect(link).toBeFocused();
});

test("Esc, the scrim, the close and the grab handle each close it and put focus back on the row link (AC-6)", async ({ page }) => {
  await page.goto(LIST);
  const ways: [string, (p: Page) => Promise<void>][] = [
    ["Esc", (p) => p.keyboard.press("Escape")],
    ["the close", (p) => sheet(p).getByRole("button", { name: "Close", exact: true }).click()],
    ["the scrim", (p) => p.mouse.click(5, 5)],
    ["the grab handle", (p) => sheet(p).getByRole("button", { name: "Dismiss book" }).click()],
  ];
  for (const [way, close] of ways) {
    await openFrom(page, FILLER[2].title);
    if (way === "the grab handle" && !(await sheet(page).getByRole("button", { name: "Dismiss book" }).isVisible())) {
      // From 1024px the sheet is a modal with no grab handle: Esc stands in.
      await page.keyboard.press("Escape");
    } else {
      await close(page);
    }
    await expect(sheet(page), way).toBeHidden();
    await expect(page, way).toHaveURL(LIST);
    await expect(rowLink(page, FILLER[2].title), way).toBeFocused();
  }
});

test("a direct visit, and a refresh, render the full page with the same content and no sheet (AC-1, AC-3)", async ({ page }) => {
  for (const visit of ["load", "refresh"] as const) {
    if (visit === "load") await page.goto(`/book/${FEATURE.id}`);
    else await page.reload();
    await expect(page.getByRole("dialog"), visit).toHaveCount(0);
    await expect(page.locator(".rsheet-top"), visit).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: FEATURE.title }), visit).toBeVisible();
    await expect(page.locator(".detail:not([aria-busy]) h2.s"), visit)
      .toHaveText(["About", "Details", "Your record", "Reading history"]);
    await expect(page.locator(".detail-reads"), visit).toHaveText("Read 2× · Listened 1×");
  }
  // The same content as the sheet a list opens.
  await page.goto(LIST);
  await openFrom(page, FEATURE.title);
  await expect(sheet(page).locator(".detail h3.s")).toHaveText(["About", "Details", "Your record", "Reading history"]);
  await expect(sheet(page).locator(".detail-reads")).toHaveText("Read 2× · Listened 1×");
  await expect(sheet(page).locator(".detail-history > li")).toHaveCount(3);
});

test("an unknown or removed book renders the not-found page (AC-3)", async ({ page }) => {
  for (const id of ["e2e-bd-nope", GONE.id]) {
    await page.goto(`/book/${id}`);
    await expect(page.getByText("This page could not be found."), id).toBeVisible();
    await expect(page.locator(".detail"), id).toHaveCount(0);
  }
});

test("the Library's other routes under /books are not caught by the sheet", async ({ page }) => {
  await page.goto(LIST);
  // The phone's tab row, the tablet's rail or the desktop sidebar: whichever this width draws.
  const plan = page.locator('a[href="/books/plan"]:visible').first();
  await hydrated(plan);
  await plan.click();
  await expect(page).toHaveURL(/\/books\/plan$/);
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the sheet and the Library row write status through the same route (AC-1)", async ({ page }) => {
  const book = FILLER[4];
  const writes: { path: string; status: unknown }[] = [];
  page.on("request", (req) => {
    if (req.method() !== "POST" || !new URL(req.url()).pathname.startsWith("/api/progress/book")) return;
    writes.push({ path: new URL(req.url()).pathname, status: req.postDataJSON()?.status });
  });
  await page.goto(LIST);

  // The row's inline editor: DNF.
  const row = page.locator(".book-row", { has: page.getByRole("link", { name: book.title, exact: true }) });
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  await row.getByRole("group", { name: `Status of ${book.title}` }).getByRole("button", { name: "DNF" }).click();
  await expect(toggle).toContainText("DNF");

  // The sheet's: To read, through the same control.
  await openFrom(page, book.title);
  const group = sheet(page).getByRole("group", { name: `Status of ${book.title}` });
  await expect(group.getByRole("button", { name: "DNF" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "To read" }).click();
  await expect(group.getByRole("button", { name: "To read" })).toHaveAttribute("aria-pressed", "true");

  expect(writes).toEqual([{ path: "/api/progress/book", status: "dnf" }, { path: "/api/progress/book", status: "to_read" }]);
  const [st] = await withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${book.id}`);
  expect(st.status).toBe("to_read");
});

test("behind the sheet the page is inert, all but the undo toast, which stays live (AC-6, D-63)", async ({ page }) => {
  const book = FILLER[6];
  await page.goto(LIST);
  await openFrom(page, book.title);
  expect(await page.locator("main").evaluate((el) => Boolean(el.closest("[inert]")))).toBe(true);
  // A status change in the sheet: its toast's Undo answers, the sheet stays open.
  await sheet(page).getByRole("group", { name: `Status of ${book.title}` }).getByRole("button", { name: "DNF" }).click();
  const undo = page.locator(".toast").getByRole("button", { name: "Undo" });
  await expect(undo).toBeVisible();
  expect(await undo.evaluate((el) => Boolean(el.closest("[inert]")))).toBe(false);
  await undo.click();
  await expect(sheet(page).getByRole("group", { name: `Status of ${book.title}` }).getByRole("button", { name: "To read" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(sheet(page)).toBeVisible();
});

test("a book with no summary opens with no layout shift (AC-5)", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shift: number };
    w.__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!e.hadRecentInput) w.__shift += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  // As a sheet from the list, and as the page on a direct load.
  await page.goto(LIST);
  await hydrated(rowLink(page, PLAIN.title));
  await page.evaluate(() => { (window as unknown as { __shift: number }).__shift = 0; });
  await openFrom(page, PLAIN.title);
  await expect(sheet(page).locator(".detail-about")).toHaveText("No summary yet.");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBe(0);

  await page.goto(`/book/${PLAIN.id}`);
  // The loaded detail, not the skeleton streaming beside it.
  await expect(page.locator(".detail:not([aria-busy]) .detail-about")).toHaveText("No summary yet.");
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __shift: number }).__shift)).toBe(0);
});

test("an estimated word count shows its ~ and the dotted edge; a stated one neither (AC-5)", async ({ page }) => {
  await page.goto(`/book/${FEATURE.id}`);
  const est = page.locator(".detail .words");
  await expect(est).toHaveText("~65,000");
  expect(await est.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dotted");
  await page.goto(`/book/${FILLER[0].id}`);
  const stated = page.locator(".detail .words");
  await expect(stated).toHaveText("90,000");
  expect(await stated.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("none");
});

test("a drag past a third dismisses it, a short one springs back (manual check, automated)", ONCE, async ({ page }) => {
  await page.goto(LIST);
  await openFrom(page, FILLER[1].title);
  const grab = sheet(page).locator(".rsheet-top");
  const box = (await grab.boundingBox())!;
  const height = (await sheet(page).boundingBox())!.height;
  const x = box.x + box.width / 2, y = box.y + 8;
  // Short and slow: back where it was.
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let d = 10; d <= height * 0.15; d += 10) await page.mouse.move(x, y + d, { steps: 2 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect(sheet(page)).toBeVisible();
  await expect.poll(() => sheet(page).evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  // Past a third: gone, and the list's URL back.
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let d = 10; d <= height * 0.45; d += 10) await page.mouse.move(x, y + d, { steps: 2 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(LIST);
});

test("reduced motion opens and closes it with no movement at all (AC-6, UX-N01)", { tag: "@at-w390-reduced-motion" }, async ({ page }) => {
  await page.goto(LIST);
  const link = rowLink(page, FILLER[3].title);
  await hydrated(link);
  await link.click();
  await expect(sheet(page)).toBeVisible();
  // The moment it is there: nothing animates, nothing slides or scales, on the sheet or its scrim.
  const motion = () => page.evaluate(() => {
    const els = [...document.querySelectorAll(".rsheet-host, .rsheet-host *")];
    return {
      running: els.flatMap((el) => el.getAnimations()).length,
      transform: getComputedStyle(document.querySelector(".rsheet")!).transform,
    };
  });
  expect(await motion()).toEqual({ running: 0, transform: "none" });
  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  await expect(page).toHaveURL(LIST);
});

test("the sheet at 360, 834 and 1280px, light and dark: geometry, contrast, axe and screenshots (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto(LIST);
      await openFrom(page, FEATURE.title);
      const box = (await sheet(page).boundingBox())!;
      if (width < 1024) {
        // A bottom sheet: on the floor; a tablet's centred and at most 640px (D-33).
        expect(Math.round(box.y + box.height)).toBe(height);
        expect(box.width).toBeLessThanOrEqual(640);
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
        await expect(sheet(page).getByRole("button", { name: "Dismiss book" })).toBeVisible();
      } else {
        // A centred modal, clear of the floor.
        expect(box.y + box.height).toBeLessThan(height);
        expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      }
      const close = (await sheet(page).getByRole("button", { name: "Close", exact: true }).boundingBox())!;
      expect(close.width).toBeGreaterThanOrEqual(44);
      expect(close.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE, '[role="dialog"]');
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      // The hero name is Newsreader in the sheet as on the page (the feel pass): no action sheet's label.
      const title = sheet(page).locator(".detail-title");
      const sheetTitle = await title.evaluate((el) => ({ font: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize }));
      expect(sheetTitle.font).toContain("Newsreader");
      await screenshot(page, info, `book-sheet-${width}-${colorScheme}`);
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toBeHidden();

      // The full page at the same width and theme: the same title, axe, contrast.
      await page.goto(`/book/${FEATURE.id}`);
      const pageTitle = page.locator(".detail:not([aria-busy]) .detail-title");
      await expect(pageTitle).toBeVisible();
      expect(await pageTitle.evaluate((el) => ({ font: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize })))
        .toEqual(sheetTitle);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `page ${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `book-page-${width}-${colorScheme}`);
    }
  }
});
