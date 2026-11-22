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
// Task 3.5b, 1 of 3 (TASK-118): the sheet's own writes. Saving a note writes
// book_status.notes once and its Undo puts the old note back; a book with no
// status row is refused and nothing is written (AC-1, AC-2); each owned toggle
// writes or deletes exactly one owned_copies row and its Undo reverses it, and
// the ebook has none (AC-1, AC-3); and the editor and toggles meet the UX floor (AC-5).
// Task 3.5b, 2 of 3 (TASK-119): *Move* and *Shelves Edit* open their sheet in
// place of the book's, one dialog the whole way, with a back control naming the
// book; Back unwinds one level, then to the Library where it was (AC-1, AC-2);
// a book that isn't to read shows *Planned for* only with a plan row, and no
// *Move* (AC-3); each shelf toggle writes or deletes one shelf_books row, with
// an Undo that reverses just that (AC-4); and each pane meets the floor (AC-5).
// The books are made here, under E2E ids the rest of the suite doesn't use, and
// removed after the last test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { easternYear } from "../../src/lib/settings";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

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
// The sheet's own writes (task 3.5b), under a title the Library search above doesn't match.
const NOTE = { id: "e2e-bsw-note", title: "E2E Bsw Note" };
const BARE = { id: "e2e-bsw-bare", title: "E2E Bsw Bare" };
const OWN = { id: "e2e-bsw-own", title: "E2E Bsw Own" };
// Move and Shelves (TASK-119). The book moved is a filler row, so the Library behind its sheet scrolls.
const MOVE = FILLER[43];
const READING = { id: "e2e-bsw-reading", title: "E2E Bsw Reading" };
const SHELVED = { id: "e2e-bsw-shelved", title: "E2E Bsw Shelved" };
const SHELF_A = { id: "e2e-bsw-shelf-a", name: "E2E Bsw Shelf A" };
const SHELF_B = { id: "e2e-bsw-shelf-b", name: "E2E Bsw Shelf B" };
/** The last year the picker's chips offer: no other spec plans a book there. */
const YEAR = easternYear() + 4;
const IDS = [...FILLER, FEATURE, PLAIN, GONE, NOTE, BARE, OWN, READING, SHELVED].map((b) => b.id);

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM shelves WHERE id IN (${SHELF_A.id}, ${SHELF_B.id})`;
  await sql`DELETE FROM books WHERE id = ANY(${IDS}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of FILLER) await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${b.id}, ${b.title}, 90000, 'stated')`;
    await sql`INSERT INTO books (id, title, published_year, page_count, word_count, word_count_source, summary, subjects)
              VALUES (${FEATURE.id}, ${FEATURE.title}, 2010, 412, 65000, 'estimated',
                      ${"A world of stone and storms.\n\nA second paragraph."}, ${["Epic fantasy", "Magic"]})`;
    await sql`INSERT INTO books (id, title, published_year, page_count) VALUES (${PLAIN.id}, ${PLAIN.title}, 1999, 300)`;
    await sql`INSERT INTO books (id, title, deleted_at) VALUES (${GONE.id}, ${GONE.title}, now())`;
    // A Calibre id below zero: no Calibre book the test database may hold has one.
    for (const b of [NOTE, BARE]) await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
    await sql`INSERT INTO books (id, title, calibre_id) VALUES (${OWN.id}, ${OWN.title}, -9311)`;
    for (const b of [NOTE, OWN]) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    for (const b of [READING, SHELVED]) await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
    for (const [b, status] of [[MOVE, "to_read"], [READING, "reading"], [SHELVED, "to_read"]] as const) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, ${status})`;
    }
    // Planned before it was started: a reading book keeps its plan row (it counts while reading, D-112).
    await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${READING.id}, ${String(YEAR)}, NULL)`;
    for (const s of [SHELF_A, SHELF_B]) {
      await sql`INSERT INTO shelves (id, user_id, name, kind) VALUES (${s.id}, ${E2E_USER}, ${s.name}, 'books')`;
    }
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

// --- Task 3.5b, 1 of 3 (TASK-118): the sheet's own writes ------------------------------------------------

const toast = (page: Page) => page.locator(".toast");
/** A row of *Your record* by its label, in the sheet or on the full page. */
const recordRow = (scope: Page | Locator, page: Page, k: string) =>
  scope.locator(".detail-record .frow").filter({ has: page.locator(".k", { hasText: new RegExp(`^${k}$`) }) });
const storedNote = (bookId: string) =>
  withSql((sql) => sql<{ notes: string | null }[]>`SELECT notes FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${bookId}`)
    .then((rows) => rows.map((r) => ({ notes: r.notes })));
const ownedRows = (bookId: string) =>
  withSql((sql) => sql<{ format: string }[]>`SELECT format FROM owned_copies WHERE book_id = ${bookId} ORDER BY format`)
    .then((rows) => rows.map((r) => r.format));
const setNote = (bookId: string, note: string | null) =>
  withSql((sql) => sql`UPDATE book_status SET notes = ${note} WHERE user_id = ${E2E_USER} AND book_id = ${bookId}`);

/** Its sheet, from a Library search for it alone. */
async function openOwn(page: Page, b: { title: string }) {
  await page.goto(`/books/list?q=${encodeURIComponent(b.title)}`);
  await openFrom(page, b.title);
}

test("saving a note from the sheet writes book_status.notes once, shows it without a reload, and Undo puts the old note back (AC-1, AC-2)", async ({ page }) => {
  await setNote(NOTE.id, "old");
  const posts: unknown[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/progress/book/note") posts.push(req.postDataJSON());
  });
  await openOwn(page, NOTE);
  // A full page load would drop this.
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true; });

  const notes = recordRow(sheet(page), page, "Notes");
  await expect(notes.locator(".lede")).toHaveText("old");
  const edit = notes.getByRole("button", { name: `Edit the note on ${NOTE.title}`, exact: true });
  await hydrated(edit);
  await edit.click();
  const field = notes.getByRole("textbox", { name: `Note on ${NOTE.title}`, exact: true });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("old");
  await field.fill("new");
  await notes.getByRole("button", { name: "Save", exact: true }).click();

  await expect(notes.locator(".lede")).toHaveText("new");
  await expect(field).toHaveCount(0);
  await expect(edit).toBeFocused();
  await expect(toast(page).locator(".toast-label")).toHaveText("Note saved");
  await expect(toast(page)).toContainText(NOTE.title);
  expect(await storedNote(NOTE.id)).toEqual([{ notes: "new" }]);
  expect(posts).toEqual([{ bookId: NOTE.id, note: "new" }]);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(notes.locator(".lede")).toHaveText("old");
  await expect.poll(() => storedNote(NOTE.id)).toEqual([{ notes: "old" }]);
  // Focus is handed back to the control the toast came from.
  await expect(edit).toBeFocused();
  // One write: the Undo is a DELETE, not a second save.
  expect(posts).toHaveLength(1);
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true);
});

test("a book with no status row: saving its note shows the route's refusal, keeps the text and writes nothing (AC-2)", async ({ page }) => {
  // The full page draws the same BookDetail; a book with no status row is in no Library list to open from.
  await page.goto(`/book/${BARE.id}`);
  const notes = recordRow(page, page, "Notes");
  await expect(notes.locator(".lede")).toHaveCount(0);
  const add = notes.getByRole("button", { name: `Add a note on ${BARE.title}`, exact: true });
  await hydrated(add);
  await add.click();
  const field = notes.getByRole("textbox", { name: `Note on ${BARE.title}`, exact: true });
  await field.fill("kept");
  await notes.getByRole("button", { name: "Save", exact: true }).click();

  await expect(notes.getByRole("alert")).toHaveText("× The note didn't save: put the book on your list before writing a note.");
  await expect(field).toHaveValue("kept");
  await expect(field).toHaveAccessibleDescription(/didn't save/);
  await expect(notes.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
  await expect(toast(page)).toHaveCount(0);
  expect(await storedNote(BARE.id)).toEqual([]);
});

test("each owned toggle on the sheet writes or deletes exactly one owned_copies row, the Owned line says so, and Undo reverses it; the ebook has no toggle (AC-1, AC-3)", async ({ page }) => {
  await withSql((sql) => sql`DELETE FROM owned_copies WHERE book_id = ${OWN.id}`);
  await openOwn(page, OWN);
  const owned = recordRow(sheet(page), page, "Owned");
  const line = owned.locator(".v");
  // The ebook is Calibre's (D-90): named on the line, never a toggle.
  await expect(line).toHaveText("Ebook");
  await expect(owned.getByRole("button")).toHaveCount(2);
  await expect(sheet(page).getByRole("button", { name: /ebook/i })).toHaveCount(0);

  for (const [format, name, word, said] of [
    ["physical", "I own it on paper", "Physical", "You own it on paper"],
    ["audio", "I own the audiobook", "Audiobook", "You own the audiobook"],
  ] as const) {
    const button = owned.getByRole("button", { name, exact: true });
    await hydrated(button);
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(line).toHaveText(`${word} · Ebook`);
    await expect(toast(page).locator(".toast-label")).toHaveText(said);
    await expect(toast(page)).toContainText(OWN.title);
    expect(await ownedRows(OWN.id)).toEqual([format]);

    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await expect(button).toBeFocused();
    await expect(line).toHaveText("Ebook");
    await expect.poll(() => ownedRows(OWN.id)).toEqual([]);
  }

  // Turning off a format the book had deletes only that row, and its Undo writes it back.
  await withSql((sql) => sql`INSERT INTO owned_copies (book_id, format) VALUES (${OWN.id}, 'physical'), (${OWN.id}, 'audio')`);
  await openOwn(page, OWN);
  const again = recordRow(sheet(page), page, "Owned");
  const paper = again.getByRole("button", { name: "I own it on paper", exact: true });
  await hydrated(paper);
  await expect(paper).toHaveAttribute("aria-pressed", "true");
  await paper.click();
  await expect(paper).toHaveAttribute("aria-pressed", "false");
  await expect(again.locator(".v")).toHaveText("Audiobook · Ebook");
  await expect(toast(page).locator(".toast-label")).toHaveText("You don't own it on paper");
  expect(await ownedRows(OWN.id)).toEqual(["audio"]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(paper).toHaveAttribute("aria-pressed", "true");
  await expect(again.locator(".v")).toHaveText("Physical · Audiobook · Ebook");
  await expect.poll(() => ownedRows(OWN.id)).toEqual(["audio", "physical"]);

  // Leave the book as found.
  await withSql((sql) => sql`DELETE FROM owned_copies WHERE book_id = ${OWN.id}`);
});

test("the note editor and the owned toggles meet the UX floor at 360 and 1280px, light and dark: names, 44px, a failed save kept, axe, contrast, no --danger, screenshots (AC-5)", ONCE, async ({ page }, info) => {
  await setNote(NOTE.id, "old");
  // Every note save fails as a dropped connection would.
  await page.route("**/api/progress/book/note", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 500, body: "{}" }) : route.continue());
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      const at = `${width}px ${colorScheme}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await openOwn(page, NOTE);
      const notes = recordRow(sheet(page), page, "Notes");
      const owned = recordRow(sheet(page), page, "Owned");
      const edit = notes.getByRole("button", { name: `Edit the note on ${NOTE.title}`, exact: true });
      await hydrated(edit);
      const opener = (await edit.boundingBox())!;
      expect(Math.min(opener.width, opener.height), `Edit ${at}`).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
      await edit.click();
      const field = notes.getByRole("textbox", { name: `Note on ${NOTE.title}`, exact: true });
      await expect(field, at).toBeFocused();
      await screenshot(page, info, `book-sheet-note-${width}-${colorScheme}`);

      // A failed save says so, keeps the text typed and the field open, and writes nothing.
      await field.fill("typed");
      await notes.getByRole("button", { name: "Save", exact: true }).click();
      await expect(notes.getByRole("alert"), at).toHaveText("× The note didn't save. Check your connection and try again.");
      await expect(field, at).toHaveValue("typed");
      const retry = notes.getByRole("button", { name: "Retry", exact: true });
      await expect(retry, at).toBeVisible();

      // Named controls, 44px on a phone and never under 24px, none of them on --danger.
      const controls = [retry, notes.getByRole("button", { name: "Cancel", exact: true }),
        owned.getByRole("button", { name: "I own it on paper", exact: true }),
        owned.getByRole("button", { name: "I own the audiobook", exact: true })];
      for (const c of controls) {
        const box = (await c.boundingBox())!;
        const name = `${await c.innerText()} ${at}`;
        expect(box.height, name).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
        expect(box.width, name).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
        const style = await computedStyle(c, ["background-color", "color", "border-color"]);
        for (const token of ["--danger", "--danger-soft"]) {
          expect(Object.values(style), `${name} against ${token}`).not.toContain(await tokenColour(page, token));
        }
      }
      const reason = await computedStyle(notes.getByRole("alert"), ["color"]);
      expect(reason.color, at).not.toBe(await tokenColour(page, "--danger"));

      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE, '[role="dialog"]');
      expect(await contrastFailures(page), at).toEqual([]);
      await screenshot(page, info, `book-sheet-note-failed-${width}-${colorScheme}`);

      // Esc closes the field, writing nothing, and puts focus back on *Edit*; a second Esc closes the sheet.
      await page.keyboard.press("Escape");
      await expect(field, at).toHaveCount(0);
      await expect(edit, at).toBeFocused();
      await expect(sheet(page), at).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet(page), at).toBeHidden();
    }
  }
  expect(await storedNote(NOTE.id)).toEqual([{ notes: "old" }]);
});

// --- Task 3.5b, 2 of 3 (TASK-119): Move and Shelves, a sheet from the sheet -------------------------------

const dialogs = (page: Page) => page.locator('[role="dialog"]');
const backTo = (page: Page, title: string) => sheet(page).getByRole("button", { name: `Back to ${title}`, exact: true });
const planOf = (bookId: string) =>
  withSql((sql) => sql<{ period: string }[]>`SELECT period FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${bookId}`)
    .then((rows) => rows.map((r) => r.period));
/** A shelf's rows in shelf order, each with its note. */
const shelfRows = (shelfId: string) =>
  withSql((sql) => sql<{ book_id: string; ordinal: number; note: string | null }[]>`
    SELECT book_id, ordinal, note FROM shelf_books WHERE shelf_id = ${shelfId} ORDER BY ordinal`)
    .then((rows) => rows.map((r) => [r.book_id, r.ordinal, r.note] as const));
/** MOVE planned for Q3 of YEAR, and nothing else. */
const planMove = () => withSql(async (sql) => {
  await sql`DELETE FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${MOVE.id}`;
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal)
            VALUES (${E2E_USER}, ${MOVE.id}, ${`${YEAR}-Q3`},
                    (SELECT COALESCE(MAX(ordinal), 0) + 1 FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${`${YEAR}-Q3`}))`;
});
/** Shelf A holds OWN, SHELVED (with a note) and NOTE; shelf B holds OWN alone. */
const stockShelves = () => withSql(async (sql) => {
  await sql`DELETE FROM shelf_books WHERE shelf_id IN (${SHELF_A.id}, ${SHELF_B.id})`;
  await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal, note) VALUES
            (${SHELF_A.id}, ${OWN.id}, 1, NULL), (${SHELF_A.id}, ${SHELVED.id}, 2, 'why it is here'),
            (${SHELF_A.id}, ${NOTE.id}, 3, NULL), (${SHELF_B.id}, ${OWN.id}, 1, NULL)`;
});

test("Move from the sheet replaces it: one dialog with a back control naming the book; a move writes once with an Undo; Back unwinds to the book, then to the Library where it was (AC-1, AC-2)", async ({ page }) => {
  await planMove();
  await page.goto(LIST);
  const link = rowLink(page, MOVE.title);
  await hydrated(link);
  await link.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  await link.click();
  await expect(sheet(page).getByRole("heading", { level: 2, name: MOVE.title })).toBeFocused();

  const planned = recordRow(sheet(page), page, "Planned for");
  await expect(planned.locator(".v")).toHaveText(`Q3 ${YEAR}`);
  const move = planned.getByRole("button", { name: `Move ${MOVE.title} in your plan`, exact: true });
  await hydrated(move);
  await move.click();

  // One sheet, the picker in the book's place: its heading has focus and names the dialog.
  await expect(dialogs(page)).toHaveCount(1);
  const pane = sheet(page).getByRole("heading", { level: 2, name: "Move in your plan" });
  await expect(pane).toBeFocused();
  await expect(sheet(page)).toHaveAccessibleName("Move in your plan");
  await expect(backTo(page, MOVE.title)).toBeVisible();
  await expect(sheet(page).locator(".detail")).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/book/${MOVE.id}$`));

  // Q4 of the same year (the picker opens on the year it is planned in), then confirm.
  await sheet(page).getByRole("group", { name: `Quarter of ${YEAR}` }).getByRole("button", { name: /^Q4/ }).click();
  await sheet(page).getByRole("button", { name: `Move to Q4 ${YEAR}`, exact: true }).click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`Moved to Q4 ${YEAR}`);
  expect(await planOf(MOVE.id)).toEqual([`${YEAR}-Q4`]);
  // Back on the book, which says where it went, with focus on *Move*.
  await expect(pane).toHaveCount(0);
  await expect(planned.locator(".v")).toHaveText(`Q4 ${YEAR}`);
  await expect(move).toBeFocused();
  await expect(dialogs(page)).toHaveCount(1);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => planOf(MOVE.id)).toEqual([`${YEAR}-Q3`]);
  await expect(planned.locator(".v")).toHaveText(`Q3 ${YEAR}`);

  // Browser Back from the picker shows the book again, focus on *Move*; Back once more is the Library where it was.
  await move.click();
  await expect(pane).toBeFocused();
  await page.goBack();
  await expect(pane).toHaveCount(0);
  await expect(sheet(page).getByRole("heading", { level: 2, name: MOVE.title })).toBeVisible();
  await expect(move).toBeFocused();
  await expect(dialogs(page)).toHaveCount(1);
  await page.goBack();
  await expect(dialogs(page)).toHaveCount(0);
  await expect(page).toHaveURL(LIST);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled);
  await expect(link).toBeFocused();

  // The close from the picker shuts the whole sheet, not just the picker.
  await link.click();
  await hydrated(move);
  await move.click();
  await expect(pane).toBeFocused();
  await sheet(page).getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialogs(page)).toHaveCount(0);
  await expect(page).toHaveURL(LIST);
  await expect(link).toBeFocused();
  expect(await planOf(MOVE.id)).toEqual([`${YEAR}-Q3`]);
});

test("a book that isn't to read shows Planned for only with a plan row, and no Move; on the full page Move opens one sheet (AC-3)", async ({ page }) => {
  // Reading, planned for YEAR before it was started.
  await page.goto(`/book/${READING.id}`);
  const planned = recordRow(page, page, "Planned for");
  await expect(planned.locator(".v")).toHaveText(String(YEAR));
  await expect(planned.getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Move/ })).toHaveCount(0);

  // Read, with no plan row: no *Planned for* at all.
  await page.goto(`/book/${FEATURE.id}`);
  await expect(recordRow(page, page, "Status")).toBeVisible();
  await expect(recordRow(page, page, "Planned for")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Move/ })).toHaveCount(0);

  // A to-read book on its full page: *Move* opens the picker as the one sheet there is, and Esc puts focus back.
  await planMove();
  await page.goto(`/book/${MOVE.id}`);
  const move = recordRow(page, page, "Planned for").getByRole("button", { name: `Move ${MOVE.title} in your plan`, exact: true });
  await hydrated(move);
  await move.click();
  await expect(dialogs(page)).toHaveCount(1);
  // The picker, open on where the book is planned.
  await expect(sheet(page).getByRole("button", { name: `Move to Q3 ${YEAR}`, exact: true })).toBeVisible();
  await expect(sheet(page).getByRole("button", { name: "On deck", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogs(page)).toHaveCount(0);
  await expect(move).toBeFocused();
});

test("Shelves Edit replaces the sheet with every shelf on or off; each toggle writes or deletes one shelf_books row and its Undo reverses just that; Back names the shelves as they now are (AC-4)", async ({ page }) => {
  await stockShelves();
  await openOwn(page, SHELVED);
  const shelvesRow = recordRow(sheet(page), page, "Shelves");
  await expect(shelvesRow.locator(".v")).toHaveText(SHELF_A.name);
  const edit = shelvesRow.getByRole("button", { name: `Edit the shelves for ${SHELVED.title}`, exact: true });
  await hydrated(edit);
  await edit.click();

  await expect(dialogs(page)).toHaveCount(1);
  const pane = sheet(page).getByRole("heading", { level: 2, name: "Shelves" });
  await expect(pane).toBeFocused();
  await expect(backTo(page, SHELVED.title)).toBeVisible();
  const group = sheet(page).getByRole("group", { name: `Shelves for ${SHELVED.title}` });
  const a = group.getByRole("button", { name: SHELF_A.name, exact: true });
  const b = group.getByRole("button", { name: SHELF_B.name, exact: true });
  await hydrated(b);
  await expect(a).toHaveAttribute("aria-pressed", "true");
  await expect(b).toHaveAttribute("aria-pressed", "false");

  // On B: one row, at B's end.
  await b.click();
  await expect(b).toHaveAttribute("aria-pressed", "true");
  await expect(toast(page).locator(".toast-label")).toHaveText(`Added to ${SHELF_B.name}`);
  await expect(toast(page)).toContainText(SHELVED.title);
  expect(await shelfRows(SHELF_B.id)).toEqual([[OWN.id, 1, null], [SHELVED.id, 2, null]]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(b).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => shelfRows(SHELF_B.id)).toEqual([[OWN.id, 1, null]]);

  // Off A: its row goes and the gap closes; the Undo puts it back at 2 with its note.
  await a.click();
  await expect(a).toHaveAttribute("aria-pressed", "false");
  await expect(toast(page).locator(".toast-label")).toHaveText(`Removed from ${SHELF_A.name}`);
  expect(await shelfRows(SHELF_A.id)).toEqual([[OWN.id, 1, null], [NOTE.id, 2, null]]);
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(a).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => shelfRows(SHELF_A.id))
    .toEqual([[OWN.id, 1, null], [SHELVED.id, 2, "why it is here"], [NOTE.id, 3, null]]);

  // On B again, then Back: the book's sheet names both shelves, focus on *Edit*, still one dialog.
  await b.click();
  await expect.poll(() => shelfRows(SHELF_B.id)).toEqual([[OWN.id, 1, null], [SHELVED.id, 2, null]]);
  await backTo(page, SHELVED.title).click();
  await expect(pane).toHaveCount(0);
  await expect(edit).toBeFocused();
  await expect(dialogs(page)).toHaveCount(1);
  await expect(shelvesRow.locator(".v")).toHaveText(`${SHELF_A.name}, ${SHELF_B.name}`);
  await stockShelves();
});

test("Move and Shelves meet the UX floor at 360 and 1280px, light and dark: focus in and back, a 44px back control, axe, contrast, no --danger, no slide under reduced motion, screenshots (AC-5)", ONCE, async ({ page }, info) => {
  await planMove();
  await stockShelves();
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      const at = `${width}px ${colorScheme}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme, reducedMotion: colorScheme === "dark" ? "reduce" : "no-preference" });
      await openOwn(page, SHELVED);
      for (const [k, name, heading, shot] of [
        ["Planned for", `Move ${SHELVED.title} in your plan`, "Move in your plan", "move"],
        ["Shelves", `Edit the shelves for ${SHELVED.title}`, "Shelves", "shelves"],
      ] as const) {
        const opener = recordRow(sheet(page), page, k).getByRole("button", { name, exact: true });
        await hydrated(opener);
        const box = (await opener.boundingBox())!;
        expect(Math.min(box.width, box.height), `${name} ${at}`).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
        await opener.click();
        const pane = sheet(page).getByRole("heading", { level: 2, name: heading });
        await expect(pane, at).toBeFocused();
        await expect(dialogs(page), at).toHaveCount(1);
        // Under reduced motion the swap just happens: nothing slides.
        if (colorScheme === "dark") {
          expect(await sheet(page).locator(".rsheet-pane").evaluate((el) => el.getAnimations().length), at).toBe(0);
        }
        // Loaded: the picker's chips, or the shelves' toggles.
        await expect(sheet(page).getByRole("button", { name: shot === "move" ? "On deck" : SHELF_A.name, exact: true }), at).toBeVisible();

        const back = backTo(page, SHELVED.title);
        const b = (await back.boundingBox())!;
        expect(b.height, `back ${at}`).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
        expect(b.width, `back ${at}`).toBeGreaterThanOrEqual(44);
        const style = await computedStyle(back, ["background-color", "color", "border-color"]);
        for (const token of ["--danger", "--danger-soft"]) {
          expect(Object.values(style), `back ${at} against ${token}`).not.toContain(await tokenColour(page, token));
        }
        await expectNoHorizontalScroll(page);
        await expectNoAxeViolations(page, AXE, '[role="dialog"]');
        expect(await contrastFailures(page), at).toEqual([]);
        await screenshot(page, info, `book-sheet-${shot}-${width}-${colorScheme}`);

        // Esc from the picker goes back one level, to the book, focus on the opener; the back control does the same.
        if (shot === "move") await page.keyboard.press("Escape");
        else await back.click();
        await expect(pane, at).toHaveCount(0);
        await expect(opener, at).toBeFocused();
        await expect(sheet(page), at).toBeVisible();
      }
      await page.keyboard.press("Escape");
      await expect(dialogs(page), at).toHaveCount(0);
    }
  }
  expect(await shelfRows(SHELF_A.id)).toEqual([[OWN.id, 1, null], [SHELVED.id, 2, "why it is here"], [NOTE.id, 3, null]]);
});
