// @area: comics
// Task 4.3, part 3 of 3 (TASK-087, AC-1, AC-3, F-33): the device asks for less data, and the spine, with Show
// covers on, makes zero image requests and draws its placeholders. `prefers-reduced-data` is emulated; stock
// Chromium ignores it, even under DevTools emulation (probed 2026-11-16), until the Blink feature is on, so this
// file launches the browser with it (`launchOptions` can only be set for a whole file). Save-Data, the signal
// browsers ship today, is the second case. The cover host is fake: nothing leaves the machine. The run is made
// here under `e2e-rd-` ids and removed after the last test. The rest of the clause (Show covers off, the swap
// moving nothing) is test/e2e/covers.spec.ts.
import { expect, test, type Page } from "@playwright/test";
import { testSql } from "../db";
import { hydrated } from "./helpers";

test.use({ launchOptions: { args: ["--enable-blink-features=PrefersReducedData"] } });

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const HOST = "https://covers.e2e.test";
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64",
);
const RUN = "e2e-rd-run";
const ROWS = 12;

async function clean() {
  const sql = testSql();
  try {
    await sql`DELETE FROM run_issues WHERE run_id = ${RUN}`;
    await sql`DELETE FROM issues WHERE id LIKE 'e2e-rd-%'`;
    await sql`DELETE FROM runs WHERE id = ${RUN}`;
  } finally {
    await sql.end();
  }
}

test.beforeAll(async () => {
  await clean();
  const sql = testSql();
  try {
    await sql`INSERT INTO runs (id, title) VALUES (${RUN}, 'E2E Reduced Data')`;
    // Every row has a Metron record, and the odd ones a cover: with the device not asking for less, 6 images.
    await sql`INSERT INTO issues (id, label, metron_id, cover_url)
              SELECT 'e2e-rd-' || n, 'E2E Reduced (2004) #' || n, 882000 + n,
                     CASE WHEN n % 2 = 1 THEN ${HOST} || '/rd-' || n || '.png' END
              FROM generate_series(1, ${ROWS}::int) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) SELECT ${RUN}, n, 'e2e-rd-' || n FROM generate_series(1, ${ROWS}::int) n`;
  } finally {
    await sql.end();
  }
});
test.afterAll(clean);

/** Counts the image requests that leave for any host but the app's own, and answers the fake host. */
async function watch(page: Page, baseURL: string) {
  await page.route(`${HOST}/**`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PIXEL }));
  const app = new URL(baseURL).origin;
  const seen: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image" && /^https?:/.test(r.url()) && new URL(r.url()).origin !== app) seen.push(r.url());
  });
  return seen;
}

async function expectPlaceholders(page: Page, seen: string[]) {
  await page.goto(`/comics/${RUN}`);
  await expect(page.locator(".iss")).toHaveCount(ROWS);
  await hydrated(page.locator(".iss .chk").first());
  await page.waitForTimeout(500);
  expect(seen, "image requests").toEqual([]);
  await expect(page.locator(".iss .rcv img")).toHaveCount(0);
  await expect(page.locator("#p-3 .rcv")).toHaveText("3");
  const b = (await page.locator("#p-3 .rcv").boundingBox())!;
  expect([Math.round(b.width), Math.round(b.height)]).toEqual([28, 42]);
}

test("with prefers-reduced-data: reduce emulated and Show covers on, the spine makes zero image requests and draws placeholders (AC-1, AC-3)", ONCE, async ({ page, baseURL }) => {
  const seen = await watch(page, baseURL!);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [{ name: "prefers-reduced-data", value: "reduce" }] });
  await page.goto("/settings");
  // The emulation took, or this test would pass for nothing; and Show covers is on, so only the device's ask is why.
  expect(await page.evaluate(() => matchMedia("(prefers-reduced-data: reduce)").matches)).toBe(true);
  await expect(page.getByRole("switch", { name: "Show covers" })).toHaveAttribute("aria-checked", "true");
  await expectPlaceholders(page, seen);
});

test("with Save-Data on, the spine makes zero image requests (AC-3)", ONCE, async ({ page, baseURL }) => {
  const seen = await watch(page, baseURL!);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData: true }) });
  });
  await expectPlaceholders(page, seen);
});

test("the same spine with the device not asking for less data does request its images", ONCE, async ({ page, baseURL }) => {
  const seen = await watch(page, baseURL!);
  await page.goto(`/comics/${RUN}`);
  await expect(page.locator("#p-3 .rcv img")).toHaveCount(1);
  // The element can be in the DOM a tick before Chromium reports its request
  // (CI, PR #325: 0 seen): wait for the request, don't read the count once.
  await expect.poll(() => seen.length).toBeGreaterThan(0);
});
