// @area: shared
// The mockup's 834px tablet frames follow the feel pass (task 1.8e, STYLE_GUIDE
// §14.5, Feel Review §10c): a horizontal hero, a five-cover shelf, a horizontal
// telescope with a three-column ladder, and the side rail stacked below as two
// columns. The mockup is a design file, not the app, so it is loaded with
// setContent and measured where it draws, in one project only.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SCREENS_DIR } from "./helpers";

const MOCKUP = readFileSync("design/mockups.html", "utf8");
const INDEX = readFileSync("design/mockups-index.md", "utf8");
// The four feel-pass frames (task 1.8e) with a thumb bar, then the mediums review's six (task 6.24, TASK-146):
// three sheets over a page (E12, E13, E15) and three lists (E14, E16, E17).
const THUMB = ["home", "spine", "bdash", "status"] as const;
const SHEETS = ["bookdetail", "thisorthat", "rebalance"] as const;
const LISTS = ["top", "calibre", "settings"] as const;
const SCREENS = [...THUMB, ...SHEETS, ...LISTS] as const;
type Screen = (typeof SCREENS)[number];

// The mockup is checked once.
const ONCE = { tag: "@at-w1280-light" };

async function openTab(page: Page, id: Screen, theme: "light" | "dark" = "light") {
  await page.setViewportSize({ width: 1400, height: 1100 });
  if (!page.url().startsWith("about:") || !(await page.locator("section.screen").count())) {
    await page.setContent(MOCKUP, { waitUntil: "load" });
  }
  await page.evaluate(
    ([screen, t]) => {
      document.body.dataset.vp = "tab";
      document.querySelectorAll("section.screen").forEach((s) => s.classList.toggle("on", (s as HTMLElement).dataset.id === screen));
      document.querySelectorAll<HTMLElement>(".app").forEach((a) => { a.dataset.theme = t; });
    },
    [id, theme] as const,
  );
  return page.locator(`section.screen[data-id="${id}"] .frame[data-w="tab"]`).first();
}

type Box = { x: number; y: number; width: number; height: number };
async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error(`no box for ${l}`);
  return b;
}

// The source of the four tab frames' markup, and the tablet CSS block.
function tabMarkup(id: Screen): string {
  return frameMarkup(id, "tab");
}
// The source of one screen's frame of a width (`phone`, `p360`, `tab`, `desk`), the first one.
function frameMarkup(id: Screen, w: string): string {
  // The section's own tag: `data-id="status"` also appears first in a CSS selector.
  const start = MOCKUP.search(new RegExp(`<section class="screen[^"]*" data-id="${id}">`));
  expect(start, `${id} is a screen`).toBeGreaterThan(-1);
  const open = MOCKUP.indexOf(`<div class="frame" data-w="${w}">`, start);
  expect(open, `${id} has a ${w} frame`).toBeGreaterThan(start);
  const ends = ['<div class="frame"', '<div class="notes">'].map((s) => MOCKUP.indexOf(s, open + 10)).filter((i) => i > -1);
  return MOCKUP.slice(open, Math.min(...ends));
}
const TAB_CSS = (() => {
  const start = MOCKUP.indexOf("/* ══ Task 1.8 — the 360px and 834px frames");
  return MOCKUP.slice(start, MOCKUP.indexOf("</style>", start));
})();

test.describe("AC-1, AC-2 · every 834 frame", ONCE, () => {
  for (const id of SCREENS) {
    test(`${id}: no sideways scroll and a 72px rail`, async ({ page }) => {
      const f = await openTab(page, id);
      const m = await f.locator(".frame-in").evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      expect(m.cw).toBeGreaterThan(800);
      expect(m.sw).toBe(m.cw);
      expect((await box(f.locator(".rail"))).width).toBe(72);
    });
  }

  for (const id of THUMB) {
    test(`${id}: a thumb bar of 48px controls`, async ({ page }) => {
      const f = await openTab(page, id);
      // 48px controls with 12px above and below (task 1.8b, D-78), as the real bar is.
      expect((await box(f.locator(".actionbar .btn").first())).height).toBe(48);
      expect((await box(f.locator(".actionbar"))).height).toBeGreaterThanOrEqual(72);
    });
  }
});

test.describe("AC-1, AC-2 · home", ONCE, () => {
  test("the hero's 150 × 225 cover sits beside the number, run and lens", async ({ page }) => {
    const f = await openTab(page, "home");
    const cover = await box(f.locator(".tb-hero .tb-cv.hero"));
    expect(cover.width).toBe(150);
    expect(cover.height).toBe(225);
    for (const sel of [".tb-num", ".tb-run", ".tb-lens"]) {
      const b = await box(f.locator(`.tb-hero ${sel}`));
      expect(cover.x + cover.width, `${sel} is right of the cover`).toBeLessThan(b.x);
      expect(b.y < cover.y + cover.height && b.y + b.height > cover.y, `${sel} overlaps the cover vertically`).toBe(true);
    }
  });

  test("the Up next shelf shows five covers on one row, 16px apart", async ({ page }) => {
    const f = await openTab(page, "home");
    const col = await box(f.locator(".wrap"));
    const cards = f.locator(".tb-shelf > [role=listitem]");
    await expect(cards).toHaveCount(5);
    const boxes = await Promise.all([0, 1, 2, 3, 4].map((i) => box(cards.nth(i).locator(".tb-cv"))));
    for (const b of boxes) {
      expect(b.y).toBe(boxes[0].y);
      expect(b.x + b.width, "the cover is in view").toBeLessThanOrEqual(col.x + col.width);
    }
    for (let i = 1; i < 5; i++) {
      expect(Math.abs(boxes[i].x - (boxes[i - 1].x + boxes[i - 1].width) - 16)).toBeLessThanOrEqual(1);
    }
  });

  test("Since Tuesday and Also reading share one row", async ({ page }) => {
    const f = await openTab(page, "home");
    const since = await box(f.locator(".tb-since"));
    const also = await box(f.locator(".tb-also"));
    expect(also.y).toBe(since.y);
    expect(also.x).toBeGreaterThanOrEqual(since.x + since.width);
  });

  test("the telescope is horizontal, with its ladder in three columns", async ({ page }) => {
    const f = await openTab(page, "home");
    for (const rail of ["track", "block"]) {
      const cells = f.locator(`.tb-tele [data-rail="${rail}"] .tb-cell`);
      const n = await cells.count();
      expect(n, `${rail} has cells`).toBeGreaterThan(2);
      const bs = await Promise.all([...Array(n).keys()].map((i) => box(cells.nth(i))));
      for (let i = 1; i < n; i++) {
        expect(bs[i].y, `${rail} cells share a row`).toBe(bs[0].y);
        expect(bs[i].x, `${rail} cells run left to right`).toBeGreaterThan(bs[i - 1].x);
      }
    }
    const track = await box(f.locator('.tb-tele [data-rail="track"]'));
    const run = await box(f.locator('.tb-tele [data-rail="run"]'));
    expect(run.y, "the run rail is below the track rail").toBeGreaterThan(track.y);
    expect(run.width).toBeGreaterThan(run.height * 10);

    const items = f.locator(".tb-ladder > [role=listitem]");
    await expect(items).toHaveCount(3);
    const ls = await Promise.all([0, 1, 2].map((i) => box(items.nth(i))));
    expect(new Set(ls.map((b) => b.y)).size).toBe(1);
    expect(new Set(ls.map((b) => b.x)).size).toBe(3);
  });
});

test.describe("AC-1, AC-2 · the side rail", ONCE, () => {
  for (const [id, main, names] of [
    ["home", ".tb-telecard", ["Ready when you are", "2026 so far"]],
    ["bdash", ".tb-quarter", ["On deck", "2026 so far"]],
  ] as const) {
    test(`${id}: ${names.join(" | ")} sit below the main column, 1.5 : 1`, async ({ page }) => {
      const f = await openTab(page, id);
      const blocks = f.locator(".tb-aside > section");
      await expect(blocks).toHaveCount(2);
      await expect(blocks.nth(0)).toContainText(names[0]);
      await expect(blocks.nth(1)).toContainText(names[1]);
      const [a, b] = await Promise.all([box(blocks.nth(0)), box(blocks.nth(1))]);
      expect(b.y).toBe(a.y);
      expect(b.x).toBeGreaterThan(a.x + a.width);
      expect(Math.abs(a.width / b.width - 1.5) / 1.5).toBeLessThanOrEqual(0.02);
      const last = await box(f.locator(main));
      expect(a.y, "below the main column").toBeGreaterThanOrEqual(last.y + last.height);
    });
  }
});

test.describe("AC-3 · the telescope is no longer capped", ONCE, () => {
  test("no tablet rule caps svg.tele at 344px", () => {
    expect(TAB_CSS).not.toMatch(/svg\.tele\{[^}]*max-width:344px/);
    expect(TAB_CSS).not.toContain("A phone-sized drawing stays phone-sized");
  });

  test("home's telescope is wider than 344px and no wider than its card", async ({ page }) => {
    const f = await openTab(page, "home");
    const tele = await box(f.locator(".tb-tele"));
    const card = await box(f.locator(".tb-telecard"));
    expect(tele.width).toBeGreaterThan(344);
    expect(tele.x).toBeGreaterThanOrEqual(card.x);
    expect(tele.x + tele.width).toBeLessThanOrEqual(card.x + card.width);
  });
});

test.describe("AC-1, AC-4 · design/mockups-index.md", ONCE, () => {
  const section = (heading: string) => {
    const start = INDEX.indexOf(heading);
    expect(start, heading).toBeGreaterThan(-1);
    const next = INDEX.slice(start + heading.length).search(/\n#{2,3} /);
    return INDEX.slice(start, next < 0 ? undefined : start + heading.length + next);
  };

  test("the four screens still list their 834px frames", () => {
    for (const id of THUMB) {
      const row = INDEX.split("\n").find((l) => l.startsWith(`| \`${id}\` |`));
      expect(row, id).toBeDefined();
      expect(row).toMatch(/834px frames/);
    }
  });

  test("Viewport frames says the 834 bodies follow the feel pass", () => {
    const note = section("### Viewport frames");
    expect(note).not.toMatch(/not redrawn/);
    expect(note).not.toMatch(/the phone's, reflowed/);
    expect(note).toMatch(/§ ?14\.5/);
    expect(note).toMatch(/§ ?10c/);
  });

  test("the feel-pass table no longer lists §10c as superseding home", () => {
    const table = section("## Oct 2026, feel pass");
    const row = table.split("\n").find((l) => l.startsWith("| `home` |"));
    expect(row).toBeDefined();
    expect(row).not.toMatch(/10c/);
  });
});

test.describe("AC-5 · the UX floor in the ten frames", ONCE, () => {
  // Colour lives in style attributes, presentation attributes and CSS rules;
  // a label like #141 in text is not a colour. Percent-encoded image data
  // (%23394049) is the spine's cover art, not styling.
  const HEX = /(?<![&%\w])#[0-9a-f]{3,8}\b/i;
  const styling = (html: string) =>
    [...html.matchAll(/\s(?:style|fill|stroke|color|stop-color)="([^"]*)"/g)].map((m) => m[1]);

  test("no literal hex and no --danger in the markup or the tablet rules", () => {
    for (const id of SCREENS) {
      const html = tabMarkup(id);
      for (const s of styling(html)) expect(s, `${id}: ${s}`).not.toMatch(HEX);
      expect(html, id).not.toContain("--danger");
    }
    const rules = TAB_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rules).not.toMatch(HEX);
    expect(rules).not.toContain("--danger");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: nothing resolves to --danger, fonts follow D-32, targets and names hold`, async ({ page }) => {
      test.setTimeout(120_000); // ten frames, each a computed-style walk and an axe run
      for (const id of SCREENS) {
        const f = await openTab(page, id, theme);
        const report = await f.evaluate((frame) => {
          const app = frame.querySelector(".app") as HTMLElement;
          const probe = document.createElement("i");
          probe.style.color = "var(--danger)";
          app.append(probe);
          const danger = getComputedStyle(probe).color;
          probe.remove();
          const red: string[] = [];
          const display: string[] = [];
          const small: string[] = [];
          const name = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
          for (const el of frame.querySelectorAll("*")) {
            const cs = getComputedStyle(el);
            if (cs.display === "none" || cs.visibility === "hidden") continue;
            const paints = [cs.color, cs.backgroundColor, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor,
              cs.borderRightColor, cs.outlineColor, cs.fill, cs.stroke, cs.boxShadow, cs.backgroundImage];
            if (paints.some((p) => p.includes(danger))) red.push(name(el));
            const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim() !== "");
            if (ownText && cs.fontFamily.startsWith('"Newsreader"') &&
              !el.closest("h1.t, .tb-name, .tb-story, .hero .name, .rail-word, .dsheet .fsh")) display.push(name(el));
            if (el.matches("a[href], button, [tabindex]:not([tabindex='-1'])") && el.closest(".tabmain, .dsheet")) {
              const r = el.getBoundingClientRect();
              if (r.width < 24 || r.height < 24) small.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
          }
          const counts = [...frame.querySelectorAll(".tb-n, .tabmain .rm, .tabmain .seg .n, .tabmain .ct")]
            .filter((el) => !getComputedStyle(el).fontFamily.startsWith('"IBM Plex Mono"')).map(name);
          // Text on a filled control is its --on-* colour, the count included (axe misses this one).
          const onFill = [...frame.querySelectorAll(".tabmain .seg span[data-on] *")]
            .filter((el) => getComputedStyle(el).color !== getComputedStyle(el.closest("[data-on]")!).color).map(name);
          return { danger, red, display, small, counts, onFill, nCounts: frame.querySelectorAll(".tb-n").length };
        });
        expect.soft(report.onFill, `${id}: text on a filled tab not in its --on-* colour`).toEqual([]);
        expect.soft(report.red, `${id}: resolves to --danger ${report.danger}`).toEqual([]);
        expect.soft(report.display, `${id}: Newsreader outside the title, hero names and sheet titles`).toEqual([]);
        expect.soft(report.small, `${id}: interactive under 24px`).toEqual([]);
        expect.soft(report.counts, `${id}: counts not in Plex Mono`).toEqual([]);
        if (id === "home" || id === "bdash") expect(report.nCounts, `${id} marks its counts`).toBeGreaterThan(5);

        const axe = await new AxeBuilder({ page })
          .include(`section.screen[data-id="${id}"] .frame[data-w="tab"] .tabmain`)
          .include(`section.screen[data-id="${id}"] .frame[data-w="tab"] .dsheet`)
          .withRules(["button-name", "link-name", "color-contrast", "aria-required-children", "aria-required-parent", "aria-allowed-attr"])
          .analyze();
        expect.soft(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${id} axe`).toEqual([]);
      }
    });
  }

  test("screenshots of the ten 834 frames, light and dark", async ({ page }, testInfo) => {
    const dir = join(SCREENS_DIR, testInfo.project.name);
    mkdirSync(dir, { recursive: true });
    for (const theme of ["light", "dark"] as const) {
      for (const id of SCREENS) {
        const f = await openTab(page, id, theme);
        const file = join(dir, `mockup-tab-${id}-${theme}.png`);
        await f.screenshot({ path: file });
        expect(readFileSync(file).length).toBeGreaterThan(10_000);
      }
    }
  });
});

// ══ Task 6.24, 4 of 4 (TASK-146): the mediums review's six 834px frames, E12 to E17, and the settings frame (E11, E17) ══
test.describe("AC-1, AC-2 · the three sheets (E12, E13, E15)", ONCE, () => {
  for (const id of SHEETS) {
    test(`${id}: a 640px dialogue centred over the content column, the scrim over the column and the rail`, async ({ page }) => {
      const f = await openTab(page, id);
      await expect(f.locator('.dsheet[role="dialog"][aria-modal="true"]')).toHaveCount(1);
      const sheet = await box(f.locator(".dsheet"));
      const col = await box(f.locator(".tabmain"));
      const rail = await box(f.locator(".rail"));
      const scrim = await box(f.locator(".scrim"));
      const app = await box(f.locator(".app"));
      expect(sheet.width).toBe(640);
      expect(Math.abs(sheet.x + sheet.width / 2 - (col.x + col.width / 2))).toBeLessThanOrEqual(1);
      expect(sheet.y + sheet.height, "the sheet rests on the frame's foot").toBeLessThanOrEqual(app.y + app.height + 1);
      expect(sheet.x, "the sheet leaves the rail uncovered").toBeGreaterThanOrEqual(rail.x + rail.width);
      expect(scrim.x).toBeLessThanOrEqual(rail.x);
      expect(Math.abs(scrim.width - app.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(scrim.height - app.height)).toBeLessThanOrEqual(1);
      // The sheet's title is the dialogue's name.
      const name = await f.locator(".dsheet").getAttribute("aria-label");
      await expect(f.locator(".dsheet .fsh")).toHaveText(name!);
    });
  }

  test("bookdetail and thisorthat are over the Library, rebalance over Plan", async ({ page }) => {
    for (const [id, title] of [["bookdetail", "Library"], ["thisorthat", "Library"], ["rebalance", "Plan"]] as const) {
      const f = await openTab(page, id);
      await expect(f.locator(".tabmain h1.t")).toHaveText(title);
    }
  });
});

test.describe("AC-1, AC-2 · the three lists (E14, E16, E17)", ONCE, () => {
  for (const id of LISTS) {
    test(`${id}: the column is padded 32px, the title 40/44`, async ({ page }) => {
      const f = await openTab(page, id);
      const wrap = await f.locator(".tabmain .wrap").first().evaluate((e) => {
        const cs = getComputedStyle(e);
        return { l: cs.paddingLeft, r: cs.paddingRight };
      });
      expect(wrap).toEqual({ l: "32px", r: "32px" });
      const t = await f.locator("h1.t").evaluate((e) => ({ fs: getComputedStyle(e).fontSize, lh: getComputedStyle(e).lineHeight }));
      expect(t).toEqual({ fs: "40px", lh: "44px" });
    });
  }

  test("calibre's back link says Settings; top has Not ranked yet below the top ten", async ({ page }) => {
    const c = await openTab(page, "calibre");
    await expect(c.getByRole("link", { name: /Settings/ }).first()).toBeVisible();
    const t = await openTab(page, "top");
    await expect(t.getByRole("heading", { name: /Not ranked yet/ })).toBeVisible();
  });

  test("settings at 834: Reading pace and Appearance side by side, Parked and Data full width below", async ({ page }) => {
    const f = await openTab(page, "settings");
    const h = (name: string) => box(f.getByRole("heading", { name, exact: true }));
    const [pace, look, parked, data] = [await h("Reading pace"), await h("Appearance"), await h("Parked"), await h("Data")];
    expect(look.y).toBe(pace.y);
    expect(look.x).toBeGreaterThan(pace.x + 200);
    const wrap = await box(f.locator(".tabmain .wrap").first());
    for (const g of [parked, data]) {
      expect(g.y, "below the pair").toBeGreaterThan(pace.y + 100);
      expect(g.x).toBe(pace.x);
    }
    expect(data.y).toBeGreaterThan(parked.y);
    // The full-width groups run the column's width.
    const widths = await f.locator(".tabmain .group").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
    expect(Math.max(...widths)).toBeGreaterThanOrEqual(wrap.width - 64 - 1);
    // Every row the phone frame has stays (owner, at plan): its row labels are all in the 834 frame.
    const labels = [...frameMarkup("settings", "phone").matchAll(/<span class="k"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThan(10);
    for (const l of labels) await expect(f.locator(".tabmain").getByText(l, { exact: true }).first(), l).toBeVisible();
  });
});

test.describe("AC-1 · settings' steppers, typed and held (E11, MR-D18)", ONCE, () => {
  test("none carries an inline background; one is typed, one held with a 1.5px --brand ring, the rest at rest", async ({ page }) => {
    for (const w of ["phone", "tab"] as const) {
      const html = frameMarkup("settings", w);
      for (const tag of html.match(/<span class="stepper"[^>]*>/g) ?? []) expect(tag, `${w}: ${tag}`).not.toMatch(/background/);
    }
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.setContent(MOCKUP, { waitUntil: "load" });
    await page.evaluate(() => {
      document.body.dataset.vp = "phone";
      document.querySelectorAll("section.screen").forEach((s) => s.classList.toggle("on", (s as HTMLElement).dataset.id === "settings"));
    });
    const f = page.locator('section.screen[data-id="settings"] .frame[data-w="phone"]');
    await expect(f.locator(".stepper")).toHaveCount(3);
    await expect(f.locator(".stepper input.val")).toHaveCount(1);
    await expect(f.locator(".stepper b[data-held]")).toHaveCount(1);
    await expect(f.locator(".stepper button.val")).toHaveCount(2);
    const r = await f.evaluate((frame) => {
      const probe = (prop: "color" | "backgroundColor", v: string) => {
        const i = document.createElement("i");
        i.style[prop] = `var(${v})`;
        frame.querySelector(".app")!.append(i);
        const c = getComputedStyle(i)[prop];
        i.remove();
        return c;
      };
      const brand = probe("color", "--brand");
      const sunk = probe("backgroundColor", "--sunk");
      const held = getComputedStyle(frame.querySelector(".stepper b[data-held]")!).boxShadow;
      const rest = getComputedStyle(frame.querySelector(".stepper b:not([data-held])")!).boxShadow;
      return {
        brand, held, rest,
        sunk: [...frame.querySelectorAll(".stepper")].map((e) => getComputedStyle(e).backgroundColor === sunk),
      };
    });
    expect(r.sunk).toEqual([true, true, true]);
    expect(r.held).toContain(r.brand);
    expect(r.held).toContain("1.5px");
    expect(r.rest).not.toContain(r.brand);
  });

  test("the notes say what is typed and held, and what the review adds later", () => {
    const from = MOCKUP.indexOf('<div class="notes"><h3>Settings</h3>');
    expect(from).toBeGreaterThan(-1);
    const own = MOCKUP.slice(from, MOCKUP.indexOf("</section>", from));
    expect(own).toMatch(/typed/i);
    expect(own).toMatch(/held/i);
    for (const left of [/Start on/, /Spotify/, /Your platforms/]) expect(own).toMatch(left);
  });
});

test.describe("AC-3 · the drawn gear on every phone bar", ONCE, () => {
  test("no U+26B2 or text gear anywhere in the mockup", () => {
    for (const glyph of [/&#9906;/, /&#x26b2;/i, /⚲/, /&#9881;/, /&#x2699;/i, /⚙/]) expect(MOCKUP).not.toMatch(glyph);
  });

  test("every phone bar ends in the Settings icon button holding the drawn gear", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1100 });
    await page.setContent(MOCKUP, { waitUntil: "load" });
    const bars = await page.evaluate(() =>
      [...document.querySelectorAll("nav.bar")].map((bar) => {
        const last = bar.lastElementChild!;
        return {
          ok: last.matches('a.iconbtn[aria-label="Settings"]') && !!last.querySelector("svg path") && !!last.querySelector("svg circle"),
          where: `${bar.closest("section")?.getAttribute("data-id")} ${bar.closest(".frame")?.getAttribute("data-w")}`,
          text: (last.textContent ?? "").trim(),
        };
      }),
    );
    expect(bars.length).toBeGreaterThan(100);
    expect(bars.filter((b) => !b.ok).map((b) => b.where)).toEqual([]);
    expect(bars.filter((b) => b.text !== "")).toEqual([]);
  });

  test("the gear is the app's: Icons.tsx's settings path, 20 × 20", () => {
    const icons = readFileSync("src/components/nav/Icons.tsx", "utf8");
    const path = /settings: \(<>\s*<path d="([^"]+)"/.exec(icons)![1];
    const bar = /<nav class="bar"[^>]*>[\s\S]*?<\/nav>/.exec(frameMarkup("settings", "phone"))![0];
    expect(bar).toContain(`d="${path}"`);
    expect(bar).toMatch(/<svg viewBox="0 0 24 24" width="20" height="20"/);
  });
});

test.describe("AC-4 · design/mockups-index.md after TASK-146", ONCE, () => {
  const row = (id: string) => INDEX.split("\n").find((l) => l.startsWith(`| \`${id}\` |`));

  test("the six screens' rows list their 834px frame", () => {
    for (const id of [...SHEETS, ...LISTS]) expect(row(id), id).toMatch(/834px frame/);
  });

  test("the mediums-review rows mark settings and the 834px frames redrawn, and name what is left", () => {
    const start = INDEX.indexOf("## Nov 2026, mediums review");
    const table = INDEX.slice(start, INDEX.indexOf("Held as drawn", start));
    const rows = table.split("\n");
    const settings = rows.find((l) => l.startsWith("| `settings`, `batch`"))!;
    expect(settings).toMatch(/redrawn \(task 6\.24, TASK-146/);
    const six = rows.find((l) => l.includes("E12–E17"))!;
    expect(six).toMatch(/redrawn \(task 6\.24, TASK-146/);
    for (const [name, home] of [["Start on", "6.25"], ["Spotify", "9."], ["Your platforms", "10.0"]] as const) {
      const hit = rows.find((l) => l.includes(name) && l.includes(home));
      expect(hit, `${name} → ${home}`).toBeDefined();
    }
  });

  test("each of the six screens holds an 834px frame, reachable by its data-id", () => {
    for (const id of [...SHEETS, ...LISTS]) {
      expect(MOCKUP, id).toMatch(new RegExp(`<section class="screen[^>]*data-id="${id}"`));
      // The frame sits inside that screen's own section, not a later one's.
      const section = MOCKUP.slice(MOCKUP.indexOf(`<section class="screen" data-id="${id}">`));
      const own = section.slice(0, section.indexOf("</section>"));
      expect(own, `${id}: an 834px frame`).toContain('<div class="frame" data-w="tab">');
    }
  });
});
