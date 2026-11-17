// The helpers prove themselves (task 0.11): each one is shown to fail on a page
// built to fail it, and to pass once the page is fixed, so a green run of any
// later spec means something. The fixtures are loaded with setContent: nothing
// of them ships in the app.
import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { E2E_RUN_ID, FLOOR, computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, screenshot } from "./helpers";

const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

test("axe fails on button-name for an unnamed button", FLOOR, async ({ page }) => {
  await page.setContent(fixture("unnamed-button.html"));
  await expect(expectNoAxeViolations(page, ["button-name"])).rejects.toThrow(/button-name[\s\S]*button/);

  // The same page with the button named passes, so the failure is the button's.
  await page.locator("button").evaluate((b) => b.setAttribute("aria-label", "Mark read"));
  await expectNoAxeViolations(page, ["button-name"]);
});

test("axe refuses an empty rule list and a rule id axe does not know", FLOOR, async ({ page }) => {
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

// A pressed chip measured while its colour still moves read 1.35:1 in TASK-064's
// first full run; the same check passed once the transition ended. The helper
// waits for every transition and animation that ends, and not for one that loops.
test("contrast is measured once transitions end, without waiting on a looping animation", FLOOR, async ({ page }) => {
  await page.setContent(fixture("transition-contrast.html"));
  await page.locator(".chip").evaluate((el) => {
    el.classList.add("on");
    void getComputedStyle(el).backgroundColor; // start the transition now
  });
  const started = Date.now();
  expect(await contrastFailures(page)).toEqual([]);
  // It waited for the 1.2s transition, and the infinite spinner didn't hold it.
  expect(Date.now() - started).toBeGreaterThanOrEqual(900);
  expect(Date.now() - started).toBeLessThan(5_000);
});

// D-161: no dark project runs the floor, so the floor's own checks find a
// failure only dark has, from a light project, and leave the page as it was.
test("contrast, axe and the screenshot check the other theme in place, then switch back", FLOOR, async ({ page }, testInfo) => {
  await page.setContent(fixture("dark-only-contrast.html"));
  const own = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  expect(own).toBe(false); // no project that runs the floor is dark (D-161)

  const failures = await contrastFailures(page);
  expect(failures).toHaveLength(1);
  expect(failures[0]).toMatch(/^dark: p "Readable in light, not in dark" 1\.\d+:1/);
  await expect(expectNoAxeViolations(page, ["color-contrast"])).rejects.toThrow(/dark: color-contrast/);

  const file = await screenshot(page, testInfo, "dark-only");
  expect(existsSync(file)).toBe(true);
  expect(existsSync(file.replace(/\.png$/, ".dark.png"))).toBe(true);

  // Back in its own theme afterwards, so what the test reads next is light: at
  // once, with no 2s transition left running back to it, and transitions on again.
  expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(false);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await computedStyle(page.locator("p"), ["color", "transition-duration"])).toEqual({ color: "rgb(17, 17, 17)", "transition-duration": "2s, 2s" });

  // A root that sets data-theme no longer follows the media query: nothing to switch.
  await page.locator("html").evaluate((el) => el.setAttribute("data-theme", "light"));
  expect(await contrastFailures(page)).toEqual([]);
});

test("a test pinned to a project checks only that project's theme", { tag: "@at-w390-light" }, async ({ page }, testInfo) => {
  await page.setContent(fixture("dark-only-contrast.html"));
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, ["color-contrast"]);
  const file = await screenshot(page, testInfo, "dark-only-pinned");
  expect(existsSync(file.replace(/\.png$/, ".dark.png"))).toBe(false);
});

test("the helpers work together", FLOOR, async ({ page }, testInfo) => {
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
