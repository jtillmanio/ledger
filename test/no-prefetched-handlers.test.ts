// Task 0.9: next/link prefetches its href, and a prefetch of a route handler
// runs the handler. The nav's <Link href="/api/export"> built the whole export
// JSON on every page view. A link to anything under /api/ is a plain <a>.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
}

describe("no <Link> to a route handler (task 0.9)", () => {
  it("no file under src/ renders <Link href=\"/api/...\">", () => {
    const offenders = sources("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/<Link\b[^>]*?href=\{?\s*["'`]\/api\//g)]
        .map((m) => `${file}: ${m[0]}`));
    expect(offenders).toEqual([]);
  });
});
