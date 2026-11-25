// @area: shared
// Task 6.24 (TASK-144; MR-D18, MR-Q18, STYLE_GUIDE §9 and §17.9; Check clause *the
// batch and finish sheets' stepper buttons resolve to --sunk*): every stepper
// sits on --sunk, not just Settings'. Read as the browser drew it: the track
// (`.stepper`, the group) is --sunk, the − and + buttons stay --surface, and the
// number is transparent over the track. Each sheet is compared with Settings'
// stepper in the same theme, which is the reference, and with --sunk itself.
// The batch sheet is the seeded run's (nothing is marked); the finish sheet is a
// read book made here under its own id prefix and removed after.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour,
} from "./helpers";

// Sets its own viewport and theme: once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "duplicate-id-aria", "target-size",
];
// `ui.viewports` in .claude/kit.json.
const WIDTHS = [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]] as const;
const SCHEMES = ["light", "dark"] as const;

const BOOK = { id: "e2e-stp-read", title: "E2E Stepper Finished" };

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}
const clean = () => db((sql) => sql`DELETE FROM books WHERE id = ${BOOK.id}`);

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  await clean();
  await db(async (sql) => {
    await sql`INSERT INTO books (id, title) VALUES (${BOOK.id}, ${BOOK.title})`;
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${E2E_USER}, ${BOOK.id}, 'read', '2026-03-17', 'exact')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
              VALUES (${E2E_USER}, ${BOOK.id}, '2026-03-17', 'exact', '2026-03-01', 'exact')`;
  });
});
test.afterAll(clean);

type Surface = { track: string; buttons: string[]; val: string };

/** The three surfaces of one stepper as drawn: its track, each button, and the number. */
async function surface(stepper: Locator): Promise<Surface> {
  await stepper.waitFor();
  const bg = async (l: Locator) => (await computedStyle(l, ["background-color"]))["background-color"];
  const buttons = stepper.locator("button:not(.val)");
  return {
    track: await bg(stepper),
    buttons: await Promise.all((await buttons.all()).map(bg)),
    val: await bg(stepper.locator(".val")),
  };
}

async function settingsStepper(page: Page) {
  await page.goto("/settings");
  const stepper = page.locator(".stepper").first();
  await hydrated(stepper.locator("button").first());
  return stepper;
}

async function openBatch(page: Page) {
  await page.goto("/comics");
  const plus = page.getByRole("button", { name: "+ batch" });
  await hydrated(plus);
  await plus.click();
  const sheet = page.getByRole("dialog", { name: "Batch" });
  await expect(sheet).toBeVisible();
  return sheet.getByRole("group", { name: "How many issues" });
}

/** The books list, the book's date line open on *Finished*, with *Year only* chosen: the year stepper. */
async function openFinish(page: Page) {
  await page.goto(`/books/list?q=${encodeURIComponent(BOOK.title)}`);
  const row = page.locator(".book-row", { has: page.locator(".row-title", { hasText: BOOK.title }) });
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  await row.getByRole("button", { name: "Finished 17 March 2026" }).click();
  await row.getByRole("group", { name: "Finished" }).getByRole("radio", { name: "Year only" }).check();
  return row.getByRole("group", { name: "Year finished" });
}

test("the batch and finish sheets' steppers sit on --sunk like Settings', in both themes at 360px (AC-1, AC-3)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    const ref = await surface(await settingsStepper(page));
    const sunk = await tokenColour(page, "--sunk");
    // Settings is the reference: its track is --sunk, its buttons the raised --surface, its number clear.
    expect(ref.track, `${colorScheme} Settings track`).toBe(sunk);
    expect(ref.val, `${colorScheme} Settings number`).toBe("rgba(0, 0, 0, 0)");
    expect(ref.buttons.length).toBeGreaterThanOrEqual(2);

    for (const [name, open] of [["batch sheet", openBatch], ["finish sheet", openFinish]] as const) {
      const stepper = await open(page);
      const got = await surface(stepper);
      expect(got.track, `${colorScheme} ${name} track is --sunk`).toBe(sunk);
      expect(got.track, `${colorScheme} ${name} track is Settings'`).toBe(ref.track);
      expect(got.buttons, `${colorScheme} ${name} − and + are Settings'`).toEqual(ref.buttons.slice(0, got.buttons.length));
      expect(got.val, `${colorScheme} ${name} number is clear over the track`).toBe(ref.val);
      // Text on it keeps 4.5:1 (the buttons' and the number's colour against what is behind them).
      expect(await contrastFailures(page), `${colorScheme} ${name} contrast`).toEqual([]);
    }
  }
});

test("the two sheets at each width, light and dark: axe, no sideways scroll, screenshots (AC-4)", ONCE, async ({ page }, info) => {
  for (const [width, height] of WIDTHS) {
    for (const colorScheme of SCHEMES) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      for (const [name, open] of [["batch", openBatch], ["finish", openFinish]] as const) {
        const stepper = await open(page);
        await expect(stepper).toBeVisible();
        await expectNoHorizontalScroll(page);
        await expectNoAxeViolations(page, AXE);
        expect(await contrastFailures(page), `${name} ${width}px ${colorScheme}`).toEqual([]);
        await screenshot(page, info, `stepper-${name}-${width}-${colorScheme}`);
      }
    }
  }
});
