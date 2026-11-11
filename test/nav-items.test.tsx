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
import { currentItem, mediumItems, NAV_ITEMS, tabRowItems, visibleItems, withLastRun, type NavItem } from "../src/components/nav/items";

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
    // `watch` is a medium (all three bars draw the switch); `comics-status` is a
    // medium item (the rail and the sidebar draw those, and since 2.2i the phone's tab row).
    // Not `comics-runs`: comics Add shares its href until you add to a run (1.19).
    for (const [id, drawnBy] of [["watch", 3], ["comics-status", 3]] as const) {
      const href = `href="${hrefOf(id)}"`;
      const before = Object.entries(bars()).filter(([, html]) => html.includes(href));
      expect(before.length, `${id} drawn before the flip`).toBe(drawnBy);
      for (const [name, html] of Object.entries(bars(flip(id)))) {
        expect(html, `${id} in ${name}`).not.toContain(href);
      }
    }
  });

  it("the books Dashboard is on (task 2.2, AC-4): the Books switch and Dashboard lead to /books, current there", () => {
    const dash = NAV_ITEMS.find((i) => i.id === "books-dash")!;
    expect(dash).toMatchObject({ href: "/books", enabled: true, dash: true });
    expect(visibleItems()).toContain(dash);
    expect(hrefOf("books")).toBe("/books");
    expect(mediumItems(NAV_ITEMS, "books").map((i) => i.id)).toEqual(["books-dash", "books-status", "books-library", "books-plan", "books-add"]);
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books")?.id).toBe("books-dash");

    nav.pathname = "/books";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    for (const name of ["the tablet rail", "the sidebar"] as const) {
      const html = bars()[name];
      // The switch and the Dashboard item, both to /books and both current there; the Library isn't.
      expect(current(html).filter((a) => a.includes('href="/books"')), name).toHaveLength(2);
      expect(current(html).filter((a) => a.includes("Library")), name).toHaveLength(0);
    }
    const phone = renderToString(<MediaBar />);
    expect(current(phone).filter((a) => a.includes(">Books<") && a.includes('href="/books"'))).toHaveLength(1);
    expect(current(phone).filter((a) => a.includes(">Dashboard<") && a.includes('href="/books"'))).toHaveLength(1);
  });

  it("turns on Status for comics and books (task 1.9); Watch's waits for 8.8", () => {
    for (const id of ["comics-status", "books-status"]) {
      const item = NAV_ITEMS.find((i) => i.id === id)!;
      expect(item.enabled, id).toBe(true);
      expect(visibleItems(), id).toContain(item);
    }
    expect(NAV_ITEMS.find((i) => i.id === "watch-status")?.enabled).toBe(false);
    const all = bars();
    for (const name of ["the tablet rail", "the sidebar"] as const) {
      expect(all[name], name).toContain('href="/comics/status"');
    }
  });

  it("turns on the Library (task 2.2e): after Status in the rail and the sidebar, current on /books/list", () => {
    const library = NAV_ITEMS.find((i) => i.id === "books-library")!;
    expect(library).toMatchObject({ label: "Library", href: "/books/list", enabled: true, group: "medium", medium: "books" });
    // `library` is Shelves' icon: hue and icon identify, and two items never share one.
    expect(library.icon).not.toBe(NAV_ITEMS.find((i) => i.id === "books-shelves")!.icon);
    const books = mediumItems(NAV_ITEMS, "books").map((i) => i.id);
    expect(books).toEqual(["books-dash", "books-status", "books-library", "books-plan", "books-add"]);
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/list")?.id).toBe("books-library");
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/status")?.id).toBe("books-status");

    nav.pathname = "/books/list";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    for (const name of ["the tablet rail", "the sidebar"] as const) {
      const html = bars()[name];
      expect(html, name).toContain(">Library<");
      expect(html.indexOf(">Status<"), name).toBeLessThan(html.indexOf(">Library<"));
      // On the Library the rail and sidebar mark Library, and the Books switch beside them.
      expect(current(html).filter((a) => a.includes("Library")), name).toHaveLength(1);
    }
    // The phone's media switch marks Books, and since 2.2i its tab row lists Library too, marked once.
    const phone = renderToString(<MediaBar />);
    expect(current(phone).filter((a) => a.includes(">Books<"))).toHaveLength(1);
    expect(current(phone).filter((a) => a.includes(">Library<"))).toHaveLength(1);
    // The switch opens the dashboard since 2.2; the Library is its own item.
    expect(hrefOf("books")).toBe("/books");
  });

  it("turns on Plan (task 2.10): after the Library, to /books/plan, current there and on nothing else", () => {
    const plan = NAV_ITEMS.find((i) => i.id === "books-plan")!;
    expect(plan).toMatchObject({ label: "Plan", href: "/books/plan", enabled: true, group: "medium", medium: "books" });
    expect(visibleItems()).toContain(plan);
    // Never prefetched: its shell and chunks would ride on every books page (Lighthouse's budgets for /books, the Library and Status).
    expect(plan.noPrefetch).toBe(true);
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/plan")?.id).toBe("books-plan");
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/list")?.id).toBe("books-library");
    nav.pathname = "/books/plan";
    for (const name of ["the tablet rail", "the sidebar"] as const) {
      const html = bars()[name];
      expect(html, name).toContain('href="/books/plan"');
      expect(html.match(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)?.filter((a) => a.includes(">Plan<")), name).toHaveLength(1);
      expect(html.indexOf(">Library<"), name).toBeLessThan(html.indexOf(">Plan<"));
    }
  });

  it("keeps the unbuilt screens out: Search, Tracks, Shelves, Top", () => {
    const off = ["search", "comics-tracks", "books-shelves", "books-top"];
    for (const id of off) expect(NAV_ITEMS.find((i) => i.id === id)?.enabled, id).toBe(false);
    for (const [name, html] of Object.entries(bars())) {
      expect(html, name).not.toMatch(/Ctrl K|Shelves|Tracks/);
    }
  });

  it("Settings is on (task 2.0): the foot of the rail and the sidebar, and the phone bar's gear", () => {
    const settings = NAV_ITEMS.find((i) => i.id === "settings")!;
    expect(settings.enabled).toBe(true);
    expect(visibleItems()).toContain(settings);
    for (const [name, html] of Object.entries(bars())) {
      expect(html.match(/href="\/settings"/g), name).toHaveLength(1);
      expect(html, name).toContain("Settings");
    }
    // The gear is a link with a name, 44px (.iconbtn), after the media switch.
    const phone = renderToString(<MediaBar />);
    expect(phone).toMatch(/<a [^>]*class="iconbtn gear"[^>]*href="\/settings"|<a [^>]*href="\/settings"[^>]*class="iconbtn gear"/);
    expect(phone.indexOf('href="/settings"')).toBeGreaterThan(phone.indexOf(">Watch<"));
    expect(phone).toMatch(/href="\/settings"[^>]*>(?:(?!<\/a>).)*>Settings<\/span>/);
  });

  it("Settings is the current item on /settings in every bar that draws it, and on no other screen", () => {
    const current = (html: string) => /<a [^>]*href="\/settings"[^>]*aria-current="page"|<a [^>]*aria-current="page"[^>]*href="\/settings"/.test(html);
    nav.pathname = "/settings";
    for (const [name, html] of Object.entries(bars())) expect(current(html), name).toBe(true);
    nav.pathname = "/comics";
    for (const [name, html] of Object.entries(bars())) expect(current(html), name).toBe(false);
  });

  it("Export has left the nav: Settings' Export everything is the plain link now (task 2.0)", () => {
    expect(NAV_ITEMS.find((i) => i.id === "export")).toBeUndefined();
    for (const [name, html] of Object.entries(bars())) expect(html, name).not.toContain("/api/export");
    // A <Link> prefetches, and a prefetch of a route handler builds the export (task 0.9).
    const page = readFileSync("src/app/settings/page.tsx", "utf8");
    expect(page).toMatch(/<a href="\/api\/export"/);
    expect(page).not.toContain("next/link");
  });

  it("never prefetches a redirect: / is not prefetched (task 1.8c)", () => {
    for (const file of ["MediaBar", "Sidebar"]) {
      expect(readFileSync(`src/components/nav/${file}.tsx`, "utf8"), file).toMatch(/<Link href="\/" prefetch=\{false\}/);
    }
  });
});

describe("comics Add remembers the last run (1.19, AC-2)", () => {
  beforeEach(() => { nav.pathname = "/comics"; });
  const others = (items: NavItem[]) => items.filter((i) => i.id !== "comics-add").map((i) => [i.id, i.href]);
  const addLinks = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>).)*Add</g)].map((m) => m[1]);

  it("is on, and out of the unbuilt screens", () => {
    const add = NAV_ITEMS.find((i) => i.id === "comics-add")!;
    expect(add.enabled).toBe(true);
    expect(visibleItems()).toContain(add);
  });

  it("links to the remembered run's Add issues in every bar that draws comics' items", () => {
    const all = bars(withLastRun(NAV_ITEMS, "A"));
    for (const name of ["the phone bar", "the tablet rail", "the sidebar"] as const) {
      expect(addLinks(all[name]), name).toEqual(["/comics/A/add"]);
    }
  });

  it("links to the run list before any add, and a run id is encoded", () => {
    for (const [run, href] of [[null, "/comics/runs"], ["a b/c", "/comics/a%20b%2Fc/add"]] as const) {
      const all = bars(withLastRun(NAV_ITEMS, run));
      for (const name of ["the tablet rail", "the sidebar"] as const) {
        expect(addLinks(all[name]), `${run} in ${name}`).toEqual([href]);
      }
    }
  });

  it("changes no other item's href", () => {
    expect(others(withLastRun(NAV_ITEMS, "A"))).toEqual(others(NAV_ITEMS));
    expect(others(withLastRun(NAV_ITEMS, null))).toEqual(others(NAV_ITEMS));
  });

  it("is the current item only on an Add issues screen", () => {
    const items = withLastRun(NAV_ITEMS, "A");
    const current = (html: string) => addLinks(html.replace(/<a (?![^>]*aria-current)[^>]*>(?:(?!<\/a>).)*<\/a>/g, ""));
    for (const [path, on] of [["/comics/A/add", true], ["/comics/B/add", true], ["/comics/A", false], ["/comics/runs", false], ["/comics", false]] as const) {
      nav.pathname = path;
      for (const name of ["the tablet rail", "the sidebar"] as const) {
        expect(current(bars(items)[name]).length, `${path} in ${name}`).toBe(on ? 1 : 0);
      }
    }
  });

  it("is never prefetched: the add screen's queries wait for the tap (task 1.3c)", () => {
    expect(NAV_ITEMS.find((i) => i.id === "comics-add")?.noPrefetch).toBe(true);
    expect(readFileSync("src/components/nav/NavLink.tsx", "utf8")).toMatch(/prefetch=\{item\.noPrefetch \? false : undefined\}/);
  });
});

describe("the media bar", () => {
  it("draws the same media nav on every route, only aria-current differs", () => {
    // The tab row (2.2i) differs by medium and screen on purpose; its tests are below.
    const norm = (html: string) => html.replace(/ aria-current="page"/g, "").replace(/<nav aria-label="Screens".*?<\/nav>/, "");
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
    const html = renderToString(<MediaBar />).replace(/<nav aria-label="Screens".*?<\/nav>/, "");
    expect(html).not.toContain("aria-current");
  });

  it("is a media nav of three links with their names, the wordmark first", () => {
    const html = renderToString(<MediaBar />);
    expect(html).toContain('aria-label="Media"');
    for (const name of ["Comics", "Books", "Watch"]) expect(html).toContain(`>${name}<`);
    expect(html.indexOf("Ledger")).toBeLessThan(html.indexOf(">Comics<"));
    expect(html).not.toContain("⚲"); // the drawn magnifier, never the glyph
  });
});

const tabRow = (html: string) => /<nav aria-label="Screens"[^>]*>(.*?)<\/nav>/.exec(html)![1];
const labels = (html: string) => [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

describe("the tab row (2.2i, AC-2)", () => {
  it("lists mediumItems then Inbox, inside header.bar, for each medium", () => {
    for (const [path, medium] of [["/comics", "comics"], ["/books/list", "books"], ["/watch", "watch"]] as const) {
      nav.pathname = path;
      const html = renderToString(<MediaBar />);
      const row = tabRow(html);
      const expected = [...mediumItems(NAV_ITEMS, medium), NAV_ITEMS.find((i) => i.id === "inbox")!];
      expect(labels(row), medium).toEqual(expected.map((i) => i.label));
      expect([...row.matchAll(/href="([^"]+)"/g)].map((m) => m[1]), medium).toEqual(expected.map((i) => i.href));
      expect(html.indexOf("<header"), medium).toBeLessThan(html.indexOf('aria-label="Screens"'));
      expect(html.indexOf('aria-label="Screens"'), medium).toBeLessThan(html.lastIndexOf("</header>"));
    }
  });

  it("drops a disabled item: comics Status flipped off leaves the row", () => {
    nav.pathname = "/comics";
    expect(labels(tabRow(renderToString(<MediaBar items={NAV_ITEMS} />)))).toContain("Status");
    const row = tabRow(renderToString(<MediaBar items={flip("comics-status")} />));
    expect(row).not.toContain(`href="${hrefOf("comics-status")}"`);
    expect(labels(row)).not.toContain("Status");
  });

  it("marks the current item, Inbox on /inbox, and none on /settings, where the gear is current", () => {
    nav.pathname = "/inbox";
    const inbox = renderToString(<MediaBar lastMedium="books" />);
    expect(labels(tabRow(inbox))).toEqual([...mediumItems(NAV_ITEMS, "books").map((i) => i.label), "Inbox"]);
    expect(tabRow(inbox)).toMatch(/href="\/inbox"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/inbox"/);
    expect(tabRow(inbox).match(/aria-current/g)).toHaveLength(1);
    nav.pathname = "/settings";
    const settings = renderToString(<MediaBar lastMedium="comics" />);
    expect(tabRow(settings)).not.toContain("aria-current");
    expect(settings).toMatch(/href="\/settings"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/settings"/);
  });

  it("is Inbox alone until the last medium arrives, and the same height class either way", () => {
    nav.pathname = "/settings";
    expect(labels(tabRow(renderToString(<MediaBar />)))).toEqual(["Inbox"]);
    expect(tabRowItems(NAV_ITEMS, null).map((i) => i.id)).toEqual(["inbox"]);
  });

  it("a screen's own medium wins over the last one", () => {
    nav.pathname = "/watch";
    expect(labels(tabRow(renderToString(<MediaBar lastMedium="books" />)))).toContain("Dashboard");
    expect(labels(tabRow(renderToString(<MediaBar lastMedium="books" />)))).not.toContain("Library");
  });
});

describe("currentItem", () => {
  const medium = mediumItems(NAV_ITEMS, "comics");
  it("is the exact match, and Runs for a run's own pages", () => {
    expect(currentItem(medium, "/comics")?.id).toBe("comics-dash");
    expect(currentItem(medium, "/comics/runs")?.id).toBe("comics-runs");
    expect(currentItem(medium, "/comics/bendis-disassembled")?.id).toBe("comics-runs");
  });
  it("is Add on any run's Add issues screen, whichever run Add points at (1.19)", () => {
    for (const run of [null, "bendis-disassembled", "hickman-ff"]) {
      const set = mediumItems(withLastRun(NAV_ITEMS, run), "comics");
      expect(currentItem(set, "/comics/bendis-disassembled/add")?.id, String(run)).toBe("comics-add");
      expect(currentItem(set, "/comics/bendis-disassembled")?.id, String(run)).toBe("comics-runs");
      expect(currentItem(set, "/comics/runs")?.id, String(run)).toBe("comics-runs");
    }
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
