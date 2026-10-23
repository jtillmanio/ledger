// Task 1.10: the comics Up next queue in a real browser. The dashboard's cover
// shelf (order, Start, no handle, the 1280px edge, ‹ › paging), the queue list
// behind Reorder (the keyboard sequence, Esc, the row menu, Remove and its
// undo), the add verbs on three surfaces, and the empty shelf. Runs at every
// width, light and dark, under reduced motion and with touch; the checks that
// need one width or a write of their own run once. This file seeds twelve runs
// of its own and empties the queue after every test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// Writes or sets its own viewport: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const LIST = "/comics/status?tab=next";
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "list", "listitem", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order",
];

const ids = Array.from({ length: 12 }, (_, i) => `e2e-q${String(i + 1).padStart(2, "0")}`);
const titleOf = (id: string) => `Queue Run ${id.slice(-2)}`;

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** Puts exactly these runs in the queue, in this order. */
const queue = (runs: string[]) => db(async (sql) => {
  await sql`DELETE FROM run_queue WHERE user_id = ${E2E_USER}`;
  for (const [i, id] of runs.entries()) {
    await sql`INSERT INTO run_queue (user_id, run_id, ordinal) VALUES (${E2E_USER}, ${id}, ${i + 1})`;
  }
});

/** The queue as stored, in order. */
const stored = () => db(async (sql) =>
  (await sql`SELECT run_id, ordinal FROM run_queue WHERE user_id = ${E2E_USER} ORDER BY ordinal`)
    .map((r) => `${r.run_id}:${r.ordinal}`));

test.beforeAll(async () => {
  await db(async (sql) => {
    await sql`INSERT INTO runs (id, title) SELECT id, 'Queue Run ' || right(id, 2) FROM unnest(${ids}::text[]) id
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO issues (id, label) SELECT id || '-1', 'Queue Comic (2001) #' || right(id, 2)
              FROM unnest(${ids}::text[]) id ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) SELECT id, 1, id || '-1'
              FROM unnest(${ids}::text[]) id ON CONFLICT (run_id, issue_id) DO NOTHING`;
  });
});

test.afterEach(async () => {
  await db((sql) => sql`DELETE FROM run_queue WHERE user_id = ${E2E_USER}`);
});

test.afterAll(async () => {
  await db((sql) => sql`DELETE FROM runs WHERE id = ANY(${ids})`);
});

const shelf = (page: Page) => page.locator("ul.shelf");
const cards = (page: Page) => shelf(page).locator("li.card");

async function openDashboard(page: Page) {
  await page.goto("/comics");
  await expect(page.getByRole("heading", { level: 2, name: "Up next" })).toBeVisible();
}

async function openList(page: Page) {
  await page.goto(LIST);
  await expect(page.getByRole("heading", { level: 1, name: "Up next" })).toBeVisible();
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

test.describe("the dashboard shelf", () => {
  test("renders the queue's unstarted runs in ordinal order, Start on the first card only, no drag handle", async ({ page }, info) => {
    const order = [ids[2], ids[0], ids[1]];
    await queue(order);
    await openDashboard(page);

    await expect(cards(page).locator(".card-title")).toHaveText(order.map(titleOf));
    await expect(cards(page).locator(".pos")).toHaveText(["1", "2", "3"]);
    await expect(shelf(page).getByRole("link", { name: /^Start / })).toHaveCount(1);
    await expect(cards(page).first().getByRole("link", { name: `Start ${titleOf(order[0])}` }))
      .toHaveAttribute("href", `/comics/${order[0]}#p-1`);
    await expect(shelf(page).locator(".drag, button")).toHaveCount(0);
    // Every card falls back to the neutral placeholder until 4.3.
    await expect(cards(page).locator(".cover .cv.none")).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Reorder" })).toHaveAttribute("href", LIST);

    if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
      expect(await shelf(page).evaluate((el) => getComputedStyle(el).scrollBehavior)).toBe("auto");
    }
    await floor(page);
    await screenshot(page, info, "shelf-populated");
  });

  test("a started run leaves the shelf and keeps its queue row; one card is still a shelf", async ({ page }, info) => {
    await queue([ids[0], ids[1]]);
    await db((sql) => sql`INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
                          SELECT ${E2E_USER}, id, NULL, 'none' FROM run_issues WHERE run_id = ${ids[0]}`);
    try {
      await openDashboard(page);
      await expect(cards(page).locator(".card-title")).toHaveText([titleOf(ids[1])]);
      await expect(cards(page).first().locator(".pos")).toHaveText("2");
      expect(await stored()).toEqual([`${ids[0]}:1`, `${ids[1]}:2`]);
      await floor(page);
      await screenshot(page, info, "shelf-one-card");
    } finally {
      await db((sql) => sql`DELETE FROM issue_progress WHERE user_id = ${E2E_USER} AND placement_id IN (
                              SELECT id FROM run_issues WHERE run_id = ${ids[0]})`);
    }
  });

  test("empty: Nothing queued, with the computed count of ready runs, linking to Ready, not queued", async ({ page }, info) => {
    await openList(page);
    const n = await page.locator("#ready-head .n").textContent();
    await openDashboard(page);
    const link = page.getByRole("link", { name: `pick from ${n} ready runs` });
    await expect(link).toHaveAttribute("href", `${LIST}#ready`);
    await expect(page.locator(".shelf-slot .empty")).toHaveText(`Nothing queued — pick from ${n} ready runs`);
    await floor(page);
    await screenshot(page, info, "shelf-empty");
  });

  test("overflowing: twelve covers scroll inside the frame, never the page", async ({ page }, info) => {
    await queue(ids);
    await openDashboard(page);
    await expect(cards(page)).toHaveCount(12);
    expect(await shelf(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await floor(page);
    await screenshot(page, info, "shelf-overflowing");
  });

  test("Start follows the link and sends no POST", ONCE, async ({ page }) => {
    await queue([ids[3]]);
    await openDashboard(page);
    const posts: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST") posts.push(r.url()); });
    const start = cards(page).first().getByRole("link", { name: `Start ${titleOf(ids[3])}` });
    await hydrated(start);
    await start.click();
    await page.waitForURL(`**/comics/${ids[3]}#p-1`);
    await expect(page.getByRole("heading", { level: 1, name: titleOf(ids[3]) })).toBeVisible();
    expect(posts).toEqual([]);
    expect(await stored()).toEqual([`${ids[3]}:1`]);
  });

  test("Reorder reaches the list where the keyboard sequence works", ONCE, async ({ page }) => {
    await queue(ids.slice(0, 3));
    await openDashboard(page);
    await page.getByRole("link", { name: "Reorder" }).click();
    await page.waitForURL(`**${LIST}`);
    await expect(page.getByRole("button", { name: `Reorder ${titleOf(ids[1])}, position 2 of 3` })).toBeVisible();
  });
});

test.describe("the shelf from 1024px (FP-D18)", () => {
  test("at 1280 the shelf ends at main's edge; with twelve queued ‹ › render and › moves five covers", { tag: "@at-w1280-light" }, async ({ page }, info) => {
    // the 1280px check runs once, at w1280-light.
    await queue(ids);
    await openDashboard(page);
    const main = await page.locator(".dash-main").boundingBox();
    const row = await shelf(page).boundingBox();
    expect(Math.round(row!.x + row!.width)).toBeLessThanOrEqual(Math.round(main!.x + main!.width));
    expect(row!.x + row!.width).toBeLessThan(1280 - 304);

    const earlier = page.getByRole("button", { name: "Earlier in Up next" });
    const later = page.getByRole("button", { name: "Later in Up next" });
    await expect(earlier).toHaveAttribute("aria-disabled", "true");
    await hydrated(later);
    const step = await cards(page).first().evaluate((el) =>
      el.getBoundingClientRect().width + parseFloat(getComputedStyle(el.parentElement!).columnGap));
    await later.click();
    await expect.poll(() => shelf(page).evaluate((el) => el.scrollLeft)).toBeCloseTo(5 * step, 0);
    await expect(earlier).not.toHaveAttribute("aria-disabled", "true");
    await screenshot(page, info, "shelf-paged-1280");
  });

  test("at 1024 › moves four covers", { tag: "@at-w1024-light" }, async ({ page }) => {
    // the 1024px check runs once, at w1024-light.
    await queue(ids);
    await openDashboard(page);
    const later = page.getByRole("button", { name: "Later in Up next" });
    await hydrated(later);
    const step = await cards(page).first().evaluate((el) =>
      el.getBoundingClientRect().width + parseFloat(getComputedStyle(el.parentElement!).columnGap));
    await later.click();
    await expect.poll(() => shelf(page).evaluate((el) => el.scrollLeft)).toBeCloseTo(4 * step, 0);
  });

  test("with three queued the ‹ › do not render", { tag: "@at-w1280-light" }, async ({ page }) => {
    // the 1280px check runs once, at w1280-light.
    await queue(ids.slice(0, 3));
    await openDashboard(page);
    await hydrated(page.getByRole("link", { name: "Reorder" }));
    await expect(page.locator(".pager")).toHaveCount(0);
  });

  test("with touch the ‹ › never render, however many are queued", { tag: "@at-w390-touch" }, async ({ page }) => {
    // runs once, in w390-touch.
    await queue(ids);
    await openDashboard(page);
    await hydrated(page.getByRole("link", { name: "Reorder" }));
    await expect(page.locator(".pager")).toHaveCount(0);
  });
});

test.describe("the queue list", () => {
  test("the handle is a named button described by the help text; Space, Down, Down, Space moves 2 to 4", async ({ page }, info) => {
    await queue(ids.slice(0, 5));
    await openList(page);
    const handle = page.getByRole("button", { name: `Reorder ${titleOf(ids[1])}, position 2 of 5` });
    await expect(handle).toHaveClass(/\bdrag\b/);
    await expect(handle).toHaveAttribute("aria-describedby", "dnd-help");
    await expect(page.locator("#dnd-help")).toContainText("Space lifts a row");
    await floor(page);
    await screenshot(page, info, "queue-list");

    await hydrated(handle);
    await handle.focus();
    const live = page.locator("#dnd-live");
    await page.keyboard.press("Space");
    await expect(live).toHaveText(`${titleOf(ids[1])} grabbed. Position 2 of 5. Arrow keys move it, Space drops it, Esc cancels.`);
    await page.keyboard.press("ArrowDown");
    await expect(live).toHaveText(`${titleOf(ids[1])}, position 3 of 5.`);
    await page.keyboard.press("ArrowDown");
    await screenshot(page, info, "queue-lifted");
    await page.keyboard.press("Space");
    await expect(live).toHaveText(`${titleOf(ids[1])} dropped. Position 4 of 5.`);

    const want = [ids[0], ids[2], ids[3], ids[1], ids[4]];
    await expect.poll(stored).toEqual(want.map((id, i) => `${id}:${i + 1}`));
    await expect(page.locator(".qtitle")).toHaveText(want.map(titleOf));
    await expect(page.getByRole("button", { name: `Reorder ${titleOf(ids[1])}, position 4 of 5` })).toBeFocused();
  });

  test("Esc mid-lift leaves the order unchanged", async ({ page }) => {
    await queue(ids.slice(0, 5));
    await openList(page);
    const handle = page.getByRole("button", { name: `Reorder ${titleOf(ids[1])}, position 2 of 5` });
    await hydrated(handle);
    await handle.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.locator("#dnd-live"))
      .toHaveText(`Reorder cancelled. ${titleOf(ids[1])} is back at position 2 of 5.`);
    await expect(page.locator(".qtitle")).toHaveText(ids.slice(0, 5).map(titleOf));
    expect(await stored()).toEqual(ids.slice(0, 5).map((id, i) => `${id}:${i + 1}`));
  });

  test("the row menu offers Move to top · Move up · Move down · Remove; Remove's undo restores the exact order", ONCE, async ({ page }) => {
    const four = ids.slice(0, 4);
    await queue(four);
    await openList(page);
    const more = page.getByRole("button", { name: `More for ${titleOf(ids[1])}` });
    await hydrated(more);
    await more.click();
    await expect(page.getByRole("menuitem")).toHaveText(["Move to top", "Move up", "Move down", "Remove from Up next"]);
    await page.getByRole("menuitem", { name: "Remove from Up next" }).click();

    await expect(page.locator(".qtitle")).toHaveText([ids[0], ids[2], ids[3]].map(titleOf));
    await expect.poll(stored).toEqual([`${ids[0]}:1`, `${ids[2]}:2`, `${ids[3]}:3`]);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect.poll(stored).toEqual(four.map((id, i) => `${id}:${i + 1}`));
    await expect(page.locator(".qtitle")).toHaveText(four.map(titleOf));
  });

  test("Move to top from the menu writes a contiguous order", ONCE, async ({ page }) => {
    await queue(ids.slice(0, 4));
    await openList(page);
    const more = page.getByRole("button", { name: `More for ${titleOf(ids[2])}` });
    await hydrated(more);
    await more.click();
    await page.getByRole("menuitem", { name: "Move to top" }).click();
    await expect.poll(stored).toEqual([ids[2], ids[0], ids[1], ids[3]].map((id, i) => `${id}:${i + 1}`));
  });

  test("a fine pointer drags the handle from 1 to 3", { tag: "@at-w1280-light" }, async ({ page }) => {
    // a mouse drag runs once, at w1280-light.
    await queue(ids.slice(0, 4));
    await openList(page);
    const handle = page.getByRole("button", { name: `Reorder ${titleOf(ids[0])}, position 1 of 4` });
    await hydrated(handle);
    const from = (await handle.boundingBox())!;
    const target = (await page.locator(".qrow").nth(2).boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, target.y + target.height * 0.75, { steps: 12 });
    await page.mouse.up();
    await expect.poll(stored).toEqual([ids[1], ids[2], ids[0], ids[3]].map((id, i) => `${id}:${i + 1}`));
  });

  test("touch long-presses the handle to lift it, drags, and drops (1 → 3)", { tag: "@at-w390-touch" }, async ({ page }) => {
    // the touch route runs once, in w390-touch.
    await queue(ids.slice(0, 4));
    await openList(page);
    const handle = page.getByRole("button", { name: `Reorder ${titleOf(ids[0])}, position 1 of 4` });
    await hydrated(handle);
    const from = (await handle.boundingBox())!;
    const target = (await page.locator(".qrow").nth(2).boundingBox())!;
    const x = from.x + from.width / 2;
    const touch = (type: string, y: number, on: "handle" | "window") => (on === "handle" ? handle : page.locator("body"))
      .evaluate((el, a) => {
        const ev = new PointerEvent(a.type, { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: a.x, clientY: a.y });
        (a.on === "window" ? window : el).dispatchEvent(ev);
      }, { type, x, y, on });

    // A short touch does nothing: the row only lifts once the press is held.
    await touch("pointerdown", from.y + from.height / 2, "handle");
    await expect(page.locator("#dnd-live")).toHaveText(`${titleOf(ids[0])} grabbed. Position 1 of 4. Arrow keys move it, Space drops it, Esc cancels.`);
    await expect(page.locator(".qrow[data-lifted]")).toHaveCount(1);
    await touch("pointermove", target.y + target.height * 0.75, "window");
    await touch("pointerup", target.y + target.height * 0.75, "window");
    await expect.poll(stored).toEqual([ids[1], ids[2], ids[0], ids[3]].map((id, i) => `${id}:${i + 1}`));
  });

  test("a touch that lets go before the long press lifts nothing", { tag: "@at-w390-touch" }, async ({ page }) => {
    // the touch route runs once, in w390-touch.
    await queue(ids.slice(0, 3));
    await openList(page);
    const handle = page.getByRole("button", { name: `Reorder ${titleOf(ids[0])}, position 1 of 3` });
    await hydrated(handle);
    await handle.evaluate((el) => {
      el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 8, pointerType: "touch", isPrimary: true }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 8, pointerType: "touch", isPrimary: true }));
    });
    await page.waitForTimeout(800);
    await expect(page.locator(".qrow[data-lifted]")).toHaveCount(0);
    expect(await stored()).toEqual(ids.slice(0, 3).map((id, i) => `${id}:${i + 1}`));
  });

  test("an empty queue is one slate with one action", async ({ page }, info) => {
    await openList(page);
    await expect(page.locator("#queue-head + .empty")).toContainText("Nothing queued.");
    await expect(page.locator("#queue-head + .empty").getByRole("link")).toHaveCount(1);
    await floor(page);
    await screenshot(page, info, "queue-empty");
  });
});

test.describe("adding (AC-3)", () => {
  test("+ Up next appends, Read next goes to the top, and a queued run shows In Up next · #N everywhere", ONCE, async ({ page }) => {
    await page.goto(`/comics/${ids[4]}`);
    const add = page.getByRole("button", { name: `Add ${titleOf(ids[4])} to Up next` });
    await hydrated(add);
    await add.click();
    await expect(page.getByRole("link", { name: "In Up next · #1" })).toBeVisible();

    await page.goto(`/comics/${ids[5]}`);
    const next = page.getByRole("button", { name: `Read ${titleOf(ids[5])} next` });
    await hydrated(next);
    await next.click();
    await expect(page.getByRole("link", { name: "In Up next · #1" })).toBeVisible();
    await expect.poll(stored).toEqual([`${ids[5]}:1`, `${ids[4]}:2`]);

    // The run list and the dashboard's Ready when you are rows.
    await page.goto("/comics/runs");
    await expect(page.locator("article", { hasText: titleOf(ids[4]) }).getByRole("link", { name: "In Up next · #2" })).toBeVisible();
    const fromList = page.getByRole("button", { name: `Add ${titleOf(ids[6])} to Up next` });
    await hydrated(fromList);
    await fromList.click();
    await expect(page.locator("article", { hasText: titleOf(ids[6]) }).getByRole("link", { name: "In Up next · #3" })).toBeVisible();

    // The dashboard shows its first twelve ready runs, ties in any order: take the first one not queued.
    await page.goto("/comics");
    const ready = page.locator(".dash-side");
    await expect(ready.getByRole("link", { name: /^In Up next · #\d$/ }).first()).toBeVisible();
    const fromDash = ready.getByRole("button", { name: /^Add .* to Up next$/ }).first();
    await hydrated(fromDash);
    const name = (await fromDash.getAttribute("aria-label"))!.replace(/^Add (.*) to Up next$/, "$1");
    await fromDash.click();
    await expect(ready.locator("article", { hasText: name }).getByRole("link", { name: "In Up next · #4" })).toBeVisible();
    expect((await stored()).slice(0, 3)).toEqual([ids[5], ids[4], ids[6]].map((id, i) => `${id}:${i + 1}`));
  });
});
