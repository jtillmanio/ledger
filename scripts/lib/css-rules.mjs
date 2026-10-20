// A small CSS reader for the token checks and the control-state test (task 1.8a).
// It is not a full parser: it handles what globals.css and the mockup's <style>
// block contain (nested @media / @supports, plain rules, @font-face, @keyframes).
//
// parseCss(text) -> [{ selectors: string[], decls: { prop: value }, media: string[] }]
//   `media` holds the conditions of every enclosing @media / @supports, so a rule
//   inside `@media (hover:hover)` carries "(hover:hover)".

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// Split on `sep` outside parentheses, brackets and quotes.
export function splitTop(text, sep) {
  const parts = [];
  let depth = 0, quote = null, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === sep && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function parseDecls(body) {
  const decls = {};
  for (const d of splitTop(body, ";")) {
    const i = d.indexOf(":");
    if (i > 0) decls[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
  }
  return decls;
}

// Index of the `}` that closes the `{` at `open`.
function closeOf(text, open) {
  let depth = 0, quote = null;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  throw new Error("unbalanced braces in CSS");
}

function walk(text, media, out) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open < 0) break;
    const head = text.slice(i, open).trim();
    const close = closeOf(text, open);
    const body = text.slice(open + 1, close);
    if (/^@(media|supports)\b/i.test(head)) {
      walk(body, [...media, head.replace(/^@(media|supports)\s*/i, "")], out);
    } else if (/^@keyframes\b/i.test(head)) {
      out.push({ selectors: [head], decls: {}, media, keyframes: true, body });
    } else {
      out.push({ selectors: splitTop(head, ","), decls: parseDecls(body), media });
    }
    i = close + 1;
  }
}

export function parseCss(css) {
  const out = [];
  walk(stripComments(css), [], out);
  return out;
}

// Every `<style>` block's text in an HTML file, joined.
export const styleBlocks = (html) =>
  [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");

// A selector's compounds, split on combinators (space, >, +, ~) outside brackets
// and parentheses: ".a .b:hover" -> [".a", ".b:hover"]. The last one is the subject.
export function compounds(selector) {
  const out = [];
  let depth = 0, cur = "";
  for (const c of selector.trim()) {
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) {
      if (cur) out.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur) out.push(cur);
  return out;
}
