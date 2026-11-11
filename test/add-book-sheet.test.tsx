// @vitest-environment happy-dom
// Task 1.4c on screen: the Add books sheet. Since task 1.22 Search runs as you
// type (3 characters and a 500 ms pause, fake timers here; the pause itself is
// test/use-search.test.ts) and every row has one tag saying where it came from. Add to names the destination and
// every result's button says it (AC-3); Search runs on submit, your library
// before Hardcover (AC-2; Hardcover since task 1.4f, with its subtitle, authors
// and not-set-up state); By hand needs a title and an author and says so
// under the field (AC-2); a record with no external one is *metadata pending*
// (AC-4); the search's states, labelled inputs, and the sheet's focus, inert
// and every way it closes (AC-6). *On deck* is a real choice from task 1.7
// (its AC-4); *Year or quarter…* is the plan picker from task 2.3 (its AC-4). The writes, against the
// database, are test/add-book.test.ts and test/plan-period.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookSearchAnswer } from "../src/app/api/books/search/route";
import AddBooksButton from "../src/components/AddBooksButton";
import IssueSearch from "../src/components/IssueSearch";
import { UndoProvider } from "../src/components/Undo";
import type { LibraryHit } from "../src/db/queries";
import type { Target } from "../src/lib/book-add";
import { easternYear } from "../src/lib/settings";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BLADE: LibraryHit = {
  id: "the-blade-itself-joe-abercrombie", title: "The Blade Itself", author: "Joe Abercrombie", series: "First Law",
  series_position: 1, published_year: null, page_count: null, word_count: null, word_count_source: null,
  cover_url: null, hardcover_id: null, pending: true, status: "read", level: null, period: null, calibre: false, shelves: 2,
  listened: false,
};
const SAKEY_ITEM = {
  hardcoverId: 1, title: "The Blade Itself", authors: ["Marcus Sakey"], year: 2009, pages: 320,
  coverUrl: "https://assets.hardcover.app/edition/1/sakey.jpeg",
};
/** A Hardcover result as the search lists it; the add sends SAKEY_ITEM's fields of it. */
const SAKEY = { ...SAKEY_ITEM, subtitle: null, series: null, position: null };
const COSMERE: Target = { kind: "shelf", shelfId: "cosmere", name: "Cosmere" };

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the search answers; a function may hold it. */
let searchAnswer: (q: string) => Promise<Response> | Response;
let added: Record<string, unknown>;

/** The plan picker's chips: five years from `first`, each year and quarter with some words planned. */
const planned = (period: string, plannedWords: number) => ({ period, plannedWords, capacity: 760_000 });
const planYears = (first: number) => Array.from({ length: 5 }, (_, i) => ({
  year: planned(String(first + i), 1_300_000),
  quarters: [1, 2, 3, 4].map((q) => planned(`${first + i}-Q${q}`, q * 100_000)),
}));

const answer = (over: Partial<BookSearchAnswer> = {}): BookSearchAnswer =>
  ({ query: "blade", status: "ok", library: [BLADE], hardcover: [SAKEY], wordsPerPage: 275, ...over });

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  searchAnswer = () => Response.json(answer());
  added = {
    ok: true, destination: { kind: "someday" }, bookId: "the-blade-itself-marcus-sakey", title: "The Blade Itself",
    reused: false, status: null, created: ["the-blade-itself-marcus-sakey"], added: ["the-blade-itself-marcus-sakey"],
    statused: [],
  };
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    if (url === "/api/books/search") return searchAnswer(body.q);
    if (url === "/api/shelves") return Response.json({ shelves: [{ id: "cosmere", name: "Cosmere" }] });
    if (url === "/api/books/bulk") {
      return body.dryRun
        ? Response.json({ answers: body.lines.map(() => ({ match: null, near: null })) })
        : Response.json({ ok: true, destination: body.destination, created: ["golden-son-pierce-brown"], matched: [],
          added: ["golden-son-pierce-brown"] });
    }
    if (url.startsWith("/api/plan?firstYear=")) return Response.json({ years: planYears(Number(url.split("=")[1])) });
    if (url.startsWith("/api/plan?to=")) {
      return Response.json({ budget: { period: new URL(url, "http://x").searchParams.get("to"), plannedWords: 533_000, capacity: 760_000, over: null } });
    }
    if (url === "/api/books" && init?.method === "POST") return Response.json(added);
    if (url === "/api/books" && init?.method === "DELETE") return Response.json({ ok: true });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  router.push.mockReset();
  router.refresh.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const click = (el: Element) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
const key = (el: Element | Window, k: string) => act(async () => {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
});
async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = (form: Element) => act(async () => {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const opener = () => container.querySelector<HTMLButtonElement>("button")!;
const chips = () => [...dialog()!.querySelectorAll<HTMLButtonElement>(".addto > .chip")];
const chip = (name: string) => chips().find((c) => c.textContent === name)!;
const seg = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>(".seg button")].find((b) => b.textContent === name)!;
const button = (name: string, scope: ParentNode = dialog()!) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name && !b.closest("[hidden]"));
const resultButtons = () => [...dialog()!.querySelectorAll<HTMLButtonElement>(".res-add")];
const searches = () => fetchMock.mock.calls.filter(([u]) => u === "/api/books/search");
const adds = () => fetchMock.mock.calls.filter(([u, i]) => u === "/api/books" && i?.method === "POST")
  .map(([, i]) => JSON.parse(i.body));

async function open(target?: Target) {
  act(() => root.render(<UndoProvider><AddBooksButton target={target} /></UndoProvider>));
  await click(opener());
  // Add books' code loads with its sheet (task 1.30): wait for the body, past its loading state, on
  // setImmediate ticks so the fake setTimeout below never moves. test/add-books-loading.test.tsx is the wait itself.
  // The first open in a worker compiles the module, so the bound is time, not ticks.
  for (const until = Date.now() + 10_000; Date.now() < until && !dialog()?.querySelector(".addb");) {
    await act(async () => { await new Promise((r) => setImmediate(r)); });
  }
}

async function search(q = "blade") {
  await type(dialog()!.querySelector<HTMLInputElement>("#book-q")!, q);
  await submit(dialog()!.querySelector('form[role="search"]')!);
}

describe("Add to (AC-3)", () => {
  it("opened from Add books, it is Someday; Year or quarter… is enabled, with no reason line (task 2.3, AC-4)", async () => {
    await open();
    // It opens on its segmented control, Search selected, and Add to follows (ui.md; mockup `add`).
    const control = dialog()!.querySelector(".seg")!;
    expect(control.compareDocumentPosition(dialog()!.querySelector(".addto")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(seg("Search").getAttribute("aria-pressed")).toBe("true");
    // Search shows Or paste a list under it, as drawn; By hand is the form alone.
    expect(dialog()!.querySelector(".pane-paste")!.hasAttribute("hidden")).toBe(false);
    expect(chips().map((c) => [c.textContent, c.getAttribute("aria-pressed"), c.getAttribute("aria-disabled")])).toEqual([
      ["Someday", "true", null], ["On deck", "false", null], ["Year or quarter…", "false", null], ["Shelf…", "false", null],
    ]);
    expect(chip("On deck").hasAttribute("aria-describedby")).toBe(false);
    expect(chip("Year or quarter…").hasAttribute("aria-describedby")).toBe(false);
    expect(dialog()!.textContent).not.toContain("arrives with the plan editor");
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual(["Add to Someday", "Add to Someday"]);
  });

  it("On deck (task 1.7) is a real choice: every button says Add to On deck, and the add and its undo send it", async () => {
    added = { ...added, destination: { kind: "on_deck" }, statused: ["the-blade-itself-marcus-sakey"] };
    await open();
    await click(chip("On deck"));
    expect(chip("On deck").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Someday").getAttribute("aria-pressed")).toBe("false");
    expect(chip("Year or quarter…").hasAttribute("aria-disabled")).toBe(false);
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual(["Add to On deck", "Add to On deck"]);
    await click(resultButtons()[1]);
    expect(adds()).toEqual([{ item: { hardcover: SAKEY_ITEM }, destination: { kind: "on_deck" } }]);
    expect(resultButtons()[1].textContent).toBe("✓ Added to On deck");
    expect(document.querySelector(".toast-label")!.textContent).toBe("Added to On deck");
    await click(document.querySelector(".toast-undo")!);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect([init.method, JSON.parse(init.body)]).toEqual(["DELETE", {
      destination: { kind: "on_deck" }, created: ["the-blade-itself-marcus-sakey"],
      added: ["the-blade-itself-marcus-sakey"], statused: ["the-blade-itself-marcus-sakey"],
    }]);
    await click(seg("By hand"));
    expect(dialog()!.querySelector<HTMLButtonElement>('.byhand button[type="submit"]')!.textContent).toBe("Add to On deck");
  });

  it("opened from a shelf's + Add to shelf, Add to shows that shelf and every result says Add to <shelf>", async () => {
    await open(COSMERE);
    expect(chip("Cosmere").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Someday").getAttribute("aria-pressed")).toBe("false");
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual(["Add to Cosmere", "Add to Cosmere"]);
    await click(resultButtons()[1]);
    expect(adds()[0].destination).toEqual({ kind: "shelf", shelfId: "cosmere" });
    await click(seg("By hand"));
    expect(dialog()!.querySelector<HTMLButtonElement>('.byhand button[type="submit"]')!.textContent).toBe("Add to Cosmere");
  });

  it("Shelf… asks for your shelves only when tapped, and choosing one renames every button", async () => {
    await open();
    expect(fetchMock).not.toHaveBeenCalled();
    await click(chip("Shelf…"));
    expect(fetchMock.mock.calls.map(([u]) => u)).toEqual(["/api/shelves"]);
    await click(button("Cosmere", dialog()!.querySelector('[aria-label="Your shelves"]')!)!);
    expect(chip("Cosmere").getAttribute("aria-pressed")).toBe("true");
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual(["Add to Cosmere", "Add to Cosmere"]);
  });
});

/** Every library place a row can say, one book each (task 1.22, AC-3). */
const at = (
  id: string, status: string | null, level: string | null, period: string | null, calibre = false, listened = false,
): LibraryHit =>
  ({ ...BLADE, id, title: `Book ${id}`, pending: false, shelves: 0, status, level: level as LibraryHit["level"], period, calibre, listened });
const PLACES: [LibraryHit, string][] = [
  [at("someday", "to_read", "someday", null), "Someday"],
  [at("someday-calibre", "to_read", "someday", null, true), "Someday"],
  [at("on-deck", "to_read", "on_deck", "on_deck"), "On deck"],
  [at("quarter", "to_read", "quarter", "2027-Q1"), "Q1 2027"],
  [at("year", "to_read", "year", "2027"), "2027"],
  [at("reading", "reading", null, null), "Reading"],
  [at("listening", "listening", null, null), "Listening"],
  [at("read", "read", null, null), "Read"],
  [at("read-listened", "read", null, null, false, true), "Read"],
  [at("dnf", "dnf", null, null), "DNF"],
  [at("unlisted", "unlisted", null, null), "Unlisted"],
  [at("unlisted-calibre", "unlisted", null, null, true), "Unlisted · Calibre"],
  [at("shelf-only", null, null, null), "Not on your list"],
];
/** A row's accessible name, as aria-labelledby builds it. */
const nameOf = (li: Element) => li.getAttribute("aria-labelledby")!.split(" ")
  .map((id) => document.getElementById(id)!.textContent).join(" ");

describe("Search as you type (task 1.22: AC-2, AC-4, AC-6)", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }); });
  afterEach(() => { vi.useRealTimers(); });
  const pause = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
  const box = () => dialog()!.querySelector<HTMLInputElement>("#book-q")!;

  it("searches 500 ms after 3 characters, without Enter; 2 characters send nothing and clear the list", async () => {
    await open();
    await type(box(), "b");
    await type(box(), "bl");
    await pause(600);
    expect(searches()).toHaveLength(0);
    await type(box(), "bla");
    await pause(499);
    expect(searches()).toHaveLength(0);
    await pause(1);
    expect(searches().map(([, i]) => JSON.parse(i.body))).toEqual([{ q: "bla" }]);
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(2);
    await type(box(), "bl");
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(0);
    await pause(600);
    expect(searches()).toHaveLength(1);
  });

  it("the request carries an abort signal, and a newer query aborts the older one", async () => {
    let release!: () => void;
    searchAnswer = (q) => (q === "bla" ? new Promise((r) => { release = () => r(Response.json(answer())); })
      : Response.json(answer({ query: q, library: [], hardcover: [SAKEY] })));
    await open();
    await type(box(), "bla");
    await pause(500);
    await type(box(), "blade");
    await pause(500);
    const [first, second] = searches().map(([, i]) => i.signal as AbortSignal);
    expect([first.aborted, second.aborted]).toEqual([true, false]);
    await act(async () => release());
    // The older answer, late, is dropped: the list is the newer query's.
    expect([...dialog()!.querySelectorAll(".pane-search .row.res .rt")].map((t) => t.textContent)).toEqual(["The Blade Itself"]);
    expect(dialog()!.querySelector('[aria-label="In your library"]')).toBeNull();
  });

  it("the hint says it searches as you type", async () => {
    await open();
    expect(dialog()!.querySelector(".pane-search .seg-note")!.textContent)
      .toBe("Matched against your library first, then Hardcover. Searches as you type.");
  });

  it("searching is announced once a request in the polite live region, not once a keystroke", async () => {
    let release!: () => void;
    searchAnswer = () => new Promise((r) => { release = () => r(Response.json(answer())); });
    await open();
    const live = dialog()!.querySelector('.pane-search [role="status"]')!;
    expect(live.getAttribute("aria-live")).toBe("polite");
    const seen: string[] = [];
    const watch = new MutationObserver(() => seen.push(live.textContent ?? ""));
    watch.observe(live, { childList: true, subtree: true, characterData: true });
    for (const t of ["b", "bl", "bla", "blad", "blade"]) await type(box(), t);
    await pause(500);
    await act(async () => release());
    await act(async () => {});
    watch.disconnect();
    expect(seen.filter((t) => t.startsWith("Searching"))).toEqual(["Searching your library, then Hardcover…"]);
  });

  it("a rate-limited answer to typing is the amber countdown, and while it counts typing asks nothing (AC-4)", async () => {
    searchAnswer = () => Response.json(answer({ status: "rate_limited", retryIn: 40, hardcover: [] }));
    await open();
    await type(box(), "the way");
    await pause(500);
    expect(dialog()!.querySelector(".statusline.wait")!.textContent).toContain("Hardcover is busy. Retrying in 40s.");
    await type(box(), "the way of kings");
    await pause(600);
    expect(searches()).toHaveLength(1);
  });
});

describe("Search (AC-2, AC-6)", () => {
  it("Enter searches at once and lists your library before Hardcover, each row with one tag", async () => {
    await open();
    await search("bl");
    expect(searches().map(([, i]) => JSON.parse(i.body))).toEqual([{ q: "bl" }]);
    const heads = [...dialog()!.querySelectorAll(".pane-search h3.s")].map((h) => h.firstChild!.textContent);
    expect(heads).toEqual(["In your library", "From Hardcover"]);
    const rows = [...dialog()!.querySelectorAll(".pane-search .row.res")];
    expect(rows[0].textContent).toContain("Joe Abercrombie");
    expect([...rows[0].querySelectorAll(".tag")].map((t) => t.textContent)).toEqual(["Read"]);
    expect(rows[0].textContent).toContain("on 2 shelves");
    expect(rows[1].textContent).toContain("Marcus Sakey · 320 pages");
    expect([...rows[1].querySelectorAll(".tag")].map((t) => t.textContent)).toEqual(["Hardcover"]);
    expect(rows[1].textContent).toContain("est 88k words");
  });

  it("every library row says where the book sits, a Hardcover row Hardcover, as text in the row's name (task 1.22, AC-3)", async () => {
    searchAnswer = () => Response.json(answer({ library: PLACES.map(([b]) => b) }));
    await open();
    await search("book");
    const library = [...dialog()!.querySelectorAll('[aria-label="In your library"] > li')];
    expect(library.map((li) => [...li.querySelectorAll(".tag")].map((t) => t.textContent))).toEqual(PLACES.map(([, tag]) => [tag]));
    expect(library.map(nameOf)).toEqual(PLACES.map(([b, tag]) => `${b.title} ${tag}`));
    const hc = dialog()!.querySelector('[aria-label="From Hardcover"] > li')!;
    expect(nameOf(hc)).toBe("The Blade Itself Hardcover");
    // Text, never hidden: a screen reader reads it where it sits too.
    for (const tag of dialog()!.querySelectorAll(".pane-search .res-tags .tag")) expect(tag.closest("[aria-hidden]")).toBeNull();
    const heads = [...dialog()!.querySelectorAll(".pane-search h3.s")].map((h) => h.firstChild!.textContent);
    expect(heads).toEqual(["In your library", "From Hardcover"]);
  });

  it("the headphones glyph sits beside the tag of a book being listened to or listened to before, named, and nowhere else (task 1.23, AC-6)", async () => {
    searchAnswer = () => Response.json(answer({ library: PLACES.map(([b]) => b) }));
    await open();
    await search("book");
    const library = [...dialog()!.querySelectorAll('[aria-label="In your library"] > li')];
    const glyphs = library.map((li) => {
      const svg = li.querySelector('.res-tags svg[role="img"]');
      return svg && [li.querySelector(".rt")!.textContent, svg.getAttribute("aria-label")];
    }).filter(Boolean);
    expect(glyphs).toEqual([["Book listening", "Listening"], ["Book read-listened", "Listened"]]);
    // Beside the tag, not inside it: the row's name stays its title and its place.
    for (const svg of dialog()!.querySelectorAll('.res-tags svg[role="img"]')) expect(svg.closest(".tag")).toBeNull();
  });

  it("a Hardcover result's subtitle follows its title, muted and in its button's name; every author and the series show (task 1.4f, AC-3)", async () => {
    const WOK = {
      hardcoverId: 386446, title: "The Way of Kings", subtitle: "Book One of the Stormlight Archive",
      authors: ["Brandon Sanderson", "Michael Whelan"], series: "The Stormlight Archive", position: 1,
      year: 2010, pages: 1007, coverUrl: null,
    };
    searchAnswer = () => Response.json(answer({ library: [], hardcover: [WOK] }));
    await open();
    await search("the way of kings");
    const row = dialog()!.querySelector(".pane-search .row.res")!;
    const head = row.querySelector(".rh")!;
    // The title and the muted subtitle are one run of text, then the year.
    expect([...head.children].map((c) => c.textContent)).toEqual([
      "The Way of Kings Book One of the Stormlight Archive", "2010"]);
    expect([...head.children[0].children].map((c) => [c.className, c.textContent])).toEqual([
      ["rt", "The Way of Kings"], ["rsub muted", "Book One of the Stormlight Archive"]]);
    expect(row.querySelector(".rs")!.textContent)
      .toBe("Brandon Sanderson and Michael Whelan · The Stormlight Archive #1 · 1007 pages");
    expect(resultButtons()[0].getAttribute("aria-label"))
      .toBe("Add to Someday: The Way of Kings: Book One of the Stormlight Archive");
    await click(resultButtons()[0]);
    // The add sends the title alone; the subtitle is not saved.
    expect(adds()).toEqual([{ item: { hardcover: {
      hardcoverId: 386446, title: "The Way of Kings", authors: ["Brandon Sanderson", "Michael Whelan"],
      year: 2010, pages: 1007, coverUrl: null,
    } }, destination: { kind: "someday" } }]);
  });

  it("with no Hardcover token, says so with By hand and no Try again; your library's rows stay (task 1.4f)", async () => {
    searchAnswer = () => Response.json(answer({ status: "unconfigured", hardcover: [] }));
    await open();
    await search();
    const line = dialog()!.querySelector(".pane-search .statusline")!;
    expect(line.textContent).toContain("Hardcover isn't set up here, so only your library was searched. Nothing was added.");
    expect(button("Try again", line)).toBeFalsy();
    expect(button("Add it by hand", line)).toBeTruthy();
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(1);
  });

  it("loading is a status line and skeleton rows", async () => {
    let release!: () => void;
    const ok = answer();
    searchAnswer = () => new Promise((r) => { release = () => r(Response.json(ok)); });
    await open();
    await search();
    const line = dialog()!.querySelector('[role="status"] .statusline')!;
    expect(line.textContent).toBe("Searching your library, then Hardcover…");
    expect(dialog()!.querySelectorAll(".pane-search .row.res .sk")).not.toHaveLength(0);
    await act(async () => release());
    expect(dialog()!.querySelector(".pane-search .statusline")).toBeNull();
  });

  it("rate-limited is amber, counts down, and Add it by hand carries the search over as the title", async () => {
    searchAnswer = () => Response.json(answer({ status: "rate_limited", retryIn: 40, hardcover: [] }));
    await open();
    await search("the way of kings");
    const line = dialog()!.querySelector(".statusline.wait")!;
    expect(line.textContent).toContain("Hardcover is busy. Retrying in 40s.");
    // Your library still answered.
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(1);
    await click(button("Add it by hand", line)!);
    expect(seg("By hand").getAttribute("aria-pressed")).toBe("true");
    expect(dialog()!.querySelector<HTMLInputElement>("#hand-title")!.value).toBe("the way of kings");
  });

  it("an error is a grey × that says nothing was added, with Try again; your library's rows stay", async () => {
    searchAnswer = () => Response.json(answer({ status: "error", hardcover: [] }));
    await open();
    await search();
    const line = dialog()!.querySelector(".statusline.err")!;
    expect(line.querySelector('.x[aria-hidden="true"]')!.textContent).toBe("×");
    expect(line.textContent).toContain("Hardcover did not answer. Nothing was added.");
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(1);
    await click(button("Try again", line)!);
    expect(searches()).toHaveLength(2);
    expect(button("Add it by hand", dialog()!.querySelector(".statusline")!)).toBeTruthy();
  });

  it("nothing found says so, with By hand", async () => {
    searchAnswer = () => Response.json(answer({ library: [], hardcover: [] }));
    await open();
    await search("zzz");
    const line = dialog()!.querySelector(".pane-search .statusline")!;
    expect(line.textContent).toContain("Nothing in your library or on Hardcover for zzz.");
    expect(button("Add it by hand", line)).toBeTruthy();
  });

  it("adding a result sends it, marks it added, and pushes one undo that sends back what it wrote", async () => {
    await open();
    await search();
    await click(resultButtons()[1]);
    expect(adds()).toEqual([{ item: { hardcover: SAKEY_ITEM }, destination: { kind: "someday" } }]);
    expect(resultButtons()[1].textContent).toBe("✓ Added to Someday");
    expect(resultButtons()[1].getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector(".toast-label")!.textContent).toBe("Added to Someday");
    // The sheet is still open, and its toast is not inert behind it: Undo is right there.
    expect(dialog()).not.toBeNull();
    expect(document.querySelector(".toast-region")!.closest("[inert]")).toBeNull();
    await click(document.querySelector(".toast-undo")!);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect([init.method, JSON.parse(init.body)]).toEqual(["DELETE",
      { destination: { kind: "someday" }, created: ["the-blade-itself-marcus-sakey"], added: ["the-blade-itself-marcus-sakey"],
        statused: [] }]);
    // The undo takes the result's Added back with it (TASK-040's note): it can be added again.
    expect(resultButtons()[1].textContent).toBe("Add to Someday");
    expect(resultButtons()[1].hasAttribute("aria-disabled")).toBe(false);
  });

  it("a book you already have says so, and with nothing written there is nothing to undo", async () => {
    added = { ...added, bookId: BLADE.id, reused: true, status: "read", created: [], added: [] };
    await open();
    await search();
    await click(resultButtons()[0]);
    expect(adds()[0].item).toEqual({ use: BLADE.id });
    expect(resultButtons()[0].textContent).toBe("✓ Already there");
    expect(document.querySelector(".toast-label")!.textContent).toBe("Already in your library");
    expect(document.querySelector(".toast-detail")!.textContent).toBe("The Blade Itself · read");
    expect(document.querySelector(".toast-undo")).toBeNull();
  });
});

describe("Year or quarter… (task 2.3, AC-4)", () => {
  const Y = easternYear() + 1;
  const Q3 = `${Y}-Q3`;
  const pp = (name: string) => [...dialog()!.querySelectorAll<HTMLButtonElement>(".pp-chip")].find((b) => b.textContent!.startsWith(name))!;
  const primary = () => dialog()!.querySelector<HTMLButtonElement>(".pp .btnrow .btn:not(.sec)")!;
  const planButtons = () => [...dialog()!.querySelectorAll<HTMLButtonElement>(".res-plan")];
  const planCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith("/api/plan?to="));
  /** Opens the picker and waits for it: Add books loads it on first use (next/dynamic), not with the page. */
  const opening = async (opener: Element) => {
    await click(opener);
    await vi.waitFor(() => {
      if (!dialog()?.querySelector(".pp-chips .pp-chip")) throw new Error("the picker hasn't loaded");
    });
    await act(async () => {});
  };
  const choosing = async (quarter = "Q3") => {
    await click(pp(String(Y)));
    await click(pp(quarter));
  };

  it("the chip opens the picker inside the same dialog; choosing a quarter sets Add to, and every result says it", async () => {
    await open();
    await opening(chip("Year or quarter…"));
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    const heading = dialog()!.querySelector("h2")!;
    expect(heading.textContent).toBe("Year or quarter");
    expect(document.activeElement).toBe(heading);
    expect(dialog()!.querySelector(".addb")!.hasAttribute("hidden")).toBe(true);
    // The next five years, then On deck and Someday; a year opens No quarter yet and Q1–Q4.
    expect([...dialog()!.querySelector(".pp-chips")!.querySelectorAll(".pp-chip")].map((b) => b.firstChild!.textContent))
      .toEqual([0, 1, 2, 3, 4].map((i) => String(Y - 1 + i)).concat(["On deck", "Someday"]));
    expect(dialog()!.textContent).not.toContain("planned ·");
    await choosing();
    expect(primary().textContent).toBe(`Choose Q3 ${Y}`);
    await click(primary());
    expect(dialog()!.querySelector("h2")!.textContent).toBe("Add books");
    expect(dialog()!.querySelector(".addb")!.hasAttribute("hidden")).toBe(false);
    expect(chip(`Q3 ${Y}`).getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(chip(`Q3 ${Y}`));
    added = { ...added, destination: { kind: "period", period: Q3 }, statused: ["the-blade-itself-marcus-sakey"] };
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual([`Add to Q3 ${Y}`, `Add to Q3 ${Y}`]);
    await click(resultButtons()[1]);
    expect(adds()).toEqual([{ item: { hardcover: SAKEY_ITEM }, destination: { kind: "period", period: Q3 } }]);
  });

  it("a result's own Year or quarter… adds that book at the end of a quarter, and Undo makes the row addable again", async () => {
    added = { ...added, destination: { kind: "period", period: Q3 }, statused: ["the-blade-itself-marcus-sakey"] };
    await open();
    await search();
    expect(planButtons().map((b) => b.textContent)).toEqual(["Year or quarter…", "Year or quarter…"]);
    await opening(planButtons()[1]);
    expect(dialog()!.querySelector("h2")!.textContent).toBe("The Blade Itself");
    // A book not planned yet: no *currently planned* badge. Its words come from the pages, 320 x 275.
    expect(dialog()!.textContent).not.toContain("planned ·");
    expect(dialog()!.textContent).toContain("~88k words");
    await choosing();
    expect(planCalls().at(-1)).toBe(`/api/plan?to=${Q3}&words=88000`);
    expect(primary().textContent).toBe(`Add to Q3 ${Y}`);
    await click(primary());
    expect(adds()).toEqual([{ item: { hardcover: SAKEY_ITEM }, destination: { kind: "period", period: Q3 } }]);
    // The Add to target is untouched; the row says where it went.
    expect(chip("Someday").getAttribute("aria-pressed")).toBe("true");
    expect(resultButtons()[1].textContent).toBe(`✓ Added to Q3 ${Y}`);
    expect(resultButtons()[0].textContent).toBe("Add to Someday");
    expect(document.querySelector(".toast-label")!.textContent).toBe(`Added to Q3 ${Y}`);
    await click(document.querySelector(".toast-undo")!);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body).destination).toEqual({ kind: "period", period: Q3 });
    expect(resultButtons()[1].textContent).toBe("Add to Someday");
    expect(resultButtons()[1].hasAttribute("aria-disabled")).toBe(false);
    expect(planButtons()[1].hasAttribute("aria-disabled")).toBe(false);
  });

  it("‹ Add books and Cancel go back with focus on the control that opened the picker, writing nothing", async () => {
    await open();
    await search();
    await opening(planButtons()[0]);
    await click(button("‹ Add books")!);
    expect(dialog()!.querySelector("h2")!.textContent).toBe("Add books");
    expect(document.activeElement).toBe(planButtons()[0]);
    await opening(planButtons()[0]);
    await click(button("Cancel", dialog()!.querySelector(".pp")!)!);
    expect(document.activeElement).toBe(planButtons()[0]);
    expect(adds()).toEqual([]);
  });

  it("the primary stays unavailable, with its reason, until a year and a quarter are chosen", async () => {
    await open();
    await opening(chip("Year or quarter…"));
    expect(primary().getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(primary().getAttribute("aria-describedby")!)!.textContent).toBe("Choose where it goes first.");
    await click(pp(String(Y)));
    expect(primary().getAttribute("aria-disabled")).toBe("true");
    await click(pp("No quarter yet"));
    expect(primary().textContent).toBe(`Choose ${Y}`);
    expect(primary().hasAttribute("aria-disabled")).toBe(false);
    await click(pp("Someday"));
    expect(dialog()!.querySelector(".pp-quarters")).toBeNull();
    expect(primary().textContent).toBe("Choose Someday");
  });
});

describe("By hand (AC-2)", () => {
  it("without a title and an author says so under each field and writes nothing", async () => {
    await open();
    await click(seg("By hand"));
    await submit(dialog()!.querySelector("form.byhand")!);
    for (const [field, message] of [["title", "Title is required"], ["author", "Author is required"]]) {
      const input = dialog()!.querySelector<HTMLInputElement>(`#hand-${field}`)!;
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(document.getElementById(input.getAttribute("aria-describedby")!)!.textContent).toBe(`! ${message}`);
    }
    expect(document.activeElement).toBe(dialog()!.querySelector("#hand-title"));
    expect(adds()).toEqual([]);
  });

  it("sends what you typed, then clears for the next one", async () => {
    await open();
    await click(seg("By hand"));
    await type(dialog()!.querySelector<HTMLInputElement>("#hand-title")!, " A Small Book ");
    await type(dialog()!.querySelector<HTMLInputElement>("#hand-author")!, "New Author");
    await type(dialog()!.querySelector<HTMLInputElement>("#hand-words")!, "85,000");
    await submit(dialog()!.querySelector("form.byhand")!);
    expect(adds()).toEqual([{
      item: { hand: { title: "A Small Book", author: "New Author", series: null, position: null, pages: null, words: 85000 } },
      destination: { kind: "someday" },
    }]);
    expect(dialog()!.querySelector<HTMLInputElement>("#hand-title")!.value).toBe("");
  });
});

describe("metadata pending (AC-4)", () => {
  it("a library book with no external record has the dashed cover and the italic line", async () => {
    await open();
    await search();
    const [mine, theirs] = [...dialog()!.querySelectorAll(".pane-search .row.res")];
    expect(mine.querySelector(".cv")!.getAttribute("data-enrich")).toBe("pending");
    expect(mine.querySelector(".enrich")!.textContent).toBe("metadata pending");
    expect(theirs.querySelector("img.cv")!.getAttribute("src")).toBe(SAKEY.coverUrl);
    expect(theirs.querySelector('[data-enrich="pending"]')).toBeNull();
  });

  it("an issue made by Add issues without Metron data is pending in Add issues' search too", async () => {
    fetchMock.mockImplementation(async () => Response.json({
      query: "thor 1", status: "ok", metron: [], catalog: [{
        key: "thor (1966) #1", label: "Thor (1966) #1", issueId: "thor-1966-1", metronId: null, coverDate: null,
        coverUrl: null, runs: 1, runTitles: ["Thor"], inThisRun: false, unparseable: false, idTaken: false, pending: true,
      }],
    }));
    act(() => root.render(<IssueSearch runId="thor" staged={new Set()} onToggle={() => {}} onAnswer={() => {}} onTypeInstead={() => {}} />));
    await type(container.querySelector<HTMLInputElement>("#issue-q")!, "thor 1");
    await submit(container.querySelector('form[role="search"]')!);
    const row = container.querySelector(".row.res")!;
    expect(row.querySelector(".cv")!.getAttribute("data-enrich")).toBe("pending");
    expect(row.querySelector(".enrich")!.textContent).toBe("metadata pending");
  });
});

describe("the sheet (AC-6)", () => {
  it("is a dialog labelled by its heading, which takes focus; the page behind is inert; nothing is asked on open", async () => {
    await open();
    const h = dialog()!.querySelector("h2")!;
    expect(h.textContent).toBe("Add books");
    expect(dialog()!.getAttribute("aria-labelledby")).toBe(h.id);
    expect(document.activeElement).toBe(h);
    // Everything behind it but the undo toast, which stays live above a sheet.
    const behind = [...container.children].filter((el) => !el.classList.contains("toast-region"));
    expect(behind.length).toBeGreaterThan(0);
    expect(behind.every((el) => el.hasAttribute("inert"))).toBe(true);
    expect(container.querySelector(".toast-region")!.closest("[inert]")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("labels every input", async () => {
    await open();
    for (const name of ["Search", "Paste a list", "By hand"]) {
      await click(seg(name));
      for (const input of dialog()!.querySelectorAll<HTMLElement>(".pane:not([hidden]) input, .pane:not([hidden]) textarea")) {
        expect(dialog()!.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
      }
    }
  });

  const routes: [string, () => Promise<void>][] = [
    ["Esc", async () => key(document.activeElement!, "Escape")],
    ["Back", async () => act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); })],
    ["Cancel under Search", async () => click(button("Cancel")!)],
    ["By hand's Cancel", async () => { await click(seg("By hand")); await click(button("Cancel")!); }],
    ["Paste's confirm", async () => {
      await click(seg("Paste a list"));
      await type(dialog()!.querySelector("textarea")!, "Golden Son - Pierce Brown");
      await click(button("Check 1 line")!);
      await click(button("Add 1 book")!);
    }],
  ];
  for (const [name, close] of routes) {
    it(`closes by ${name}, and focus goes back to Add books`, async () => {
      await open();
      await close();
      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(opener());
      expect(container.querySelector("[inert]")).toBeNull();
    });
  }

  it("Paste's confirm refreshes the page behind and leaves an undo", async () => {
    await open();
    await routes[4][1]();
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(document.querySelector(".toast-label")!.textContent).toBe("1 book added to Someday");
  });
});
