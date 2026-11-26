// @area: shared
// Task 1.8: the app shell in a real browser. A media bar on the phone, a rail on
// a tablet, a sidebar on desktop, all drawn from one NAV_ITEMS list. The checks
// that need no layout of the project's own set their viewport and run once
// (the w390-light project); the screenshots and the sideways-scroll check run
// at every width, light and dark, and under reduced motion.
import { expect, test, type Page } from "@playwright/test";
import { NAV_ITEMS } from "../../src/components/nav/items";
import { testSql } from "../db";
import {
  E2E_INBOX_COUNT, E2E_LONG_RUN_ID, E2E_RUN_ID, FLOOR, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot,
} from "./helpers";

// Sets its own viewport: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const DASHBOARDS = ["/comics", "/books", "/watch"];
// Every built medium, from the list the sheet draws: a fourth medium (9.0) is covered without editing this file.
const MEDIA = NAV_ITEMS.filter((i) => i.group === "media" && i.enabled);

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
    test(`${path} fits the width and is drawn (AC-1, AC-4)`, FLOOR, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoHorizontalScroll(page);
      await screenshot(page, testInfo, `shell${path.replace("/", "-")}`);
    });
  }

  test("the run page fits the width, its Resume, Add issues and ⋯ row too, with a long label", FLOOR, async ({ page }) => {
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

test("no horizontal scroll at 360, 768, 834 and 1280, with a screenshot of each", ONCE, async ({ page }, testInfo) => {
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

test("at 768 and 834 the rail shows with its labels, and no media bar or sidebar", ONCE, async ({ page }) => {
  for (const width of [768, 834]) {
    await size(page, width);
    for (const path of DASHBOARDS) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
      await expect(page.locator(".rail")).toBeVisible();
      await expect(page.locator(".bar")).toBeHidden();
      await expect(page.locator(".side")).toBeHidden();

      // The medium's items, the pages across media and the foot are 56px targets; the well's media are
      // 58 × 46 (6.25, A8). Every one shows its name.
      const items = page.locator(".rail .ri");
      expect(await items.count()).toBeGreaterThan(3);
      for (const [list, min] of [[items, 56], [page.locator(".rail .rw"), 46]] as const) {
        for (const item of await list.all()) {
          const box = (await item.boundingBox())!;
          expect(box.height, `${await item.textContent()} at ${width}`).toBeGreaterThanOrEqual(min);
          expect((await item.textContent())?.trim().length, "a visible text label").toBeGreaterThan(0);
          await expect(item.locator(".rl")).toBeVisible();
        }
      }
      // 48px targets with 12px above and below, and the glass edge's 1px (task 1.8b, STYLE_GUIDE §14.5).
      const bar = (await page.locator(".actionbar").boundingBox())!;
      expect(bar.height, `${path} .actionbar at ${width}`).toBe(73);
      for (const control of await page.locator(".actionbar .btn, .actionbar .iconbtn").all()) {
        expect((await control.boundingBox())!.height, `${path} control at ${width}`).toBe(48);
      }
    }
  }
});

test("the page names no external host for an icon, a font or a script, and icons in buttons are hidden", ONCE, async ({ page }) => {
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

test("at 1100 the sidebar is a 64px icon rail: every item named, its tooltip hidden until focus", ONCE, async ({ page }) => {
  await size(page, 1100);
  await page.goto("/comics");
  await expect(page.locator(".side")).toBeVisible();
  await expect(page.locator(".rail")).toBeHidden();
  expect((await page.locator(".side").boundingBox())!.width).toBe(64);

  // What the icon rail draws (the media list is the 1280px sidebar's, hidden here).
  const links = page.locator(".side a, .side button").locator("visible=true");
  expect(await links.count()).toBeGreaterThan(5);
  for (const link of await links.all()) await expect(link).toHaveAccessibleName(/\S/);

  // Runs by its label: comics Add shares its href until you add to a run (1.19).
  const tipOpacity = (sel: string) =>
    page.locator(sel).first().evaluate((el) => getComputedStyle(el, "::after").opacity);
  expect(await tipOpacity('.side a[data-tip="Runs"]'), "hidden at rest").toBe("0");

  // Tab in from the top of the page until the focus is on Runs.
  for (let n = 0; n < 20; n++) {
    await page.keyboard.press("Tab");
    if (await page.locator('.side a[data-tip="Runs"]').evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.locator('.side a[data-tip="Runs"]')).toBeFocused();
  // At once: no hover delay on :focus-visible.
  await expect.poll(() => tipOpacity('.side a[data-tip="Runs"]'), { timeout: 500 }).toBe("1");
});

test("at 1280 the sidebar is 224px with labels, and no tooltip", ONCE, async ({ page }) => {
  await size(page, 1280);
  await page.goto("/comics");
  expect((await page.locator(".side").boundingBox())!.width).toBe(224);
  await expect(page.locator('.side a[data-tip="Runs"] .nl')).toBeVisible();
  const tip = await page.locator('.side a[data-tip="Runs"]').evaluate((el) => getComputedStyle(el, "::after").display);
  expect(tip, "tooltips are hidden at rest").toBe("none");
});

test("at 1440 the content box is 1056px, centred in the space beside the sidebar", ONCE, async ({ page }) => {
  await size(page, 1440);
  await page.goto("/comics");
  const side = (await page.locator(".side").boundingBox())!;
  const box = (await page.locator(".content").boundingBox())!;
  expect(box.width).toBe(1056);
  const space = 1440 - side.width;
  expect(box.x - side.width).toBeCloseTo((space - 1056) / 2, 0);
});

test("from 1024 no dashboard draws the in-inbox chip, and the sidebar's Inbox shows the count", ONCE, async ({ page }) => {
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

test("at 360 the medium button names each medium untruncated, and /comics has at most one solid brand fill above the fold", ONCE, async ({ page }) => {
  await size(page, 360, 780);
  // Comics is the longest name the bar is measured with (STYLE_GUIDE §17.1).
  for (const media of MEDIA) {
    await page.goto(media.href);
    const name = page.locator(".bar .medbtn .medbtn-name");
    await expect(name).toHaveText(media.label);
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth), media.label).toBe(true);
    const box = (await page.locator(".bar .medbtn").boundingBox())!;
    expect(box.x + box.width, media.label).toBeLessThanOrEqual(360);
  }
  await page.goto("/comics");

  const brand = await colourOf(page, "--brand");
  const fills = await page.evaluate((target) =>
    [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < window.innerHeight && getComputedStyle(el).backgroundColor === target;
    }).length, brand);
  expect(fills).toBeLessThanOrEqual(1);
});

test("no colour inside .bar or .side is --ready", ONCE, async ({ page }) => {
  await page.goto("/comics");
  const ready = await colourOf(page, "--ready");
  const hits = await page.evaluate((target) =>
    [...document.querySelectorAll(".bar, .bar *, .side, .side *")]
      .filter((el) => getComputedStyle(el).color === target).map((el) => el.outerHTML.slice(0, 80)), ready);
  expect(hits).toEqual([]);
});

// The page gets a min-height on `.app`, the shell's root, so it can scroll at all: a new class, so this has nothing to run against before the shell.
test("scrolled 400px, everything that sticks but .bar sits at or below --bar-h", ONCE, async ({ page }) => {
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
        // From 1024px .bar is gone and the dashboard's page header is the band at the top (task 1.8b).
        if (el.classList.contains("pagehead")) return [];
        return parseFloat(cs.top) < min ? [`${el.className} top ${cs.top}`] : [];
      }), barH);
    expect(bad, `at ${width}`).toEqual([]);
    // The bar itself is the one thing stuck at the top.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    if (width < 768) expect((await page.locator(".bar").boundingBox())!.y).toBe(0);
  }
});

test("every phone route renders exactly the same bar but for the medium it names", ONCE, async ({ page }) => {
  await size(page, 390);
  const seen = new Set<string>();
  for (const path of ["/comics", "/comics/runs", `/comics/${E2E_RUN_ID}`, "/books/list", "/books/add", "/watch", "/inbox"]) {
    await page.goto(path);
    await hydrated(page.locator(".bar .medbtn"));
    // The tab row (2.2i) differs by medium and screen on purpose; tab-row.spec.ts covers it. The
    // medium button names the medium (6.25); its own tests are below.
    seen.add(await page.locator(".bar").evaluate((bar) => {
      const copy = bar.cloneNode(true) as HTMLElement;
      copy.querySelector(".tabrow")?.remove();
      const medium = copy.querySelector(".medbtn")!;
      medium.removeAttribute("data-medium");
      medium.removeAttribute("aria-label");
      medium.querySelector(".medbtn-name")!.textContent = "";
      return copy.innerHTML;
    }).then((html) => html.replace(/ aria-current="page"/g, "")));
  }
  expect(seen.size).toBe(1);
});

test("every enabled nav href answers: no 404, no 500", ONCE, async ({ page, request }) => {
  // Each medium draws its own set, so the union is read from one page of each.
  const found = new Set<string>();
  for (const path of ["/comics", "/books/list", "/watch"]) {
    await page.goto(path);
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll(".bar a, .rail a, .side a")].map((a) => a.getAttribute("href")!));
    for (const h of hrefs) found.add(h);
  }
  const hrefs = [...found];
  expect(hrefs).toEqual(expect.arrayContaining(["/", "/comics", "/books/list", "/watch", "/inbox", "/comics/runs", "/books/add", "/settings"]));
  for (const href of hrefs) {
    const res = await request.get(href, { maxRedirects: 0 });
    expect(res.status(), href).toBeLessThan(400);
  }
});

test("the shell's landmarks, links and names pass axe at each navigation form", ONCE, async ({ page }) => {
  for (const width of [390, 834, 1100, 1280]) {
    await size(page, width);
    await page.goto("/comics");
    await expectNoAxeViolations(page, ["link-name", "button-name", "landmark-unique", "aria-hidden-focus", "svg-img-alt"]);
  }
});

test("the sync pill: an offline strip under the phone bar, a pill at the rail's foot", ONCE, async ({ page, context }) => {
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

test("the .bar wordmark is a link of at least 24 by 24", ONCE, async ({ page }) => {
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
  // Once per theme.
  test("glass falls back to solid --surface", { tag: ["@at-w390-light", "@at-w390-dark"] }, async ({ page, context }, testInfo) => {
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
  test("renders in the shell with one h1 and a slate whose one action, Save to inbox, is the thumb bar's", ONCE, async ({ page }) => {
    await page.goto("/watch");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Watch");
    const slate = page.locator(".slate");
    await expect(slate).toContainText("Nothing to watch yet");
    // The bar carries the verb, so the slate does not repeat it (task 1.8b).
    await expect(slate.getByRole("link")).toHaveCount(0);
    const bar = page.locator(".actionbar");
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Save to inbox" })).toHaveAttribute("href", "/inbox");
  });

  test("visiting it sets the last-medium cookie, and / then redirects to it", ONCE, async ({ page }) => {
    await page.goto("/watch");
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe("/watch");
    // Put the profile back where other specs expect it.
    await page.goto("/comics");
  });

  test("the Switch medium sheet's Watch row goes there", { tag: ["@at-w390-light", "@critical"] }, async ({ page }) => {
    await size(page, 390);
    await page.goto("/comics");
    const button = page.locator(".bar .medbtn");
    await hydrated(button);
    await button.click();
    await page.getByRole("dialog", { name: "Switch medium" }).getByRole("link", { name: "Watch" }).click();
    await page.waitForURL("**/watch");
    await expect(button).toHaveAccessibleName("Watch, switch medium");
    await page.goto("/comics"); // the last-medium cookie back where other specs expect it
  });
});

// Roadmap 6.25 (D-178, MR-D1, MR-D2, frames A5–A7): on the phone the bar names the current medium as a
// button that opens Switch medium, search sits left of the gear, and the thumb bar has no search slot.
test.describe("the phone's medium button, search and gear (6.25)", () => {
  // Light and dark: the same checks once in each theme's 390 project, at the widths they set.
  const THEMES = { tag: ["@at-w390-light", "@at-w390-dark"] };
  const button = (page: Page) => page.locator(".bar .medbtn");
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Switch medium" });
  /** Each element of the open sheet whose animation or transition lasts longer than 0s: "class kind duration". */
  const motion = (page: Page) => page.locator(".sheet-host").evaluate((host) =>
    [host, ...host.querySelectorAll("*")].flatMap((el) => {
      const cs = getComputedStyle(el);
      const long = (list: string) => list.split(",").map((d) => d.trim()).filter((d) => parseFloat(d) > 0);
      const name = (el.getAttribute("class") ?? el.tagName.toLowerCase()).split(" ")[0];
      return [
        ...long(cs.animationDuration).filter(() => cs.animationName !== "none").map((d) => `${name} animation ${d}`),
        ...long(cs.transitionDuration).map((d) => `${name} transition ${d}`),
      ];
    }));
  const RULES = [
    "color-contrast", "link-name", "button-name", "aria-dialog-name", "aria-allowed-attr", "aria-valid-attr-value",
    "landmark-unique", "aria-hidden-focus", "svg-img-alt", "target-size", "nested-interactive",
  ];

  test("at 360 the bar is a 44px medium button, a 44px search button and the gear; its sheet lists every built medium, the current one aria-current; nothing scrolls sideways; no dashboard's thumb bar has a search slot; axe (AC-1, AC-5)", THEMES, async ({ page }, testInfo) => {
    await size(page, 360, 780);
    for (const media of MEDIA) {
      await page.goto(media.href);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
      await hydrated(button(page));
      await expect(button(page)).toHaveAccessibleName(`${media.label}, switch medium`);
      await expect(page.locator(".bar .search")).toHaveAccessibleName("Search (Ctrl K)");
      await expect(page.locator(".bar .gear")).toHaveAccessibleName("Settings");
      // Search says why it does nothing until 6.1 builds it.
      await expect(page.locator(".bar .search")).toHaveAttribute("aria-disabled", "true");
      await expect(page.locator(".bar .search")).toHaveAttribute("title", "Search isn't built yet");
      for (const [control, square] of [[button(page), false], [page.locator(".bar .search"), true], [page.locator(".bar .gear"), true]] as const) {
        const box = (await control.boundingBox())!;
        expect(box.height, `${media.label}: height`).toBeGreaterThanOrEqual(44);
        if (square) expect(box.width, `${media.label}: width`).toBeGreaterThanOrEqual(44);
        expect(box.x + box.width, `${media.label}: inside 360`).toBeLessThanOrEqual(360);
      }
      await expectNoHorizontalScroll(page);
      // The dashboard's thumb bar: the mark verb first, and no search in any slot (AC-4's clause of AC-1).
      const thumb = page.locator(".actionbar.thumb");
      await expect(thumb).toBeVisible();
      await expect(thumb.getByRole("button", { name: /search/i })).toHaveCount(0);
      await expect(thumb.getByRole("link", { name: /search/i })).toHaveCount(0);
      // The tab row ends with the divider, Inbox and Progress.
      const tail = await page.locator(".bar .tabrow").evaluate((nav) =>
        [...nav.children].slice(-3).map((el) => (el.classList.contains("tabdiv") ? "divider" : el.getAttribute("href"))));
      expect(tail, media.label).toEqual(["divider", "/inbox", "/progress"]);
      await expectNoAxeViolations(page, RULES, "header.bar");
      await screenshot(page, testInfo, `medium-bar-360${media.href.replace("/", "-")}`);

      await button(page).click();
      await expect(dialog(page)).toBeVisible();
      await expect(button(page)).toHaveAttribute("aria-expanded", "true");
      const rows = dialog(page).getByRole("link");
      await expect(rows).toHaveText(MEDIA.map((m) => m.label));
      await expect(dialog(page).locator("[aria-current]")).toHaveCount(1);
      await expect(dialog(page).locator("[aria-current]")).toHaveAttribute("href", media.href);
      for (const row of await rows.all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, RULES, ".sheet");
      await screenshot(page, testInfo, `medium-sheet-360${media.href.replace("/", "-")}`);
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
    }
    await page.goto("/comics"); // the last-medium cookie back where other specs expect it
  });

  test("from /books the button opens the sheet with focus inside; Comics goes to /comics and closes it; Esc and Back close it with focus on the button (AC-2)", ONCE, async ({ page }) => {
    await size(page, 360, 780);
    await page.goto("/books");
    await hydrated(button(page));
    await expect(button(page)).toHaveAccessibleName(/Books/);
    await expect(button(page)).toHaveAttribute("aria-haspopup", "dialog");
    await expect(button(page)).toHaveAttribute("aria-expanded", "false");
    const focusInside = () => dialog(page).evaluate((d) => d.contains(document.activeElement));

    // Esc closes it, and focus returns to the button.
    await button(page).click();
    await expect(dialog(page)).toBeVisible();
    expect(await focusInside()).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(button(page)).toBeFocused();
    await expect(button(page)).toHaveAttribute("aria-expanded", "false");

    // So does Back, without leaving /books.
    await button(page).click();
    await expect(dialog(page)).toBeVisible();
    await page.goBack();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/books$/);
    await expect(button(page)).toBeFocused();

    // Choosing Comics goes there and closes the sheet; one Back returns to /books.
    await button(page).click();
    await dialog(page).getByRole("link", { name: "Comics" }).click();
    await page.waitForURL("**/comics");
    await expect(dialog(page)).toHaveCount(0);
    await expect(button(page)).toHaveAccessibleName("Comics, switch medium");
    await page.goBack();
    await expect(page).toHaveURL(/\/books$/);
    await expect(button(page)).toHaveAccessibleName("Books, switch medium");
    await page.goto("/comics");
  });

  test("the sheet does not move under reduced motion, and screenshots of the bar and sheet at 360, 390 and 412px (AC-5)", THEMES, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [360, 390, 412]) {
      await size(page, width, 800);
      await page.goto("/books");
      await hydrated(button(page));
      await expectNoHorizontalScroll(page);
      await screenshot(page, testInfo, `medium-bar-${width}-books`);
      await button(page).click();
      await expect(dialog(page)).toBeVisible();
      // Nothing in the sheet, its scrim or its rows moves: every animation and transition lasts 0s.
      expect(await motion(page), `at ${width}`).toEqual([]);
      if (width === 360) {
        // Even a sheet given a 300ms transition doesn't move under reduced motion (globals.css stops every
        // transition and animation, UX-N01); without the preference the same probe reports it.
        const injected = await page.addStyleTag({ content: ".sheet{transition:transform 300ms ease}" });
        expect(await motion(page)).toEqual([]);
        await page.emulateMedia({ reducedMotion: "no-preference" });
        expect(await motion(page)).toContainEqual(expect.stringMatching(/^sheet transition 0\.3s/));
        await page.emulateMedia({ reducedMotion: "reduce" });
        await injected.evaluate((el) => (el as Element).remove());
        expect(await motion(page)).toEqual([]);
      }
      await screenshot(page, testInfo, `medium-sheet-${width}-books`);
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
    }
    await page.goto("/comics");
  });
});

// 6.25, 3 of 3 (TASK-149, D-178, MR-D4, MR-D5, frames A8–A10): every medium one tap away where it fits by
// name (the 834px rail, the 1280px sidebar), one switch button away where it doesn't (the 1024px icon rail).
test.describe("the tablet rail, the icon rail's menu and the sidebar (6.25)", () => {
  const THEMES = { tag: ["@at-w390-light", "@at-w390-dark"] };
  const RULES = [
    "color-contrast", "link-name", "button-name", "aria-allowed-attr", "aria-valid-attr-value", "aria-required-children",
    "aria-required-parent", "list", "listitem", "landmark-unique", "aria-hidden-focus", "svg-img-alt", "target-size",
    "nested-interactive",
  ];
  const BOOKS = NAV_ITEMS.filter((i) => i.group === "medium" && i.medium === "books" && i.enabled);
  const switchButton = (page: Page) => page.locator(".side .medswitch");
  const menu = (page: Page) => page.getByRole("menu", { name: "Switch medium" });
  const focused = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  /** The menu's elements whose animation or transition lasts longer than 0s, as the sheet's probe above. */
  const motion = (page: Page) => menu(page).evaluate((host) =>
    [host, ...host.querySelectorAll("*")].flatMap((el) => {
      const cs = getComputedStyle(el);
      const long = (list: string) => list.split(",").map((d) => d.trim()).filter((d) => parseFloat(d) > 0);
      const name = (el.getAttribute("class") ?? el.tagName.toLowerCase()).split(" ").at(-1);
      return [
        ...long(cs.animationDuration).filter(() => cs.animationName !== "none").map((d) => `${name} animation ${d}`),
        ...long(cs.transitionDuration).map((d) => `${name} transition ${d}`),
      ];
    }));
  /** Every visible control in a nav that is smaller than `min` either way: "name w×h". */
  const small = (page: Page, nav: string, min: number) => page.locator(nav).evaluate((root, m) =>
    [...root.querySelectorAll<HTMLElement>("a, button")].flatMap((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return [];
      return r.width < m || r.height < m ? [`${el.getAttribute("aria-label") ?? el.textContent?.trim()} ${r.width}×${r.height}`] : [];
    }), min);

  test("at 834 the rail's well names every built medium, Books current on /books, then a rule, Inbox and Progress; Watch opens /watch; axe (AC-1, AC-2, AC-6)", THEMES, async ({ page }, testInfo) => {
    for (const width of [768, 834]) {
      await size(page, width, 1112);
      await page.goto("/books");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); // past the skeleton
      const rail = page.locator("nav.rail");
      await expect(rail).toBeVisible();
      const well = rail.getByRole("group", { name: "Medium" });
      const media = well.getByRole("link");
      await expect(media).toHaveText(MEDIA.map((m) => m.label));
      for (const [n, m] of MEDIA.entries()) {
        await expect(media.nth(n)).toHaveAttribute("href", m.href);
        if (m.medium === "books") await expect(media.nth(n)).toHaveAttribute("aria-current", "page");
        else await expect(media.nth(n)).not.toHaveAttribute("aria-current");
        const box = (await media.nth(n).boundingBox())!;
        expect([box.width, box.height], m.label).toEqual([58, 46]);
      }
      // Top to bottom: the well, the medium's screens, a rule, Inbox and Progress; Search then Settings at the foot.
      const y = async (sel: string) => (await rail.locator(sel).first().boundingBox())!.y;
      const order = [
        await y(".rail-well"), await y('a[href="/books/add"]'), await y(".rail-rule"), await y('a[href="/inbox"]'),
        await y('a[href="/progress"]'), await y('button[aria-label="Search (Ctrl K)"]'), await y('a[href="/settings"]'),
      ];
      expect(order, `${width}: in order`).toEqual([...order].sort((a, b) => a - b));
      await expect(rail.getByRole("link", { name: /^Inbox/ })).toContainText(`${E2E_INBOX_COUNT}`);
      await expect(rail.getByRole("button", { name: "Search (Ctrl K)" })).toHaveAttribute("aria-disabled", "true");
      expect(await small(page, "nav.rail", 44), `${width}: every target`).toEqual([]);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, RULES, "nav.rail");
      await screenshot(page, testInfo, `rail-${width}-books`);
    }
    // One tap reaches another medium.
    await hydrated(page.locator("nav.rail").getByRole("link", { name: "Watch" }));
    await page.locator("nav.rail").getByRole("link", { name: "Watch" }).click();
    await page.waitForURL("**/watch");
    await expect(page.locator("nav.rail").getByRole("group", { name: "Medium" }).getByRole("link", { name: "Watch" })).toHaveAttribute("aria-current", "page");
    await page.goto("/comics"); // the last-medium cookie back where other specs expect it
  });

  test("at 1024 the switch names the medium and opens a menu of every medium: arrows move, Enter goes, Esc closes with focus back; axe (AC-1, AC-3, AC-6)", THEMES, async ({ page }, testInfo) => {
    await size(page, 1024, 768);
    await page.goto("/books");
    await hydrated(switchButton(page));
    await expect(switchButton(page)).toBeVisible();
    await expect(switchButton(page)).toHaveAccessibleName("Books, switch medium");
    await expect(switchButton(page)).toHaveAttribute("aria-haspopup", "menu");
    await expect(switchButton(page)).toHaveAttribute("aria-expanded", "false");
    const box = (await switchButton(page).boundingBox())!;
    expect([box.width, box.height]).toEqual([48, 44]);
    // The 1280px list is not drawn here; Search is an icon above the switch.
    await expect(page.locator(".side .side-media .mrow").first()).toBeHidden();
    const search = page.locator(".side").getByRole("button", { name: "Search (Ctrl K)" });
    await expect(search).toBeVisible();
    expect((await search.boundingBox())!.y).toBeLessThan(box.y);

    // Enter opens it with focus on the first medium; the arrows move and wrap.
    await switchButton(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toBeVisible();
    await expect(switchButton(page)).toHaveAttribute("aria-expanded", "true");
    const items = menu(page).getByRole("menuitem");
    await expect(items).toHaveText(MEDIA.map((m) => m.label));
    await expect(menu(page).locator("[aria-current]")).toHaveCount(1);
    await expect(menu(page).locator("[aria-current]")).toHaveAttribute("href", "/books");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    expect(await focused(page)).toBe(MEDIA[1].label);
    await page.keyboard.press("ArrowUp");
    expect(await focused(page)).toBe(MEDIA[0].label);
    await page.keyboard.press("ArrowUp");
    expect(await focused(page), "wraps to the last").toBe(MEDIA.at(-1)!.label);
    for (const item of await items.all()) expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await expectNoAxeViolations(page, RULES, ".side");
    // A full-page capture restarts the menu's entrance, and the frame would catch it half-faded: drawn
    // under reduced motion (no entrance at all), as the menu stands once open.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await screenshot(page, testInfo, "icon-rail-1024-menu");
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // Esc closes it, and focus is back on the button.
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);
    await expect(switchButton(page)).toBeFocused();
    await expect(switchButton(page)).toHaveAttribute("aria-expanded", "false");

    // Enter on Comics goes there, and the switch then names it.
    await page.keyboard.press("Enter");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("Home");
    expect(await focused(page)).toBe("Comics");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/comics");
    await expect(menu(page)).toHaveCount(0);
    await expect(switchButton(page)).toHaveAccessibleName("Comics, switch medium");
    expect(await small(page, "nav.side", 24), "every target").toEqual([]);
    await expectNoHorizontalScroll(page);
    await screenshot(page, testInfo, "icon-rail-1024-comics");
  });

  test("the menu doesn't move under reduced motion (AC-6)", THEMES, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await size(page, 1024, 768);
    await page.goto("/books");
    await hydrated(switchButton(page));
    await switchButton(page).click();
    await expect(menu(page)).toBeVisible();
    expect(await motion(page)).toEqual([]);
    // Without the preference the same probe sees the menu's entrance, so the probe can fail.
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await switchButton(page).click();
    await expect(menu(page)).toBeVisible();
    expect(await motion(page)).toContainEqual(expect.stringMatching(/^medmenu animation/));
  });

  test("at 1280 the sidebar lists every medium with Books open and its screens nested, an Across media group and Search · Ctrl K under the wordmark; axe (AC-1, AC-4, AC-6)", THEMES, async ({ page }, testInfo) => {
    await size(page, 1280, 900);
    await page.goto("/books");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const side = page.locator("nav.side");
    await expect(switchButton(page)).toBeHidden();

    // Search · Ctrl K, under the wordmark and above Media.
    const search = side.getByRole("button", { name: "Search (Ctrl K)" });
    await expect(search).toBeVisible();
    await expect(search).toContainText("Ctrl K");
    await expect(search).toHaveAttribute("title", "Search isn't built yet");
    const list = side.getByRole("list", { name: "Media" });
    const at = async (l: ReturnType<Page["locator"]>) => (await l.boundingBox())!.y;
    expect(await at(side.locator(".brand"))).toBeLessThan(await at(search));
    expect(await at(search)).toBeLessThan(await at(list));

    // Media: a row per built medium; Books open with its screens nested, the others links to their dashboards.
    const rows = list.locator(":scope > li");
    await expect(rows).toHaveCount(MEDIA.length);
    for (const [n, m] of MEDIA.entries()) {
      const row = rows.nth(n);
      if (m.medium === "books") {
        const open = row.getByRole("button", { name: "Books" });
        await expect(open).toHaveAttribute("aria-expanded", "true");
        const nested = row.getByRole("link");
        await expect(nested).toHaveText(BOOKS.map((i) => i.sideLabel ?? i.label));
        await expect(row.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
        expect((await open.boundingBox())!.height).toBe(36);
        expect((await nested.first().boundingBox())!.height).toBe(34);
        // A disclosure: it closes and opens again.
        await hydrated(open);
        await open.click();
        await expect(open).toHaveAttribute("aria-expanded", "false");
        await expect(nested.first()).toBeHidden();
        await open.click();
        await expect(open).toHaveAttribute("aria-expanded", "true");
        await expect(nested.first()).toBeVisible();
      } else {
        const link = row.getByRole("link");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAccessibleName(m.label);
        await expect(link).toHaveAttribute("href", m.href);
        await expect(link).not.toHaveAttribute("aria-expanded");
        expect((await link.boundingBox())!.height).toBe(36);
      }
    }

    // Across media: Inbox with its count, then Progress.
    const across = side.getByRole("group", { name: "Across media" });
    await expect(across.getByRole("link")).toHaveCount(2);
    await expect(across.getByRole("link").first()).toHaveAttribute("href", "/inbox");
    await expect(across.getByRole("link").first()).toContainText(`${E2E_INBOX_COUNT}`);
    await expect(across.getByRole("link").last()).toHaveAttribute("href", "/progress");
    expect(await at(list)).toBeLessThan(await at(across));

    expect(await small(page, "nav.side", 24), "every target").toEqual([]);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page, RULES, "nav.side");
    await page.mouse.move(640, 880); // off the sidebar, so no row is drawn hovered
    await screenshot(page, testInfo, "sidebar-1280-books");

    // Choosing another medium from the list opens its set there.
    await rows.nth(MEDIA.findIndex((m) => m.medium === "comics")).getByRole("link").click();
    await page.waitForURL("**/comics");
    await expect(list.getByRole("button", { name: "Comics" })).toHaveAttribute("aria-expanded", "true");
    await expect(list.getByRole("link", { name: "Books" })).toHaveAttribute("href", "/books");
  });
});

// Roadmap 1.19: comics Add lands on the run you last added to. Its own run and
// issue, so no other spec's run changes; removed again afterwards (TEST database).
const LAST_RUN = { id: "e2e-last-run", title: "ZZ E2E Last Run" };
const LAST_ISSUE = { id: "e2e-last-run-issue", label: "ZZ Last Run (2001) #1" };

async function cleanLastRun() {
  const sql = testSql();
  try {
    await sql`DELETE FROM run_issues WHERE run_id = ${LAST_RUN.id}`;
    await sql`DELETE FROM runs WHERE id = ${LAST_RUN.id}`;
    await sql`DELETE FROM issues WHERE id = ${LAST_ISSUE.id}`;
  } finally {
    await sql.end();
  }
}

test.describe("comics Add remembers the last run (1.19)", () => {
  test.beforeAll(async () => {
    await cleanLastRun();
    const sql = testSql();
    try {
      await sql`INSERT INTO runs (id, title) VALUES (${LAST_RUN.id}, ${LAST_RUN.title})`;
      await sql`INSERT INTO issues (id, label) VALUES (${LAST_ISSUE.id}, ${LAST_ISSUE.label})`;
    } finally {
      await sql.end();
    }
  });
  test.afterAll(cleanLastRun);

  const sideAdd = (page: Page) => page.locator(".side").getByRole("link", { name: "Add", exact: true });

  test("after an add, the sidebar's Add opens that run's Add issues; a run page is still Runs (AC-4)", ONCE, async ({ page }) => {
    await size(page, 1280);
    await page.goto("/comics");
    await expect(sideAdd(page)).toHaveAttribute("href", "/comics/runs"); // nothing added yet

    const target = `/comics/${LAST_RUN.id}/add`;
    await page.goto(target);
    const typeIt = page.getByRole("button", { name: "Type it" });
    await hydrated(typeIt);
    await typeIt.click();
    await page.getByLabel("One per line, ranges allowed").fill(LAST_ISSUE.label);
    await page.getByRole("button", { name: "Add 1 issue" }).click();
    await expect(page.getByText("1 issue added")).toBeVisible();
    // The nav knows at once: a client navigation never redraws the root layout.
    await expect(sideAdd(page)).toHaveAttribute("href", target);

    // A fresh load reads it back from the cookie the insert set.
    await page.goto("/comics");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(sideAdd(page)).toHaveAttribute("href", target);
    await sideAdd(page).click();
    await expect(page).toHaveURL(target);
    await expect(page.getByRole("heading", { level: 1, name: "Add issues" })).toBeVisible();
    await expect(sideAdd(page)).toHaveAttribute("aria-current", "page");

    await page.goto(`/comics/${LAST_RUN.id}`);
    const current = page.locator('.side [aria-current="page"]');
    await expect(current.filter({ hasText: "Runs" })).toHaveCount(1);
    await expect(sideAdd(page)).not.toHaveAttribute("aria-current", "page");
  });

  test("Add is a named link at least 24px tall in the rail and the sidebar, current only on Add issues (AC-5)", ONCE, async ({ page }) => {
    for (const [width, nav] of [[834, ".rail"], [1100, ".side"], [1280, ".side"]] as const) {
      await size(page, width);
      for (const [path, current] of [["/comics", false], [`/comics/${E2E_RUN_ID}/add`, true]] as const) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const add = page.locator(nav).getByRole("link", { name: "Add", exact: true });
        await expect(add, `${width} ${path}`).toBeVisible();
        expect((await add.boundingBox())!.height, `${width} ${path}`).toBeGreaterThanOrEqual(24);
        if (current) await expect(add, `${width} ${path}`).toHaveAttribute("aria-current", "page");
        else await expect(add, `${width} ${path}`).not.toHaveAttribute("aria-current", "page");
      }
      await expectNoAxeViolations(page, ["link-name", "button-name", "landmark-unique", "aria-hidden-focus", "svg-img-alt", "target-size"]);
    }
  });
});
