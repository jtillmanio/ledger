// Regenerate design/feel/*.png from design/Ledger Feel Review.dc.html.
//
//   npm i --no-save playwright-core
//   node design/feel/capture.mjs            (CHROME=<path to chrome.exe or msedge.exe> to override)
//
// Every phone and tablet frame, palette 1c (D-40), dark and light, at 2x and at
// full length: the frame grows to its content, so no slot is hidden below a
// phone viewport. The page is served over HTTP because it loads its components
// at runtime, which Chrome blocks over file://.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readdirSync, rmSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const DESIGN = join(HERE, "..");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const SKIP = new Set(["diagnosis", "choose", "proposals", "tokens"]); // prose sections
const PORT = 4789;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

const server = http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    const body = await readFile(join(DESIGN, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ok) => server.listen(PORT, "127.0.0.1", ok));

for (const f of readdirSync(HERE)) if (f.endsWith(".png")) rmSync(join(HERE, f));

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${PORT}/Ledger%20Feel%20Review.dc.html`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2500);

await page.evaluate(() => {
  // In Chrome a fixed-height flex column shrinks its overflow:hidden children to
  // 0 (their min-height:auto resolves to 0), which hides the Now hero. Keep
  // every slot at its natural height.
  const css = document.createElement("style");
  css.textContent = 'figure main > *, figure [style*="overflow-y"] > * { flex-shrink: 0 !important; }';
  document.head.append(css);
  for (const fig of document.querySelectorAll("section[id] figure")) {
    // Palette 1c everywhere but the three-palette comparison (D-40).
    if (fig.closest("section#colour") === null)
      for (const el of fig.querySelectorAll("[data-pal]")) el.setAttribute("data-pal", "c");
    // Grow every scrolling region, and the fixed-height boxes around it.
    for (const el of fig.querySelectorAll("*")) {
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
        el.style.flex = "none";
        el.style.overflow = "visible";
        for (let p = el.parentElement; p && p !== fig; p = p.parentElement) if (p.style.height) p.style.height = "auto";
      }
    }
  }
});
await page.waitForTimeout(800);

const counters = {};
for (const fig of await page.$$("section[id] figure")) {
  const meta = await fig.evaluate((f) => ({
    sec: f.closest("section[id]").id,
    cap: (f.querySelector("figcaption")?.textContent ?? f.firstElementChild?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 70),
    h: Math.round(f.getBoundingClientRect().height),
  }));
  if (SKIP.has(meta.sec) || meta.h < 200) continue;
  if (meta.sec === "colour") {
    if (!meta.cap.startsWith("1c")) continue; // the comics dashboard, in the owner's palette only
    meta.sec = "comics";
  }
  counters[meta.sec] = (counters[meta.sec] ?? 0) + 1;
  const slug = meta.cap.replace(/^1c · /, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const name = `${meta.sec}-${String(counters[meta.sec]).padStart(2, "0")}-${slug || "frame"}.png`;
  await fig.screenshot({ path: join(HERE, name), animations: "disabled" });
  console.log(name);
}
await browser.close();
server.close();
