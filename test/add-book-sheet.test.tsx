// @vitest-environment happy-dom
// Task 1.4c on screen: the Add books sheet. Add to names the destination and
// every result's button says it (AC-3); Search runs on submit, your library
// before Open Library (AC-2); By hand needs a title and an author and says so
// under the field (AC-2); a record with no external one is *metadata pending*
// (AC-4); the search's states, labelled inputs, and the sheet's focus, inert
// and every way it closes (AC-6). The writes, against the database, are
// test/add-book.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookSearchAnswer } from "../src/app/api/books/search/route";
import AddBooksButton from "../src/components/AddBooksButton";
import IssueSearch from "../src/components/IssueSearch";
import { UndoProvider } from "../src/components/Undo";
import type { LibraryHit } from "../src/db/queries";
import type { Target } from "../src/lib/book-add";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const BLADE: LibraryHit = {
  id: "the-blade-itself-joe-abercrombie", title: "The Blade Itself", author: "Joe Abercrombie", series: "First Law",
  series_position: 1, published_year: null, page_count: null, word_count: null, word_count_source: null,
  cover_url: null, open_library_id: null, pending: true, status: "read", shelves: 2,
};
const SAKEY = {
  openLibraryId: "OL1W", title: "The Blade Itself", author: "Marcus Sakey", year: 2009, pages: 320,
  coverUrl: "https://covers.openlibrary.org/b/id/1-M.jpg",
};
const COSMERE: Target = { kind: "shelf", shelfId: "cosmere", name: "Cosmere" };

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the search answers; a function may hold it. */
let searchAnswer: (q: string) => Promise<Response> | Response;
let added: Record<string, unknown>;

const answer = (over: Partial<BookSearchAnswer> = {}): BookSearchAnswer =>
  ({ query: "blade", status: "ok", library: [BLADE], openLibrary: [SAKEY], wordsPerPage: 275, ...over });

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  searchAnswer = () => Response.json(answer());
  added = {
    ok: true, destination: { kind: "someday" }, bookId: "the-blade-itself-marcus-sakey", title: "The Blade Itself",
    reused: false, status: null, created: ["the-blade-itself-marcus-sakey"], added: ["the-blade-itself-marcus-sakey"],
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
}

async function search(q = "blade") {
  await type(dialog()!.querySelector<HTMLInputElement>("#book-q")!, q);
  await submit(dialog()!.querySelector('form[role="search"]')!);
}

describe("Add to (AC-3)", () => {
  it("opened from Add books, it is Someday; On deck and Year or quarter… are unavailable, with the reason shown", async () => {
    await open();
    // It opens on its segmented control, Search selected, and Add to follows (ui.md; mockup `add`).
    const control = dialog()!.querySelector(".seg")!;
    expect(control.compareDocumentPosition(dialog()!.querySelector(".addto")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(seg("Search").getAttribute("aria-pressed")).toBe("true");
    // Search shows Or paste a list under it, as drawn; By hand is the form alone.
    expect(dialog()!.querySelector(".pane-paste")!.hasAttribute("hidden")).toBe(false);
    expect(chips().map((c) => [c.textContent, c.getAttribute("aria-pressed"), c.getAttribute("aria-disabled")])).toEqual([
      ["Someday", "true", null], ["On deck", null, "true"], ["Year or quarter…", null, "true"], ["Shelf…", "false", null],
    ]);
    for (const name of ["On deck", "Year or quarter…"]) {
      const reason = document.getElementById(chip(name).getAttribute("aria-describedby")!)!;
      expect(reason.textContent).toBe("On deck and Year or quarter… arrive with the reading plan.");
      expect(reason.hidden).toBe(false);
    }
    await search();
    expect(resultButtons().map((b) => b.textContent)).toEqual(["Add to Someday", "Add to Someday"]);
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

describe("Search (AC-2, AC-6)", () => {
  it("runs on submit, not per keystroke, and lists your library before Open Library", async () => {
    await open();
    await type(dialog()!.querySelector<HTMLInputElement>("#book-q")!, "b");
    await type(dialog()!.querySelector<HTMLInputElement>("#book-q")!, "blade");
    expect(searches()).toHaveLength(0);
    await submit(dialog()!.querySelector('form[role="search"]')!);
    expect(searches().map(([, i]) => JSON.parse(i.body))).toEqual([{ q: "blade" }]);
    const heads = [...dialog()!.querySelectorAll(".pane-search h3.s")].map((h) => h.firstChild!.textContent);
    expect(heads).toEqual(["In your library", "From Open Library"]);
    const rows = [...dialog()!.querySelectorAll(".pane-search .row.res")];
    expect(rows[0].textContent).toContain("Joe Abercrombie");
    expect(rows[0].textContent).toContain("read");
    expect(rows[0].textContent).toContain("on 2 shelves");
    expect(rows[1].textContent).toContain("Marcus Sakey · 320 pages");
    expect(rows[1].textContent).toContain("Open Library · est 88k words");
  });

  it("loading is a status line and skeleton rows", async () => {
    let release!: () => void;
    const ok = answer();
    searchAnswer = () => new Promise((r) => { release = () => r(Response.json(ok)); });
    await open();
    await search();
    const line = dialog()!.querySelector('[role="status"] .statusline')!;
    expect(line.textContent).toBe("Searching your library, then Open Library…");
    expect(dialog()!.querySelectorAll(".pane-search .row.res .sk")).not.toHaveLength(0);
    await act(async () => release());
    expect(dialog()!.querySelector(".pane-search .statusline")).toBeNull();
  });

  it("rate-limited is amber, counts down, and Add it by hand carries the search over as the title", async () => {
    searchAnswer = () => Response.json(answer({ status: "rate_limited", retryIn: 40, openLibrary: [] }));
    await open();
    await search("the way of kings");
    const line = dialog()!.querySelector(".statusline.wait")!;
    expect(line.textContent).toContain("Open Library is busy. Retrying in 40s.");
    // Your library still answered.
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(1);
    await click(button("Add it by hand", line)!);
    expect(seg("By hand").getAttribute("aria-pressed")).toBe("true");
    expect(dialog()!.querySelector<HTMLInputElement>("#hand-title")!.value).toBe("the way of kings");
  });

  it("an error is a grey × that says nothing was added, with Try again; your library's rows stay", async () => {
    searchAnswer = () => Response.json(answer({ status: "error", openLibrary: [] }));
    await open();
    await search();
    const line = dialog()!.querySelector(".statusline.err")!;
    expect(line.querySelector('.x[aria-hidden="true"]')!.textContent).toBe("×");
    expect(line.textContent).toContain("Open Library did not answer. Nothing was added.");
    expect(dialog()!.querySelectorAll(".pane-search .row.res")).toHaveLength(1);
    await click(button("Try again", line)!);
    expect(searches()).toHaveLength(2);
    expect(button("Add it by hand", dialog()!.querySelector(".statusline")!)).toBeTruthy();
  });

  it("nothing found says so, with By hand", async () => {
    searchAnswer = () => Response.json(answer({ library: [], openLibrary: [] }));
    await open();
    await search("zzz");
    const line = dialog()!.querySelector(".pane-search .statusline")!;
    expect(line.textContent).toContain("Nothing in your library or on Open Library for zzz.");
    expect(button("Add it by hand", line)).toBeTruthy();
  });

  it("adding a result sends it, marks it added, and pushes one undo that sends back what it wrote", async () => {
    await open();
    await search();
    await click(resultButtons()[1]);
    expect(adds()).toEqual([{ item: { openLibrary: SAKEY }, destination: { kind: "someday" } }]);
    expect(resultButtons()[1].textContent).toBe("✓ Added to Someday");
    expect(resultButtons()[1].getAttribute("aria-disabled")).toBe("true");
    expect(document.querySelector(".toast-label")!.textContent).toBe("Added to Someday");
    // The sheet is still open, and its toast is not inert behind it: Undo is right there.
    expect(dialog()).not.toBeNull();
    expect(document.querySelector(".toast-region")!.closest("[inert]")).toBeNull();
    await click(document.querySelector(".toast-undo")!);
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect([init.method, JSON.parse(init.body)]).toEqual(["DELETE",
      { destination: { kind: "someday" }, created: ["the-blade-itself-marcus-sakey"], added: ["the-blade-itself-marcus-sakey"] }]);
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
