// Task 1.8: the app shell in a real browser. A media bar on the phone, a rail on
// a tablet, a sidebar on desktop, all drawn from one NAV_ITEMS list. The checks
// that need no layout of the project's own set their viewport and run once
// (the w390-light project); the screenshots and the sideways-scroll check run
// at every width, light and dark, and under reduced motion.
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_INBOX_COUNT, E2E_LONG_RUN_ID, E2E_RUN_ID, expectNoAxeViolations, expectNoHorizontalScroll, screenshot,
} from "./helpers";

const ONCE = "w390-light";
const runsOnce = (name: string) => test.skip(name !== ONCE, `sets its own viewport: runs once, in ${ONCE}`);
const DASHBOARDS = ["/comics", "/watch"];

const size = (page: Page, width: number, height = 900) => page.setViewportSize({ width, height });

/** What a token resolves to as a colour: custom properties compare as strings, so draw one. */
const colourOf = (page: Page, token: string) =>
  page.evaluate((t) => {
    const probe = document.createElement("i");
    probe.style.color = `var(${t})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, token);

const barHeight = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.cssText = "position:absolute;width:1px;height:var(--bar-h)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });

test.describe("every width", () => {
  for (const path of DASHBOARDS) {
    test(`${path} fits the width and is drawn (AC-1, AC-4)`, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoHorizontalScroll(page);
      await screenshot(page, testInfo, `shell${path.replace("/", "-")}`);
    });
  }

  test("the run page fits the width, its Resume, Add issues and ⋯ row too, with a long label", async ({ page }) => {
    for (const run of [E2E_RUN_ID, E2E_LONG_RUN_ID]) {
      await page.goto(`/comics/${run}`);
      await expect(page.locator(".run-actions .resume")).toBeVisible();
      await expectNoHorizontalScroll(page);
      // The ⋯ button sits inside the viewport, not clipped off its edge.
      const more = (await page.locator(".run-actions .more").boundingBox())!;
      expect(more.x + more.width, run).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });
});

test("no horizontal scroll at 360, 768, 834 and 1280, with a screenshot of each", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  for (const width of [360, 768, 834, 1280]) {
    await size(page, width);
    for (const path of DASHBOARDS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
      await expectNoHorizontalScroll(page);
      await screenshot(page, testInfo, `shell-${width}${path.replace("/", "-")}`);
    }
  }
});

test("at 768 and 834 the rail shows with its labels, and no media bar or sidebar", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  for (const width of [768, 834]) {
    await size(page, width);
    for (const path of DASHBOARDS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
      await expect(page.locator(".rail")).toBeVisible();
      await expect(page.locator(".bar")).toBeHidden();
      await expect(page.locator(".side")).toBeHidden();

      const items = page.locator(".rail a");
      expect(await items.count()).toBeGreaterThan(3);
      for (const item of await items.all()) {
        const box = (await item.boundingBox())!;
        expect(box.height, `${await item.textContent()} at ${width}`).toBeGreaterThanOrEqual(56);
        expect((await item.textContent())?.trim().length, "a visible text label").toBeGreaterThan(0);
        await expect(item.locator(".rl")).toBeVisible();
      }
      const bar = (await page.locator(".actionbar").boundingBox())!;
      expect(bar.height, `${path} .actionbar at ${width}`).toBe(48);
    }
  }
});

test("the page names no external host for an icon, a font or a script, and icons in buttons are hidden", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  for (const path of ["/comics", "/watch", "/inbox", `/comics/${E2E_RUN_ID}`]) {
    await page.goto(path);
    const external = await page.evaluate(() => {
      const origin = location.origin;
      const urls = [...document.querySelectorAll("link[href], script[src], img[src], use, source[src], image")]
        .map((e) => e.getAttribute("href") ?? e.getAttribute("xlink:href") ?? e.getAttribute("src") ?? "");
      return urls.filter((u) => /^(https?:)?\/\//.test(u) && !u.startsWith(origin));
    });
    expect(external, path).toEqual([]);
    expect(await page.content(), `${path} draws no U+26B2`).not.toContain("⚲");

    const bad = await page.evaluate(() =>
      [...document.querySelectorAll("button")].flatMap((b) => {
        const name = (b.getAttribute("aria-label") ?? b.textContent ?? "").trim();
        const visible = [...b.querySelectorAll("svg")].filter((s) => s.getAttribute("aria-hidden") !== "true");
        return name === "" || visible.length > 0 ? [b.outerHTML.slice(0, 120)] : [];
      }));
    expect(bad, `${path} buttons`).toEqual([]);
  }
});

test("at 1100 the sidebar is a 64px icon rail: every item named, its tooltip hidden until focus", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 1100);
  await page.goto("/comics");
  await expect(page.locator(".side")).toBeVisible();
  await expect(page.locator(".rail")).toBeHidden();
  expect((await page.locator(".side").boundingBox())!.width).toBe(64);

  const links = page.locator(".side a");
  for (const link of await links.all()) await expect(link).toHaveAccessibleName(/\S/);

  const tipOpacity = (sel: string) =>
    page.locator(sel).first().evaluate((el) => getComputedStyle(el, "::after").opacity);
  expect(await tipOpacity('.side a[href="/comics/runs"]'), "hidden at rest").toBe("0");

  // Tab in from the top of the page until the focus is on Runs.
  for (let n = 0; n < 20; n++) {
    await page.keyboard.press("Tab");
    if (await page.locator('.side a[href="/comics/runs"]').evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.locator('.side a[href="/comics/runs"]')).toBeFocused();
  // At once: no hover delay on :focus-visible.
  await expect.poll(() => tipOpacity('.side a[href="/comics/runs"]'), { timeout: 500 }).toBe("1");
});

test("at 1280 the sidebar is 224px with labels, and no tooltip", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 1280);
  await page.goto("/comics");
  expect((await page.locator(".side").boundingBox())!.width).toBe(224);
  await expect(page.locator('.side a[href="/comics/runs"] .nl')).toBeVisible();
  const tip = await page.locator('.side a[href="/comics/runs"]').evaluate((el) => getComputedStyle(el, "::after").display);
  expect(tip, "tooltips are hidden at rest").toBe("none");
});

test("at 1440 the content box is 1056px, centred in the space beside the sidebar", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 1440);
  await page.goto("/comics");
  const side = (await page.locator(".side").boundingBox())!;
  const box = (await page.locator(".content").boundingBox())!;
  expect(box.width).toBe(1056);
  const space = 1440 - side.width;
  expect(box.x - side.width).toBeCloseTo((space - 1056) / 2, 0);
});

test("from 1024 no dashboard draws the in-inbox chip, and the sidebar's Inbox shows the count", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 390);
  await page.goto("/comics");
  await expect(page.locator(".inbox-chip")).toBeVisible();
  await expect(page.locator(".inbox-chip")).toContainText(`${E2E_INBOX_COUNT}`);

  for (const width of [1024, 1280]) {
    await size(page, width);
    await page.goto("/comics");
    // Attached (the page has streamed in) and hidden, not merely not there yet.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".inbox-chip")).toBeAttached();
    await expect(page.locator(".inbox-chip")).toBeHidden();
    const inbox = page.locator('.side a[href="/inbox"]');
    await expect(inbox).toContainText(`${E2E_INBOX_COUNT}`);
  }
});

test("at 360 Watch is untruncated in the media bar, and /comics has at most one solid brand fill above the fold", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 360, 780);
  await page.goto("/comics");
  const watch = page.locator('.bar nav a[href="/watch"]');
  await expect(watch).toHaveText("Watch");
  const fits = await watch.evaluate((el) => el.scrollWidth <= el.clientWidth);
  const box = (await watch.boundingBox())!;
  expect(fits).toBe(true);
  expect(box.x + box.width).toBeLessThanOrEqual(360);

  const brand = await colourOf(page, "--brand");
  const fills = await page.evaluate((target) =>
    [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < window.innerHeight && getComputedStyle(el).backgroundColor === target;
    }).length, brand);
  expect(fills).toBeLessThanOrEqual(1);
});

test("no colour inside .bar or .side is --ready", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await page.goto("/comics");
  const ready = await colourOf(page, "--ready");
  const hits = await page.evaluate((target) =>
    [...document.querySelectorAll(".bar, .bar *, .side, .side *")]
      .filter((el) => getComputedStyle(el).color === target).map((el) => el.outerHTML.slice(0, 80)), ready);
  expect(hits).toEqual([]);
});

// The page gets a min-height on `.app`, the shell's root, so it can scroll at all: a new class, so this has nothing to run against before the shell.
test("scrolled 400px, everything that sticks but .bar sits at or below --bar-h", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  for (const width of [390, 1280]) {
    await size(page, width, 700);
    await page.goto("/comics/runs");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
    // The seeded list is short; give the page room to scroll, as the real catalog does.
    await page.evaluate(() => { document.querySelector<HTMLElement>(".app")!.style.minHeight = "2400px"; });
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(400);
    const barH = await barHeight(page);
    const bad = await page.evaluate((min) =>
      [...document.querySelectorAll("body *")].flatMap((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== "sticky" || el.classList.contains("bar") || cs.top === "auto") return [];
        return parseFloat(cs.top) < min ? [`${el.className} top ${cs.top}`] : [];
      }), barH);
    expect(bad, `at ${width}`).toEqual([]);
    // The bar itself is the one thing stuck at the top.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    if (width < 768) expect((await page.locator(".bar").boundingBox())!.y).toBe(0);
  }
});

test("every phone route renders exactly the same media nav", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 390);
  const seen = new Set<string>();
  for (const path of ["/comics", "/comics/runs", `/comics/${E2E_RUN_ID}`, "/books/list", "/books/add", "/watch", "/inbox"]) {
    await page.goto(path);
    seen.add((await page.locator(".bar").innerHTML()).replace(/ aria-current="page"/g, ""));
  }
  expect(seen.size).toBe(1);
});

test("every enabled nav href answers: no 404, no 500", async ({ page, request }, testInfo) => {
  runsOnce(testInfo.project.name);
  // Each medium draws its own set, so the union is read from one page of each.
  const found = new Set<string>();
  for (const path of ["/comics", "/books/list", "/watch"]) {
    await page.goto(path);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".bar a, .rail a, .side a")].map((a) => a.getAttribute("href")!));
    for (const h of hrefs) found.add(h);
  }
  const hrefs = [...found];
  expect(hrefs).toEqual(expect.arrayContaining(["/", "/comics", "/books/list", "/watch", "/inbox", "/comics/runs", "/books/add", "/api/export"]));
  for (const href of hrefs) {
    const res = await request.get(href, { maxRedirects: 0 });
    expect(res.status(), href).toBeLessThan(400);
  }
});

test("the shell's landmarks, links and names pass axe at each navigation form", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  for (const width of [390, 834, 1100, 1280]) {
    await size(page, width);
    await page.goto("/comics");
    await expectNoAxeViolations(page, ["link-name", "button-name", "landmark-unique", "aria-hidden-focus", "svg-img-alt"]);
  }
});

test("the sync pill: an offline strip under the phone bar, a pill at the rail's foot", async ({ page, context }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 390);
  await page.goto("/comics");
  const strip = page.locator(".sync-strip");
  await expect(strip).toBeHidden(); // empty while online
  await context.setOffline(true);
  await expect(strip).toHaveText("offline");
  await expect(strip).toHaveAttribute("role", "status");
  expect((await strip.boundingBox())!.y).toBe(await barHeight(page));
  await context.setOffline(false);
  await expect(strip).toBeHidden();

  await size(page, 834);
  await expect(page.locator(".rail .sync")).toHaveText("online");
  await context.setOffline(true);
  await expect(page.locator(".rail .sync")).toHaveText("offline");
  await context.setOffline(false);

  // The sidebar footer: a 6px dot (--ready online, --blocked offline) and --ink-2 text, as a status.
  await size(page, 1280);
  const pill = page.locator(".side .sync");
  const dot = pill.locator("i");
  const ready = await colourOf(page, "--ready");
  const blocked = await colourOf(page, "--blocked");
  const ink2 = await colourOf(page, "--ink-2");
  const look = () => dot.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor };
  });
  await expect(pill).toBeVisible();
  await expect(pill).toHaveText("online");
  await expect(pill).toHaveAttribute("role", "status");
  expect(await look()).toEqual({ w: 6, h: 6, bg: ready });
  expect(await pill.evaluate((el) => getComputedStyle(el).color)).toBe(ink2);
  await context.setOffline(true);
  await expect(pill).toHaveText("offline");
  expect(await look()).toEqual({ w: 6, h: 6, bg: blocked });
  expect(await pill.evaluate((el) => getComputedStyle(el).color)).toBe(ink2);
  await context.setOffline(false);
});

test("the .bar wordmark is a link of at least 24 by 24", async ({ page }, testInfo) => {
  runsOnce(testInfo.project.name);
  await size(page, 360);
  await page.goto("/comics");
  const home = page.locator(".bar a.home");
  await expect(home).toHaveAttribute("href", "/");
  const box = (await home.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
});

test.describe("reduced transparency", () => {
  // Playwright has no option for it; the DevTools protocol does, in Chromium (the only browser here).
  test("glass falls back to solid --surface", async ({ page, context }, testInfo) => {
    test.skip(!["w390-light", "w390-dark"].includes(testInfo.project.name), "once per theme");
    await size(page, 390);
    await page.goto("/comics");
    const surface = await page.evaluate(() => {
      const probe = document.createElement("i");
      probe.style.backgroundColor = "var(--surface)";
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    });
    const glass = await page.locator(".bar").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(glass, "translucent at rest").not.toBe(surface);

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await expect.poll(() => page.locator(".bar").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
    await size(page, 1280);
    expect(await page.locator(".side").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
    expect(await page.locator(".side").evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
    // PR evidence: each dashboard with the glass solid, at the phone and the desktop width.
    for (const width of [390, 1280]) {
      await size(page, width);
      for (const path of DASHBOARDS) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await screenshot(page, testInfo, `reduced-transparency-${width}${path.replace("/", "-")}`);
      }
    }
  });
});

test.describe("/watch (AC-5)", () => {
  test("renders in the shell with one h1 and a slate whose one action is Save to inbox", async ({ page }, testInfo) => {
    runsOnce(testInfo.project.name);
    await page.goto("/watch");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Watch");
    const slate = page.locator(".slate");
    await expect(slate).toContainText("Nothing to watch yet");
    await expect(slate.getByRole("link")).toHaveCount(1);
    await expect(slate.getByRole("link", { name: "Save to inbox" })).toHaveAttribute("href", "/inbox");
    await expect(page.locator(".actionbar")).toBeVisible();
  });

  test("visiting it sets the last-medium cookie, and / then redirects to it", async ({ page }, testInfo) => {
    runsOnce(testInfo.project.name);
    await page.goto("/watch");
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/watch");
    // Put the profile back where other specs expect it.
    await page.goto("/comics");
  });

  test("the media bar's Watch link goes there", async ({ page }, testInfo) => {
    runsOnce(testInfo.project.name);
    await size(page, 390);
    await page.goto("/comics");
    await page.locator('.bar nav a[href="/watch"]').click();
    await page.waitForURL("**/watch");
    await expect(page.locator('.bar nav a[href="/watch"]')).toHaveAttribute("aria-current", "page");
  });
});
