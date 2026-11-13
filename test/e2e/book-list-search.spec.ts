// Task 1.22: the master list searches as you type, in a real browser, at every
// width, light and dark (AC-1's list half, AC-5, AC-6). Three characters and a
// pause replace ?q= with no history entry per keystroke, keeping a chip already
// chosen; two characters ask nothing, and going back under three after a search
// shows the whole list again; a reload reads ?q= on the server. The books are
// made here, under an E2E title the rest of the suite doesn't use, and removed
// after the last test.
import { expect, test, type Page, type Request } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria", "target-size", "label",
];
/** Two of them match `pir`; the third doesn't. */
const BOOKS = [
  { id: "e2e-list-pirouette", title: "E2E Pirouette Book" },
  { id: "e2e-list-piranesi", title: "E2E Piranesi Book" },
  { id: "e2e-list-quietude", title: "E2E Quietude Book" },
];

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
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
  });
});
test.afterAll(clean);

const box = (page: Page) => page.getByRole("searchbox", { name: "Search books" });
const titles = (page: Page) => page.locator(".book-row .row-title");
const ours = (page: Page) => titles(page).filter({ hasText: /^E2E (Pirouette|Piranesi|Quietude) Book$/ });

/** The list's own requests from now on: the navigations a search makes, not a link's prefetch. */
function listRequests(page: Page) {
  const seen: string[] = [];
  const on = (r: Request) => {
    const url = new URL(r.url());
    if (url.pathname === "/books/list" && !r.headers()["next-router-prefetch"]) seen.push(url.search);
  };
  page.on("request", on);
  return seen;
}

async function open(page: Page, path = "/books/list") {
  await page.goto(path);
  await hydrated(box(page));
}

test("typing pir and pausing narrows the list and puts ?q=pir in the URL, without Enter (AC-1, AC-5)", async ({ page }, info) => {
  await open(page);
  await expect(ours(page)).toHaveCount(3);
  await box(page).pressSequentially("pir", { delay: 60 });
  await expect(page).toHaveURL(/\/books\/list\?q=pir$/);
  await expect(ours(page)).toHaveText(["E2E Piranesi Book", "E2E Pirouette Book"]);
  await expect(box(page)).toHaveValue("pir");
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "book-list-search-pir");
});

test("typing pi and pausing makes no request; back under three after a search shows the whole list (AC-1, AC-5)", CORE, async ({ page }) => {
  await open(page);
  const requests = listRequests(page);
  await box(page).pressSequentially("pi", { delay: 60 });
  await page.waitForTimeout(900);
  expect(requests).toEqual([]);
  await expect(page).toHaveURL(/\/books\/list$/);

  await box(page).press("r");
  await expect(page).toHaveURL(/\?q=pir$/);
  await expect(ours(page)).toHaveCount(2);
  await box(page).press("Backspace");
  await expect(page).toHaveURL(/\/books\/list$/);
  await expect(ours(page)).toHaveCount(3);
  await expect(box(page)).toHaveValue("pi");
});

test("piranesi typed quickly is one search, not six, and one Back leaves the list (AC-1, AC-5)", CORE, async ({ page }) => {
  // The page before the list (/books itself redirects to the list).
  await page.goto("/books/status");
  await open(page);
  const requests = listRequests(page);
  await box(page).pressSequentially("piranesi", { delay: 60 });
  await expect(page).toHaveURL(/\?q=piranesi$/);
  await expect(ours(page)).toHaveText(["E2E Piranesi Book"]);
  await page.waitForTimeout(900);
  expect(requests.filter((s) => s.includes("q="))).toHaveLength(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/books\/status$/);
});

test("a chip already chosen stays in the URL; a reload reads ?q= and shows the same list (AC-5)", CORE, async ({ page }) => {
  await open(page, "/books/list?status=to_read");
  await box(page).pressSequentially("pir", { delay: 60 });
  await expect(page).toHaveURL(/\/books\/list\?status=to_read&q=pir$/);
  await expect(ours(page)).toHaveCount(2);
  await expect(page.getByRole("link", { name: "To read" })).toHaveAttribute("aria-current", "true");

  await page.reload();
  await hydrated(box(page));
  await expect(box(page)).toHaveValue("pir");
  await expect(ours(page)).toHaveText(["E2E Piranesi Book", "E2E Pirouette Book"]);
  // A chip link drops the search, and the box follows the URL.
  await page.getByRole("link", { name: "Everything" }).click();
  await expect(page).toHaveURL(/\/books\/list$/);
  await expect(box(page)).toHaveValue("");
});

test("the box is a named search input, and its searching state is a polite live region (AC-6)", CORE, async ({ page }) => {
  await open(page);
  await expect(box(page)).toHaveAttribute("type", "search");
  await expect(page.locator(".list-searching")).toHaveAttribute("role", "status");
  await expect(page.locator(".list-searching")).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("search")).toHaveCount(1);
  // Said once a search, not once a keystroke: count the times the region comes to read Searching….
  await page.evaluate(() => {
    const live = document.querySelector(".list-searching")!;
    const w = window as unknown as { said: number };
    w.said = 0;
    let last = live.textContent;
    new MutationObserver(() => {
      if (live.textContent === "Searching…" && last !== "Searching…") w.said++;
      last = live.textContent;
    }).observe(live, { childList: true, subtree: true, characterData: true });
  });
  await box(page).pressSequentially("piranesi", { delay: 60 });
  await expect(page).toHaveURL(/\?q=piranesi$/);
  await expect(page.locator(".list-searching")).toHaveText("");
  expect(await page.evaluate(() => (window as unknown as { said: number }).said)).toBe(1);
});
