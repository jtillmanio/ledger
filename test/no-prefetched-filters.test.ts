// Next 16.4 prefetches each query-string variant of a link on its own, so
// /comics fetched every track chip on load: 70 requests against a budget of
// 35, and /books 43 against 29 (docs/02-architecture.md, Performance budget;
// Dependabot PR #82). A filter link re-renders the route already on screen,
// so a <Link> whose href carries a query string is not prefetched.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
}

// The opening tag of each <Link>, attributes and all; an href built by a
// helper is named here because the source does not show its query string.
const LINK = /<Link\b[^>]*?>/g;
const QUERY_HREF = /href=\{?\s*(["'`][^"'`]*\?|seriesAllHref\()/;

describe("no prefetched query-string <Link> (Dependabot PR #82)", () => {
  it("every <Link> to a query string under src/ has prefetch={false}", () => {
    const offenders = sources("src").flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(LINK)]
        .filter((m) => QUERY_HREF.test(m[0]) && !m[0].includes("prefetch={false}"))
        .map((m) => `${file}: ${m[0].replace(/\s+/g, " ")}`));
    expect(offenders).toEqual([]);
  });
});
