// @area: books
// Task 2.10b, part 2 (TASK-072; F-65, F-68, D-104, D-108, D-7): the planning sheet in a real browser, against the
// TEST database. /books/plan's *Plan 2027…*, *Plan this quarter…* and *Suggest* open it; it lists the suggestions
// grouped by why (TASK-071's plan_suggestions), five a group then *More*; *Put in Q2* is 2.3's write, pushes an
// undo, reads *✓ In Q2 · Undo* and leaves the sheet open; the budget line is the target against its capacity, amber
// with *Accept as a stretch year* past it, never red. Below 1024px it is the shared sheet; from 1024px a side rail.
//
// The fixture is the roadmap Check's, made here under *e2e-ps-* ids in next year (no other spec plans there and
// leaves it planned), and removed after the last test. Figures are the fixture's own (D-7).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { easternYear } from "../../src/lib/settings";
import { kWords } from "../../src/lib/plan-rail";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

const Y = easternYear() + 1;
const q = (n: number) => `${Y}-Q${n}`;
const Q2 = q(2);
const id = (key: string) => `e2e-ps-${key}`;
/** The room Q2 has left once the filler is in. */
const ROOM = 100_000;

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE 'e2e-ps-%'`;
  await sql`DELETE FROM book_series WHERE id LIKE 'e2e-ps-%'`;
  await sql`DELETE FROM shelves WHERE id LIKE 'e2e-ps-%'`;
  await sql`DELETE FROM authors WHERE id LIKE 'e2e-ps-%'`;
  await sql`DELETE FROM book_universes WHERE id LIKE 'e2e-ps-%'`;
  await sql`DELETE FROM plan_acceptance WHERE year = ${Y}`;
});

// The E2E user's reading settings, as an earlier spec left them: put aside, so every capacity here is the default
// one, and put back after. The suite runs one file at a time (workers: 1), so nothing races this.
let savedSettings: Record<string, unknown> | undefined;
let savedAcceptance: Record<string, unknown> | undefined;

test.beforeAll(async () => {
  await withSql(async (sql) => {
    [savedSettings] = await sql`SELECT * FROM reading_settings WHERE user_id = ${E2E_USER}`;
    [savedAcceptance] = await sql`SELECT * FROM plan_acceptance WHERE year = ${Y}`;
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
  });
});
test.afterAll(async () => {
  await clean();
  await withSql(async (sql) => {
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    if (savedSettings) await sql`INSERT INTO reading_settings ${sql(savedSettings)}`;
    if (savedAcceptance) await sql`INSERT INTO plan_acceptance ${sql(savedAcceptance)}`;
  });
});

/** A period's figures as plan_capacity holds them (zero planned when nothing counts there yet). */
const capacity = (period: string) => withSql(async (sql) => {
  const [row] = await sql<{ planned_words: number; capacity: number }[]>`
    SELECT planned_words, capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`;
  return { planned: Number(row?.planned_words ?? 0), capacity: Number(row?.capacity ?? 0) };
});
/** A fixture book's plan rows, `[period, ordinal]`, by period. */
const planOf = (key: string) => withSql(async (sql) => (await sql<{ period: string; ordinal: number | null }[]>`
  SELECT period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${id(key)} ORDER BY period`)
  .map((r) => [r.period, r.ordinal]));
const statusOf = (key: string) => withSql(async (sql) => (await sql<{ status: string }[]>`
  SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id(key)}`)[0]?.status ?? null);

/**
 * The Check's fixture: a `reading` series with books 1–2 read and 3–4 to read; a shelf followed `reading` whose
 * first book is read; an author followed `reading` with one unread book; On deck books (seven, so the group has
 * *More*); an Unlisted book 3 of another `reading` series whose books 1–2 are read; an unfollowed series with books
 * 1–2 read and 3 to read; a DNF book; and, for *Move here*, a `reading` series whose next book is planned in Q3.
 * Q1 and Q3 hold a little, Q4 nothing, and a filler leaves Q2 exactly 100k of room. Two unfollowed to-read books,
 * 80k and 150k, try *Fits the room left*. `heavy` puts the whole year over with a bare-year book.
 */
async function seed({ heavy = false } = {}) {
  await clean();
  await withSql(async (sql) => {
    const book = (key: string, title: string, x: { words?: number; series?: string; position?: number; author?: string } = {}) =>
      sql`INSERT INTO books (id, title, author_id, series_id, series_position, word_count, word_count_source)
        VALUES (${id(key)}, ${title}, ${x.author ?? null}, ${x.series ? id(x.series) : null}, ${x.position ?? null},
                ${x.words ?? null}, ${x.words == null ? null : "stated"})`;
    const status = (key: string, s: string) =>
      sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id(key)}, ${s})`;
    const plan = (key: string, period: string, ordinal: number | null = null) =>
      sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id(key)}, ${period}, ${ordinal})`;
    const series = async (key: string, name: string, n: number, follow: boolean) => {
      await sql`INSERT INTO book_series (id, name) VALUES (${id(key)}, ${name})`;
      for (let i = 1; i <= n; i++) await book(`${key}-${i}`, `${name} ${i}`, { series: key, position: i });
      if (follow) await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, ${id(key)}, 'reading')`;
    };

    await sql`INSERT INTO authors (id, name) VALUES (${id("af")}, 'Sheet Followed Author')`;
    await series("s", "Sheet Saga", 4, true);
    await sql`UPDATE books SET word_count = 60000, word_count_source = 'stated' WHERE id = ${id("s-3")}`;
    await status("s-1", "read"); await status("s-2", "read"); await status("s-3", "to_read"); await status("s-4", "to_read");

    await book("sh-1", "Sheet Shelf One"); await book("sh-2", "Sheet Shelf Two");
    await status("sh-1", "read"); await status("sh-2", "to_read");
    await sql`INSERT INTO shelves (id, name, user_id, kind) VALUES (${id("sh")}, 'Sheet Shelf', ${E2E_USER}, 'books')`;
    await sql`INSERT INTO shelf_books (shelf_id, book_id, ordinal) VALUES (${id("sh")}, ${id("sh-1")}, 1), (${id("sh")}, ${id("sh-2")}, 2)`;
    await sql`INSERT INTO shelf_follows (shelf_id, state) VALUES (${id("sh")}, 'reading')`;

    await book("af-1", "Sheet Author Book", { author: id("af") });
    await status("af-1", "to_read");
    await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${E2E_USER}, ${id("af")}, 'reading')`;

    for (let i = 1; i <= 7; i++) {
      const key = i === 1 ? "od" : `od${i}`;
      await book(key, `Sheet On Deck ${i}`); await status(key, "to_read"); await plan(key, "on_deck");
    }

    await series("u", "Sheet Owned", 3, true);
    await sql`UPDATE books SET word_count = 120000, word_count_source = 'stated' WHERE id = ${id("u-3")}`;
    await status("u-1", "read"); await status("u-2", "read"); await status("u-3", "unlisted");

    await series("n", "Sheet Unfollowed", 3, false);
    await status("n-1", "read"); await status("n-2", "read"); await status("n-3", "to_read");

    await book("dnf", "Sheet Abandoned", { words: 50_000 }); await status("dnf", "dnf");

    await series("m", "Sheet Moving", 2, true);
    await status("m-1", "read"); await status("m-2", "to_read"); await plan("m-2", q(3), 1);

    await book("fit-small", "Sheet Fits Small", { words: 80_000 }); await status("fit-small", "to_read");
    await book("fit-big", "Sheet Fits Big", { words: 150_000 }); await status("fit-big", "to_read");

    await book("q1", "Sheet Q1 Holder", { words: 10_000 }); await status("q1", "to_read"); await plan("q1", q(1), 1);
    await book("q3", "Sheet Q3 Holder", { words: 20_000 }); await status("q3", "to_read"); await plan("q3", q(3), 2);

    await book("filler", "Sheet Q2 Filler", { words: 1 }); await status("filler", "to_read"); await plan("filler", Q2, 1);
    if (heavy) {
      await book("heavy", "Sheet Heavy Year", { words: 1 }); await status("heavy", "to_read"); await plan("heavy", String(Y));
    }
  });
  // The filler takes Q2 to exactly ROOM short of its capacity (whatever else Q2 holds); heavy fills the year past its own.
  const q2 = await capacity(Q2);
  await withSql((sql) => sql`UPDATE books SET word_count = ${1 + Math.floor(q2.capacity - q2.planned) - ROOM} WHERE id = ${id("filler")}`);
  if (heavy) {
    const year = await capacity(String(Y));
    await withSql((sql) => sql`UPDATE books SET word_count = ${Math.ceil(year.capacity - year.planned) + 50_000} WHERE id = ${id("heavy")}`);
  }
}

/** The sheet, wherever it is drawn: the dialog below 1024px, the side rail from 1024px. */
const panel = (page: Page) => page.locator('.sheet[role="dialog"], aside.plan-side');
const group = (scope: Locator, reason: string) => scope.locator(`section.ps-group[data-reason="${reason}"]`);
const row = (scope: Locator, key: string) => scope.locator(`li.ps-row[data-book="${id(key)}"]`);
const opener = (page: Page, target: string) => page.locator(`button[data-plan-target="${target}"]`).first();

async function open(page: Page, target = Q2) {
  await page.goto(`/books/plan?year=${Y}`);
  await hydrated(opener(page, target));
  await opener(page, target).click();
  const p = panel(page);
  await expect(p).toBeVisible();
  await expect(p.locator("li.ps-row").first()).toBeVisible();
  return p;
}

async function noDanger(page: Page, scope: Locator) {
  const danger = await tokenColour(page, "--danger");
  expect(await scope.locator("*").evaluateAll((els, d) => els.filter((el) => {
    const cs = getComputedStyle(el);
    return [cs.color, cs.backgroundColor, cs.borderTopColor].includes(d);
  }).length, danger)).toBe(0);
}

test("Check, AC-1: the Check's groups, the Unlisted tag, no DNF and no book twice; Put in Q2, its budget and Undo; Fits the room left", async ({ page }) => {
  await seed();
  const p = await open(page);
  await expect(p.getByRole("heading", { name: `Plan Q2 ${Y}` })).toBeVisible();
  await expect(p.locator(".ps-lede")).toHaveText("Grouped by why. Each one is a tap; the sheet stays open.");
  // A target that is no year or quarter, or a year make_date can't take, is refused.
  for (const bad of ["2027-Q5", "0000", "2027-05"]) {
    expect((await page.request.get(`/api/plan/suggestions?target=${bad}`)).status(), bad).toBe(400);
  }

  // Next in a series: book 3, not book 4; the shelf's second book; the author's book; the On deck book.
  await expect(row(group(p, "next_in_series"), "s-3")).toBeVisible();
  await expect(row(p, "s-4")).toHaveCount(0);
  await expect(row(group(p, "next_on_shelf"), "sh-2")).toBeVisible();
  await expect(row(group(p, "from_author"), "af-1")).toBeVisible();
  await expect(row(group(p, "on_deck"), "od")).toBeVisible();
  // The Unlisted book 3 of the other reading series, tagged.
  await expect(row(group(p, "next_in_series"), "u-3").locator(".ps-tag")).toHaveText("Unlisted");
  await expect(row(p, "s-3").locator(".ps-tag")).toHaveCount(0);
  // The unfollowed series' book 3 under none of the first three groups; the DNF book nowhere; no book twice.
  for (const reason of ["next_in_series", "next_on_shelf", "from_author"]) await expect(row(group(p, reason), "n-3")).toHaveCount(0);
  await expect(row(p, "dnf")).toHaveCount(0);
  const books = await p.locator("li.ps-row").evaluateAll((els) => els.map((el) => el.getAttribute("data-book")));
  expect(new Set(books).size).toBe(books.length);

  // With 100k of room, Fits the room left lists no book over 100k: the 80k book is in it, the 150k one is not.
  const answer = await page.request.get(`/api/plan/suggestions?target=${Q2}`);
  const all = (await answer.json()).suggestions as { id: string; reason: string; words: number | null }[];
  const fits = all.filter((s) => s.reason === "fits_room");
  expect(fits.map((s) => s.id)).toContain(id("fit-small"));
  expect(fits.filter((s) => (s.words ?? 0) > ROOM)).toEqual([]);
  await expect(row(group(p, "fits_room"), "fit-big")).toHaveCount(0);

  // Put in Q2 on book 3: one row at Q2's last ordinal, the row reads ✓ In Q2 · Undo, the sheet stays, the line moves.
  const before = await capacity(Q2);
  await row(p, "s-3").getByRole("button", { name: /^Put in Q2/ }).click();
  await expect(row(p, "s-3").locator(".ps-done")).toHaveText(/^✓ In Q2 · Undo/);
  // The tapped button is gone: focus follows to the row's Undo, so Esc and Tab stay in the sheet.
  await expect(row(p, "s-3").locator(".ps-done").getByRole("button", { name: /^Undo/ })).toBeFocused();
  const placed = await planOf("s-3");
  const last = await withSql(async (sql) => Number((await sql`SELECT max(ordinal) AS m FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${Q2}`)[0].m));
  expect(placed).toEqual([[Q2, last]]);
  const after = await capacity(Q2);
  expect(after.planned).toBe(before.planned + 60_000);
  await expect(p.locator(".ps-figure")).toContainText(`${kWords(after.planned)} of ${kWords(after.capacity)}`);
  await expect(p).toBeVisible();

  // Undo removes the row, and the line goes back.
  await row(p, "s-3").locator(".ps-done").getByRole("button", { name: /^Undo/ }).click();
  await expect(row(p, "s-3").getByRole("button", { name: /^Put in Q2/ })).toBeFocused();
  expect(await planOf("s-3")).toEqual([]);
  await expect(p.locator(".ps-figure")).toContainText(`${kWords(before.planned)} of ${kWords(before.capacity)}`);

  // Placing the Unlisted book writes its to_read and its plan row together (Add books' one transaction).
  await row(p, "u-3").getByRole("button", { name: /^Put in Q2/ }).click();
  await expect(row(p, "u-3").locator(".ps-done")).toBeVisible();
  expect(await statusOf("u-3")).toBe("to_read");
  expect((await planOf("u-3")).map(([period]) => period)).toEqual([Q2]);

  // Nothing on the sheet resolves to --danger, even over capacity (u-3 took Q2 past it).
  await expect(p.locator(".ps-budget")).toHaveAttribute("data-over", "true");
  await noDanger(page, p);
  await screenshot(page, test.info(), `plan-sheet-check-${page.viewportSize()!.width}`);
});

test("AC-2: Plan Y… opens the year with the bare year and four quarter chips; Plan this quarter… its quarter; Suggest the roomiest", async ({ page }) => {
  await seed();
  let p = await open(page, String(Y));
  await expect(p.getByRole("heading", { name: `Plan ${Y}` })).toBeVisible();
  await expect(p.locator(".ps-lede")).toHaveText("Grouped by why. Put a book in the year, or straight into a quarter.");
  const chips = row(p, "s-3").locator("button.ps-chip");
  // Each chip shows its period (the title before it is for screen readers only).
  expect(await chips.evaluateAll((els) => els.map((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(""))))
    .toEqual([String(Y), "Q1", "Q2", "Q3", "Q4"]);
  await expect(chips.nth(2)).toHaveAccessibleName(`Put Sheet Saga 3 in Q2`);
  // A chip writes that period: the bare year takes no position.
  await row(p, "s-3").locator(`button.ps-chip[data-to="${Y}"]`).click();
  await expect(row(p, "s-3").locator(".ps-done")).toHaveText(new RegExp(`^✓ In ${Y} · Undo`));
  expect(await planOf("s-3")).toEqual([[String(Y), null]]);
  await page.keyboard.press("Escape");
  await expect(p).toHaveCount(0);

  p = await open(page, q(3));
  await expect(p.getByRole("heading", { name: `Plan Q3 ${Y}` })).toBeVisible();
  await page.keyboard.press("Escape");

  // Q4 holds nothing, so it has the most room: Suggest opens it.
  await expect(opener(page, q(4))).toBeVisible();
  const suggest = page.locator("button.plan-suggest");
  await expect(suggest).toHaveAttribute("data-plan-target", q(4));
  await suggest.click();
  await expect(panel(page).getByRole("heading", { name: `Plan Q4 ${Y}` })).toBeVisible();
});

test("AC-3: an over placement turns the line amber with Accept as a stretch year; accepting it settles the line; never behind", async ({ page }) => {
  await seed({ heavy: true });
  const p = await open(page);
  await expect(p.locator(".ps-budget")).not.toHaveAttribute("data-over");
  await expect(p.getByRole("button", { name: "Accept as a stretch year" })).toHaveCount(0);

  // 120k into 100k of room: amber, its figure over, and the stretch year offered (the whole year is over too).
  await row(p, "u-3").getByRole("button", { name: /^Put in Q2/ }).click();
  const budget = p.locator(".ps-budget");
  await expect(budget).toHaveAttribute("data-over", "true");
  await expect(p.locator(".ps-figure")).toContainText("over 20k");
  expect((await computedStyle(p.locator(".ps-figure"), ["color"])).color).toBe(await tokenColour(page, "--blocked"));
  const accept = p.getByRole("button", { name: "Accept as a stretch year" });
  await expect(accept).toBeVisible();
  await expect(accept).not.toHaveAttribute("aria-disabled");
  await expect(budget).toContainText("A decision, not a mistake.");
  await expect(p).not.toContainText(/behind/i);

  await accept.click();
  await expect(budget).not.toHaveAttribute("data-over");
  await expect(budget).toContainText(`${Y} is accepted as a stretch year.`);
  const accepted = await withSql((sql) => sql`SELECT accepted_total FROM plan_acceptance WHERE year = ${Y}`);
  expect(accepted).toHaveLength(1);
  await noDanger(page, p);
});

test("AC-3: with the year still fitting, Accept as a stretch year is offered but held, with its reason", async ({ page }) => {
  await seed();
  const p = await open(page);
  await row(p, "u-3").getByRole("button", { name: /^Put in Q2/ }).click();
  const accept = p.getByRole("button", { name: "Accept as a stretch year" });
  await expect(accept).toHaveAttribute("aria-disabled", "true");
  await expect(accept).toHaveAccessibleDescription(`${Y} as a whole still has room, so there is no year to accept.`);
});

test("AC-4: five then More; Not now hides a row until the sheet closes; a planned book shows its period and Move here", async ({ page }) => {
  await seed();
  let p = await open(page);
  const deck = group(p, "on_deck");
  await expect(deck.locator("li.ps-row")).toHaveCount(5);
  await deck.getByRole("button", { name: /^More/ }).click();
  await expect(deck.locator("li.ps-row")).toHaveCount(7);
  await expect(deck.getByRole("button", { name: /^More/ })).toHaveCount(0);
  await expect(deck.locator("li.ps-row").nth(5).getByRole("button").first()).toBeFocused();

  await row(p, "af-1").getByRole("button", { name: /^Not now/ }).click();
  await expect(row(p, "af-1")).toHaveCount(0);
  // Its group had one book, so the group goes with it, and focus goes to the sheet's heading.
  await expect(group(p, "from_author")).toHaveCount(0);
  await expect(p.getByRole("heading", { name: `Plan Q2 ${Y}` })).toBeFocused();
  await p.getByRole("button", { name: "Done" }).click();
  await expect(p).toHaveCount(0);
  p = await open(page);
  await expect(row(p, "af-1")).toBeVisible();

  // Planned in Q3: its period, and Move here moves it into Q2.
  const moving = row(p, "m-2");
  await expect(moving.locator(".ps-planned")).toHaveText(`planned · Q3 ${Y}`);
  await expect(moving.getByRole("button", { name: /^Put in/ })).toHaveCount(0);
  await moving.getByRole("button", { name: /^Move here/ }).click();
  await expect(moving.locator(".ps-done")).toHaveText(/^✓ In Q2 · Undo/);
  expect((await planOf("m-2")).map(([period]) => period)).toEqual([Q2]);
});

test("AC-5: from 1024px the sheet is a side rail beside the plan rail, and a placement lands on the rail without a reload", { tag: "@at-w1280-light" }, async ({ page }) => {
  await seed();
  const p = await open(page);
  await expect(page.locator("aside.plan-side")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Beside: the rail's left edge is left of the side rail's, and they share the page's height band.
  const rail = await page.locator(".planrail").boundingBox();
  const side = await p.boundingBox();
  expect(rail!.x + rail!.width).toBeLessThanOrEqual(side!.x);
  await page.evaluate(() => { (window as unknown as { kept: boolean }).kept = true; });
  await expect(page.locator(`button.qb[data-book="${id("s-3")}"]`)).toHaveCount(0);
  await row(p, "s-3").getByRole("button", { name: /^Put in Q2/ }).click();
  await expect(page.locator(`.qcol[data-period="${Q2}"] button.qb[data-book="${id("s-3")}"]`)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
  // Nothing is trapped: the page behind stays live, and Esc closes it with focus back on the opener.
  await expect(page.locator("main .plan-head h1")).not.toHaveAttribute("inert");
  await page.keyboard.press("Escape");
  await expect(p).toHaveCount(0);
  await expect(opener(page, Q2)).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.getByRole("dialog", { name: `Plan Q2 ${Y}` })).toBeVisible();
  await expect(page.locator("aside.plan-side")).toHaveCount(0);
});

test("AC-6: every control a named button, 44px on the phone; focus on the heading and back on the opener; loading and error drawn", async ({ page }) => {
  await seed();
  const p = await open(page);
  const wide = page.viewportSize()!.width >= 1024;
  await expect(p.getByRole("heading", { name: `Plan Q2 ${Y}` })).toBeFocused();
  const controls = p.locator("button, a[href]");
  const named = await controls.evaluateAll((els) => els.map((el) => ({ tag: el.tagName, name: (el.textContent ?? "").trim() })));
  expect(named.every((c) => c.name.length > 0)).toBe(true);
  const min = page.viewportSize()!.width < 768 ? 44 : 24;
  // A place link (task 5.9b) is a name inside a line of text: the floor's 24px, not a thumb target's 44px.
  const place = p.locator(".ps-sub a");
  const inText = await place.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(inText.every((h) => h >= 24)).toBe(true);
  const targets = p.locator("button, a[href]:not(.ps-sub a)");
  for (const box of await targets.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
    expect(box.height).toBeGreaterThanOrEqual(min);
  }
  await page.keyboard.press("Escape");
  await expect(p).toHaveCount(0);
  await expect(opener(page, Q2)).toBeFocused();
  if (!wide) {
    await opener(page, Q2).click();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(opener(page, Q2)).toBeFocused();
  }

  // Loading: the suggestions held, the sheet draws its skeleton; failed, a neutral line with Try again.
  let release: () => void = () => undefined;
  await page.route("**/api/plan/suggestions**", async (route) => {
    await new Promise<void>((r) => { release = r; });
    await route.fulfill({ status: 500, body: "{}" });
  });
  await opener(page, Q2).click();
  await expect(panel(page).locator(".ps-loading .ps-sk")).toHaveCount(3);
  release();
  const error = panel(page).locator(".ps-error");
  await expect(error.getByRole("alert")).toContainText("Couldn’t load the suggestions.");
  await page.unroute("**/api/plan/suggestions**");
  await error.getByRole("button", { name: "Try again" }).click();
  await expect(panel(page).locator("li.ps-row").first()).toBeVisible();
  await noDanger(page, panel(page));
});

test("AC-6: screenshots at 360, 834 and 1280px, light and dark: no horizontal scroll, contrast 4.5:1, axe clean", { tag: "@at-w390-light" }, async ({ page }, info) => {
  await seed();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`/books/plan?year=${Y}`);
      await hydrated(opener(page, Q2));
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `plan ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE, "main");
      await screenshot(page, info, `plan-sheet-page-${width}-${scheme}`);

      for (const target of [Q2, String(Y)]) {
        const p = await open(page, target);
        await expectNoHorizontalScroll(page);
        expect(await contrastFailures(page), `sheet ${target} ${width}px ${scheme}`).toEqual([]);
        await expectNoAxeViolations(page, AXE);
        await screenshot(page, info, `plan-sheet-${target === Q2 ? "quarter" : "year"}-${width}-${scheme}`);
        await page.keyboard.press("Escape");
        await expect(p).toHaveCount(0);
      }
    }
  }
});

test("AC-6: the empty state is a panel with one action", async ({ page }) => {
  await seed();
  await page.route("**/api/plan/suggestions**", (route) => route.fulfill({ json: { suggestions: [] } }));
  await page.goto(`/books/plan?year=${Y}`);
  await hydrated(opener(page, Q2));
  await opener(page, Q2).click();
  const empty = panel(page).locator(".ps-empty");
  await expect(empty.locator(".ps-empty-line")).toHaveText(`Nothing to suggest for Q2 ${Y}.`);
  await expect(empty.getByRole("link", { name: "Open the Library" })).toHaveAttribute("href", "/books/list");
});

// --- Task 5.9b, 1 of 3 (TASK-140; F-38, D-134): the plan screens link a book's names ---------------------------------
// The open quarter's rows, the planning sheet's rows and the picker's header draw their place line through BookPlace,
// as the Library does (5.9): the author, universe and series each a link to their page, the series named by itself.

/** Sheet Saga 3 (suggested in Q2) and Sheet Moving 2 (planned in Q3) get an author and a universe; af-1 stays a standalone. */
async function placeNames() {
  await withSql(async (sql) => {
    await sql`INSERT INTO book_universes (id, name) VALUES (${id("un")}, 'Sheet Universe')`;
    await sql`UPDATE books SET author_id = ${id("af")}, universe_id = ${id("un")} WHERE id IN (${id("s-3")}, ${id("m-2")})`;
  });
}
const AUTHOR = ["Sheet Followed Author", `/books/authors/${id("af")}`];
const UNIVERSE = ["Sheet Universe", `/books/universes/${id("un")}`];
const hrefsOf = (line: Locator) =>
  line.getByRole("link").evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
async function expectTargets24(line: Locator) {
  for (const link of await line.getByRole("link").all()) {
    expect((await link.boundingBox())!.height, "each place link is 24px or more").toBeGreaterThanOrEqual(24);
  }
}

test("5.9b AC-1, AC-2, AC-3: the planning sheet's rows link the author, universe and series; a standalone has the author link alone", async ({ page }) => {
  await seed();
  await placeNames();
  const p = await open(page);
  const saga = row(p, "s-3").locator(".ps-sub");
  await expect(saga).toHaveText("Sheet Followed Author · Sheet Universe · Sheet Saga #3");
  expect(await hrefsOf(saga)).toEqual([AUTHOR, UNIVERSE, ["Sheet Saga", `/books/series/${id("s")}`]]);
  // The series link is named by the series alone.
  await expect(saga.getByRole("link", { name: "Sheet Saga", exact: true })).toBeVisible();
  const alone = row(p, "af-1").locator(".ps-sub");
  await expect(alone).toHaveText("Sheet Followed Author");
  expect(await hrefsOf(alone)).toEqual([AUTHOR]);
  await expectTargets24(saga);
  await expectTargets24(alone);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
});

test("5.9b AC-4: a place link on a suggestion row opens its page and places nothing", async ({ page }) => {
  await seed();
  await placeNames();
  const p = await open(page);
  await row(p, "s-3").locator(".ps-sub").getByRole("link", { name: "Sheet Saga", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/series/${id("s")}$`));
  expect(await planOf("s-3"), "the tap opened the series and wrote no plan row").toEqual([]);
});

test("5.9b AC-1, AC-2, AC-4: the open quarter's rows and the picker's header link the names, and Move still opens the picker", async ({ page }) => {
  await seed();
  await placeNames();
  await page.goto(`/books/plan?year=${Y}`);
  await hydrated(opener(page, Q2));
  await page.locator(`button.plan-sum[data-period="${q(3)}"]`).click();
  const line = page.locator(`.plan-row[data-book="${id("m-2")}"] .row-sub`);
  await expect(line).toHaveText("Sheet Followed Author · Sheet Universe · Sheet Moving #2");
  const links = [AUTHOR, UNIVERSE, ["Sheet Moving", `/books/series/${id("m")}`]];
  expect(await hrefsOf(line)).toEqual(links);
  await expectTargets24(line);
  // Move is its own control: it opens the picker, whose header carries the same links.
  await page.getByRole("button", { name: "Move Sheet Moving 2" }).click();
  const by = page.locator(".pp-by");
  await expect(by).toContainText("Sheet Moving #2");
  expect(await hrefsOf(by)).toEqual(links);
  await expectTargets24(by);
  await expectNoAxeViolations(page, AXE);
  await page.keyboard.press("Escape");
  // A row link opens the series page, not the picker.
  await line.getByRole("link", { name: "Sheet Moving", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/series/${id("m")}$`));
});

test("5.9b AC-5: the linked place lines at 360 and 1280px, light and dark: no horizontal scroll, contrast 4.5:1, axe clean, screenshots", { tag: "@at-w390-light" }, async ({ page }, info) => {
  await seed();
  await placeNames();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`/books/plan?year=${Y}`);
      await hydrated(opener(page, Q2));
      await page.locator(`button.plan-sum[data-period="${q(3)}"]`).click();
      await expect(page.locator(`.plan-row[data-book="${id("m-2")}"] .row-sub a`)).toHaveCount(3);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `plan rows ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE, "main");
      await screenshot(page, info, `5.9b-plan-rows-${width}-${scheme}`);

      const sheet = await open(page, Q2);
      await expect(row(sheet, "s-3").locator(".ps-sub a")).toHaveCount(3);
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `plan sheet ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `5.9b-plan-sheet-links-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
    }
  }
});

// --- Task 2.10c, 2 of 2 (TASK-155; F-65): the sheet's search --------------------------------------------------------
// The field is the sheet's first control; two letters and a pause list your books by title or author that can go in
// the target (GET /api/plan/search), in place of the groups, each placed as a suggestion is. Books titled *Qv…*
// (letters no other fixture uses) are added beside the Check's fixture: a To-read book with a place line, a read book
// and an Unlisted book, all matching the same two letters.

const QV = "Qv";
async function searchBooks() {
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${id("sr-au")}, 'Sheet Search Author')`;
    await sql`INSERT INTO books (id, title, author_id, word_count, word_count_source) VALUES
      (${id("sr-to")}, 'Qv Search Target', ${id("sr-au")}, 40000, 'stated'),
      (${id("sr-rd")}, 'Qv Search Read', ${id("sr-au")}, NULL, NULL),
      (${id("sr-ul")}, 'Qv Search Unlisted', ${id("sr-au")}, NULL, NULL)`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES
      (${E2E_USER}, ${id("sr-to")}, 'to_read'), (${E2E_USER}, ${id("sr-ul")}, 'unlisted')`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
      VALUES (${E2E_USER}, ${id("sr-rd")}, 'read', '2026-03-01', 'exact')`;
  });
}
const field = (p: Locator) => p.getByRole("searchbox", { name: "Title or author" });
const matchesOf = (p: Locator) => p.locator("section.ps-matches");

test("Check, AC-1 (search): two letters list the book with its place line and no read book; Put in Q2 writes one row and Undo removes it", async ({ page }) => {
  await seed();
  await searchBooks();
  const p = await open(page);
  await field(p).fill(QV);
  const matches = matchesOf(p);
  await expect(row(matches, "sr-to")).toBeVisible();
  await expect(row(matches, "sr-to").locator(".ps-sub")).toHaveText("Sheet Search Author");
  await expect(row(matches, "sr-to").locator(".ps-why")).toHaveText("Someday");
  await expect(row(p, "sr-rd")).toHaveCount(0);
  // The matches stand in place of the groups.
  await expect(p.locator("section.ps-group")).toHaveCount(0);

  expect(await planOf("sr-to")).toEqual([]);
  await row(matches, "sr-to").getByRole("button", { name: /^Put in Q2/ }).click();
  await expect(row(matches, "sr-to").locator(".ps-done")).toHaveText(/^✓ In Q2 · Undo/);
  const last = await withSql(async (sql) => Number((await sql`SELECT max(ordinal) AS m FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${Q2}`)[0].m));
  expect(await planOf("sr-to")).toEqual([[Q2, last]]);
  await row(matches, "sr-to").locator(".ps-done").getByRole("button", { name: /^Undo/ }).click();
  await expect(row(matches, "sr-to").getByRole("button", { name: /^Put in Q2/ })).toBeVisible();
  expect(await planOf("sr-to")).toEqual([]);
});

test("AC-2: the field is the first control, focused only when moved to; it filters as you type; Esc clears it and the groups come back", async ({ page }) => {
  await seed();
  await searchBooks();
  const p = await open(page);
  // The sheet's focus rule is unchanged: the heading has focus at open, and Tab moves to the field first.
  await expect(p.getByRole("heading", { name: `Plan Q2 ${Y}` })).toBeFocused();
  await expect(field(p)).not.toBeFocused();
  await page.keyboard.press("Tab");
  await expect(field(p)).toBeFocused();

  // Typing filters with no Enter.
  await page.keyboard.type(QV);
  await expect(row(matchesOf(p), "sr-to")).toBeVisible();
  await expect(p.locator("section.ps-group")).toHaveCount(0);

  // Esc with text clears the field and the sheet stays open, the groups back.
  await page.keyboard.press("Escape");
  await expect(field(p)).toHaveValue("");
  await expect(p).toBeVisible();
  await expect(matchesOf(p)).toHaveCount(0);
  await expect(group(p, "next_in_series")).toBeVisible();

  // An emptied field shows the groups too.
  await field(p).fill(QV);
  await expect(matchesOf(p)).toBeVisible();
  await field(p).fill("");
  await expect(matchesOf(p)).toHaveCount(0);
  await expect(group(p, "next_in_series")).toBeVisible();

  // Esc in the empty field reaches the sheet, which closes.
  await field(p).focus();
  await page.keyboard.press("Escape");
  await expect(p).toHaveCount(0);
});

test("AC-3: a match that is Unlisted is placed with its to_read in one write, and Undo puts back unlisted and takes the row out", async ({ page }) => {
  await seed();
  await searchBooks();
  const p = await open(page);
  await field(p).fill(QV);
  const hit = row(matchesOf(p), "sr-ul");
  await expect(hit.locator(".ps-tag")).toHaveText("Unlisted");
  await hit.getByRole("button", { name: /^Put in Q2/ }).click();
  await expect(hit.locator(".ps-done")).toBeVisible();
  expect(await statusOf("sr-ul")).toBe("to_read");
  expect((await planOf("sr-ul")).map(([period]) => period)).toEqual([Q2]);
  await hit.locator(".ps-done").getByRole("button", { name: /^Undo/ }).click();
  await expect(hit.getByRole("button", { name: /^Put in Q2/ })).toBeVisible();
  expect(await statusOf("sr-ul")).toBe("unlisted");
  expect(await planOf("sr-ul")).toEqual([]);
});

test("AC-4: a search with no match says so in one line and keeps the groups below", async ({ page }) => {
  await seed();
  const p = await open(page);
  await field(p).fill("Qvzzq");
  await expect(p.locator(".ps-search-line")).toHaveText("Nothing on your list matches “Qvzzq”.");
  await expect(p.locator(".ps-search-line p")).toHaveCount(1);
  await expect(matchesOf(p)).toHaveCount(0);
  await expect(group(p, "next_in_series")).toBeVisible();
  await expect(row(p, "s-3")).toBeVisible();
});

test("AC-5: the search at every width, light and dark: a labelled field, named 44px controls on the phone, contrast, axe, screenshots", { tag: "@at-w390-light" }, async ({ page }, info) => {
  await seed();
  await searchBooks();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      const p = await open(page);
      await expect(field(p)).toHaveAccessibleName("Title or author");
      expect((await field(p).boundingBox())!.height, "the field is 44px tall").toBeGreaterThanOrEqual(44);
      await field(p).fill(QV);
      const matches = matchesOf(p);
      await expect(row(matches, "sr-to")).toBeVisible();
      const min = width < 768 ? 44 : 24;
      const buttons = await matches.locator("button").evaluateAll((els) =>
        els.map((el) => ({ name: (el.textContent ?? "").trim(), height: el.getBoundingClientRect().height })));
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) {
        expect(b.name.length, "every match control has a name").toBeGreaterThan(0);
        expect(b.height, `${b.name} at ${width}px`).toBeGreaterThanOrEqual(min);
      }
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `search ${width}px ${scheme}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      await screenshot(page, info, `plan-sheet-search-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(p).toHaveCount(0);
    }
  }
});
