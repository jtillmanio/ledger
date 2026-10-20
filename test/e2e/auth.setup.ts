// The `setup` project: signs in once, through the login form the way the owner
// does (the form posts /api/login), and saves the session for every other
// project. It goes through the page, not request.post: the cookie is `secure`,
// and Chromium only keeps one on http://localhost when the page set it.
import { expect, test as setup } from "@playwright/test";
import { E2E_PASSCODE } from "../../scripts/lib/e2e.mjs";

export const STATE_FILE = "test/e2e/.auth/state.json";

setup("sign in with the test passcode", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Passcode").fill(E2E_PASSCODE);
  await page.getByRole("button", { name: "Open ledger" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  expect((await page.context().cookies()).some((c) => c.name === "rt_session")).toBe(true);
  await page.context().storageState({ path: STATE_FILE });
});
