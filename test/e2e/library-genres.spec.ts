// @area: books
// Task 4.5 (D-98, AC-2, AC-3, AC-6): the Library's genre chips are Calibre's top-level genres, read
// through book_genre_tree, in a browser. A chip finds a book tagged only with a subgenre of it, the row
// names that subgenre, and the chips are real named links, 44px on the phone, in one row that scrolls
// sideways without the page scrolling. The books are made here under E2E genre names the rest of the
// suite doesn't use, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { FLOOR, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "link-name", "button-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "landmark-unique", "duplicate-id-aria", "target-size",
];

/** Twenty-four top-level genres: enough to run past a 360px row, and for a held arrow at 1280px to go
 *  further than a tap before the end (task 6.26). Alpha's two books are tagged below it only. */
const WORDS = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima",
  "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray",
];
const BOOKS = [
  ...WORDS.slice(1).map((w) => ({ id: `e2e-gen-${w.toLowerCase()}`, title: `E2E Gen ${w} book`, genres: [`E2E Gen ${w}`] })),
  { id: "e2e-gen-sub", title: "E2E Gen Subgenre only", genres: ["E2E Gen Alpha.E2E Gen Epic"] },
  { id: "e2e-gen-deep", title: "E2E Gen Deeper only", genres: ["E2E Gen Alpha.E2E Gen Epic.E2E Gen Dragons"] },
];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

// Their genres and statuses first: book_genres and book_status reference the book.
const clean = () => withSql(async (sql) => {
  const ids = BOOKS.map((b) => b.id);
  await sql`DELETE FROM book_genres WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM book_status WHERE book_id = ANY(${ids}::text[])`;
  await sql`DELETE FROM books WHERE id = ANY(${ids}::text[])`;
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      for (const g of b.genres) await sql`INSERT INTO book_genres (book_id, genre) VALUES (${b.id}, ${g})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
  });
});
test.afterAll(clean);

const genres = (page: Page) => page.getByRole("group", { name: "Genre" });
const chip = (page: Page, name: string) => genres(page).getByRole("link", { name, exact: true });
const scroller = (page: Page) => genres(page).locator(".genre-row");
const leftArrow = (page: Page) => page.getByRole("button", { name: "Scroll genres left" });
const rightArrow = (page: Page) => page.getByRole("button", { name: "Scroll genres right" });

async function open(page: Page, path = "/books/list") {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Library");
  await expect(chip(page, "E2E Gen Alpha")).toBeVisible();
}

test("a top-level chip lists the books tagged only with its subgenres, each row naming its own (AC-2, AC-3)", async ({ page }) => {
  await open(page);
  await chip(page, "E2E Gen Alpha").click();
  await expect(page).toHaveURL(/genre=E2E(\+|%20)Gen(\+|%20)Alpha/);
  await expect(chip(page, "E2E Gen Alpha")).toHaveAttribute("aria-current", "true");
  const rows = page.locator(".book-row");
  await expect(rows.locator(".row-title")).toHaveText(["E2E Gen Deeper only", "E2E Gen Subgenre only"]);
  // The deepest path's last segment.
  await expect(rows.filter({ hasText: "E2E Gen Subgenre only" }).locator(".row-sub")).toHaveText("E2E Gen Epic");
  await expect(rows.filter({ hasText: "E2E Gen Deeper only" }).locator(".row-sub")).toHaveText("E2E Gen Dragons");

  // A deeper path, from the URL: the subgenre's books, not its parent's others.
  await page.goto("/books/list?genre=E2E%20Gen%20Alpha.E2E%20Gen%20Epic.E2E%20Gen%20Dragons");
  await expect(page.locator(".book-row .row-title")).toHaveText(["E2E Gen Deeper only"]);
});

test("the genre chips are named links in one row that scrolls sideways, never the page; none under 24px, 44px on the phone (AC-6)", FLOOR, async ({ page }, info) => {
  await open(page);
  const width = page.viewportSize()!.width;
  const links = genres(page).getByRole("link");
  // Each of ours, by its full name (a top-level chip's text is its whole path).
  for (const w of WORDS) await expect(chip(page, `E2E Gen ${w}`)).toHaveCount(1);
  const floor = width < 768 ? 44 : 24;
  for (const box of await links.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect))) {
    expect(box.height, `chip height at ${width}px`).toBeGreaterThanOrEqual(floor);
    expect(box.width).toBeGreaterThanOrEqual(24);
  }
  // One line: every chip on the first chip's row.
  const tops = await links.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  expect(new Set(tops).size, "chip rows").toBe(1);
  if (width < 768) {
    // On the phone the row runs past its box and scrolls itself (the scroller inside the group, task 6.26).
    const row = await scroller(page).evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, overflow: getComputedStyle(el).overflowX }));
    expect(row.scroll).toBeGreaterThan(row.client);
    expect(row.overflow).toBe("auto");
  }
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "library-genres");
});

// Task 6.24 (TASK-145, MR-D20, frame E7, AC-1, AC-2): Owned and Sort are two dropdown chips on one row, above the
// genre row, each naming its choice; nothing scrolls sideways. Sets its own viewports and themes: runs once.
test("the Owned and Sort dropdown chips share one row above the genre row at every width, light and dark, and nothing scrolls sideways (AC-1, AC-2, AC-5)", ONCE, async ({ page }, info) => {
  const owned = page.getByRole("button", { name: /^Owned: / });
  const sort = page.getByRole("button", { name: /^Sort: / });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, "/books/list?genre=E2E%20Gen%20Alpha");
      const label = `${width}px ${colorScheme}`;
      await expect(owned).toHaveText("Owned: Any");
      await expect(sort).toHaveText("Sort: Series");
      // One row: the chips' boxes share a top edge, and the genre row is below it.
      const [o, s, g] = await Promise.all([owned.boundingBox(), sort.boundingBox(), genres(page).boundingBox()]);
      expect(o!.y, `chip tops at ${label}`).toBe(s!.y);
      expect(g!.y, `genre row under the chips at ${label}`).toBeGreaterThanOrEqual(o!.y + o!.height);
      // The chips are in the "More filters" group, which comes before the genres in the page.
      const order = await page.locator("main > .filters:not([role=search])").evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
      expect(order.slice(-2)).toEqual(["More filters", "Genre"]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `scrollWidth at ${label}`).toBe(width);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), label).toEqual([]);
      await screenshot(page, info, `library-dropdowns-${width}-${colorScheme}`);

      // Each opens within the screen, and the page still doesn't scroll sideways.
      for (const [chip, group] of [[owned, "Owned"], [sort, "Sort"]] as const) {
        await hydrated(chip);
        await chip.click();
        const box = (await page.getByRole("group", { name: group, exact: true }).boundingBox())!;
        expect(box.x, `${group} list at ${label}`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${group} list at ${label}`).toBeLessThanOrEqual(width);
        await expectNoHorizontalScroll(page);
        expect(await contrastFailures(page), `${group} open at ${label}`).toEqual([]);
        await screenshot(page, info, `library-dropdowns-${group.toLowerCase()}-${width}-${colorScheme}`);
        await page.keyboard.press("Escape");
      }
    }
  }
});

// Sets its own viewports and themes: runs once, in w390-light.
test("the genre row at 360, 834 and 1280px, light and dark: no sideways page scroll (AC-6)", ONCE, async ({ page }, info) => {
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page, "/books/list?genre=E2E%20Gen%20Alpha");
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `library-genres-${width}-${colorScheme}`);
    }
  }
});

// Task 6.26 (TASK-163): from 768px the genre row hides the browser's scrollbar and draws an arrow at
// each end that has more; a tap scrolls about the row's width, smoothly, and a held press keeps going
// until release. The phone keeps the swipe. Each test sets its own viewport: runs once, in w390-light.

/** Records the scroller's scrollLeft on every animation frame for `ms`, while `act` runs. */
async function framesDuring(page: Page, ms: number, act: () => Promise<unknown>): Promise<number[]> {
  const sampled = page.evaluate((ms) => new Promise<number[]>((resolve) => {
    const el = document.querySelector<HTMLElement>('[role="group"][aria-label="Genre"] .genre-row')!;
    const out: number[] = [];
    const end = performance.now() + ms;
    const tick = (now: number) => {
      out.push(el.scrollLeft);
      if (now < end) requestAnimationFrame(tick);
      else resolve(out);
    };
    requestAnimationFrame(tick);
  }), ms);
  await act();
  return sampled;
}

/** At 1280px; motion as asked, never the machine's own setting (a Windows runner can report reduce). */
/** As framesDuring, with each frame's time: [ms, scrollLeft]. */
async function timedFramesDuring(page: Page, ms: number, act: () => Promise<unknown>): Promise<[number, number][]> {
  const sampled = page.evaluate((ms) => new Promise<[number, number][]>((resolve) => {
    const el = document.querySelector<HTMLElement>('[role="group"][aria-label="Genre"] .genre-row')!;
    const out: [number, number][] = [];
    let end = -1;
    const tick = (now: number) => {
      if (end < 0) end = now + ms;
      out.push([now, el.scrollLeft]);
      if (now < end) requestAnimationFrame(tick);
      else resolve(out);
    };
    requestAnimationFrame(tick);
  }), ms);
  await act();
  return sampled;
}

async function desktop(page: Page, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await hydrated(rightArrow(page));
  await expect(rightArrow(page)).toBeVisible();
}

/** Back to the row's start, and the arrows measured again. */
async function toStart(page: Page) {
  await scroller(page).evaluate((el) => { el.scrollLeft = 0; });
  await expect(leftArrow(page)).toHaveCount(0);
}

const scrollLeft = (page: Page) => scroller(page).evaluate((el) => el.scrollLeft);

/** The WCAG contrast of each drawn arrow's glyph against its disc. */
function glyphContrast(page: Page): Promise<number[]> {
  return page.locator(".genre-arrow:not([hidden]) span").evaluateAll((spans) => spans.map((span) => {
    const lum = (css: string) => {
      const [r, g, b, a = 1] = css.match(/[\d.]+/g)!.map(Number);
      if (a < 1) throw new Error(`a see-through colour: ${css}`);
      const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const cs = getComputedStyle(span);
    const [hi, lo] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }));
}

test("at 1280px the genre row draws no scrollbar and no ‹ at the start; a tap on › scrolls about its width over several frames, a held press further and stops on release, and › goes at the end (6.26 AC-1)", ONCE, async ({ page }) => {
  await desktop(page);
  const row = scroller(page);
  // No native scrollbar: none drawn, and none taking height under the chips.
  expect(await row.evaluate((el: HTMLElement) => ({ bar: getComputedStyle(el).scrollbarWidth, gutter: el.offsetHeight - el.clientHeight })))
    .toEqual({ bar: "none", gutter: 0 });
  await expect(leftArrow(page)).toHaveCount(0);
  const width = await row.evaluate((el) => el.clientWidth);

  // A tap: several frames between the start and where it lands, about a row's width on.
  const tap = await framesDuring(page, 700, () => rightArrow(page).click());
  const landed = tap[tap.length - 1];
  expect(landed, "a tap's distance").toBeGreaterThanOrEqual(0.6 * width);
  expect(landed, "a tap's distance").toBeLessThanOrEqual(width);
  const between = new Set(tap.filter((x) => x > 0 && x < landed));
  expect(between.size, `frames between 0 and ${landed}: ${tap.join(", ")}`).toBeGreaterThanOrEqual(3);
  await expect(leftArrow(page)).toBeVisible();

  // A hold of a second goes further than the tap, and nothing moves once it is let go.
  await toStart(page);
  // Steady: once moving, no frame slows below half the glide's speed (0.9 px/ms) before release,
  // so the tap's ease-out hands over to the glide with no stop between them.
  await rightArrow(page).hover();
  const held = await timedFramesDuring(page, 1_000, () => page.mouse.down());
  await page.mouse.up();
  const released = await scrollLeft(page);
  expect(released, "a hold's distance against a tap's").toBeGreaterThan(landed);
  const max = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
  const moving = held.findIndex(([, x]) => x > 0);
  for (let i = Math.max(1, moving + 1); i < held.length; i++) {
    const [[t0, x0], [t1, x1]] = [held[i - 1], held[i]];
    if (x1 >= max - 1) break;
    expect((x1 - x0) / (t1 - t0), `speed at ${Math.round(t1 - held[0][0])}ms: ${held.map(([, x]) => Math.round(x)).join(", ")}`)
      .toBeGreaterThanOrEqual(0.45);
  }
  await page.waitForTimeout(300);
  expect(await scrollLeft(page), "after release").toBe(released);

  // At the end › goes, and ‹ stays.
  for (let i = 0; i < 12 && (await rightArrow(page).count()) > 0; i++) {
    await rightArrow(page).click();
    await page.waitForTimeout(400);
  }
  await expect(rightArrow(page)).toHaveCount(0);
  await expect(leftArrow(page)).toBeVisible();
  expect(await row.evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft)).toBeLessThanOrEqual(1);
});

test("under reduced motion a tap on › moves the row in one frame (6.26 AC-1)", ONCE, async ({ page }) => {
  await desktop(page, "reduce");
  const width = await scroller(page).evaluate((el) => el.clientWidth);
  const tap = await framesDuring(page, 400, () => rightArrow(page).click());
  const moved = new Set(tap.filter((x) => x !== tap[0]));
  expect(moved.size, `frames after the tap: ${tap.join(", ")}`).toBe(1);
  expect([...moved][0]).toBeGreaterThanOrEqual(0.6 * width);
});

// On the touch project (a phone, touch events on), narrowed to 360px.
test("at 360px the genre row draws no arrows and still scrolls by touch (6.26 AC-1)", { tag: "@at-w390-touch" }, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page);
  await hydrated(chip(page, "E2E Gen Alpha"));
  await expect(leftArrow(page)).toHaveCount(0);
  await expect(rightArrow(page)).toHaveCount(0);
  const box = (await scroller(page).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  // A finger drawn 200px to the left across the row: it scrolls on towards its end.
  const y = Math.round(box.y + box.height / 2);
  const x0 = Math.round(box.x + box.width * 0.8);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let dx = 20; dx <= 200; dx += 20) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - dx, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(0);
});

test("Enter and Space on a focused arrow each scroll one step; tabbing through the chips scrolls each fully into view, clear of the arrows (6.26 AC-3)", ONCE, async ({ page }) => {
  await desktop(page);
  const width = await scroller(page).evaluate((el) => el.clientWidth);
  const settle = async () => { await page.waitForTimeout(500); return scrollLeft(page); };

  await rightArrow(page).focus();
  await page.keyboard.press("Enter");
  const first = await settle();
  expect(first, "Enter's step").toBeGreaterThanOrEqual(0.6 * width);
  expect(first, "Enter's step").toBeLessThanOrEqual(width);
  await page.keyboard.press("Space");
  const second = await settle();
  expect(second - first, "Space's step").toBeGreaterThanOrEqual(0.6 * width);
  expect(second - first, "Space's step").toBeLessThanOrEqual(width);

  await toStart(page);
  const links = genres(page).getByRole("link");
  const count = await links.count();
  await links.first().focus();
  for (let i = 0; i < count; i++) {
    if (i > 0) await page.keyboard.press("Tab");
    // Empty when the focused chip is the i-th, inside the scroller and under no arrow drawn.
    await expect.poll(() => page.evaluate((i) => {
      const group = document.querySelector('[role="group"][aria-label="Genre"]')!;
      const row = group.querySelector(".genre-row")!;
      const chip = row.querySelectorAll("a")[i];
      if (document.activeElement !== chip) return `focus is on ${document.activeElement?.textContent}`;
      const c = chip.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (c.left < r.left - 1 || c.right > r.right + 1) return `${chip.textContent} outside the row`;
      for (const a of group.querySelectorAll<HTMLElement>("button:not([hidden])")) {
        const b = a.getBoundingClientRect();
        if (c.right > b.left + 1 && c.left < b.right - 1) return `${chip.textContent} under ${a.getAttribute("aria-label")}`;
      }
      return "";
    }, i), `chip ${i + 1} of ${count}`).toBe("");
  }
});

test("the arrows are named, their icons meet 3:1 in both themes, and axe passes; the row at every width, light and dark (6.26 AC-4)", ONCE, async ({ page }, info) => {
  // Pinned to one project, the helpers check only the theme it is in: both are set here.
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const [width, height] of [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await open(page);
      await hydrated(chip(page, "E2E Gen Alpha"));
      const label = `${width}px ${colorScheme}`;
      if (width >= 768) {
        // Part way along, so both arrows are drawn.
        await scroller(page).evaluate((el) => { el.scrollLeft = 300; });
        await expect(leftArrow(page), label).toBeVisible();
        await expect(rightArrow(page), label).toBeVisible();
        // Each glyph on its own disc, measured here as well as by contrastFailures: 3:1 for an icon.
        const ratios = await glyphContrast(page);
        expect(ratios, `both glyphs measured at ${label}`).toHaveLength(2);
        for (const ratio of ratios) expect(ratio, `arrow glyph at ${label}`).toBeGreaterThanOrEqual(3);
        if (width === 1280) await expectNoAxeViolations(page, AXE);
      } else {
        await expect(page.getByRole("button", { name: /^Scroll genres/ }), label).toHaveCount(0);
      }
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), label).toEqual([]);
      await screenshot(page, info, `library-genre-arrows-${width}-${colorScheme}`);
    }
  }
});
