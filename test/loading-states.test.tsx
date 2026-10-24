// Task 0.9: a navigation paints a skeleton at once instead of holding the old
// screen until every query answers (a cold Neon wake took up to 10 s). Each
// data route has a loading.tsx, so the router can prefetch its shell; the
// skeleton is busy for assistive tech and announces itself once.
import { existsSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

const routes: [string, string][] = [
  ["/comics", "../src/app/comics/(dash)/loading"],
  ["/comics/runs", "../src/app/comics/runs/loading"],
  ["/comics/[runId]", "../src/app/comics/[runId]/loading"],
  ["/comics/status", "../src/app/comics/status/loading"],
  ["/books/status", "../src/app/books/status/loading"],
  ["/books/list", "../src/app/books/list/loading"],
  ["/inbox", "../src/app/inbox/loading"],
  ["/watch", "../src/app/watch/loading"],
];

// What each dashboard route paints, by the piece's own markup (task 1.8d).
const pieces = {
  telecard: 'class="telecard sk-telecard"',
  runRows: 'class="row sk-row"',
  seasonRows: 'class="sk sk-cover"',
};
const holds: [string, string, string[], string[]][] = [
  ["/comics", "../src/app/comics/(dash)/loading", [pieces.telecard, pieces.runRows], [pieces.seasonRows]],
  ["/comics/runs", "../src/app/comics/runs/loading", [pieces.runRows], [pieces.telecard, pieces.seasonRows]],
  ["/books/list", "../src/app/books/list/loading", [pieces.runRows], [pieces.telecard, pieces.seasonRows]],
  ["/watch", "../src/app/watch/loading", [pieces.seasonRows], [pieces.telecard, pieces.runRows]],
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

  it.each(holds)("%s paints its own pieces, and only those (task 1.8d)", async (_route, path, has, hasNot) => {
    const Loading = (await import(path)).default as () => React.ReactElement;
    const html = renderToStaticMarkup(<Loading />);
    for (const piece of has) expect(html).toContain(piece);
    for (const piece of hasNot) expect(html).not.toContain(piece);
  });

  it("the four dashboard skeletons are exported, aria-hidden, and announce nothing themselves", async () => {
    const sk = await import("../src/components/Skeleton");
    const four = [sk.TelecardSkeleton, sk.RunRowsSkeleton, sk.PlanRailSkeleton, sk.SeasonRowsSkeleton];
    for (const Piece of four) {
      const html = renderToStaticMarkup(<Piece />);
      expect(html).toMatch(/^<div [^>]*aria-hidden="true"/);
      // The route's <main> is busy and says "Loading" once; a piece never adds a second.
      expect(html).not.toContain("role=\"status\"");
      expect(html).not.toContain("aria-busy");
    }
  });

  it("the dashboard's skeleton never stands in front of a run page", () => {
    // A loading.tsx at app/comics/ would wrap [runId] too and be the first
    // boundary the router meets, so a run would open on the dashboard's skeleton.
    // The dashboard sits in the (dash) group for that reason (task 1.8c).
    expect(existsSync("src/app/comics/loading.tsx")).toBe(false);
  });
});
