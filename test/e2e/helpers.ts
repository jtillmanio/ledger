// The shared helpers for browser checks (task 0.11, D-72). Every UI task's own
// e2e spec builds on these, so each proves its UX-floor checks the same way.
//
//   expectNoAxeViolations  axe over the page for the rules a check names
//   computedStyle          what the browser resolved, custom properties too
//   expectNoHorizontalScroll  the page is no wider than the viewport
//   screenshot             PR evidence under a gitignored folder, never a baseline
//   contrastFailures       4.5:1 text and 3:1 rings, as drawn
//
// The floor is checked in both themes in one run (D-161): in a test that no
// `@at-` tag pins to a project, expectNoAxeViolations (its color-contrast
// rule), contrastFailures and screenshot also switch the page to the other
// colour scheme in place, check it there and switch back. So no test needs a
// dark project of its own to prove dark; a pinned test picks its own themes.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Where each test runs (scripts/lib/e2e.mjs, D-161). Untagged: what a screen
// does, in five projects. FLOOR: how it fits or looks, at every layout. FEEL: a
// feel-pass surface's state screenshots, at every width (design §10).
export const FLOOR = { tag: "@floor" };
export const FEEL = { tag: "@feel" };
// The same, for a test whose assertions read the project's own prefers-reduced-motion:
// it also runs at w390-reduced-motion, which FLOOR and FEEL leave out (D-167).
export const FLOOR_MOTION = { tag: ["@floor", "@motion"] };
export const FEEL_MOTION = { tag: ["@feel", "@motion"] };

/**
 * Waits for every transition and animation that ends (a colour read
 * mid-transition is neither colour), but not for one that loops, and for no
 * more than 3s.
 */
async function settled(page: Page) {
  await page.evaluate(() => {
    const ending = document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
    const done = Promise.all(ending.map((a) => a.finished.catch(() => undefined)));
    return Promise.race([done, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  });
}

/**
 * The colour scheme the page follows when the running test checks both themes
 * in place, else null: outside a test, in a test an `@at-` tag pins to a
 * project, and on a page whose root sets `data-theme` (the media query no
 * longer decides its colours).
 */
async function otherTheme(page: Page): Promise<{ now: "light" | "dark"; other: "light" | "dark" } | null> {
  let tags: string[];
  try {
    tags = test.info().tags;
  } catch {
    return null;
  }
  if (tags.some((t) => t.startsWith("@at-"))) return null;
  const now = await page.evaluate(() =>
    document.documentElement.hasAttribute("data-theme") ? null : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  if (now === null) return null;
  return { now, other: now === "dark" ? "light" : "dark" };
}

const FREEZE = "e2e-theme-switch";

/** Turns every CSS transition off (or back on), then applies the styles now, before anything is read. */
async function freezeTransitions(page: Page, on: boolean) {
  await page.evaluate(([id, freeze]) => {
    if (freeze) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = "*, *::before, *::after { transition: none !important; }";
      document.head.append(style);
    } else {
      document.getElementById(id)?.remove();
    }
    document.getAnimations(); // flushes the pending style change
  }, [FREEZE, on] as const);
}

/**
 * Runs `check` with the page switched to its other colour scheme, then switches
 * back, so what the test reads next is its own theme. Transitions are off for
 * the switch both ways, so every colour lands at once: nothing is waited on,
 * and a toast's countdown (an animation, not a transition) runs on untouched.
 * Returns null, running nothing, when `otherTheme` says not to.
 */
export async function inOtherTheme<T>(page: Page, check: (scheme: "light" | "dark") => Promise<T>): Promise<T | null> {
  const theme = await otherTheme(page);
  if (theme === null) return null;
  await freezeTransitions(page, true);
  try {
    await page.emulateMedia({ colorScheme: theme.other });
    await page.evaluate(() => void document.getAnimations());
    return await check(theme.other);
  } finally {
    await page.emulateMedia({ colorScheme: theme.now });
    await page.evaluate(() => void document.getAnimations());
    await freezeTransitions(page, false);
  }
}

// The one run test/e2e/global-setup.ts seeds, for specs to load.
export const E2E_RUN_ID = "e2e-run";
export const E2E_RUN_TITLE = "E2E Run";
export const E2E_ISSUE_COUNT = 12;
export const E2E_READ_COUNT = 3;
// A run whose Resume label is long, so the run page's action row is checked where it is tightest.
export const E2E_LONG_RUN_ID = "e2e-long-run";
export const E2E_LONG_LABEL = "The Amazing Spider-Man: Renew Your Vows Annual (2026) #112";
// Notes waiting in the inbox, for the shell's Inbox (N) to count.
export const E2E_INBOX_COUNT = 2;
// Books on /books/list, so its rows and their status controls are in the page a check reads (task 1.8d).
export const E2E_BOOK_COUNT = 2;
// One Unlisted book (task 1.21): off Everything, on its own chip, found by a search.
export const E2E_UNLISTED_ID = "e2e-unlisted";
export const E2E_UNLISTED_TITLE = "E2E Unlisted Book";
// Coming out (task 5.7): two of the Library's books with a release and no status. The first came out yesterday
// (Eastern), the second is due next month; the Unlisted book above has a release too and is never listed.
export const E2E_RELEASE_OUT_ID = "e2e-book-1";
export const E2E_RELEASE_OUT_TITLE = "E2E Book 1";
export const E2E_RELEASE_MONTH_ID = "e2e-book-2";
export const E2E_RELEASE_MONTH_TITLE = "E2E Book 2";

/**
 * Fails when axe finds a violation of any rule in `rules`, naming each rule and
 * the elements it hit. An empty list fails (axe would run every rule, or none),
 * and so does an id axe does not know: axe throws on it. `include` scopes the
 * run to one region: a fixed toast over a 360px page partly covers whatever
 * sits behind it, which target-size counts against those links, not the toast.
 * When `rules` holds `color-contrast`, that rule runs in the other theme too
 * (`inOtherTheme`); no other rule depends on the theme.
 */
export async function expectNoAxeViolations(page: Page, rules: string[], include?: string) {
  if (rules.length === 0) throw new Error("expectNoAxeViolations needs the rules the check names.");
  const run = async (ids: string[], theme: string) => {
    const builder = new AxeBuilder({ page }).withRules(ids);
    const results = await (include ? builder.include(include) : builder).analyze();
    return results.violations.map(
      (v) => `${theme}${v.id} (${v.impact ?? "n/a"}): ${v.help}\n` + v.nodes.map((n) => `    ${n.target.join(" ")}`).join("\n"),
    );
  };
  const lines = await run(rules, "");
  if (rules.includes("color-contrast")) lines.push(...((await inOtherTheme(page, (s) => run(["color-contrast"], `${s}: `))) ?? []));
  if (lines.length === 0) return;
  throw new Error(`axe found ${lines.length} violation(s) on ${page.url()}:\n${lines.join("\n")}`);
}

/** The resolved value of each property, by its CSS name: `background-color`, `--page`. */
export async function computedStyle(locator: Locator, props: string[]): Promise<Record<string, string>> {
  return locator.evaluate((el, names) => {
    const cs = getComputedStyle(el);
    return Object.fromEntries(names.map((p) => [p, cs.getPropertyValue(p).trim()]));
  }, props);
}

/** Fails when the page scrolls sideways: the root or the body is wider than the viewport. */
export async function expectNoHorizontalScroll(page: Page) {
  const m = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  if (m.root > m.viewport || m.body > m.viewport) {
    throw new Error(
      `horizontal scroll on ${page.url() || "the page"}: viewport ${m.viewport}px, root ${m.root}px, body ${m.body}px`,
    );
  }
}

/** Where screenshots go. Git ignores it, and Playwright empties it at the start of a run. */
export const SCREENS_DIR = resolve("test-results", "screens");

/**
 * Writes `test-results/screens/<project>/<name>.png`, the whole page; returns
 * the path. Where the test checks both themes in place, it also writes
 * `<name>.<other theme>.png` (`inOtherTheme`), so a light project's run leaves
 * the dark screenshot design §10 asks for.
 */
export async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const shoot = async (fileName: string) => {
    const file = resolve(SCREENS_DIR, testInfo.project.name, fileName);
    mkdirSync(dirname(file), { recursive: true });
    // next dev draws its own badge in a corner; it is not the app.
    await page.screenshot({ path: file, fullPage: true, style: "nextjs-portal { display: none !important; }" });
    return file;
  };
  const file = await shoot(`${name}.png`);
  await inOtherTheme(page, (scheme) => shoot(`${name}.${scheme}.png`));
  return file;
}

/** Waits until React has attached its handlers to `locator`: a click before then does nothing. */
export async function hydrated(locator: Locator) {
  await locator.waitFor();
  await expect.poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps")))).toBe(true);
}

/** What a token resolves to as a colour, in the page's own theme: custom properties compare as strings, so draw one. */
export function tokenColour(page: Page, token: string) {
  return page.evaluate((t) => {
    const probe = document.createElement("i");
    probe.style.color = `var(${t})`;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, token);
}

/**
 * WCAG contrast of what the browser actually drew (task 1.8b, M-02): for every
 * rendered text node, its computed colour against the computed backgrounds
 * behind it (each ancestor's `background-color`, composited down from the page,
 * with `opacity` applied), at least 4.5:1 in whichever theme the page is in.
 * Not a list of token pairs: a literal `#fff` on `--brand` is 2.51:1 in dark
 * mode, and only the page knows which one it drew. Also the unchecked control
 * ring (`.chk i`), at 3:1 against its row (WCAG 1.4.11).
 *
 * Text in a disabled control (`:disabled` or `aria-disabled="true"`) is exempt:
 * WCAG 1.4.3 leaves inactive components out. Text on a background image or
 * gradient is not measured (none of the screens it runs on has one). Returns
 * one line per failure, empty when everything passes.
 *
 * It measures what the page settles on: it first waits for every transition
 * and animation that ends (a pressed chip read mid-transition is neither
 * colour), but not for one that loops, and for no more than 3s.
 *
 * Where the test checks both themes in place (`inOtherTheme`), it measures the
 * other theme too, each of its lines starting with that theme's name.
 */
export async function contrastFailures(page: Page): Promise<string[]> {
  await settled(page);
  const here = await measureContrast(page);
  const there = await inOtherTheme(page, async (scheme) => (await measureContrast(page)).map((line) => `${scheme}: ${line}`));
  return [...here, ...(there ?? [])];
}

function measureContrast(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    type Rgba = [number, number, number, number];
    const parsed = new Map<string, Rgba>();
    // Any CSS colour the browser can compute, as sRGB with alpha (0-1): drawn on a clear pixel and read back.
    function parse(css: string): Rgba {
      const hit = parsed.get(css);
      if (hit) return hit;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      const out: Rgba = a === 0 ? [0, 0, 0, 0] : [(r * 255) / a, (g * 255) / a, (b * 255) / a, a / 255];
      parsed.set(css, out);
      return out;
    }
    const over = (top: Rgba, under: [number, number, number]): [number, number, number] => [
      top[0] * top[3] + under[0] * (1 - top[3]),
      top[1] * top[3] + under[1] * (1 - top[3]),
      top[2] * top[3] + under[2] * (1 - top[3]),
    ];
    const lum = ([r, g, b]: [number, number, number]) => {
      const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const hex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
    const name = (el: Element) => {
      const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/).join(".")}` : "";
      return `${el.tagName.toLowerCase()}${cls}`;
    };

    // The page under everything: the root's own background, else the canvas default.
    const root = parse(getComputedStyle(document.documentElement).backgroundColor);
    const body = parse(getComputedStyle(document.body).backgroundColor);
    const page = over(body, over(root, [255, 255, 255]));

    /** The colour behind `el`'s content: every ancestor's background over the page, faded by their opacity. */
    function behind(el: Element): { bg: [number, number, number]; opacity: number } | null {
      const chain: Element[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n);
      let bg = page;
      let opacity = 1;
      for (const n of chain) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== "none") return null;
        opacity *= parseFloat(cs.opacity);
        bg = over(parse(cs.backgroundColor), bg);
      }
      return { bg, opacity };
    }

    const inactive = (el: Element) => el.closest('[aria-disabled="true"], :disabled') !== null;
    const failures: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el || el.closest("script, style, noscript, template")) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const box = range.getBoundingClientRect();
      if (box.width < 2 || box.height < 2) continue; // .sr-only and clipped text
      if (inactive(el)) continue;
      const seen = behind(el);
      if (!seen) continue;
      const ink = parse(getComputedStyle(el).color);
      // Text and its background fade together over the page.
      const bg = over([...seen.bg, seen.opacity] as Rgba, page);
      const fg = over([ink[0], ink[1], ink[2], ink[3] * seen.opacity], bg);
      const r = ratio(fg, bg);
      if (r < 4.5) failures.push(`${name(el)} "${text.slice(0, 40)}" ${r.toFixed(2)}:1 (${hex(fg)} on ${hex(bg)})`);
    }

    // The unchecked control's ring against the row it sits in.
    for (const ring of document.querySelectorAll<HTMLElement>(".iss:not([data-read='true']) .chk i")) {
      if (!ring.checkVisibility()) continue;
      const seen = behind(ring.parentElement!);
      if (!seen) continue;
      const edge = over(parse(getComputedStyle(ring).borderTopColor), seen.bg);
      const r = ratio(edge, seen.bg);
      if (r < 3) failures.push(`unchecked ring ${r.toFixed(2)}:1 (${hex(edge)} on ${hex(seen.bg)})`);
    }
    return failures;
  });
}

/** Waits for the toast's 12px rise to finish, so a measurement sees it at full opacity. */
export function toastSettled(page: Page) {
  return page.evaluate(() => Promise.all(document.getAnimations()
    .filter((a) => (a as CSSAnimation).animationName === "toast-enter").map((a) => a.finished)));
}
