// @vitest-environment happy-dom
// Task 1.4d on screen: the wishlist review at /books/add?from=wishlist (AC-3,
// AC-4). One table per genre in the sheet's order; each line's glyph carries
// text; each decision is a named radiogroup and *Dismiss* is not red; an edited
// line is asked again before Apply; Apply sends every accept and dismissal in
// chunks; a line that couldn't be saved stays; with nothing left, an empty
// slate with one way back to Add books. The writes, against the database, are
// test/wishlist.test.ts; the choices test/wishlist-review.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WishlistReview from "../src/components/WishlistReview";
import { bookKey } from "../src/lib/book-parse";
import type { BookAnswer } from "../src/lib/book-review";
import type { WishlistLine } from "../src/lib/wishlist-review";

const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WIND = { bookId: "the-name-of-the-wind-patrick-rothfuss", title: "The Name of the Wind", author: "Patrick Rothfuss" };
const BLADE = { bookId: "the-blade-itself-joe-abercrombie", title: "The Blade Itself", author: "Joe Abercrombie" };

const LINES: WishlistLine[] = [
  { id: 1, genre: "Fantasy", text: "The Blade Itself - Joe Abercrombie" },
  { id: 2, genre: "Fantasy", text: "The Name of the Wint - Patrick Rothfuss" },
  { id: 3, genre: "Fantasy", text: "First Law - Joe Abercrombie" },
  { id: 4, genre: "Sci-Fi", text: "A Memory Called Empire — Arkady Martine" },
  { id: 5, genre: "Sci-Fi", text: "Gideon the Ninth - Tamsyn Muir" },
];
const ANSWERS: [string, BookAnswer][] = [
  [bookKey("The Blade Itself", "Joe Abercrombie"), { match: { ...BLADE, status: "read" }, near: null }],
  [bookKey("The Name of the Wint", "Patrick Rothfuss"), { match: null, near: { ...WIND, status: "to_read", similarity: 0.7826 } }],
  [bookKey("First Law", "Joe Abercrombie"), { match: null, near: null }],
  [bookKey("A Memory Called Empire", "Arkady Martine"), { match: null, near: null }],
  [bookKey("Gideon the Ninth", "Tamsyn Muir"), { match: null, near: null }],
];

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the wishlist route answers for an accept request; a test replaces it. */
let accepting: (items: { id: number; use?: string }[]) => Response;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  router.push.mockReset();
  router.refresh.mockReset();
  accepting = (items) => Response.json({
    accepted: items.map((i) => ({ id: i.id, ok: true, bookId: i.use ?? `book-${i.id}`, created: i.use === undefined })),
    dismissed: [],
  });
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    if (url === "/api/books/bulk") {
      return Response.json({ answers: (body.lines as unknown[]).map(() => ({ match: null, near: null })) });
    }
    if (body.dismiss) return Response.json({ accepted: [], dismissed: body.dismiss });
    return accepting(body.accept);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function show(lines = LINES, answers = ANSWERS, seriesNames = ["first law"]) {
  act(() => root.render(<WishlistReview lines={lines} answers={answers} seriesNames={seriesNames} />));
}
const click = (el: Element) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const rows = () => [...container.querySelectorAll<HTMLElement>(".review .vrow")];
const groupsOf = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="radiogroup"]')];
const button = (name: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name)!;
const apply = () => container.querySelector<HTMLButtonElement>(".add-buttons button:last-child")!;
const reason = () => container.querySelector("#wl-reason")?.textContent ?? null;
const pick = (row: HTMLElement, value: string) => act(async () => row.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click());
const posts = () => fetchMock.mock.calls.filter(([u]) => u === "/api/books/wishlist").map(([, init]) => JSON.parse(init.body));

describe("the states (AC-4)", () => {
  it("draws one table per genre, in the sheet's order, each line with a glyph and its text", () => {
    show();
    expect(container.querySelector("h1")!.textContent).toBe("Your wishlist");
    expect([...container.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["Fantasy3 lines", "Sci-Fi2 lines"]);
    expect([...container.querySelectorAll("ol.review")].map((o) => o.getAttribute("aria-label"))).toEqual(["Fantasy lines", "Sci-Fi lines"]);
    const glyphs = rows().map((r) => r.querySelector(".vd")!);
    expect(glyphs.map((g) => g.textContent)).toEqual(["✓", "!", "!", "✓", "✓"]);
    expect(glyphs.map((g) => g.getAttribute("aria-label"))).toEqual(["OK", "Needs a choice", "Needs a choice", "OK", "OK"]);
    expect(rows().map((r) => r.querySelector(".vcheck")!.textContent)).toEqual(["in library", "similar 0.78", "series?", "new", "new"]);
    expect(rows()[3].querySelector(".vl")!.textContent).toBe("A Memory Called Empire - Arkady Martine");
  });

  it("names every decision, and Dismiss is a grey choice, never the red one", () => {
    show();
    for (const g of rows().flatMap(groupsOf)) {
      expect(g.getAttribute("aria-label")).toMatch(/^Decision, line \d+$/);
      expect(g.querySelectorAll('input[type="radio"]').length).toBe(g.querySelectorAll("label").length);
    }
    expect(groupsOf(rows()[1])[0].querySelector<HTMLInputElement>("input:checked")!.value).toBe("create");
    expect(groupsOf(rows()[2])[0].querySelector<HTMLInputElement>("input:checked")!.value).toBe("leave");
    const dismiss = container.querySelectorAll("label.opt");
    expect([...dismiss].filter((l) => l.textContent === "Dismiss")).toHaveLength(5);
    expect(container.querySelector("label.opt.no")).toBeNull();
  });

  it("says what Apply will do, and writes nothing until it is pressed", () => {
    show();
    expect(container.querySelector(".wl-sum")!.textContent).toBe("3 books created · 1 line linked · 0 lines dismissed");
    expect(reason()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a line with no author as a choice that can only be left or dismissed", () => {
    show([{ id: 9, genre: "Fantasy", text: "Classic" }], [[bookKey("Classic", null), { match: null, near: null }]]);
    expect(rows()[0].querySelector(".vd")!.textContent).toBe("!");
    expect([...groupsOf(rows()[0])[0].querySelectorAll("label")].map((l) => l.textContent)).toEqual(["Leave", "Dismiss"]);
    expect(reason()).toBe("Nothing to apply: choose Add, Link or Dismiss for a line");
    expect(apply().getAttribute("aria-disabled")).toBe("true");
  });

  it("is an empty slate when nothing is left, with one action back to Add books", () => {
    show([], []);
    expect(container.querySelector(".slate b")!.textContent).toBe("Nothing left.");
    expect(container.querySelector(".slate")!.textContent).toContain("Nothing is left on your wishlist.");
    const actions = container.querySelectorAll(".slate a, .slate button");
    expect(actions).toHaveLength(1);
    expect(actions[0].textContent).toBe("Add books");
    expect(actions[0].getAttribute("href")).toBe("/books/add");
    expect(container.querySelector(".review")).toBeNull();
  });
});

describe("applying (AC-1, AC-3)", () => {
  it("sends every accept and dismissal, then the lines are gone and the slate says so", async () => {
    show();
    await pick(rows()[1], "use");
    await pick(rows()[2], "dismiss");
    await click(apply());
    expect(posts()).toEqual([
      { accept: [
        { id: 1, use: BLADE.bookId },
        { id: 2, use: WIND.bookId },
        { id: 4, title: "A Memory Called Empire", author: "Arkady Martine", series: null, position: null },
        { id: 5, title: "Gideon the Ninth", author: "Tamsyn Muir", series: null, position: null },
      ] },
      { dismiss: [3] },
    ]);
    expect(container.querySelector(".slate")!.textContent).toContain("Nothing is left on your wishlist.");
    expect(container.querySelector(".review-status")!.textContent)
      .toBe("2 books created at Someday · 2 lines linked to books you have · 1 line dismissed.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("holds the button while it works, so a second press can't send it again", async () => {
    let finish!: () => void;
    accepting = (items) => { throw new Error(`unexpected ${items.length}`); };
    fetchMock.mockImplementationOnce(async (_u: string, init?: RequestInit) => {
      await new Promise<void>((r) => { finish = r; });
      const { accept } = JSON.parse(init!.body as string);
      return Response.json({ accepted: accept.map((i: { id: number }) => ({ id: i.id, ok: true, bookId: "b", created: true })), dismissed: [] });
    });
    show();
    await click(apply());
    expect(apply().textContent).toBe("Applying…");
    expect(apply().getAttribute("aria-disabled")).toBe("true");
    expect(reason()).toBe("Applying 4 of 4…");
    await click(apply());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    // The four accepted lines are gone; the series line stays, and Apply is pressable again.
    expect(rows().map((r) => r.querySelector(".vl")!.textContent)).toEqual(["First Law - Joe Abercrombie"]);
    expect(apply().textContent).toBe("Apply");
  });

  it("sends a long list in chunks of 40, so no request runs for minutes", async () => {
    const many: WishlistLine[] = Array.from({ length: 85 }, (_, i) => ({ id: i + 1, genre: "Fantasy", text: `Book ${i + 1} - Some Author` }));
    const answers = many.map((l): [string, BookAnswer] => [bookKey(`Book ${l.id}`, "Some Author"), { match: null, near: null }]);
    show(many, answers, []);
    await click(apply());
    expect(posts().map((p) => p.accept.length)).toEqual([40, 40, 5]);
    expect(container.querySelector(".slate")).not.toBeNull();
  });

  it("leaves a line that couldn't be saved where it is, says so, and lets the rest go", async () => {
    accepting = (items) => Response.json({
      accepted: items.map((i) => (i.id === 5
        ? { id: 5, ok: false, reason: "failed" }
        : { id: i.id, ok: true, bookId: `book-${i.id}`, created: true })),
      dismissed: [],
    });
    show();
    await click(apply());
    expect(rows().map((r) => r.querySelector(".vl")!.textContent)).toEqual([
      "First Law - Joe Abercrombie", "Gideon the Ninth - Tamsyn Muir",
    ]);
    const alert = container.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain("1 line couldn't be saved and is still here");
    expect(alert.querySelector('span[aria-hidden="true"]')!.textContent).toBe("×");
    expect(apply().textContent).toBe("Apply");
  });

  it("keeps every line, in a neutral error, when the request fails", async () => {
    accepting = () => new Response("{}", { status: 500 });
    show();
    await click(apply());
    expect(rows()).toHaveLength(5);
    expect(container.querySelector('[role="alert"]')!.textContent).toContain("Couldn't finish. What was applied is done; the rest is still here.");
    expect(apply().textContent).toBe("Apply");
    expect(apply().getAttribute("aria-disabled")).toBeNull();
  });
});

describe("editing a line (AC-2)", () => {
  it("asks the library again before the edited line can be accepted", async () => {
    show();
    await click(container.querySelector<HTMLButtonElement>('button[aria-label^="Edit line 3"]')!);
    const input = container.querySelector<HTMLInputElement>("#wl-edit-3")!;
    expect(input.value).toBe("First Law - Joe Abercrombie");
    await typeInto(input, "Before They Are Hanged - Joe Abercrombie");
    await click(button("Save line"));

    expect(container.querySelector("#wl-edit-3")).toBeNull();
    expect(rows()[2].querySelector(".vl")!.textContent).toBe("Before They Are Hanged - Joe Abercrombie");
    expect(rows()[2].querySelector(".vcheck")!.textContent).toBe("unverified");
    // Not a green tick while it is unchecked.
    expect(rows()[2].querySelector(".vd")!.textContent).toBe("!");
    expect(rows()[2].querySelector(".vd")!.getAttribute("aria-label")).toBe("Needs a choice");
    expect(groupsOf(rows()[2])).toEqual([]);
    expect(reason()).toBe("Check 1 line first");
    expect(apply().getAttribute("aria-disabled")).toBe("true");
    await click(apply());
    expect(posts()).toEqual([]);

    await click(button("Check 1 line"));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      lines: [{ title: "Before They Are Hanged", author: "Joe Abercrombie" }], dryRun: true,
    });
    expect(rows()[2].querySelector(".vcheck")!.textContent).toBe("new");
    expect(reason()).toBeNull();
    await click(apply());
    expect(posts()[0].accept).toContainEqual({ id: 3, title: "Before They Are Hanged", author: "Joe Abercrombie", series: null, position: null });
  });

  it("puts the sheet's text back with Undo edit", async () => {
    show();
    await click(container.querySelector<HTMLButtonElement>('button[aria-label^="Edit line 4"]')!);
    await typeInto(container.querySelector<HTMLInputElement>("#wl-edit-4")!, "Something Else - Someone");
    await click(button("Save line"));
    expect(rows()[3].querySelector(".vl")!.textContent).toBe("Something Else - Someone");
    await click(container.querySelector<HTMLButtonElement>('button[aria-label="Undo the edit to line 4"]')!);
    expect(rows()[3].querySelector(".vl")!.textContent).toBe("A Memory Called Empire - Arkady Martine");
    expect(rows()[3].querySelector(".vcheck")!.textContent).toBe("new");
  });

  it("a failed check is a neutral line with Try again, and the line stays", async () => {
    show();
    await click(container.querySelector<HTMLButtonElement>('button[aria-label^="Edit line 5"]')!);
    await typeInto(container.querySelector<HTMLInputElement>("#wl-edit-5")!, "Harrow the Ninth - Tamsyn Muir");
    await click(button("Save line"));
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    await click(button("Check 1 line"));
    const error = container.querySelector(".neutral-error")!;
    expect(error.textContent).toContain("Couldn't check your library. Your lines are still here.");
    await click(button("Try again"));
    expect(container.querySelector(".neutral-error")).toBeNull();
    expect(rows()[4].querySelector(".vcheck")!.textContent).toBe("new");
  });
});

describe("loading (AC-4)", () => {
  it("draws the loaded geometry in skeletons, announced once, nothing else to read", async () => {
    const { default: Loading } = await import("../src/components/WishlistLoading");
    act(() => root.render(<Loading />));
    expect(container.querySelector(".wishlist")!.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector('[role="status"]')!.textContent).toBe("Loading your wishlist");
    expect(container.querySelector('[aria-hidden="true"]')!.querySelectorAll(".vrow")).toHaveLength(4);
    expect(container.querySelectorAll("button, a, input")).toHaveLength(0);
  });
});

// Task 1.4e (AC-4): the Title and Author cells belong to Paste a list alone.
describe("no Title or Author cells (task 1.4e)", () => {
  it("draws every line as text, with no cell inputs", () => {
    show();
    expect(rows().length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".review .vcells")).toHaveLength(0);
    expect(container.querySelector('input[aria-label^="Title"], input[aria-label^="Author"]')).toBeNull();
  });
});
