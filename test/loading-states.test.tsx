// Task 0.9: a navigation paints a skeleton at once instead of holding the old
// screen until every query answers (a cold Neon wake took up to 10 s). Each
// data route has a loading.tsx, so the router can prefetch its shell; the
// skeleton is busy for assistive tech and announces itself once.
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const routes: [string, string][] = [
  ["/comics", "../src/app/comics/(list)/loading"],
  ["/comics/[runId]", "../src/app/comics/[runId]/loading"],
  ["/books", "../src/app/books/loading"],
  ["/inbox", "../src/app/inbox/loading"],
];

describe("loading states (task 0.9)", () => {
  it.each(routes)("%s paints a busy skeleton", async (_route, path) => {
    const Loading = (await import(path)).default as () => React.ReactElement;
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toMatch(/^<main aria-busy="true">/);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain(">Loading<");
    expect(html.match(/class="sk[ "]/g)?.length ?? 0).toBeGreaterThan(5);
  });

  it("the run list's skeleton never stands in front of a run page", () => {
    // A loading.tsx at app/comics/ would wrap [runId] too and be the first
    // boundary the router meets, so a run would open on the list's skeleton.
    expect(existsSync("src/app/comics/loading.tsx")).toBe(false);
  });
});
