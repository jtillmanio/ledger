// Measures one deployment (task 0.10): Lighthouse on every route in routes.mjs,
// then 0.9's tap → next-paint runner on the same profile. Run after login.mjs.
//
//   TARGET_URL=… HEADERS_DIR=… OUT_DIR=… CHROME_PATH=… APP_PASSCODE=… node scripts/perf/measure.mjs
//   optional: RUNS (default 3), PERF_ROUTES=comics,books (a subset, for a local try)
//
// Writes OUT_DIR/reports/<route>-<n>.json and .html (Lighthouse's reports,
// scrubbed of every header and secret) and OUT_DIR/metrics.json (numbers only:
// what report.mjs gates and compares). Lighthouse's raw output, which carries
// the headers it was given, goes to HEADERS_DIR and is deleted once read.
// A route that fails to measure is recorded, not thrown: report.mjs fails on it.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { ReportGenerator } from "lighthouse/report/generator/report-generator.js";
import { apiPath, CPU_SLOWDOWN, NETWORK, scrubLhr, summariseLhr } from "./lib/perf.mjs";
import { ROUTES } from "./routes.mjs";

const env = process.env;
for (const k of ["TARGET_URL", "HEADERS_DIR", "OUT_DIR", "CHROME_PATH", "APP_PASSCODE"]) {
  if (!env[k]) {
    console.error(`measure: ${k} is required`);
    process.exit(1);
  }
}
const base = new URL(env.TARGET_URL).origin;
const RUNS = Number(env.RUNS ?? 3);
const only = env.PERF_ROUTES?.split(",");
const routes = ROUTES.filter((r) => !only || only.includes(r.id));

const headerFile = (signedIn) => join(env.HEADERS_DIR, signedIn ? "signed-in.json" : "signed-out.json");
const signedInHeaders = JSON.parse(readFileSync(headerFile(true), "utf8"));
const { Cookie: cookie, ...vercelHeaders } = signedInHeaders;
const secrets = [env.APP_PASSCODE, env.VERCEL_AUTOMATION_BYPASS_SECRET, vercelHeaders["x-vercel-protection-bypass"],
  cookie, cookie.slice("rt_session=".length)];
const scrub = (text) => scrubLhr({ text: String(text) }, secrets).text;

const reports = join(env.OUT_DIR, "reports");
const raw = join(env.HEADERS_DIR, "raw");
mkdirSync(reports, { recursive: true });
mkdirSync(raw, { recursive: true });

// Actions' Ubuntu image restricts the user namespaces Chrome's sandbox needs.
// It only ever opens this app's own deployment.
const chromeFlags = ["--headless=new", ...(env.CI === "true" ? ["--no-sandbox"] : [])];
const lighthouseCli = fileURLToPath(new URL("./node_modules/lighthouse/cli/index.js", import.meta.url));
const lighthouseVersion = JSON.parse(readFileSync(new URL("./node_modules/lighthouse/package.json", import.meta.url), "utf8")).version;

/** One Lighthouse load: mobile, devtools throttling (Slow 4G, 4× CPU), performance and accessibility. */
function lighthouse(route, n) {
  const name = `${route.id}-${n}`;
  const rawPath = join(raw, `${name}.json`);
  const r = spawnSync(process.execPath, [
    lighthouseCli, base + route.path,
    "--form-factor=mobile", "--throttling-method=devtools", "--only-categories=performance,accessibility",
    `--extra-headers=${headerFile(route.signedIn)}`, "--output=json", `--output-path=${rawPath}`,
    "--disable-full-page-screenshot", "--quiet", `--chrome-flags=${chromeFlags.join(" ")}`,
  ], { encoding: "utf8", env: { ...env, CHROME_PATH: env.CHROME_PATH }, timeout: 5 * 60_000 });
  if (r.status !== 0) {
    const why = (r.stderr || r.error?.message || "").trim().split("\n").slice(-1)[0];
    return { error: scrub(`Lighthouse exited ${r.status ?? r.signal}: ${why}`).slice(0, 300) };
  }
  const lhr = scrubLhr(JSON.parse(readFileSync(rawPath, "utf8")), secrets);
  rmSync(rawPath);
  writeFileSync(join(reports, `${name}.json`), JSON.stringify(lhr));
  writeFileSync(join(reports, `${name}.html`), ReportGenerator.generateReportHtml(lhr));
  if (lhr.runtimeError) return { error: `Lighthouse: ${lhr.runtimeError.code}` };
  return summariseLhr(lhr);
}

/** A fresh, throttled phone tab in its own cookie jar, recording every route handler it asks for. */
async function phoneTab(browser, signedIn, api) {
  const context = await browser.createBrowserContext();
  if (signedIn) {
    await context.setCookie({
      name: "rt_session", value: cookie.slice("rt_session=".length), domain: new URL(base).hostname,
      path: "/", secure: true, httpOnly: true,
    });
  }
  const page = await context.newPage();
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
  await page.setUserAgent(
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
  await page.setExtraHTTPHeaders(vercelHeaders);
  await page.emulateNetworkConditions(NETWORK);
  await page.emulateCPUThrottling(CPU_SLOWDOWN);
  page.on("request", (q) => {
    const path = apiPath(q.url());
    // The sign-in tap posts its form to /api/login on purpose; that is not a prefetch.
    if (path && !(q.method() === "POST" && path === "/api/login")) api.add(path);
  });
  return { context, page };
}

/** In the page: click, then wait for the <h1> to change and two frames to pass (the paint). */
async function clientTap(page, selector) {
  return page.evaluate(async (sel) => {
    const link = document.querySelector(sel);
    if (!link) return { error: `no ${sel} on the page` };
    const before = document.querySelector("h1")?.textContent;
    const t0 = performance.now();
    link.click();
    const painted = await new Promise((resolve) => {
      const giveUp = setTimeout(() => resolve(false), 60_000);
      const tick = () => {
        const h = document.querySelector("h1")?.textContent;
        if (h && h !== before) {
          clearTimeout(giveUp);
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
        } else requestAnimationFrame(tick);
      };
      tick();
    });
    if (!painted) return { error: `tapping ${sel} painted no new page in 60 s` };
    const t1 = performance.now();
    const rsc = performance.getEntriesByType("resource")
      .filter((e) => e.name.includes("_rsc=") && e.startTime >= t0 - 1 && new URL(e.name).pathname === location.pathname);
    return { ms: Math.round(t1 - t0), rscBytes: rsc.at(-1)?.transferSize ?? null };
  }, selector);
}

/** Sign-in: type the passcode, submit, and time it until the home page's <h1> is painted. */
async function loginTap(page) {
  await page.type('input[name="passcode"]', env.APP_PASSCODE);
  const t0 = Date.now();
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 120_000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForFunction(() => document.querySelector("h1"), { timeout: 120_000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const at = new URL(page.url()).pathname;
  if (at === "/login") return { error: "sign-in tap stayed on /login: the passcode did not match" };
  return { ms: Date.now() - t0 };
}

/** The tap pair, RUNS times, each from a freshly loaded source page with its prefetches done. */
async function taps(browser, route) {
  const results = [];
  const api = new Set();
  for (let n = 1; n <= RUNS; n++) {
    const { context, page } = await phoneTab(browser, !route.tap.login, api);
    try {
      await page.goto(base + route.tap.from, { waitUntil: "networkidle0", timeout: 120_000 });
      const at = new URL(page.url()).pathname;
      if (at !== route.tap.from) {
        results.push({ error: `the tap's page ${route.tap.from} landed on ${at}` });
        continue;
      }
      results.push(route.tap.login ? await loginTap(page) : await clientTap(page, route.tap.selector));
    } catch (e) {
      results.push({ error: scrub(e.message).slice(0, 300) });
    } finally {
      await context.close();
    }
  }
  return { taps: results, tapApiRequests: [...api] };
}

const browser = await puppeteer.launch({ executablePath: env.CHROME_PATH, headless: true, args: chromeFlags.slice(1) });
const metrics = {
  url: base, sha: env.SHA ?? null, lighthouse: lighthouseVersion, chrome: await browser.version(),
  measuredAt: new Date().toISOString(), runs: RUNS, routes: {},
};
try {
  for (const route of routes) {
    const loads = [];
    for (let n = 1; n <= RUNS; n++) loads.push(lighthouse(route, n));
    const tapped = await taps(browser, route);
    metrics.routes[route.id] = { path: route.path, loads, ...tapped };
    const ok = loads.filter((l) => !l.error).length;
    const tapsOk = tapped.taps.filter((t) => !t.error).length;
    console.log(`measure: ${route.id} ${route.path}: ${ok}/${RUNS} loads, ${tapsOk}/${RUNS} taps`);
  }
} finally {
  await browser.close();
  rmSync(raw, { recursive: true, force: true });
}
writeFileSync(join(env.OUT_DIR, "metrics.json"), JSON.stringify(metrics, null, 2));
