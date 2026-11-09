// Task 2.2b (F-22, D-37, D-38, M-06, M-07, SG-D11): the plan rail in a real browser, with the app's own
// CSS, fonts and widths. /books/plan (2.10) is not built, so the four-column rail is rendered from a
// fixed set of books and staged into a signed-in page's <main>, as skeletons.spec.ts stages a skeleton;
// 2.10 re-runs the column items on the real page. The dashboard's one-quarter strip is on the real
// /books page in books-dashboard.spec.ts. Figures here are the fixture's own (D-7).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PlanRail from "../../src/components/PlanRail";
import type { RailBook } from "../../src/lib/plan-rail";
import {
  contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, screenshot, tokenColour,
} from "./helpers";

// Sets its own viewport: runs once, in w390-light.
const PHONE = { tag: "@at-w390-light" };
const DESK = { tag: "@at-w1280-light" };

const CAPACITY = 760_000;
const book = (id: string, title: string, words: number, period: string, o: Partial<RailBook> = {}): RailBook => ({
  id, title, words, estimated: false, period, genre: "Fantasy", status: "to_read", ...o,
});

// Q1 runs 976.5k against 760k: its fifth book straddles the rule and its sixth is past it.
// Q2 has room. Q3 has three adjacent small books (a stack) and a lone small one at its end.
const BOOKS: RailBook[] = [
  book("a1", "Alpha One", 200_000, "2027-Q1"),
  book("a2", "Alpha Two", 150_000, "2027-Q1", { genre: "Mystery" }),
  book("a3", "Alpha Three", 140_000, "2027-Q1", { estimated: true }),
  book("a4", "Alpha Four", 110_000, "2027-Q1", { genre: null }),
  book("a5", "Alpha Five", 250_000, "2027-Q1", { genre: "Horror" }),
  book("a6", "Alpha Six", 126_500, "2027-Q1", { estimated: true }),
  book("b1", "Bravo One", 150_000, "2027-Q2"),
  book("b2", "Bravo Two", 130_000, "2027-Q2", { genre: "Romance" }),
  book("b3", "Bravo Three", 120_000, "2027-Q2"),
  book("b4", "Bravo Four", 140_000, "2027-Q2", { estimated: true }),
  book("c1", "Charlie One", 300_000, "2027-Q3"),
  book("c2", "Charlie Two", 50_000, "2027-Q3"),
  book("c3", "Charlie Three", 40_000, "2027-Q3"),
  book("c4", "Charlie Four", 60_000, "2027-Q3"),
  book("c5", "Charlie Five", 200_000, "2027-Q3", { genre: "History" }),
  book("c6", "Charlie Six", 30_000, "2027-Q3"),
  book("d1", "Delta One", 145_000, "2027-Q4"),
  book("d2", "Delta Two", 123_000, "2027-Q4"),
  book("y1", "Year One", 455_000, "2027", { genre: "Memoir" }),
  book("y2", "Year Two", 204_000, "2027"),
  book("y3", "Year Three", 191_000, "2027", { estimated: true }),
  book("y4", "Year Four", 60_000, "2027"),
];

const quarters = [1, 2, 3, 4].map((n) => {
  const planned = BOOKS.filter((b) => b.period === `2027-Q${n}`).reduce((t, b) => t + b.words, 0);
  return {
    period: `2027-Q${n}`, year: 2027, quarter: n, capacity: CAPACITY, plannedWords: planned, statedWords: planned,
    estimatedWords: 0, books: 0, readBooks: 0, unknownBooks: 0, load: planned / CAPACITY, estimatedShare: 0,
  };
});
const RAIL = renderToStaticMarkup(createElement(PlanRail, { year: 2027, books: BOOKS, quarters }));

/** A signed-in page with the rail drawn in <main>, so it gets the app's CSS, fonts and width. */
async function staged(page: Page) {
  await page.goto("/watch");
  await page.locator(".slate").first().waitFor();
  await page.waitForFunction(() => Boolean((window as { next?: { router?: unknown } }).next?.router));
  await page.evaluate((html) => { document.querySelector("main")!.innerHTML = html; }, RAIL);
  await page.locator(".planrail").waitFor();
}

/**
 * How tall a block is painted: its words, not its 24px box. The box has transparent borders for the hit
 * area and the 2px gap; the painted block is the padding box plus that gap.
 */
const drawn = (block: Locator) =>
  block.evaluate((el) => {
    const s = getComputedStyle(el);
    return el.getBoundingClientRect().height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth) + 2;
  });

/** WCAG contrast of two `rgb()` strings the browser resolved. */
function contrast(a: string, b: string): number {
  const lum = (css: string) => {
    const [r, g, bl] = (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.describe("at 360px", PHONE, () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await staged(page);
  });

  test("a straddling block is hatched above the rule and plain below it (AC-1)", async ({ page }) => {
    const rule = await page.locator(".planrail > .caprule").boundingBox();
    const block = await page.locator('[data-book="a5"]').boundingBox();
    const hatch = await page.locator('[data-book="a5"] .ov').boundingBox();
    const wholly = await page.locator('[data-book="a6"] .ov').boundingBox();
    const plain = await page.locator('[data-book="a4"]').boundingBox();
    if (!rule || !block || !hatch || !wholly || !plain) throw new Error("the rail did not draw");
    const ruleY = rule.y + rule.height / 2;
    // The hatch starts at the block's top and ends on the rule; below the rule it is plain.
    expect(Math.abs(hatch.y - block.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(hatch.y + hatch.height - ruleY)).toBeLessThanOrEqual(1);
    expect(block.y + block.height).toBeGreaterThan(ruleY);
    // The next block is past the rule altogether, and the one before ends under it: plain, no layer at all.
    expect(wholly.y + wholly.height).toBeLessThanOrEqual(ruleY + 1);
    await expect(page.locator('[data-book="a4"] .ov')).toHaveCount(0);
    expect(plain.y).toBeGreaterThanOrEqual(ruleY - 1);
    // The hatch is drawn: --hatch over --blocked-soft, and the ring is --blocked (amber), not red.
    const css = await page.locator('[data-book="a5"] .ov').evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, color: s.backgroundColor };
    });
    expect(css.image).toContain("repeating-linear-gradient");
    expect(css.color).toBe(await tokenColour(page, "--blocked-soft"));
  });

  test("a block is where its words put it: its height is its words at 1000k to the column (AC-1, AC-2)", async ({ page }) => {
    const column = await page.locator('.qcol[data-period="2027-Q1"] .qstack').boundingBox();
    const box = await page.locator('[data-book="a1"]').boundingBox();
    if (!column || !box) throw new Error("the rail did not draw");
    expect(column.height).toBe(230);
    expect(Math.abs(box.height - (200_000 / 1_000_000) * 230)).toBeLessThanOrEqual(0.5);
    // It stands on the foot of the column.
    expect(Math.abs(box.y + box.height - (column.y + column.height))).toBeLessThanOrEqual(0.5);
  });

  test("a book with a year and no quarter is in the fifth lane, and in no column (AC-1)", async ({ page }) => {
    await expect(page.locator(".qcol.nq button.qb")).toHaveCount(4);
    await expect(page.locator(".qcol:not(.nq) .qb.un")).toHaveCount(0);
    const lane = await page.locator(".qcol.nq").boundingBox();
    expect(lane?.width).toBe(52);
    const border = await page.locator(".qcol.nq").evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.borderLeftStyle, color: s.borderLeftColor };
    });
    expect(border.style).toBe("dashed");
    expect(border.color).toBe(await tokenColour(page, "--blocked"));
  });

  test("every interactive element measures at least 24×24 and takes the tap across it (AC-1, AC-5)", async ({ page }) => {
    const found = await page.locator(".planrail :is(button, a, input:not([type=hidden]), select)").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        // A short block's 24px box stands over its neighbours: the points 11px above and below its centre are its own.
        const probes = [[cx, cy], [cx, cy - 11], [cx, cy + 11]];
        const own = probes.every(([x, y]) => el.contains(document.elementFromPoint(x, y)));
        return { name: el.getAttribute("aria-label") ?? el.tagName, w: r.width, h: r.height, own };
      }));
    expect(found.length).toBeGreaterThan(10);
    for (const f of found) {
      expect(f.w, `${f.name} width`).toBeGreaterThanOrEqual(24);
      expect(f.h, `${f.name} height`).toBeGreaterThanOrEqual(24);
      expect(f.own, `${f.name} takes the tap at its centre`).toBe(true);
    }
  });

  test("three adjacent small books are one stack button, a lone small one stays its own button (AC-1, AC-2, AC-3)", async ({ page }) => {
    const stack = page.locator('.qcol[data-period="2027-Q3"] button.stack');
    await expect(stack).toHaveCount(1);
    await expect(stack).toHaveAccessibleName("3 books, 150k words");
    await expect(stack).toContainText("+3 · 150k");
    await expect(page.locator('[data-book="c2"]')).toHaveCount(0);
    await expect(page.locator('[data-book="c6"]')).toHaveAccessibleName("Charlie Six, 30k words, Q3 2027");
    // The stack keeps its drawn height, the sum of its books (words decide).
    expect(Math.abs((await drawn(stack)) - (150_000 / 1_000_000) * 230)).toBeLessThanOrEqual(0.5);
    // The lone one is drawn at its words, under 24px, and its box is 24px for the thumb.
    const lone = page.locator('[data-book="c6"]');
    // (A browser snaps border widths to whole device pixels, so a short block paints within a pixel of its words.)
    expect(Math.abs((await drawn(lone)) - (30_000 / 1_000_000) * 230)).toBeLessThanOrEqual(1.5);
    expect((await lone.boundingBox())?.height).toBe(24);
  });

  test("an estimated book has the dotted edge and a ~ label; a stated one has neither (AC-1)", async ({ page }) => {
    const estimated = page.locator('[data-book="a3"]');
    await expect(estimated).toHaveAttribute("data-wc", "estimated");
    await expect(estimated.locator(".ql")).toHaveText("~140k");
    expect(await estimated.locator(".qe").evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dotted");
    await expect(estimated).toHaveAccessibleName("Alpha Three, 140k words, estimated, Q1 2027");
    await expect(page.locator('[data-book="a2"]')).not.toHaveAttribute("data-wc", /.*/);
    await expect(page.locator('[data-book="a2"] .qe')).toHaveCount(0);
    await expect(page.locator('[data-book="a2"] .ql')).toHaveText("150k");
  });

  test("the rail has no sideways scroll, no Quarter | Month control and nothing on --danger (AC-1)", async ({ page }) => {
    await expectNoHorizontalScroll(page);
    await expect(page.getByText(/\bmonth\b/i)).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    const danger = [await tokenColour(page, "--danger"), await tokenColour(page, "--danger-soft")];
    const drawn = await page.locator(".planrail, .planrail *, .qlegend *").evaluateAll((els) =>
      els.flatMap((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor, s.outlineColor, s.boxShadow];
      }));
    for (const colour of danger) expect(drawn.filter((c) => c.includes(colour)), `something draws ${colour}`).toEqual([]);
  });

  test("the phone's footer says only the amber overage: no room badge is rendered visibly (AC-1, SG-D11)", async ({ page }) => {
    const over = page.locator('.qcol[data-period="2027-Q1"] .qfoot .bdg.bl.phone');
    await expect(over).toBeVisible();
    await expect(over).toHaveText(/^\+\d+k$/);
    await expect(page.locator('.qcol[data-period="2027-Q1"] .qfoot .bdg.desk')).toBeHidden();
    const rooms = await page.locator(".qfoot *").evaluateAll((els) =>
      els.filter((el) => el.children.length === 0 && /\broom\b/.test(el.textContent ?? "") && (el as HTMLElement).offsetParent !== null).length);
    expect(rooms).toBe(0);
    const badges = await page.locator(".qfoot .bdg.dn").evaluateAll((els) => els.map((el) => (el as HTMLElement).offsetParent !== null));
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((shown) => !shown)).toBe(true);
  });

  test("screenshots at 360px and 412px (AC-1)", async ({ page }, info) => {
    await screenshot(page, info, "plan-rail-360");
    await page.setViewportSize({ width: 412, height: 915 });
    await expectNoHorizontalScroll(page);
    await screenshot(page, info, "plan-rail-412");
  });
});

test.describe("at 1280px", DESK, () => {
  test("an under-capacity quarter's footer says its room in grey; an over one says what it is over in amber (AC-1, SG-D11)", async ({ page }) => {
    await staged(page);
    const room = page.locator('.qcol[data-period="2027-Q2"] .qfoot .bdg.dn.desk');
    await expect(room).toBeVisible();
    await expect(room).toHaveText(/^\d+k room$/);
    const over = page.locator('.qcol[data-period="2027-Q1"] .qfoot .bdg.bl.desk');
    await expect(over).toBeVisible();
    await expect(over).toHaveText(/^over \d+k$/);
    await expect(page.locator('.qcol[data-period="2027-Q1"] .qfoot .bdg.phone')).toBeHidden();
    // The desktop rail is 300px tall, the fifth lane 150px and says why it is there.
    expect((await page.locator('.qcol[data-period="2027-Q1"] .qstack').boundingBox())?.height).toBe(300);
    expect((await page.locator(".qcol.nq").boundingBox())?.width).toBe(150);
    await expect(page.locator(".qcol.nq .qfoot b")).toHaveText("2027 · no quarter");
    // The hatch still ends on the rule at the taller scale.
    const rule = await page.locator(".planrail > .caprule").boundingBox();
    const hatch = await page.locator('[data-book="a5"] .ov').boundingBox();
    if (!rule || !hatch) throw new Error("the rail did not draw");
    expect(Math.abs(hatch.y + hatch.height - (rule.y + rule.height / 2))).toBeLessThanOrEqual(1);
  });
});

// Every project: the rail meets the UX floor in both themes at every width (AC-5).
test("the rail passes axe, holds 3:1 for its hatch, rule and edges, and the words contrast 4.5:1 (AC-5)", async ({ page }, info) => {
  await staged(page);
  await expectNoAxeViolations(page, ["button-name", "target-size", "color-contrast", "aria-allowed-attr", "aria-hidden-focus", "duplicate-id-aria", "list", "listitem"], ".planrail");
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoHorizontalScroll(page);

  const colour = (token: string) => tokenColour(page, token);
  const [blocked, blockedSoft, ink2, page_, muted, reading, deco, raise] = await Promise.all(
    ["--blocked", "--blocked-soft", "--ink-2", "--page", "--muted", "--reading-soft", "--faint-deco", "--raise"].map(colour),
  );
  // What the browser painted, read back (not the tokens we meant to use): the capacity rule, the dotted
  // estimated edge, the folded stack's dashes, the fifth lane's border and the hatch's lines and ground.
  const painted = await page.evaluate(() => {
    const css = (el: Element | null, pseudo?: string) => {
      if (!el) throw new Error("the rail did not draw");
      return getComputedStyle(el, pseudo);
    };
    return {
      rule: css(document.querySelector(".planrail > .caprule")).borderTopColor,
      estimated: css(document.querySelector('[data-wc="estimated"] .qe')).borderTopColor,
      stack: css(document.querySelector("button.stack"), "::before").borderTopColor,
      lane: css(document.querySelector(".qcol.nq")).borderLeftColor,
      hatch: css(document.querySelector(".qb .ov")).backgroundImage,
      hatchGround: css(document.querySelector(".qb .ov")).backgroundColor,
    };
  });
  expect(painted.rule).toBe(ink2);
  expect(painted.estimated).toBe(muted);
  expect(painted.stack).toBe(deco);
  expect(painted.lane).toBe(blocked);
  expect(painted.hatch, "the hatch lines are --blocked").toContain(blocked);
  expect(painted.hatchGround).toBe(blockedSoft);
  expect(contrast(painted.hatch.match(/rgb\([^)]*\)/)?.[0] ?? "", painted.hatchGround), "hatch").toBeGreaterThanOrEqual(3);
  expect(contrast(painted.rule, page_), "capacity rule").toBeGreaterThanOrEqual(3);
  expect(contrast(painted.estimated, reading), "estimated edge").toBeGreaterThanOrEqual(3);
  expect(contrast(painted.stack, raise), "stack dashes").toBeGreaterThanOrEqual(3);
  expect(contrast(painted.lane, page_), "fifth lane border").toBeGreaterThanOrEqual(3);

  // Over capacity is amber with its words, never colour alone and never red.
  await expect(page.locator('.qcol[data-period="2027-Q1"] .qfoot .bdg.bl').first()).toHaveText(/\d+k/);
  await screenshot(page, info, "plan-rail");
});
