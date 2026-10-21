// The shared helpers for browser checks (task 0.11, D-72). Every UI task's own
// e2e spec builds on these, so each proves its UX-floor checks the same way.
//
//   expectNoAxeViolations  axe over the page for the rules a check names
//   computedStyle          what the browser resolved, custom properties too
//   expectNoHorizontalScroll  the page is no wider than the viewport
//   screenshot             PR evidence under a gitignored folder, never a baseline
import AxeBuilder from "@axe-core/playwright";
import type { Locator, Page, TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// The one run test/e2e/global-setup.ts seeds, for specs to load.
export const E2E_RUN_ID = "e2e-run";
export const E2E_RUN_TITLE = "E2E Run";
export const E2E_ISSUE_COUNT = 12;
export const E2E_READ_COUNT = 3;
// A run whose Resume label is long, so the run page's action row is checked where it is tightest.
export const E2E_LONG_RUN_ID = "e2e-long-run";
export const E2E_LONG_LABEL = "The Amazing Spider-Man: Renew Your Vows Annual (2026) #112";
// Notes waiting in the inbox, for the shell's Inbox (N) to count.
export const E2E_INBOX_COUNT = 2;
// Books on /books/list, so its rows and their status controls are in the page a check reads (task 1.8d).
export const E2E_BOOK_COUNT = 2;

/**
 * Fails when axe finds a violation of any rule in `rules`, naming each rule and
 * the elements it hit. An empty list fails (axe would run every rule, or none),
 * and so does an id axe does not know: axe throws on it.
 */
export async function expectNoAxeViolations(page: Page, rules: string[]) {
  if (rules.length === 0) throw new Error("expectNoAxeViolations needs the rules the check names.");
  const results = await new AxeBuilder({ page }).withRules(rules).analyze();
  if (results.violations.length === 0) return;
  const lines = results.violations.map(
    (v) => `${v.id} (${v.impact ?? "n/a"}): ${v.help}\n` + v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n"),
  );
  throw new Error(`axe found ${results.violations.length} violation(s) on ${page.url()}:\n${lines.join("\n")}`);
}

/** The resolved value of each property, by its CSS name: `background-color`, `--page`. */
export async function computedStyle(locator: Locator, props: string[]): Promise<Record<string, string>> {
  return locator.evaluate((el, names) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(names.map((p) => [p, cs.getPropertyValue(p).trim()]));
  }, props);
}

/** Fails when the page scrolls sideways: the root or the body is wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const m = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  if (m.root > m.viewport || m.body > m.viewport) {
    throw new Error(
      `horizontal scroll on ${page.url() || "the page"}: viewport ${m.viewport}px, root ${m.root}px, body ${m.body}px`,
    );
  }
}

/** Where screenshots go. Git ignores it, and Playwright empties it at the start of a run. */
export const SCREENS_DIR = resolve("test-results", "screens");

/** Writes `test-results/screens/<project>/<name>.png`, the whole page; returns the path. */
export async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const file = resolve(SCREENS_DIR, testInfo.project.name, `${name}.png`);
  mkdirSync(dirname(file), { recursive: true });
  // next dev draws its own badge in a corner; it is not the app.
  await page.screenshot({ path: file, fullPage: true, style: "nextjs-portal { display: none !important; }" });
  return file;
}
