// Task 2.0 (F-21, R1-05): Settings in a real browser. One `<h1>`; each stepper a
// named group of real buttons; a press saved once, debounced, and shown again
// after a reload with the *a year* card to match; the bounds `aria-disabled`
// with a written reason; a failed save drawn as the app's failed-write line
// with the value put back; *Export everything* a plain link; Settings current in
// the rail, the sidebar or the phone's gear; the UX floor (axe, contrast, 44px
// rows, 32px buttons, no sideways scroll); the loading state at the loaded
// geometry. Runs at every width, light and dark; the checks that write, or that
// set their own width, run once. The row is the e2e user's, deleted before and
// after each writing test so the screen starts on the defaults.
import { expect, test, type Page } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import Loading from "../../src/app/settings/loading";
import { easternYear, formatWords, wordsPerYear } from "../../src/lib/settings";
import { testSql } from "../db";
import {
  computedStyle, contrastFailures, expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, toastSettled,
} from "./helpers";

// Writes or sets its own viewport: runs once, in w390-light.
const ONCE = { tag: "@at-w390-light" };
const AXE = [
  "nested-interactive", "button-name", "link-name", "color-contrast", "aria-allowed-attr", "aria-allowed-role",
  "aria-prohibited-attr", "aria-valid-attr-value", "aria-hidden-focus", "landmark-unique", "duplicate-id-aria",
  "target-size", "heading-order", "landmark-one-main", "page-has-heading-one",
];

async function reset(minutes?: number) {
  const sql = testSql();
  try {
    await sql`DELETE FROM reading_settings WHERE user_id = ${E2E_USER}`;
    if (minutes !== undefined) await sql`INSERT INTO reading_settings (user_id, minutes_per_day) VALUES (${E2E_USER}, ${minutes})`;
  } finally {
    await sql.end();
  }
}

async function storedMinutes() {
  const sql = testSql();
  try {
    const [row] = await sql`SELECT minutes_per_day FROM reading_settings WHERE user_id = ${E2E_USER}`;
    return (row?.minutes_per_day ?? null) as number | null;
  } finally {
    await sql.end();
  }
}

const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const output = (page: Page, name: string) => group(page, name).locator("output");
const press = (page: Page, verb: "Increase" | "Decrease", name: string) =>
  page.getByRole("button", { name: `${verb} ${name.toLowerCase()}`, exact: true });

const edit = (page: Page, name: string) => page.getByRole("button", { name: `Edit ${name.toLowerCase()}`, exact: true });
const field = (page: Page, name: string) => group(page, name).locator("input");

async function open(page: Page) {
  await page.goto("/settings");
  await hydrated(press(page, "Increase", "Minutes a day"));
}

test.afterAll(() => reset());

test("one h1, and the three steppers are named groups of real buttons", async ({ page }) => {
  await open(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveText("Settings");
  for (const name of ["Minutes a day", "Words a minute", "Words per page"]) {
    const g = group(page, name);
    await expect(g).toHaveCount(1);
    // − , the number (a button named for its row, 2.0b) and +.
    await expect(g.locator("button")).toHaveCount(3);
    await expect(edit(page, name)).toBeVisible();
    await expect(g.locator("[role=button], [disabled]")).toHaveCount(0);
    await expect(press(page, "Decrease", name)).toBeVisible();
    await expect(press(page, "Increase", name)).toBeVisible();
    await expect(g.locator("output")).toHaveCount(1);
  }
});

test("Export everything is a plain a href=/api/export, and the nav has no Export", async ({ page }) => {
  await open(page);
  const link = page.getByRole("link", { name: "Download everything as JSON" });
  await expect(link).toHaveAttribute("href", "/api/export");
  expect(await link.evaluate((a) => a.tagName)).toBe("A");
  await expect(page.getByText("Export everything", { exact: true })).toBeVisible();
  // The nav no longer carries it, so the export is reached from here only.
  await expect(page.locator('.bar a[href="/api/export"], .rail a[href="/api/export"], .side a[href="/api/export"]')).toHaveCount(0);
  await expect(page.getByText(/\d+ rules? · \d+ series/)).toBeVisible();
});

test("Settings is current in the bar that is drawn: the phone's gear, the rail at 768, the sidebar from 1024", async ({ page }) => {
  await open(page);
  const width = page.viewportSize()!.width;
  const bar = width < 768 ? ".bar" : width < 1024 ? ".rail" : ".side";
  const link = page.locator(`${bar} a[href="/settings"]`);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("aria-current", "page");
  await expect(link).toHaveAccessibleName("Settings");
  // And in no other bar that is on screen.
  for (const other of [".bar", ".rail", ".side"].filter((b) => b !== bar)) {
    await expect(page.locator(`${other} a[href="/settings"]`)).toBeHidden();
  }
});

test("the gear is one tap from a dashboard at 360px, and 44px square", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/comics");
  const gear = page.locator('.bar a[href="/settings"]');
  await expect(gear).toBeVisible();
  const box = (await gear.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expectNoHorizontalScroll(page);
  await hydrated(gear);
  await gear.click();
  await expect(page).toHaveURL(/\/settings$/);
  // The dashboard's heading stays until Settings has rendered.
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(gear).toHaveAttribute("aria-current", "page");
});

test("fifteen presses of + save 60 once, and a reload shows it and the year figure (AC-2)", ONCE, async ({ page }) => {
  await reset();
  await open(page);
  await expect(output(page, "Minutes a day")).toHaveText("45");
  const saves: string[] = [];
  page.on("request", (r) => { if (r.method() === "PATCH" && r.url().endsWith("/api/settings")) saves.push(r.postData() ?? ""); });
  const up = press(page, "Increase", "Minutes a day");
  for (let n = 0; n < 15; n++) await up.click();
  await expect(output(page, "Minutes a day")).toHaveText("60");
  await expect(page.getByText("At 60 minutes a day")).toBeVisible();
  await expect.poll(storedMinutes).toBe(60);
  expect(saves).toEqual(['{"minutesPerDay":60}']);

  await page.reload();
  await hydrated(press(page, "Increase", "Minutes a day"));
  await expect(output(page, "Minutes a day")).toHaveText("60");
  const year = wordsPerYear({ minutesPerDay: 60, wordsPerMinute: 185 }, easternYear());
  expect(year).toBe(60 * 185 * ((easternYear() % 4 === 0 && easternYear() % 100 !== 0) || easternYear() % 400 === 0 ? 366 : 365));
  await expect(page.locator(".pace-card")).toContainText(`${formatWords(year)} words a year`);
  await expect(page.getByText("At 60 minutes a day")).toBeVisible();
  // The other two settings were not sent, so they are as they were.
  await expect(output(page, "Words a minute")).toHaveText("185");
  await expect(output(page, "Words per page")).toHaveText("275");
});

test("the − at the lower bound is aria-disabled with a written reason, never disabled, and does nothing", ONCE, async ({ page }, info) => {
  await reset(1);
  await open(page);
  const down = press(page, "Decrease", "Minutes a day");
  await expect(down).toHaveAttribute("aria-disabled", "true");
  expect(await down.evaluate((b) => b.hasAttribute("disabled"))).toBe(false);
  const reason = await down.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${reason}"]`)).toHaveText("The lowest is 1");
  await expect(page.locator(`[id="${reason}"]`)).toBeVisible();
  await expect(page.getByText("At 1 minute a day")).toBeVisible();
  await down.focus();
  await expect(down).toBeFocused(); // reachable by keyboard, as a disabled button is not
  // Playwright treats aria-disabled as not enabled and waits; force the press a user could make.
  await down.click({ force: true });
  await expect(output(page, "Minutes a day")).toHaveText("1");
  await page.waitForTimeout(800);
  expect(await storedMinutes()).toBe(1);
  expect(await contrastFailures(page)).toEqual([]);
  await screenshot(page, info, "settings-at-bound");
  await reset();
});

test("a failed save raises the failed-write line and puts the value back", ONCE, async ({ page }, info) => {
  await reset();
  await open(page);
  await page.route("**/api/settings", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await press(page, "Increase", "Minutes a day").click();
  await expect(output(page, "Minutes a day")).toHaveText("46");
  const toast = page.locator(".toast");
  await expect(toast).toContainText("Couldn't save your reading pace");
  await expect(output(page, "Minutes a day")).toHaveText("45");
  await expect(toast.getByRole("button", { name: "Retry" })).toBeVisible();
  await toastSettled(page);
  await screenshot(page, info, "settings-save-failed");
  expect(await storedMinutes()).toBeNull();

  // Retry sends the value again, and this time it lands.
  await page.unroute("**/api/settings");
  await toast.getByRole("button", { name: "Retry" }).click();
  await expect(output(page, "Minutes a day")).toHaveText("46");
  await expect.poll(storedMinutes).toBe(46);
  await reset();
});

test("a press waiting to be saved is sent when the screen is left", ONCE, async ({ page }) => {
  await reset();
  await open(page);
  await press(page, "Increase", "Words a minute").click();
  await expect(output(page, "Words a minute")).toHaveText("190");
  await page.getByRole("link", { name: "Comics" }).first().click();
  await expect(page).toHaveURL(/\/comics$/);
  const sql = testSql();
  try {
    await expect.poll(async () => (await sql`SELECT words_per_minute AS w FROM reading_settings WHERE user_id = ${E2E_USER}`)[0]?.w).toBe(190);
  } finally {
    await sql.end();
  }
  await reset();
});

test("meets the floor: 44px rows, 32px buttons, contrast in this theme, axe, no sideways scroll", async ({ page }, info) => {
  await open(page);
  for (const name of ["Minutes a day", "Words a minute", "Words per page"]) {
    for (const verb of ["Decrease", "Increase"] as const) {
      const box = (await press(page, verb, name).boundingBox())!;
      expect(box.width, `${verb} ${name} width`).toBeGreaterThanOrEqual(32);
      expect(box.height, `${verb} ${name} height`).toBeGreaterThanOrEqual(32);
    }
    const row = (await page.locator(".frow", { has: group(page, name) }).boundingBox())!;
    expect(row.height, `${name} row`).toBeGreaterThanOrEqual(44);
  }
  // The stepper sits on --sunk (STYLE_GUIDE §9).
  const sunk = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.background = "var(--sunk)";
    document.body.append(probe);
    const c = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return c;
  });
  expect((await computedStyle(page.locator(".stepper").first(), ["background-color"]))["background-color"]).toBe(sunk);
  expect(await contrastFailures(page)).toEqual([]);
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "settings");
});

test("from 1024px pace is on the left and data on the right; below it they stack", async ({ page }) => {
  await open(page);
  const pace = (await page.getByRole("heading", { name: "Reading pace" }).boundingBox())!;
  const data = (await page.getByRole("heading", { name: "Data" }).boundingBox())!;
  if (page.viewportSize()!.width >= 1024) {
    expect(data.x).toBeGreaterThan(pace.x + 200);
  } else {
    expect(data.y).toBeGreaterThan(pace.y);
    expect(Math.abs(data.x - pace.x)).toBeLessThan(2);
  }
});

test("the loading state draws the loaded rows' size (AC-5)", ONCE, async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page);
  const rows = ".settings .group:not(.pace-card) .frow";
  const measure = () => page.locator(rows).evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height }; }));
  const loaded = await measure();
  const skeleton = renderToStaticMarkup(createElement(Loading)).replace(/^<main[^>]*>|<\/main>$/g, "");
  // The real loading screen's <main> has no class; the loaded one's `settings` only styles the loaded rows.
  await page.evaluate((html) => { document.querySelector("main")!.innerHTML = html; }, skeleton);
  const sk = await measure();
  expect(sk.length, "how many rows").toBe(loaded.length);
  sk.forEach((s, n) => {
    expect(Math.abs(s.width - loaded[n].width), `row ${n + 1} width`).toBeLessThanOrEqual(2);
    expect(Math.abs(s.height - loaded[n].height), `row ${n + 1} height (skeleton ${s.height}px, loaded ${loaded[n].height}px)`).toBeLessThanOrEqual(2);
  });
  expect(await page.locator("main .sk").count()).toBeGreaterThan(5);
});

// ---- Task 2.0b (D-123): type a setting, and hold to step ---------------------------------------


test("typing: a numeric input with the text selected; Enter commits a value past the maximum with its reason and focus returns to the number (AC-1, AC-2)", ONCE, async ({ page }) => {
  await reset();
  await open(page);
  const saves: string[] = [];
  page.on("request", (r) => { if (r.method() === "PATCH" && r.url().endsWith("/api/settings")) saves.push(r.postData() ?? ""); });
  await edit(page, "Minutes a day").click();
  const input = field(page, "Minutes a day");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  await expect(input).toBeFocused();
  expect(await input.evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))).toBe("45");
  await input.fill("9000");
  await input.press("Enter");
  await expect(edit(page, "Minutes a day")).toBeFocused();
  await expect(output(page, "Minutes a day")).toHaveText("600");
  await expect(page.getByText("The highest is 600")).toBeVisible();
  await expect.poll(storedMinutes).toBe(600);
  expect(saves).toEqual(['{"minutesPerDay":600}']);

  // Esc puts the old value back; leaving the field commits with no Enter and leaves focus where you tapped.
  await edit(page, "Minutes a day").click();
  await field(page, "Minutes a day").fill("20");
  await field(page, "Minutes a day").press("Escape");
  await expect(edit(page, "Minutes a day")).toBeFocused();
  await expect(output(page, "Minutes a day")).toHaveText("600");
  // Off the bound first: the reason line goes when the value leaves it, and the rows below would move under a tap.
  await edit(page, "Minutes a day").click();
  await field(page, "Minutes a day").fill("100");
  await field(page, "Minutes a day").press("Enter");
  await expect(output(page, "Minutes a day")).toHaveText("100");
  await edit(page, "Minutes a day").click();
  await field(page, "Minutes a day").fill("50");
  await edit(page, "Words a minute").click();
  await expect(field(page, "Words a minute")).toBeFocused();
  await expect(output(page, "Minutes a day")).toHaveText("50");
  await field(page, "Words a minute").press("Escape");
  await expect.poll(storedMinutes).toBe(50);
  await reset();
});

test("hold: a press held past a second sends one save with the final value (AC-1, AC-4)", ONCE, async ({ page }) => {
  await reset();
  await open(page);
  const saves: string[] = [];
  page.on("request", (r) => { if (r.method() === "PATCH" && r.url().endsWith("/api/settings")) saves.push(r.postData() ?? ""); });
  const box = (await press(page, "Increase", "Minutes a day").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await page.mouse.up();
  const shown = Number(await output(page, "Minutes a day").textContent());
  expect(shown).toBeGreaterThan(49);
  await expect.poll(storedMinutes).toBe(shown);
  expect(saves).toEqual([`{"minutesPerDay":${shown}}`]);
  await reset();
});

test("the number and its input meet the floor: named, 24px+, same row height open or closed, no text selection, contrast, axe (AC-5)", async ({ page }, info) => {
  await reset();
  await open(page);
  const rowOf = (name: string) => page.locator(".frow", { has: group(page, name) });
  const closed = (await rowOf("Minutes a day").boundingBox())!.height;
  const number = edit(page, "Minutes a day");
  expect((await number.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  const buttonStyle = await computedStyle(press(page, "Increase", "Minutes a day"), ["user-select", "touch-action"]);
  expect(buttonStyle["user-select"]).toBe("none");
  expect(buttonStyle["touch-action"]).toBe("manipulation");
  await number.click();
  const input = field(page, "Minutes a day");
  await expect(input).toBeVisible();
  expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  expect(await input.getAttribute("aria-label")).toBe("Minutes a day");
  expect((await rowOf("Minutes a day").boundingBox())!.height).toBe(closed);
  expect(await contrastFailures(page)).toEqual([]);
  // The outline is 3:1 on the stepper's --sunk in this theme (WCAG 1.4.11): the colour is --brand.
  const ring = await computedStyle(input, ["outline-color", "outline-style", "outline-width"]);
  const brand = await page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.color = "var(--brand)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(ring["outline-color"]).toBe(brand);
  expect(ring["outline-style"]).toBe("solid");
  await expectNoAxeViolations(page, AXE);
  await expectNoHorizontalScroll(page);
  await screenshot(page, info, "settings-typing");
});
