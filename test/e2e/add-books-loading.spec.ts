// Task 1.30 (AC-5): Add books' code loads when its sheet opens, not with the
// page. Until it arrives the sheet draws its loading state at the loaded size
// (docs/04-design.md § 10: a skeleton is the loaded geometry), so nothing moves
// when it does: a sheet rising from the bottom that grows on arrival jumps its
// top edge (ui-verifier found 0.53 of layout shift with a short skeleton). Every
// script the Library needs is loaded before the tap, so the one held here is
// Add books' own. Reads only, so it runs at every width. The unit test of the
// same wait, with focus and the second open, is test/add-books-loading.test.tsx.
import { expect, test } from "@playwright/test";
import { hydrated } from "./helpers";

test("Add books' sheet is its loaded size while its code loads, so nothing moves when it arrives (AC-5)", async ({ page }) => {
  // No rise animation to measure through: the sheet stands where it stops.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/books/list");
  const opener = page.getByRole("button", { name: "Add books", exact: true });
  await hydrated(opener);

  let release = () => {};
  const held = new Promise<void>((r) => { release = r; });
  const asked: string[] = [];
  await page.route("**/_next/static/**/*.js", async (route) => {
    asked.push(route.request().url());
    await held;
    await route.continue();
  });
  await opener.click();

  const sheet = page.locator(".sheet");
  await expect(sheet.locator('[aria-busy="true"]')).toBeVisible();
  await expect(sheet.getByRole("heading", { name: "Add books" })).toBeFocused();
  await expect(sheet.locator(".addb")).toHaveCount(0);
  // The open asked for its code: the loading state is what shows while it is held.
  expect(asked.length).toBeGreaterThan(0);
  const during = (await sheet.boundingBox())!;

  release();
  await expect(sheet.locator(".addb")).toBeVisible();
  await expect(sheet.locator('[aria-busy="true"]')).toHaveCount(0);
  const after = (await sheet.boundingBox())!;
  expect(Math.abs(after.y - during.y), "the sheet's top edge").toBeLessThanOrEqual(2);
  expect(Math.abs(after.height - during.height), "the sheet's height").toBeLessThanOrEqual(2);
});
