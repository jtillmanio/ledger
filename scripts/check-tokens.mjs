// Colour-token checks (review M: M-01, M-02; decisions D-24, D-26).
// No database: runs anywhere, and is part of `npm run test:all`.
//
//   1. Every token in src/app/globals.css has the same value in design/mockups.html,
//      light and dark, and the prefers-color-scheme dark block equals [data-theme=dark];
//      every token in design/tokens.css is in globals.css with the same value.
//   2. No identity hue (--t*, --g*, --m-*) is within ΔE2000 15 of --ready, --blocked
//      or --danger, in either theme. Distance from --brand is printed, not enforced
//      (the 6.9 palette pass owns it).
//   3. Text on filled controls clears 4.5:1 in both themes (--on-* on its fill, the
//      toast's ink, second line and link on --toast-bg), and no app rule in globals.css
//      hard-codes #fff/#ffffff as a text colour.
//   4. The shipped hex reproduces the measured palette (D-40): every text-on-surface,
//      paired-fill and UI-boundary figure in design/handoff/contrast-metrics.json for
//      the adopted palette is within ±0.05 (±1.2% at high ratios) of what globals.css gives.
//   5. --art cannot break text (D-40, FP-D6): --ink, --ink-2 and --muted clear 4.5:1
//      on the clamp's extremes — dark oklch(.30 .06 h), light oklch(.92 .035 h) —
//      at every 30° of hue.
//   6. Explicit floors (task 1.8a, STYLE_GUIDE §4.1 and §6, D-31), each failure line
//      starting with its check: elevation (relative-luminance order, both themes),
//      text (the nine text tokens on the five surfaces), fill (the §6 paired fills),
//      outline (--faint-deco at 3:1), glass (worst-case composite, and no --ready text
//      on glass, SG-D12), and 11px (no font-size or font shorthand under 11px in
//      globals.css or the mockup's <style> block).
//
// `--globals <path>` and `--mockups <path>` aim the script at other copies of the two
// files (test/check-tokens.test.ts breaks a copy on purpose); the defaults are the app's.
import { readFileSync } from "node:fs";
import { parseCss, splitTop, styleBlocks } from "./lib/css-rules.mjs";

const MIN_DE = 15;
const MIN_TEXT = 4.5;
const failures = [];
const fail = (msg) => failures.push(msg);

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const globals = readFileSync(arg("--globals", "src/app/globals.css"), "utf8");
const mockups = readFileSync(arg("--mockups", "design/mockups.html"), "utf8");

const props = (body) =>
  Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const block = (text, re, label) => {
  const m = text.match(re);
  if (!m) throw new Error(`token block not found: ${label}`);
  return props(m[1]);
};

const g = {
  light: block(globals, /\n:root\{([^}]*)\}/, "globals :root"),
  dark: block(globals, /:root\[data-theme="dark"\]\{([^}]*)\}/, "globals [data-theme=dark]"),
};
const gMedia = block(globals, /:root:not\(\[data-theme="light"\]\)\{([^}]*)\}/, "globals prefers-color-scheme");
const mk = {
  light: block(mockups, /\n\.app\{([^}]*)\}/, "mockups .app"),
  dark: block(mockups, /\.app\[data-theme="dark"\]\{([^}]*)\}/, "mockups .app dark"),
};

// ---- 1. parity -------------------------------------------------------------
const ALIASES = new Set(["--paper", "--paper-sunk", "--mark", "--held", "--col", "--step"]);
for (const theme of ["light", "dark"]) {
  for (const [k, v] of Object.entries(g[theme])) {
    if (ALIASES.has(k)) continue;
    if (!(k in mk[theme])) fail(`${theme}: ${k} is in globals.css but not in mockups.html`);
    else if (mk[theme][k] !== v) fail(`${theme}: ${k} is ${v} in globals.css, ${mk[theme][k]} in mockups.html`);
  }
}
for (const [k, v] of Object.entries(g.dark)) {
  if (gMedia[k] !== v) fail(`dark: ${k} differs between the @media block (${gMedia[k]}) and [data-theme=dark] (${v})`);
}

// design/tokens.css is the source (D-31, D-40): every token it defines is in globals.css
// with the same value, so a design file that drops or changes one is caught here.
const design = readFileSync("design/tokens.css", "utf8");
const d = {
  light: block(design, /\n\.app,:root\{([^}]*)\}/, "tokens.css .app,:root"),
  dark: block(design, /\n\.app\[data-theme="dark"\]\{([^}]*)\}/, "tokens.css dark"),
};
for (const theme of ["light", "dark"]) {
  for (const [k, v] of Object.entries(d[theme])) {
    if (!(k in g[theme])) fail(`${theme}: ${k} is in design/tokens.css but not in globals.css`);
    else if (g[theme][k] !== v) fail(`${theme}: ${k} is ${v} in design/tokens.css, ${g[theme][k]} in globals.css`);
  }
}

// ---- colour maths ------------------------------------------------------------
const hex = (h) => {
  if (Array.isArray(h)) return h; // already sRGB channels in 0..1
  h = h.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (h) => {
  const [r, gg, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * gg + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const lab = (h) => {
  const [r, gg, b] = hex(h).map(lin);
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const X = f((0.4124 * r + 0.3576 * gg + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * gg + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * gg + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
const rad = (d) => (d * Math.PI) / 180;
function deltaE2000(x, y) {
  const [L1, a1, b1] = lab(x);
  const [L2, a2, b2] = lab(y);
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
  const h1 = ((Math.atan2(b1, a1p) * 180) / Math.PI + 360) % 360;
  const h2 = ((Math.atan2(b2, a2p) * 180) / Math.PI + 360) % 360;
  let dh = h2 - h1;
  if (C1 * C2 === 0) dh = 0;
  else if (dh > 180) dh -= 360;
  else if (dh < -180) dh += 360;
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2));
  const Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2;
  let hb = Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 + 360) / 2;
  if (C1 * C2 === 0) hb = h1 + h2;
  const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) +
    0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
  const dth = 30 * Math.exp(-(((hb - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(rad(2 * dth)) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// Resolve var(--x) against the mockup's merged tokens (dark inherits light).
const resolve = (tokens, v, depth = 0) => {
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if (!m || depth > 5) return v;
  return resolve(tokens, tokens[m[1]], depth + 1);
};

// ---- 2. identity hues vs state colours ----------------------------------------
for (const theme of ["light", "dark"]) {
  const tokens = theme === "light" ? mk.light : { ...mk.light, ...mk.dark };
  const identity = Object.keys(tokens).filter((k) => /^--(t\d|g\d|m-[\w]+)$/.test(k));
  for (const k of identity) {
    const v = resolve(tokens, tokens[k]);
    for (const state of ["--ready", "--blocked", "--danger"]) {
      const d = deltaE2000(v, tokens[state]);
      if (d < MIN_DE) fail(`${theme}: ${k} ${v} is ΔE ${d.toFixed(1)} from ${state} ${tokens[state]} (min ${MIN_DE})`);
    }
    const db = deltaE2000(v, tokens["--brand"]);
    if (db < MIN_DE) console.log(`  note (6.9): ${theme} ${k} ${v} is ΔE ${db.toFixed(1)} from --brand`);
  }
}

// ---- 3. text on fills ------------------------------------------------------------
const PAIRS = [
  ["--on-brand", "--brand"],
  ["--on-ready", "--ready"],
  ["--on-danger", "--danger"],
  ["--on-muted", "--muted"],
  ["--toast-ink", "--toast-bg"],
  ["--toast-muted", "--toast-bg"], // the toast's second line (STYLE_GUIDE §14.3)
  ["--toast-link", "--toast-bg"],
];
for (const theme of ["light", "dark"]) {
  const tokens = { ...g.light, ...(theme === "dark" ? g.dark : {}) };
  for (const [fg, bg] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) { fail(`${theme}: ${fg} or ${bg} missing from globals.css`); continue; }
    const c = contrast(tokens[fg], tokens[bg]);
    if (c < MIN_TEXT) fail(`${theme}: ${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} is ${c.toFixed(2)}:1 (min ${MIN_TEXT})`);
  }
}
const rules = globals.replace(/\/\*[\s\S]*?\*\//g, "").split("}").filter((r) => !/--[\w-]+\s*:/.test(r));
for (const r of rules) {
  if (/(^|[;{\s])color:\s*#fff(fff)?\b/i.test(r)) fail(`globals.css hard-codes a white text colour: ${r.trim().slice(0, 80)}…`);
}

// ---- 4. the measured palette ------------------------------------------------------
const PALETTE = "c"; // D-40: 1c After hours. 1a and 1b live in design/handoff/palette-swaps.css
// contrast-report.md measured the oklch sources; the app ships them rounded to 8-bit
// hex, which moves a high ratio by up to about 1% (dark ready on ready-soft: 8.76 vs
// 8.67). So the tolerance is ±0.05, widening to ±1.2% above about 4:1 — still far
// tighter than any real change of value, and exact where it matters, at the floor.
const tolerance = (want) => Math.max(0.05, want * 0.012);
const metrics = JSON.parse(readFileSync("design/handoff/contrast-metrics.json", "utf8")).R;
const SURFACES = ["--page", "--surface", "--raise", "--sunk", "--overlay"];
for (const theme of ["light", "dark"]) {
  const tokens = { ...g.light, ...(theme === "dark" ? g.dark : {}) };
  const m = metrics[PALETTE + theme];
  const expect = (label, fg, bg, want) => {
    const got = contrast(tokens[fg], tokens[bg]);
    if (Math.abs(got - want) > tolerance(want)) {
      fail(`${theme}: ${label} is ${got.toFixed(2)}:1, contrast-report.md measured ${want} (±${tolerance(want).toFixed(2)})`);
    }
  };
  // Glass worst case: --glass-bg composited in sRGB over black (light) or white (dark).
  const [r, gg, b, alpha] = tokens["--glass-bg"].match(/[\d.]+/g).map(Number);
  const under = theme === "light" ? 0 : 255;
  tokens["glass"] = [r, gg, b].map((c) => (alpha * c + (1 - alpha) * under) / 255);
  for (const [name, row] of Object.entries(m.T)) {
    if (name === "glass") {
      for (const [fg, want] of Object.entries(row)) expect(`--${fg} on glass`, `--${fg}`, "glass", want);
    } else {
      row.forEach((want, i) => expect(`--${name} on ${SURFACES[i]}`, `--${name}`, SURFACES[i], want));
    }
  }
  for (const [pair, want] of Object.entries(m.PR)) {
    const [fg, bg] = pair.split(" on ");
    expect(pair, `--${fg}`, `--${bg}`, want);
  }
  for (const [pair, want] of Object.entries(m.UI)) {
    const [fg, bg] = pair.replace(/\s*\(.*\)$/, "").split(" / ");
    expect(pair, `--${fg}`, `--${bg}`, want);
  }
}

// ---- 5. text on the --art clamp extremes ---------------------------------------------
// OKLCH → sRGB (Björn Ottosson's matrices), clipped to the gamut, as #rrggbb.
const oklchHex = (L, C, h) => {
  const a = C * Math.cos(rad(h)), b = C * Math.sin(rad(h));
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const enc = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return "#" + linear.map((c) => Math.round(Math.min(1, Math.max(0, enc(c))) * 255).toString(16).padStart(2, "0")).join("");
};
const ART = { dark: [0.3, 0.06], light: [0.92, 0.035] };
for (const theme of ["light", "dark"]) {
  const tokens = { ...g.light, ...(theme === "dark" ? g.dark : {}) };
  const [L, C] = ART[theme];
  for (let h = 0; h < 360; h += 30) {
    const art = oklchHex(L, C, h);
    for (const fg of ["--ink", "--ink-2", "--muted"]) {
      const c = contrast(tokens[fg], art);
      if (c < MIN_TEXT) fail(`${theme}: ${fg} ${tokens[fg]} on --art oklch(${L} ${C} ${h}) ${art} is ${c.toFixed(2)}:1 (min ${MIN_TEXT})`);
    }
  }
}

// ---- 6. explicit floors (task 1.8a) ----------------------------------------------------
const themeTokens = (theme) => ({ ...g.light, ...(theme === "dark" ? g.dark : {}) });
const ratio = (a, b) => contrast(a, b).toFixed(2);

// elevation: relative luminance order (STYLE_GUIDE §4.1; owner, 2026-10-19).
const ORDER = {
  light: [["--sunk"], ["--page"], ["--raise"], ["--surface", "--overlay"]], // overlay = surface
  dark: [["--sunk"], ["--page"], ["--surface"], ["--raise"], ["--overlay"]],
};
for (const theme of ["light", "dark"]) {
  const t = themeTokens(theme);
  const steps = ORDER[theme];
  const label = steps.map((s) => s.join(" = ")).join(" < ");
  for (let i = 1; i < steps.length; i++) {
    const [lo, hi] = [steps[i - 1][0], steps[i][0]];
    if (!(luminance(t[lo]) < luminance(t[hi]))) {
      fail(`elevation: ${theme} ${lo} ${t[lo]} (L ${luminance(t[lo]).toFixed(4)}) must be darker than ${hi} ${t[hi]} (L ${luminance(t[hi]).toFixed(4)}); order ${label}`);
    }
  }
  for (const [a, b] of steps.filter((s) => s.length > 1)) {
    if (Math.abs(luminance(t[a]) - luminance(t[b])) > 1e-6) fail(`elevation: ${theme} ${b} ${t[b]} must equal ${a} ${t[a]}`);
  }
}

// text: nine text tokens on the five surfaces, both themes, 4.5:1.
const TEXT = ["--ink", "--ink-2", "--muted", "--faint", "--brand", "--brand-ink", "--ready", "--blocked", "--danger"];
for (const theme of ["light", "dark"]) {
  const t = themeTokens(theme);
  for (const fg of TEXT) {
    for (const bg of SURFACES) {
      if (contrast(t[fg], t[bg]) < MIN_TEXT) fail(`text: ${theme} ${fg} ${t[fg]} on ${bg} ${t[bg]} is ${ratio(t[fg], t[bg])}:1 (min ${MIN_TEXT})`);
    }
  }
}

// fill: the STYLE_GUIDE §6 paired fills, 4.5:1.
const FILLS = [
  ["--ready", "--ready-soft"], ["--blocked", "--blocked-soft"], ["--danger", "--danger-soft"],
  ["--brand-ink", "--brand-soft"], ["--page", "--ink"], ["--muted", "--sunk"],
  ["--on-brand", "--brand"], ["--on-ready", "--ready"],
  ["--toast-ink", "--toast-bg"], ["--toast-muted", "--toast-bg"], ["--toast-link", "--toast-bg"],
];
for (const theme of ["light", "dark"]) {
  const t = themeTokens(theme);
  for (const [fg, bg] of FILLS) {
    if (contrast(t[fg], t[bg]) < MIN_TEXT) fail(`fill: ${theme} ${fg} on ${bg} is ${ratio(t[fg], t[bg])}:1 (min ${MIN_TEXT})`);
  }
}

// outline: --faint-deco outlines controls (WCAG 1.4.11, SG-D8), 3:1.
for (const theme of ["light", "dark"]) {
  const t = themeTokens(theme);
  for (const bg of ["--surface", "--raise", "--overlay"]) {
    if (contrast(t["--faint-deco"], t[bg]) < 3) fail(`outline: ${theme} --faint-deco ${t["--faint-deco"]} on ${bg} ${t[bg]} is ${ratio(t["--faint-deco"], t[bg])}:1 (min 3)`);
  }
}

// glass: --glass-bg at its own alpha over #000 (light) or #fff (dark), the worst case.
for (const theme of ["light", "dark"]) {
  const t = themeTokens(theme);
  const [r, gg, b, alpha] = t["--glass-bg"].match(/[\d.]+/g).map(Number);
  const under = theme === "light" ? 0 : 255;
  const glass = [r, gg, b].map((c) => (alpha * c + (1 - alpha) * under) / 255);
  for (const fg of ["--ink", "--ink-2", "--muted", "--brand"]) {
    if (contrast(t[fg], glass) < MIN_TEXT) fail(`glass: ${theme} ${fg} ${t[fg]} on glass is ${ratio(t[fg], glass)}:1 (min ${MIN_TEXT}, ${t["--glass-bg"]} over ${theme === "light" ? "#000" : "#fff"})`);
  }
}

const globalsRules = parseCss(globals);
const mockupRules = parseCss(styleBlocks(mockups));
const RULE_SETS = [["globals.css", globalsRules], ["mockups.html", mockupRules]];

// glass: no --ready text on glass (SG-D12). A glass surface is a rule whose background
// is --glass-bg; the rule itself and anything beneath its selector must not set
// color:var(--ready).
for (const [label, rs] of RULE_SETS) {
  const onGlassBg = (r) => ["background", "background-color"].some((p) => (r.decls[p] ?? "").includes("var(--glass-bg)"));
  const glassSelectors = rs.filter(onGlassBg).flatMap((r) => r.selectors);
  for (const r of rs) {
    if (!/var\(--ready\)/.test(r.decls.color ?? "")) continue;
    for (const sel of r.selectors) {
      const beneath = glassSelectors.some((gs) => sel === gs || sel.startsWith(gs + " ") || sel.startsWith(gs + ">"));
      if (onGlassBg(r) || beneath) fail(`glass: ${label} ${sel} sets color:var(--ready) on a --glass-bg surface (SG-D12)`);
    }
  }
}

// 11px: nothing under 11px, font shorthands included (UX-X01). A label too long for
// its box is truncated, never shrunk.
const KEYWORD = /^(inherit|initial|unset|revert)$/;
const fsTokens = Object.fromEntries(
  Object.entries(g.light).filter(([k]) => k.startsWith("--fs-")).map(([k, v]) => [k, v.split("/")[0].trim()]),
);
const sizePx = (v) => {
  let m;
  if ((m = /^(-?[\d.]+)px$/.exec(v))) return Number(m[1]);
  if ((m = /^(-?[\d.]+)rem$/.exec(v))) return Number(m[1]) * 16;
  if ((m = /^var\((--fs-[\w-]+)\)$/.exec(v)) && fsTokens[m[1]]) return sizePx(fsTokens[m[1]]);
  return null; // em, %, calc(), other keywords: not resolvable from a stylesheet alone
};
const SIZE = /^(-?[\d.]+(?:px|rem|em|%)|var\(--fs-[\w-]+\))(?:\/\S+)?$/;
const fontSizes = (r) => {
  const out = [];
  const bare = (v) => v.replace(/\s*!important$/, "").trim();
  if (r.decls["font-size"] !== undefined) out.push(["font-size", bare(r.decls["font-size"])]);
  const f = r.decls.font === undefined ? "" : bare(r.decls.font);
  if (f && !KEYWORD.test(f)) {
    const tok = splitTop(f.replace(/\s+/g, ","), ",").find((t) => SIZE.test(t));
    if (tok) out.push(["font", tok.split("/")[0]]);
  }
  return out;
};
for (const [label, rs] of RULE_SETS) {
  for (const r of rs) {
    for (const [prop, raw] of fontSizes(r)) {
      if (KEYWORD.test(raw)) continue;
      const px = sizePx(raw);
      const sel = r.selectors.join(", ");
      if (px === null) fail(`11px: ${label} ${sel} ${prop} ${raw} is unresolvable (use px, rem or var(--fs-*))`);
      else if (px < 11) fail(`11px: ${label} ${sel} ${prop} ${raw} is ${px}px (min 11px)`);
    }
  }
}

if (failures.length) {
  console.error(`test:tokens — ${failures.length} failure(s):\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log("test:tokens — parity, identity-hue distance, on-fill contrast, the measured palette, the --art clamp, the elevation, text, fill, outline and glass floors and the 11px floor all pass");
