// The helpers prove themselves (task 0.11): each one is shown to fail on a page
// built to fail it, and to pass once the page is fixed, so a green run of any
// later spec means something. The fixtures are loaded with setContent: nothing
// of them ships in the app.
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  E2E_RUN_ID, computedStyle, expectNoAxeViolations, expectNoHorizontalScroll, screenshot,
} from "./helpers";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

test("axe fails on button-name for an unnamed button", async ({ page }) => {
  await page.setContent(fixture("unnamed-button.html"));
  await expect(expectNoAxeViolations(page, ["button-name"])).rejects.toThrow(/button-name[\s\S]*button/);

  // The same page with the button named passes, so the failure is the button's.
  await page.locator("button").evaluate((b) => b.setAttribute("aria-label", "Mark read"));
  await expectNoAxeViolations(page, ["button-name"]);
});

test("axe refuses an empty rule list and a rule id axe does not know", async ({ page }) => {
  await page.setContent(fixture("unnamed-button.html"));
  await expect(expectNoAxeViolations(page, [])).rejects.toThrow(/needs the rules/);
  await expect(expectNoAxeViolations(page, ["buton-name"])).rejects.toThrow(/unknown rule `buton-name`/);
});

// The fixture is built to overflow at 360px.
test("no-scroll fails on a page that overflows at 360px", { tag: ["@at-w360-light", "@at-w360-dark"] }, async ({ page }) => {
  await page.setContent(fixture("overflow-360.html"));
  await expect(expectNoHorizontalScroll(page)).rejects.toThrow(/horizontal scroll[\s\S]*viewport 360px/);

  await page.locator("#wide").evaluate((el) => { el.style.width = "100%"; });
  await expectNoHorizontalScroll(page);
});

test("the helpers work together", async ({ page }, testInfo) => {
  await page.goto(`/comics/${E2E_RUN_ID}`);

  await expectNoAxeViolations(page, ["button-name", "document-title"]);

  // The theme follows the project's colorScheme, and body paints the --page token.
  const dark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  expect(dark).toBe(testInfo.project.name.endsWith("dark"));
  const token = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--page)";
    document.body.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return resolved;
  });
  const body = await computedStyle(page.locator("body"), ["background-color", "margin-top"]);
  expect(body["background-color"]).toBe(token);
  expect(body["margin-top"]).toBe("0px");
  // Custom properties read too, as the stylesheet wrote them.
  const { "--page": pageToken } = await computedStyle(page.locator("html"), ["--page"]);
  expect(pageToken).toMatch(/^#[0-9a-f]{6}$/i);

  await expectNoHorizontalScroll(page);

  const file = await screenshot(page, testInfo, "helpers-probe");
  expect(existsSync(file)).toBe(true);
});
