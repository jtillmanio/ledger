// Task 2.10, 2 of 2 (F-23, D-33, D-37; Plan Rail Spec A4.4): the plan page's desktop pointer routes. With a fine
// pointer at 1280px a block drags to another quarter or the fifth lane, showing a ghost and output.dropdelta's
// total after before release, and writes through 2.3's move with an Undo; hovering a block names it. With touch
// emulated at 390px and 834px nothing drags or hovers and a tap opens the Move sheet. The roadmap Check (AC-1) is
// plan-rail.spec.ts, unchanged and re-run with the drag in place. Figures are the fixture's own (D-7).
//
// The books are made here under *e2e-drag-* ids, in next year, and removed after each test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { today } from "../../src/lib/finish-date";
import { kWords } from "../../src/lib/plan-rail";
import { testSql, type TestSql } from "../db";
import { expectNoAxeViolations, hydrated, screenshot } from "./helpers";

const DESK = { tag: "@at-w1280-light" };
// Sets its own viewport and touch: runs once, in w390-light.
const TOUCH = { tag: "@at-w390-light" };

const DAY = today();
const Y = Number(DAY.slice(0, 4)) + 1;
const PAGE = `/books/plan?year=${Y}`;
const q = (n: number) => `${Y}-Q${n}`;
const LANE = String(Y);
const id = (key: string) => `e2e-drag-${key}`;

type Seed = { key: string; title: string; period: string; ordinal: number | null; words?: number; pages?: number; genre?: string | null };

// Q1 holds three books in order; Q3 one; Q2 and Q4 none; the year's lane one. Est has pages and no words: estimated.
const BOOKS: Seed[] = [
  { key: "a1", title: "Drag Alpha One", period: q(1), ordinal: 1, words: 200_000, genre: "Fantasy" },
  { key: "a2", title: "Drag Alpha Two", period: q(1), ordinal: 2, words: 150_000, genre: "Mystery" },
  { key: "a3", title: "Drag Alpha Three", period: q(1), ordinal: 3, words: 120_000, genre: "Fantasy" },
  { key: "c1", title: "Drag Charlie One", period: q(3), ordinal: 1, words: 300_000, genre: "History" },
  { key: "est", title: "Drag Estimated", period: q(4), ordinal: 1, pages: 460, genre: "Fantasy" },
  { key: "y1", title: "Drag Year One", period: LANE, ordinal: null, words: 100_000, genre: "Memoir" },
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
  await sql`DELETE FROM books WHERE id LIKE 'e2e-drag-%'`;
});
test.beforeEach(clean);
test.afterEach(clean);

async function seed() {
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      await sql`INSERT INTO books (id, title, genre, word_count, word_count_source, page_count)
        VALUES (${id(b.key)}, ${b.title}, ${b.genre ?? null}, ${b.words ?? null}, ${b.words == null ? null : "stated"}, ${b.pages ?? null})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id(b.key)}, 'to_read')`;
      await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id(b.key)}, ${b.period}, ${b.ordinal})`;
    }
  });
}

/** Every plan row of the fixture: `key → [period, ordinal]`, sorted by key. */
const plan = () => withSql(async (sql) => {
  const rows = await sql<{ book_id: string; period: string; ordinal: number | null }[]>`
    SELECT book_id, period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id LIKE 'e2e-drag-%' ORDER BY book_id, period`;
  return rows.map((r) => [r.book_id.replace("e2e-drag-", ""), r.period, r.ordinal]);
});

/** A quarter's figures as `plan_capacity` holds them: what its footer and its summary row print. */
const quarter = (period: string) => withSql(async (sql) => {
  const [row] = await sql<{ planned_words: number; capacity: number }[]>`
    SELECT planned_words, capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`;
  return { planned: Number(row?.planned_words ?? 0), capacity: Number(row.capacity) };
});

/** A book's words as the rail counts them. */
const wordsOf = (key: string) => withSql(async (sql) => {
  const [row] = await sql<{ words: number }[]>`SELECT words FROM plan_book_words WHERE user_id = ${E2E_USER} AND book_id = ${id(key)}`;
  return Number(row.words);
});

async function open(page: Page) {
  await page.goto(PAGE);
  await page.locator('.planrail[role="group"]').waitFor();
  await expect(page.locator("main[aria-busy]")).toHaveCount(0);
  await hydrated(block(page, "a1"));
}

const block = (page: Page, key: string) => page.locator(`.planrail button.qb[data-book="${id(key)}"]`);
const column = (page: Page, period: string) => page.locator(`.planrail .qcol[data-period="${period}"]`);
const readout = (page: Page) => page.locator("output.dropdelta");
const ghost = (page: Page) => page.locator(".rail-ghost");

async function centre(el: Locator) {
  const box = await el.boundingBox();
  if (!box) throw new Error("not drawn");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses a block with the mouse and carries it over `over`'s stack, without letting go. */
async function lift(page: Page, from: Locator, over: Locator) {
  const a = await centre(from);
  const b = await centre(over.locator(".qstack"));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 8, a.y - 8, { steps: 2 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
}

/** Counts the plan writes the page sends. */
function writes(page: Page) {
  const sent: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/plan") && r.method() !== "GET") sent.push(`${r.method()} ${r.postData() ?? ""}`);
  });
  return sent;
}

test.describe("at 1280px with a fine pointer", DESK, () => {
  test.beforeEach(async ({ page }) => {
    await seed();
    await open(page);
  });

  test("dragging a Q1 block over Q3 shows the ghost and Q3's total after; release puts it last in Q3 and Q1 closes up; Undo restores both (AC-2)", async ({ page }) => {
    const [q3, words] = await Promise.all([quarter(q(3)), wordsOf("a1")]);
    // The readout reads the figure Q3's own footer prints.
    await expect(column(page, q(3)).locator(".qfoot .mono")).toHaveText(new RegExp(`^${kWords(q3.planned)}`));
    const before = await plan();

    await lift(page, block(page, "a1"), column(page, q(3)));
    await expect(ghost(page)).toBeVisible();
    await expect(block(page, "a1")).toHaveAttribute("data-lifted", "true");
    await expect(column(page, q(3))).toHaveAttribute("data-drop", "true");
    await expect(readout(page)).toHaveText(`Q3 +${kWords(words)} → ${kWords(q3.planned + words)} / ${kWords(q3.capacity)}`);
    // Nothing is written before release.
    expect(await plan()).toEqual(before);

    await page.mouse.up();
    await expect(ghost(page)).toHaveCount(0);
    await expect.poll(plan).toEqual([
      ["a1", q(3), 2], ["a2", q(1), 1], ["a3", q(1), 2], ["c1", q(3), 1], ["est", q(4), 1], ["y1", LANE, null],
    ]);
    await expect(column(page, q(3)).locator(`button.qb[data-book="${id("a1")}"]`)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(readout(page)).toHaveText("");

    const toast = page.locator(".toast");
    await expect(toast.locator(".toast-label")).toHaveText(`Moved to Q3 ${Y}`);
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect.poll(plan).toEqual(before);
    await expect(column(page, q(1)).locator(`button.qb[data-book="${id("a1")}"]`)).toBeVisible();
  });

  test("dropping a block on the fifth lane writes a bare-year row with no ordinal, and its quarter closes up (AC-3)", async ({ page }) => {
    const [words, lane] = await Promise.all([wordsOf("a2"), wordsOf("y1")]);
    await lift(page, block(page, "a2"), column(page, LANE));
    await expect(column(page, LANE)).toHaveAttribute("data-drop", "true");
    await expect(readout(page)).toHaveText(`${Y} +${kWords(words)} → ${kWords(lane + words)}`);
    await page.mouse.up();
    await expect.poll(plan).toEqual([
      ["a1", q(1), 1], ["a2", LANE, null], ["a3", q(1), 2], ["c1", q(3), 1], ["est", q(4), 1], ["y1", LANE, null],
    ]);
  });

  test("dropping a block back on its own quarter writes nothing and opens no sheet; nor does Esc mid-drag (AC-3)", async ({ page }) => {
    const sent = writes(page);
    const before = await plan();
    await lift(page, block(page, "a2"), column(page, q(1)));
    await expect(ghost(page)).toBeVisible();
    await expect(readout(page)).toHaveText("Q1 · already here");
    await expect(column(page, q(1))).not.toHaveAttribute("data-drop");
    await page.mouse.up();
    await expect(ghost(page)).toHaveCount(0);

    await lift(page, block(page, "a3"), column(page, q(2)));
    await expect(column(page, q(2))).toHaveAttribute("data-drop", "true");
    await page.keyboard.press("Escape");
    await expect(ghost(page)).toHaveCount(0);
    await expect(readout(page)).toHaveText("");
    await page.mouse.up();

    // Long enough for a stray write or sheet to have shown.
    await page.waitForTimeout(500);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(sent).toEqual([]);
    expect(await plan()).toEqual(before);
  });

  test("a plain click on a block still opens the Move sheet (the keyboard and touch route stays)", async ({ page }) => {
    await block(page, "a2").click();
    await expect(page.getByRole("dialog", { name: "Drag Alpha Two" })).toBeVisible();
  });

  test("hovering a block shows its title and words, and estimated only for an estimated count (AC-4)", async ({ page }) => {
    const pop = page.locator(".bpop");
    const est = await wordsOf("est");
    const at = await centre(block(page, "est"));
    await page.mouse.move(at.x, at.y);
    await expect(pop).toBeVisible();
    await expect(pop.locator(".bpop-title")).toHaveText("Drag Estimated");
    await expect(pop.locator(".bpop-words")).toHaveText(`~${kWords(est)} words`);
    await expect(pop.locator(".bpop-est")).toHaveText("estimated");

    const stated = await centre(block(page, "a1"));
    await page.mouse.move(stated.x, stated.y);
    await expect(pop.locator(".bpop-title")).toHaveText("Drag Alpha One");
    await expect(pop.locator(".bpop-words")).toHaveText(`${kWords(200_000)} words`);
    await expect(pop.locator(".bpop-est")).toHaveCount(0);
    // It names the block, which already carries the same name: hidden from assistive tech, inside the viewport.
    await expect(pop).toHaveAttribute("aria-hidden", "true");
    const box = await pop.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);

    await page.mouse.move(5, 5);
    await expect(pop).toHaveCount(0);
  });

  test("the readout is announced, the ghost is the spec's, and axe finds nothing mid-drag; screenshots light and dark (AC-5)", async ({ page }, info) => {
    await expect(readout(page)).toHaveAttribute("aria-live", "polite");
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await lift(page, block(page, "a1"), column(page, q(3)));
      await expect(ghost(page)).toBeVisible();
      const look = await ghost(page).evaluate((el) => {
        const s = getComputedStyle(el);
        return { transform: s.transform, outline: `${s.outlineStyle} ${s.outlineWidth}`, shadow: s.boxShadow };
      });
      // rotate(-1.5deg) resolves to a matrix whose b is sin(-1.5deg).
      const b = Number(look.transform.match(/matrix\(([^)]+)\)/)?.[1].split(",")[1]);
      expect(b).toBeCloseTo(Math.sin((-1.5 * Math.PI) / 180), 3);
      expect(look.outline).toBe("dashed 2px");
      expect(look.shadow).not.toBe("none");
      await expectNoAxeViolations(page, ["aria-hidden-focus", "aria-allowed-attr", "aria-valid-attr-value", "button-name", "color-contrast", "target-size"], "main");
      await screenshot(page, info, `plan-drag-1280-${scheme}`);
      await page.keyboard.press("Escape");
      await page.mouse.up();
    }
  });

  test("under reduced motion the ghost neither turns nor animates (AC-5)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await lift(page, block(page, "a1"), column(page, q(3)));
    await expect(ghost(page)).toBeVisible();
    expect(await ghost(page).evaluate((el) => [getComputedStyle(el).transform, getComputedStyle(el).animationName]))
      .toEqual(["none", "none"]);
    await page.keyboard.press("Escape");
    await page.mouse.up();
  });
});

for (const [width, height] of [[390, 844], [834, 1112]]) {
  test.describe(`with touch at ${width}px`, TOUCH, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`no drag starts and nothing hovers; a tap opens the Move sheet (AC-4, AC-5)`, async ({ page }) => {
      await seed();
      await open(page);
      expect(await page.evaluate(() => matchMedia("(hover:hover) and (pointer:fine)").matches)).toBe(false);
      const a1 = block(page, "a1");
      const at = await centre(a1);
      const target = await centre(column(page, q(3)).locator(".qstack"));
      // A touch press carried across the rail, as a finger would.
      const sent = writes(page);
      const touch = { pointerType: "touch", isPrimary: true, pointerId: 7, button: 0, buttons: 1 };
      await a1.dispatchEvent("pointerover", { ...touch, clientX: at.x, clientY: at.y });
      await a1.dispatchEvent("pointerenter", { ...touch, clientX: at.x, clientY: at.y });
      await a1.dispatchEvent("pointerdown", { ...touch, clientX: at.x, clientY: at.y });
      for (const f of [0.25, 0.5, 1]) {
        await a1.dispatchEvent("pointermove", { ...touch, clientX: at.x + (target.x - at.x) * f, clientY: at.y + (target.y - at.y) * f });
      }
      await expect(ghost(page)).toHaveCount(0);
      await expect(page.locator(".bpop")).toHaveCount(0);
      await expect(page.locator("[data-lifted], [data-drop]")).toHaveCount(0);
      await a1.dispatchEvent("pointerup", { ...touch, buttons: 0, clientX: target.x, clientY: target.y });
      await expect(readout(page)).toBeHidden();
      expect(sent).toEqual([]);

      await a1.tap();
      await expect(page.getByRole("dialog", { name: "Drag Alpha One" })).toBeVisible();
    });
  });
}
