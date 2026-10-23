// Task 1.8b: the thumb bar, the mark that answers back, the toast above it, and
// contrast, in a real browser. Runs at every width, light and dark, and under
// reduced motion, so the Check's widths and both themes are the projects
// themselves; the checks that need a width of their own (834, 1100) set it and
// run once. A test that marks something puts the seeded run back after.
import { expect, test, type Page } from "@playwright/test";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { markRead, testSql, type TestSql } from "../db";
import {
  E2E_ISSUE_COUNT, E2E_LONG_LABEL, E2E_LONG_RUN_ID, E2E_READ_COUNT, E2E_RUN_ID, E2E_RUN_TITLE, contrastFailures,
  expectNoAxeViolations, expectNoHorizontalScroll, hydrated, screenshot, tokenColour, toastSettled,
} from "./helpers";

const ONCE = "w390-light";
const runsOnce = (name: string) => test.skip(name !== ONCE, `sets its own viewport: runs once, in ${ONCE}`);
const RUN = `/comics/${E2E_RUN_ID}`;
const NEXT = E2E_READ_COUNT + 1; // the seeded run has its first three read, so #4 is next

async function db<T>(fn: (sql: TestSql) => Promise<T>): Promise<T> {
  const sql = testSql();
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** The sequences of the seeded run that are read, in order. */
const readHere = (runId = E2E_RUN_ID) => db(async (sql) =>
  (await sql`SELECT ri.sequence FROM issue_progress p JOIN run_issues ri ON ri.id = p.placement_id
             WHERE ri.run_id = ${runId} AND p.user_id = ${E2E_USER} ORDER BY ri.sequence`).map((r) => r.sequence as number));

// Every test leaves the seeded run as the global setup made it: three read, and the long run untouched.
test.afterEach(async () => {
  await db((sql) => sql`
    DELETE FROM issue_progress WHERE user_id = ${E2E_USER} AND placement_id IN (
      SELECT id FROM run_issues
      WHERE (run_id = ${E2E_RUN_ID} AND sequence > ${E2E_READ_COUNT}) OR run_id = ${E2E_LONG_RUN_ID})`);
});

const wide = (page: Page) => page.viewportSize()!.width >= 1024;
/** The mark verb in view: the header's from 1024px on a dashboard, otherwise the bar's. */
const primary = (page: Page, where: "dash" | "run") =>
  page.locator(where === "dash" && wide(page) ? ".headverbs .mark" : ".actionbar .mark");
const reduced = (page: Page) => page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);

async function open(page: Page, where: "dash" | "run") {
  await page.goto(where === "run" ? RUN : "/comics");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await hydrated(primary(page, where));
}

/** Time is ours from here: nothing in the page moves until `runFor`. */
async function freeze(page: Page) {
  await page.clock.install({ time: new Date("2026-10-22T10:00:00") });
}
async function stopTime(page: Page) {
  await page.clock.pauseAt(new Date("2026-10-22T10:01:00"));
}

for (const where of ["dash", "run"] as const) {
  test.describe(where === "dash" ? "a dashboard" : "the run detail", () => {
    test("the primary verb is in the bottom 96px, every target is 44px, and the bar's radius is 12px (AC-1, AC-2)", async ({ page }, testInfo) => {
      await open(page, where);
      await expectNoHorizontalScroll(page);
      const vh = page.viewportSize()!.height;

      if (where === "dash" && wide(page)) {
        // From 1024px the verbs are in the header and no bottom bar is drawn.
        await expect(page.locator(".actionbar")).toBeHidden();
        await expect(page.locator(".headverbs .mark")).toBeVisible();
        for (const control of await page.locator(".headverbs .btn, .headverbs .iconbtn").all()) {
          const box = (await control.boundingBox())!;
          expect(box.height, "a header verb").toBeGreaterThanOrEqual(44);
        }
      } else {
        await expect(page.locator(".actionbar")).toBeVisible();
        const box = (await primary(page, where).boundingBox())!;
        expect(box.y, "the primary starts in the bottom 96px").toBeGreaterThanOrEqual(vh - 96);
        expect(box.y + box.height, "and ends inside the viewport").toBeLessThanOrEqual(vh);
        for (const control of await page.locator(".actionbar .btn, .actionbar .iconbtn").all()) {
          const size = await control.evaluate((el) => {
            const cs = getComputedStyle(el);
            return { height: parseFloat(cs.height), width: parseFloat(cs.width), radius: cs.borderTopLeftRadius };
          });
          expect(size.height, "a bar control's computed height").toBeGreaterThanOrEqual(44);
          if (await control.evaluate((el) => el.classList.contains("iconbtn"))) {
            expect(size.width, "an icon button's computed width").toBeGreaterThanOrEqual(44);
          }
          expect(size.radius, "FP-D10").toBe("12px");
        }
        // The bar's padding keeps the Android gesture bar off the verb (F2).
        const pad = await page.locator(".actionbar").evaluate((el) => getComputedStyle(el).paddingBottom);
        expect(pad).toBe("12px");
      }
      await screenshot(page, testInfo, `thumb-${where}`);
    });

    test("the slots are Mark · second · third, and the header is Search · second · Mark (AC-2)", async ({ page }) => {
      await open(page, where);
      const names = (sel: string) => page.locator(sel).evaluateAll((els) =>
        els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim()));
      if (where === "run") {
        expect(await names(".actionbar > *")).toEqual([`Mark #${NEXT} read`, "Mark through…", "Add issues"]);
        await expect(page.locator(".headverbs")).toHaveCount(0);
      } else {
        expect(await names(".actionbar > *")).toEqual([`Mark #${NEXT} read`, "+ batch", "Search (Ctrl K)"]);
        // In the DOM, and visible from 1024px: the same verbs, primary last.
        expect(await names(".headverbs > *")).toEqual(["Search (Ctrl K)", "+ batch", `Mark #${NEXT} read`]);
        if (wide(page)) await expect(page.locator(".headverbs")).toBeVisible();
        else await expect(page.locator(".headverbs")).toBeHidden();
      }
    });

    test("the mark answers back: press, ✓ at 120ms and still at 700ms, the next label at 1.3s (AC-1)", async ({ page }, testInfo) => {
      await freeze(page);
      await open(page, where);
      const button = primary(page, where);
      const ready = await tokenColour(page, "--ready");
      const onReady = await tokenColour(page, "--on-ready");
      const brand = await tokenColour(page, "--brand");
      const look = () => button.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          state: (el as HTMLElement).dataset.state, text: el.textContent, background: cs.backgroundColor, color: cs.color,
          // The motion a state is drawn with: nothing of it under prefers-reduced-motion.
          durations: [cs.transitionDuration, getComputedStyle(el.querySelector(".mark-label")!).animationDuration],
        };
      });
      await stopTime(page);

      // The colour change is a CSS transition on the compositor's clock, not the page's: poll until it lands.
      const showing = (want: Record<string, unknown>, at: string) => expect.poll(look, { message: at }).toMatchObject(want);

      await button.click();
      await showing({ state: "press", text: `Mark #${NEXT} read` }, "press");
      await screenshot(page, testInfo, `mark-${where}-1-press`);

      await page.clock.runFor(120);
      await showing({ state: "confirm", text: `✓ #${NEXT} read`, background: ready, color: onReady }, "120ms");
      await screenshot(page, testInfo, `mark-${where}-2-confirm`);

      await page.clock.runFor(580);
      await showing({ state: "confirm", text: `✓ #${NEXT} read`, background: ready }, "700ms");

      // A mouse left over the button would show its hover colour, a shade of --brand: step off it.
      await page.mouse.move(0, 0);
      await page.clock.runFor(600);
      // The next label comes from the page (the spine ticks at once, the dashboard fetches).
      await showing({ state: "next", text: `Mark #${NEXT + 1} read`, background: brand }, "1.3s");
      const s = await look();
      await screenshot(page, testInfo, `mark-${where}-3-next`);

      if (await reduced(page)) {
        // The same four states, with no movement in any of them.
        expect(s.durations.every((d) => parseFloat(d) === 0), `durations ${s.durations}`).toBe(true);
        const toast = await page.locator(".toast").evaluate((el) => ({
          enter: getComputedStyle(el).animationDuration, count: getComputedStyle(el.querySelector(".toast-count")!).animationDuration,
        }));
        expect(toast).toEqual({ enter: "0s", count: "0s" });
      }
      // The toast says how far along the run is: the count is a number, not a string with a 1 on it.
      await expect(page.locator(".toast-detail")).toHaveText(`${NEXT} of ${E2E_ISSUE_COUNT} in ${E2E_RUN_TITLE}`);
      expect(await readHere()).toContain(NEXT);
    });

    test("under prefers-reduced-motion nothing transitions or animates; otherwise the task's own durations apply (AC-1)", async ({ page }) => {
      await open(page, where);
      const quiet = await reduced(page);
      const first = (selector: string) => page.locator(selector).first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return parseFloat(cs.transitionDuration.split(",")[0]);
      });
      // The mark button's press and confirm are --dur-1 (100ms) at rest, instant when motion is reduced.
      expect(await first(".btn.mark"), ".btn.mark transition-duration").toBe(quiet ? 0 : 0.1);
      if (where === "run") {
        // The spine's .chk fill moved from 90ms linear to --dur-2 (150ms) with this task.
        expect(await first(".chk i"), ".chk transition-duration").toBe(quiet ? 0 : 0.15);
      }
    });
  });
}

test("two marks in a row leave one toast, the first marked, and Undo takes back only the second (AC-1)", async ({ page }, testInfo) => {
  await freeze(page);
  await open(page, "run");
  await stopTime(page);
  const button = primary(page, "run");

  await button.click();
  await page.clock.runFor(1400);
  await expect(page.locator(".toast")).toHaveCount(1);
  await expect(page.locator(".toast-label")).toHaveText(`#${NEXT} read`);

  await expect(button).toHaveText(`Mark #${NEXT + 1} read`);
  await button.click();
  await page.clock.runFor(200);
  await expect(page.locator(".toast")).toHaveCount(1);
  await expect(page.locator(".toast-label")).toHaveText(`#${NEXT + 1} read`);
  await screenshot(page, testInfo, "toast-after-two-marks");

  // The toast clears the primary verb (AC-1, at 360px and wherever the bar is).
  const toast = (await page.locator(".toast").boundingBox())!;
  const verb = (await button.boundingBox())!;
  const apart = toast.y + toast.height <= verb.y || verb.y + verb.height <= toast.y
    || toast.x + toast.width <= verb.x || verb.x + verb.width <= toast.x;
  expect(apart, `toast ${JSON.stringify(toast)} vs verb ${JSON.stringify(verb)}`).toBe(true);

  await page.locator(".toast-undo").click();
  await expect.poll(() => readHere()).toEqual([1, 2, 3, NEXT]);
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("a failed write reverts the verb at once and raises That didn't save with Retry (AC-1, R1-07)", async ({ page }, testInfo) => {
  await open(page, "run");
  await page.route("**/api/progress/issue", (route) => route.fulfill({ status: 500, body: "{}" }));
  await primary(page, "run").click();
  await expect(page.locator(".toast-label")).toHaveText("That didn't save");
  await expect(page.locator(".toast-undo")).toHaveText("Retry");
  // The verb never stays green over a failure.
  await expect(primary(page, "run")).toHaveAttribute("data-state", "idle");
  await expect(primary(page, "run")).toHaveText(`Mark #${NEXT} read`);
  await screenshot(page, testInfo, "mark-failed");
  expect(await readHere()).toEqual([1, 2, 3]);
});

test("the toast: pinned above the bar, a 12px rise, a 2px brand countdown over 8s, held on hover (AC-4)", async ({ page }, testInfo) => {
  await open(page, "run");
  await primary(page, "run").click();
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible();
  const quiet = await reduced(page);

  const region = await page.locator(".toast-region").evaluate((el) => {
    const cs = getComputedStyle(el);
    const probe = document.createElement("i");
    probe.style.cssText = "position:absolute;height:var(--actionbar-h)";
    document.body.append(probe);
    const bar = probe.getBoundingClientRect().height;
    probe.remove();
    return { bottom: parseFloat(cs.bottom), bar };
  });
  expect(region.bottom, "bottom = --actionbar-h + 8px + safe area").toBe(region.bar + 8);
  // And that is clear of the bar as drawn, not just of a variable: the bar's top edge is ~8px under the toast's foot.
  const barTop = (await page.locator(".actionbar").boundingBox())!.y;
  const toastFoot = (await toast.boundingBox())!;
  await expect.poll(async () => barTop - ((await toast.boundingBox())!.y + toastFoot.height), { message: "gap above the bar" })
    .toBeGreaterThanOrEqual(6);

  const motion = await toast.evaluate((el) => {
    const bar = el.querySelector(".toast-count")!;
    const cs = getComputedStyle(bar);
    return {
      enter: getComputedStyle(el).animationDuration, name: getComputedStyle(el).animationName,
      countDuration: cs.animationDuration, height: cs.height, background: cs.backgroundColor,
    };
  });
  const brand = await tokenColour(page, "--brand");
  expect(motion.height).toBe("2px");
  expect(motion.background).toBe(brand);
  if (quiet) {
    expect(motion.enter).toBe("0s");
  } else {
    expect(motion.name).toBe("toast-enter");
    expect(motion.enter).toBe("0.3s");
    expect(motion.countDuration).toBe("8s");
    // Held while the pointer is over it.
    await toast.hover();
    await expect(toast).toHaveAttribute("data-held", "true");
    await expect(toast.locator(".toast-count")).toHaveCSS("animation-play-state", "paused");
    await page.mouse.move(0, 0);
    await expect(toast).not.toHaveAttribute("data-held", "");
  }
  await screenshot(page, testInfo, "toast");
});

test("the bar and the toast respect the safe area in the stylesheet itself (AC-4, F2)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await page.goto(RUN);
  // A test browser has no inset to emulate, so read the rules it would apply to one.
  const rules = await page.evaluate(() => {
    const found: Record<string, string> = {};
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules) {
        if (!(rule instanceof CSSStyleRule)) continue;
        if (rule.selectorText === ".actionbar.thumb") found.bar = rule.style.getPropertyValue("padding");
        if (rule.selectorText === ".toast-region") found.toast = rule.style.getPropertyValue("bottom");
      }
    }
    return found;
  });
  expect(rules.bar).toMatch(/max\(\s*12px,\s*env\(safe-area-inset-bottom/);
  expect(rules.toast).toMatch(/var\(--actionbar-h\)\s*\+\s*8px\s*\+\s*env\(safe-area-inset-bottom/);
});

test("on a dashboard the toast clears the primary verb too, wherever the bar is drawn (AC-1)", async ({ page }) => {
  await open(page, "dash");
  test.skip(wide(page), "from 1024px a dashboard has no bar to clear");
  await primary(page, "dash").click();
  await expect(page.locator(".toast")).toBeVisible();
  await toastSettled(page);
  const toast = (await page.locator(".toast").boundingBox())!;
  const verb = (await primary(page, "dash").boundingBox())!;
  expect(toast.y + toast.height, "the toast ends above the verb").toBeLessThanOrEqual(verb.y);
});

test("Undo hands focus back to the bar's verb, not to the page (AC-4)", async ({ page }) => {
  await open(page, "run");
  await primary(page, "run").click();
  const undo = page.locator(".toast-undo");
  await expect(undo).toBeVisible();
  await undo.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect(page.locator(".actionbar .btn").first()).toBeFocused();
});

test("a dashboard's toast at 1280px is centred on the content box, 24px above the viewport's edge (AC-1)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page, "dash");
  await primary(page, "dash").click();
  const toast = page.locator(".toast");
  await expect(toast).toBeVisible();
  // Let the 12px rise finish before measuring.
  await expect(toast).toHaveCSS("animation-name", "toast-enter");
  await page.waitForTimeout(400);
  const t = (await toast.boundingBox())!;
  const content = (await page.locator(".content").boundingBox())!;
  expect(800 - (t.y + t.height)).toBe(24);
  expect(Math.abs(t.x + t.width / 2 - (content.x + content.width / 2))).toBeLessThanOrEqual(1);
});

test("at 834px every dashboard draws the bar with the primary in the bottom 96px, and so does the run detail (AC-1)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await page.setViewportSize({ width: 834, height: 1112 });
  for (const path of ["/comics", "/watch", RUN]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".actionbar")).toBeVisible();
    const first = (await page.locator(".actionbar .btn").first().boundingBox())!;
    expect(first.y, path).toBeGreaterThanOrEqual(1112 - 96);
    expect(first.height, path).toBe(48);
  }
});

test("at 1280px no dashboard draws the bar and the header holds the primary; the run detail keeps the bar (AC-1, AC-2)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ["/comics", "/watch"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".actionbar")).toBeHidden();
    const header = await page.locator(".pagehead").boundingBox();
    const verb = page.locator(".headverbs .btn:not(.sec)");
    await expect(verb).toBeVisible();
    // The verbs sit in the header band, which is --bar-h (80px) tall and sticky.
    expect(header!.height).toBe(80);
    const verbBox = (await verb.boundingBox())!;
    expect(verbBox.y).toBeGreaterThanOrEqual(header!.y);
    expect(verbBox.y + verbBox.height).toBeLessThanOrEqual(header!.y + header!.height);
  }
  await page.goto(RUN);
  await expect(page.locator(".actionbar")).toBeVisible();
  // Glass across the content area, its buttons held to the 720px column and 48px tall.
  const bar = page.locator(".actionbar .mark");
  const box = (await bar.boundingBox())!;
  expect(box.height).toBe(48);
  const row = await page.locator(".actionbar").evaluate((el) => {
    const kids = [...el.children].map((c) => c.getBoundingClientRect());
    return { left: kids[0].left, right: kids.at(-1)!.right };
  });
  expect(row.right - row.left).toBeLessThanOrEqual(720);
});

test("at 1100px a truncated primary keeps its full label as its accessible name (AC-1)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await db((sql) => markRead(sql, E2E_USER, E2E_LONG_RUN_ID, "e2e-long-2"));
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.goto("/comics");
  const full = `Mark ${E2E_LONG_LABEL} read`;
  const verb = page.getByRole("button", { name: full });
  await expect(verb).toBeVisible();
  const clipped = await verb.locator(".mark-label").evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(clipped, "the label is wider than the button, so it ends in an ellipsis").toBe(true);
  await expect(verb).toHaveAttribute("title", full);
});

test("on a run spanning two series the verb names the issue in full (AC-1, M-10)", async ({ page }) => {
  await page.goto(`/comics/${E2E_LONG_RUN_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const verb = page.locator(".actionbar .mark");
  await expect(verb).toHaveAttribute("aria-label", `Mark ${E2E_LONG_LABEL} read`);
  expect(E2E_LONG_LABEL).toContain("Amazing Spider-Man");
});

test("an empty dashboard is Search · Start {next} and nothing else (AC-2)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await db((sql) => sql`DELETE FROM issue_progress WHERE user_id = ${E2E_USER}`);
  try {
    await page.goto("/comics");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const names = await page.locator(".headverbs > *").evaluateAll((els) =>
      els.map((el) => el.getAttribute("aria-label") ?? el.textContent?.trim()));
    expect(names).toEqual(["Search (Ctrl K)", expect.stringMatching(/^Start /)]);
    expect(await page.locator(".actionbar > *").count()).toBe(2);
  } finally {
    await db(async (sql) => {
      for (let n = 1; n <= E2E_READ_COUNT; n++) await markRead(sql, E2E_USER, E2E_RUN_ID, `e2e-comic-${n}`);
    });
  }
});

test("the batch sheet marks the next N in one request, and its Log a session says why it waits (AC-3)", async ({ page }) => {
  await open(page, "dash");
  const requests: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/progress/") && r.method() === "POST") requests.push(r.url()); });
  await page.getByRole("button", { name: "+ batch" }).click();
  const sheet = page.getByRole("dialog", { name: "Batch" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Log" })).toHaveAttribute("aria-disabled", "true");
  await expect(sheet).toContainText("Sessions aren't here yet.");
  // Every control in the sheet is a 44px target, the stepper's included (the UX floor).
  for (const control of await sheet.locator("button").all()) {
    const box = (await control.boundingBox())!;
    expect(box.height, await control.innerText()).toBeGreaterThanOrEqual(44);
    expect(box.width, await control.innerText()).toBeGreaterThanOrEqual(44);
  }
  await expectNoHorizontalScroll(page);
  await sheet.getByRole("button", { name: "Fewer" }).click();
  await sheet.getByRole("button", { name: /^Mark \d+ read$/ }).click();
  await expect(sheet).toBeHidden();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toContain("/api/progress/range");
  // The stepper starts at five and was taken down one: #4 through #7.
  await expect.poll(() => readHere()).toEqual([1, 2, 3, 4, 5, 6, 7]);
});

test("Mark through… on the run detail opens the unread list, then the range sheet (AC-3)", async ({ page }) => {
  await open(page, "run");
  await page.getByRole("button", { name: "Mark through…" }).click();
  const sheet = page.getByRole("dialog", { name: "Mark through…" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".pick-row")).toHaveCount(E2E_ISSUE_COUNT - E2E_READ_COUNT);
  await sheet.locator(".pick-row").nth(1).click();
  await expect(page.getByRole("dialog", { name: "Mark 2 issues read" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// --- contrast, colour and axe (AC-1, AC-5) ---------------------------------

const PAGES = [["/comics", "dash"], ["/watch", "dash"], [RUN, "run"]] as const;

for (const [path, where] of PAGES) {
  test(`${path}: every text node is 4.5:1 and the unchecked ring 3:1, at rest, with a toast and with the batch sheet (AC-1)`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const found: string[] = [];
    const scan = async (state: string) => {
      for (const f of await contrastFailures(page)) found.push(`${state}: ${f}`);
    };
    await scan("at rest");
    if (path !== "/watch") {
      await hydrated(primary(page, where));
      await primary(page, where).click();
      await expect(page.locator(".toast")).toBeVisible();
      await toastSettled(page);
      await scan("toast");
      const batch = page.getByRole("button", { name: where === "run" ? "Mark through…" : "+ batch" });
      await batch.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await scan("sheet");
    }
    expect(found, `${testInfo.project.name} ${path}`).toEqual([]);
  });

  test(`${path}: axe finds no new violation (AC-5)`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoAxeViolations(page, [
      "button-name", "link-name", "nested-interactive", "aria-allowed-attr", "aria-valid-attr-value",
      "aria-hidden-focus", "aria-required-attr", "color-contrast",
    ]);
    await screenshot(page, testInfo, `thumb-axe${path.replaceAll("/", "-")}`);
  });
}

test("nothing on a dashboard resolves to --danger (AC-5)", async ({ page }) => {
  for (const path of ["/comics", "/watch"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const danger = await tokenColour(page, "--danger");
    const hits = await page.evaluate((red) => {
      const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor",
        "borderLeftColor", "outlineColor", "fill", "stroke"] as const;
      return [...document.body.querySelectorAll("*")].flatMap((el) => {
        const cs = getComputedStyle(el);
        const which = props.filter((p) => cs[p] === red);
        return which.length ? [`${el.tagName.toLowerCase()}.${el.className} ${which.join(",")}`] : [];
      });
    }, danger);
    expect(hits, path).toEqual([]);
  }
});

// The script must be able to fail: a pair it should flag, a pair it should pass, and a ring.
test("the contrast script flags a 3:1 pair and a faint ring, and passes 7:1 (AC-1)", async ({ page }) => {
  runsOnce(test.info().project.name);
  await page.goto("/watch");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const planted = async (html: string) => {
    await page.evaluate((markup) => {
      document.getElementById("planted")?.remove();
      const host = document.createElement("div");
      host.id = "planted";
      host.innerHTML = markup;
      document.body.append(host);
    }, html);
  };
  const before = (await contrastFailures(page)).length;
  expect(before, "the page itself is clean").toBe(0);

  await planted('<p style="color:#8c8c8c;background:#fff">faint text on white</p>');
  expect(await contrastFailures(page), "3.4:1 is flagged").toEqual([expect.stringContaining("faint text on white")]);

  await planted('<p style="color:#595959;background:#fff">dark text on white</p>');
  expect(await contrastFailures(page), "7:1 passes").toEqual([]);

  // The shape of M-02: white text on a fill that is too light for it.
  await planted('<p style="color:#fff;background:#9fe3fe">white on a pale fill</p>');
  expect(await contrastFailures(page), "#fff on a pale fill is flagged").toHaveLength(1);

  // The unchecked ring: one the colour of the page is 1:1 against it, in either theme.
  await planted('<div class="iss"><button class="chk"><i style="border:2px solid var(--page)"></i></button></div>');
  expect(await contrastFailures(page), "a faint ring is flagged").toEqual([expect.stringContaining("unchecked ring")]);
  await page.evaluate(() => document.getElementById("planted")?.remove());
  expect(await contrastFailures(page)).toEqual([]);
});
