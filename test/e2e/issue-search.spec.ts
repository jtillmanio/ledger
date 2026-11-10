// Task 1.22: Add issues' *Search* as you type, in a real browser, at every
// width, light and dark (AC-3, AC-4, AC-6). The route asks Metron from the
// server, where page.route can't see it, so the recorded answers
// (test/fixtures/metron-thor-337-340.json) are seeded as metron_cache rows
// under the keys the route asks: the e2e server has no Metron credentials, so
// a listing is proof the cache answered. Thor #337 is in a run of its own, so
// it lists as the catalog's, with its run count; #338-#340 are Metron's.
// This file removes what it makes.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { testSql, type TestSql } from "../db";
import {
  contrastFailures, E2E_RUN_ID, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order", "label",
];
const FIXTURE = JSON.parse(readFileSync("test/fixtures/metron-thor-337-340.json", "utf8")) as
  { responses: Record<string, unknown> };
const KEYS = Object.keys(FIXTURE.responses);
const THOR_RUN = { id: "e2e-issue-search-thor", title: "E2E Thor Tales" };
const THOR_337 = { id: "e2e-issue-search-thor-337", label: "Thor (1966) #337", metronId: 14525 };

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

async function clean() {
  await withSql(async (sql) => {
    await sql`DELETE FROM run_issues WHERE run_id = ${THOR_RUN.id}`;
    await sql`DELETE FROM runs WHERE id = ${THOR_RUN.id}`;
    await sql`DELETE FROM issues WHERE id = ${THOR_337.id}`;
    await sql`DELETE FROM metron_cache WHERE key = ANY(${KEYS}::text[])`;
  });
}

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const key of KEYS) {
      await sql`INSERT INTO metron_cache (key, body) VALUES (${key}, ${sql.json(FIXTURE.responses[key] as never)})`;
    }
    await sql`INSERT INTO runs (id, title) VALUES (${THOR_RUN.id}, ${THOR_RUN.title})`;
    await sql`INSERT INTO issues (id, label, metron_id) VALUES (${THOR_337.id}, ${THOR_337.label}, ${THOR_337.metronId})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${THOR_RUN.id}, 1, ${THOR_337.id})`;
  });
});
test.afterAll(clean);

test.beforeEach(async ({ page }) => {
  // The recorded covers live on Metron's host: answered here, so no image request leaves the machine.
  await page.route("https://static.metron.cloud/**", (route) => route.fulfill({
    status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"/>',
  }));
});

const box = (page: Page) => page.getByRole("searchbox", { name: "Series and number" });

test("typing thor 337-340 and pausing lists the catalog's row with its run count and Metron's with Metron, and meets the floor (AC-3, AC-4, AC-6)", async ({ page }, info) => {
  await page.goto(`/comics/${E2E_RUN_ID}/add`);
  await hydrated(box(page));
  await expect(box(page)).toHaveAttribute("type", "search");
  await expect(page.getByText("Your catalog first, then Metron. Searches as you type.")).toBeVisible();
  const requests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/metron/search") requests.push(JSON.parse(r.postData() ?? "{}").q);
  });

  await box(page).pressSequentially("thor 337-340", { delay: 40 });
  const catalog = page.getByRole("list", { name: "In your catalog" });
  const metron = page.getByRole("list", { name: "From Metron" });
  await expect(catalog.getByRole("listitem", { name: `${THOR_337.label} in 1 run · ${THOR_RUN.title}`, exact: true }))
    .toBeVisible();
  await expect(metron.getByRole("listitem")).toHaveCount(3);
  for (const n of [338, 339, 340]) {
    await expect(metron.getByRole("listitem", { name: `Thor (1966) #${n} Metron`, exact: true })).toBeVisible();
  }
  // Typed, not entered, and asked once.
  expect(requests).toEqual(["thor 337-340"]);
  await expect(page.locator('#search-wait[role="status"]')).toHaveAttribute("aria-live", "polite");

  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "issue-search-as-you-type");
});

test("two characters ask nothing (AC-6)", CORE, async ({ page }) => {
  await page.goto(`/comics/${E2E_RUN_ID}/add`);
  await hydrated(box(page));
  const requests: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/metron/search") requests.push(r.url()); });
  await box(page).pressSequentially("th", { delay: 60 });
  await page.waitForTimeout(900);
  expect(requests).toEqual([]);
});
