// Task 5.5 (D-139, UX-N13): DNF with a reason, in a real browser. Choosing DNF
// on the status control saves at once and opens the closing card, its field
// labelled, focused and filled with the book's note; a saved reason is the
// book's note and shows grey under the book's *Stopped* row on Done; *Skip* and
// Esc write nothing and hand focus back to DNF; the toast's Undo takes back the
// reason and the status together; a reason that didn't save says so with
// *Retry* and leaves the DNF. Nothing on the card or the row is `--ready` or
// `--danger`. Every test writes, so each runs once (w390-light); the last sets
// its own widths and themes for the screenshots at 360 and 1280. The books are
// made here under E2E ids nothing else uses, and removed after the last test.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { testSql, type TestSql } from "../db";
import { contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour } from "./helpers";

// Writes its own state: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };

const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "label",
];

const STARTED = "2026-10-01";
const PLAIN = { id: "e2e-dnf-plain", title: "E2E Dnf Lost Midway", note: null };
const GIFT = { id: "e2e-dnf-gift", title: "E2E Dnf Gift Copy", note: "Gift from Sam" };
const ESC = { id: "e2e-dnf-esc", title: "E2E Dnf Escaped", note: null };
const FAIL = { id: "e2e-dnf-fail", title: "E2E Dnf Offline", note: null };
const BOOKS = [PLAIN, GIFT, ESC, FAIL];
const REASON = "Lost interest at the midpoint";
const LABEL = "Why did you stop?";

async function withSql<T>(work: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await work(sql);
  } finally {
    await sql.end();
  }
}

const clean = () => withSql((sql) => sql`DELETE FROM books WHERE id = ANY(${BOOKS.map((b) => b.id)}::text[])`);

/** Every book back to Reading since STARTED, with its note. */
const reset = () => withSql(async (sql) => {
  for (const b of BOOKS) {
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision, notes)
              VALUES (${E2E_USER}, ${b.id}, 'reading', ${STARTED}, 'exact', ${b.note})
              ON CONFLICT (user_id, book_id) DO UPDATE
              SET status = 'reading', started_on = ${STARTED}, started_on_precision = 'exact', notes = ${b.note},
                  finished_on = NULL, finished_on_precision = 'none'`;
  }
});

test.beforeAll(async () => {
  await clean();
  await withSql(async (sql) => {
    for (const b of BOOKS) await sql`INSERT INTO books (id, title) VALUES (${b.id}, ${b.title})`;
  });
});
test.beforeEach(reset);
test.afterAll(clean);

const stored = (id: string) => withSql(async (sql) => (await sql`
  SELECT status, notes, started_on::text AS started_on, started_on_precision
  FROM book_status WHERE user_id = ${E2E_USER} AND book_id = ${id}`)[0] ?? null);

const bookRow = (page: Page, title: string) =>
  page.locator(".book-row", { has: page.locator(".row-title", { hasText: title }) });

/** Opens the book's status control on the Library and presses DNF: answers the row, its DNF and its card. */
async function stop(page: Page, title: string) {
  await page.goto("/books/list?q=E2E%20Dnf");
  const row = bookRow(page, title);
  const toggle = row.locator(".status-toggle");
  await hydrated(toggle);
  await toggle.click();
  const dnf = row.getByRole("group", { name: `Status of ${title}` }).getByRole("button", { name: "DNF" });
  await dnf.click();
  await expect(dnf).toHaveAttribute("aria-pressed", "true");
  const card = row.locator(".closing-card");
  await expect(card).toBeVisible();
  return { row, dnf, card, field: card.getByLabel(LABEL) };
}

/** Every colour the elements under `scope` draw (text, background, border), none of them `--ready` or `--danger`. */
async function noStateColours(page: Page, scope: Locator) {
  const drawn = await scope.evaluate((root) => [root, ...root.querySelectorAll("*")].flatMap((el) => {
    const s = getComputedStyle(el);
    return [s.color, s.backgroundColor, s.borderTopColor, s.outlineColor];
  }));
  for (const token of ["--ready", "--danger"]) {
    expect(drawn, token).not.toContain(await tokenColour(page, token));
  }
}

const stoppedRow = async (page: Page, title: string) => {
  await page.goto("/books/status?tab=done");
  const stopped = page.locator("details.stopped");
  await stopped.locator("summary").click();
  return stopped.locator(".row", { has: page.locator(".row-title", { hasText: title }) });
};

test("DNF saves at once and opens the card, field focused; a typed reason is the note, under the Stopped row after a reload (AC-1, AC-2)", ONCE, async ({ page }, info) => {
  const { field, card } = await stop(page, PLAIN.title);
  expect(await stored(PLAIN.id)).toMatchObject({ status: "dnf", notes: null });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("");
  await expect(card.getByRole("button")).toHaveText(["Save", "Skip"]);
  await noStateColours(page, card);

  await field.fill(REASON);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card).toBeHidden();
  await expect(page.locator(".toast")).toContainText("Reason saved");
  expect(await stored(PLAIN.id)).toMatchObject({ status: "dnf", notes: REASON });

  const row = await stoppedRow(page, PLAIN.title);
  // Under the title, grey.
  await expect(row.locator(".row-reason")).toHaveText(REASON);
  const order = await row.evaluate((el) => [...el.querySelectorAll(".row-head, .row-reason")].map((n) => n.className));
  expect(order).toEqual(["row-head", "row-reason"]);
  expect(await row.locator(".row-reason").evaluate((el) => getComputedStyle(el).color)).toBe(await tokenColour(page, "--muted"));
  await noStateColours(page, row);
  await screenshot(page, info, "dnf-reason-stopped");
});

test("a book with a note opens the card on it; Skip keeps the note and the DNF, focus back on DNF (AC-1, AC-3, AC-6)", ONCE, async ({ page }) => {
  const { field, card, dnf } = await stop(page, GIFT.title);
  await expect(field).toHaveValue("Gift from Sam");
  await card.getByRole("button", { name: "Skip" }).click();
  await expect(card).toBeHidden();
  await expect(dnf).toBeFocused();
  expect(await stored(GIFT.id)).toMatchObject({ status: "dnf", notes: "Gift from Sam" });
});

test("Esc closes the card as Skip, focus back on DNF; a Stopped row with no reason draws no line for one (AC-1, AC-6)", ONCE, async ({ page }) => {
  const { field, card, dnf } = await stop(page, ESC.title);
  await field.fill("typed, then thought better of");
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();
  await expect(dnf).toBeFocused();
  expect(await stored(ESC.id)).toMatchObject({ status: "dnf", notes: null });

  const row = await stoppedRow(page, ESC.title);
  await expect(row).toBeVisible();
  await expect(row.locator(".row-reason")).toHaveCount(0);
});

test("the toast's Undo after a reason leaves the book reading, its start kept, its note NULL (AC-1, AC-4)", ONCE, async ({ page }) => {
  const { field, card } = await stop(page, PLAIN.title);
  await field.fill(REASON);
  await card.getByRole("button", { name: "Save" }).click();
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => stored(PLAIN.id)).toEqual({
    status: "reading", notes: null, started_on: STARTED, started_on_precision: "exact",
  });
  await expect(bookRow(page, PLAIN.title).locator(".status-toggle")).toContainText("reading");
});

test("a reason that didn't save says so with Retry and leaves the DNF; Retry saves it (AC-4)", ONCE, async ({ page }) => {
  const { field, card } = await stop(page, FAIL.title);
  await page.route("**/api/progress/book/note", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await field.fill(REASON);
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("alert")).toContainText("didn't save");
  await expect(card.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(await stored(FAIL.id)).toMatchObject({ status: "dnf", notes: null });
  await noStateColours(page, card);

  await page.unroute("**/api/progress/book/note");
  await card.getByRole("button", { name: "Retry" }).click();
  await expect(card).toBeHidden();
  expect(await stored(FAIL.id)).toMatchObject({ status: "dnf", notes: REASON });
});

test("the card at 360 and 1280px, light and dark: targets, contrast, axe, no state colour, screenshots (AC-1, AC-6)", ONCE, async ({ page }, info) => {
  for (const [width, height] of [[360, 780], [1280, 800]] as const) {
    for (const colorScheme of ["light", "dark"] as const) {
      await reset();
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const { card, field } = await stop(page, GIFT.title);
      await expect(field).toBeFocused();
      // Phone targets are 44px; nothing anywhere under 24px.
      for (const name of ["Save", "Skip"]) {
        const box = (await card.getByRole("button", { name }).boundingBox())!;
        expect(box.height, `${name} at ${width}px`).toBeGreaterThanOrEqual(width < 768 ? 44 : 24);
      }
      // A visible label, not a placeholder.
      await expect(card.locator("label")).toHaveText(LABEL);
      await expect(card.locator("label")).toBeVisible();
      // Nothing moves under reduced motion.
      expect(await card.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
      await noStateColours(page, card);
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page, AXE);
      expect(await contrastFailures(page), `${width}px ${colorScheme}`).toEqual([]);
      await screenshot(page, info, `dnf-card-${width}-${colorScheme}`);
      await page.keyboard.press("Escape");
      await expect(card).toBeHidden();
    }
  }
});
