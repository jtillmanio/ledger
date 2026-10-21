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
const SCREENS = ["home", "spine", "bdash", "status"] as const;
type Screen = (typeof SCREENS)[number];

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "w1280-light", "the mockup is checked once");
});

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
  return page.locator(`section.screen[data-id="${id}"] .frame[data-w="tab"]`);
}

type Box = { x: number; y: number; width: number; height: number };
async function box(l: Locator): Promise<Box> {
  const b = await l.boundingBox();
  if (!b) throw new Error(`no box for ${l}`);
  return b;
}

// The source of the four tab frames' markup, and the tablet CSS block.
function tabMarkup(id: Screen): string {
  const start = MOCKUP.indexOf(`data-id="${id}"`);
  const open = MOCKUP.indexOf('<div class="frame" data-w="tab">', start);
  const close = MOCKUP.indexOf('<div class="frame" data-w="desk">', open);
  expect(open, `${id} has an 834 frame`).toBeGreaterThan(start);
  return MOCKUP.slice(open, close);
}
const TAB_CSS = (() => {
  const start = MOCKUP.indexOf("/* ══ Task 1.8 — the 360px and 834px frames");
  return MOCKUP.slice(start, MOCKUP.indexOf("</style>", start));
})();

test.describe("AC-1 · every 834 frame", () => {
  for (const id of SCREENS) {
    test(`${id}: no sideways scroll, a 72px rail and a 48px thumb bar`, async ({ page }) => {
      const f = await openTab(page, id);
      const m = await f.locator(".frame-in").evaluate((e) => ({ sw: e.scrollWidth, cw: e.clientWidth }));
      expect(m.cw).toBeGreaterThan(800);
      expect(m.sw).toBe(m.cw);
      expect((await box(f.locator(".rail"))).width).toBe(72);
      expect((await box(f.locator(".actionbar"))).height).toBe(48);
    });
  }
});

test.describe("AC-1, AC-2 · home", () => {
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

test.describe("AC-1, AC-2 · the side rail", () => {
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

test.describe("AC-3 · the telescope is no longer capped", () => {
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

test.describe("AC-1, AC-4 · design/mockups-index.md", () => {
  const section = (heading: string) => {
    const start = INDEX.indexOf(heading);
    expect(start, heading).toBeGreaterThan(-1);
    const next = INDEX.slice(start + heading.length).search(/\n#{2,3} /);
    return INDEX.slice(start, next < 0 ? undefined : start + heading.length + next);
  };

  test("the four screens still list their 834px frames", () => {
    for (const id of SCREENS) {
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

test.describe("AC-5 · the UX floor in the four frames", () => {
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
              !el.closest("h1.t, .tb-name, .tb-story, .hero .name, .rail-word")) display.push(name(el));
            if (el.matches("a[href], button, [tabindex]:not([tabindex='-1'])") && el.closest(".tabmain")) {
              const r = el.getBoundingClientRect();
              if (r.width < 24 || r.height < 24) small.push(`${name(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
            }
          }
          const counts = [...frame.querySelectorAll(".tb-n, .tabmain .rm, .tabmain .seg .n, .tabmain .ct")]
            .filter((el) => !getComputedStyle(el).fontFamily.startsWith('"IBM Plex Mono"')).map(name);
          return { danger, red, display, small, counts, nCounts: frame.querySelectorAll(".tb-n").length };
        });
        expect.soft(report.red, `${id}: resolves to --danger ${report.danger}`).toEqual([]);
        expect.soft(report.display, `${id}: Newsreader outside the title and hero names`).toEqual([]);
        expect.soft(report.small, `${id}: interactive under 24px`).toEqual([]);
        expect.soft(report.counts, `${id}: counts not in Plex Mono`).toEqual([]);
        if (id === "home" || id === "bdash") expect(report.nCounts, `${id} marks its counts`).toBeGreaterThan(5);

        const axe = await new AxeBuilder({ page })
          .include(`section.screen[data-id="${id}"] .frame[data-w="tab"] .tabmain`)
          .withRules(["button-name", "link-name", "color-contrast", "aria-required-children", "aria-required-parent", "aria-allowed-attr"])
          .analyze();
        expect.soft(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`), `${id} axe`).toEqual([]);
      }
    });
  }

  test("screenshots of the four 834 frames, light and dark", async ({ page }, testInfo) => {
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
