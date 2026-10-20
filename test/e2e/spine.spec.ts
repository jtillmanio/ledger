// AC-1 of task 0.11: signed in with the test passcode, a seeded run's spine
// loads at every width, in light and dark, with no sideways scroll. Each UI
// task adds its own checks beside this one, on the helpers.
import { expect, test } from "@playwright/test";
import {
  E2E_ISSUE_COUNT, E2E_RUN_ID, E2E_RUN_TITLE, expectNoAxeViolations, expectNoHorizontalScroll, screenshot,
} from "./helpers";

test("signs in and loads the seeded spine", async ({ page }, testInfo) => {
  await page.goto(`/comics/${E2E_RUN_ID}`);

  // Past the passcode gate, not bounced to /login.
  expect(new URL(page.url()).pathname).toBe(`/comics/${E2E_RUN_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(E2E_RUN_TITLE);
  await expect(page.locator(".iss")).toHaveCount(E2E_ISSUE_COUNT);
  await expectNoHorizontalScroll(page);
  // Rules the spine already meets; each screen task widens the list for itself.
  await expectNoAxeViolations(page, ["button-name", "image-alt", "document-title", "html-has-lang"]);

  await screenshot(page, testInfo, "spine");
});
