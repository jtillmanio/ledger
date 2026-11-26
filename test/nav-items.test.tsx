// Task 1.8: every bar draws from the one NAV_ITEMS list (R1-06). An item with
// `enabled: false` renders nowhere, so a nav never leads to a screen that does
// not exist yet; the task that builds the screen flips the flag. The phone bar,
// the tablet rail and the sidebar are three drawings of the same list.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IconSprite } from "../src/components/nav/Icons";
import MediaBar from "../src/components/nav/MediaBar";
import { MediumList } from "../src/components/nav/MediumSheet";
import { SheetCloseProvider } from "../src/components/Sheet";
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
function sheet(items: NavItem[] = NAV_ITEMS, medium: "comics" | "books" | "watch" | null = null) {
  return renderToString(
    <SheetCloseProvider value={() => {}}>
      <MediumList items={items} medium={medium} pathname={nav.pathname} />
    </SheetCloseProvider>,
  );
}
/** The phone bar's medium button (6.25, D-178): the one button that opens Switch medium. */
const mediumButton = (html: string) => /<button [^>]*class="medbtn"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? "";
const inGroupMedia = (items: NavItem[]) => visibleItems(items).filter((i) => i.group === "media");
const flip = (id: string): NavItem[] => NAV_ITEMS.map((i) => (i.id === id ? { ...i, enabled: false } : i));
const hrefOf = (id: string) => NAV_ITEMS.find((i) => i.id === id)!.href;
/** The books items, in the order every bar draws them. */
const BOOKS_ITEMS = [
  "books-dash", "books-status", "books-library", "books-plan", "books-shelves", "books-series", "books-top", "books-releases", "books-add",
];

describe("NAV_ITEMS (AC-2)", () => {
  beforeEach(() => { nav.pathname = "/comics"; });

  it("has unique ids", () => {
    const ids = NAV_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("a disabled item renders in no bar", () => {
    // `watch` is a medium (the rail, the sidebar and, since 6.25, the phone's Switch medium sheet
    // draw it); `comics-status` is a medium item (the rail and the sidebar draw those, and since
    // 2.2i the phone's tab row).
    // Not `comics-runs`: comics Add shares its href until you add to a run (1.19).
    const drawings = (items?: NavItem[]) => ({ ...bars(items), "the switch medium sheet": sheet(items) });
    for (const [id, drawnBy] of [["watch", 3], ["comics-status", 3]] as const) {
      const href = `href="${hrefOf(id)}"`;
      const before = Object.entries(drawings()).filter(([, html]) => html.includes(href));
      expect(before.length, `${id} drawn before the flip`).toBe(drawnBy);
      for (const [name, html] of Object.entries(drawings(flip(id)))) {
        expect(html, `${id} in ${name}`).not.toContain(href);
      }
    }
  });

  it("the books Dashboard is on (task 2.2, AC-4): the Books switch and Dashboard lead to /books, current there", () => {
    const dash = NAV_ITEMS.find((i) => i.id === "books-dash")!;
    expect(dash).toMatchObject({ href: "/books", enabled: true, dash: true });
    expect(visibleItems()).toContain(dash);
    expect(hrefOf("books")).toBe("/books");
    expect(mediumItems(NAV_ITEMS, "books").map((i) => i.id)).toEqual(BOOKS_ITEMS);
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
    // The medium button names Books (6.25); the tab row's Dashboard is the current link to /books.
    expect(mediumButton(phone)).toContain(">Books<");
    expect(current(phone).filter((a) => a.includes(">Dashboard<") && a.includes('href="/books"'))).toHaveLength(1);
    expect(current(sheet(NAV_ITEMS, "books")).filter((a) => a.includes('href="/books"'))).toHaveLength(1);
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
    expect(books).toEqual(BOOKS_ITEMS);
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
    // The phone's medium button names Books (6.25), and since 2.2i its tab row lists Library too, marked once.
    const phone = renderToString(<MediaBar />);
    expect(mediumButton(phone)).toContain(">Books<");
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

  it("turns on Top books (task 3.4b): after Plan, to /books/top, *Top* in the rail and tab row, *Top books* in the sidebar", () => {
    const top = NAV_ITEMS.find((i) => i.id === "books-top")!;
    expect(top).toMatchObject({
      label: "Top", sideLabel: "Top books", href: "/books/top", enabled: true, group: "medium", medium: "books", noPrefetch: true,
    });
    expect(visibleItems()).toContain(top);
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/top")?.id).toBe("books-top");
    nav.pathname = "/books/top";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    const { "the tablet rail": rail, "the sidebar": side } = bars();
    expect(current(side).filter((a) => a.includes('href="/books/top"') && a.includes(">Top books<"))).toHaveLength(1);
    expect(current(rail).filter((a) => a.includes('href="/books/top"') && a.includes(">Top<"))).toHaveLength(1);
    expect(side.indexOf(">Plan<")).toBeLessThan(side.indexOf(">Top books<"));
    const phone = renderToString(<MediaBar />);
    expect(current(phone).filter((a) => a.includes('href="/books/top"') && a.includes(">Top<"))).toHaveLength(1);
  });

  it("turns on Coming out (task 5.7, AC-4): after Top, before Add, to /books/releases, current there in every bar", () => {
    const releases = NAV_ITEMS.find((i) => i.id === "books-releases")!;
    expect(releases).toMatchObject({
      label: "Coming out", href: "/books/releases", enabled: true, group: "medium", medium: "books", icon: "calendar-clock",
    });
    expect(visibleItems()).toContain(releases);
    // No two items share an icon: hue and icon identify.
    expect(NAV_ITEMS.filter((i) => i.icon === releases.icon)).toEqual([releases]);
    expect(currentItem(mediumItems(NAV_ITEMS, "books"), "/books/releases")?.id).toBe("books-releases");
    nav.pathname = "/books/releases";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    const { "the tablet rail": rail, "the sidebar": side } = bars();
    for (const [name, html] of [["the tablet rail", rail], ["the sidebar", side]] as const) {
      expect(current(html).filter((a) => a.includes('href="/books/releases"') && a.includes(">Coming out<")), name).toHaveLength(1);
      expect(html.indexOf(">Top"), name).toBeLessThan(html.indexOf(">Coming out<"));
      expect(html.indexOf(">Coming out<"), name).toBeLessThan(html.indexOf(">Add<"));
    }
    const phone = renderToString(<MediaBar />);
    expect(current(phone).filter((a) => a.includes('href="/books/releases"') && a.includes(">Coming out<"))).toHaveLength(1);
    // The sprite draws the icon the item names.
    expect(renderToString(<IconSprite />)).toContain('id="i-calendar-clock"');
  });

  it("turns on Shelves (task 5.1): after Plan, to /books/shelves, current on the list and on a shelf's page", () => {
    const shelves = NAV_ITEMS.find((i) => i.id === "books-shelves")!;
    expect(shelves).toMatchObject({ label: "Shelves", href: "/books/shelves", enabled: true, group: "medium", medium: "books" });
    expect(visibleItems()).toContain(shelves);
    const books = mediumItems(NAV_ITEMS, "books");
    expect(currentItem(books, "/books/shelves")?.id).toBe("books-shelves");
    expect(currentItem(books, "/books/shelves/dark-tower")?.id).toBe("books-shelves");
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    // The phone bar's tab row (2.2i), the tablet rail and the sidebar each mark Shelves once, on both routes.
    for (const path of ["/books/shelves", "/books/shelves/dark-tower"]) {
      nav.pathname = path;
      for (const [name, html] of Object.entries(bars())) {
        expect(current(html).filter((a) => a.includes('href="/books/shelves"') && a.includes(">Shelves<")), `${name} on ${path}`).toHaveLength(1);
      }
      const side = bars()["the sidebar"];
      expect(side.indexOf(">Plan<")).toBeLessThan(side.indexOf(">Shelves<"));
    }
  });

  it("turns on Series (task 5.9, AC-4): after Shelves, before Top, to /books/series, current there in every bar", () => {
    const series = NAV_ITEMS.find((i) => i.id === "books-series")!;
    expect(series).toMatchObject({
      label: "Series", href: "/books/series", enabled: true, group: "medium", medium: "books", icon: "book-marked",
    });
    expect(visibleItems()).toContain(series);
    // No two items share an icon, and the sprite draws the one this names.
    expect(NAV_ITEMS.filter((i) => i.icon === series.icon)).toEqual([series]);
    expect(renderToString(<IconSprite />)).toContain('id="i-book-marked"');
    const books = mediumItems(NAV_ITEMS, "books");
    expect(currentItem(books, "/books/series")?.id).toBe("books-series");
    // Shelves' own href is not a prefix of it: /books/shelves is never current on /books/series.
    expect(currentItem(books, "/books/shelves")?.id).toBe("books-shelves");
    nav.pathname = "/books/series";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    for (const [name, html] of Object.entries(bars())) {
      expect(current(html).filter((a) => a.includes('href="/books/series"') && a.includes(">Series<")), name).toHaveLength(1);
      expect(current(html).filter((a) => a.includes(">Shelves<")), name).toHaveLength(0);
      expect(html.indexOf(">Shelves<"), name).toBeLessThan(html.indexOf(">Series<"));
      expect(html.indexOf(">Series<"), name).toBeLessThan(html.indexOf(">Top"));
    }
  });

  // Task 5.11b (TASK-162): the Universes list has no nav item (6.25 is fitting the rails to five media); the tab
  // on Series reaches it, so Series stays current on it. A universe's own page is not the list.
  it("keeps Series current on the Universes list, in every bar, with no nav item of its own (task 5.11b)", () => {
    const books = mediumItems(NAV_ITEMS, "books");
    expect(NAV_ITEMS.filter((i) => i.href.startsWith("/books/universes"))).toEqual([]);
    expect(currentItem(books, "/books/universes")?.id).toBe("books-series");
    expect(currentItem(books, "/books/universes/cosmere")).toBeUndefined();
    expect(currentItem(books, "/books/universes-and-more")).toBeUndefined();
    nav.pathname = "/books/universes";
    const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);
    for (const [name, html] of Object.entries(bars())) {
      expect(current(html).filter((a) => a.includes('href="/books/series"') && a.includes(">Series<")), name).toHaveLength(1);
      expect(html, name).not.toContain('href="/books/universes"');
    }
    nav.pathname = "/books/universes/cosmere";
    for (const [name, html] of Object.entries(bars())) {
      expect(current(html).filter((a) => a.includes(">Series<")), name).toHaveLength(0);
    }
  });

  it("keeps the unbuilt screens out: Search, Tracks", () => {
    const off = ["search", "comics-tracks"];
    for (const id of off) expect(NAV_ITEMS.find((i) => i.id === id)?.enabled, id).toBe(false);
    for (const [name, html] of Object.entries({ ...bars(), "the switch medium sheet": sheet() })) {
      expect(html, name).not.toMatch(/Tracks|href="\/search"/);
      // The phone bar draws search's button and says why it does nothing until 6.1 (D-178); nothing else does.
      if (name !== "the phone bar") expect(html, name).not.toMatch(/Ctrl K/);
    }
    const search = /<button [^>]*aria-label="Search \(Ctrl K\)"[^>]*>/.exec(renderToString(<MediaBar />))?.[0];
    expect(search).toContain('aria-disabled="true"');
    expect(search).toContain('title="Search isn&#x27;t built yet"');
  });

  it("Settings is on (task 2.0): the foot of the rail and the sidebar, and the phone bar's gear", () => {
    const settings = NAV_ITEMS.find((i) => i.id === "settings")!;
    expect(settings.enabled).toBe(true);
    expect(visibleItems()).toContain(settings);
    for (const [name, html] of Object.entries(bars())) {
      expect(html.match(/href="\/settings"/g), name).toHaveLength(1);
      expect(html, name).toContain("Settings");
    }
    // The gear is a link with a name, 44px (.iconbtn), after the medium button and search (6.25).
    const phone = renderToString(<MediaBar />);
    expect(phone).toMatch(/<a [^>]*class="iconbtn gear"[^>]*href="\/settings"|<a [^>]*href="\/settings"[^>]*class="iconbtn gear"/);
    expect(phone.indexOf('href="/settings"')).toBeGreaterThan(phone.indexOf('aria-label="Search (Ctrl K)"'));
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

describe("the media bar (6.25, D-178)", () => {
  beforeEach(() => { nav.pathname = "/comics"; });
  // Its accessible name (aria-label), which begins with its visible text.
  const name = (button: string) => {
    const label = /aria-label="([^"]*)"/.exec(button)?.[1] ?? "";
    expect(label.startsWith(button.replace(/<[^>]+>/g, ""))).toBe(true);
    return label;
  };

  it("draws the same bar on every route: only the medium named and aria-current differ", () => {
    // The tab row (2.2i) differs by medium and screen on purpose; its tests are below.
    const norm = (html: string) => html.replace(/ aria-current="page"/g, "").replace(/<nav aria-label="Screens".*?<\/nav>/, "")
      .replace(/<button [^>]*class="medbtn".*?<\/button>/, "<medbtn/>");
    const seen = new Set<string>();
    for (const path of ["/comics", "/comics/runs", "/comics/some-run", "/books/list", "/books/add", "/watch", "/inbox"]) {
      nav.pathname = path;
      seen.add(norm(renderToString(<MediaBar />)));
    }
    expect(seen.size).toBe(1);
  });

  it("reads Ledger · the medium button · search · the gear, with no Media nav of links (AC-1)", () => {
    const html = renderToString(<MediaBar />);
    expect(html).not.toContain('aria-label="Media"');
    // The other media are in the sheet; the bar's only link to /comics is the tab row's Dashboard.
    expect(html.replace(/<nav aria-label="Screens".*?<\/nav>/, "")).not.toMatch(/<a [^>]*href="\/(comics|books|watch)"/);
    const at = (needle: string) => html.indexOf(needle);
    expect(at(">Ledger<")).toBeGreaterThan(-1);
    expect(at(">Ledger<")).toBeLessThan(at('class="medbtn"'));
    expect(at('class="medbtn"')).toBeLessThan(at('aria-label="Search (Ctrl K)"'));
    expect(at('aria-label="Search (Ctrl K)"')).toBeLessThan(at('href="/settings"'));
    expect(html).toMatch(/<button [^>]*class="iconbtn search"/);
    expect(html).not.toContain("⚲"); // the drawn magnifier, never the glyph
  });

  it("the medium button opens a dialog, says whether it is open, and is named by its medium (AC-2)", () => {
    nav.pathname = "/books";
    const button = mediumButton(renderToString(<MediaBar />));
    expect(button).toContain('type="button"');
    expect(button).toContain('aria-haspopup="dialog"');
    expect(button).toContain('aria-expanded="false"');
    expect(button).toContain('data-medium="books"');
    // Its name begins with its visible text: "Books, switch medium".
    expect(name(button)).toBe("Books, switch medium");
    expect(button).toContain('href="#i-chevron-down"');
  });

  it("names the medium you are in, else the one the tab row draws, else Media (AC-3)", () => {
    nav.pathname = "/watch";
    expect(name(mediumButton(renderToString(<MediaBar lastMedium="books" />)))).toBe("Watch, switch medium");
    for (const path of ["/inbox", "/settings", "/progress"]) {
      nav.pathname = path;
      const last = mediumButton(renderToString(<MediaBar lastMedium="books" />));
      expect(name(last), path).toBe("Books, switch medium");
      expect(last, path).toContain('data-medium="books"');
      // A first visit, before any medium is known: no medium's name and no medium's colour.
      const none = mediumButton(renderToString(<MediaBar />));
      expect(name(none), path).toBe("Media, switch medium");
      expect(none, path).not.toContain("data-medium");
    }
  });
});

describe("the Switch medium sheet (6.25, D-178, AC-1)", () => {
  const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)]
    .map((m) => ({ href: m[1], a: m[0], text: m[2].replace(/<[^>]+>/g, "") }));

  it("lists every built medium by name, to its dashboard, in nav order", () => {
    const media = inGroupMedia(NAV_ITEMS);
    expect(media.length).toBeGreaterThanOrEqual(3);
    expect(links(sheet()).map((l) => [l.href, l.text])).toEqual(media.map((m) => [m.href, m.label]));
    // An unbuilt medium has no row.
    expect(links(sheet(flip("watch"))).map((l) => l.href)).not.toContain("/watch");
  });

  it("marks the current medium with aria-current and a grey check, and only that one", () => {
    for (const medium of ["comics", "books", "watch"] as const) {
      const rows = links(sheet(NAV_ITEMS, medium));
      const current = rows.filter((l) => l.a.includes("aria-current"));
      expect(current.map((l) => l.href), medium).toEqual([hrefOf(medium)]);
      expect(current[0].a, medium).toContain('href="#i-check"');
      expect(rows.filter((l) => l.a.includes('href="#i-check"')), medium).toHaveLength(1);
    }
    expect(sheet(NAV_ITEMS, null)).not.toContain("aria-current");
  });

  it("says where each medium opens and what / opens, Start on included (A6; TASK-147)", () => {
    const foot = /<p class="medfoot">(.*?)<\/p>/.exec(sheet())![1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    expect(foot).toBe("Each medium opens on its dashboard. / opens the one you used last, unless Settings → Start on names one.");
  });

  it("each row carries its medium's icon, and the sprite draws the chevron, the check and the magnifier", () => {
    for (const m of inGroupMedia(NAV_ITEMS)) expect(sheet(), m.id).toContain(`href="#i-${m.icon}"`);
    const sprite = renderToString(<IconSprite />);
    for (const icon of ["chevron-down", "check", "search"]) expect(sprite, icon).toContain(`id="i-${icon}"`);
  });
});

const tabRow = (html: string) => /<nav aria-label="Screens"[^>]*>(.*?)<\/nav>/.exec(html)![1];
const labels = (html: string) => [...html.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((m) => m[1]);

describe("the tab row (2.2i, AC-2)", () => {
  it("ends with a divider, then Inbox and Progress, the divider hidden from assistive tech (6.25, D-178, AC-1)", () => {
    nav.pathname = "/books/list";
    const row = tabRow(renderToString(<MediaBar />));
    const divider = /<span class="tabdiv" aria-hidden="true"><\/span>/;
    expect(row).toMatch(divider);
    const at = row.search(divider);
    expect(row.lastIndexOf('href="/books/add"')).toBeLessThan(at);
    expect(row.indexOf('href="/inbox"')).toBeGreaterThan(at);
    expect(row.indexOf('href="/progress"')).toBeGreaterThan(row.indexOf('href="/inbox"'));
    // With no medium yet there is nothing to divide.
    nav.pathname = "/settings";
    expect(tabRow(renderToString(<MediaBar />))).not.toMatch(divider);
  });

  it("draws Inbox's count, in mono, once it streams in (6.25, D-178)", () => {
    nav.pathname = "/comics";
    const row = tabRow(renderToString(<MediaBar inbox={<>6</>} />));
    // Named "Inbox 6": the space keeps the count a word of its own.
    expect(row).toMatch(/href="\/inbox"[^>]*>Inbox <span class="count">6<\/span><\/a>/);
    expect(tabRow(renderToString(<MediaBar />))).not.toContain('class="count"');
  });

  it("lists mediumItems then Inbox and Progress, inside header.bar, for each medium", () => {
    for (const [path, medium] of [["/comics", "comics"], ["/books/list", "books"], ["/watch", "watch"]] as const) {
      nav.pathname = path;
      const html = renderToString(<MediaBar />);
      const row = tabRow(html);
      const expected = [...mediumItems(NAV_ITEMS, medium), ...["inbox", "progress"].map((id) => NAV_ITEMS.find((i) => i.id === id)!)];
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
    expect(labels(tabRow(inbox))).toEqual([...mediumItems(NAV_ITEMS, "books").map((i) => i.label), "Inbox", "Progress"]);
    expect(tabRow(inbox)).toMatch(/href="\/inbox"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/inbox"/);
    expect(tabRow(inbox).match(/aria-current/g)).toHaveLength(1);
    nav.pathname = "/settings";
    const settings = renderToString(<MediaBar lastMedium="comics" />);
    expect(tabRow(settings)).not.toContain("aria-current");
    expect(settings).toMatch(/href="\/settings"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/settings"/);
  });

  it("is the global items alone until the last medium arrives, and the same height class either way", () => {
    nav.pathname = "/settings";
    expect(labels(tabRow(renderToString(<MediaBar />)))).toEqual(["Inbox", "Progress"]);
    expect(tabRowItems(NAV_ITEMS, null).map((i) => i.id)).toEqual(["inbox", "progress"]);
  });

  it("a screen's own medium wins over the last one", () => {
    nav.pathname = "/watch";
    expect(labels(tabRow(renderToString(<MediaBar lastMedium="books" />)))).toContain("Dashboard");
    expect(labels(tabRow(renderToString(<MediaBar lastMedium="books" />)))).not.toContain("Library");
  });
});

describe("Progress (task 5.12, AC-5)", () => {
  const item = NAV_ITEMS.find((i) => i.id === "progress")!;
  const current = (html: string) => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*>(?:(?!<\/a>).)*<\/a>/g)].map((m) => m[0]);

  it("is an enabled global item to /progress, drawn after Inbox", () => {
    expect(item).toMatchObject({ href: "/progress", group: "global", enabled: true, label: "Progress" });
    const ids = visibleItems().filter((i) => i.group === "global").map((i) => i.id);
    expect(ids).toEqual(["inbox", "progress"]);
  });

  it("is in the rail and the sidebar beside Inbox, and in the phone's tab row", () => {
    nav.pathname = "/books/list";
    for (const [name, html] of Object.entries(bars())) {
      if (name === "the phone bar") expect(labels(tabRow(html)).slice(-2), name).toEqual(["Inbox", "Progress"]);
      else expect(html.indexOf('href="/progress"'), name).toBeGreaterThan(html.indexOf('href="/inbox"'));
      expect(html, name).toContain('href="/progress"');
    }
  });

  it("is current on /progress in the rail, the sidebar and the tab row, and nowhere else", () => {
    nav.pathname = "/progress";
    for (const [name, html] of Object.entries(bars())) {
      const links = current(name === "the phone bar" ? tabRow(html) : html);
      expect(links.filter((a) => a.includes('href="/progress"')), name).toHaveLength(1);
      expect(links.filter((a) => a.includes('href="/inbox"')), name).toHaveLength(0);
    }
    nav.pathname = "/inbox";
    for (const html of Object.values(bars())) expect(current(html).filter((a) => a.includes('href="/progress"'))).toHaveLength(0);
  });

  it("is a neutral icon the sprite defines", () => {
    expect(renderToString(<IconSprite />)).toContain(`id="i-${item.icon}"`);
  });

  it("is in no medium's set: a screen under a medium keeps Progress out of its own items", () => {
    for (const medium of ["comics", "books", "watch"] as const) {
      expect(mediumItems(NAV_ITEMS, medium).map((i) => i.id)).not.toContain("progress");
    }
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
