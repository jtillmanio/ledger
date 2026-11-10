// Task 1.9: the status screens in a real browser, comics and books. The tab in
// the URL and the arrow keys, one underline, counts that are the rows, the
// resume button named for its target, a quarter's keyboard reorder that never
// leaves the quarter, the bare-year lane that is grey with no button, the
// level filter behind *Someday*, Stopped, the dashboard's links and the six
// empty slates. Runs at every width, light and dark; the checks that write or
// set their own state run once. This file seeds its own runs and books and
// removes them; the empty slates are checked first, on the seed alone.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import BooksLoading from "../../src/app/books/status/loading";
import ComicsLoading from "../../src/app/comics/status/loading";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { computedStyle, contrastFailures, E2E_BOOK_COUNT, E2E_RUN_ID, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, toastSettled, tokenColour } from "./helpers";

// Writes or sets its own state: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-required-children", "aria-required-parent", "aria-valid-attr-value", "aria-hidden-focus",
  "list", "listitem", "landmark-unique", "duplicate-id-aria", "target-size", "heading-order",
];

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

async function floor(page: Page) {
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page, AXE);
  expect(await contrastFailures(page)).toEqual([]);
}

const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const panel = (page: Page) => page.getByRole("tabpanel");

/** The number printed on a tab. */
async function counted(page: Page, name: string) {
  return Number(await tab(page, name).locator(".n").textContent());
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("tablist", { name: "Status" })).toBeVisible();
}

test.describe("the empty slates (AC-4)", () => {
  test("comics: all three, each with one primary action", async ({ page }, info) => {
    // Every live run goes out of sight for this test and comes back after it.
    const live = await db(async (sql) => (await sql`SELECT id FROM runs WHERE deleted_at IS NULL`).map((r) => r.id as string));
    await db((sql) => sql`UPDATE runs SET deleted_at = now() WHERE id = ANY(${live})`);
    try {
      await open(page, "/comics/status");
      await expect(page.getByRole("heading", { level: 1, name: "Runs by status" })).toBeVisible();
      for (const [name, title, action] of [
        ["In flight", "Nothing in flight.", "Browse all runs"],
        ["Up next", "Nothing queued.", "Browse all runs"],
        ["Done", "Nothing finished yet.", "Go to In flight"],
      ] as const) {
        await tab(page, name).click();
        await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
        await expect(tab(page, name).locator(".n")).toHaveText("0");
        await expect(panel(page).locator(".slate b")).toHaveText(title);
        await expect(panel(page).locator(".slate .btn")).toHaveCount(1);
        await expect(panel(page).locator(".slate .btn")).toHaveText(action);
        await floor(page);
        await screenshot(page, info, `comics-empty-${name.replace(" ", "-").toLowerCase()}`);
      }
    } finally {
      await db((sql) => sql`UPDATE runs SET deleted_at = NULL WHERE id = ANY(${live})`);
    }
  });

  test("books: all three, with the design §14 copy; Add a book opens the sheet", async ({ page }, info) => {
    await open(page, "/books/status");
    await expect(page.getByRole("heading", { level: 1, name: "Books by status" })).toBeVisible();
    for (const [name, title, body, action] of [
      ["In flight", "Nothing in flight.", "Books you start land here.", "Open To read"],
      ["Up next", "Nothing planned.", "The plan starts empty; nothing is added for you.", "Add a book"],
      ["Done", "Nothing finished yet.", "Finished books land here, by year.", "Go to In flight"],
    ] as const) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
      await expect(tab(page, name).locator(".n")).toHaveText("0");
      await expect(panel(page).locator(".slate")).toHaveText(`${title}${body}${action}`);
      await expect(panel(page).locator(".slate .btn")).toHaveCount(1);
      await expect(panel(page).locator(".slate .btn")).toHaveText(action);
      await floor(page);
      await screenshot(page, info, `books-empty-${name.replace(" ", "-").toLowerCase()}`);
    }
    await tab(page, "Up next").click();
    const add = panel(page).getByRole("button", { name: "Add a book" });
    await hydrated(add);
    await add.click();
    await expect(page.getByRole("dialog", { name: "Add books" })).toBeVisible();
  });
});

test.describe("the tabs (AC-2)", () => {
  test("the tab is in the URL and survives a reload; an unknown tab opens In flight", async ({ page }) => {
    await open(page, "/comics/status?tab=done");
    await expect(tab(page, "Done")).toHaveAttribute("aria-selected", "true");
    await page.reload();
    await expect(tab(page, "Done")).toHaveAttribute("aria-selected", "true");
    await open(page, "/books/status?tab=nonsense");
    await expect(tab(page, "In flight")).toHaveAttribute("aria-selected", "true");
    // Links in a tablist, in this order and under these names, one underline.
    await expect(page.getByRole("tablist", { name: "Status" }).getByRole("tab")).toHaveText([/^In flight/, /^Up next/, /^Done/]);
    await expect(page.locator(".tabs a[role=tab]")).toHaveCount(3);
    await expect(page.locator(".tabs .tab-ink")).toHaveCount(1);
  });

  test("the arrow keys, Home and End move along the strip and open the tab", async ({ page }) => {
    await open(page, "/comics/status");
    const strip = (name: string) => tab(page, name);
    await hydrated(strip("In flight"));
    await strip("In flight").focus();
    await page.keyboard.press("ArrowRight");
    await expect(strip("Up next")).toBeFocused();
    await expect(page).toHaveURL(/\?tab=next$/);
    await page.keyboard.press("End");
    await expect(strip("Done")).toBeFocused();
    await expect(page).toHaveURL(/\?tab=done$/);
    await page.keyboard.press("ArrowRight");
    await expect(strip("In flight")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(strip("Done")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(strip("In flight")).toBeFocused();
    await expect(strip("In flight")).toHaveAttribute("aria-selected", "true");
  });

  test("44px tabs; the underline sits under the selected tab", async ({ page }) => {
    await open(page, "/comics/status?tab=next");
    for (const name of ["In flight", "Up next", "Done"]) {
      expect((await tab(page, name).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await expect.poll(async () => {
      const ink = (await page.locator(".tab-ink").boundingBox())!;
      const sel = (await tab(page, "Up next").boundingBox())!;
      return [Math.round(ink.x - sel.x) + 0, Math.round(ink.width - sel.width) + 0, ink.height];
    }).toEqual([0, 0, 2]);
    // A tab's count is its tab's colour, never an opacity.
    const colour = (n: string) => computedStyle(tab(page, n).locator(".n"), ["color", "opacity"]);
    const own = (n: string) => computedStyle(tab(page, n), ["color"]);
    for (const n of ["In flight", "Up next"]) {
      expect((await colour(n)).opacity).toBe("1");
      expect((await colour(n)).color).toBe((await own(n)).color);
    }
  });
});

// Sets its own viewport and the motion preference: runs once, in w390-light.
test("the loading skeletons hold the tab strip's size; the underline's slide is off under reduced motion (AC-6)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const strip = async () => (await page.locator(".tabs, .sk-tabs").first().boundingBox())!;
  for (const [path, loading] of [["/comics/status", ComicsLoading], ["/books/status", BooksLoading]] as const) {
    await open(page, path);
    const loaded = await strip();
    await page.evaluate((h) => { document.querySelector("main")!.outerHTML = h; }, renderToStaticMarkup(createElement(loading)));
    const skeleton = await strip();
    expect(Math.abs(skeleton.height - loaded.height), `${path} height`).toBeLessThanOrEqual(2);
    expect(Math.abs(skeleton.width - loaded.width), `${path} width`).toBeLessThanOrEqual(2);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "/comics/status");
  await expect(page.locator(".tab-ink")).toHaveCSS("transition-duration", "0s");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".tab-ink")).toHaveCSS("transition-duration", "0.15s");
});

test.describe("comics", () => {
  const ids = { mid: "e2e-st-mid", done: "e2e-st-done", q1: "e2e-st-q1", q2: "e2e-st-q2", held: "e2e-st-held", pre: "e2e-st-pre" };
  const all = Object.values(ids);

  test.beforeAll(async () => {
    await db(async (sql) => {
      for (const [key, id] of Object.entries(ids)) {
        await sql`INSERT INTO runs (id, title) VALUES (${id}, ${`E2E St ${key}`}) ON CONFLICT DO NOTHING`;
        const n = key === "mid" ? 10 : key === "done" ? 2 : 1;
        for (let i = 1; i <= n; i++) {
          await sql`INSERT INTO issues (id, label) VALUES (${`${id}-${i}`}, ${`E2E St ${key} (2002) #${i}`}) ON CONFLICT DO NOTHING`;
          await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${id}, ${i}, ${`${id}-${i}`}) ON CONFLICT (run_id, issue_id) DO NOTHING`;
        }
      }
      await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES (${ids.held}, ${ids.pre}, 'hard') ON CONFLICT DO NOTHING`;
      await sql`INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
                SELECT ${E2E_USER}, id, now() - interval '3 days', 'exact' FROM run_issues
                WHERE (run_id = ${ids.mid} AND sequence <= 3) OR run_id = ${ids.done}`;
      // The started run is queued too: it must stay out of Up next.
      for (const [i, id] of [ids.q2, ids.mid, ids.held, ids.q1].entries()) {
        await sql`INSERT INTO run_queue (user_id, run_id, ordinal) VALUES (${E2E_USER}, ${id}, ${i + 1})`;
      }
    });
  });

  test.afterAll(async () => {
    await db((sql) => sql`DELETE FROM runs WHERE id = ANY(${all})`);
    await db((sql) => sql`DELETE FROM issues WHERE id LIKE 'e2e-st-%'`);
  });

  test("In flight: started runs with a meter and a button named for the target, in full", async ({ page }, info) => {
    await open(page, "/comics/status");
    await expect(panel(page).locator("article.row .row-title")).toContainText(["E2E Run", "E2E St mid"]);
    const read = panel(page).getByRole("link", { name: "Read E2E St mid (2002) #4" });
    await expect(read).toHaveAttribute("href", `/comics/${ids.mid}#p-4`);
    await expect(read).toHaveAttribute("title", "E2E St mid (2002) #4");
    await expect(panel(page).getByRole("link", { name: "Read E2E Comic (2000) #4" }))
      .toHaveAttribute("href", `/comics/${E2E_RUN_ID}#p-4`);
    // The started run is queued and still not in Up next; its queue row is intact.
    await expect(panel(page).locator(".meter i").first()).toBeVisible();
    await expect(panel(page).getByText("E2E St mid", { exact: true })).toHaveCount(1);
    await floor(page);
    await screenshot(page, info, "comics-in-flight");
  });

  test("Up next: the queue in order without the started run, then Ready, not queued; counts are the rows", async ({ page }, info) => {
    await open(page, "/comics/status?tab=next");
    await expect(panel(page).locator("li.qrow .qtitle")).toHaveText(["E2E St q2", "E2E St held", "E2E St q1"]);
    // The blocked, queued run keeps its amber badge; the unqueued blocked run would be in neither list.
    await expect(panel(page).locator("li.qrow").filter({ hasText: "E2E St held" }).locator(".bdg.bl")).toContainText("1 run first");
    const ready = panel(page).locator("#ready article.row .row-title");
    await expect(ready).toContainText(["E2E Long Run", "E2E St pre"]);
    await expect(ready.filter({ hasText: "E2E St mid" })).toHaveCount(0);
    expect(await counted(page, "Up next")).toBe(3 + (await ready.count()));
    expect(await counted(page, "Up next")).toBe(await panel(page).locator("li.qrow, #ready article.row").count());
    await floor(page);
    await screenshot(page, info, "comics-up-next");
  });

  test("Done: a run with every placement read, newest first", async ({ page }, info) => {
    await open(page, "/comics/status?tab=done");
    await expect(panel(page).locator("article.row .row-title")).toHaveText(["E2E St done"]);
    // When it was read: its span since task 1.17 (*Read Mar–Sep 2026*, one month alone *Read Nov 2026*).
    await expect(panel(page).locator("article.row .row-sub")).toContainText(/^Read (~?[A-Z][a-z]{2}–)?~?[A-Z][a-z]{2} \d{4}/);
    expect(await counted(page, "Done")).toBe(await panel(page).locator("article.row").count());
    await floor(page);
    await screenshot(page, info, "comics-done");
  });

  test("every tab's count is its row count", async ({ page }) => {
    await open(page, "/comics/status");
    expect(await counted(page, "In flight")).toBe(await panel(page).locator("article.row").count());
  });

  test("the dashboard links to the matching tab, with N computed (AC-5)", async ({ page }) => {
    await page.goto("/comics");
    await expect(page.getByRole("heading", { level: 2, name: "Up next" })).toBeVisible();
    const flying = page.getByRole("link", { name: /^All \d+$/ }).first();
    await expect(flying).toHaveAttribute("href", "/comics/status?tab=inflight");
    const ready = page.locator("#ready-head").locator("xpath=..").getByRole("link", { name: /^All \d+$/ });
    await expect(ready).toHaveAttribute("href", "/comics/status?tab=next#ready");
    const n = Number((await ready.textContent())!.replace("All ", ""));
    await expect(page.getByRole("heading", { level: 2, name: "Up next" }).getByRole("link"))
      .toHaveAttribute("href", "/comics/status?tab=next");
    // N is what the tab it opens counts under Ready, not queued.
    await page.goto("/comics/status?tab=next");
    expect(Number(await page.locator("#ready-head .n").textContent())).toBe(n);
  });
});

test.describe("books", () => {
  const prefix = "e2e-st-b-";
  const books: [string, string, string, string | null, [string, number | null] | null][] = [
    // id, title, status, finished_on, [period, ordinal]
    ["read-new", "E2E Done New", "read", "2026-08-01", null],
    ["read-old", "E2E Done Old", "read", "2024-02-01", null],
    ["read-none", "E2E Done Undated", "read", null, null],
    ["quit", "E2E Stopped", "dnf", "2026-03-01", null],
    ["now", "E2E Reading Now", "reading", null, null],
    ["a", "E2E Plan A", "to_read", null, ["2027-Q1", 1]],
    ["b", "E2E Plan B", "to_read", null, ["2027-Q1", 2]],
    ["c", "E2E Plan C", "to_read", null, ["2027-Q1", 3]],
    ["q2", "E2E Plan Q2", "to_read", null, ["2027-Q2", 1]],
    ["year", "E2E Plan Year", "to_read", null, ["2027", null]],
    ["deck", "E2E Plan Deck", "to_read", null, ["on_deck", null]],
    ["s1", "E2E Someday One", "to_read", null, null],
    ["s2", "E2E Someday Two", "to_read", null, null],
  ];

  test.beforeAll(async () => {
    await db(async (sql) => {
      for (const [id, title, status, finished, plan] of books) {
        await sql`INSERT INTO books (id, title, genre) VALUES (${prefix + id}, ${title}, 'Fantasy')`;
        await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                  VALUES (${E2E_USER}, ${prefix + id}, ${status}, ${finished}, ${finished ? "exact" : "none"})`;
        if (plan) {
          await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${prefix + id}, ${plan[0]}, ${plan[1]})`;
        }
      }
    });
  });

  test.afterAll(async () => {
    await db((sql) => sql`DELETE FROM books WHERE id LIKE ${prefix + "%"}`);
  });

  const order = (period: string) => db(async (sql) =>
    (await sql`SELECT book_id, ordinal FROM reading_plan WHERE user_id = ${E2E_USER} AND period = ${period} ORDER BY ordinal`)
      .map((r) => `${(r.book_id as string).slice(prefix.length)}:${r.ordinal}`));

  test("In flight: what you are reading", async ({ page }, info) => {
    await open(page, "/books/status");
    await expect(panel(page).locator("article.row .row-title")).toHaveText(["E2E Reading Now"]);
    expect(await counted(page, "In flight")).toBe(1);
    await floor(page);
    await screenshot(page, info, "books-in-flight");
  });

  test("Up next: quarters in order, the 2027 lane after them with no handle, then On deck, then Someday", async ({ page }, info) => {
    await open(page, "/books/status?tab=next");
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText([
      /^2027 · Q1\s*3 books$/, /^2027 · Q2\s*1 book$/, /^2027 · no quarter yet\s*1 book$/, /^On deck\s*1 book$/,
    ]);
    await expect(page.locator('ol[aria-label="Q1 2027"] .qtitle')).toHaveText(["E2E Plan A", "E2E Plan B", "E2E Plan C"]);

    const lane = panel(page).locator('section[data-plan="year"]');
    await expect(lane.locator(".row-title")).toHaveText(["E2E Plan Year"]);
    // No handle, link or Place button until 2.8; the status control (1.17b) is the one button.
    await expect(lane.locator("a, .drag")).toHaveCount(0);
    await expect(lane.getByRole("button")).toHaveText(["Status: to read"]);
    // Nothing on the lane resolves to --blocked: its colour, as the browser computes it, is compared to a probe.
    const blocked = await page.evaluate(() => {
      const probe = document.body.appendChild(document.createElement("span"));
      probe.style.color = "var(--blocked)";
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    for (const el of [lane.getByRole("heading", { level: 2 }), lane.locator(".row-title"), lane]) {
      const { color, "background-color": bg, "border-top-color": border } = await computedStyle(el.first(), ["color", "background-color", "border-top-color"]);
      expect([color, bg, border]).not.toContain(blocked);
    }

    // The tab's count is its book rows; Someday is a row of its own, counted in words.
    expect(await counted(page, "Up next")).toBe(6);
    expect(await counted(page, "Up next")).toBe(await panel(page).locator("li.qrow, .plan-rows article.row").count());
    const someday = panel(page).getByRole("link", { name: /^Someday · 2 books/ });
    await expect(someday).toHaveAttribute("href", "/books/list?status=to_read&level=someday");
    await floor(page);
    await screenshot(page, info, "books-up-next");
  });

  test("the keyboard (Space, Down, Space) moves a book one place in its quarter and writes it", ONCE, async ({ page }) => {
    await open(page, "/books/status?tab=next");
    const handle = page.locator('ol[aria-label="Q1 2027"] .drag').first();
    await hydrated(handle);
    await expect(handle).toHaveAccessibleName("Reorder E2E Plan A, position 1 of 3 in Q1 2027");
    await handle.focus();
    await page.keyboard.press("Space");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect.poll(() => order("2027-Q1")).toEqual(["b:1", "a:2", "c:3"]);
    await expect(page.locator('ol[aria-label="Q1 2027"] .qtitle')).toHaveText(["E2E Plan B", "E2E Plan A", "E2E Plan C"]);
    // Put it back so the next test finds the seed as it was.
    await db((sql) => sql`UPDATE reading_plan SET ordinal = CASE book_id WHEN ${prefix + "a"} THEN 1 WHEN ${prefix + "b"} THEN 2 ELSE 3 END
                          WHERE user_id = ${E2E_USER} AND period = '2027-Q1'`);
  });

  test("a lift never carries a row into another quarter", ONCE, async ({ page }) => {
    await open(page, "/books/status?tab=next");
    const last = page.locator('ol[aria-label="Q1 2027"] .drag').last();
    await hydrated(last);
    await last.focus();
    await page.keyboard.press("Space");
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await expect(page.locator('ol[aria-label="Q1 2027"] .qtitle')).toHaveText(["E2E Plan A", "E2E Plan B", "E2E Plan C"]);
    await expect(page.locator('ol[aria-label="Q2 2027"] .qtitle')).toHaveText(["E2E Plan Q2"]);
    expect(await order("2027-Q1")).toEqual(["a:1", "b:2", "c:3"]);
    expect(await order("2027-Q2")).toEqual(["q2:1"]);
  });

  test("Someday opens the master list at that level; the chips filter by level (AC-3)", async ({ page }) => {
    await open(page, "/books/status?tab=next");
    await page.getByRole("link", { name: /^Someday · 2 books/ }).click();
    await expect(page).toHaveURL(/\/books\/list\?status=to_read&level=someday$/);
    const titles = page.locator("article.book-row .row-title");
    await expect(titles).toHaveText(["E2E Someday One", "E2E Someday Two"]);
    const chips = page.getByRole("group", { name: "To read level" });
    await expect(chips.getByRole("link")).toHaveText(["All", "Quarter", "Year", "On deck", "Someday"]);
    await expect(chips.getByRole("link", { name: "Someday" })).toHaveAttribute("aria-current", "true");

    for (const [name, level, expected] of [
      ["Quarter", "quarter", ["E2E Plan A", "E2E Plan B", "E2E Plan C", "E2E Plan Q2"]],
      ["Year", "year", ["E2E Plan Year"]],
      ["On deck", "on_deck", ["E2E Plan Deck"]],
    ] as const) {
      await chips.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`level=${level}$`));
      await expect(titles).toHaveText(expected);
    }
    await chips.getByRole("link", { name: "All" }).click();
    // Every to-read book: the eight seeded here, and the seed's own (no status row, so listed as to read).
    await expect(titles).toHaveCount(8 + E2E_BOOK_COUNT);
  });

  test("Done: by year, the undated last; DNF appears only under a collapsed Stopped", async ({ page }, info) => {
    await open(page, "/books/status?tab=done");
    await expect(panel(page).getByRole("heading", { level: 2 })).toHaveText([/^2026\s*1$/, /^2024\s*1$/, /^No year\s*1$/]);
    await expect(panel(page).locator("section .rows article.row .row-title")).toHaveText(["E2E Done New", "E2E Done Old", "E2E Done Undated"]);
    const stopped = panel(page).locator("details.stopped");
    await expect(stopped.locator("summary")).toHaveText(/^Stopped\s*1$/);
    expect(await stopped.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    await expect(panel(page).getByText("E2E Stopped")).toBeHidden();
    // Stopped is counted: 3 read + 1 stopped.
    expect(await counted(page, "Done")).toBe(4);
    await floor(page);
    await stopped.locator("summary").click();
    await expect(stopped.getByText("E2E Stopped")).toBeVisible();
    await floor(page);
    await screenshot(page, info, "books-done");
    // A stopped book is on no other tab.
    await open(page, "/books/status?tab=next");
    await expect(page.getByText("E2E Stopped")).toHaveCount(0);
  });
});

// Task 2.2f: Finished on an In flight row. Own books, own serial describe; the
// browser suite runs one file at a time, so nothing else sees them.
test.describe("Finished on In flight (2.2f)", () => {
  test.describe.configure({ mode: "serial" });
  const prefix = "e2e-fin-";
  const LONG = "E2E Fin A Very Long Title That Goes On And On Without Any Spaces Pneumonoultramicroscopicsilicovolcanoconiosis";
  const seed: [string, string, string][] = [
    // id, title, status
    ["a", "E2E Fin Alpha", "reading"],
    ["b", "E2E Fin Beta", "reading"],
    ["c", "E2E Fin Gamma Listening", "listening"],
    ["next", "E2E Fin Up Next", "to_read"],
    ["done", "E2E Fin Done", "read"],
    ["long", LONG, "reading"],
  ];
  const finish = (page: Page, title: string) => page.getByRole("button", { name: `Finished ${title}`, exact: true });
  const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

  const reads = (id: string) => db(async (sql) =>
    [...await sql`SELECT format, finished_on::text AS finished_on, finished_on_precision AS precision, started_on::text AS started_on
              FROM read_events WHERE user_id = ${E2E_USER} AND book_id = ${prefix + id} ORDER BY id`]
      .map((r) => ({ ...r })));
  const status = (id: string) => db(async (sql) => {
    const [row] = await sql`SELECT status, started_on::text AS started_on, finished_on::text AS finished_on FROM book_status
                            WHERE user_id = ${E2E_USER} AND book_id = ${prefix + id}`;
    return { ...row };
  });

  async function reseed() {
    await db(async (sql) => {
      await sql`DELETE FROM books WHERE id LIKE ${prefix + "%"}`;
      await sql`DELETE FROM authors WHERE id = ${prefix + "author"}`;
      // One author with an unread book, so the finish has something to offer (Keep going?).
      await sql`INSERT INTO authors (id, name) VALUES (${prefix + "author"}, 'E2E Fin Author')`;
      for (const [id, title, st] of seed) {
        const going = st === "reading" || st === "listening";
        await sql`INSERT INTO books (id, title, genre, author_id) VALUES (${prefix + id}, ${title}, 'Fantasy', ${prefix + "author"})`;
        await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision, finished_on, finished_on_precision)
                  VALUES (${E2E_USER}, ${prefix + id}, ${st}, ${going ? "2026-01-15" : null}, ${going ? "exact" : "none"},
                          ${st === "read" ? "2025-05-05" : null}, ${st === "read" ? "exact" : "none"})`;
      }
    });
  }

  test.beforeEach(reseed);
  test.afterAll(async () => {
    await db((sql) => sql`DELETE FROM books WHERE id LIKE ${prefix + "%"}`);
    await db((sql) => sql`DELETE FROM authors WHERE id = ${prefix + "author"}`);
  });

  test("AC-3: a button named Finished <title> on Reading and Listening rows only", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await expect(panel(page).getByRole("button", { name: /^Finished / })).toHaveCount(4);
    for (const title of ["E2E Fin Alpha", "E2E Fin Beta", "E2E Fin Gamma Listening"]) await expect(finish(page, title)).toBeVisible();
    // Nothing else on the row is a Finished button: its other button is the status control (1.17b).
    await expect(panel(page).locator("article.row").first().getByRole("button", { name: /^Finished / })).toHaveCount(1);
    await open(page, "/books/status?tab=next");
    await expect(page.getByRole("button", { name: /^Finished / })).toHaveCount(0);
    await open(page, "/books/status?tab=done");
    await expect(page.getByRole("button", { name: /^Finished / })).toHaveCount(0);
  });

  test("AC-1/AC-2: a Reading row finishes today, exact, start kept; Keep going? is offered; Undo restores it", ONCE, async ({ page }, info) => {
    await open(page, "/books/status");
    const button = finish(page, "E2E Fin Alpha");
    await hydrated(button);
    expect(await counted(page, "In flight")).toBe(4);
    await button.click();
    // No date control opens.
    await expect(page.getByRole("group", { name: /^Finished/ })).toHaveCount(0);
    const toast = page.locator(".toast");
    await expect(toast).toContainText("E2E Fin Alpha: read");
    const words = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "America/New_York" });
    await expect(toast).toContainText(`Finished ${words.format(new Date())}`);
    await expect(toast.getByRole("group", { name: "Keep going?" })).toBeVisible();
    await expect(finish(page, "E2E Fin Alpha")).toHaveCount(0);
    expect(await reads("a")).toEqual([{ format: "text", finished_on: today(), precision: "exact", started_on: "2026-01-15" }]);
    expect((await status("a")).status).toBe("read");
    await expect.poll(() => counted(page, "In flight")).toBe(3);
    await expect.poll(() => counted(page, "Done")).toBe(2);
    await toastSettled(page);
    await floor(page);
    // Nothing on the row or its button resolves to --danger.
    const danger = await tokenColour(page, "--danger");
    for (const el of [finish(page, "E2E Fin Beta"), panel(page).locator("article.row").first()]) {
      const { color, "background-color": bg, "border-top-color": border } = await computedStyle(el, ["color", "background-color", "border-top-color"]);
      expect([color, bg, border]).not.toContain(danger);
    }
    await screenshot(page, info, "books-in-flight-finished");

    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(finish(page, "E2E Fin Alpha")).toBeFocused();
    expect(await reads("a")).toEqual([]);
    expect(await status("a")).toEqual({ status: "reading", started_on: "2026-01-15", finished_on: null });
    await expect.poll(() => counted(page, "In flight")).toBe(4);
  });

  test("AC-1: a Listening row logs an audio read", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Gamma Listening"));
    await finish(page, "E2E Fin Gamma Listening").click();
    await expect(page.locator(".toast")).toContainText("E2E Fin Gamma Listening: read");
    expect((await reads("c")).map((r) => r.format)).toEqual(["audio"]);
  });

  test("AC-4: by keyboard focus goes to the next row, else the previous one; F6 reaches the toast", ONCE, async ({ page }) => {
    // Order on the page: Reading (LONG, Alpha, Beta), then Listening (Gamma).
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Alpha"));
    await finish(page, "E2E Fin Alpha").focus();
    await page.keyboard.press("Enter");
    await expect(finish(page, "E2E Fin Beta")).toBeFocused();
    // F6 into the toast, and F6 back out.
    await page.keyboard.press("F6");
    await expect(page.locator(".toast").getByRole("button").first()).toBeFocused();
    await page.keyboard.press("F6");
    await expect(finish(page, "E2E Fin Beta")).toBeFocused();
    // Beta is the last of Reading: the next Finished is Gamma's, in Listening.
    await page.keyboard.press("Enter");
    await expect(finish(page, "E2E Fin Gamma Listening")).toBeFocused();
    // Gamma is the last on the page: focus goes to the previous row's.
    await page.keyboard.press("Enter");
    await expect(finish(page, LONG)).toBeFocused();
  });

  test("AC-4: Undo puts focus on the restored row's Finished", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Alpha"));
    await finish(page, "E2E Fin Alpha").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".toast")).toContainText("E2E Fin Alpha: read");
    await page.keyboard.press("Control+z");
    await expect(finish(page, "E2E Fin Alpha")).toBeFocused();
  });

  test("AC-4: a refused write offers Retry, keeps the row, writes no read; Retry saves", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Alpha"));
    await page.route("**/api/progress/book", (route) => route.abort());
    await finish(page, "E2E Fin Alpha").click();
    await expect(page.locator(".toast")).toContainText("Couldn't finish E2E Fin Alpha. Nothing changed.");
    await expect(finish(page, "E2E Fin Alpha")).toBeVisible();
    expect(await reads("a")).toEqual([]);
    await page.unroute("**/api/progress/book");
    await page.locator(".toast").getByRole("button", { name: "Retry" }).click();
    await expect(page.locator(".toast")).toContainText("E2E Fin Alpha: read");
    expect(await reads("a")).toHaveLength(1);
  });

  test("AC-4: a 400 shows the server's reason with Retry, and writes nothing", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Alpha"));
    await page.route("**/api/progress/book", (route) => route.fulfill({ status: 400, json: { error: "it is not allowed" } }));
    await finish(page, "E2E Fin Alpha").click();
    await expect(page.locator(".toast")).toContainText("Not saved: it is not allowed.");
    await expect(page.locator(".toast").getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(finish(page, "E2E Fin Alpha")).toBeVisible();
    expect(await reads("a")).toEqual([]);
  });

  test("AC-5: the button is at least 24px tall; a long title stays inside the row at 360", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page, "/books/status");
    expect((await finish(page, "E2E Fin Alpha").boundingBox())!.height).toBeGreaterThanOrEqual(24);
    await expectNoHorizontalScroll(page);
    const row = panel(page).locator("article.row").filter({ hasText: "Pneumonoultra" });
    const r = (await row.boundingBox())!;
    const b = (await finish(page, LONG).boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(r.x + r.width + 1);
    await floor(page);
  });

  test("AC-5: finishing the last book shows Nothing in flight.", ONCE, async ({ page }) => {
    await db((sql) => sql`UPDATE book_status SET status = 'to_read' WHERE user_id = ${E2E_USER} AND book_id IN (${prefix + "b"}, ${prefix + "c"}, ${prefix + "long"})`);
    await open(page, "/books/status");
    await hydrated(finish(page, "E2E Fin Alpha"));
    await finish(page, "E2E Fin Alpha").focus();
    await page.keyboard.press("Enter");
    await expect(panel(page).locator(".slate b")).toHaveText("Nothing in flight.");
    await expect(tab(page, "In flight")).toBeFocused();
    await expect(tab(page, "In flight").locator(".n")).toHaveText("0");
  });
});

// Task 1.17b (D-131): the status control on the status screens. Own books under `e2e-ctl-`, reseeded before
// each test and removed after the last. The tests that only open the control run at every width, light and
// dark, for the floor and the feel-pass screenshots; the ones that write run once.
test.describe("the status control on the status screens (1.17b)", () => {
  test.describe.configure({ mode: "serial" });
  const prefix = "e2e-ctl-";
  const FLIGHT = "E2E Ctl Flight";
  const QUARTER = "E2E Ctl Quarter";
  const LANE = "E2E Ctl Lane";
  const DECK = "E2E Ctl Deck";
  const TWICE = "E2E Ctl Twice";
  const ONCE_READ = "E2E Ctl Once";
  const QUIT = "E2E Ctl Quit";
  const todayEastern = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const daysAgo = (n: number) => new Date(Date.parse(`${todayEastern()}T12:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10);

  async function reseed() {
    await db(async (sql) => {
      await sql`DELETE FROM books WHERE id LIKE ${prefix + "%"}`;
      const book = (id: string, title: string) => sql`INSERT INTO books (id, title, genre) VALUES (${prefix + id}, ${title}, 'Fantasy')`;
      await book("flight", FLIGHT);
      await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
                VALUES (${E2E_USER}, ${prefix + "flight"}, 'reading', '2026-10-01', 'exact')`;
      for (const [id, title, period, ordinal] of [
        ["quarter", QUARTER, "2027-Q1", 1], ["lane", LANE, "2027", null], ["deck", DECK, "on_deck", null],
      ] as const) {
        await book(id, title);
        await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${prefix + id}, 'to_read')`;
        await sql`INSERT INTO reading_plan (user_id, book_id, period, ordinal) VALUES (${E2E_USER}, ${prefix + id}, ${period}, ${ordinal})`;
      }
      // Read twice: a text read, then a listen, whose finish the status holds in step.
      await book("twice", TWICE);
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${prefix + "twice"}, 'read', '2025-03-19', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
                VALUES (${E2E_USER}, ${prefix + "twice"}, '2022-07-01', 'approximate', '2022-06-03', 'exact', 'text'),
                       (${E2E_USER}, ${prefix + "twice"}, '2025-03-19', 'exact', '2025-03-02', 'exact', 'audio')`;
      await book("once", ONCE_READ);
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${E2E_USER}, ${prefix + "once"}, 'read', '2024-05-05', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
                VALUES (${E2E_USER}, ${prefix + "once"}, '2024-05-05', 'exact', '2024-04-20', 'exact')`;
      await book("quit", QUIT);
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${E2E_USER}, ${prefix + "quit"}, 'dnf')`;
    });
  }
  test.beforeEach(reseed);
  test.afterAll(() => db((sql) => sql`DELETE FROM books WHERE id LIKE ${prefix + "%"}`));

  const row = (page: Page, title: string) => page.locator("article.row, li.qrow").filter({ hasText: title });
  const toggle = (page: Page, title: string) => row(page, title).locator(".status-toggle");
  const state = (id: string) => db(async (sql) => {
    const [r] = await sql`SELECT status, started_on::text AS started_on, started_on_precision AS sp, finished_on::text AS finished_on
                          FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${prefix + id}`;
    return { ...r };
  });
  const reads = (id: string) => db(async (sql) =>
    [...await sql`SELECT started_on::text AS started_on, finished_on::text AS finished_on, format
                  FROM read_events WHERE user_id = ${E2E_USER} AND book_id = ${prefix + id} ORDER BY id`].map((r) => ({ ...r })));
  /** Opens a row's control (its badge) once React has hold of it. */
  async function expand(page: Page, title: string) {
    const t = toggle(page, title);
    await hydrated(t);
    await t.click();
    await expect(row(page, title).getByRole("group", { name: `Status of ${title}` })).toBeVisible();
    return row(page, title);
  }
  /** Nothing inside `scope` resolves to --danger. */
  async function expectNoDanger(page: Page, scope: ReturnType<Page["locator"]>) {
    const danger = await tokenColour(page, "--danger");
    const hits = await scope.locator("*").evaluateAll((els, d) => els.filter((el) => {
      const cs = getComputedStyle(el);
      return [cs.color, cs.backgroundColor, cs.borderTopColor].includes(d);
    }).map((el) => `${el.tagName.toLowerCase()}.${el.className}`), danger);
    expect(hits, "nothing resolves to --danger").toEqual([]);
  }
  /** On a phone the pickers' options are 44px. */
  async function expectOptions44(page: Page, scope: ReturnType<Page["locator"]>) {
    if (page.viewportSize()!.width >= 768) return;
    for (const radio of await scope.getByRole("radio").all()) {
      expect((await radio.locator("xpath=..").boundingBox())!.height, "a picker option").toBeGreaterThanOrEqual(44);
    }
  }

  test("AC-5: every tab's rows carry the control, the quarter's too; the year lane gains no handle", ONCE, async ({ page }) => {
    await open(page, "/books/status");
    await expect(toggle(page, FLIGHT)).toHaveText("Status: reading");
    // Finished (2.2f) is still there beside it.
    await expect(page.getByRole("button", { name: `Finished ${FLIGHT}`, exact: true })).toBeVisible();

    await open(page, "/books/status?tab=next");
    await expect(page.locator(`ol[aria-label="Q1 2027"]`).locator(".status-toggle")).toHaveText("Status: to read");
    await expect(page.locator(`ol[aria-label="Q1 2027"] .drag`)).toHaveCount(1);
    const lane = panel(page).locator('section[data-plan="year"]');
    await expect(lane.locator(".status-toggle")).toHaveText("Status: to read");
    await expect(lane.locator("a, .drag")).toHaveCount(0);
    await expect(panel(page).locator('section[data-plan="on_deck"] .status-toggle')).toHaveText("Status: to read");

    await open(page, "/books/status?tab=done");
    await expect(toggle(page, TWICE)).toHaveText(/^Status: read /);
    await expect(toggle(page, ONCE_READ)).toHaveText(/^Status: read /);
    await panel(page).locator("details.stopped summary").click();
    await expect(toggle(page, QUIT)).toHaveText("Status: DNF");
  });

  test("AC-6: the control open on In flight, Up next and Done meets the floor; focus returns to what opened it", async ({ page }, info) => {
    // In flight: the date line's Started opens the picker.
    await open(page, "/books/status");
    const flight = await expand(page, FLIGHT);
    const started = flight.getByRole("button", { name: /^Started / });
    await started.click();
    const group = flight.getByRole("group", { name: "Started" });
    await expect(group.getByRole("radio", { name: "Today" })).toBeVisible();
    await expectOptions44(page, group);
    await expectNoDanger(page, flight);
    await floor(page);
    await screenshot(page, info, "books-in-flight-control");
    await page.keyboard.press("Escape");
    await expect(group).toHaveCount(0);
    await expect(started).toBeFocused();

    // Up next: a quarter row, where Read asks both dates.
    await open(page, "/books/status?tab=next");
    const quarter = await expand(page, QUARTER);
    const read = quarter.getByRole("button", { name: "Read", exact: true });
    await read.click();
    await expect(quarter.getByRole("group", { name: "Started" })).toBeVisible();
    await expect(quarter.getByRole("group", { name: "Finished" })).toBeVisible();
    await expectOptions44(page, quarter.getByRole("group", { name: "Finished" }));
    await expectNoDanger(page, quarter);
    await floor(page);
    await screenshot(page, info, "books-up-next-control");
    await page.keyboard.press("Escape");
    await expect(read).toBeFocused();
    await expect(quarter.getByRole("group", { name: "Started" })).toHaveCount(0);

    // Done: All reads (2), with one date's picker open.
    await open(page, "/books/status?tab=done");
    const twice = await expand(page, TWICE);
    await twice.getByRole("button", { name: "All reads (2)" }).click();
    const list = twice.getByRole("list", { name: `All reads of ${TWICE}` });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await expect(list.getByRole("img", { name: "Listened" })).toHaveCount(1);
    const first = list.getByRole("button", { name: "Started 3 June 2022, read 1" });
    await first.click();
    await expectOptions44(page, list.getByRole("group", { name: "Started" }));
    await expectNoDanger(page, twice);
    await floor(page);
    await screenshot(page, info, "books-done-all-reads");
    await page.keyboard.press("Escape");
    await expect(first).toBeFocused();
  });

  test("AC-6: with reduced transparency the glass is solid --surface and the control open on every tab holds, at 390 and 1280", ONCE, async ({ page, context }, info) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    for (const [width, glass] of [[390, ".bar"], [1280, ".side"]] as const) {
      await page.setViewportSize({ width, height: 900 });
      for (const [path, title, name] of [
        ["/books/status", FLIGHT, "in-flight"], ["/books/status?tab=next", QUARTER, "up-next"], ["/books/status?tab=done", TWICE, "done"],
      ] as const) {
        await open(page, path);
        const opened = await expand(page, title);
        await opened.getByRole("button", { name: "Read", exact: true }).click();
        await expect(opened.getByRole("group", { name: "Finished" })).toBeVisible();
        const surface = await tokenColour(page, "--surface");
        await expect.poll(() => page.locator(glass).first().evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface);
        expect(await page.locator(glass).first().evaluate((el) => getComputedStyle(el).backdropFilter)).toBe("none");
        await expectNoHorizontalScroll(page);
        await screenshot(page, info, `books-${name}-control-reduced-transparency-${width}`);
      }
    }
  });

  test("AC-1: Reading from Up next opens Started on Today; an earlier day writes started_on, exact; one Undo restores to_read", ONCE, async ({ page }) => {
    await open(page, "/books/status?tab=next");
    const quarter = await expand(page, QUARTER);
    await quarter.getByRole("button", { name: "Reading", exact: true }).click();
    const group = quarter.getByRole("group", { name: "Started" });
    await expect(group.getByRole("radio", { name: "Today" })).toBeChecked();
    // The row stays while the question is open, even though Reading takes it off Up next.
    await expect.poll(() => state("quarter")).toMatchObject({ status: "reading", started_on: todayEastern(), sp: "exact" });
    await expect(toggle(page, QUARTER)).toBeVisible();

    const day = daysAgo(3);
    await group.getByRole("radio", { name: "Pick a date" }).check();
    await quarter.getByLabel("Started on").fill(day);
    await quarter.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => state("quarter")).toMatchObject({ status: "reading", started_on: day, sp: "exact" });
    // One toast, one Undo: the status change's.
    const undo = page.locator(".toast").getByRole("button", { name: "Undo" });
    await expect(undo).toHaveCount(1);
    await undo.click();
    await expect.poll(() => state("quarter")).toMatchObject({ status: "to_read", started_on: null, sp: "none" });
  });

  test("AC-1: Read from In flight opens both; a start after the finish is refused and writes nothing; confirming writes one read with both dates", ONCE, async ({ page }) => {
    const posts: string[] = [];
    page.on("request", (r) => { if (r.method() === "POST" && r.url().includes("/api/progress/")) posts.push(r.url()); });
    await open(page, "/books/status");
    const flight = await expand(page, FLIGHT);
    await flight.getByRole("button", { name: "Read", exact: true }).click();
    const startGroup = flight.getByRole("group", { name: "Started" });
    const finishGroup = flight.getByRole("group", { name: "Finished" });
    await expect(startGroup.getByRole("radio", { name: "Pick a date" })).toBeChecked();
    await expect(flight.getByLabel("Started on")).toHaveValue("2026-10-01");
    await expect(finishGroup.getByRole("radio", { name: "Today" })).toBeChecked();

    await finishGroup.getByRole("radio", { name: "Pick a date" }).check();
    await flight.getByLabel("Finished on").fill("2026-09-20");
    const reason = flight.locator(".sheet-reason").first();
    await expect(reason).toHaveText("That's after the day you finished.");
    await expect(reason).toHaveAttribute("aria-live", "polite");
    const save = flight.getByRole("button", { name: "Save" });
    await expect(save).toHaveAttribute("aria-disabled", "true");
    const { color } = await computedStyle(reason, ["color"]);
    expect(color).not.toBe(await tokenColour(page, "--danger"));
    await save.click({ force: true });
    expect(posts).toEqual([]);
    expect((await state("flight")).status).toBe("reading");
    expect(await reads("flight")).toEqual([]);

    await flight.getByLabel("Finished on").fill("2026-10-10");
    await expect(reason).toHaveText("");
    await save.click();
    await expect.poll(() => reads("flight")).toEqual([{ started_on: "2026-10-01", finished_on: "2026-10-10", format: "text" }]);
    expect((await state("flight")).status).toBe("read");
    await expect(toggle(page, FLIGHT)).toHaveCount(0);
  });

  test("AC-1: All reads (2): re-dating the first changes only its row; the second changes its row and book_status", ONCE, async ({ page }) => {
    await open(page, "/books/status?tab=done");
    const twice = await expand(page, TWICE);
    // The date line: one All reads button, and the once-read book has none.
    await expect(twice.getByRole("button", { name: "All reads (2)" })).toHaveAttribute("aria-expanded", "false");
    await twice.getByRole("button", { name: "All reads (2)" }).click();
    const list = twice.getByRole("list", { name: `All reads of ${TWICE}` });

    await list.getByRole("button", { name: "Started 3 June 2022, read 1" }).click();
    await list.getByRole("radio", { name: "Pick a date" }).check();
    await list.getByLabel("Started on").fill("2022-06-10");
    await list.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => reads("twice")).toEqual([
      { started_on: "2022-06-10", finished_on: "2022-07-01", format: "text" },
      { started_on: "2025-03-02", finished_on: "2025-03-19", format: "audio" },
    ]);
    expect((await state("twice")).finished_on).toBe("2025-03-19");

    await list.getByRole("button", { name: "Finished 19 March 2025, read 2" }).click();
    await list.getByRole("radio", { name: "Pick a date" }).check();
    await list.getByLabel("Finished on").fill("2025-03-25");
    await list.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => reads("twice")).toEqual([
      { started_on: "2022-06-10", finished_on: "2022-07-01", format: "text" },
      { started_on: "2025-03-02", finished_on: "2025-03-25", format: "audio" },
    ]);
    expect((await state("twice")).finished_on).toBe("2025-03-25");

    // A book read once lists no All reads.
    await expand(page, ONCE_READ);
    await expect(row(page, ONCE_READ).getByRole("button", { name: /^All reads/ })).toHaveCount(0);
  });
});
