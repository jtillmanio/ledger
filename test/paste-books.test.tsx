// @vitest-environment happy-dom
// Task 1.4 on screen: Add books, *Paste a list* (AC-5, with AC-3's choices).
// The empty, checking and error states; each line's glyph carries text; each
// decision is a named radiogroup; *Add N books* is aria-disabled with its
// reason until every line is checked and decided; the confirm sends what it
// counts, then lands on To read with a toast (owner, PR #76). The writes,
// against the database, are test/books-bulk.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PasteBooks from "../src/components/PasteBooks";
import { UndoProvider } from "../src/components/Undo";
import type { BookAnswer } from "../src/lib/book-review";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const WIND = { bookId: "the-name-of-the-wind-patrick-rothfuss", title: "The Name of the Wind", author: "Patrick Rothfuss" };

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let failCheck: boolean;
/** What the library check answers, by lower-cased title. */
let library: Record<string, BookAnswer>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  failCheck = false;
  library = {
    "the name of the wind": { match: { ...WIND, status: "to_read" }, near: null },
    "the name of the wint": { match: null, near: { ...WIND, status: "to_read", similarity: 0.7826 } },
  };
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(init!.body as string);
    if (body.dryRun) {
      if (failCheck) return new Response("{}", { status: 500 });
      return Response.json({
        answers: (body.lines as { title: string }[]).map((l) => library[l.title.toLowerCase()] ?? { match: null, near: null }),
      });
    }
    return Response.json({ ok: true, created: ["golden-son-pierce-brown"], matched: [], added: ["golden-son-pierce-brown"] });
  });
  vi.stubGlobal("fetch", fetchMock);
  router.push.mockReset();
  onAdded.mockReset();
  act(() => root.render(
    <UndoProvider>
      <PasteBooks level={2} target={{ kind: "someday" }} cancel={<a href="/books" className="btn sec">Cancel</a>} onAdded={onAdded} />
    </UndoProvider>));
});

/** What Add books does once a paste is added: the sheet closes, or the page goes to To read (task 1.4c). */
const onAdded = vi.fn();

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

async function type(text: string) {
  const area = container.querySelector<HTMLTextAreaElement>("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const click = (el: Element) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
const checkButton = () => container.querySelector<HTMLButtonElement>(".paste-check");
const confirmButton = () => [...container.querySelectorAll<HTMLButtonElement>(".add-buttons button")].at(-1)!;
const reason = () => container.querySelector("#add-reason")?.textContent ?? null;
const rows = () => [...container.querySelectorAll<HTMLElement>(".review .vrow")];
const glyphs = () => rows().map((r) => r.querySelector(".vd")!);
const groupsOf = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="radiogroup"]')];
const confirms = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body)).filter((b) => !b.dryRun);

const PASTE = [
  "The Name of the Wind - Patrick Rothfuss",
  "The Name of the Wint - Patrick Rothfuss",
  "Golden Son (Red Rising #2) - Pierce Brown",
  "Before They Are Hanged",
  "(Mistborn #1) - Brandon Sanderson",
].join("\n");

describe("the states (AC-5)", () => {
  it("is empty with one action, and the confirm says why it can't add", () => {
    // Beside Search and By hand now (task 1.4c), under Add books' own heading.
    expect(container.querySelector("h2")!.textContent).toBe("Or paste a list");
    expect(container.querySelector(".paste-lede")!.textContent)
      .toBe("Matched against your library first. You confirm anything ambiguous.");
    expect(container.querySelector(".slate")!.textContent).toContain("Nothing to review yet.");
    expect(container.querySelectorAll(".slate button")).toHaveLength(1);
    expect(checkButton()).toBeNull();
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    expect(confirmButton().getAttribute("aria-describedby")).toBe("add-reason");
    expect(reason()).toBe("Paste a list of books to add");
  });

  it("asks you to check pasted lines, and says so while it checks", async () => {
    let answer!: () => void;
    fetchMock.mockImplementationOnce(async (_u: string, init?: RequestInit) => {
      await new Promise<void>((r) => { answer = r; });
      const body = JSON.parse(init!.body as string);
      return Response.json({ answers: body.lines.map(() => ({ match: null, near: null })) });
    });
    await type("Golden Son - Pierce Brown\nHyperion - Dan Simmons");
    expect(checkButton()!.textContent).toBe("Check 2 lines");
    expect(reason()).toBe("Check 2 lines first");
    expect(rows().map((r) => r.querySelector(".vcheck")!.textContent)).toEqual(["unverified", "unverified"]);

    await click(checkButton()!);
    expect(checkButton()!.textContent).toBe("Checking 2 lines…");
    expect(checkButton()!.getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector(".review-status")!.textContent).toBe("Checking 2 lines against your library…");
    expect(rows().map((r) => r.querySelector(".vcheck")!.textContent)).toEqual(["checking…", "checking…"]);
    await act(async () => answer());
    expect(checkButton()).toBeNull();
    expect(reason()).toBeNull();
    expect(confirmButton().textContent).toBe("Add 2 books");
  });

  it("a failed check is a neutral line with Try again, and keeps your lines", async () => {
    failCheck = true;
    await type("Golden Son - Pierce Brown");
    await click(checkButton()!);
    const error = container.querySelector(".neutral-error")!;
    expect(error.textContent).toContain("Couldn't check your library. Your lines are still here.");
    expect(error.querySelector('span[aria-hidden="true"]')!.textContent).toBe("×");
    expect(container.querySelector("textarea")!.value).toBe("Golden Son - Pierce Brown");
    failCheck = false;
    await click([...error.querySelectorAll("button")].find((b) => b.textContent === "Try again")!);
    expect(container.querySelector(".neutral-error")).toBeNull();
    expect(confirmButton().textContent).toBe("Add 1 book");
  });
});

describe("the review (AC-3, AC-5)", () => {
  it("draws glyphs with text, named radiogroups, and holds the confirm while a line needs a choice", async () => {
    await type(PASTE);
    await click(checkButton()!);

    expect(glyphs().map((g) => g.textContent)).toEqual(["✓", "!", "✓", "!", "×"]);
    expect(glyphs().map((g) => g.getAttribute("aria-label"))).toEqual(["OK", "Needs a choice", "OK", "Needs a choice", "Error"]);
    expect(rows().map((r) => r.querySelector(".vcheck")!.textContent))
      .toEqual(["in library", "similar 0.78", "new", "new", "malformed"]);
    // The near-duplicate names its closest match and defaults to Create new.
    expect(rows()[1].querySelector(".vm")!.textContent)
      .toBe("Close to The Name of the Wind - Patrick Rothfuss in your library (similarity 0.78).");
    const near = groupsOf(rows()[1])[0];
    expect([...near.querySelectorAll("label")].map((l) => l.textContent)).toEqual(["Create new", "Use that", "Drop"]);
    expect(near.querySelector<HTMLInputElement>("input:checked")!.value).toBe("create");
    for (const g of rows().flatMap(groupsOf)) {
      expect(g.getAttribute("aria-label")).toMatch(/^Decision, line \d+$/);
      expect(g.querySelectorAll('input[type="radio"]').length).toBe(g.querySelectorAll("label").length);
    }
    expect(rows()[4].querySelector('[role="radiogroup"]')!.getAttribute("aria-invalid")).toBe("true");

    // Before They Are Hanged has no author: nothing until it is decided.
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    expect(reason()).toBe("Resolve 1 line to add");
    await click(confirmButton());
    expect(confirms()).toEqual([]);
    expect(document.activeElement).toBe(container.querySelector("#add-reason"));

    await act(async () => groupsOf(rows()[3])[0].querySelector<HTMLInputElement>('input[value="drop"]')!.click());
    await act(async () => near.querySelector<HTMLInputElement>('input[value="use"]')!.click());
    expect(reason()).toBeNull();
    // Golden Son only: the Wint line points at the Wind, which already has a status.
    expect(confirmButton().textContent).toBe("Add 1 book");
    await click(confirmButton());
    expect(confirms()).toEqual([{ items: [
      { line: 2, use: WIND.bookId },
      { line: 3, title: "Golden Son", author: "Pierce Brown", series: "Red Rising", position: 2 },
    ], destination: { kind: "someday" } }]);
    // Then on (To read, or the sheet closes), with a toast saying what was added, and its Undo (task 1.4c).
    expect(onAdded).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".toast-region .toast-label")!.textContent).toBe("1 book added to Someday");
    expect(container.querySelector(".toast-region .toast-detail")).toBeNull();
    expect(container.querySelector(".toast-region .toast-undo")!.textContent).toBe("Undo");
    // Held until the page changes: a second tap can't add again.
    expect(confirmButton().textContent).toBe("Add 1 book");
    expect(reason()).toBe("Adding…");
    await click(confirmButton());
    expect(confirms()).toHaveLength(1);
  });

  it("the toast counts books you already had apart", async () => {
    library["the name of the wind"] = { match: { ...WIND, status: null }, near: null };
    await type("The Name of the Wind - Patrick Rothfuss\nGolden Son - Pierce Brown");
    await click(checkButton()!);
    fetchMock.mockImplementationOnce(async () => Response.json({
      ok: true, created: ["golden-son-pierce-brown"], matched: [], added: ["golden-son-pierce-brown", WIND.bookId],
    }));
    await click(confirmButton());
    expect(container.querySelector(".toast-region .toast-label")!.textContent).toBe("2 books added to Someday");
    expect(container.querySelector(".toast-region .toast-detail")!.textContent).toBe("1 already in your library");
  });

  it("a failed add writes nothing and keeps your lines", async () => {
    await type("Golden Son - Pierce Brown");
    await click(checkButton()!);
    fetchMock.mockImplementationOnce(async () => new Response("{}", { status: 500 }));
    await click(confirmButton());
    expect(container.querySelector('[role="alert"]')!.textContent)
      .toBe("× Couldn't add them. Nothing was written; your lines are still here.");
    expect(container.querySelector("textarea")!.value).toBe("Golden Son - Pierce Brown");
    expect(onAdded).not.toHaveBeenCalled();
    expect(reason()).toBeNull();
  });
});

describe("Add to and undo (task 1.4c)", () => {
  it("sends Add to's shelf, says it in the toast, and its Undo sends back exactly what the add wrote", async () => {
    act(() => root.render(
      <UndoProvider>
        <PasteBooks level={3} target={{ kind: "shelf", shelfId: "cosmere", name: "Cosmere" }}
          cancel={<button type="button" className="btn sec">Cancel</button>} onAdded={onAdded} />
      </UndoProvider>));
    expect(container.querySelector("h3")!.textContent).toBe("Or paste a list");
    await type("Golden Son - Pierce Brown");
    await click(checkButton()!);
    await click(confirmButton());
    expect(confirms()).toEqual([{ items: [{ line: 1, title: "Golden Son", author: "Pierce Brown", series: null, position: null }],
      destination: { kind: "shelf", shelfId: "cosmere" } }]);
    expect(container.querySelector(".toast-region .toast-label")!.textContent).toBe("1 book added to Cosmere");

    fetchMock.mockImplementationOnce(async () => Response.json({ ok: true }));
    await click(container.querySelector(".toast-region .toast-undo")!);
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect([url, init.method, JSON.parse(init.body)]).toEqual(["/api/books", "DELETE",
      { destination: { kind: "shelf", shelfId: "cosmere" }, created: ["golden-son-pierce-brown"], added: ["golden-son-pierce-brown"] }]);
  });
});
