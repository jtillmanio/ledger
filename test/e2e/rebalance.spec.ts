// Task 2.7, part 2 of 2 (TASK-067, F-23, D-37, D-7; mockup `rebalance`; Plan Rail Spec A4.2): the Rebalance
// sheet and the settled stretch year, in a real browser against the TEST database. An over-full year's plan
// page carries the amber capacity card; *Rebalance* opens four equal peers, each with its before/after; *Accept*
// stores the acceptance with its date and turns the card the settled grey with an Undo, while the rail's overage
// is still drawn, hatched in grey (`--hatch-settled`), and keyed *over, accepted (settled)*. It persists across
// loads and days, and a placement past the accepted total brings the amber back. The dashboard's strip is the
// same rail: its overage turns grey too, and the dashboard carries no card (TASK-049 Q2). The roadmap Check's
// write clauses are test/plan-acceptance.test.ts too. Figures are the fixture's own (D-7).
//
// The books are made here under *e2e-rb-* ids, in this year + 2 (the year switch reaches it), and this year's
// quarter for the strip; each test starts from its own seed, and everything is removed after the last.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { today } from "../../src/lib/finish-date";
import { acceptedDay } from "../../src/lib/format";
import { evenQuarters } from "../../src/lib/plan-rail";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// What a screen does, not how it looks or fits: the core projects only (D-143).
const CORE = { tag: "@core" };
// Sets its own viewport and theme: runs once, in w390-light.
const FLOOR = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label", "aria-dialog-name", "aria-required-children", "aria-required-parent",
];

const DAY = today();
const NOW = Number(DAY.slice(0, 4));
const THIS_QUARTER = `${NOW}-Q${Math.floor((Number(DAY.slice(5, 7)) - 1) / 3) + 1}`;
const Y = NOW + 2;
const PAGE = `/books/plan?year=${Y}`;
const q = (n: number) => `${Y}-Q${n}`;
const id = (key: string) => `e2e-rb-${key}`;

type Seed = { key: string; words: number; period: string; ordinal: number | null };
// Each quarter in its order, words in thousands: Q1 a 400, b 300, c 200 (the rule runs through it), d 100 ·
// Q2 e 700, f 150 · Q3 g 500, h 400 · Q4 i 300 · the year, no quarter, j 535. About 118% of the year's
// capacity, and the books past each quarter's rule are c, d, f and h: the overage, which h leads by length.
const BOOKS: Seed[] = [
  { key: "a", words: 400_000, period: q(1), ordinal: 1 }, { key: "b", words: 300_000, period: q(1), ordinal: 2 },
  { key: "c", words: 200_000, period: q(1), ordinal: 3 }, { key: "d", words: 100_000, period: q(1), ordinal: 4 },
  { key: "e", words: 700_000, period: q(2), ordinal: 1 }, { key: "f", words: 150_000, period: q(2), ordinal: 2 },
  { key: "g", words: 500_000, period: q(3), ordinal: 1 }, { key: "h", words: 400_000, period: q(3), ordinal: 2 },
  { key: "i", words: 300_000, period: q(4), ordinal: 1 },
  { key: "j", words: 535_000, period: String(Y), ordinal: null },
];
const OVERAGE = ["c", "d", "f", "h"];
const title = (key: string) => `Rebalance ${key.toUpperCase()}`;

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE 'e2e-rb-%'`;
  await sql`DELETE FROM plan_acceptance WHERE year IN (${NOW}, ${Y})`;
});

async function addBook(sql: TestSql, key: string, words: number, period: string | null, ordinal: number | null) {
  await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${id(key)}, ${title(key)}, ${words}, 'stated')`;
  await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${id(key)}, 'to_read')`;
  if (period) await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id(key)}, ${period}, ${ordinal})`;
}

async function seed() {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) await addBook(sql, b.key, b.words, b.period, b.ordinal);
  });
}

test.afterAll(clean);

/** A period's figures as plan_capacity holds them; a year nothing counts in has none. */
const figures = (period: string) => withSql(async (sql) => {
  const [row] = await sql<{ planned_words: number; capacity: number; books: number }[]>`
    SELECT planned_words, capacity, books FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${period}`;
  return row ? { planned: Number(row.planned_words), capacity: Number(row.capacity), books: Number(row.books) } : null;
});
const acceptances = (year: number) => withSql((sql) => sql<{ accepted_at: Date; accepted_total: string }[]>`
  SELECT accepted_at, accepted_total FROM plan_acceptance WHERE year = ${year}`);
/** The year's quarter books, Q1 to Q4, each in its order: the sequence evening out must keep. */
const sequence = () => withSql(async (sql) => (await sql<{ book_id: string }[]>`
  SELECT book_id FROM reading_plan WHERE user_id = ${E2E_USER} AND period LIKE ${`${Y}-Q%`} ORDER BY period, ordinal`)
  .map((r) => r.book_id.replace("e2e-rb-", "")));

/** Words as the sheet prints them, `2,279k`. */
const k = (words: number) => `${Math.round(words / 1000).toLocaleString("en-US")}k`;

/** What a token resolves to as a background image, in the page's own theme: drawn on a probe, like tokenColour. */
const tokenImage = (page: Page, token: string) => page.evaluate((t) => {
  const probe = document.createElement("i");
  probe.style.backgroundImage = `var(${t})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).backgroundImage;
  probe.remove();
  return resolved;
}, token);
/** Every hatch layer's computed background image under `scope`. */
const hatches = (scope: Locator) => scope.locator(".ov").evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage));

const card = (page: Page) => page.locator(".plan-decision");
const sheet = (page: Page) => page.getByRole("dialog", { name: `Rebalance ${Y}` });
const acceptButton = (page: Page) => card(page).getByRole("button", { name: "Accept as a stretch year" });
const rebalanceButton = (page: Page) => card(page).getByRole("button", { name: `Rebalance ${Y}` });

async function openSheet(page: Page) {
  await hydrated(rebalanceButton(page));
  await rebalanceButton(page).click();
  const s = sheet(page);
  await expect(s.locator(".rb-go")).toHaveCount(4);
  return s;
}

/** Nothing under `scope` resolves to --danger, in its text, its fill or its edge. */
async function dangerCount(page: Page, scope: Locator) {
  const danger = await tokenColour(page, "--danger");
  return scope.locator("*").evaluateAll((els, d) => els.filter((el) => {
    const cs = getComputedStyle(el);
    return [cs.color, cs.backgroundColor, cs.borderTopColor].includes(d);
  }).length, danger);
}

test("Check, AC-3: accepting stores the date, the card turns .decide.settled, every over-rule part uses --hatch-settled; Undo removes it", CORE, async ({ page }) => {
  await seed();
  const year = (await figures(String(Y)))!;
  // 118% of capacity, give or take a leap day.
  expect(year.planned / year.capacity).toBeGreaterThan(1.17);
  await page.goto(PAGE);

  // Held: the amber card, and the overage hatched with --hatch.
  const held = await tokenImage(page, "--hatch");
  const settled = await tokenImage(page, "--hatch-settled");
  expect(held).not.toBe(settled);
  await expect(card(page)).toHaveAttribute("data-state", "over");
  await expect(card(page)).toHaveClass("decide plan-decision");
  await expect(card(page).locator(".dt-text")).toContainText(`${Y} is over by`);
  const rail = page.locator('.planrail[role="group"]');
  expect((await hatches(rail)).length).toBeGreaterThan(0);
  expect(new Set(await hatches(rail))).toEqual(new Set([held]));
  await expect(page.locator(".qlegend")).toContainText("over capacity");

  await hydrated(acceptButton(page));
  await acceptButton(page).click();
  await expect(card(page)).toHaveAttribute("data-state", "settled");
  // The row: today's date and the year's planned total.
  const [row] = await acceptances(Y);
  expect(Number(row.accepted_total)).toBe(year.planned);
  expect(Date.now() - row.accepted_at.getTime()).toBeLessThan(120_000);

  // .decide.settled, saying what was accepted and when, with Undo; focus has gone to it.
  await expect(card(page)).toHaveClass("decide settled plan-decision");
  await expect(card(page).locator(".dt-text")).toContainText(`${Y} accepted as a stretch year on ${acceptedDay(row.accepted_at.toISOString())}.`);
  const undo = card(page).getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();
  // The overage is still drawn, every part of it now in the grey hatch, and the key says so.
  expect(new Set(await hatches(rail))).toEqual(new Set([settled]));
  await expect(page.locator(".qlegend")).toContainText("over, accepted (settled)");
  await expect(page.locator(".qlegend")).not.toContainText("over capacity");
  expect(await dangerCount(page, card(page))).toBe(0);
  // Only the held state clears: every quarter's overage is still said, on the rail and in the rows, in grey.
  await expect(page.locator(".plan-quarters .bdg.bl, .planrail .qcol:not(.nq) .qfoot .bdg.bl")).toHaveCount(0);
  await expect(page.locator(".plan-quarters .bdg.dn", { hasText: /^over / })).toHaveCount(3);

  // Persistence is the whole feature: a fresh load is still settled.
  await page.reload();
  await expect(card(page)).toHaveAttribute("data-state", "settled");
  expect(new Set(await hatches(rail))).toEqual(new Set([settled]));

  // Undo removes the row; the card is amber and the hatch --hatch again, with focus on Accept.
  await hydrated(undo);
  await undo.click();
  await expect(card(page)).toHaveAttribute("data-state", "over");
  await expect(card(page)).toHaveClass("decide plan-decision");
  expect(await acceptances(Y)).toHaveLength(0);
  expect(new Set(await hatches(rail))).toEqual(new Set([held]));
  await expect(page.locator(".qlegend")).toContainText("over capacity");
  await expect(acceptButton(page)).toBeFocused();
});

test("Check, AC-4: an acceptance stored days ago still shows settled; a placement past the accepted total re-raises the flag", CORE, async ({ page }) => {
  await seed();
  const year = (await figures(String(Y)))!;
  const [stored] = await withSql((sql) => sql<{ accepted_at: Date }[]>`
    INSERT INTO plan_acceptance (year, accepted_at, accepted_total) VALUES (${Y}, now() - interval '9 days', ${year.planned})
    RETURNING accepted_at`);
  await page.goto(PAGE);
  await expect(card(page)).toHaveAttribute("data-state", "settled");
  await expect(card(page).locator(".dt-text")).toContainText(`on ${acceptedDay(stored.accepted_at.toISOString())}.`);

  // A book placed in Q4 takes the year past what was accepted: amber again, with the row untouched.
  await withSql((sql) => addBook(sql, "k", 120_000, null, null));
  const placed = await page.request.post("/api/plan", { data: { bookId: id("k"), from: "someday", to: q(4) } });
  expect(placed.status()).toBe(200);
  await page.reload();
  await expect(card(page)).toHaveAttribute("data-state", "over");
  await expect(card(page)).toHaveClass("decide plan-decision");
  expect(new Set(await hatches(page.locator('.planrail[role="group"]')))).toEqual(new Set([await tokenImage(page, "--hatch")]));
  expect(await acceptances(Y)).toHaveLength(1);
});

test("AC-2: four peers of one class and one size, each with its before/after; nothing red, nothing behind; focus on the heading and back", CORE, async ({ page }) => {
  await seed();
  const year = (await figures(String(Y)))!;
  const quarters = await Promise.all([1, 2, 3, 4].map(async (n) => (await figures(q(n)))!.planned));
  const nextBooks = (await figures(String(Y + 1)))?.books ?? 0;
  await page.goto(PAGE);
  const s = await openSheet(page);
  await expect(s.getByRole("heading", { name: `Rebalance ${Y}` })).toBeFocused();
  await expect(s.locator(".lede")).toHaveText(`${Y} is ${k(year.planned)} against ${k(year.capacity)} a year: over by ${k(year.planned - year.capacity)}.`);

  const moving = BOOKS.filter((b) => OVERAGE.includes(b.key)).reduce((n, b) => n + b.words, 0);
  const after = year.planned - moving;
  const words = BOOKS.filter((b) => b.ordinal !== null).map((b) => b.words);
  const even = [0, 0, 0, 0];
  evenQuarters(words).forEach((n, i) => { even[n - 1] += words[i]; });
  const thousands = (list: number[]) => list.map((w) => Math.round(w / 1000).toLocaleString("en-US")).join(" · ");
  const expected: [string, string, string, string][] = [
    ["next", `Move the overage into ${Y + 1}`, `${Y} ${k(year.planned)} → ${k(after)}. ${Y + 1} then holds ${nextBooks + OVERAGE.length} books.`, `Move ${k(moving)}`],
    ["on_deck", "Move it to On deck", `Longest first: ${title("h")} (400k) and 3 more. ${Y} → ${k(after)}. Nothing is deleted.`, "Drop 4 books"],
    ["even", "Even out the quarters", `Q1–Q4: ${thousands(quarters)} → ${thousands(even)}. Same books, same ${k(quarters.reduce((a, b) => a + b, 0))}.`, "Even out"],
    ["accept", `Accept ${Y} as a stretch year`, `Nothing moves. The amber clears, and stays cleared until the plan grows past ${k(year.planned)}.`, "Accept"],
  ];
  await expect(s.locator(".rb-opt")).toHaveCount(4);
  for (const [action, name, delta, go] of expected) {
    const opt = s.locator(`.rb-opt[data-action="${action}"]`);
    await expect(opt.locator(".rb-title")).toHaveText(name);
    await expect(opt.locator(".rb-delta")).toHaveText(delta);
    const button = opt.getByRole("button", { name: go });
    await expect(button).toBeVisible();
    // A real button, named by what it does, described by its peer's title and delta.
    await expect(button).toHaveAccessibleDescription(`${name} ${delta}`);
  }

  // Equal weight: one class, one size.
  const peers = s.locator("button.rb-go");
  expect(new Set(await peers.evaluateAll((els) => els.map((el) => el.className)))).toEqual(new Set(["btn sec sm rb-go"]));
  const boxes = await peers.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`));
  expect(new Set(boxes).size).toBe(1);

  expect(await dangerCount(page, s)).toBe(0);
  await expect(s).not.toContainText(/behind/i);
  await expect(page.locator("main")).not.toContainText(/behind/i);

  // Esc closes with nothing written, focus back on the opener.
  const before = await sequence();
  await page.keyboard.press("Escape");
  await expect(s).toHaveCount(0);
  await expect(rebalanceButton(page)).toBeFocused();
  expect(await sequence()).toEqual(before);
});

test("Check: Even out keeps the year's book count and its order; Move the overage moves it whole into the next year, with an Undo", CORE, async ({ page }) => {
  await seed();
  const seqBefore = await sequence();
  const yearBefore = (await figures(String(Y)))!;
  await page.goto(PAGE);
  let s = await openSheet(page);
  await s.getByRole("button", { name: "Even out" }).click();
  await expect(s).toHaveCount(0);
  await expect(page.locator(".toast .toast-label")).toHaveText(`Evened out ${Y}’s quarters`);
  // Same books, same order: no book is put ahead of one that was ahead of it, and the count is unchanged.
  await expect.poll(async () => (await figures(q(1)))!.planned).not.toBe(1_000_000);
  expect(await sequence()).toEqual(seqBefore);
  const yearAfter = (await figures(String(Y)))!;
  expect(yearAfter.books).toBe(yearBefore.books);
  expect(yearAfter.planned).toBe(yearBefore.planned);

  await seed();
  await page.goto(PAGE);
  s = await openSheet(page);
  await s.locator('button.rb-go[data-action="next"]').click();
  await expect(s).toHaveCount(0);
  await expect(page.locator(".toast .toast-label")).toHaveText(`Moved 4 books to ${Y + 1}`);
  const moved = () => withSql(async (sql) => (await sql<{ book_id: string }[]>`
    SELECT book_id FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${String(Y + 1)} AND book_id LIKE 'e2e-rb-%' ORDER BY book_id`)
    .map((r) => r.book_id.replace("e2e-rb-", "")));
  await expect.poll(moved).toEqual(OVERAGE);
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(moved).toEqual([]);
  expect(await sequence()).toEqual(seqBefore);
});

test("Check: the dashboard's strip hatches this year's overage with --hatch-settled once the year is accepted, and carries no card", CORE, async ({ page }) => {
  await clean();
  // A book big enough to take this year past its capacity on its own, in this quarter.
  await withSql((sql) => addBook(sql, "now", 3_400_000, THIS_QUARTER, 1));
  try {
    await page.goto("/books");
    const strip = page.locator('.planrail.strip[role="group"]');
    await expect(strip).toBeVisible();
    const held = await tokenImage(page, "--hatch");
    expect(new Set(await hatches(strip))).toEqual(new Set([held]));
    await expect(page.locator(".qfig")).toHaveClass("qfig over");

    const accepted = await page.request.post("/api/plan/rebalance", { data: { action: "accept", year: NOW } });
    expect(accepted.status()).toBe(200);
    await page.reload();
    await expect(strip).toHaveAttribute("data-settled", "true");
    expect(new Set(await hatches(strip))).toEqual(new Set([await tokenImage(page, "--hatch-settled")]));
    // Amber means held: the figure is grey once decided, and its badge still says the overage.
    await expect(page.locator(".qfig")).toHaveClass("qfig");
    await expect(page.locator(".qfig .bdg")).toHaveClass("bdg dn");
    expect((await computedStyle(page.locator(".qfig"), ["color"])).color).not.toBe(await tokenColour(page, "--blocked"));
    // The card is the plan page's (TASK-049 Q2): nothing on the dashboard decides, settled or not.
    await expect(page.locator(".decide")).toHaveCount(0);
  } finally {
    await clean();
  }
});

/** WCAG contrast of two computed colours. */
function contrast(a: string, b: string) {
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const lum = (c: string) => {
    const [r, g, b2] = rgb(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("AC-5: the card and the sheet at 360, 834 and 1280px, light and dark: targets, contrast, the settled hatch at 3:1, axe, no scroll", FLOOR, async ({ page }, info) => {
  await seed();
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      const at = `${width}px ${scheme}`;
      const floor = width < 768 ? 44 : 24;
      const tall = (scope: Locator) => scope.getByRole("button").evaluateAll((els) => els.map((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(r.width, r.height);
      }));

      await page.goto(PAGE);
      await hydrated(rebalanceButton(page));
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `held ${at}`).toEqual([]);
      await expectNoAxeViolations(page, AXE, "main");
      for (const side of await tall(card(page))) expect(side, `held card ${at}`).toBeGreaterThanOrEqual(floor);
      await screenshot(page, info, `rebalance-held-${width}-${scheme}`);

      const s = await openSheet(page);
      await expect(s.getByRole("heading", { name: `Rebalance ${Y}` })).toBeFocused();
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `sheet ${at}`).toEqual([]);
      await expectNoAxeViolations(page, AXE);
      for (const side of await tall(s)) expect(side, `sheet ${at}`).toBeGreaterThanOrEqual(floor);
      await screenshot(page, info, `rebalance-sheet-${width}-${scheme}`);
      await page.keyboard.press("Escape");
      await expect(s).toHaveCount(0);
      await expect(rebalanceButton(page)).toBeFocused();

      await page.request.post("/api/plan/rebalance", { data: { action: "accept", year: Y } });
      await page.reload();
      await expect(card(page)).toHaveAttribute("data-state", "settled");
      await expectNoHorizontalScroll(page);
      expect(await contrastFailures(page), `settled ${at}`).toEqual([]);
      await expectNoAxeViolations(page, AXE, "main");
      for (const side of await tall(card(page))) expect(side, `settled card ${at}`).toBeGreaterThanOrEqual(floor);
      // The settled hatch's lines against the block they are drawn on: 3:1 (WCAG 1.4.11).
      const layer = page.locator('.planrail[role="group"] .ov').first();
      const { "background-color": under } = await computedStyle(layer, ["background-color"]);
      expect(contrast(await tokenColour(page, "--muted"), under), `settled hatch ${at}`).toBeGreaterThanOrEqual(3);
      await screenshot(page, info, `rebalance-settled-${width}-${scheme}`);
      await page.request.delete("/api/plan/rebalance", { data: { undo: { kind: "accept", year: Y } } });
    }
  }
});
