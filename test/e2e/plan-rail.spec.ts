// Tasks 2.2b and 2.10 (F-22, F-23, D-37, D-38, D-135, D-138, M-06, M-07, SG-D11): the plan rail on the real
// /books/plan, in a real browser with the app's own CSS, fonts and widths. 2.2b proved its four-column items
// on a staged render, since the page did not exist; they run here on the page (2.10), with the page's own:
// the sums of the block heights, the hatch, one quarter open at a time, Move opening the picker, titles
// inside tall blocks, ~ on the rail and the rows, a lone small block's hit area beside a larger one, the
// skeleton's legend, the error state, and the UX floor in both themes. The dashboard's one-quarter strip is on
// the real /books page in books-dashboard.spec.ts. Figures here are the fixture's own (D-7).
//
// The books are made here under *e2e-plan-* ids, in next year (the page's year switch reaches it, and no
// other spec plans there), and removed after each test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import PlanError from "../../src/app/books/plan/error";
import PlanRail from "../../src/components/PlanRail";
import { PlanRailSkeleton } from "../../src/components/Skeleton";
import { today } from "../../src/lib/finish-date";
import type { RailBook } from "../../src/lib/plan-rail";
import { testSql, type TestSql } from "../db";
import {
  contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Sets its own viewport: runs once, in w390-light.
const PHONE = { tag: "@at-w390-light" };
const DESK = { tag: "@at-w1280-light" };
// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const DAY = today();
const THIS_YEAR = Number(DAY.slice(0, 4));
const THIS_QUARTER = Math.floor((Number(DAY.slice(5, 7)) - 1) / 3) + 1;
const Y = THIS_YEAR + 1;
const PAGE = `/books/plan?year=${Y}`;
const q = (n: number) => `${Y}-Q${n}`;
const id = (key: string) => `e2e-plan-${key}`;

type Seed = { key: string; title: string; period: string; ordinal: number | null; words?: number; pages?: number; genre?: string | null };

// Q1 runs past its capacity: its fifth book (sized to the capacity at seed time) straddles the rule and its
// sixth is past it. Q2 has room. Q3 has three adjacent small books (a stack) and a lone small one at its end.
// Q4 has a lone 30k book at its foot under a 110k one. The year, no quarter, has more than its lane holds.
const BOOKS: Seed[] = [
  { key: "a1", title: "Alpha One", period: q(1), ordinal: 1, words: 200_000, genre: "Fantasy" },
  { key: "a2", title: "Alpha Two", period: q(1), ordinal: 2, words: 150_000, genre: "Mystery" },
  { key: "a3", title: "Alpha Three", period: q(1), ordinal: 3, words: 140_000, genre: "Fantasy" },
  { key: "a4", title: "Alpha Four", period: q(1), ordinal: 4, words: 110_000, genre: null },
  // a5 is made in `seed`, once the capacity is known.
  { key: "a6", title: "Alpha Six", period: q(1), ordinal: 6, pages: 460, genre: "Fantasy" },
  { key: "b1", title: "Bravo One", period: q(2), ordinal: 1, words: 150_000, genre: "Fantasy" },
  { key: "b2", title: "Bravo Two", period: q(2), ordinal: 2, words: 130_000, genre: "Romance" },
  { key: "b3", title: "Bravo Three", period: q(2), ordinal: 3, words: 120_000, genre: "Fantasy" },
  { key: "b4", title: "Bravo Four", period: q(2), ordinal: 4, pages: 509, genre: "Fantasy" },
  { key: "c1", title: "Charlie One", period: q(3), ordinal: 1, words: 300_000, genre: "Fantasy" },
  { key: "c2", title: "Charlie Two", period: q(3), ordinal: 2, words: 50_000, genre: "Fantasy" },
  { key: "c3", title: "Charlie Three", period: q(3), ordinal: 3, words: 40_000, genre: "Fantasy" },
  { key: "c4", title: "Charlie Four", period: q(3), ordinal: 4, words: 60_000, genre: "Fantasy" },
  { key: "c5", title: "Charlie Five", period: q(3), ordinal: 5, words: 200_000, genre: "History" },
  { key: "c6", title: "Charlie Six", period: q(3), ordinal: 6, words: 30_000, genre: "Fantasy" },
  { key: "d1", title: "Delta One", period: q(4), ordinal: 1, words: 30_000, genre: "Fantasy" },
  { key: "d2", title: "Delta Two", period: q(4), ordinal: 2, words: 110_000, genre: "Fantasy" },
  { key: "d3", title: "Delta Three", period: q(4), ordinal: 3, words: 300_000, genre: "Fantasy" },
  // 455 + 204 + 191 = 850k fills most of the lane's 1000k; this and Year Four are both under 24px, merge into a 160k stack, and that runs past its top, so it folds.
  { key: "y1", title: "Year One", period: String(Y), ordinal: null, words: 455_000, genre: "Memoir" },
  { key: "y2", title: "Year Two", period: String(Y), ordinal: null, words: 204_000, genre: "Fantasy" },
  { key: "y3", title: "Year Three", period: String(Y), ordinal: null, words: 191_000, genre: "Fantasy" },
  { key: "y4", title: "Year Four", period: String(Y), ordinal: null, words: 60_000, genre: "Fantasy" },
  { key: "y5", title: "Year Five", period: String(Y), ordinal: null, words: 100_000, genre: "Fantasy" },
];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE 'e2e-plan-%'`;
});
test.beforeEach(clean);
test.afterEach(clean);

async function insert(sql: TestSql, b: Seed) {
  await sql`INSERT INTO books (id, title, genre, word_count, word_count_source, page_count)
    VALUES (${id(b.key)}, ${b.title}, ${b.genre ?? null}, ${b.words ?? null}, ${b.words == null ? null : "stated"}, ${b.pages ?? null})`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id(b.key)}, 'to_read')`;
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id(b.key)}, ${b.period}, ${b.ordinal})`;
}

/** Makes the fixture, plus `extra` books; returns each book's words as the view counts them, and Q1's capacity. */
async function seed(extra: Seed[] = []) {
  return withSql(async (sql) => {
    for (const b of [...BOOKS, ...extra]) await insert(sql, b);
    const [{ capacity }] = await sql<{ capacity: number }[]>`
      SELECT capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${q(1)}`;
    // Alpha Five starts at 600k (the four before it) and runs 90k past the rule.
    await insert(sql, { key: "a5", title: "Alpha Five", period: q(1), ordinal: 5, words: Math.round(Number(capacity)) - 600_000 + 90_000, genre: "Horror" });
    const rows = await sql<{ book_id: string; period: string; words: number | null }[]>`
      SELECT book_id, period, words FROM plan_book_words WHERE user_id = ${E2E_USER} AND book_id LIKE 'e2e-plan-%'`;
    return { capacity: Number(capacity), words: new Map(rows.map((r) => [r.book_id.replace("e2e-plan-", ""), r.words])) as Map<string, number | null>, rows };
  });
}

async function open(page: Page, url = PAGE) {
  await page.goto(url);
  // The loading skeletons stream first and are swapped out: the page is what is left when none is busy.
  await page.locator('.planrail[role="group"]').waitFor();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await hydrated(page.locator("button.plan-sum").first());
}

/** A block of the rail: the row of the same book has the same data-book. */
const block = (page: Page, key: string) => page.locator(`button.qb[data-book="${id(key)}"]`);

/**
 * How tall a block is painted: its words, not its 24px box. The box has transparent borders for the hit
 * area and the 2px gap; the painted block is the padding box plus that gap.
 */
const drawn = (el: Locator) =>
  el.evaluate((node) => {
    const s = getComputedStyle(node);
    return node.getBoundingClientRect().height - parseFloat(s.borderTopWidth) - parseFloat(s.borderBottomWidth) + 2;
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

const AXE = [
  "button-name", "link-name", "target-size", "color-contrast", "aria-allowed-attr", "aria-valid-attr-value", "aria-hidden-focus",
  "duplicate-id-aria", "heading-order", "landmark-unique", "list", "listitem",
];

test.describe("at 360px", PHONE, () => {
  let data: Awaited<ReturnType<typeof seed>>;
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    data = await seed();
    await open(page);
  });

  test("a straddling block is hatched above the rule and plain below it (AC-1)", async ({ page }) => {
    const rule = await page.locator(".planrail > .caprule").boundingBox();
    const box = await block(page, "a5").boundingBox();
    const hatch = await block(page, "a5").locator(".ov").boundingBox();
    const wholly = await block(page, "a6").locator(".ov").boundingBox();
    const plain = await block(page, "a4").boundingBox();
    if (!rule || !box || !hatch || !wholly || !plain) throw new Error("the rail did not draw");
    const ruleY = rule.y + rule.height / 2;
    // The hatch starts at the block's top and ends on the rule; below the rule it is plain.
    expect(Math.abs(hatch.y - box.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(hatch.y + hatch.height - ruleY)).toBeLessThanOrEqual(1);
    expect(box.y + box.height).toBeGreaterThan(ruleY);
    // The next block is past the rule altogether, and the one before ends under it: plain, no layer at all.
    expect(wholly.y + wholly.height).toBeLessThanOrEqual(ruleY + 1);
    await expect(block(page, "a4").locator(".ov")).toHaveCount(0);
    expect(plain.y).toBeGreaterThanOrEqual(ruleY - 1);
    // The hatch is drawn: --hatch over --blocked-soft, and the ring is --blocked (amber), not red.
    const css = await block(page, "a5").locator(".ov").evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, color: s.backgroundColor };
    });
    expect(css.image).toContain("repeating-linear-gradient");
    expect(css.color).toBe(await tokenColour(page, "--blocked-soft"));
  });

  test("the block heights in a quarter add up to its words, to the pixel rounding (AC-1)", async ({ page }) => {
    for (const n of [1, 2, 3, 4]) {
      const blocks = page.locator(`.qcol[data-period="${q(n)}"] button.qb`);
      const count = await blocks.count();
      const heights = await Promise.all(Array.from({ length: count }, (_, i) => drawn(blocks.nth(i))));
      const words = data.rows.filter((r) => r.period === q(n)).reduce((t, r) => t + (r.words ?? 0), 0);
      const expected = (words / 1_000_000) * 230;
      // A browser snaps each border to a device pixel, so a block paints within a pixel of its words.
      expect(Math.abs(heights.reduce((t, h) => t + h, 0) - expected), q(n)).toBeLessThanOrEqual(count * 0.5 + 1.5);
    }
  });

  test("a block is where its words put it: its height is its words at 1000k to the column (AC-1, AC-2)", async ({ page }) => {
    const column = await page.locator(`.qcol[data-period="${q(1)}"] .qstack`).boundingBox();
    const box = await block(page, "a1").boundingBox();
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

  test("every interactive element in the rail measures at least 24×24 and takes the tap across it (AC-1, AC-5)", async ({ page }) => {
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

  test("a 30k block beside a 110k block leaves each its own whole hit area (AC-5)", async ({ page }) => {
    // Delta One (30k) stands at the foot of Q4 under Delta Two (110k, 25px): the 30k's 24px reaches below the
    // column's foot, where there is room, not up into the 110k, which keeps all of its 24px.
    const own = async (key: string) => {
      const el = block(page, key);
      return el.evaluate((node) => {
        const r = node.getBoundingClientRect();
        // Six points down the box's first 24px, and the last: all must land on the block itself.
        const ys = [0.5, 4.5, 8.5, 12.5, 16.5, 20.5, 23.5].map((d) => r.top + d);
        const bad = ys.filter((y) => !node.contains(document.elementFromPoint(r.left + r.width / 2, y)));
        return { height: r.height, miss: bad.length };
      });
    };
    const small = await own("d1");
    const large = await own("d2");
    expect(small.height).toBe(24);
    expect(small.miss, "Delta One").toBe(0);
    expect(large.height).toBeGreaterThanOrEqual(24);
    expect(large.miss, "Delta Two").toBe(0);
    // Delta One's painted block is still its words (6.9px), at the foot; its box is the extra that reaches below.
    const column = await page.locator(`.qcol[data-period="${q(4)}"] .qstack`).boundingBox();
    const one = await block(page, "d1").boundingBox();
    if (!column || !one) throw new Error("the rail did not draw");
    expect(one.y + one.height).toBeGreaterThan(column.y + column.height);
  });

  test("a block tall enough shows its title and its words inside it; a short one shows neither title (AC-5; D-135, D-138)", async ({ page }) => {
    const a1 = block(page, "a1");
    const title = a1.locator(".qt");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Alpha One");
    await expect(a1.locator(".ql")).toBeVisible();
    // Both are inside the block's own box.
    const box = await a1.boundingBox();
    for (const part of [title, a1.locator(".ql")]) {
      const inner = await part.boundingBox();
      if (!box || !inner) throw new Error("the block did not draw");
      expect(inner.y).toBeGreaterThanOrEqual(box.y - 0.5);
      expect(inner.y + inner.height).toBeLessThanOrEqual(box.y + box.height + 0.5);
    }
    // A 110k block (25px) says its words only on the phone; a 30k one (7px) says nothing.
    await expect(block(page, "a4").locator(".qt")).toBeHidden();
    await expect(block(page, "a4").locator(".ql")).toBeVisible();
    await expect(block(page, "d1").locator(".ql")).toBeHidden();
  });

  test("on the strip a tiny stack paints over no neighbour's label (AC-5)", async ({ page }) => {
    // 91k, two 8k books (a stack drawn 6px wide, its box 24px), then 98k: round 3 found the stack's box painted over '~91k'.
    const cap = {
      period: q(1), year: Y, quarter: 1, capacity: 760_000, plannedWords: 205_000, statedWords: 205_000,
      estimatedWords: 0, books: 0, readBooks: 0, unknownBooks: 0, load: 0.27, estimatedShare: 0,
    };
    const b = (key: string, title: string, words: number, o: Partial<RailBook> = {}): RailBook =>
      ({ id: key, title, words, estimated: false, period: q(1), genre: "Fantasy", status: "to_read", ...o });
    const strip = renderToStaticMarkup(createElement(PlanRail, {
      axis: "row", year: Y, quarters: [cap],
      books: [b("s1", "Strip One", 91_000, { estimated: true }), b("s2", "Strip Two", 8_000), b("s3", "Strip Three", 8_000), b("s4", "Strip Four", 98_000)],
    }));
    await page.evaluate((html) => { document.querySelector("main")!.innerHTML = html; }, strip);
    await expect(page.locator(".planrail.strip button.stack")).toHaveCount(1);
    const m = await page.evaluate(() => {
      const stack = document.querySelector(".planrail.strip button.stack")!;
      const cs = getComputedStyle(stack);
      const r = stack.getBoundingClientRect();
      // What the stack paints: its box less the transparent borders that make it 24px (the hit area).
      const painted = { left: r.left + parseFloat(cs.borderLeftWidth), right: r.right - parseFloat(cs.borderRightWidth) };
      const labels = [...document.querySelectorAll(".planrail.strip button:not(.stack) .ql")].map((l) => {
        const lr = l.getBoundingClientRect();
        return { text: l.textContent ?? "", left: lr.left, right: lr.right };
      });
      return { box: r.width, painted, labels, hasLabel: stack.querySelector(".ql") !== null };
    });
    expect(m.box, "its box is 24px for the thumb").toBeGreaterThanOrEqual(24);
    expect(m.painted.right - m.painted.left, "but it is drawn at its words").toBeLessThan(12);
    expect(m.labels.length, "the strip's labels are drawn").toBeGreaterThan(0);
    const covered = m.labels.filter((l) => l.right > m.painted.left && l.left < m.painted.right).map((l) => l.text);
    expect(covered, "labels the stack's painted block overlaps").toEqual([]);
    expect(m.hasLabel).toBe(false);
  });

  test("a block paints only where it is drawn: its 24px hit area is transparent and covers nothing (AC-1, AC-5)", async ({ page }) => {
    // The hit area's transparent borders must not take the block's background: a short block's box reaches into
    // its neighbours, and a painted pad would cover their labels. A `background` shorthand resets the clip.
    const clips = await page.locator(".planrail button.qb").evaluateAll((els) =>
      els.map((el) => ({ name: el.getAttribute("aria-label"), clip: getComputedStyle(el).backgroundClip })));
    expect(clips.length).toBeGreaterThan(10);
    for (const c of clips) expect(c.clip, c.name ?? "").toBe("padding-box");
  });

  test("three adjacent small books are one stack button, a lone small one stays its own button (AC-1, AC-2, AC-3)", async ({ page }) => {
    const stack = page.locator(`.qcol[data-period="${q(3)}"] button.stack`);
    await expect(stack).toHaveCount(1);
    await expect(stack).toHaveAccessibleName("3 books, 150k words");
    // It does nothing until 2.3's list sheet, and says why: aria-disabled and the legend's reason beside it.
    await expect(stack).toHaveAttribute("aria-disabled", "true");
    await expect(stack).toHaveAccessibleDescription(/opens its list with the plan editor/);
    await expect(stack).toContainText("+3 · 150k");
    await expect(block(page, "c2")).toHaveCount(0);
    await expect(block(page, "c6")).toHaveAccessibleName(`Charlie Six, 30k words, Q3 ${Y}`);
    // The stack keeps its drawn height, the sum of its books (words decide).
    expect(Math.abs((await drawn(stack)) - (150_000 / 1_000_000) * 230)).toBeLessThanOrEqual(0.5);
    // The lone one is drawn at its words, under 24px, and its box is 24px for the thumb.
    const lone = block(page, "c6");
    // (A browser snaps border widths to whole device pixels, so a short block paints within a pixel of its words.)
    expect(Math.abs((await drawn(lone)) - (30_000 / 1_000_000) * 230)).toBeLessThanOrEqual(1.5);
    expect((await lone.boundingBox())?.height).toBe(24);
  });

  test("a lane taller than the column keeps the scale and folds its overflow into one +N more stack at the top (AC-1)", async ({ page }) => {
    const more = page.locator(".qcol.nq button.stack");
    await expect(more).toHaveCount(1);
    await expect(more).toHaveAccessibleName("2 books, 160k words");
    await expect(more).toContainText("+2 more · 160k");
    // The quarters did not move for it: Q1's first block is still its words at 1000k to the column.
    const a1 = await block(page, "a1").boundingBox();
    expect(Math.abs((a1?.height ?? 0) - 0.2 * 230)).toBeLessThanOrEqual(0.5);
    // The fold stands from where its books start to the top of the column.
    const column = await page.locator(".qcol.nq .qstack").boundingBox();
    const box = await more.boundingBox();
    if (!column || !box) throw new Error("the rail did not draw");
    expect(Math.abs(box.y - column.y)).toBeLessThanOrEqual(2);
    await expectNoHorizontalScroll(page);
  });

  test("an estimated book has the dotted edge and a ~ on the rail and on its row; a stated one has neither (AC-5)", async ({ page }) => {
    const estimated = block(page, "a6");
    const words = data.words.get("a6")!;
    await expect(estimated).toHaveAttribute("data-wc", "estimated");
    await expect(estimated.locator(".ql")).toHaveText(/^~\d+k$/);
    expect(await estimated.locator(".qe").evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dotted");
    await expect(estimated).toHaveAccessibleName(new RegExp(`^Alpha Six, ${Math.round(words / 1000)}k words, estimated, Q1 ${Y}$`));
    await expect(block(page, "a2")).not.toHaveAttribute("data-wc", /.*/);
    await expect(block(page, "a2").locator(".qe")).toHaveCount(0);
    await expect(block(page, "a2").locator(".ql")).toHaveText("150k");
    // The same book's row, in the open quarter, reads ~ too, and a stated one does not.
    await expect(page.locator(`li.plan-row[data-book="${id("a6")}"] .rm`)).toHaveText(/^~\d+k$/);
    await expect(page.locator(`li.plan-row[data-book="${id("a2")}"] .rm`)).toHaveText("150k");
  });

  test("the page has no sideways scroll, no Quarter | Month control and nothing on --danger (AC-1)", async ({ page }) => {
    await expectNoHorizontalScroll(page);
    await expect(page.getByText(/\bmonth\b/i)).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    const danger = [await tokenColour(page, "--danger"), await tokenColour(page, "--danger-soft")];
    const painted = await page.locator("main, main *").evaluateAll((els) =>
      els.flatMap((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor, s.borderTopColor, s.borderLeftColor, s.outlineColor, s.boxShadow];
      }));
    for (const colour of danger) expect(painted.filter((c) => c.includes(colour)), `something draws ${colour}`).toEqual([]);
  });

  test("the phone's footer says only the amber overage: no room badge is rendered visibly (AC-1, SG-D11)", async ({ page }) => {
    const over = page.locator(`.qcol[data-period="${q(1)}"] .qfoot .bdg.bl.phone`);
    await expect(over).toBeVisible();
    await expect(over).toHaveText(/^\+\d+k$/);
    await expect(page.locator(`.qcol[data-period="${q(1)}"] .qfoot .bdg.desk`)).toBeHidden();
    const rooms = await page.locator(".qfoot *").evaluateAll((els) =>
      els.filter((el) => el.children.length === 0 && /\broom\b/.test(el.textContent ?? "") && (el as HTMLElement).offsetParent !== null).length);
    expect(rooms).toBe(0);
    const badges = await page.locator(".qfoot .bdg.dn").evaluateAll((els) => els.map((el) => (el as HTMLElement).offsetParent !== null));
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((shown) => !shown)).toBe(true);
  });

  test("exactly one quarter is open: expanding Q2 collapses Q1 (AC-1, AC-3)", async ({ page }) => {
    // A later year opens on Q1: its books in ordinal order, each with Move.
    const open = page.locator(".plan-open");
    await expect(open).toHaveCount(1);
    await expect(open).toHaveAttribute("data-period", q(1));
    await expect(open.locator("li.plan-row .row-title")).toHaveText(
      ["Alpha One", "Alpha Two", "Alpha Three", "Alpha Four", "Alpha Five", "Alpha Six"]);
    await expect(open.getByRole("button", { name: "Move Alpha Two" })).toBeVisible();
    // The other three are one summary button each, collapsed.
    const sums = page.locator("button.plan-sum");
    await expect(sums).toHaveCount(3);
    for (let i = 0; i < 3; i++) await expect(sums.nth(i)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(`button.plan-sum[data-period="${q(2)}"]`)).toContainText("4 books");

    await page.locator(`button.plan-sum[data-period="${q(2)}"]`).click();
    await expect(open).toHaveCount(1);
    await expect(open).toHaveAttribute("data-period", q(2));
    await expect(open.locator("li.plan-row .row-title")).toHaveText(["Bravo One", "Bravo Two", "Bravo Three", "Bravo Four"]);
    // Q1 is a summary row now, and focus moved to the quarter it opened.
    await expect(page.locator(`button.plan-sum[data-period="${q(1)}"]`)).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".plan-open h2")).toBeFocused();
    await expect(page.locator("button.plan-sum")).toHaveCount(3);
    await expect(page.locator(".plan-move")).toHaveCount(4);
  });

  test("Move opens 2.3's picker for that book, and Esc puts focus back on Move (AC-3)", async ({ page }) => {
    const move = page.getByRole("button", { name: "Move Alpha Two" });
    await hydrated(move);
    await move.click();
    const sheet = page.getByRole("dialog", { name: "Alpha Two" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(move).toBeFocused();
  });

  test("the year switch reaches this year and the next four, and the loading skeleton's legend is the rail's (AC-5)", async ({ page }) => {
    const chips = page.getByRole("navigation", { name: "Year" }).getByRole("link");
    await expect(chips).toHaveText(Array.from({ length: 5 }, (_, i) => String(THIS_YEAR + i)));
    await expect(chips.nth(1)).toHaveAttribute("aria-current", "true");

    // The loaded legend and rail, then the skeleton's in the same place: nothing moves when the rail arrives.
    const measure = () => page.evaluate(() => {
      const rail = document.querySelector(".planrail")!.getBoundingClientRect();
      const legend = document.querySelector(".qlegend")!.getBoundingClientRect();
      return { rail: rail.height, legend: legend.height, gap: legend.top - rail.bottom, width: legend.width };
    });
    const loaded = await measure();
    expect(loaded.legend, "the loaded legend is drawn").toBeGreaterThan(20);
    await page.evaluate((html) => {
      const head = document.querySelector("main")!.querySelector(".filters")!;
      document.querySelector(".planrail")!.remove();
      document.querySelector(".qlegend")!.remove();
      document.querySelector(".plan-quarters")!.remove();
      head.insertAdjacentHTML("afterend", html);
    }, renderToStaticMarkup(createElement(PlanRailSkeleton)));
    const skeleton = await measure();
    expect(Math.abs(skeleton.legend - loaded.legend)).toBeLessThanOrEqual(2);
    expect(Math.abs(skeleton.gap - loaded.gap)).toBeLessThanOrEqual(2);
    expect(Math.abs(skeleton.width - loaded.width)).toBeLessThanOrEqual(2);
  });
});

test.describe("at 1280px", DESK, () => {
  test("an under-capacity quarter's footer says its room in grey; an over one says what it is over in amber (AC-1, SG-D11)", async ({ page }) => {
    await seed();
    await open(page);
    const room = page.locator(`.qcol[data-period="${q(2)}"] .qfoot .bdg.dn.desk`);
    await expect(room).toBeVisible();
    await expect(room).toHaveText(/^\d+k room$/);
    const over = page.locator(`.qcol[data-period="${q(1)}"] .qfoot .bdg.bl.desk`);
    await expect(over).toBeVisible();
    await expect(over).toHaveText(/^over \d+k$/);
    await expect(page.locator(`.qcol[data-period="${q(1)}"] .qfoot .bdg.phone`)).toBeHidden();
    // The desktop rail is 300px tall, the fifth lane 150px and says why it is there.
    expect((await page.locator(`.qcol[data-period="${q(1)}"] .qstack`).boundingBox())?.height).toBe(300);
    expect((await page.locator(".qcol.nq").boundingBox())?.width).toBe(150);
    await expect(page.locator(".qcol.nq .qfoot b")).toHaveText(`${Y} · no quarter`);
    // The hatch still ends on the rule at the taller scale.
    const rule = await page.locator(".planrail > .caprule").boundingBox();
    const hatch = await block(page, "a5").locator(".ov").boundingBox();
    if (!rule || !hatch) throw new Error("the rail did not draw");
    expect(Math.abs(hatch.y + hatch.height - (rule.y + rule.height / 2))).toBeLessThanOrEqual(1);
  });

  test("the block heights in a quarter add up to its words at 300px, and blocks the phone cannot title do (AC-1, AC-5)", async ({ page }) => {
    const data = await seed();
    await open(page);
    for (const n of [1, 2, 3, 4]) {
      const blocks = page.locator(`.qcol[data-period="${q(n)}"] button.qb`);
      const count = await blocks.count();
      const heights = await Promise.all(Array.from({ length: count }, (_, i) => drawn(blocks.nth(i))));
      const words = data.rows.filter((r) => r.period === q(n)).reduce((t, r) => t + (r.words ?? 0), 0);
      expect(Math.abs(heights.reduce((t, h) => t + h, 0) - (words / 1_000_000) * 300), q(n)).toBeLessThanOrEqual(count * 0.5 + 1.5);
    }
    // Alpha Four (110k) is 25px on the phone, 33px here: its title shows now.
    await expect(block(page, "a4").locator(".qt")).toBeVisible();
    await expect(block(page, "a4").locator(".ql")).toBeVisible();
  });
});

// The rail and the dashboard strip read one query: this quarter's totals are the same on both (AC-1).
test("the rail's footer and the dashboard's strip say the same total for this quarter (AC-1)", ONCE, async ({ page }) => {
  await seed([
    { key: "n1", title: "Now One", period: `${THIS_YEAR}-Q${THIS_QUARTER}`, ordinal: 1, words: 200_000 },
    { key: "n2", title: "Now Two", period: `${THIS_YEAR}-Q${THIS_QUARTER}`, ordinal: 2, words: 150_000 },
  ]);
  await page.goto("/books/plan");
  const footer = await page.locator(`.qcol[data-period="${THIS_YEAR}-Q${THIS_QUARTER}"] .qfoot .mono`).evaluate((el) => (el.firstChild?.textContent ?? "").trim());
  await page.goto("/books");
  const strip = await page.locator(".qfigs .qfig").first().innerText();
  expect(footer).toBe("350k");
  expect(strip).toContain(`${footer} planned`);
});

test("a nav item leads to the page, and the page is headed Plan with the year's total (AC-2)", ONCE, async ({ page }) => {
  await seed();
  await page.goto("/books");
  await page.locator('a[href="/books/plan"]:visible').first().click();
  await page.waitForURL("**/books/plan");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Plan");
  await expect(page.locator(".planrail")).toBeVisible();
  // This year has nothing planned by the fixture: next year's chip leads to the rail with its books.
  await page.getByRole("link", { name: String(Y), exact: true }).click();
  await page.waitForURL(`**/books/plan?year=${Y}`);
  await expect(page.locator(".plan-total")).toContainText(/\d+ books · /);
});

test("one empty-state line names the room across the empty quarters and no quarter has its own (AC-4)", ONCE, async ({ page }) => {
  await withSql(async (sql) => {
    await insert(sql, { key: "e1", title: "Only One", period: q(1), ordinal: 1, words: 100_000 });
  });
  await open(page);
  await expect(page.locator(".plan-room-line")).toHaveCount(1);
  await expect(page.locator(".plan-room-line")).toHaveText(/^[\d.]+[kM] of room across Q1–Q4$/);
  await expect(page.locator(".empty")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Library" }).first()).toHaveAttribute("href", "/books/list");
});

test("the error state is a neutral line with a way to try again (AC-6)", ONCE, async ({ page }) => {
  await page.goto("/books/plan");
  await page.locator("main.plan-page").waitFor();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await page.evaluate((html) => { document.querySelector("main")!.outerHTML = html; },
    renderToStaticMarkup(createElement(PlanError, { error: new Error("x"), reset: () => undefined })));
  // (Next's route announcer is a second role=alert, empty.)
  const alert = page.locator("p.plan-error");
  await expect(alert).toHaveAttribute("role", "alert");
  await expect(alert).toContainText("Couldn't load the plan. Nothing was changed.");
  const tryAgain = page.getByRole("button", { name: "Try again" });
  await expect(tryAgain).toBeVisible();
  expect((await tryAgain.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  const danger = [await tokenColour(page, "--danger"), await tokenColour(page, "--danger-soft")];
  const colours = await page.locator("main, main *").evaluateAll((els) => els.flatMap((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor];
  }));
  for (const colour of danger) expect(colours.filter((c) => c === colour)).toEqual([]);
  await expectNoAxeViolations(page, AXE, "main");
});

// Every project: the page meets the UX floor in both themes at every width (AC-6).
test("the page passes axe, holds 3:1 for the rail's hatch, rule and edges, and its words contrast 4.5:1 (AC-6)", async ({ page }, info) => {
  await seed();
  await open(page);
  await expectNoAxeViolations(page, AXE, "main");
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
      estimated: css(document.querySelector('.planrail [data-wc="estimated"] .qe')).borderTopColor,
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

  // A plain block's outline and a summary row's are --faint-deco (D-71), 3:1 on the page and the card (AC-6).
  const rings = await page.evaluate(([a, sum]) => [a, sum].map((sel) => getComputedStyle(document.querySelector(sel)!).boxShadow),
    [`button.qb[data-book="${id("a2")}"]`, "button.plan-sum"]);
  const [surface] = await Promise.all([colour("--surface")]);
  for (const ring of rings) {
    expect(ring, "outline token").toContain(deco);
    expect(contrast(deco, page_), "outline on the page").toBeGreaterThanOrEqual(3);
    expect(contrast(deco, surface), "outline on the card").toBeGreaterThanOrEqual(3);
  }

  // Over capacity is amber with its words, never colour alone and never red.
  await expect(page.locator(`.qcol[data-period="${q(1)}"] .qfoot .bdg.bl`).first()).toHaveText(/\d+k/);
  await expect(page.locator(`button.plan-sum[data-period="${q(3)}"] .bdg`)).toHaveClass(/\bbl\b|\bdn\b/);
  await screenshot(page, info, "plan");
});

// The screenshots the task asks for: 360, 834 and 1280px, in both themes, set by hand (no project has 834).
test("screenshots at 360, 834 and 1280px, light and dark (AC-1, AC-6)", ONCE, async ({ page }, info) => {
  await seed();
  await open(page);
  for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
    for (const scheme of ["light", "dark"] as const) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      await expectNoHorizontalScroll(page);
      await screenshot(page, info, `plan-${width}-${scheme}`);
    }
  }
});
