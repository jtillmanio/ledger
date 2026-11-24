// @area: comics
// Task 3.5, 3 of 3 (TASK-080): the issue sheet in a real browser.
// `/comics/[runId]/issue/[issueId]` from a run's spine is a sheet over it (an
// intercepted route, clear of `/comics/[runId]/add`, D-157): Back closes it with
// the spine's scroll where it was and focus on the row that opened it; a direct
// load or a refresh is the full page (AC-5). *Your record* lists every run that
// places the issue, with its position and its read state there: three runs,
// one read; marking a second writes exactly one issue_progress row, for that
// placement alone, and its Undo removes it; marking this run reaches the spine
// behind (AC-1, AC-2). *Cover date* in `Mon YYYY`, *Published* when it differs,
// and an undated issue draws no *Dates* (AC-4). *More credits* is a real
// disclosure (AC-3). The UX floor: toggles named with run and position and
// 44px on the phone, glyph and text, axe, contrast, screenshots at 360, 834
// and 1280px, light and dark (AC-6). The roadmap Check's *Why blocked?* clause
// is 2.6's, which builds that sheet (decided at TASK-080's plan gate).
// The runs and issues are made here, under E2E ids the rest of the suite
// doesn't use, and removed after the last test.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot } from "./helpers";

const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "aria-dialog-name", "landmark-unique",
  "duplicate-id-aria", "target-size", "label", "list", "listitem",
];

const X = { id: "e2e-isd-x", label: "E2E Isd Uncanny (1963) #142" };
const JAN = { id: "e2e-isd-jan", label: "E2E Isd Uncanny (1963) #141" };
const UNDATED = { id: "e2e-isd-undated", label: "E2E Isd Undated #1" };
/** Forty-four fillers ahead of X in the long run, so its spine scrolls past its 40th row. */
const FILLER = Array.from({ length: 44 }, (_, i) => ({ id: `e2e-isd-f${i + 1}`, label: `E2E Isd Filler #${i + 1}` }));
const LONG = { id: "e2e-isd-long", title: "E2E Isd Claremont" };
const BYRNE = { id: "e2e-isd-byrne", title: "E2E Isd Byrne" };
const DAYS = { id: "e2e-isd-days", title: "E2E Isd Days" };
const RUNS = [LONG, BYRNE, DAYS];
const ISSUES = [X, JAN, UNDATED, ...FILLER, { id: "e2e-isd-b1", label: "E2E Isd Byrne #1" }];
const CREATORS = [
  ["e2e-isd-cc", "E2E Chris Claremont"], ["e2e-isd-jb", "E2E John Byrne"], ["e2e-isd-ta", "E2E Terry Austin"],
  ["e2e-isd-gw", "E2E Glynis Wein"], ["e2e-isd-to", "E2E Tom Orzechowski"],
] as const;

const sheetUrl = (runId: string, issueId: string) => `/comics/${runId}/issue/${issueId}`;

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql(async (sql) => {
  // Runs and issues cascade to their placements and the placements' reads.
  await sql`DELETE FROM runs WHERE id = ANY(${RUNS.map((r) => r.id)}::text[])`;
  await sql`DELETE FROM issues WHERE id = ANY(${ISSUES.map((i) => i.id)}::text[])`;
  await sql`DELETE FROM creators WHERE id = ANY(${CREATORS.map(([id]) => id)}::text[])`;
});

/** X's placements and which of them are read: the issue_progress rows a mark may touch. */
const xReads = () => withSql((sql) => sql<{ run_id: string }[]>`
  SELECT ri.run_id FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id
  WHERE p.user_id = ${E2E_USER} AND ri.issue_id = ${X.id} ORDER BY ri.run_id`).then((rows) => rows.map((r) => r.run_id));
const unreadExceptDays = () => withSql((sql) => sql`
  DELETE FROM issue_progress WHERE user_id = ${E2E_USER}
    AND placement_id IN (SELECT id FROM run_issues WHERE issue_id = ${X.id} AND run_id <> ${DAYS.id})`);

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    // A Metron id below zero: no record pending, and none the test database may hold.
    await sql`INSERT INTO issues (id, label, story_title, story_title_source, story_arc, story_arc_source,
                                  cover_date, cover_date_source, store_date, store_date_source, metron_id)
              VALUES (${X.id}, ${X.label}, 'Days of Future Past, part two', 'metron', 'Days of Future Past', 'metron',
                      '1981-02-01', 'metron', '1980-11-04', 'metron', -91420)`;
    await sql`INSERT INTO issues (id, label, cover_date, cover_date_source, metron_id)
              VALUES (${JAN.id}, ${JAN.label}, '1981-01-01', 'metron', -91410)`;
    for (const i of ISSUES.slice(2)) await sql`INSERT INTO issues (id, label) VALUES (${i.id}, ${i.label})`;
    for (const r of RUNS) await sql`INSERT INTO runs (id, title) VALUES (${r.id}, ${r.title})`;
    const long = [...FILLER, X, JAN, UNDATED];
    for (const [n, i] of long.entries()) {
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${LONG.id}, ${n + 1}, ${i.id})`;
    }
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${BYRNE.id}, 1, 'e2e-isd-b1'), (${BYRNE.id}, 2, ${X.id})`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${DAYS.id}, 1, ${X.id})`;
    // Read in Days alone, in March 2025.
    await sql`INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
              SELECT ${E2E_USER}, id, '2025-03-15T16:00:00Z', 'exact' FROM run_issues WHERE run_id = ${DAYS.id}`;
    for (const [id, name] of CREATORS) await sql`INSERT INTO creators (id, name) VALUES (${id}, ${name})`;
    for (const [creator, role] of [["e2e-isd-cc", "writer"], ["e2e-isd-jb", "artist"], ["e2e-isd-ta", "inker"],
      ["e2e-isd-gw", "colorist"], ["e2e-isd-to", "letterer"], ["e2e-isd-jb", "cover"]] as const) {
      await sql`INSERT INTO issue_credits (issue_id, creator_id, role, source) VALUES (${X.id}, ${creator}, ${role}, 'metron')`;
    }
  });
});
test.afterAll(clean);
test.afterEach(unreadExceptDays);

const sheet = (page: Page) => page.getByRole("dialog");
const rowLink = (page: Page, label: string) => page.locator(".iss .lbl").getByRole("link", { name: label, exact: true });
const record = (page: Page) => page.locator(".detail:not([aria-busy]) .irec > li");
const toggleFor = (page: Page, run: string, n: number, of: number) =>
  page.getByRole("button", { name: `Mark read in ${run}, issue ${n} of ${of}`, exact: true });

/** Open an issue's sheet from its row in the run's spine, as a tap does, once the link is live. */
async function openFrom(page: Page, label: string) {
  const link = rowLink(page, label);
  await hydrated(link);
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(sheet(page)).toBeVisible();
  await expect(sheet(page).locator(".detail:not([aria-busy])").getByRole("heading", { level: 2, name: label })).toBeVisible();
  await expect.poll(() => sheet(page).evaluate((el) =>
    el.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
}

test("from the spine past its 40th row the sheet opens over it; Back returns to the spine where it was, focus on the row (AC-5)", async ({ page }) => {
  await page.goto(`/comics/${LONG.id}`);
  const link = rowLink(page, X.label);
  await hydrated(link);
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  expect(before).toBeGreaterThan(0);
  await link.click();

  await expect(page).toHaveURL(new RegExp(`${sheetUrl(LONG.id, X.id)}$`));
  const dialog = sheet(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(X.label);
  await expect(dialog.getByRole("heading", { level: 2, name: X.label })).toBeFocused();
  // One sheet, the spine still drawn behind it, not scrolled.
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.locator(".iss")).toHaveCount(FILLER.length + 3);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/comics/${LONG.id}$`));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(before);
  await expect(link).toBeFocused();
});

test("an issue in three runs, read in one, lists three runs with one read; marking a second writes exactly one issue_progress row, and Undo removes it (AC-1, AC-2)", async ({ page }) => {
  const posts: unknown[] = [];
  page.on("request", (req) => {
    if (req.method() === "POST" && new URL(req.url()).pathname === "/api/progress/issue") posts.push(req.postDataJSON());
  });
  await page.goto(`/comics/${LONG.id}`);
  await openFrom(page, X.label);

  const rows = record(page);
  await expect(rows).toHaveCount(3);
  await expect(rows.locator(".irec-run")).toHaveText([LONG.title, BYRNE.title, DAYS.title]);
  await expect(rows.locator(".irec-pos")).toHaveText([`issue 45 of 47 · this run`, "issue 2 of 2", "issue 1 of 1"]);
  await expect(rows.locator("button")).toHaveText(["○ Mark read", "○ Mark read", "✓ read · Mar 2025"]);
  await expect(page.locator(".irec-count")).toHaveText("1 of 3 runs read");
  expect(await xReads()).toEqual([DAYS.id]);

  const byrne = toggleFor(page, BYRNE.title, 2, 2);
  await expect(byrne).toHaveAttribute("aria-pressed", "false");
  await byrne.click();
  await expect(byrne).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".irec-count")).toHaveText("2 of 3 runs read");
  // Exactly one row, for Byrne's placement; the run you came from is untouched.
  await expect.poll(xReads).toEqual([BYRNE.id, DAYS.id]);
  const [placement] = await withSql((sql) => sql<{ id: number }[]>`
    SELECT id FROM run_issues WHERE run_id = ${BYRNE.id} AND issue_id = ${X.id}`);
  expect(posts).toEqual([{ placementId: placement.id, completed: true }]);
  await expect(toggleFor(page, LONG.title, 45, 47)).toHaveAttribute("aria-pressed", "false");

  // Its Undo removes that row and nothing else.
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect(byrne).toHaveAttribute("aria-pressed", "false");
  await expect.poll(xReads).toEqual([DAYS.id]);
  await expect(page.locator(".irec-count")).toHaveText("1 of 3 runs read");
});

test("marking this run from the sheet reaches the spine behind it; Undo after the sheet closed puts the spine back (manual check, automated)", async ({ page }) => {
  await page.goto(`/comics/${LONG.id}`);
  await openFrom(page, X.label);
  const mine = toggleFor(page, LONG.title, 45, 47);
  await mine.click();
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await expect.poll(xReads).toEqual([DAYS.id, LONG.id]);

  await page.keyboard.press("Escape");
  await expect(sheet(page)).toBeHidden();
  // `has` matches inside the row, so the link is found from its `.lbl`, not from `.iss` again.
  const chk = page.locator(".iss", { has: page.locator(".lbl").getByRole("link", { name: X.label, exact: true }) })
    .locator("button.chk");
  await expect(chk).toHaveAttribute("aria-pressed", "true");
  // Byrne's placement was never touched.
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(xReads).toEqual([DAYS.id]);
  await expect(chk).toHaveAttribute("aria-pressed", "false");
});

test("a direct load and a refresh render the full page with the same content and no sheet (AC-5)", async ({ page }) => {
  for (const visit of ["load", "refresh"] as const) {
    if (visit === "load") await page.goto(sheetUrl(BYRNE.id, X.id));
    else await page.reload();
    await expect(page.getByRole("dialog"), visit).toHaveCount(0);
    await expect(page.locator(".rsheet-top"), visit).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: X.label }), visit).toBeVisible();
    await expect(page.locator(".detail:not([aria-busy]) h2.s"), visit).toHaveText(["Dates", "Credits", "Your record"]);
    // This run is the one in the URL.
    await expect(record(page).first().locator(".irec-pos"), visit).toHaveText("issue 2 of 2 · this run");
  }
});

test("an unknown issue, or a run that doesn't place it, is not found; the run's Add is not caught by the sheet (D-157)", async ({ page }) => {
  for (const url of [sheetUrl(LONG.id, "e2e-isd-nope"), sheetUrl(BYRNE.id, JAN.id)]) {
    await page.goto(url);
    await expect(page.getByText("This page could not be found."), url).toBeVisible();
    await expect(page.locator(".detail"), url).toHaveCount(0);
  }
  await page.goto(`/comics/${LONG.id}`);
  const add = page.locator(`a[href="/comics/${LONG.id}/add"]`).first();
  await hydrated(add);
  await add.click();
  await expect(page).toHaveURL(new RegExp(`/comics/${LONG.id}/add$`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Cover date in Mon YYYY, Published when it differs, and no Dates for an undated issue (AC-4)", async ({ page }) => {
  const dates = page.locator(".detail:not([aria-busy]) .issue-dates .frow");
  await page.goto(sheetUrl(LONG.id, X.id));
  await expect(dates.locator(".k")).toHaveText(["Cover date", "Published"]);
  await expect(dates.locator(".v")).toHaveText(["Feb 1981", "Nov 1980"]);
  await page.goto(sheetUrl(LONG.id, JAN.id));
  await expect(dates.locator(".k")).toHaveText(["Cover date"]);
  await expect(dates.locator(".v")).toHaveText(["Jan 1981"]);
  await page.goto(sheetUrl(LONG.id, UNDATED.id));
  await expect(page.getByRole("heading", { level: 1, name: UNDATED.label })).toBeVisible();
  await expect(page.locator(".issue-dates")).toHaveCount(0);
  await expect(page.locator(".detail h2.s")).toHaveText(["Your record"]);
  await expect(page.locator(".detail")).not.toContainText("Cover date");
});

test("More credits is a real button that opens Colorist and Letterer in place (AC-3)", async ({ page }) => {
  await page.goto(sheetUrl(LONG.id, X.id));
  await expect(page.locator(".issue-credits .k")).toHaveText(["Writer", "Penciller", "Inker"]);
  const more = page.getByRole("button", { name: "More credits" });
  await hydrated(more);
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".issue-more-credits")).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".issue-more-credits .k")).toHaveText(["Colorist", "Letterer"]);
  await expect(page.locator(".issue-more-credits .v")).toHaveText(["E2E Glynis Wein", "E2E Tom Orzechowski"]);
});

test("the sheet and the page at 360, 834 and 1280px, light and dark: names, 44px toggles on the phone, axe, contrast, screenshots (AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [834, 1112], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      const at = `${width}px ${colorScheme}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme });
      await page.goto(`/comics/${LONG.id}`);
      await openFrom(page, X.label);
      await expect(page.getByRole("dialog"), at).toHaveCount(1);
      const toggles = sheet(page).locator(".irec button");
      await expect(toggles, at).toHaveCount(3);
      for (const t of await toggles.all()) {
        await expect(t, at).toHaveAttribute("aria-pressed", /^(true|false)$/);
        const box = (await t.boundingBox())!;
        // 44px on the phone; never under 24 anywhere (WCAG 2.5.8).
        expect(box.height, at).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
        expect(box.width, at).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
      }
      // Read state is a glyph and text, the tick in --ready and the ring grey.
      const glyph = (n: number) => sheet(page).locator(".irec-glyph").nth(n).evaluate((el) => getComputedStyle(el).color);
      const ready = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.color = "var(--ready)";
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      });
      expect(await glyph(2), at).toBe(ready);
      expect(await glyph(0), at).not.toBe(ready);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE, '[role="dialog"]');
      expect(await contrastFailures(page), at).toEqual([]);
      await screenshot(page, info, `issue-sheet-${width}-${colorScheme}`);
      await page.keyboard.press("Escape");
      await expect(sheet(page)).toBeHidden();

      await page.goto(sheetUrl(LONG.id, X.id));
      await expect(page.locator(".detail:not([aria-busy]) .detail-title"), at).toBeVisible();
      await page.getByRole("button", { name: "More credits" }).click();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `page ${at}`).toEqual([]);
      await screenshot(page, info, `issue-page-${width}-${colorScheme}`);
    }
  }
});
