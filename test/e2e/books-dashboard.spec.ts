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
  // 2.2d's series, after its books; its follow goes with it (cascade). 2.2g's subseries go before
  // their series, and its universes after the books in them.
  await sql`DELETE FROM book_subseries WHERE id LIKE 'e2e-dash-%'`;
  await sql`DELETE FROM book_series WHERE id LIKE 'e2e-dash-%'`;
  await sql`DELETE FROM book_universes WHERE id LIKE 'e2e-dash-%'`;
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

const UNIVERSE_NAME = "E2E Dash Universe";
const WSERIES_NAME = "E2E Dash Where Series";
const WSUB_NAME = "E2E Dash Where Subseries";

type Where = {
  universe?: boolean; series?: boolean; subseries?: boolean;
  /** The hero's author (Dash Author One), and how she is followed, if at all. */
  authored?: boolean; author?: "tracking" | "reading" | null; universeName?: string;
};

/**
 * 2.2g's fixture, on top of `seed({ reading: true })`: the hero in a universe, a series (stated 8
 * books) and a subseries, each with a read sibling and two unread: the universe and subseries read
 * 1 / 4, the series 1 / 8. The series is followed as Reading, so the hero has a *Next in* line too.
 */
async function seedWhere(o: Where = {}) {
  const { universe = true, series = true, subseries = true, authored = false, author = null, universeName = UNIVERSE_NAME } = o;
  await withSql(async (sql) => {
    if (universe) await sql`INSERT INTO book_universes (id, name) VALUES ('e2e-dash-uni', ${universeName})`;
    if (series) await sql`INSERT INTO book_series (id, name, total_books) VALUES ('e2e-dash-wser', ${WSERIES_NAME}, 8)`;
    if (series && subseries) await sql`INSERT INTO book_subseries (id, name, series_id) VALUES ('e2e-dash-wsub', ${WSUB_NAME}, 'e2e-dash-wser')`;
    const uni = universe ? "e2e-dash-uni" : null;
    const ser = series ? "e2e-dash-wser" : null;
    const sub = series && subseries ? "e2e-dash-wsub" : null;
    await sql`UPDATE books SET universe_id = ${uni}, series_id = ${ser}, subseries_id = ${sub},
              author_id = ${authored || author ? "e2e-dash-a1" : null} WHERE id = 'e2e-dash-hero'`;
    if (universe || series) {
      for (const n of [1, 2, 3]) {
        await sql`INSERT INTO books (id, title, universe_id, series_id, subseries_id, page_count)
                  VALUES (${`e2e-dash-w${n}`}, ${`E2E Dash Where ${n}`}, ${uni}, ${ser}, ${sub}, 300)`;
      }
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, format)
                VALUES (${E2E_USER}, 'e2e-dash-w1', ${daysAgo(60)}, 'exact', 'text')`;
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, 'e2e-dash-w1', 'read', ${daysAgo(60)}, 'exact')`;
      for (const n of [2, 3]) await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${`e2e-dash-w${n}`}, 'to_read')`;
    }
    if (series) await sql`INSERT INTO series_follows (user_id, series_id, state) VALUES (${E2E_USER}, 'e2e-dash-wser', 'reading')`;
    if (author) await sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${E2E_USER}, 'e2e-dash-a1', ${author})`;
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

  // Task 1.17b (D-131): the status control on Now. It writes nothing until a test says so.
  const hero = () => withSql(async (sql) => ({
    status: (await sql`SELECT status, started_on::text AS started_on FROM book_status WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-hero'`)[0],
    reads: [...await sql`SELECT started_on::text AS started_on, finished_on::text AS finished_on FROM read_events
                         WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-hero'`].map((r) => ({ ...r })),
  }));

  test("Now carries the status control: Started opens a picker with 44px options on the phone, focus comes back, the floor holds (1.17b, AC-5, AC-6)", async ({ page }, info) => {
    await open(page);
    const now = page.locator(".now-hero");
    const toggle = now.locator(".status-toggle");
    await hydrated(toggle);
    await expect(toggle).toHaveText("Status: reading");
    // No row menu on the dashboard.
    await expect(now.locator(".row-more-btn")).toHaveCount(0);
    await toggle.click();
    await expect(now.getByRole("group", { name: `Status of ${HERO}` })).toBeVisible();
    const started = now.getByRole("button", { name: /^Started / });
    await started.click();
    const group = now.getByRole("group", { name: "Started" });
    await expect(group.getByRole("radio", { name: "Pick a date" })).toBeChecked();
    if (page.viewportSize()!.width < 768) {
      for (const radio of await group.getByRole("radio").all()) {
        // The option is the label around the input, which sits inside its border.
        expect((await radio.locator("xpath=..").boundingBox())!.height, "a picker option").toBeGreaterThanOrEqual(44);
      }
    }
    await floor(page);
    await screenshot(page, info, "books-now-control");
    await page.keyboard.press("Escape");
    await expect(group).toHaveCount(0);
    await expect(started).toBeFocused();
  });

  test("Now: switching to Listening saves and opens nothing; Undo puts Reading back (1.17b, AC-1)", ONCE, async ({ page }) => {
    await open(page);
    const now = page.locator(".now-hero");
    await hydrated(now.locator(".status-toggle"));
    await now.locator(".status-toggle").click();
    await now.getByRole("button", { name: "Listening", exact: true }).click();
    await expect.poll(async () => (await hero()).status.status).toBe("listening");
    expect((await hero()).status.started_on).toBe(daysAgo(14));
    await expect(now.getByRole("group", { name: "Started" })).toHaveCount(0);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await hero()).status.status).toBe("reading");
  });

  test("Now: Read opens both; a start after the finish is refused and writes nothing; confirming writes one read with both dates (1.17b, AC-1)", ONCE, async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/api/progress/")) posts.push(r.url()); });
    await open(page);
    const now = page.locator(".now-hero");
    await hydrated(now.locator(".status-toggle"));
    await now.locator(".status-toggle").click();
    await now.getByRole("button", { name: "Read", exact: true }).click();
    const finished = now.getByRole("group", { name: "Finished" });
    await expect(now.getByRole("group", { name: "Started" })).toBeVisible();
    await expect(finished.getByRole("radio", { name: "Today" })).toBeChecked();

    await finished.getByRole("radio", { name: "Pick a date" }).check();
    await now.getByLabel("Finished on").fill(daysAgo(20));
    await expect(now.locator(".sheet-reason").first()).toHaveText("That's after the day you finished.");
    const save = now.getByRole("button", { name: "Save" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    // aria-disabled is not disabled: the click lands, and sends nothing.
    await save.click({ force: true });
    expect(posts).toEqual([]);
    expect(await hero()).toEqual({ status: { status: "reading", started_on: daysAgo(14) }, reads: [] });

    await finished.getByRole("radio", { name: "Today" }).check();
    await save.click();
    await expect.poll(async () => (await hero()).reads).toEqual([{ started_on: daysAgo(14), finished_on: DAY }]);
    expect((await hero()).status.status).toBe("read");
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
    // The strip is the plan rail on its side (task 2.2b): the last block is past the rule and hatched in amber.
    const last = page.locator(".planrail.strip button.qb").last();
    await expect(last).toHaveClass(/\bover\b/);
    const hatch = last.locator(".ov");
    await expect(hatch).toBeVisible();
    const drawn = await hatch.evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, color: s.backgroundColor };
    });
    expect(drawn.image).toContain("repeating-linear-gradient");
    expect(drawn.color).toBe(await tokenColour(page, "--blocked-soft"));
    // A block paints only where it is drawn: a short one's 24px box must not paint over its neighbour's label.
    for (const box of await page.locator(".planrail.strip button.qb").all()) {
      expect(await box.evaluate((el) => getComputedStyle(el).backgroundClip)).toBe("padding-box");
    }
    for (const box of await page.locator(".planrail.strip button.qb").all()) {
      const r = (await box.boundingBox())!;
      expect(r.width, "a strip block is at least 24px wide").toBeGreaterThanOrEqual(24);
      expect(r.height).toBeGreaterThanOrEqual(24);
    }
    await expectNoDanger(page);
    await expectNoHorizontalScroll(page);
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "books-over-capacity");
  });

  // Task 2.3 (part 3): the strip's blocks open the plan picker, a stack its list.
  const strip = (page: Page) => page.locator(".planrail.strip");
  const stripBlock = (page: Page, n: number) => strip(page).locator(`button.qb[data-book="e2e-dash-${n}"]`);
  /** Three 30k books at the end of the quarter: adjacent, each 11px on the strip, so one 35px stack. */
  const seedStack = () => withSql(async (sql) => {
    for (const n of [4, 5, 6]) {
      await sql`INSERT INTO books (id, title, word_count, word_count_source) VALUES (${`e2e-dash-${n}`}, ${`E2E Dash Tiny ${n}`}, 30000, 'stated')`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${`e2e-dash-${n}`}, 'to_read')`;
      await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${`e2e-dash-${n}`}, ${PERIOD}, ${n})`;
    }
  });
  const ordersOf = () => withSql((sql) => sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${E2E_USER}
    AND period = ${PERIOD} AND book_id LIKE 'e2e-dash-%' ORDER BY ordinal`).then((rows) => rows.map((r) => [r.book_id, r.ordinal]));

  test("a strip block opens the picker for its book, the URL does not change, the rail has no form, and Esc puts focus back on it (AC-2)", ONCE, async ({ page }) => {
    await open(page);
    const one = stripBlock(page, 1);
    await hydrated(one);
    await expect(strip(page).locator("form")).toHaveCount(0);
    const url = page.url();
    await one.click();
    const sheet = page.getByRole("dialog", { name: ONE });
    await expect(sheet).toBeVisible();
    expect(page.url()).toBe(url);
    await expect(sheet.locator(".pp-chip").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(one).toBeFocused();
  });

  test("moving a block to another quarter redraws the strip with the new total; Undo puts the book and the strip back (AC-4)", ONCE, async ({ page }) => {
    await open(page);
    const k = (n: number) => `${Math.round(n / 1000)}k`;
    await expect(page.locator(".qfig")).toHaveText(`${k(222_000)} planned`);
    await expect(page.locator(".qhead")).toContainText("1 of 3 read");
    const before = await ordersOf();
    expect(before).toEqual([["e2e-dash-1", 1], ["e2e-dash-2", 2], ["e2e-dash-3", 3]]);

    const one = stripBlock(page, 1);
    await hydrated(one);
    await one.click();
    const sheet = page.getByRole("dialog", { name: ONE });
    await sheet.getByRole("button", { name: new RegExp(`^${YEAR + 1}`) }).click();
    await sheet.getByRole("group", { name: `Quarter of ${YEAR + 1}` }).getByRole("button", { name: /^Q2/ }).click();
    await sheet.getByRole("button", { name: `Move to Q2 ${YEAR + 1}` }).click();

    await expect(page.locator(".toast-label").first()).toHaveText(`Moved to Q2 ${YEAR + 1}`);
    await expect(sheet).toBeHidden();
    // The strip is drawn again without it: 130k of the quarter's 222k, two books, the block gone.
    await expect(page.locator(".qfig")).toHaveText(`${k(130_000)} planned`);
    await expect(page.locator(".qhead")).toContainText("1 of 2 read");
    await expect(one).toHaveCount(0);
    // The block that held focus is gone: focus lands on the strip, whose name carries the new summary.
    await expect(strip(page)).toBeFocused();
    await expect(strip(page)).toHaveAccessibleName(/: 1 of 2 books read, 130k of \d+k words planned$/);
    expect(await ordersOf()).toEqual([["e2e-dash-2", 1], ["e2e-dash-3", 2]]);

    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".qfig")).toHaveText(`${k(222_000)} planned`);
    await expect(one).toHaveCount(1);
    expect(await ordersOf()).toEqual(before);
  });

  // Every project: the list sheet and the picker it opens, at each width and theme, with the page's floor.
  test("a strip stack opens its list sheet, choosing a book opens its picker, and the floor holds with each open (AC-3, AC-5)", async ({ page }, info) => {
    await seedStack();
    await open(page);
    const stack = strip(page).locator("button.stack");
    await expect(stack).toHaveCount(1);
    await hydrated(stack);
    await expect(stack).toHaveAccessibleName("3 books, 90k words");
    await expect(stack).not.toHaveAttribute("aria-disabled", /.*/);
    await expect(page.locator(".qnote")).toHaveCount(0);
    // The strip is laid out in fractions of the card, so a 24px box can measure 23.98 at 360px: whole px, as axe's target-size rounds.
    const box = (await stack.boundingBox())!;
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(24);
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(24);
    await floor(page);

    await stack.click();
    const list = page.getByRole("dialog", { name: "3 books, 90k words" });
    await expect(list).toBeVisible();
    await expect(list.locator("ul button")).toHaveText([/^E2E Dash Tiny 4\s*30k$/, /^E2E Dash Tiny 5\s*30k$/, /^E2E Dash Tiny 6\s*30k$/]);
    for (const row of await list.locator("ul button").all()) expect(Math.round((await row.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    await expectNoAxeViolations(page, [...AXE, "aria-dialog-name"], ".sheet");
    await expectNoHorizontalScroll(page);
    await expectNoDanger(page);
    expect(await contrastFailures(page)).toEqual([]);
    await screenshot(page, info, "books-stack-list");

    await list.getByRole("button", { name: "E2E Dash Tiny 5, 30k words" }).click();
    const picker = page.getByRole("dialog", { name: "E2E Dash Tiny 5" });
    await expect(picker.locator(".pp-chip").first()).toBeVisible();
    await expectNoAxeViolations(page, [...AXE, "aria-dialog-name"], ".sheet");
    await expectNoHorizontalScroll(page);
    await expectNoDanger(page);
    await screenshot(page, info, "books-stack-picker");

    await page.keyboard.press("Escape");
    await expect(picker).toBeHidden();
    await expect(stack).toBeFocused();
    expect(await ordersOf()).toHaveLength(6);
  });

  // The UX floor's reduced-motion and reduced-transparency pass for the sheet a stack opens: solid --overlay, no glass.
  test("with reduced motion and reduced transparency the list sheet is solid --overlay, with a screenshot (AC-5)", ONCE, async ({ page, context }, info) => {
    await seedStack();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [
      { name: "prefers-reduced-transparency", value: "reduce" }, { name: "prefers-reduced-motion", value: "reduce" },
    ] });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const stack = strip(page).locator("button.stack");
      await hydrated(stack);
      await stack.click();
      const list = page.getByRole("dialog", { name: "3 books, 90k words" });
      await expect(list).toBeVisible();
      expect(await list.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(await tokenColour(page, "--overlay"));
      expect(await list.evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
      await expectNoHorizontalScroll(page);
      await screenshot(page, info, `books-stack-list-reduced-${width}`);
      await page.keyboard.press("Escape");
      await expect(list).toBeHidden();
    }
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

// Task 2.2g (F-72, D-119, D-108): where the book sits. Thin rows under Now's band, one per level,
// read / total from the progress views. Untagged tests run in every project, so their screenshots
// are the feel pass's; the 834px frame is set by hand (no project has it).
test.describe("where the book sits (2.2g)", () => {
  const rowsOf = (page: Page) => page.locator(".now-where li");
  const names = (page: Page) => page.locator(".now-where-name");
  const figures = (page: Page) => page.locator(".now-where-n");
  /** The views' figures for the fixture's universe, series and subseries, as the rows write them. */
  const viewFigures = () => withSql(async (sql) => {
    const [u] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM universe_progress WHERE user_id = ${E2E_USER} AND universe_id = 'e2e-dash-uni'`;
    const [s] = await sql`SELECT books_read::int AS r, total_books::int AS t FROM series_progress WHERE user_id = ${E2E_USER} AND series_id = 'e2e-dash-wser'`;
    const [b] = await sql`SELECT books_read::int AS r, books_listed::int AS t FROM subseries_progress WHERE user_id = ${E2E_USER} AND subseries_id = 'e2e-dash-wsub'`;
    return [u, s, b].map((v) => `${v.r} / ${v.t}`);
  });

  test.beforeEach(() => seed({ reading: true }));

  test("a book in a universe, a series and a subseries draws three rows in order, each read / total its view's, filled with --ready (AC-1, AC-4, AC-5)", async ({ page }, info) => {
    await seedWhere();
    await open(page);
    await expect(rowsOf(page)).toHaveCount(3);
    await expect(names(page)).toHaveText([UNIVERSE_NAME, WSERIES_NAME, WSUB_NAME]);
    const want = await viewFigures();
    expect(want).toEqual(["1 / 4", "1 / 8", "1 / 4"]);
    await expect(figures(page)).toHaveText(want);

    // Every meter fills with --ready; the track is outlined in --faint-deco; 1 of 4 is a quarter of it.
    const ready = await tokenColour(page, "--ready");
    const deco = await tokenColour(page, "--faint-deco");
    for (const fill of await page.locator(".now-where .emeter i").all()) {
      expect((await computedStyle(fill, ["background-color"]))["background-color"]).toBe(ready);
    }
    expect((await computedStyle(page.locator(".now-where .emeter").first(), ["box-shadow"]))["box-shadow"]).toContain(deco);
    const track = (await page.locator(".now-where .emeter").first().boundingBox())!;
    const fill = (await page.locator(".now-where .emeter i").first().boundingBox())!;
    expect(Math.abs(fill.width - track.width / 4), "1 / 4 fills a quarter of the track").toBeLessThanOrEqual(1);
    const eighth = (await page.locator(".now-where .emeter i").nth(1).boundingBox())!;
    expect(Math.abs(eighth.width - track.width / 8), "1 / 8 fills an eighth").toBeLessThanOrEqual(1);

    // Under the band, above Next in (the series is followed as Reading), the rollup's type, not the hero's.
    const where = (await page.locator(".now-where").boundingBox())!;
    const band = (await page.locator(".now-band").boundingBox())!;
    const next = (await page.locator(".now-next").boundingBox())!;
    expect(where.y).toBeGreaterThanOrEqual(band.y + band.height - 1);
    expect(next.y).toBeGreaterThanOrEqual(where.y + where.height - 1);
    const size = (selector: string) => page.locator(selector).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size(".now-where-name")).toBeLessThan(await size(".now-name"));

    // The five slots keep their order.
    const slots = await page.locator("main [data-slot]").evaluateAll((els) => els.map((el) => el.getAttribute("data-slot")));
    expect(slots).toEqual(["now", "next", "position", "situation", "rollup"]);
    await floor(page);
    await screenshot(page, info, "books-where");
  });

  test("the rows are read-only text: no link, no button, the meter hidden from a screen reader (AC-1)", ONCE, async ({ page }) => {
    await seedWhere();
    await open(page);
    await expect(page.locator(".now-where a, .now-where button")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Where this book sits" }).getByRole("listitem")).toHaveCount(3);
    await expect(page.locator('.now-where .emeter[aria-hidden="true"]')).toHaveCount(3);
    await expect(page.locator(".now-where .emeter:not([aria-hidden])")).toHaveCount(0);
  });

  test("a book in a series alone draws one row (AC-1)", ONCE, async ({ page }) => {
    await seedWhere({ universe: false, subseries: false });
    await open(page);
    await expect(names(page)).toHaveText([WSERIES_NAME]);
    await expect(figures(page)).toHaveText(["1 / 8"]);
  });

  test("a standalone by an author nobody follows draws none, and one at tracking none (AC-1, AC-2)", ONCE, async ({ page }) => {
    await seedWhere({ universe: false, series: false, authored: true });
    await open(page);
    await expect(page.locator(".now-name")).toHaveText(HERO);
    await expect(page.locator(".now-where")).toHaveCount(0);
    await withSql((sql) => sql`INSERT INTO author_follows (user_id, author_id, state) VALUES (${E2E_USER}, 'e2e-dash-a1', 'tracking')`);
    await open(page);
    await expect(page.locator(".now-where")).toHaveCount(0);
  });

  test("a standalone by an author followed Reading draws the author's row (AC-1)", async ({ page }, info) => {
    await seedWhere({ universe: false, series: false, author: "reading" });
    await open(page);
    await expect(names(page)).toHaveText(["Dash Author One"]);
    const [a] = await withSql((sql) => sql`SELECT books_read::int AS r, books_listed::int AS t FROM author_progress WHERE user_id = ${E2E_USER} AND author_id = 'e2e-dash-a1'`);
    await expect(figures(page)).toHaveText([`${a.r} / ${a.t}`]);
    await floor(page);
    await screenshot(page, info, "books-where-author");
  });

  test("with a universe, an author followed Reading draws no author row; without one, the author, series, subseries (AC-2)", ONCE, async ({ page }) => {
    await seedWhere({ author: "reading" });
    await open(page);
    await expect(names(page)).toHaveText([UNIVERSE_NAME, WSERIES_NAME, WSUB_NAME]);
    await withSql((sql) => sql`UPDATE books SET universe_id = NULL WHERE id LIKE 'e2e-dash-%'`);
    await open(page);
    await expect(names(page)).toHaveText(["Dash Author One", WSERIES_NAME, WSUB_NAME]);
    await withSql((sql) => sql`UPDATE author_follows SET state = 'tracking' WHERE user_id = ${E2E_USER}`);
    await open(page);
    await expect(names(page)).toHaveText([WSERIES_NAME, WSUB_NAME]);
  });

  test("a level set to Not following still draws its row, with the same figure (AC-3)", ONCE, async ({ page }) => {
    await seedWhere();
    await withSql(async (sql) => {
      await sql`INSERT INTO universe_follows (user_id, universe_id, state) VALUES (${E2E_USER}, 'e2e-dash-uni', 'off')`;
      await sql`UPDATE series_follows SET state = 'off' WHERE user_id = ${E2E_USER}`;
      await sql`INSERT INTO subseries_follows (subseries_id, state) VALUES ('e2e-dash-wsub', 'off')`;
    });
    await open(page);
    await expect(names(page)).toHaveText([UNIVERSE_NAME, WSERIES_NAME, WSUB_NAME]);
    await expect(figures(page)).toHaveText(["1 / 4", "1 / 8", "1 / 4"]);
  });

  test("a Listening book draws the rows a Reading one does (AC-3)", ONCE, async ({ page }) => {
    await seedWhere();
    await withSql((sql) => sql`UPDATE book_status SET status = 'listening' WHERE user_id = ${E2E_USER} AND book_id = 'e2e-dash-hero'`);
    await open(page);
    await expect(page.locator(".now-kick")).toHaveText(/^Listening now/);
    await expect(names(page)).toHaveText([UNIVERSE_NAME, WSERIES_NAME, WSUB_NAME]);
  });

  test("✓ finished then Undo leaves the rows as they were; Between books draws none (AC-1, AC-4)", ONCE, async ({ page }) => {
    await seedWhere();
    await open(page);
    const before = await rowsOf(page).allInnerTexts();
    expect(before).toHaveLength(3);
    await verbs(page).getByRole("button", { name: `Finished ${HERO}` }).click();
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".now-where")).toHaveCount(0);
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".now-name")).toHaveText(HERO);
    expect(await rowsOf(page).allInnerTexts()).toEqual(before);
  });

  test("a long universe name wraps at 360px: no sideways scroll, the figure and meter stay whole (AC-5)", ONCE, async ({ page }) => {
    await seedWhere({ universeName: `E2E Dash ${"Supercalifragilisticexpialidocious ".repeat(3)}Universe` });
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page);
    await expectNoHorizontalScroll(page);
    const row = (await rowsOf(page).first().boundingBox())!;
    const hero = (await page.locator(".now-hero").boundingBox())!;
    expect(row.x + row.width).toBeLessThanOrEqual(hero.x + hero.width + 1);
    expect((await page.locator(".now-where .emeter").first().boundingBox())!.width).toBeGreaterThanOrEqual(60);
    await expect(figures(page).first()).toBeVisible();
  });

  test("a full Up next shelf and the rows together: no sideways scroll at 360px (AC-1)", ONCE, async ({ page }) => {
    await seedWhere();
    await withSql(async (sql) => {
      for (let n = 1; n <= 4; n++) {
        await sql`INSERT INTO books (id, title, page_count) VALUES (${`e2e-dash-shelf-${n}`}, ${`E2E Dash Shelf ${n}`}, 250)`;
        await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${`e2e-dash-shelf-${n}`}, 'to_read')`;
        await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${`e2e-dash-shelf-${n}`}, ${PERIOD}, ${3 + n})`;
      }
    });
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page);
    await expect(page.locator(".shelf .card")).toHaveCount(6);
    await expectNoHorizontalScroll(page);
  });

  test("the 834px frame: three rows, no sideways scroll, a screenshot by hand (AC-1)", ONCE, async ({ page }, info) => {
    await seedWhere();
    await page.setViewportSize({ width: 834, height: 1112 });
    await open(page);
    await expect(rowsOf(page)).toHaveCount(3);
    await expectNoHorizontalScroll(page);
    // From 768px the meter is 120px wide.
    expect((await page.locator(".now-where .emeter").first().boundingBox())!.width).toBeCloseTo(120, 0);
    await screenshot(page, info, "books-where-834");
  });

  test("Between books draws no rows (AC-1)", ONCE, async ({ page }) => {
    await seedWhere();
    await withSql((sql) => sql`UPDATE book_status SET status = 'to_read' WHERE user_id = ${E2E_USER} AND status IN ('reading', 'listening')`);
    await open(page);
    await expect(page.locator(".between-title")).toHaveText("Between books.");
    await expect(page.locator(".now-where")).toHaveCount(0);
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
  // And 2.2g's: reading with *where the book sits*.
  for (const [state, seedState, saga] of [
    ["reading", { reading: true }, null], ["between", { between: true }, null],
    ["next-in", { reading: true }, { twoInHand: true }], ["keep-going", { between: true }, { twoInHand: false }],
    ["where", { reading: true }, "where"],
  ] as const) {
    test(`${state}: the glass is solid --surface, with a screenshot at 390 and 1280 (AC-1, AC-5)`, ONCE, async ({ page, context }, info) => {
      await seed(seedState);
      if (saga === "where") await seedWhere();
      else if (saga) await seedSaga(saga);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
      for (const [width, glass] of [[390, ".bar"], [1280, ".pagehead"]] as const) {
        await page.setViewportSize({ width, height: 900 });
        await open(page);
        if (saga === "where") await expect(page.locator(".now-where li")).toHaveCount(3);
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

  // Task 1.17b (AC-6): the status control open on Now, its Started picker showing.
  test("reading, the status control open: the glass is solid --surface, with a screenshot at 390 and 1280 (1.17b, AC-6)", ONCE, async ({ page, context }, info) => {
    await seed({ reading: true });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    for (const [width, glass] of [[390, ".bar"], [1280, ".pagehead"]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const now = page.locator(".now-hero");
      await hydrated(now.locator(".status-toggle"));
      await now.locator(".status-toggle").click();
      await now.getByRole("button", { name: /^Started / }).click();
      await expect(now.getByRole("group", { name: "Started" })).toBeVisible();
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
      await screenshot(page, info, `books-now-control-reduced-transparency-${width}`);
    }
  });
});
