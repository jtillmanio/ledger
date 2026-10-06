// D-40 (FP-D5): IBM Plex Sans, Plex Mono and Newsreader are self-hosted, because
// rendering makes no external request (CLAUDE.md: no page render calls an external
// API). The faces are @font-face rules in globals.css with relative URLs, which
// Next bundles into /_next/static/media — outside the passcode gate, so the login
// page gets them too. A public/ font would sit behind the gate.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globals = readFileSync("src/app/globals.css", "utf8");

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]);
}

describe("fonts are self-hosted (D-40)", () => {
  it("nothing under src/ loads a font, icon or script from another host", () => {
    const offenders = files("src")
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .flatMap((f) => {
        const text = readFileSync(f, "utf8");
        return [
          ...text.matchAll(/next\/font\/google|fonts\.googleapis|fonts\.gstatic|unpkg|lucide-static|\bcdn\b/g),
          ...text.matchAll(/url\(\s*["']?(https?:)?\/\//g),
        ].map((m) => `${f}: ${m[0]}`);
      });
    expect(offenders).toEqual([]);
  });

  it("every family the tokens name has a face, and every face's file is in src/app/fonts", () => {
    const faces = [...globals.matchAll(/@font-face\{font-family:"([^"]+)";font-style:(\w+);font-weight:([\d ]+);[^}]*?url\("\.\/fonts\/([^"]+)"\)/g)]
      .map(([, family, style, weight, file]) => ({ family, style, weight, file }));
    const has = (family: string, style: string, weight: string) =>
      faces.some((f) => f.family === family && f.style === style && f.weight === weight);
    for (const w of ["400", "500", "600", "700"]) expect(has("IBM Plex Sans", "normal", w), `Plex Sans ${w}`).toBe(true);
    for (const w of ["400", "500", "600"]) expect(has("IBM Plex Mono", "normal", w), `Plex Mono ${w}`).toBe(true);
    for (const s of ["normal", "italic"]) expect(has("Newsreader", s, "200 800"), `Newsreader ${s}`).toBe(true);
    for (const f of faces) expect(existsSync(join("src/app/fonts", f.file)), f.file).toBe(true);
    expect(globals).toMatch(/--sans:"IBM Plex Sans"/);
    expect(globals).toMatch(/--mono:"IBM Plex Mono"/);
    expect(globals).toMatch(/--display:"Newsreader"/);
  });

  it("each OFL font ships its licence", () => {
    for (const name of ["IBM-Plex-Sans", "IBM-Plex-Mono", "Newsreader"]) {
      expect(readFileSync(`src/app/fonts/OFL-${name}.txt`, "utf8")).toMatch(/SIL Open Font License, Version 1\.1/);
    }
  });

  it("the layout preloads Plex Sans 400 and 600, and nothing else", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    const preloaded = [...layout.matchAll(/new URL\("\.\/fonts\/([^"]+)"/g)].map((m) => m[1]).sort();
    expect(preloaded).toEqual(["ibm-plex-sans-latin-400-normal.woff2", "ibm-plex-sans-latin-600-normal.woff2"]);
  });
});
