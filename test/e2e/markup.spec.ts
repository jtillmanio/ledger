// Task 1.8d: every row and control on a dashboard is real, named markup. A
// navigable row is <article class="row"><a class="row-link">, the link stretched
// over the row, with nothing interactive inside the anchor; segmented controls,
// chips and switches are real buttons or links; each page has one <h1>; and
// axe finds no nested-interactive, button-name or link-name violation. Runs at
// every width, light and dark; the screenshots are the PR's evidence.
import { expect, test } from "@playwright/test";
import {
  E2E_BOOK_COUNT, E2E_RUN_ID, computedStyle, expectNoAxeViolations, screenshot,
} from "./helpers";

const AXE_RULES = ["nested-interactive", "button-name", "link-name"];
// The dashboards (the books one is a redirect to its list until 2.2) and the two list pages.
const PAGES = ["/comics", "/comics/runs", "/books/list", "/watch"];
const NAVIGABLE = ["/comics", "/comics/runs"];
// Pages that draw chips or segmented controls, so the check below has something to find.
const HAS_CONTROLS = ["/comics/runs", "/books/list"];

for (const path of PAGES) {
  test.describe(path, () => {
    test("has exactly one h1", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    });

    test("axe finds no nested-interactive, button-name or link-name violation (AC-1)", async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoAxeViolations(page, AXE_RULES);
      if (path !== "/watch") await screenshot(page, testInfo, `markup${path.replaceAll("/", "-")}`);
    });

    test("nothing interactive sits inside a link, and no control is a styled span (AC-4)", async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.locator("a a, a button, a input, a [role='button']").count(), "an anchor holds a control").toBe(0);
      // A chip, a segmented control's item and a switch are a link or a button, never a span or a div.
      const tags = await page.locator(".chip, .seg > *, .switch").evaluateAll((els) => els.map((el) => el.tagName));
      if (HAS_CONTROLS.includes(path)) expect(tags.length, "the page draws chips or segments").toBeGreaterThan(0);
      expect(tags.filter((t) => t !== "A" && t !== "BUTTON"), "chips, segments and switches").toEqual([]);
    });
  });
}

for (const path of NAVIGABLE) {
  test(`${path}: a row is article > a.row-link, and the link holds no control (AC-4)`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    const rows = await page.locator(".rows > .row").evaluateAll((els) =>
      els.map((el) => ({
        tag: el.tagName,
        links: [...el.children].filter((c) => c.matches("a.row-link")).length,
        inside: el.querySelectorAll("a.row-link a, a.row-link button, a.row-link [role='button']").length,
      })));
    expect(rows.length, "the seed has runs to list").toBeGreaterThan(0);
    for (const [n, r] of rows.entries()) {
      expect(r, `row ${n + 1}`).toEqual({ tag: "ARTICLE", links: 1, inside: 0 });
    }
  });

  test(`${path}: the row's link is stretched over the whole row (AC-4)`, async ({ page }) => {
    await page.goto(path);
    const row = page.locator(".rows > .row").first();
    const link = row.locator("a.row-link");
    await expect(link).toHaveCount(1);
    // ::after covers the row: a click in its corner, outside any text, follows the link.
    const after = await link.evaluate((el) => {
      const cs = getComputedStyle(el, "::after");
      return { position: cs.position, inset: [cs.top, cs.right, cs.bottom, cs.left].join(" ") };
    });
    expect(after).toEqual({ position: "absolute", inset: "0px 0px 0px 0px" });
    const box = (await row.boundingBox())!;
    await page.mouse.click(box.x + box.width - 3, box.y + box.height - 3);
    await expect(page).toHaveURL(/\/comics\/[^/]+(#.*)?$/);
  });
}

test("/books/list: its rows are articles with no link, and the status controls have names (AC-4)", async ({ page }) => {
  await page.goto("/books/list");
  const rows = await page.locator(".rows > .row.book-row").evaluateAll((els) =>
    els.map((el) => ({ tag: el.tagName, links: el.querySelectorAll("a").length })));
  expect(rows.length).toBe(E2E_BOOK_COUNT);
  for (const r of rows) expect(r).toEqual({ tag: "ARTICLE", links: 0 });
  const buttons = await page.locator(".book-row button").all();
  expect(buttons.length, "each book row has status controls").toBeGreaterThan(0);
  for (const b of buttons) {
    expect((await b.getAttribute("aria-label")) || (await b.textContent())?.trim(), "a button with no name").toBeTruthy();
  }
});

// Two projects tell it apart: a fine pointer at 1280px hides them at rest, touch shows them.
test.describe("hover reveals (AC-5)", { tag: ["@at-w1280-light", "@at-w390-touch"] }, () => {

  test("a row's ⋯ is hidden at rest with a fine pointer, shown on hover and focus, and always shown on touch", async ({ page, hasTouch }) => {
    await page.goto(`/comics/${E2E_RUN_ID}`);
    const more = page.locator(".iss .rowmenu-btn").first();
    await page.mouse.move(0, 0);
    const opacity = async () => (await computedStyle(more, ["opacity"])).opacity;
    const rest = await opacity();
    if (hasTouch) {
      expect(rest).toBe("1");
      return;
    }
    expect(rest).toBe("0");
    // It fades in, so poll rather than read it mid-transition.
    await page.locator(".iss:has(.rowmenu-btn)").first().hover();
    await expect.poll(opacity, { message: "hovering the row" }).toBe("1");
    await page.mouse.move(0, 0);
    await expect.poll(opacity, { message: "the pointer left" }).toBe("0");
    await more.focus();
    await expect.poll(opacity, { message: "keyboard focus" }).toBe("1");
  });
});
