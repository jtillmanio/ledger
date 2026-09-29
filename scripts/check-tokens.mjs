// Colour-token checks (review M: M-01, M-02; decisions D-24, D-26).
// No database: runs anywhere, and is part of `npm run test:all`.
//
//   1. Every token in src/app/globals.css has the same value in design/mockups.html,
//      light and dark, and the prefers-color-scheme dark block equals [data-theme=dark].
//   2. No identity hue (--t*, --g*, --m-*) is within ΔE2000 15 of --ready, --blocked
//      or --danger, in either theme. Distance from --brand is printed, not enforced
//      (the 6.9 palette pass owns it).
//   3. Text on filled controls clears 4.5:1 in both themes (--on-* on its fill, the
//      toast link on the toast), and no app rule in globals.css hard-codes #fff/#ffffff
//      as a text colour.
import { readFileSync } from "node:fs";

const MIN_DE = 15;
const MIN_TEXT = 4.5;
const failures = [];
const fail = (msg) => failures.push(msg);

const globals = readFileSync("src/app/globals.css", "utf8");
const mockups = readFileSync("design/mockups.html", "utf8");

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

// ---- colour maths ------------------------------------------------------------
const hex = (h) => {
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
  ["--toast-link", "--ink"], // .toast background is --ink
  ["--page", "--ink"], // .toast text
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

if (failures.length) {
  console.error(`test:tokens — ${failures.length} failure(s):\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log("test:tokens — parity, identity-hue distance and on-fill contrast all pass");
