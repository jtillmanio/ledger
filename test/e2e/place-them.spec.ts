// Task 2.8 (F-23, D-37, D-7): *Place them* in a real browser, against the TEST database. A year's bare-year
// lane on Up next is amber with *Place them*, and so is /books/plan's card; the sheet offers the year's books
// with no quarter one at a time, largest first, each quarter button carrying that quarter's total as
// plan_capacity gives it (amber *over* where it already is); a placement writes the quarter at its next
// ordinal and grows that quarter's total before the next book shows; Skip writes nothing; Stop leaves the rest
// in the lane; the closing card says whether the year still doesn't fit, in amber when it doesn't, never red.
// The roadmap Check's write clauses are test/plan-period.test.ts too. Figures are the fixture's own (D-7).
//
// The books are made here under *e2e-pt-* ids, in years no other spec plans in (this year + 3, + 4), and
// removed after the last test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { easternYear } from "../../src/lib/settings";
import { acceptedDay } from "../../src/lib/format";
import { kWords } from "../../src/lib/plan-rail";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

const Y = easternYear() + 3;
/** A year with books in a quarter and none bare (AC-5). */
const QUIET = Y + 1;
const q = (n: number, year = Y) => `${year}-Q${n}`;
const id = (key: string) => `e2e-pt-${key}`;

type Seed = { key: string; title: string; words: number; period: string; ordinal: number | null };
// Q1 is already over (amber *over* on its button); Q3 holds one book; three books sit in the year with no quarter.
const BOOKS: Seed[] = [
  { key: "q1", title: "Place Q1 Heavy", words: 800_000, period: q(1), ordinal: 1 },
  { key: "q3", title: "Place Q3 Holder", words: 100_000, period: q(3), ordinal: 1 },
  { key: "mid", title: "Place Middle", words: 150_000, period: String(Y), ordinal: null },
  { key: "big", title: "Place Biggest", words: 200_000, period: String(Y), ordinal: null },
  { key: "small", title: "Place Smallest", words: 90_000, period: String(Y), ordinal: null },
  { key: "quiet", title: "Place Quiet Year", words: 120_000, period: q(2, QUIET), ordinal: 1 },
];
const IDS = BOOKS.map((b) => id(b.key));

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE 'e2e-pt-%'`;
  await sql`DELETE FROM plan_acceptance WHERE year IN (${Y}, ${QUIET})`;
});

// The E2E user's reading settings, as an earlier spec left them: put aside, so every capacity here is the
// default one, and put back after. The suite runs one file at a time (workers: 1), so nothing races this.
let savedSettings: Record<string, unknown> | undefined;

test.beforeAll(async () => {
  await withSql(async (sql) => {
    [savedSettings] = await sql`SELECT * FROM reading_settings WHERE user_id = ${E2E_USER}`;
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
  });
});
test.afterAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    if (savedSettings) await sql`INSERT INTO reading_settings ${sql(savedSettings)}`;
  });
});

/** Every test starts from the same plan. `heavy` gives Q1 enough words to put the whole year over. */
async function seed({ heavy = false } = {}) {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) {
      const words = heavy && b.key === "q1" ? 2_900_000 : b.words;
      await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${id(b.key)}, ${b.title}, ${words}, 'stated')`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id(b.key)}, 'to_read')`;
      await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id(b.key)}, ${b.period}, ${b.ordinal})`;
    }
  });
}

/** Each fixture book's plan rows: `key → [period, ordinal]`. */
const plan = () => withSql(async (sql) => {
  const rows = await sql<{ book_id: string; period: string; ordinal: number | null }[]>`
    SELECT book_id, period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ANY(${IDS}::text[])
    ORDER BY book_id, period`;
  return Object.fromEntries(rows.map((r) => [r.book_id.replace("e2e-pt-", ""), [r.period, r.ordinal]]));
});
/** A period's figures as plan_capacity holds them. */
const capacity = (period: string) => withSql(async (sql) => {
  const [row] = await sql<{ planned_words: number; capacity: number }[]>`
    SELECT planned_words, capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`;
  return { planned: Number(row.planned_words), capacity: Number(row.capacity) };
});

const sheet = (page: Page) => page.getByRole("dialog", { name: new RegExp(`^Place ${Y}’s books`) });
const quarterButton = (scope: Locator, n: number) => scope.locator(`button.place-q[data-period="${q(n)}"]`);
const placeThem = (page: Page) => page.locator(`button[data-place-them="${Y}"]`);
const lane = (page: Page) => page.locator('section[data-plan="year"]').filter({
  has: page.getByRole("heading", { level: 2, name: new RegExp(`^${Y} · no quarter yet`) }),
});
const fifthLane = (page: Page) => page.locator(`.planrail .qcol.nq[data-period="${Y}"]`);

async function open(page: Page, url: string) {
  await page.goto(url);
  await hydrated(placeThem(page));
  await placeThem(page).click();
  const s = sheet(page);
  await expect(s).toBeVisible();
  await expect(s.locator("button.place-q").first()).toBeVisible();
  return s;
}

test("AC-1, AC-5: Up next's bare-year lane is amber with Place them; a year with none bare has neither lane nor button", CORE, async ({ page }) => {
  await seed();
  await page.goto("/books/status?tab=next");
  const held = lane(page);
  await expect(held).toHaveCount(1);
  await expect(held.locator(".lane-place")).toContainText(`In ${Y}, not in the plan`);
  await expect(held.locator(".lane-place .bdg")).toHaveText("3 unplaced");
  await expect(held.getByRole("button", { name: "Place them" })).toBeVisible();
  // Amber: the head is --blocked, the summary on --blocked-soft; nothing resolves to --danger.
  const blocked = await tokenColour(page, "--blocked");
  expect((await computedStyle(held.getByRole("heading", { level: 2 }), ["color"])).color).toBe(blocked);
  expect((await computedStyle(held.locator(".lane-place"), ["border-top-color"]))["border-top-color"]).toBe(blocked);
  const danger = await tokenColour(page, "--danger");
  expect(await held.locator("*").evaluateAll((els, d) => els.filter((el) => {
    const cs = getComputedStyle(el);
    return [cs.color, cs.backgroundColor, cs.borderTopColor].includes(d);
  }).length, danger)).toBe(0);

  // QUIET has a quarter book and nothing bare: no lane, no button, here or on its plan page.
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${QUIET} · Q2`) })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${QUIET} · no quarter yet`) })).toHaveCount(0);
  await expect(page.locator(`button[data-place-them="${QUIET}"]`)).toHaveCount(0);
  await page.goto(`/books/plan?year=${QUIET}`);
  await expect(page.locator('.planrail[role="group"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Place them" })).toHaveCount(0);
  await expect(page.locator(".plan-place")).toHaveCount(0);
});

test("AC-2, AC-3, Check: largest first; a placement writes the quarter's next ordinal and grows its total; Skip writes nothing", CORE, async ({ page }) => {
  await seed();
  const s = await open(page, "/books/status?tab=next");
  // Focus starts on the sheet's heading (AC-6).
  await expect(s.getByRole("heading", { name: `Place ${Y}’s books · 1 of 3` })).toBeFocused();
  await expect(s.locator(".place-title")).toHaveText("Place Biggest");

  // Each quarter button carries plan_capacity's total; Q1, already over, says so in amber.
  for (const n of [1, 2, 3, 4]) {
    await expect(quarterButton(s, n).locator(".mono")).toHaveText(kWords((await capacity(q(n))).planned));
  }
  await expect(quarterButton(s, 1).locator(".bdg")).toHaveText("over");
  await expect(quarterButton(s, 3).locator(".bdg")).toHaveCount(0);

  const before = await capacity(q(3));
  await quarterButton(s, 3).click();
  // The next book shows only once Q3 has grown by the placed book's words.
  await expect(s.getByRole("heading", { name: `Place ${Y}’s books · 2 of 3` })).toBeVisible();
  await expect(quarterButton(s, 3).locator(".mono")).toHaveText(kWords(before.planned + 200_000));
  await expect(s.locator(".place-title")).toHaveText("Place Middle");
  expect((await plan()).big).toEqual([q(3), 2]);
  expect((await capacity(q(3))).planned).toBe(before.planned + 200_000);

  // Skip advances and writes nothing.
  const skipped = await plan();
  await s.getByRole("button", { name: "Skip" }).click();
  await expect(s.getByRole("heading", { name: `Place ${Y}’s books · 3 of 3` })).toBeVisible();
  await expect(s.locator(".place-title")).toHaveText("Place Smallest");
  expect(await plan()).toEqual(skipped);

  await quarterButton(s, 2).click();
  const card = s.locator(".place-close");
  await expect(card).toBeVisible();
  // The year fits: a grey card that says so, with no congratulation.
  const year = await capacity(String(Y));
  await expect(card.locator(".dt-text")).toHaveText(`2 placed. 1 still has no quarter. ${Y} fits, with ${kWords(year.capacity - year.planned)} of room.`);
  await expect(card).not.toHaveAttribute("data-over");
  expect(await plan()).toMatchObject({ small: [q(2), 1], mid: [String(Y), null], big: [q(3), 2] });

  // Done closes it; focus is back on Place them, and the lane holds the one book skipped.
  await s.getByRole("button", { name: "Done" }).click();
  await expect(s).toHaveCount(0);
  await expect(placeThem(page)).toBeFocused();
  await expect(lane(page).locator(".lane-place .bdg")).toHaveText("1 unplaced");
  await expect(lane(page).locator(".row-title")).toHaveText(["Place Middle"]);
});

test("Check, AC-3, AC-4: on /books/plan the fifth lane drops by one, Stop leaves the rest, and an over year's closing card says so in amber", CORE, async ({ page }) => {
  await seed({ heavy: true });
  await page.goto(`/books/plan?year=${Y}`);
  await expect(fifthLane(page).locator(".bdg")).toHaveText("3 books");
  await expect(page.locator(".plan-place")).toContainText(`3 books sit in ${Y} with no quarter`);

  let s = await open(page, `/books/plan?year=${Y}`);
  await quarterButton(s, 4).click();
  await expect(s.getByRole("heading", { name: `Place ${Y}’s books · 2 of 3` })).toBeVisible();
  const stopped = await plan();
  await s.getByRole("button", { name: "Stop" }).click();
  await expect(s).toHaveCount(0);
  await expect(placeThem(page)).toBeFocused();
  // The remainder keeps its bare-year rows; the fifth lane counts one fewer.
  expect(await plan()).toEqual(stopped);
  expect(stopped).toMatchObject({ big: [q(4), 1], mid: [String(Y), null], small: [String(Y), null] });
  await expect(fifthLane(page).locator(".bdg")).toHaveText("2 books");

  s = await open(page, `/books/plan?year=${Y}`);
  await expect(s.locator(".place-title")).toHaveText("Place Middle");
  await quarterButton(s, 2).click();
  await expect(s.locator(".place-title")).toHaveText("Place Smallest");
  await quarterButton(s, 2).click();
  const card = s.locator(".place-close");
  const year = await capacity(String(Y));
  expect(year.planned).toBeGreaterThan(year.capacity);
  await expect(card.locator(".dt-text")).toHaveText(
    `2 placed. ${Y} is still over by ${kWords(year.planned - year.capacity)} — placing them made the overage visible, not smaller.`);
  await expect(card).toHaveAttribute("data-over", "true");
  // Amber, never red: the card's ring is --blocked, and nothing in the sheet resolves to --danger.
  expect((await computedStyle(card, ["border-top-color"]))["border-top-color"]).toBe(await tokenColour(page, "--blocked"));
  const danger = await tokenColour(page, "--danger");
  expect(await s.locator("*").evaluateAll((els, d) => els.filter((el) => {
    const cs = getComputedStyle(el);
    return [cs.color, cs.backgroundColor, cs.borderTopColor].includes(d);
  }).length, danger)).toBe(0);
  await expect(card).not.toContainText(/great|well done|congrat|!/i);
  await expect(s.getByRole("button", { name: "Done" })).toBeFocused();

  // Every book placed: the card and its button go, so focus lands on the page's heading.
  await s.getByRole("button", { name: "Done" }).click();
  await expect(s).toHaveCount(0);
  await expect(page.locator(".plan-place")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeFocused();
  await expect(fifthLane(page).locator(".bdg")).toHaveCount(0);
});

test("AC-6: Esc and Back close the sheet with focus back on Place them; every button is real, named and 44px on the phone", CORE, async ({ page }) => {
  await seed();
  for (const how of ["Escape", "Back"] as const) {
    const s = await open(page, "/books/status?tab=next");
    if (how === "Escape") await page.keyboard.press("Escape");
    else await page.goBack();
    await expect(s).toHaveCount(0);
    await expect(placeThem(page), how).toBeFocused();
  }
  const s = await open(page, "/books/status?tab=next");
  const buttons = s.getByRole("button");
  await expect(buttons).toHaveText([/^Q1/, /^Q2/, /^Q3/, /^Q4/, "Skip", "Stop"]);
  if (page.viewportSize()!.width < 768) {
    for (const box of await buttons.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  // Nothing was written by opening and closing.
  expect((await plan()).big).toEqual([String(Y), null]);
});

test("AC-6: screenshots at 360, 834 and 1280px, light and dark: no horizontal scroll, contrast 4.5:1, axe clean", { tag: "@at-w390-light" }, async ({ page }, info) => {
  await seed({ heavy: true });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      for (const [where, url] of [["up-next", "/books/status?tab=next"], ["plan", `/books/plan?year=${Y}`]] as const) {
        await page.goto(url);
        await hydrated(placeThem(page));
        await expectNoHorizontalScroll(page);
        expect(await contrastFailures(page), `${where} ${width}px ${scheme}`).toEqual([]);
        await expectNoAxeViolations(page, AXE, "main");
        await screenshot(page, info, `place-them-${where}-${width}-${scheme}`);
      }
      const s = await open(page, `/books/plan?year=${Y}`);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `sheet ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `place-them-sheet-${width}-${scheme}`);
      // The closing card, after skipping every book: nothing written.
      for (let i = 0; i < 3; i += 1) await s.getByRole("button", { name: "Skip" }).click();
      await expect(s.locator(".place-close")).toBeVisible();
      expect(await contrastFailures(page), `closing ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `place-them-closing-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(s).toHaveCount(0);
    }
  }
});

test("task 2.7: an over year's closing card offers Rebalance and Accept; Accept settles it with an Undo, Rebalance swaps the sheet", CORE, async ({ page }) => {
  await seed({ heavy: true });
  let s = await open(page, `/books/plan?year=${Y}`);
  // Skip every book: nothing is written, and the card says the year is still over.
  for (let i = 0; i < 3; i += 1) await s.getByRole("button", { name: "Skip" }).click();
  const card = s.locator(".place-close");
  await expect(card).toHaveAttribute("data-over", "true");
  const accept = card.getByRole("button", { name: "Accept as a stretch year" });
  await expect(card.getByRole("button", { name: `Rebalance ${Y}` })).toBeVisible();
  await expect(accept).toBeVisible();
  await expect(card).toHaveClass("decide place-close");

  // Accept: the row is stored, and the card turns the settled grey with today's date and an Undo, focused.
  await accept.click();
  await expect(card).toHaveAttribute("data-state", "settled");
  await expect(card).toHaveClass("decide settled place-close");
  const [row] = await withSql((sql) => sql<{ accepted_at: Date }[]>`SELECT accepted_at FROM plan_acceptance WHERE year = ${Y}`);
  expect(row).toBeDefined();
  await expect(card.locator(".dt-text")).toContainText(`accepted as a stretch year on ${acceptedDay(row.accepted_at.toISOString())}.`);
  const undo = card.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  await undo.click();
  await expect(card).not.toHaveAttribute("data-state", "settled");
  await expect(card).toHaveClass("decide place-close");
  expect(await withSql((sql) => sql`SELECT 1 FROM plan_acceptance WHERE year = ${Y}`)).toHaveLength(0);
  await expect(accept).toBeFocused();

  // Rebalance: the same sheet becomes the Rebalance sheet (one sheet, one history entry), heading focused.
  await card.getByRole("button", { name: `Rebalance ${Y}` }).click();
  const rebalance = page.getByRole("dialog", { name: `Rebalance ${Y}` });
  await expect(rebalance.getByRole("heading", { name: `Rebalance ${Y}` })).toBeFocused();
  await expect(rebalance.locator("button.rb-go")).toHaveCount(4);
  await page.keyboard.press("Escape");
  await expect(rebalance).toHaveCount(0);
  await expect(placeThem(page)).toBeFocused();

  // A year accepted already: the closing card opens settled.
  await page.request.post("/api/plan/rebalance", { data: { action: "accept", year: Y } });
  s = await open(page, `/books/plan?year=${Y}`);
  for (let i = 0; i < 3; i += 1) await s.getByRole("button", { name: "Skip" }).click();
  await expect(s.locator(".place-close")).toHaveAttribute("data-state", "settled");
  await expect(s.locator(".place-close").getByRole("button", { name: "Undo" })).toBeVisible();
  await page.keyboard.press("Escape");
});