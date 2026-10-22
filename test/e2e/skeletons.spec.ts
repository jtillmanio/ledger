// Task 1.8d: a loading screen holds the layout it is about to show. At 360px
// each skeleton is measured against the loaded geometry, within 2px, and the
// shimmer stops under prefers-reduced-motion.
//
// Run rows are measured against the real /comics/runs. The telecard, plan rail
// and season rows have no loaded component yet (2.5b, 2.2b, 8.7), so they are
// measured against test/e2e/fixtures/*.html, the mockup's markup on globals.css;
// the task that builds each one re-measures. A skeleton is rendered to static
// markup and put into a signed-in page's <main>, so it gets the real CSS, fonts
// and width, and no navigation has to be caught mid-flight.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlanRailSkeleton, RunRowsSkeleton, SeasonRowsSkeleton, TelecardSkeleton,
} from "../../src/components/Skeleton";

const TOLERANCE = 2;
const render = <P extends object>(component: ComponentType<P>, props?: P) =>
  renderToStaticMarkup(createElement(component, props));
const fixture = (name: string) => readFileSync(join(__dirname, "fixtures", name), "utf8");

/**
 * Opens a signed-in page and waits until it has hydrated and streamed its
 * content (`ready` is a selector only that content has): swapping <main>
 * earlier is a hydration mismatch, or React puts the page back over the markup.
 */
async function open(page: Page, path: string, ready: string) {
  await page.goto(path);
  await page.locator(ready).first().waitFor();
  await page.waitForFunction(() => Boolean((window as { next?: { router?: unknown } }).next?.router));
}

/** Replaces the page's <main> content, so the markup is drawn by the app's own CSS. */
async function stage(page: Page, html: string) {
  await page.evaluate((h) => { document.querySelector("main")!.innerHTML = h; }, html);
}

type Box = { width: number; height: number };

/** The size of every element matching `selector`, in order. */
const boxes = (page: Page, selector: string): Promise<Box[]> =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    }));

function expectClose(skeleton: Box[], loaded: Box[], what: string) {
  expect(skeleton.length, `${what}: how many boxes (skeleton ${skeleton.length}, loaded ${loaded.length})`).toBe(loaded.length);
  skeleton.forEach((s, n) => {
    for (const side of ["width", "height"] as const) {
      expect(Math.abs(s[side] - loaded[n][side]),
        `${what} #${n + 1} ${side}: skeleton ${s[side]}px, loaded ${loaded[n][side]}px`).toBeLessThanOrEqual(TOLERANCE);
    }
  });
}

test.describe("at 360px", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "w390-light", "sets its own viewport: runs once, in w390-light");
    await page.setViewportSize({ width: 360, height: 780 });
  });

  test("the telecard skeleton is the telecard's size, its telescope box too (AC-1)", async ({ page }) => {
    await open(page, "/watch", ".slate");
    await stage(page, fixture("telecard.html"));
    const loaded = [...(await boxes(page, ".telecard")), ...(await boxes(page, ".telecard svg.tele"))];
    await stage(page, render(TelecardSkeleton));
    const skeleton = [...(await boxes(page, ".telecard")), ...(await boxes(page, ".telecard .sk-tele"))];
    expectClose(skeleton, loaded, "telecard");
  });

  test("the run rows skeleton is a run row's size (AC-1)", async ({ page }) => {
    await open(page, "/comics/runs", ".rows > .row .row-title");
    // The seed has no credits, so a loaded row's sub-line is empty; give it the line a real run has.
    await page.locator(".rows .row .row-sub:empty").evaluateAll((els) => {
      for (const el of els) el.textContent = "Chris Claremont · X-Men · 1975–91";
    });
    // A run with reads draws its meter under the row (10px more), which a skeleton cannot know.
    const loaded = (await boxes(page, ".rows > .row:has(.row-title):not(:has(.measure))")).slice(0, 1);
    expect(loaded.length, "the seed has a run with no reads").toBe(1);
    await stage(page, render(RunRowsSkeleton, { rows: 1 }));
    expectClose(await boxes(page, ".rows .row"), loaded, "run row");
  });

  test("the plan rail skeleton is the plan rail's size, its stacks too (AC-1)", async ({ page }) => {
    await open(page, "/watch", ".slate");
    await stage(page, fixture("plan-rail.html"));
    // Footers wrap differently with their text, so the rail's own box and each stack are what holds still.
    const loaded = [...(await boxes(page, ".planrail")), ...(await boxes(page, ".planrail .qstack"))];
    await stage(page, render(PlanRailSkeleton));
    const skeleton = [...(await boxes(page, ".planrail")), ...(await boxes(page, ".planrail .qstack"))];
    expectClose(skeleton, loaded, "plan rail");
  });

  test("the season rows skeleton is a season row's size, row for row (AC-1)", async ({ page }) => {
    await open(page, "/watch", ".slate");
    await stage(page, fixture("season-rows.html"));
    const loaded = [...(await boxes(page, ".group")), ...(await boxes(page, ".group .row"))];
    await stage(page, render(SeasonRowsSkeleton, { rows: 3 }));
    const skeleton = [...(await boxes(page, ".group")), ...(await boxes(page, ".group .row"))];
    expectClose(skeleton, loaded, "season rows");
  });
});

test.describe("the shimmer", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(!["w390-light", "w390-reduced-motion"].includes(testInfo.project.name),
      "two projects tell it apart: the shimmer runs in one and stops in the other");
  });

  test("runs normally and stops under prefers-reduced-motion (AC-1)", async ({ page }) => {
    await open(page, "/watch", ".slate");
    await stage(page, render(RunRowsSkeleton, { rows: 1 }));
    const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
    const names = await page.locator(".sk").evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names)).toEqual(new Set([reduced ? "none" : "sk-pulse"]));
  });
});
