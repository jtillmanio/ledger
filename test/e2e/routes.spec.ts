// Task 1.8c: the dashboard routes and the `/` redirect, in a real browser. The
// pages move one level down (`/comics/runs`, `/books/list`), `/` opens the
// medium last touched, and a stale session goes to sign-in. The checks that
// need no layout run once (the w390-light project); the screenshots and the
// sideways-scroll check run at every width, light and dark.
import { expect, test } from "@playwright/test";
import { E2E_RUN_ID, E2E_RUN_TITLE, expectNoHorizontalScroll, screenshot } from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

test("a garbage session goes to /login for a page and gets 401 from a route handler", ONCE, async ({ browser, baseURL }) => {
  // No stored sign-in: the only credential is a cookie that is present and wrong,
  // which gets past the proxy's presence check and meets the signature check.
  const garbage = { name: "rt_session", value: "garbage", domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" as const, expires: -1 };
  const context = await browser.newContext({ baseURL, storageState: { cookies: [garbage], origins: [] } });
  try {
    // A page with a loading.tsx streams, so the redirect is the browser's to follow, not a 307.
    const page = await context.newPage();
    for (const path of ["/comics", "/comics/runs", "/books/list"]) {
      await page.goto(path);
      await page.waitForURL("**/login**");
      expect(new URL(page.url()).pathname, path).toBe("/login");
    }

    const api = await context.request.get("/api/export", { maxRedirects: 0 });
    expect(api.status()).toBe(401);
  } finally {
    await context.close();
  }
});

test("each route answers with its own screen", ONCE, async ({ page }) => {
  const h1 = page.getByRole("heading", { level: 1 });

  await page.goto("/comics");
  await expect(h1).toHaveText("Where you are");
  // The dashboard links to the list, and the list sits at /comics/runs.
  await page.getByRole("link", { name: "All runs" }).click();
  await page.waitForURL("**/comics/runs");
  await expect(h1).toHaveText("Runs");
  // A chip filters in place, on the same route.
  await page.getByRole("link", { name: "In progress" }).click();
  await page.waitForURL("**/comics/runs?state=reading");

  await page.goto("/books/list");
  await expect(h1).toHaveText("Books");
  await expect(page.getByRole("link", { name: /^Everything$/ })).toHaveAttribute("href", "/books/list");

  // The books dashboard is 2.2's; until then /books is the master list.
  await page.goto("/books");
  expect(new URL(page.url()).pathname).toBe("/books/list");
});

test("a run page's back link goes to /comics/runs", ONCE, async ({ page }) => {
  await page.goto(`/comics/${E2E_RUN_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(E2E_RUN_TITLE);
  await page.getByRole("link", { name: "All runs" }).click();
  await page.waitForURL("**/comics/runs");
});

test("/ opens the medium you last touched, and comics for a fresh profile", ONCE, async ({ page, context }) => {
  await page.goto("/books/list");
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/books/list"); // /books, redirected on

  await page.goto("/comics");
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/comics");

  // A fresh profile: signed in, with no history.
  await context.clearCookies({ name: "ledger_medium" });
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/comics");
});

test("a <Link> prefetch of a medium does not change the medium you last touched", ONCE, async ({ request }) => {
  const prefetch = { rsc: "1", "next-router-prefetch": "1" };
  const prefetched = await request.get("/books/list", { headers: prefetch, maxRedirects: 0 });
  expect(prefetched.headers()["set-cookie"]).toBeUndefined();
  const segment = await request.get("/books/list", {
    headers: { ...prefetch, "next-router-segment-prefetch": "/_tree" }, maxRedirects: 0,
  });
  expect(segment.headers()["set-cookie"]).toBeUndefined();
  // The same path as a visit does write it: the matcher, not the path, told them apart.
  const visited = await request.get("/books/list", { maxRedirects: 0 });
  expect(visited.headers()["set-cookie"]).toMatch(/^ledger_medium=books;.*HttpOnly;.*SameSite=lax/i);
});

test("no same-origin link on any page answers 404", ONCE, async ({ page }) => {
  test.setTimeout(120_000);
  const pages = [
    "/comics", "/comics/runs", `/comics/${E2E_RUN_ID}`, `/comics/${E2E_RUN_ID}/add`, "/books/list", "/books/add", "/inbox", "/login",
    "/comics/status", "/comics/status?tab=next", "/books/status", "/books/status?tab=next", "/books/list?status=to_read&level=someday",
  ];
  const checked = new Set<string>();
  for (const path of pages) {
    await page.goto(path);
    const hrefs = await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
    for (const href of hrefs) {
      if (href.startsWith("//") || checked.has(href)) continue;
      checked.add(href);
      const res = await page.request.get(href, { maxRedirects: 0 });
      expect(res.status(), `${href} (linked from ${path})`).toBeLessThan(400);
    }
  }
  // The nav is on every page, so at least these were followed.
  for (const href of ["/", "/comics", "/books/list", "/inbox", "/comics/runs", "/books/list", `/comics/${E2E_RUN_ID}/add`, "/books/list?status=to_read"]) {
    expect(checked, href).toContain(href);
  }
});

for (const [name, path] of [["comics-dashboard", "/comics"], ["comics-runs", "/comics/runs"], ["books-list", "/books/list"]]) {
  test(`${path} fits the viewport`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await screenshot(page, testInfo, name);
  });
}
