// @area: books
// Task 5.15, part 5 of 5 (TASK-111, F-66, D-105): the parked review in a real browser, on the TEST database.
// `/parked` lists every parked book, the one parked longest first, each with its age; *Plan…* opens 2.3's
// picker and a quarter puts the book at its end and off the review, its Undo back to Parked with no plan
// row; a book parked mid-read offers *Pick it back up* in its place, which puts it back in In flight with
// its start; *Unlisted* writes `unlisted` and its Undo puts back `parked`; *Keep parked* folds the row and
// writes nothing. When the review is due (a monthly cadence, the last review 40 days back) the books
// dashboard's rollup slot reads *Review N parked →* and the Inbox's first row is *Parked review*; *Done
// reviewing* takes both away, and when it isn't due neither shows. Nothing on the dashboard or the review
// resolves to --danger, and the review meets the UX floor (AC-6) at every `ui.viewports` width. The books
// are made here, under ids the rest of the suite doesn't use, and the settings row is put back as found
// after the last test; the browser suite runs one file at a time, so no other spec sees them.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import ParkedError from "../../src/app/parked/error";
import ParkedLoading from "../../src/app/parked/loading";
import { addMonths } from "../../src/lib/parked";
import { testSql, type TestSql } from "../db";
import {
  contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Every test here writes, or sets its own viewport and theme: once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order",
];
/** `ui.viewports` in .claude/kit.json: the review is shot at each. */
const VIEWPORTS = [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]] as const;

/** Today in Eastern (D-67), as the app reads it, and days before it. */
const DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
  .format(new Date());
const daysAgo = (n: number) => {
  const [y, m, d] = DAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
};

const P = "e2e-pr-";
const OLD = { id: `${P}old`, title: "E2E Pr Oldest", parkedOn: addMonths(DAY, -4), age: "Parked 4 months" };
const MID = { id: `${P}mid`, title: "E2E Pr Midread", parkedOn: addMonths(DAY, -3), age: "Parked 3 months", started: addMonths(DAY, -5) };
const NEW = { id: `${P}new`, title: "E2E Pr Newest", parkedOn: daysAgo(14), age: "Parked 2 weeks" };
const PARKED = [OLD, MID, NEW];
/** Planned first in the quarter *Plan…* targets, so the planned book's place is visibly its end. */
const FILLER = { id: `${P}filler`, title: "E2E Pr Filler" };
const YEAR = Number(DAY.slice(0, 4)) + 1;
const QUARTER = `${YEAR}-Q4`;

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** The settings row as the suite found it, put back after the last test. */
let settingsBefore: { parked_review: string; parked_reviewed_on: string | null } | null = null;

// Task 5.9b, 2 of 3 (TASK-141): NEW is in a series, by an author, in a universe; MID is by the same author alone. OLD keeps no
// place line: the loading skeleton is drawn for a row without one.
const PL = { au: `${P}au`, un: `${P}un`, se: `${P}se` };

const clean = () => db(async (sql) => {
  await sql`DELETE FROM books WHERE id LIKE ${P + "%"}`;
  await sql`DELETE FROM book_series WHERE id = ${PL.se}`;
  await sql`DELETE FROM book_universes WHERE id = ${PL.un}`;
  await sql`DELETE FROM authors WHERE id = ${PL.au}`;
});

/** Every book as the tests start them: the three parked on their days (MID with its start), FILLER at 1 in the quarter. */
const reset = () => db(async (sql) => {
  await sql`DELETE FROM reading_plan WHERE book_id LIKE ${P + "%"}`;
  for (const b of PARKED) {
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${b.parkedOn},
                started_on = ${b === MID ? MID.started : null}, started_on_precision = ${b === MID ? "exact" : "none"}
              WHERE user_id = ${E2E_USER} AND book_id = ${b.id}`;
  }
  await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${FILLER.id}, ${QUARTER}, 1)`;
  // Not due unless a test says so: reviewed today.
  await review("monthly", DAY);
});

/** The review's cadence and last day, in the one settings row. */
const review = (cadence: string, reviewedOn: string | null) => db((sql) => sql`
  INSERT INTO reading_settings (user_id, parked_review, parked_reviewed_on) VALUES (${E2E_USER}, ${cadence}, ${reviewedOn})
  ON CONFLICT (user_id) DO UPDATE SET parked_review = EXCLUDED.parked_review, parked_reviewed_on = EXCLUDED.parked_reviewed_on`);

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await clean();
  settingsBefore = await db(async (sql) => {
    const [found] = await sql`
      SELECT parked_review, parked_reviewed_on::text AS parked_reviewed_on FROM reading_settings WHERE user_id = ${E2E_USER}`;
    return found ? { parked_review: found.parked_review as string, parked_reviewed_on: found.parked_reviewed_on as string | null } : null;
  });
  await db(async (sql) => {
    await sql`INSERT INTO authors (id, name) VALUES (${PL.au}, 'Pr Author')`;
    await sql`INSERT INTO book_universes (id, name) VALUES (${PL.un}, 'Pr World')`;
    await sql`INSERT INTO book_series (id, name, author_id) VALUES (${PL.se}, 'Pr Cycle', ${PL.au})`;
    for (const b of [...PARKED, FILLER]) {
      await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${b.id}, 'to_read')`;
    }
    await sql`UPDATE books SET author_id = ${PL.au}, series_id = ${PL.se}, series_position = 5, universe_id = ${PL.un} WHERE id = ${NEW.id}`;
    await sql`UPDATE books SET author_id = ${PL.au} WHERE id = ${MID.id}`;
  });
});
test.beforeEach(reset);
test.afterAll(async () => {
  await clean();
  await db(async (sql) => {
    if (settingsBefore === null) {
      await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    } else {
      await sql`UPDATE reading_settings SET parked_review = ${settingsBefore.parked_review},
                  parked_reviewed_on = ${settingsBefore.parked_reviewed_on} WHERE user_id = ${E2E_USER}`;
    }
  });
});

/** What the database holds for a book: its status, parked day, start, and each plan row as `period:ordinal`. */
const stored = (id: string) => db(async (sql) => {
  const [s] = await sql`SELECT status, parked_on::text AS parked_on, started_on::text AS started_on
                        FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
  const plan = await sql`SELECT period, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND book_id = ${id}`;
  return { status: s?.status as string, parkedOn: s?.parked_on as string | null, started: s?.started_on as string | null,
    plan: plan.map((r) => `${r.period}:${r.ordinal}`) };
});
const lastOrdinal = (period: string) => db(async (sql) => (await sql`
  SELECT max(ordinal)::int AS n FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${period}`)[0].n as number);
const parkedCount = () => db(async (sql) => (await sql`
  SELECT count(*)::int AS n FROM book_status st JOIN books b ON b.id = st.book_id AND b.deleted_at IS NULL
  WHERE st.user_id = ${E2E_USER} AND st.status = 'parked'`)[0].n as number);
const reviewedOn = () => db(async (sql) => (await sql`
  SELECT parked_reviewed_on::text AS d FROM reading_settings WHERE user_id = ${E2E_USER}`)[0]?.d as string | null);

const rows = (page: Page) => page.locator(".parked-row").filter({ hasText: /E2E Pr/ });
const row = (page: Page, title: string) =>
  page.locator(".parked-row", { has: page.locator(".row-title", { hasText: new RegExp(`^${title}$`) }) });
const toast = (page: Page) => page.locator(".toast");
const line = (page: Page) => page.locator('[data-slot="rollup"] .parked-line a');
const chip = (sheet: Locator, name: string | number) => sheet.getByRole("button", { name: new RegExp(`^${name}`) });

/** Every element's drawn colours: none is --danger's (§12: nothing on a dashboard, or the review, is red). */
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
  expect(hits, `nothing on ${page.url()} resolves to --danger`).toEqual([]);
}

test("/parked lists the oldest parked first, each with its age; a book parked mid-read offers Pick it back up, which puts it back in In flight with its start (AC-2)", ONCE, async ({ page }) => {
  await page.goto("/parked");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Parked");
  await expect(rows(page).locator(".row-title")).toHaveText([OLD.title, MID.title, NEW.title]);
  await expect(rows(page).locator(".row-dates")).toHaveText([OLD.age, MID.age, NEW.age]);
  // Plan… on a book parked from To read; Pick it back up in its place on the one parked mid-read.
  await expect(row(page, OLD.title).getByRole("button", { name: `Plan ${OLD.title}`, exact: true })).toHaveCount(1);
  await expect(row(page, MID.title).getByRole("button", { name: `Plan ${MID.title}`, exact: true })).toHaveCount(0);
  const pick = row(page, MID.title).getByRole("button", { name: `Pick it back up: ${MID.title}`, exact: true });
  await hydrated(pick);
  await pick.click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`${MID.title}: reading`);
  await expect(row(page, MID.title)).toHaveCount(0);
  // The next row's first verb has focus: it never falls to the body.
  await expect(row(page, NEW.title).getByRole("button").first()).toBeFocused();
  expect(await stored(MID.id)).toMatchObject({ status: "reading", parkedOn: null, started: MID.started });

  await page.goto("/books/status");
  await expect(page.locator("main").getByText(MID.title, { exact: true })).toBeVisible();
});

test("Plan… opens 2.3's picker; a quarter puts the book at its end and off the review; Undo puts it back to Parked with no plan row (AC-1, AC-3)", ONCE, async ({ page }) => {
  await page.goto("/parked");
  const plan = row(page, OLD.title).getByRole("button", { name: `Plan ${OLD.title}`, exact: true });
  await hydrated(plan);
  await plan.click();
  const sheet = page.getByRole("dialog", { name: OLD.title });
  await expect(sheet.getByRole("group", { name: "Add to" })).toBeVisible();
  // 2.3's picker: the next five years, then On deck and Someday.
  await expect(sheet.getByRole("group", { name: "Add to" }).getByRole("button")).toHaveCount(7);
  await chip(sheet, YEAR).click();
  await chip(sheet.getByRole("group", { name: `Quarter of ${YEAR}` }), "Q4").click();
  await sheet.getByRole("button", { name: `Add to Q4 ${YEAR}`, exact: true }).click();
  await expect(sheet).toHaveCount(0);
  await expect(toast(page).locator(".toast-label")).toHaveText(`Added to Q4 ${YEAR}`);
  await expect(row(page, OLD.title)).toHaveCount(0);
  const placed = await stored(OLD.id);
  expect(placed.status).toBe("to_read");
  expect(placed.plan).toEqual([`${QUARTER}:${await lastOrdinal(QUARTER)}`]);
  expect((await stored(FILLER.id)).plan).toEqual([`${QUARTER}:1`]);
  expect(placed.plan[0]).not.toBe(`${QUARTER}:1`);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, OLD.title)).toHaveCount(1);
  await expect(rows(page).locator(".row-title")).toHaveText([OLD.title, MID.title, NEW.title]);
  expect(await stored(OLD.id)).toMatchObject({ status: "parked", parkedOn: OLD.parkedOn, plan: [] });
});

test("Unlisted writes unlisted and its Undo puts back parked; Keep parked folds the row and writes nothing (AC-1)", ONCE, async ({ page }) => {
  await page.goto("/parked");
  const unlist = row(page, NEW.title).getByRole("button", { name: `Unlisted: ${NEW.title}`, exact: true });
  await hydrated(unlist);
  await unlist.click();
  await expect(toast(page).locator(".toast-label")).toHaveText(`${NEW.title}: unlisted`);
  await expect(toast(page)).toContainText("Was parked");
  await expect(row(page, NEW.title)).toHaveCount(0);
  expect((await stored(NEW.id)).status).toBe("unlisted");
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, NEW.title)).toHaveCount(1);
  expect(await stored(NEW.id)).toMatchObject({ status: "parked", parkedOn: NEW.parkedOn });

  const keep = row(page, OLD.title).getByRole("button", { name: `Keep parked: ${OLD.title}`, exact: true });
  await hydrated(keep);
  await keep.click();
  const kept = page.locator(".parked-kept", { hasText: OLD.title });
  await expect(kept).toContainText("Kept parked");
  await expect(kept.getByRole("button")).toHaveCount(0);
  expect(await stored(OLD.id)).toMatchObject({ status: "parked", parkedOn: OLD.parkedOn, plan: [] });
  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(row(page, OLD.title).getByRole("button", { name: `Keep parked: ${OLD.title}`, exact: true })).toBeVisible();
});

test("due: the dashboard's Review N parked → and the Inbox's first row, Parked review; Done reviewing takes both away; not due shows neither (AC-1, AC-4)", ONCE, async ({ page }) => {
  // Not due: reviewed 10 days ago on a monthly cadence.
  await review("monthly", daysAgo(10));
  await page.goto("/books");
  await expect(page.locator('[data-slot="rollup"]')).toBeVisible();
  await expect(page.locator('a[href="/parked"]')).toHaveCount(0);
  await page.goto("/inbox");
  await expect(page.getByText("Parked review")).toHaveCount(0);

  // Due: 40 days ago.
  await review("monthly", daysAgo(40));
  const n = await parkedCount();
  await page.goto("/books");
  await expect(line(page)).toHaveText(`Review ${n} parked →`);
  await expect(line(page)).toHaveAttribute("href", "/parked");
  const slots = await page.locator("[data-slot]").evaluateAll((els) => els.map((el) => el.getAttribute("data-slot")));
  expect(slots).toEqual(["now", "next", "position", "situation", "rollup"]);
  await expectNoDanger(page);

  await page.goto("/inbox");
  const first = page.getByRole("list", { name: "Unresolved notes" }).getByRole("listitem").first();
  await expect(first.locator(".rt")).toHaveText("Parked review");
  await expect(first).toContainText(`${n} parked`);
  await first.getByRole("link", { name: "Review parked books" }).click();
  await expect(page).toHaveURL(/\/parked$/);

  const done = page.getByRole("button", { name: "Done reviewing", exact: true });
  await hydrated(done);
  await done.click();
  await expect(toast(page).locator(".toast-label")).toHaveText("Review done");
  await expect(page.locator(".parked-last")).toHaveText(/^Last reviewed /);
  expect(await reviewedOn()).toBe(DAY);

  await page.goto("/books");
  await expect(page.locator('[data-slot="rollup"]')).toBeVisible();
  await expect(page.locator('a[href="/parked"]')).toHaveCount(0);
  await page.goto("/inbox");
  await expect(page.getByText("Parked review")).toHaveCount(0);
});

test("the Library's Parked filter carries a grey Review parked → to /parked", ONCE, async ({ page }) => {
  await page.goto("/books/list?status=parked");
  const link = page.locator(".list-parked-line a");
  await expect(link).toHaveText("Review parked →");
  await expect(link).toHaveAttribute("href", "/parked");
  const colour = await link.evaluate((el) => getComputedStyle(el).color);
  expect(colour).toBe(await tokenColour(page, "--muted"));
});

test("the review meets the floor at every width, light and dark: real named buttons ≥ 24px (44px on a phone row), axe and contrast clean, nothing --danger; with nothing parked, the calm empty state (AC-6)", ONCE, async ({ page }, info) => {
  await review("monthly", daysAgo(40));
  for (const [width, height] of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/parked");
    await expect(rows(page)).toHaveCount(3);
    for (const b of PARKED) {
      const verbs = await row(page, b.title).locator(".parked-verbs button").all();
      expect(verbs, b.title).toHaveLength(3);
      for (const verb of verbs) {
        const name = `${await verb.getAttribute("aria-label")} at ${width}px`;
        expect(await verb.evaluate((el) => el.tagName), name).toBe("BUTTON");
        expect(name).toContain(b.title);
        await expect(verb, name).toBeVisible();
        expect((await verb.boundingBox())!.height, name).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
      }
    }
    await expectNoHorizontalScroll(page);
    await expectNoDanger(page);
    if (width === 360 || width === 1280) {
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `${width}px`).toEqual([]);
    }
    // `screenshot` writes the dark theme beside the light one.
    await screenshot(page, info, `parked-review-${width}`);
  }

  // The dashboard's line meets the floor too: a real link, ≥ 24px, axe and contrast in both themes.
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto("/books");
    await expect(line(page)).toBeVisible();
    expect((await line(page).boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await expectNoAxeViolations(page, AXE, '[data-slot="rollup"]');
    expect(await contrastFailures(page), `/books ${width}px`).toEqual([]);
    await expectNoDanger(page);
    await screenshot(page, info, `parked-line-books-${width}`);
  }

  // Nothing parked: a calm slate with one action, and no Done reviewing.
  await db((sql) => sql`UPDATE book_status SET status = 'to_read', parked_on = NULL WHERE user_id = ${E2E_USER} AND book_id LIKE ${P + "%"}`);
  expect(await parkedCount(), "only this suite's books are parked").toBe(0);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/parked");
  const slate = page.locator(".slate");
  await expect(slate.locator("b")).toHaveText("Nothing parked.");
  await expect(slate.getByRole("link")).toHaveText("Open the Library");
  await expect(slate.getByRole("link")).toHaveAttribute("href", "/books/list");
  await expect(page.getByRole("button", { name: "Done reviewing" })).toHaveCount(0);
  await expectNoAxeViolations(page, AXE);
  await expectNoDanger(page);
  await screenshot(page, info, "parked-review-empty-360");
});

/** Puts `markup` where the page's <main> is: a state the shared database can't produce on demand. */
async function swapMain(page: Page, markup: string) {
  // After hydration: a swap before it is a mismatch, and React draws its own tree over it.
  await hydrated(page.locator(".parked-verbs button").first());
  await page.evaluate((m) => { document.querySelector("main")!.outerHTML = m; }, markup);
}

test("the error state: a neutral line and a real Try again, never red; the floor (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/parked");
    await swapMain(page, renderToStaticMarkup(ParkedError({ error: new Error("boom"), reset: () => {} })));
    await expect(page.locator("main").getByRole("alert")).toHaveText("× Couldn't load what you've parked. Nothing was changed.");
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await expect(retry).toBeVisible();
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page), `${width}px`).toEqual([]);
    await expectNoDanger(page);
    await screenshot(page, info, `parked-review-error-${width}`);
  }
});

test("the loading skeleton's row is the loaded row's size, within 2px, on a phone and the desktop (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto("/parked");
    await expect(row(page, OLD.title)).toBeVisible();
    const loaded = (await row(page, OLD.title).boundingBox())!;
    await swapMain(page, renderToStaticMarkup(createElement(ParkedLoading)));
    await expect(page.locator(".parked-sk-row").first()).toBeVisible();
    const sk = (await page.locator(".parked-sk-row").first().boundingBox())!;
    expect(Math.abs(sk.height - loaded.height), `${width}px: skeleton ${sk.height}px, loaded ${loaded.height}px`).toBeLessThanOrEqual(2);
    await screenshot(page, info, `parked-review-loading-${width}`);
  }
});

// --- Task 5.9b, 2 of 3 (TASK-141; F-38, D-134): the review's rows and the Plan… picker's header link their names ---

const placeLine = (page: Page, title: string) => row(page, title).locator(".row-sub").first();
// Visible first: a streamed page holds its content in a hidden node until it swaps in, and a role query skips it.
const hrefsOf = async (l: Locator) => {
  await expect(l).toBeVisible();
  return l.getByRole("link").evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
};

test("5.9b AC-1, AC-2, AC-4: a row links its author, universe and series; a book with no series or universe draws only its author link; every width, light and dark", ONCE, async ({ page }, info) => {
  // Pinned to one project (it sets its own viewport and theme), so each theme is emulated here and its frames named for it.
  for (const [width, height, colorScheme] of VIEWPORTS.flatMap(([w, h]) => (["light", "dark"] as const).map((c) => [w, h, c] as const))) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme });
    await page.goto("/parked");
    await expect(rows(page)).toHaveCount(3);
    await expect(placeLine(page, NEW.title)).toHaveText("Pr Author · Pr World · Pr Cycle #5");
    expect(await hrefsOf(placeLine(page, NEW.title))).toEqual([
      ["Pr Author", `/books/authors/${PL.au}`], ["Pr World", `/books/universes/${PL.un}`], ["Pr Cycle", `/books/series/${PL.se}`],
    ]);
    await expect(placeLine(page, NEW.title).getByRole("link", { name: "Pr Cycle", exact: true })).toBeVisible();
    expect(await hrefsOf(placeLine(page, MID.title))).toEqual([["Pr Author", `/books/authors/${PL.au}`]]);
    for (const link of await placeLine(page, NEW.title).getByRole("link").all()) {
      expect((await link.boundingBox())!.height, `a place link at ${width}px ${colorScheme}`).toBeGreaterThanOrEqual(24);
    }
    await expectNoHorizontalScroll(page);
    await expectNoDanger(page);
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
    if (width === 360 || width === 1280) await screenshot(page, info, `5.9b-parked-links-${width}-${colorScheme}`);
  }
});

test("5.9b AC-3: a place link opens its page and fires none of the row's verbs", ONCE, async ({ page }) => {
  await page.goto("/parked");
  const plan = row(page, NEW.title).getByRole("button", { name: `Plan ${NEW.title}`, exact: true });
  await hydrated(plan);
  await placeLine(page, NEW.title).getByRole("link", { name: "Pr Cycle", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/series/${PL.se}$`));
  expect(await stored(NEW.id)).toMatchObject({ status: "parked", parkedOn: NEW.parkedOn, plan: [] });
  await page.goBack();
  await expect(row(page, NEW.title)).toHaveCount(1);
  await expect(row(page, NEW.title).locator(".parked-kept")).toHaveCount(0);
  await expect(toast(page)).toHaveCount(0);
});

test("5.9b AC-1, AC-3: Plan…'s picker header links the names too, each 24px, and a link opens its page without planning", ONCE, async ({ page }) => {
  await page.goto("/parked");
  const plan = row(page, NEW.title).getByRole("button", { name: `Plan ${NEW.title}`, exact: true });
  await hydrated(plan);
  await plan.click();
  const sheet = page.getByRole("dialog", { name: NEW.title });
  const by = sheet.locator(".pp-by");
  await expect(by).toContainText("Pr Author · Pr World · Pr Cycle #5");
  expect(await hrefsOf(by)).toEqual([
    ["Pr Author", `/books/authors/${PL.au}`], ["Pr World", `/books/universes/${PL.un}`], ["Pr Cycle", `/books/series/${PL.se}`],
  ]);
  for (const link of await by.getByRole("link").all()) {
    expect((await link.boundingBox())!.height, "a place link in a sheet").toBeGreaterThanOrEqual(24);
  }
  // The open sheet meets the floor in both themes: axe and contrast (AC-4).
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expectNoAxeViolations(page, AXE);
    expect(await contrastFailures(page), `the picker header, ${colorScheme}`).toEqual([]);
  }
  await by.getByRole("link", { name: "Pr Cycle", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/books/series/${PL.se}$`));
  expect(await stored(NEW.id)).toMatchObject({ status: "parked", plan: [] });
});
