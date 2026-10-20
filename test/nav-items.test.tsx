// Task 1.8: every bar draws from the one NAV_ITEMS list (R1-06). An item with
// `enabled: false` renders nowhere, so a nav never leads to a screen that does
// not exist yet; the task that builds the screen flips the flag. The phone bar,
// the tablet rail and the sidebar are three drawings of the same list.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MediaBar from "../src/components/nav/MediaBar";
import NavRail from "../src/components/nav/NavRail";
import Sidebar from "../src/components/nav/Sidebar";
import ShellFrame from "../src/components/nav/ShellFrame";
import { currentItem, mediumItems, NAV_ITEMS, visibleItems, type NavItem } from "../src/components/nav/items";

const nav = vi.hoisted(() => ({ pathname: "/comics" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const bars = (items?: NavItem[]) => ({
  "the phone bar": renderToString(<MediaBar items={items} />),
  "the tablet rail": renderToString(<NavRail items={items} inbox={null} />),
  "the sidebar": renderToString(<Sidebar items={items} inbox={null} />),
});
const flip = (id: string): NavItem[] => NAV_ITEMS.map((i) => (i.id === id ? { ...i, enabled: false } : i));
const hrefOf = (id: string) => NAV_ITEMS.find((i) => i.id === id)!.href;

describe("NAV_ITEMS (AC-2)", () => {
  beforeEach(() => { nav.pathname = "/comics"; });

  it("has unique ids", () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a disabled item renders in no bar", () => {
    // `watch` is a medium (all three bars draw the switch); `comics-runs` is a
    // medium item (the rail and the sidebar draw those, the phone bar does not).
    for (const [id, drawnBy] of [["watch", 3], ["comics-runs", 2]] as const) {
      const href = `href="${hrefOf(id)}"`;
      const before = Object.entries(bars()).filter(([, html]) => html.includes(href));
      expect(before.length, `${id} drawn before the flip`).toBe(drawnBy);
      for (const [name, html] of Object.entries(bars(flip(id)))) {
        expect(html, `${id} in ${name}`).not.toContain(href);
      }
    }
  });

  it("the books Dashboard item is not rendered (2.2 builds it)", () => {
    const dash = NAV_ITEMS.find((i) => i.id === "books-dash")!;
    expect(dash.enabled).toBe(false);
    expect(visibleItems()).not.toContain(dash);
    for (const [name, html] of Object.entries(bars())) {
      // Books is reached through the media switch, straight to its list: /books redirects there.
      expect(html, name).not.toContain('href="/books"');
      expect(html, name).toContain('href="/books/list"');
    }
  });

  it("keeps the unbuilt screens out: Search, Settings, Status, Tracks, Plan, Shelves, Top", () => {
    const off = ["search", "settings", "comics-status", "comics-tracks", "comics-add", "books-status", "books-plan", "books-shelves", "books-top"];
    for (const id of off) expect(NAV_ITEMS.find((i) => i.id === id)?.enabled, id).toBe(false);
    for (const [name, html] of Object.entries(bars())) {
      expect(html, name).not.toMatch(/Ctrl K|Settings|Shelves|Tracks/);
    }
  });

  it("Export is a plain link at the foot of the rail and the sidebar, and not on the phone", () => {
    const all = bars();
    expect(all["the phone bar"]).not.toContain("/api/export");
    for (const name of ["the tablet rail", "the sidebar"] as const) {
      expect(all[name], name).toContain('href="/api/export"');
    }
    // A <Link> prefetches, and a prefetch of a route handler builds the export (task 0.9).
    const items = readFileSync("src/components/nav/items.ts", "utf8");
    expect(items).toMatch(/plain: true/);
  });

  it("never prefetches a redirect: / is not prefetched (task 1.8c)", () => {
    for (const file of ["MediaBar", "Sidebar"]) {
      expect(readFileSync(`src/components/nav/${file}.tsx`, "utf8"), file).toMatch(/<Link href="\/" prefetch=\{false\}/);
    }
  });
});

describe("the media bar", () => {
  it("draws the same media nav on every route, only aria-current differs", () => {
    const norm = (html: string) => html.replace(/ aria-current="page"/g, "");
    const seen = new Set<string>();
    for (const path of ["/comics", "/comics/runs", "/comics/some-run", "/books/list", "/books/add", "/watch", "/inbox"]) {
      nav.pathname = path;
      seen.add(norm(renderToString(<MediaBar />)));
    }
    expect(seen.size).toBe(1);
  });

  it("marks the current medium, and none on a screen under no medium", () => {
    nav.pathname = "/books/add";
    expect(renderToString(<MediaBar />)).toMatch(/aria-current="page"[^>]*>(?:<[^>]+>)*Books|href="\/books\/list"[^>]*aria-current="page"/);
    nav.pathname = "/inbox";
    expect(renderToString(<MediaBar />)).not.toContain("aria-current");
  });

  it("is a media nav of three links with their names, the wordmark first", () => {
    const html = renderToString(<MediaBar />);
    expect(html).toContain('aria-label="Media"');
    for (const name of ["Comics", "Books", "Watch"]) expect(html).toContain(`>${name}<`);
    expect(html.indexOf("Ledger")).toBeLessThan(html.indexOf(">Comics<"));
    expect(html).not.toContain("⚲"); // the drawn magnifier, never the glyph
  });
});

describe("currentItem", () => {
  const medium = mediumItems(NAV_ITEMS, "comics");
  it("is the exact match, and Runs for a run's own pages", () => {
    expect(currentItem(medium, "/comics")?.id).toBe("comics-dash");
    expect(currentItem(medium, "/comics/runs")?.id).toBe("comics-runs");
    expect(currentItem(medium, "/comics/bendis-disassembled")?.id).toBe("comics-runs");
    expect(currentItem(medium, "/comics/bendis-disassembled/add")?.id).toBe("comics-runs");
  });
  it("is nothing outside the medium", () => {
    expect(currentItem(medium, "/inbox")).toBeUndefined();
    expect(currentItem(medium, "/books/list")).toBeUndefined();
  });
});

describe("the frame", () => {
  it("draws no nav on /login, so the sign-in page links (and prefetches) nothing", () => {
    nav.pathname = "/login";
    const html = renderToString(<ShellFrame inbox={null}><main>sign in</main></ShellFrame>);
    expect(html).toContain("<main>sign in</main>");
    expect(html).not.toContain('class="bar"');
    for (const href of ["/comics", "/books/list", "/watch", "/inbox", "/api/export"]) expect(html).not.toContain(`href="${href}"`);
  });

  it("draws the bar, the rail and the sidebar everywhere else, around the content", () => {
    nav.pathname = "/comics";
    const html = renderToString(<ShellFrame inbox={null}><main>page</main></ShellFrame>);
    expect(html).toContain('class="bar"');
    expect(html).toContain('class="rail"');
    expect(html).toContain('class="side"');
    expect(html).toContain('<div class="content"><main>page</main></div>');
  });
});
