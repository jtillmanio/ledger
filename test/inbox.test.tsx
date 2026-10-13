// @vitest-environment happy-dom
// Task 1.4b on screen: the capture field saves with an empty kind and refuses a
// blank note under the field (AC-2); /inbox's Resolve leads into the add flow
// its kind names, an Unsure note asking which first (AC-1, AC-3); Add books and
// Add issues open with the note's text in Search, send the note with the first
// add only, and their undo sends it back (AC-3); the empty inbox is a --raise
// slate with one primary action, and every control has a name (AC-5). The
// writes, the list and the chip against the database are test/inbox.test.ts.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddBooks from "../src/components/AddBooks";
import AddIssues, { type AddContext } from "../src/components/AddIssues";
import Capture from "../src/components/Capture";
import { UndoProvider } from "../src/components/Undo";
import type { InboxNote } from "../src/db/queries";
import type { SearchResult } from "../src/lib/issue-search";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth", () => ({ requireUserId: async () => "test-user" }));

let notes: InboxNote[] = [];
let lastRun: string | null = "waid-ff";
vi.mock("@/db/queries", () => ({
  unresolvedNotes: async () => notes,
  lastTouchedRun: async () => lastRun,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** Every request the screen sent, as [url, method, body]. */
const sent = () => fetchMock.mock.calls.map(([url, init]) =>
  [url as string, (init?.method ?? "GET") as string, init?.body ? JSON.parse(init.body as string) : null] as const);

const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  notes = [];
  lastRun = "waid-ff";
  router.push.mockReset();
  router.refresh.mockReset();
  fetchMock = vi.fn(async (url: string) => {
    if (url === "/api/inbox") return Response.json({ ok: true, id: 1 });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const flush = () => act(async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
});
const field = () => container.querySelector<HTMLTextAreaElement>("#capture-text")!;
const kindButton = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Kind"] button')]
  .find((b) => b.textContent === name)!;
const buttonNamed = (name: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name)!;

async function type(el: HTMLTextAreaElement | HTMLInputElement, value: string) {
  await act(async () => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const submit = (form: Element) => act(async () => {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
});

describe("the capture field (AC-2, AC-5)", () => {
  const render = () => act(() => root.render(<UndoProvider><Capture /></UndoProvider>));

  it("is named, and its kind control reads Books · Comics · Watch · Unsure with Unsure chosen", () => {
    render();
    expect(field().getAttribute("aria-label")).toBe("Note");
    const kinds = [...container.querySelectorAll<HTMLButtonElement>('[role="group"][aria-label="Kind"] button')];
    expect(kinds.map((b) => b.textContent)).toEqual(["Books", "Comics", "Watch", "Unsure"]);
    expect(kinds.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "false", "true"]);
    expect(kinds.every((b) => b.type === "button")).toBe(true);
  });

  it("refuses an empty or whitespace-only note with *Write something first* under the field, sending nothing", async () => {
    render();
    for (const text of ["", "   \n  "]) {
      await type(field(), text);
      await submit(container.querySelector("form.capture")!);
      const err = container.querySelector("#capture-err")!;
      expect(err.textContent).toContain("Write something first");
      expect(err.className).toBe("field-err");
      expect(field().getAttribute("aria-invalid")).toBe("true");
      expect(field().getAttribute("aria-describedby")).toBe("capture-err");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves with an empty kind (Unsure is null), then with a chosen one, and clears the field", async () => {
    render();
    await type(field(), "Waid FF");
    await submit(container.querySelector("form.capture")!);
    await flush();
    await type(field(), "Priest's Black Panther");
    await act(async () => kindButton("Comics").click());
    expect(kindButton("Comics").getAttribute("aria-pressed")).toBe("true");
    await submit(container.querySelector("form.capture")!);
    await flush();
    expect(sent()).toEqual([
      ["/api/inbox", "POST", { text: "Waid FF", kind: null }],
      ["/api/inbox", "POST", { text: "Priest's Black Panther", kind: "comics" }],
    ]);
    expect(field().value).toBe("");
    expect(kindButton("Unsure").getAttribute("aria-pressed")).toBe("true");
    expect(router.refresh).toHaveBeenCalledTimes(2);
  });
});

describe("/inbox (AC-1, AC-3, AC-5)", () => {
  async function renderInbox() {
    const Inbox = (await import("../src/app/inbox/page")).default;
    const page = await Inbox();
    act(() => root.render(<UndoProvider>{page}</UndoProvider>));
  }
  const rowFor = (text: string) => [...container.querySelectorAll<HTMLElement>("li.note")]
    .find((li) => li.querySelector(".rt")!.textContent === text)!;

  it("empty: a --raise slate with one primary action, which focuses the field", async () => {
    await renderInbox();
    const slate = container.querySelector<HTMLElement>(".slate")!;
    expect(slate.textContent).toContain("Nothing waiting.");
    const actions = slate.querySelectorAll("button, a");
    expect(actions).toHaveLength(1);
    expect(actions[0].className).toBe("btn");
    await act(async () => (actions[0] as HTMLButtonElement).click());
    expect(document.activeElement).toBe(field());
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.slate\{background:var\(--raise\)/);
    expect(container.querySelector(".more")!.textContent).toBe("0");
  });

  it("each note's Resolve is a named link into the add flow its kind names, with the text and the note", async () => {
    notes = [
      { id: 3, raw_text: "Waid FF", kind: "comics", created_at: at(0) },
      { id: 2, raw_text: "that Abercrombie standalone", kind: "books", created_at: at(5) },
      { id: 1, raw_text: "Andor season 2", kind: "watch", created_at: at(9) },
    ];
    await renderInbox();
    expect([...container.querySelectorAll(".note .rt")].map((e) => e.textContent))
      .toEqual(["Waid FF", "that Abercrombie standalone", "Andor season 2"]);
    const resolve = (text: string) => rowFor(text).querySelector<HTMLAnchorElement>("a.btn")!;
    expect(resolve("Waid FF").getAttribute("href")).toBe("/comics/waid-ff/add?q=Waid+FF&note=3");
    expect(resolve("that Abercrombie standalone").getAttribute("href"))
      .toBe("/books/add?q=that+Abercrombie+standalone&note=2");
    expect(resolve("Andor season 2").getAttribute("href")).toBe("/watch/add?q=Andor+season+2&note=1");
    for (const n of notes) {
      const a = resolve(n.raw_text);
      expect(a.textContent).toBe("Resolve");
      expect(a.getAttribute("aria-label")).toBe(`Resolve: ${n.raw_text}`);
      expect(a.className).toBe("btn sec sm");
    }
    expect(rowFor("Waid FF").querySelector(".bdg")!.textContent).toBe("comics");
    expect(rowFor("Waid FF").querySelector("time")!.textContent).toBe("today");
    expect(rowFor("that Abercrombie standalone").querySelector("time")!.textContent).toBe("5 days ago");
    expect(rowFor("Andor season 2").querySelector("time")!.textContent).toBe("last week");
    expect(container.querySelector(".more")!.textContent).toBe("3");
  });

  it("an Unsure note's Resolve is a button that asks Books · Comics · Watch first", async () => {
    notes = [{ id: 4, raw_text: "Immortal Iron Fist — Fraction? check", kind: null, created_at: at(1) }];
    await renderInbox();
    const row = rowFor("Immortal Iron Fist — Fraction? check");
    expect(row.querySelector(".bdg")!.textContent).toBe("unsure");
    const button = row.querySelector<HTMLButtonElement>("button.btn")!;
    expect(button.textContent).toBe("Resolve");
    expect(button.getAttribute("aria-label")).toBe("Resolve: Immortal Iron Fist — Fraction? check");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    await act(async () => button.click());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const q = new URLSearchParams({ q: "Immortal Iron Fist — Fraction? check", note: "4" }).toString();
    expect([...row.querySelectorAll<HTMLAnchorElement>(".resolve-pick a")].map((a) => [a.textContent, a.getAttribute("href")]))
      .toEqual([["Books", `/books/add?${q}`], ["Comics", `/comics/waid-ff/add?${q}`], ["Watch", `/watch/add?${q}`]]);
  });

  it("a comics note with no run to add to says so instead of leading nowhere", async () => {
    lastRun = null;
    notes = [{ id: 5, raw_text: "Waid FF", kind: "comics", created_at: at(0) }];
    await renderInbox();
    const button = rowFor("Waid FF").querySelector<HTMLButtonElement>("button.btn")!;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector(`#${button.getAttribute("aria-describedby")}`)!.textContent).toBe("No run to add issues to yet");
  });

  it("an Unsure note with no run to add to holds Comics as a button with its reason", async () => {
    lastRun = null;
    notes = [{ id: 6, raw_text: "Iron Fist", kind: null, created_at: at(0) }];
    await renderInbox();
    const row = rowFor("Iron Fist");
    await act(async () => row.querySelector<HTMLButtonElement>("button.btn")!.click());
    expect([...row.querySelectorAll(".resolve-pick a")].map((a) => a.textContent)).toEqual(["Books", "Watch"]);
    const comics = row.querySelector<HTMLButtonElement>(".resolve-pick button")!;
    expect(comics.textContent).toBe("Comics");
    expect(comics.type).toBe("button");
    expect(comics.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector(`[id="${comics.getAttribute("aria-describedby")}"]`)!.textContent)
      .toBe("No run to add issues to yet");
  });

  it("Resolve keeps a 24px floor", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.row\.note \.btn\{[^}]*min-height:32px/);
    expect(css).toMatch(/\.resolve-pick \.chip\{[^}]*min-height:32px/);
  });
});

describe("Add books, opened from a books note (AC-3)", () => {
  const BLADE = {
    id: "the-blade-itself-joe-abercrombie", title: "The Blade Itself", author: "Joe Abercrombie", series: null,
    series_position: null, published_year: null, page_count: null, word_count: null, word_count_source: null,
    cover_url: null, open_library_id: null, pending: true, status: null, shelves: 0,
  };
  const ADDED = {
    ok: true, destination: { kind: "someday" }, bookId: BLADE.id, title: BLADE.title, reused: true, status: "to_read",
    created: [], added: [BLADE.id],
  };

  beforeEach(() => {
    let posts = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/books/search") {
        return Response.json({ query: "x", status: "ok", library: [BLADE], openLibrary: [], wordsPerPage: 275 });
      }
      if (url === "/api/books" && init?.method === "POST") return Response.json({ ...ADDED, note: posts++ === 0 ? 5 : null });
      if (url === "/api/books" && init?.method === "DELETE") return Response.json({ ok: true });
      throw new Error(`unexpected fetch ${url}`);
    });
  });

  it("starts with the text in Search, searches nothing until asked, and resolves the note with the first add only", async () => {
    act(() => root.render(<UndoProvider><AddBooks initial={{ kind: "someday" }} query="the blade itself" note={5} /></UndoProvider>));
    expect(container.querySelector<HTMLInputElement>("#book-q")!.value).toBe("the blade itself");
    expect(fetchMock).not.toHaveBeenCalled();

    await submit(container.querySelector("form[role='search']")!);
    await flush();
    expect(sent()[0]).toEqual(["/api/books/search", "POST", { q: "the blade itself" }]);
    const add = () => container.querySelector<HTMLButtonElement>(".res-add")!;
    await act(async () => add().click());
    await flush();
    expect(sent().filter(([u, m]) => u === "/api/books" && m === "POST")[0][2])
      .toEqual({ item: { use: BLADE.id }, destination: { kind: "someday" }, note: 5 });
    expect(container.querySelector(".toast")?.textContent ?? document.body.textContent).toContain("inbox note resolved");

    // Its undo sends the note back with the book it was resolved into.
    await act(async () => buttonNamed("Undo").click());
    await flush();
    expect(sent().find(([u, m]) => u === "/api/books" && m === "DELETE")![2])
      .toEqual({ destination: { kind: "someday" }, created: [], added: [BLADE.id], note: { id: 5, bookId: BLADE.id } });
  });

  it("a second add from the same screen carries no note", async () => {
    act(() => root.render(<UndoProvider><AddBooks initial={{ kind: "someday" }} query="the blade itself" note={5} /></UndoProvider>));
    await submit(container.querySelector("form[role='search']")!);
    await flush();
    await act(async () => container.querySelector<HTMLButtonElement>(".res-add")!.click());
    await flush();
    await act(async () => byHand("Best Served Cold", "Joe Abercrombie"));
    await flush();
    const posts = sent().filter(([u, m]) => u === "/api/books" && m === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[1][2]).not.toHaveProperty("note");
  });

  async function byHand(title: string, author: string) {
    await act(async () => [...container.querySelectorAll<HTMLButtonElement>(".seg button")].find((b) => b.textContent === "By hand")!.click());
    await type(container.querySelector<HTMLInputElement>("#hand-title")!, title);
    await type(container.querySelector<HTMLInputElement>("#hand-author")!, author);
    await submit(container.querySelector("form.byhand")!);
  }
});

describe("Add issues, opened from a comics note (AC-3)", () => {
  const thor = (n: number) => `Thor (1966) #${n}`;
  const run = (): AddContext => ({
    run: { id: "thor", title: "Simonson — Thor" },
    placements: [{ id: 1001, sequence: 1, label: thor(337), removed: false }],
  });
  const metron = (n: number): SearchResult => ({
    key: thor(n).toLowerCase(), label: thor(n), issueId: null, metronId: 14000 + n, coverDate: null, coverUrl: null,
    runs: 0, runTitles: [], inThisRun: false, unparseable: false, idTaken: false,
  });

  beforeEach(() => {
    let inserts = 0;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      if (url === "/api/metron/search") {
        return Response.json({ query: body.q, status: "ok", catalog: [], metron: [metron(338), metron(339)] });
      }
      if (body?.dryRun) return Response.json({ matches: [], taken: [] });
      if (init?.method === "DELETE") return Response.json({ ok: true, context: run() });
      return Response.json({
        ok: true, after: 1, created: [5001], restored: [], skipped: [], newIssues: [], revived: [],
        note: inserts++ === 0 ? 3 : null, context: run(),
      });
    });
    window.history.replaceState(null, "", "/comics/thor/add");
  });

  it("starts with the text in Search, resolves the note with the first insert, and the undo reopens it", async () => {
    act(() => root.render(
      <UndoProvider><AddIssues initial={run()} knownSeries={[{ title: "Thor", years: [1966] }]} runs={[]} query="thor 338" note={3} /></UndoProvider>));
    expect(container.querySelector<HTMLInputElement>("#issue-q")!.value).toBe("thor 338");
    expect(fetchMock).not.toHaveBeenCalled();

    await submit(container.querySelector("form[role='search']")!);
    await flush();
    const confirm = () => [...container.querySelectorAll<HTMLButtonElement>(".add-buttons button")].at(-1)!;
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Add ${thor(338)}"]`)!.click());
    await act(async () => confirm().click());
    await flush();
    const inserts = () => sent().filter(([u, m, b]) => u === "/api/runs/thor/issues" && m === "POST" && !b?.dryRun);
    expect(inserts()[0][2]).toEqual({ labels: [thor(338)], after: null, metronIds: [14338], note: 3 });

    await act(async () => buttonNamed("Undo").click());
    await flush();
    expect(sent().find(([, m]) => m === "DELETE")![2])
      .toEqual({ after: 1, created: [5001], restored: [], revived: [], note: 3 });

    // The next insert from the same screen is a plain one.
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Add ${thor(339)}"]`)!.click());
    await act(async () => confirm().click());
    await flush();
    expect(inserts()).toHaveLength(2);
    expect(inserts()[1][2]).not.toHaveProperty("note");
  });
});
