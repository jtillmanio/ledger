// Task 2.2 (F-22; D-37, D-40; STYLE_GUIDE §14.1, §14.2, §14.6): the books dashboard in a real
// browser. The five slots in order, reading, *Between books* with and without a finish, an empty
// plan, the strip's figure against 2.1's and past capacity in amber, *2026 so far*, the primary
// inside the bottom 96px, no sideways scroll, nothing on --danger and no "behind", the 1280 side
// rail and On deck's Plan reveal (fine pointer and touch), the verbs' writes with Undo, the
// loading state's geometry, axe and contrast, and the feel-pass screenshots in every project.
//
// The dashboard reads the whole user, so the books are made here under *E2E Dash* ids and
// removed after each test; any other in-progress book is parked as To read and put back after.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import Loading from "../../src/app/books/loading";
import { today } from "../../src/lib/finish-date";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// A check with no layout in it: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const DESK = { tag: "@at-w1280-light" };
const TOUCH = { tag: "@at-w390-touch" };

const AXE = [
  "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role", "aria-prohibited-attr",
  "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria", "target-size", "label",
  "heading-order", "list", "listitem", "definition-list", "dlitem",
];

// This quarter and this year, from the Eastern day, as the page has them.
const DAY = today();
const YEAR = Number(DAY.slice(0, 4));
const Q = Math.floor((Number(DAY.slice(5, 7)) - 1) / 3) + 1;
const PERIOD = `${YEAR}-Q${Q}`;
const daysAgo = (n: number) => new Date(Date.parse(`${DAY}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

const HERO = "E2E Dash Hero";
// Long enough to wrap to two lines on a 112px card, as the skeleton draws one.
const ONE = "E2E Dash One and the Long Title";
const TWO = "E2E Dash Two and the Long Title";
const THREE = "E2E Dash Three and the Long Title";
const DECK = ["E2E Dash Deck A", "E2E Dash Deck B", "E2E Dash Deck C", "E2E Dash Deck D"];

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE 'e2e-dash-%'`;
  // 2.2d's series, after its books; its follow goes with it (cascade).
  await sql`DELETE FROM book_series WHERE id LIKE 'e2e-dash-%'`;
  await sql`DELETE FROM authors WHERE id LIKE 'e2e-dash-%'`;
});

let parked: { book_id: string; status: string }[] = [];
test.beforeAll(async () => {
  await clean();
  parked = await withSql(async (sql) => {
    const rows = await sql<{ book_id: string; status: string }[]>`
      SELECT book_id, status FROM book_status WHERE user_id = ${E2E_USER} AND status IN ('reading', 'listening')`;
    await sql`UPDATE book_status SET status = 'to_read' WHERE user_id = ${E2E_USER} AND status IN ('reading', 'listening')`;
    // Another spec's read or plan would change what these tests count: the suite leaves none behind.
    const [left] = await sql<{ reads: number; planned: number; deck: number }[]>`
      SELECT (SELECT count(*)::int FROM book_reads WHERE user_id = ${E2E_USER}) AS reads,
             (SELECT count(*)::int FROM plan_period WHERE user_id = ${E2E_USER} AND period = ${PERIOD}) AS planned,
             (SELECT count(*)::int FROM to_read_level WHERE user_id = ${E2E_USER} AND level = 'on_deck') AS deck`;
    expect(left, "no read or plan row from another spec").toEqual({ reads: 0, planned: 0, deck: 0 });
    return rows;
  });
});
test.afterAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const p of parked) await sql`UPDATE book_status SET status = ${p.status} WHERE user_id = ${E2E_USER} AND book_id = ${p.book_id}`;
  });
});
test.afterEach(clean);

type Seed = { reading?: boolean; between?: boolean };
/** A day `n` back, held inside this year, so *2026 so far* counts it whatever today is. */
const thisYear = (n: number) => (daysAgo(n).startsWith(`${YEAR}-`) ? daysAgo(n) : `${YEAR}-01-01`);

/**
 * The fixture: the quarter holds One (1), Two (2, read) and Three (3); four books are On deck; this
 * year has Two's read (300 pages, nine days) and a listen of *Ear* (200 pages), by two authors new
 * this year. `reading` adds the hero, Reading since 14 days ago (468 pages, 146k words). `between`
 * dates Two's finish two days ago, the latest.
 */
async function seed({ reading = false, between = false }: Seed) {
  await withSql(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES ('e2e-dash-a1', 'Dash Author One'), ('e2e-dash-a2', 'Dash Author Two')`;
    const book = (id: string, title: string, words: number | null, pages: number | null, author: string | null = null) =>
      sql`INSERT INTO books (id, title, author_id, word_count, word_count_source, page_count)
          VALUES (${id}, ${title}, ${author}, ${words}, ${words ? "stated" : null}, ${pages})`;
    const status = (id: string, s: string, started: string | null = null) =>
      sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
          VALUES (${E2E_USER}, ${id}, ${s}, ${started}, ${started ? "exact" : "none"})`;
    const plan = (id: string, period: string, ordinal: number | null) =>
      sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${id}, ${period}, ${ordinal})`;
    const read = async (id: string, on: string, started: string, format: "text" | "audio") => {
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
                VALUES (${E2E_USER}, ${id}, ${on}, 'exact', ${started}, 'exact', ${format})`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${id}, 'read', ${on}, 'exact')`;
    };

    await book("e2e-dash-1", ONE, 92_000, 304);
    await book("e2e-dash-2", TWO, 30_000, 300, "e2e-dash-a1");
    await book("e2e-dash-3", THREE, 100_000, 372);
    await status("e2e-dash-1", "to_read");
    await status("e2e-dash-3", "to_read");
    // Two's finish: the latest one in Between books, else 20 days back, before the listen.
    const twoOn = between ? daysAgo(2) : thisYear(20);
    await read("e2e-dash-2", twoOn, between ? daysAgo(11) : thisYear(29), "text");
    await plan("e2e-dash-1", PERIOD, 1);
    await plan("e2e-dash-2", PERIOD, 2);
    await plan("e2e-dash-3", PERIOD, 3);

    await book("e2e-dash-ear", "E2E Dash Ear", 60_000, 200, "e2e-dash-a2");
    await read("e2e-dash-ear", between ? daysAgo(5) : thisYear(3), between ? daysAgo(12) : thisYear(10), "audio");

    for (const [i, title] of DECK.entries()) {
      await book(`e2e-dash-deck-${i}`, title, 80_000, 250);
      await status(`e2e-dash-deck-${i}`, "to_read");
      await plan(`e2e-dash-deck-${i}`, "on_deck", null);
    }
    if (reading) {
      await book("e2e-dash-hero", HERO, 146_000, 468);
      await status("e2e-dash-hero", "reading", daysAgo(14));
    }
  });
}

const SAGA_NAME = "E2E Dash Saga";
const SAGA = ["E2E Dash Saga One", "E2E Dash Saga Two", "E2E Dash Saga Three", "E2E Dash Saga Four"];
const sagaId = (n: number) => `e2e-dash-saga-${n}`;

/**
 * 2.2d's fixture, on top of `seed`: a series followed as Reading, books 1–4 at positions 1–4.
 * One is read (40 days back); Two is read (20 days back), or, `twoInHand`, Reading since 3 days
 * back, the newest start, so the hero; Three and Four are to read. Its reads are older than
 * `seed`'s, so *Between books* still names Two of the quarter.
 */
async function seedSaga({ twoInHand }: { twoInHand: boolean }) {
  await withSql(async (sql) => {
    await sql`INSERT INTO book_series (id, name) VALUES ('e2e-dash-saga', ${SAGA_NAME})`;
    for (const [i, title] of SAGA.entries()) {
      await sql`INSERT INTO books (id, title, series_id, series_position, page_count) VALUES (${sagaId(i + 1)}, ${title}, 'e2e-dash-saga', ${i + 1}, 320)`;
    }
    const read = async (n: number, on: string) => {
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, ${sagaId(n)}, ${on}, 'exact', 'text')`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${sagaId(n)}, 'read', ${on}, 'exact')`;
    };
    await read(1, daysAgo(40));
    if (twoInHand) {
      await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
                VALUES (${E2E_USER}, ${sagaId(2)}, 'reading', ${daysAgo(3)}, 'exact')`;
    } else {
      await read(2, daysAgo(20));
    }
    for (const n of [3, 4]) {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${sagaId(n)}, 'to_read')`;
    }
    await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, 'e2e-dash-saga', 'reading')`;
  });
}

/** Never finished, nothing planned: four books On deck and nothing else. */
async function seedEmpty() {
  await withSql(async (sql) => {
    for (const [i, title] of DECK.entries()) {
      await sql`INSERT INTO books (id, title) VALUES (${`e2e-dash-deck-${i}`}, ${title})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${`e2e-dash-deck-${i}`}, 'to_read')`;
      await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${`e2e-dash-deck-${i}`}, 'on_deck', NULL)`;
    }
  });
}

const wide = (page: Page) => page.viewportSize()!.width >= 1024;
/** The verbs on screen: the header's from 1024px, the thumb bar's below. */
const verbs = (page: Page) => page.locator(wide(page) ? ".headverbs" : ".actionbar");
const primary = (page: Page) => verbs(page).locator(wide(page) ? ":scope > :last-child" : ":scope > :first-child");
const shelfTitles = (page: Page) => page.locator('[data-slot="next"] .card-title');

async function open(page: Page) {
  await page.goto("/books");
  await hydrated(primary(page));
}

/** Every element's drawn colours: none is --danger's (§12: nothing on a dashboard is red). */
async function expectNoDanger(page: Page) {
  const danger = await tokenColour(page, "--danger");
  const hits = await page.evaluate((red) => {
    const props = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color",
      "border-left-color", "outline-color", "fill", "stroke"];
    const out: string[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none") continue;
      for (const p of props) {
        const v = cs.getPropertyValue(p);
        if (v === red && !(p.startsWith("border") && parseFloat(cs.getPropertyValue(p.replace("color", "width"))) === 0)
          && !(p === "outline-color" && cs.outlineStyle === "none")) out.push(`${el.tagName.toLowerCase()}.${el.className} ${p}`);
      }
    }
    return out;
  }, danger);
  expect(hits, "nothing resolves to --danger").toEqual([]);
  expect(await page.locator("body").innerText()).not.toMatch(/\bbehind\b/i);
}

/** Below 1024px the primary sits inside the bottom 96px of the viewport, on screen. */
async function expectPrimaryInThumbZone(page: Page) {
  if (wide(page)) {
    await expect(primary(page)).toBeVisible();
    return;
  }
  const vh = page.viewportSize()!.height;
  const box = (await primary(page).boundingBox())!;
  expect(box.y, "the primary's top is in the bottom 96px").toBeGreaterThanOrEqual(vh - 96);
  expect(box.y + box.height, "and it is on screen").toBeLessThanOrEqual(vh);
}

/** The UX floor's targets: thumb-bar controls 44px (48 on the tablet), nothing interactive under 24px. */
async function expectTargets(page: Page) {
  if (!wide(page)) {
    for (const c of await page.locator(".actionbar > *").all()) expect((await c.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  for (const c of await page.locator("main a:visible, main button:visible").all()) {
    const box = (await c.boundingBox())!;
    const name = (await c.getAttribute("aria-label")) ?? (await c.textContent());
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(24);
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(24);
  }
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoDanger(page);
  await expectPrimaryInThumbZone(page);
  await expectTargets(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

test.describe("reading", () => {
  test.beforeEach(() => seed({ reading: true }));

  test("the five slots in order, Now holding the book in hand, and the UX floor (AC-1, AC-5)", async ({ page }, info) => {
    await open(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Books");
    const slots = await page.locator("main [data-slot]").evaluateAll((els) => els.map((el) => el.getAttribute("data-slot")));
    expect(slots).toEqual(["now", "next", "position", "situation", "rollup"]);
    await expect(page.locator(".now-name")).toHaveText(HERO);
    await expect(page.locator(".now-kick")).toHaveText("Reading now");
    await expect(page.locator(".dash-lede")).toHaveText(`Two weeks into ${HERO}.`);
    await expect(page.locator(".now-foot")).toHaveText(/^Started .+ · about 18 evenings at your set pace$/);
    await expect(page.locator(".now-pages")).toHaveText("468 pages");
    // No position, no meter, until 2.1b (Q1); Log progress waits, and says why.
    await expect(page.locator(".now-hero meter, .now-hero [role=meter], .now-hero .meter")).toHaveCount(0);
    const log = verbs(page).getByRole("button", { name: wide(page) ? "Log pages" : "Log progress" });
    await expect(log).toHaveAttribute("aria-disabled", "true");
    await expect(log).toHaveAttribute("title", "Logging pages arrives with sessions (2.1b)");
    await floor(page);
    await screenshot(page, info, "books-reading");
  });

  test("Up next in Qn lists the quarter's to-read books in order, skipping the read one (AC-2)", ONCE, async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-slot="next"] h2')).toHaveText(`Up next in Q${Q}`);
    await expect(shelfTitles(page)).toHaveText([`1. ${ONE}`, `3. ${THREE}`]);
  });

  test("Reorder opens 1.9's reorder for this quarter (AC-2)", ONCE, async ({ page }) => {
    await open(page);
    await page.getByRole("link", { name: "Reorder" }).click();
    await page.waitForURL(`**/books/status?tab=next#plan-${PERIOD}`);
    const quarter = page.locator(`section[aria-labelledby="plan-${PERIOD}"]`);
    await expect(quarter).toBeVisible();
    await expect(quarter.locator(".qtitle")).toHaveText([ONE, THREE]);
  });

  test("a Listening hero carries the headphones glyph (AC-2)", ONCE, async ({ page }) => {
    await withSql((sql) => sql`UPDATE book_status SET status = 'listening' WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-hero'`);
    await open(page);
    await expect(page.locator(".now-kick")).toHaveText(/^Listening now/);
    await expect(page.locator(".now-kick").getByRole("img", { name: "Listening" })).toBeVisible();
  });

  test("the strip's figure is 2.1's for the quarter, and 2026 so far is three counts, all this year (AC-1, AC-3)", ONCE, async ({ page }) => {
    const [cap] = await withSql((sql) => sql<{ planned_words: number; books: number; read_books: number; capacity: number }[]>`
      SELECT planned_words, books, read_books, capacity FROM plan_capacity WHERE user_id = ${E2E_USER} AND period = ${PERIOD}`);
    await open(page);
    const k = (n: number) => `${Math.round(n / 1000)}k`;
    await expect(page.locator(".qhead")).toHaveText(`Q${Q} ${YEAR}${cap.read_books} of ${cap.books} read`);
    await expect(page.locator(".qfig")).toHaveText(`${k(cap.planned_words)} planned`);
    await expect(page.locator(".qfigs > :last-child")).toHaveText(`${k(cap.capacity)} a quarter`);
    // The hero is reading, unplanned; One, Two (read) and Three: 92k + 30k + 100k.
    expect(cap.planned_words).toBe(222_000);

    const year = page.locator('[data-slot="rollup"]');
    await expect(year.locator("h2")).toHaveText(`${YEAR} so far`);
    await expect(year.locator("dt")).toHaveText(["books · 1 listened", "pages", "new authors"]);
    await expect(year.locator("dd")).toHaveText(["2", "500", "2"]);
  });

  // Every project: the badge is the strip's widest content, so it is checked at every width and theme.
  test("past capacity the figure is --blocked amber with what it is over, nothing is --danger, and nothing says behind (AC-3)", async ({ page }, info) => {
    // 2M more words this quarter: far past any capacity Settings allows a quarter.
    await withSql(async (sql) => {
      await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES ('e2e-dash-big', 'E2E Dash Big', 2000000, 'stated')`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, 'e2e-dash-big', 'to_read')`;
      await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, 'e2e-dash-big', ${PERIOD}, 4)`;
    });
    await open(page);
    const fig = page.locator(".qfig.over");
    await expect(fig).toBeVisible();
    expect((await computedStyle(fig, ["color"])).color).toBe(await tokenColour(page, "--blocked"));
    await expect(fig.locator(".bdg.bl")).toHaveText(/^[\d.]+[kM] over$/);
    await expectNoDanger(page);
    await expectNoHorizontalScroll(page);
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "books-over-capacity");
  });

  test("✓ finished finishes the book today with Undo; Between books then names it and offers the top of the plan", ONCE, async ({ page }) => {
    await open(page);
    await verbs(page).getByRole("button", { name: `Finished ${HERO}` }).click();
    await expect(page.locator(".toast-label").first()).toHaveText(`${HERO}: read`);
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".between-line")).toContainText(`You finished ${HERO} today, 468 pages in 14 days.`);
    await expect(primary(page)).toHaveAccessibleName(`Start ${ONE}`);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".now-name")).toHaveText(HERO);
    expect(await withSql((sql) => sql`SELECT status FROM book_status WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-hero'`))
      .toEqual([{ status: "reading" }]);
  });

  test("Plan moves an On deck book to the end of the quarter, with Undo (Q3)", ONCE, async ({ page }) => {
    await open(page);
    const deck = page.locator('[data-slot="situation"]');
    await expect(deck.locator(".row-title")).toHaveText(DECK.slice(0, 3));
    await expect(deck.getByRole("link", { name: "All 4" })).toHaveAttribute("href", "/books/status?tab=next#plan-deck");
    await deck.getByRole("button", { name: `Plan ${DECK[0]} for Q${Q} ${YEAR}` }).click();
    await expect(page.locator(".toast-label").first()).toHaveText(`${DECK[0]}: planned for Q${Q} ${YEAR}`);
    await expect(shelfTitles(page)).toHaveText([`1. ${ONE}`, `3. ${THREE}`, `4. ${DECK[0]}`]);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(shelfTitles(page)).toHaveText([`1. ${ONE}`, `3. ${THREE}`]);
    await expect(deck.locator(".row-title").first()).toHaveText(DECK[0]);
  });

  test("the loading state is the loaded geometry in --sunk (AC-5)", ONCE, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page);
    const measure = (selector: string) => page.locator(selector).evaluateAll((els) =>
      els.map((el) => { const r = el.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; }));
    const parts = [".now-hero", ".shelf .card", ".qcard"];
    const loaded = await Promise.all(parts.map((p) => measure(p)));
    await page.evaluate((html) => { document.querySelector("main")!.outerHTML = html; }, renderToStaticMarkup(createElement(Loading)));
    const skeleton = await Promise.all(parts.map((p) => measure(p)));
    for (const [n, part] of parts.entries()) {
      const want = part === ".shelf .card" ? loaded[n].slice(0, 1) : loaded[n];
      const got = part === ".shelf .card" ? skeleton[n].slice(0, 1) : skeleton[n];
      expect(got.length, part).toBe(want.length);
      got.forEach((b, i) => {
        expect(Math.abs(b.width - want[i].width), `${part} width`).toBeLessThanOrEqual(2);
        expect(Math.abs(b.height - want[i].height), `${part} height`).toBeLessThanOrEqual(2);
      });
    }
    expect((await computedStyle(page.locator(".now-cover .sk"), ["background-color"]))["background-color"])
      .toBe(await tokenColour(page, "--sunk"));
  });
});

test.describe("between books", () => {
  test.beforeEach(() => seed({ between: true }));

  test("names the last finish, and offers the quarter's lowest-ordinal book still to read, by name (AC-1, AC-5)", async ({ page }, info) => {
    await open(page);
    await expect(page.locator(".dash-lede")).toHaveText("Nothing on the go right now.");
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".between-head .bdg")).toHaveText(/^✓ finished · (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/);
    await expect(page.locator(".between-line")).toHaveText(
      new RegExp(`^You finished ${TWO} on [A-Z][a-z]+day, 300 pages in nine days\\. Nothing’s on the go, and that’s fine\\.$`));
    await expect(page.locator(".offer-kick")).toHaveText(`Top of your Q${Q} plan`);
    await expect(page.locator(".offer-title")).toHaveText(ONE);
    await expect(primary(page)).toHaveAccessibleName(`Start ${ONE}`);
    // No finish verb with nothing in hand (§14.6).
    await expect(verbs(page).getByRole("button", { name: /^Finished/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pick something else" })).toHaveAttribute("href", "/books/status?tab=next");
    await floor(page);
    await screenshot(page, info, "books-between");
  });

  test("the offer skips a read book: with 1 read too, it is 3 (AC-2, D-37)", ONCE, async ({ page }) => {
    await withSql((sql) => sql`UPDATE book_status SET status = 'read' WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-1'`);
    await open(page);
    await expect(page.locator(".offer-title")).toHaveText(THREE);
    await expect(primary(page)).toHaveAccessibleName(`Start ${THREE}`);
  });

  test("Start {title} sets the offer to Reading, with Undo", ONCE, async ({ page }) => {
    await open(page);
    await primary(page).click();
    await expect(page.locator(".now-name")).toHaveText(ONE);
    await expect(page.locator(".dash-lede")).toHaveText(`Started ${ONE} today.`);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".between-title")).toHaveText("Between books.");
  });
});

// Task 2.2d (F-68, D-108): what is next in what you follow as Reading. Untagged tests run in
// every project (each width, light and dark, reduced motion), so their screenshots are the
// feel pass's; reduced transparency is the describe at the end of this file.
test.describe("next in what you follow as Reading (2.2d)", () => {
  test("between books, Or keep going lists book 3 with its reason and a named, 44px Start (AC-1, AC-4)", async ({ page }, info) => {
    await seed({ between: true });
    await seedSaga({ twoInHand: false });
    await open(page);
    const keep = page.locator(".keep-going");
    await expect(keep.locator(".offer-kick")).toHaveText("Or keep going");
    await expect(keep.getByRole("list", { name: "Or keep going" }).getByRole("listitem")).toHaveCount(1);
    await expect(keep.locator(".keep-title")).toHaveText([SAGA[2]]);
    await expect(keep.locator(".keep-why")).toHaveText([`Next in ${SAGA_NAME} · 2 of 4 read`]);
    const start = keep.getByRole("button", { name: `Start ${SAGA[2]}` });
    await expect(start).toBeVisible();
    expect((await start.boundingBox())!.height, "Start is 44px or more").toBeGreaterThanOrEqual(44);
    // The offer is still the primary, and Pick something else stays.
    await expect(page.locator(".offer-title")).toHaveText(ONE);
    await expect(primary(page)).toHaveAccessibleName(`Start ${ONE}`);
    await expect(page.getByRole("link", { name: "Pick something else" })).toBeVisible();
    // Grey: the reason is --muted, never amber or red (the floor checks --danger and 4.5:1).
    expect((await computedStyle(keep.locator(".keep-why"), ["color"])).color).toBe(await tokenColour(page, "--muted"));
    await floor(page);
    await screenshot(page, info, "books-keep-going");
  });

  test("Start sets book 3 Reading, and Undo restores to_read (AC-1)", ONCE, async ({ page }) => {
    await seed({ between: true });
    await seedSaga({ twoInHand: false });
    await open(page);
    const status = () => withSql((sql) => sql`SELECT status, started_on_precision FROM book_status
      WHERE user_id = ${E2E_USER} AND book_id = ${sagaId(3)}`);
    await page.locator(".keep-going").getByRole("button", { name: `Start ${SAGA[2]}` }).click();
    await expect(page.locator(".now-name")).toHaveText(SAGA[2]);
    expect(await status()).toEqual([{ status: "reading", started_on_precision: "exact" }]);
    // Now, reading book 3, names book 4 as next.
    await expect(page.locator(".now-next")).toHaveAccessibleName(`Next in ${SAGA_NAME}: ${SAGA[3]}`);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".keep-going .keep-title")).toHaveText([SAGA[2]]);
    expect(await status()).toEqual([{ status: "to_read", started_on_precision: "none" }]);
  });

  test("reading book 2, Now shows one Next in line naming book 3, a link to it (AC-1, AC-4)", async ({ page }, info) => {
    await seed({ reading: true });
    await seedSaga({ twoInHand: true });
    await open(page);
    await expect(page.locator(".now-name")).toHaveText(SAGA[1]);
    const next = page.locator(".now-hero").getByRole("link", { name: `Next in ${SAGA_NAME}: ${SAGA[2]}` });
    await expect(page.locator(".now-next")).toHaveCount(1);
    await expect(next).toHaveAttribute("href", `/books/list?q=${encodeURIComponent(SAGA[2]).replace(/%20/g, "+")}`);
    expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await computedStyle(page.locator(".now-next-text"), ["color"])).color).toBe(await tokenColour(page, "--ink-2"));
    // Nothing to keep going with while a book is in hand.
    await expect(page.locator(".keep-going")).toHaveCount(0);
    await floor(page);
    await screenshot(page, info, "books-next-in");
  });

  test("with nothing followed as Reading, there is no Next in and no Or keep going", ONCE, async ({ page }) => {
    await seed({ between: true });
    await seedSaga({ twoInHand: false });
    await withSql((sql) => sql`UPDATE series_follows SET state = 'tracking' WHERE user_id = ${E2E_USER} AND series_id = 'e2e-dash-saga'`);
    await open(page);
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".keep-going, .now-next")).toHaveCount(0);
  });
});

test.describe("never finished, nothing planned", () => {
  test.beforeEach(seedEmpty);

  test("Between books with no finished line, and an empty slate with one primary in Up next (AC-1, AC-5)", async ({ page }, info) => {
    await open(page);
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".between-cover, .between-head .bdg")).toHaveCount(0);
    await expect(page.locator(".between-line")).toHaveText("Nothing’s on the go, and that’s fine.");
    // With no offer and no cover, the line still keeps the row; below 768 Pick something else is a row of its own.
    const hero = (await page.locator(".now-hero").boundingBox())!;
    const said = (await page.locator(".between-offer .offer-body").boundingBox())!;
    const pick = (await page.locator(".pick-else").boundingBox())!;
    expect(said.width, "the offer line is not squeezed").toBeGreaterThan(hero.width / 2);
    if (page.viewportSize()!.width < 768) expect(pick.y).toBeGreaterThanOrEqual(said.y + said.height - 1);
    const next = page.locator('[data-slot="next"]');
    await expect(next.locator(".slate")).toBeVisible();
    await expect(next.locator(".slate .btn")).toHaveCount(1);
    await expect(next.locator(".slate .btn")).toHaveText("Add a book");
    await expect(primary(page)).toHaveAccessibleName("Pick a book");
    await expect(primary(page)).toHaveAttribute("href", "/books/status?tab=next");
    await floor(page);
    await screenshot(page, info, "books-empty");
  });
});

test.describe("the side rail and Plan's reveal (FP-D15)", () => {
  test.beforeEach(() => seed({ reading: true }));

  test("at 1280, On deck and 2026 so far are in the side rail, and Plan is hidden at rest, shown on hover and focus (AC-1)", DESK, async ({ page }, info) => {
    await open(page);
    const main = (await page.locator(".dash-main").boundingBox())!;
    const side = page.locator(".dash-side");
    for (const slot of ["situation", "rollup"]) {
      await expect(side.locator(`[data-slot="${slot}"]`)).toBeVisible();
      expect((await side.locator(`[data-slot="${slot}"]`).boundingBox())!.x, slot).toBeGreaterThan(main.x + main.width);
    }
    const row = page.locator(".deck-row").first();
    const plan = row.getByRole("button", { name: /^Plan / });
    const opacity = async () => (await computedStyle(plan, ["opacity"])).opacity;
    await page.mouse.move(0, 0);
    expect(await opacity()).toBe("0");
    await row.hover();
    await expect.poll(opacity).toBe("1");
    await screenshot(page, info, "books-plan-hover");
    await page.mouse.move(0, 0);
    await expect.poll(opacity).toBe("0");
    await plan.focus();
    await expect.poll(opacity).toBe("1");
  });

  test("with touch, Plan is always shown", TOUCH, async ({ page }) => {
    await open(page);
    for (const plan of await page.locator(".deck-row").getByRole("button", { name: /^Plan / }).all()) {
      expect((await computedStyle(plan, ["opacity"])).opacity).toBe("1");
      await expect(plan).toBeVisible();
    }
  });
});

// The UX floor's reduced-transparency pass (docs/04-design.md § 10), once, at the phone and at 1280:
// the glass (the phone's bar, the desktop's header band) falls back to --surface in both states.
test.describe("reduced transparency", () => {
  // 2.2d's two states too: reading with *Next in*, and between books with *Or keep going*.
  for (const [state, seedState, saga] of [
    ["reading", { reading: true }, null], ["between", { between: true }, null],
    ["next-in", { reading: true }, { twoInHand: true }], ["keep-going", { between: true }, { twoInHand: false }],
  ] as const) {
    test(`${state}: the glass is solid --surface, with a screenshot at 390 and 1280 (AC-1, AC-5)`, ONCE, async ({ page, context }, info) => {
      await seed(seedState);
      if (saga) await seedSaga(saga);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
      for (const [width, glass] of [[390, ".bar"], [1280, ".pagehead"]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await open(page);
        const surface = await page.evaluate(() => {
          const probe = document.createElement("i");
          probe.style.backgroundColor = "var(--surface)";
          document.body.append(probe);
          const c = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return c;
        });
        await expect.poll(() => page.locator(glass).first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
        expect(await page.locator(glass).first().evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
        await expectNoHorizontalScroll(page);
        await screenshot(page, info, `books-${state}-reduced-transparency-${width}`);
      }
    });
  }
});
