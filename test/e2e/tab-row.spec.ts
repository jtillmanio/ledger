// Task 2.2i (D-120): the phone's tab row, in a real browser. Below 768px a row under the media bar
// lists every enabled screen of the medium you are in, then Inbox, so no screen needs a typed URL.
// Every check sets its own viewport and runs once (the w390-light project); the row is built from
// NAV_ITEMS here too, so an item a later task flips on is covered without editing this file.
import { expect, test, type Page } from "@playwright/test";
import { MEDIUM_COOKIE } from "../../src/lib/last-medium";
import { currentItem, NAV_ITEMS, tabRowItems, withLastRun } from "../../src/components/nav/items";
import { expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour } from "./helpers";

const ONCE = { tag: "@at-w390-light" };
const size = (page: Page, width: number, height = 780) => page.setViewportSize({ width, height });

const MEDIA = NAV_ITEMS.filter((i) => i.group === "media");
// Comics Add points at the run list until you add to a run (1.19), the same as the page draws it.
const ITEMS = withLastRun(NAV_ITEMS, null);
const row = (page: Page) => page.locator("header.bar nav.tabrow");
const current = (page: Page) => row(page).locator('[aria-current="page"]');

const barHeight = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.cssText = "position:absolute;width:1px;height:var(--bar-h)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });

/** Taps `item`'s link in the row and waits for the screen; the pathname it should land on. */
async function tap(page: Page, href: string, label: string) {
  const here = new URL(page.url()).pathname;
  await row(page).getByRole("link", { name: label, exact: true }).click();
  if (here !== href) await page.waitForURL(`**${href}`);
  return new URL(page.url()).pathname;
}

for (const media of MEDIA) {
  test(`from ${media.label}'s first screen, every item of the row, Inbox and Settings are tapped to (AC-1)`, ONCE, async ({ page }) => {
    await size(page, 360);
    await page.goto(media.href);
    await hydrated(page.locator("header.bar"));
    const list = tabRowItems(ITEMS, media.medium!);
    expect(list.length, "at least the medium's own item and Inbox").toBeGreaterThanOrEqual(2);
    // The row is exactly the items NAV_ITEMS enables for this medium, then Inbox.
    await expect(row(page).getByRole("link")).toHaveText(list.map((i) => i.label));

    for (const item of list) {
      const path = await tap(page, item.href, item.label);
      // What the row marks follows the same rule as the rail: Add shares /comics/runs with Runs
      // until you have added to a run, so a tap on it marks Runs.
      const rowAtPath = tabRowItems(ITEMS, media.medium!);
      const expected = currentItem(rowAtPath, path);
      await expect(current(page), `${item.label} → ${path}`).toHaveCount(expected ? 1 : 0);
      if (expected) await expect(current(page)).toHaveText(expected.label);
      expect(expected, `${item.label} is current somewhere`).toBeDefined();
    }
    // The last tap was Inbox: the row still lists this medium's screens.
    await expect(page).toHaveURL(/\/inbox$/);
    await expect(row(page).getByRole("link")).toHaveText(list.map((i) => i.label));

    // Settings is the gear; the row stays and marks none of its items.
    await page.locator('header.bar a[href="/settings"]').click();
    await page.waitForURL("**/settings");
    await expect(page.locator('header.bar a[href="/settings"]')).toHaveAttribute("aria-current", "page");
    await expect(current(page)).toHaveCount(0);
    await expect(row(page).getByRole("link")).toHaveText(list.map((i) => i.label));
  });
}

test("with every books item enabled the row scrolls inside itself and the page does not (AC-1)", ONCE, async ({ page }) => {
  await size(page, 360);
  await page.goto("/books/list");
  await hydrated(page.locator("header.bar"));
  const all = tabRowItems(NAV_ITEMS.map((i) => ({ ...i, enabled: true })), "books");
  expect(all.length).toBeGreaterThan(tabRowItems(ITEMS, "books").length);
  // NAV_ITEMS is compiled in and a disabled item has no route, so the row is drawn with every
  // item the way the rest of the page draws one: the same classes, no test-only route or switch.
  await row(page).evaluate((nav, items) => {
    const proto = nav.querySelector("a")!;
    nav.replaceChildren(...items.map((i) => {
      const a = proto.cloneNode(false) as HTMLAnchorElement;
      a.removeAttribute("aria-current");
      a.href = i.href;
      a.textContent = i.label;
      return a;
    }));
  }, all.map((i) => ({ href: i.href, label: i.label })));
  await expect(row(page).getByRole("link")).toHaveCount(all.length);
  const { scroll, client } = await row(page).evaluate((nav) => ({ scroll: nav.scrollWidth, client: nav.clientWidth }));
  expect(scroll, "the row overflows itself").toBeGreaterThan(client);
  await expectNoHorizontalScroll(page);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
});

test("the row is not drawn at 768px or wider (AC-1, AC-6)", ONCE, async ({ page }) => {
  // Drawn on the phone first, so "hidden" below means the CSS hides a row that exists.
  await size(page, 360);
  await page.goto("/books/list");
  await expect(row(page)).toBeVisible();
  for (const width of [768, 1024, 1280]) {
    await size(page, width, 900);
    await page.goto("/books/list");
    await expect(row(page), `at ${width}`).toHaveCount(1);
    await expect(row(page), `at ${width}`).toBeHidden();
    await expect(page.locator("header.bar"), `at ${width}`).toBeHidden();
    await screenshot(page, test.info(), `tab-row-absent-${width}`);
  }
});

test("each item measures at least 44px tall, has a name, and marks the current one by weight and underline (AC-1, AC-6)", ONCE, async ({ page }) => {
  await size(page, 360);
  for (const path of ["/comics", "/books/list", "/inbox"]) {
    await page.goto(path);
    await hydrated(page.locator("header.bar"));
    const links = row(page).getByRole("link");
    const n = await links.count();
    expect(n).toBeGreaterThanOrEqual(2);
    for (let i = 0; i < n; i++) {
      const box = (await links.nth(i).boundingBox())!;
      expect(box.height, `${path} item ${i}`).toBeGreaterThanOrEqual(44);
      expect((await links.nth(i).innerText()).trim().length, `${path} item ${i} has a name`).toBeGreaterThan(0);
    }
    const now = current(page);
    await expect(now).toHaveCount(1);
    const style = await now.evaluate((a) => ({ weight: getComputedStyle(a).fontWeight, shadow: getComputedStyle(a).boxShadow }));
    expect(Number(style.weight), `${path} weight`).toBeGreaterThanOrEqual(600);
    expect(style.shadow, `${path} underline`).not.toBe("none");
    const other = row(page).locator("a:not([aria-current])").first();
    expect(Number(await other.evaluate((a) => getComputedStyle(a).fontWeight))).toBeLessThan(600);
  }
});

test("a keyboard-focused item, the current one too, shows an inset brand ring (AC-6)", ONCE, async ({ page }) => {
  await size(page, 360);
  await page.goto("/comics");
  await hydrated(page.locator("header.bar"));
  const brand = await tokenColour(page, "--brand");
  await page.locator("header.bar a.home").focus();
  const seen = new Set<string>();
  for (let i = 0; i < 12 && seen.size < 2; i++) {
    await page.keyboard.press("Tab");
    const inRow = await page.evaluate(() => !!document.activeElement?.closest(".tabrow"));
    if (!inRow) continue;
    const focused = page.locator(".tabrow a:focus");
    // box-shadow transitions on the controls, so wait for the settled value.
    await expect.poll(() => focused.evaluate((el) => getComputedStyle(el).boxShadow), "the focus ring").toContain(brand);
    const info = await focused.evaluate((el) => ({ current: el.hasAttribute("aria-current"), shadow: getComputedStyle(el).boxShadow }));
    expect(info.shadow).toContain("inset");
    expect(info.shadow).toContain("2px");
    seen.add(info.current ? "current" : "other");
  }
  expect([...seen].sort(), "tabbed onto the current item and another").toEqual(["current", "other"]);
});

test("a screen with no medium draws the last medium's items (AC-3)", ONCE, async ({ page, context }) => {
  await size(page, 360);
  const labelsOf = (medium: "comics" | "books") => tabRowItems(ITEMS, medium).map((i) => i.label);

  // Visit books, then tap Inbox: the row keeps the books items, Inbox is current.
  await page.goto("/books/list");
  await hydrated(page.locator("header.bar"));
  await tap(page, "/inbox", "Inbox");
  await expect(row(page).getByRole("link")).toHaveText(labelsOf("books"));
  await expect(current(page)).toHaveText("Inbox");
  // The same from a hard load: the server hands the cookie over.
  await page.goto("/inbox");
  await expect(row(page).getByRole("link")).toHaveText(labelsOf("books"));
  await expect(current(page)).toHaveText("Inbox");

  // Comics.
  await page.goto("/comics");
  await page.goto("/inbox");
  await expect(row(page).getByRole("link")).toHaveText(labelsOf("comics"));
  await expect(current(page)).toHaveText("Inbox");

  // Settings: the last medium's items, none current, and the gear is.
  await page.goto("/books/list");
  await page.goto("/settings");
  await expect(row(page).getByRole("link")).toHaveText(labelsOf("books"));
  await expect(current(page)).toHaveCount(0);
  await expect(page.locator('header.bar a[href="/settings"]')).toHaveAttribute("aria-current", "page");

  // No cookie at all: comics.
  await context.clearCookies({ name: MEDIUM_COOKIE });
  await page.goto("/inbox");
  await expect(row(page).getByRole("link")).toHaveText(labelsOf("comics"));
});

test("the row's height is the same before and after the last medium arrives (AC-3)", ONCE, async ({ page }) => {
  await size(page, 360);
  await page.goto("/books/list");
  await page.addInitScript(() => {
    const seen = new Set<number>();
    const w = window as unknown as { __heights: Set<number>; __counts: Set<number> };
    const counts = new Set<number>();
    w.__heights = seen;
    w.__counts = counts;
    const tick = () => {
      const r = document.querySelector("header.bar nav.tabrow");
      if (r) {
        seen.add(Math.round(r.getBoundingClientRect().height * 100) / 100);
        counts.add(r.querySelectorAll("a").length);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await page.goto("/inbox", { waitUntil: "commit" });
  await expect(row(page).getByRole("link")).toHaveText(tabRowItems(ITEMS, "books").map((i) => i.label));
  await page.waitForTimeout(300);
  const { heights, counts } = await page.evaluate(() => {
    const w = window as unknown as { __heights: Set<number>; __counts: Set<number> };
    return { heights: [...w.__heights], counts: [...w.__counts] };
  });
  expect(heights, "one height for the whole load").toHaveLength(1);
  expect(heights[0]).toBe(44);
  // Whether the Inbox-alone state is sampled depends on timing; the end state is not.
  expect(counts).toContain(tabRowItems(ITEMS, "books").length);
});

test("scrolled 400px the bar stays at the top with the row in view, the sync strip under it, and --bar-h tracks the width (AC-4)", ONCE, async ({ page, context }) => {
  await size(page, 360);
  await page.goto("/books/list");
  await hydrated(page.locator("header.bar"));
  await page.evaluate(() => { document.querySelector<HTMLElement>(".app")!.style.minHeight = "2400px"; });
  await page.evaluate(() => window.scrollTo(0, 400));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
  const barH = await barHeight(page);
  expect(barH).toBe(108);
  const bar = (await page.locator("header.bar").boundingBox())!;
  expect(bar.y).toBe(0);
  expect(bar.y + bar.height).toBe(barH);
  const rowBox = (await row(page).boundingBox())!;
  expect(rowBox.y).toBeGreaterThanOrEqual(0);
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(barH);
  await context.setOffline(true);
  const strip = page.locator(".sync-strip");
  await expect(strip).toHaveText("offline");
  expect((await strip.boundingBox())!.y).toBe(barH);
  await context.setOffline(false);

  await size(page, 768, 900);
  expect(await barHeight(page)).toBe(64);
  await size(page, 1024, 900);
  expect(await barHeight(page)).toBe(80);
});

test("the current item is scrolled into view inside the row and the page does not move (AC-4)", ONCE, async ({ page }) => {
  await size(page, 280);
  await page.goto("/comics");
  await page.goto("/inbox");
  await hydrated(page.locator("header.bar"));
  const nav = (await row(page).boundingBox())!;
  const { overflows } = await row(page).evaluate((n) => ({ overflows: n.scrollWidth > n.clientWidth }));
  expect(overflows, "the row overflows at 280px").toBe(true);
  await expect.poll(async () => {
    const now = (await current(page).boundingBox())!;
    return now.x >= nav.x - 0.5 && now.x + now.width <= nav.x + nav.width + 0.5;
  }).toBe(true);
  expect(await current(page).textContent()).toBe("Inbox");
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollLeft)).toBe(0);
});

test("layout shift on /books/list and /comics stays under 0.1 (AC-1)", ONCE, async ({ page }) => {
  await size(page, 360);
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  for (const path of ["/books/list", "/comics"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, path).toBeLessThan(0.1);
  }
});

test("axe passes with the row, in both themes, with reduced motion on and off (AC-1, AC-6)", ONCE, async ({ page }) => {
  await size(page, 360);
  const rules = [
    "link-name", "landmark-unique", "landmark-banner-is-top-level", "landmark-no-duplicate-banner",
    "landmark-one-main", "region", "aria-allowed-attr", "aria-valid-attr-value", "color-contrast",
    "scrollable-region-focusable", "nested-interactive", "target-size",
  ];
  for (const colorScheme of ["light", "dark"] as const) {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion });
      for (const path of ["/comics", "/books/list", "/inbox"]) {
        await page.goto(path);
        await hydrated(page.locator("header.bar"));
        await expectNoAxeViolations(page, rules, "header.bar");
        // aria-current stays on the right item whatever the motion preference.
        const medium = path === "/comics" ? "comics" : "books";
        const expected = currentItem(tabRowItems(ITEMS, medium), path)!;
        await expect(current(page), path).toHaveText(expected.label);
        await expect(current(page)).toHaveCount(1);
      }
    }
  }
});

test("screenshots of the row at 360, 390 and 412px, light and dark (AC-1, AC-6)", ONCE, async ({ page }, testInfo) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [360, 390, 412]) {
      await size(page, width, 800);
      for (const [path, name] of [["/comics", "comics"], ["/books/list", "books"], ["/inbox", "inbox"]] as const) {
        await page.goto(path);
        await hydrated(page.locator("header.bar"));
        await expectNoHorizontalScroll(page);
        await screenshot(page, testInfo, `tab-row-${name}-${width}-${colorScheme}`);
      }
    }
  }
});
