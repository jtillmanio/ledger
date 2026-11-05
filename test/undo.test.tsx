// @vitest-environment happy-dom
// Task 1.2: one undo stack for the app. Its entries are closures, so it is not
// coupled to progress rows (R1-09); a spine mark is just one caller. The toast
// says what happened (STYLE_GUIDE 14.3, 15) and lasts 8 seconds.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UNDO_MS, UndoProvider, useUndo, type UndoEntry } from "../src/components/Undo";
import RunSpine from "../src/components/IssueRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, prior: null })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const toast = () => container.querySelector<HTMLElement>(".toast");
const lines = () => [...container.querySelectorAll(".toast-label, .toast-detail")].map((n) => n.textContent);
const undoButton = () =>
  [...container.querySelectorAll<HTMLButtonElement>(".toast button")].find((b) => b.textContent === "Undo");
const pressUndo = async () => act(async () => undoButton()!.click());
const ctrlZ = async (target: EventTarget = document.body, init: KeyboardEventInit = { ctrlKey: true }) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true, cancelable: true, ...init }));
  });
const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

/** Pushes whatever entry it is given: a caller that has nothing to do with progress. */
function Pusher({ entry }: { entry: UndoEntry }) {
  const { push } = useUndo();
  return <button type="button" id="push" onClick={() => push(entry)}>push</button>;
}
const push = async () => act(async () => container.querySelector<HTMLButtonElement>("#push")!.click());

describe("the undo stack takes any inverse", () => {
  it("runs a pushed closure once on Undo and pops it", async () => {
    const fn = vi.fn(async () => {});
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: fn }} /></UndoProvider>));
    await push();
    expect(lines()).toEqual(["x"]);
    await pressUndo();
    expect(fn).toHaveBeenCalledOnce();
    // Popped: no toast, and neither a second press nor Ctrl+Z runs it again.
    expect(toast()).toBeNull();
    expect(undoButton()).toBeUndefined();
    await ctrlZ();
    expect(fn).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes the entry off before it runs, so a double press can't run it twice", async () => {
    let finish!: () => void;
    const fn = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: fn }} /></UndoProvider>));
    await push();
    const button = undoButton()!;
    await act(async () => { button.click(); button.click(); });
    await ctrlZ();
    await act(async () => finish());
    expect(fn).toHaveBeenCalledOnce();
  });

  it("Ctrl+Z and ⌘Z undo the toast's entry", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    let entry: UndoEntry = { label: "first", undo: first };
    const App = () => <UndoProvider><Pusher entry={entry} /></UndoProvider>;
    act(() => root.render(<App />));
    await push();
    await ctrlZ(document.body, { metaKey: true });
    expect(first).toHaveBeenCalledOnce();
    expect(toast()).toBeNull();
    entry = { label: "second", undo: second };
    act(() => root.render(<App />));
    await push();
    await ctrlZ();
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });

  // One toast at a time (task 1.8b, UX-N05, F3): the newer action commits the older one.
  it("a second push replaces the toast and commits the first: Undo and Ctrl+Z reach only the newest", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    let entry: UndoEntry = { label: "first", undo: first };
    const App = () => <UndoProvider><Pusher entry={entry} /></UndoProvider>;
    act(() => root.render(<App />));
    await push();
    entry = { label: "second", undo: second };
    act(() => root.render(<App />));
    await push();
    expect(container.querySelectorAll(".toast")).toHaveLength(1);
    expect(lines()).toEqual(["second"]);
    await ctrlZ();
    expect(second).toHaveBeenCalledOnce();
    // The first is committed: after the second is undone, nothing is left to undo.
    expect(toast()).toBeNull();
    await ctrlZ();
    expect(first).not.toHaveBeenCalled();
  });

  it("a notice or a failure also commits the entry before it", async () => {
    const fn = vi.fn(async () => {});
    function Both() {
      const { push, notify, fail } = useUndo();
      return (
        <>
          <button type="button" id="push" onClick={() => push({ label: "x", undo: fn })}>push</button>
          <button type="button" id="notify" onClick={() => notify("Copied")}>notify</button>
          <button type="button" id="fail" onClick={() => fail({ label: "That didn't save", retry: () => {} })}>fail</button>
        </>
      );
    }
    act(() => root.render(<UndoProvider><Both /></UndoProvider>));
    for (const id of ["notify", "fail"]) {
      await push();
      await act(async () => container.querySelector<HTMLButtonElement>(`#${id}`)!.click());
      expect(container.querySelectorAll(".toast")).toHaveLength(1);
      expect(undoButton()).toBeUndefined();
      await ctrlZ();
    }
    expect(fn).not.toHaveBeenCalled();
  });

  it("leaves Ctrl+Z alone while focus is in a text field", async () => {
    const fn = vi.fn(async () => {});
    act(() => root.render(
      <UndoProvider>
        <Pusher entry={{ label: "x", undo: fn }} />
        <input id="i" />
        <textarea id="t" />
        <div id="c" contentEditable suppressContentEditableWarning><span id="cs">text</span></div>
      </UndoProvider>,
    ));
    await push();
    for (const id of ["i", "t", "c", "cs"]) await ctrlZ(container.querySelector(`#${id}`)!);
    expect(fn).not.toHaveBeenCalled();
    // Shift is redo, not undo.
    await ctrlZ(document.body, { ctrlKey: true, shiftKey: true });
    expect(fn).not.toHaveBeenCalled();
    await ctrlZ();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("is a real button named Undo, inside a role=status region", async () => {
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", detail: "y", undo: async () => {} }} /></UndoProvider>));
    await push();
    expect(undoButton()!.tagName).toBe("BUTTON");
    expect(undoButton()!.type).toBe("button");
    expect(toast()!.closest('[role="status"]')).not.toBeNull();
    expect(lines()).toEqual(["x", "y"]);
  });
});

describe("the toast's lifetime", () => {
  it("is there at 7.9s and gone at 8.1s, and Undo is unavailable after", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {});
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: fn }} /></UndoProvider>));
    await push();
    expect(UNDO_MS).toBe(8000);
    act(() => vi.advanceTimersByTime(7900));
    expect(toast()).not.toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(toast()).toBeNull();
    expect(undoButton()).toBeUndefined();
    await ctrlZ();
    expect(fn).not.toHaveBeenCalled();
  });
});

// The countdown, the hold and focus (task 1.8b, AC-4).
describe("the toast's countdown and hold", () => {
  const hover = (on: boolean) => act(() => {
    toast()!.dispatchEvent(new MouseEvent(on ? "mouseover" : "mouseout", { bubbles: true }));
  });

  it("draws a countdown bar, and a new toast starts a fresh one", async () => {
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: async () => {} }} /></UndoProvider>));
    await push();
    const bar = toast()!.querySelector(".toast-count");
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("aria-hidden")).toBe("true");
    await push();
    expect(toast()!.querySelector(".toast-count")).not.toBe(bar);
  });

  it("hovering holds the toast: it stays past 8s while held and then has the time it had left", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {});
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: fn }} /></UndoProvider>));
    await push();
    act(() => vi.advanceTimersByTime(5000));
    hover(true);
    expect(toast()!.hasAttribute("data-held")).toBe(true);
    act(() => vi.advanceTimersByTime(60_000));
    expect(toast()).not.toBeNull();
    // Undo still works after a long hold: the hold does not count against the 8s.
    hover(false);
    expect(toast()!.hasAttribute("data-held")).toBe(false);
    act(() => vi.advanceTimersByTime(2900));
    expect(toast()).not.toBeNull();
    act(() => vi.advanceTimersByTime(200));
    expect(toast()).toBeNull();
    await ctrlZ();
    expect(fn).not.toHaveBeenCalled();
  });

  it("focus inside the toast holds it too", async () => {
    vi.useFakeTimers();
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x", undo: async () => {} }} /></UndoProvider>));
    await push();
    act(() => undoButton()!.focus());
    act(() => vi.advanceTimersByTime(20_000));
    expect(toast()).not.toBeNull();
    act(() => undoButton()!.blur());
    act(() => vi.advanceTimersByTime(8100));
    expect(toast()).toBeNull();
  });
});

describe("focus after the toast goes", () => {
  it("Undo hands focus back to the control that had it before the toast", async () => {
    act(() => root.render(
      <UndoProvider><Pusher entry={{ label: "x", undo: async () => {} }} /><button type="button" id="before">before</button></UndoProvider>,
    ));
    await push();
    const before = container.querySelector<HTMLButtonElement>("#before")!;
    act(() => before.focus());
    act(() => undoButton()!.focus());
    expect(document.activeElement).toBe(undoButton());
    await pressUndo();
    expect(toast()).toBeNull();
    expect(document.activeElement).toBe(before);
  });

  it("falls back to the thumb bar's button when that control is gone", async () => {
    act(() => root.render(
      <UndoProvider>
        <Pusher entry={{ label: "x", undo: async () => {} }} />
        <div className="actionbar"><button type="button" className="btn" id="bar">Mark</button></div>
      </UndoProvider>,
    ));
    await push();
    // Outside React, so the test can take it away.
    const gone = document.createElement("button");
    container.append(gone);
    act(() => gone.focus());
    act(() => undoButton()!.focus());
    gone.remove();
    await pressUndo();
    expect(document.activeElement).toBe(container.querySelector("#bar"));
  });

  it("leaves focus alone when the toast never had it", async () => {
    act(() => root.render(
      <UndoProvider><Pusher entry={{ label: "x", undo: async () => {} }} /><button type="button" id="other">o</button></UndoProvider>,
    ));
    await push();
    const other = container.querySelector<HTMLButtonElement>("#other")!;
    act(() => other.focus());
    await ctrlZ();
    expect(document.activeElement).toBe(other);
  });
});

// The spine as a caller: what its entries say and what their inverse does.
type Row = Parameters<typeof RunSpine>[0]["issues"][number];
const row = (placement: number, label: string, completed: boolean): Row => ({
  id: label, placement_id: placement, sequence: placement, label, type: "core", notes: null,
  completed, read_elsewhere: [], read_elsewhere_when: null,
});
// Uncanny X-Men (1963) #138–147, the first three read.
const uncanny = Array.from({ length: 10 }, (_, n) => row(n + 1, `Uncanny X-Men (1963) #${138 + n}`, n < 3));
const krakoa = [
  row(1, "X-Men (2019) #7", true), row(2, "Marauders (2019) #1", true),
  row(3, "X-Men (2019) #8", false), row(4, "Excalibur (2019) #1", false),
];

const spine = (issues: Row[], title: string) => act(() => root.render(
  <UndoProvider><RunSpine runId="r" title={title} issues={issues} /></UndoProvider>,
));
const box = (label: string) =>
  container.querySelector<HTMLButtonElement>(`button.chk[aria-label="Mark ${label} read in this run"]`)!;
const tick = async (label: string) => act(async () => box(label).click());
const count = () => container.querySelector(".run-count")!.textContent;

describe("a mark on the spine", () => {
  it("says the issue, then the run's new count of its total in its title", async () => {
    spine(uncanny, "Uncanny X-Men");
    expect(count()).toBe("3 of 10 read");
    await tick("Uncanny X-Men (1963) #141");
    expect(lines()).toEqual(["#141 read", "4 of 10 in Uncanny X-Men"]);
    expect(toast()!.closest('[role="status"]')).not.toBeNull();
    expect(undoButton()).toBeDefined();
    expect(count()).toBe("4 of 10 read");
  });

  it("names the issue in full on a run that spans series", async () => {
    spine(krakoa, "Hickman — Krakoa");
    await tick("X-Men (2019) #8");
    expect(lines()).toEqual(["X-Men (2019) #8 read", "3 of 4 in Hickman — Krakoa"]);
  });

  it("Undo puts the row and the count back", async () => {
    spine(uncanny, "Uncanny X-Men");
    const before = box("Uncanny X-Men (1963) #141").getAttribute("aria-pressed");
    await tick("Uncanny X-Men (1963) #141");
    expect(box("Uncanny X-Men (1963) #141").getAttribute("aria-pressed")).toBe("true");
    await pressUndo();
    expect(box("Uncanny X-Men (1963) #141").getAttribute("aria-pressed")).toBe(before);
    expect(count()).toBe("3 of 10 read");
    // There was no row before the mark, so the inverse unticks.
    expect(sent()).toEqual([
      { placementId: 4, completed: true },
      { placementId: 4, completed: false },
    ]);
  });

  it("undoing an untick sends back the read's own date and precision", async () => {
    const prior = { completedAt: "2026-03-14 00:00:00+00", precision: "approximate" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, prior })));
    spine(uncanny, "Uncanny X-Men");
    await tick("Uncanny X-Men (1963) #140");
    expect(lines()).toEqual(["#140 unread", "2 of 10 in Uncanny X-Men"]);
    expect(count()).toBe("2 of 10 read");
    await ctrlZ();
    expect(sent()).toEqual([
      { placementId: 3, completed: false },
      { placementId: 3, completed: true, restore: prior },
    ]);
    expect(box("Uncanny X-Men (1963) #140").getAttribute("aria-pressed")).toBe("true");
    expect(count()).toBe("3 of 10 read");
  });

  it("a failed undo leaves the row as the database has it, and says so", async () => {
    spine(uncanny, "Uncanny X-Men");
    await tick("Uncanny X-Men (1963) #141");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await pressUndo();
    expect(box("Uncanny X-Men (1963) #141").getAttribute("aria-pressed")).toBe("true");
    expect(count()).toBe("4 of 10 read");
    expect(lines()).toEqual(["Couldn't undo #141 read. Nothing changed."]);
    expect(undoButton()).toBeUndefined();
  });

  it("a failed mark pushes nothing to undo", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    spine(uncanny, "Uncanny X-Men");
    await tick("Uncanny X-Men (1963) #141");
    // The failure toast offers Retry, never Undo (task 1.8d).
    expect(lines()).toEqual(["That didn't save"]);
    expect(undoButton()).toBeUndefined();
    expect(count()).toBe("3 of 10 read");
  });
});

// Task 2.2c (D-108, D-116): a finish's toast offers what the book belongs to.
describe("the finish's Keep going? row", () => {
  const chipButtons = () => [...container.querySelectorAll<HTMLButtonElement>(".toast-chip")];
  const chipText = () => chipButtons().map((b) => b.textContent);
  const f6 = async (target: EventTarget = document.activeElement ?? document.body) => act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "F6", bubbles: true, cancelable: true }));
  });
  const chip = (label: string, kind: string | undefined, entry: UndoEntry) =>
    ({ label, kind, take: vi.fn(async () => entry) });

  it("with no offer the toast has no Keep going? line", async () => {
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "x: read", undo: async () => {} }} /></UndoProvider>));
    await push();
    expect(container.querySelector(".toast-offer")).toBeNull();
    expect(toast()!.textContent).not.toContain("Keep going?");
  });

  it("draws one chip per offer under Keep going?, a group named by it; the finish's Undo undoes the finish alone", async () => {
    const finishUndo = vi.fn(async () => {});
    const a = chip("Mistborn", "series", { label: "Reading Mistborn", undo: async () => {} });
    const b = chip("Cosmere", undefined, { label: "Reading Cosmere", undo: async () => {} });
    act(() => root.render(<UndoProvider>
      <Pusher entry={{ label: "The Well of Ascension: read", undo: finishUndo, offer: [a, b] }} />
    </UndoProvider>));
    await push();
    const group = container.querySelector<HTMLElement>('.toast-offer[role="group"]')!;
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)!.textContent).toBe("Keep going?");
    expect(chipText()).toEqual(["Mistborn · series", "Cosmere"]);
    await pressUndo();
    expect(finishUndo).toHaveBeenCalledOnce();
    expect(a.take).not.toHaveBeenCalled();
    expect(b.take).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
  });

  it("a chip writes and pushes its own entry with the chips left; its Undo undoes the follow alone", async () => {
    const finishUndo = vi.fn(async () => {});
    const followUndo = vi.fn(async () => {});
    const a = chip("Mistborn", "series", { label: "Reading Mistborn", detail: "series · was not followed", undo: followUndo });
    const b = chip("Cosmere", undefined, { label: "Reading Cosmere", undo: async () => {} });
    act(() => root.render(<UndoProvider>
      <Pusher entry={{ label: "The Well of Ascension: read", undo: finishUndo, offer: [a, b] }} />
    </UndoProvider>));
    await push();
    await act(async () => chipButtons()[0].click());
    expect(a.take).toHaveBeenCalledOnce();
    expect(lines()).toEqual(["Reading Mistborn", "series · was not followed"]);
    expect(chipText()).toEqual(["Cosmere"]);
    await pressUndo();
    expect(followUndo).toHaveBeenCalledOnce();
    // One toast at a time: the finish is committed, and Ctrl+Z reaches nothing.
    await ctrlZ();
    expect(finishUndo).not.toHaveBeenCalled();
  });

  it("taking a chip with focus in the toast keeps focus in the next one, on its first chip left", async () => {
    const a = chip("Mistborn", "series", { label: "Reading Mistborn", undo: async () => {} });
    const b = chip("Cosmere", undefined, { label: "Reading Cosmere", undo: async () => {} });
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "read", undo: async () => {}, offer: [a, b] }} /></UndoProvider>));
    await push();
    act(() => chipButtons()[0].focus());
    await act(async () => chipButtons()[0].click());
    expect(document.activeElement).toBe(chipButtons()[0]);
    expect(chipButtons()[0].textContent).toBe("Cosmere");
  });

  it("a chip that fails says so, with Retry, and changes nothing", async () => {
    const a = { label: "Mistborn", kind: "series", take: vi.fn(async (): Promise<UndoEntry> => { throw new Error("no"); }) };
    act(() => root.render(<UndoProvider><Pusher entry={{ label: "read", undo: async () => {}, offer: [a] }} /></UndoProvider>));
    await push();
    await act(async () => chipButtons()[0].click());
    expect(lines()).toEqual(["Couldn't save Mistborn. Nothing changed."]);
    expect([...container.querySelectorAll(".toast button")].map((x) => x.textContent)).toEqual(["Retry"]);
  });

  it("F6 moves focus to the toast's first control, Tab reaches the chips, F6 hands focus back (D-116)", async () => {
    const a = chip("Mistborn", "series", { label: "Reading Mistborn", undo: async () => {} });
    act(() => root.render(<UndoProvider>
      <input id="before" /><Pusher entry={{ label: "read", undo: async () => {}, offer: [a] }} />
    </UndoProvider>));
    await push();
    const before = container.querySelector<HTMLInputElement>("#before")!;
    act(() => before.focus());
    await f6(before);
    expect(document.activeElement).toBe(undoButton());
    // The chips follow Undo in the toast's own order, so Tab walks to them.
    const order = [...toast()!.querySelectorAll("button")];
    expect(order.indexOf(chipButtons()[0])).toBeGreaterThan(order.indexOf(undoButton()!));
    act(() => chipButtons()[0].focus());
    await f6();
    expect(document.activeElement).toBe(before);
  });

  it("Esc in the toast hands focus back; F6 with no toast does nothing", async () => {
    act(() => root.render(<UndoProvider>
      <input id="before" /><Pusher entry={{ label: "read", undo: async () => {} }} />
    </UndoProvider>));
    const before = container.querySelector<HTMLInputElement>("#before")!;
    act(() => before.focus());
    await f6(before);
    expect(document.activeElement).toBe(before);
    await push();
    act(() => before.focus());
    await f6(before);
    expect(document.activeElement).toBe(undoButton());
    await act(async () => {
      undoButton()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(document.activeElement).toBe(before);
  });
});

describe("a finish's offer as chips (follow-offer)", () => {
  it("offers Done with first, then each grouping, a series and a shelf with their kind; a chip posts reading and its Undo posts the prior back", async () => {
    const { offerChips } = await import("../src/lib/follow-offer");
    const g = (kind: "series" | "author" | "universe" | "shelf", id: string, name: string) =>
      ({ kind, id, name, read: 0, total: 1, unread: 1, state: null });
    const chips = offerChips({
      done: [g("series", "stormlight", "Stormlight")],
      take: [g("series", "mistborn", "Mistborn"), g("author", "sanderson", "Brandon Sanderson"),
        g("universe", "cosmere", "Cosmere"), g("shelf", "epic", "Epic fantasy")],
    });
    expect(chips.map((c) => [c.label, c.kind])).toEqual([
      ["Done with Stormlight", undefined], ["Mistborn", "series"], ["Brandon Sanderson", undefined],
      ["Cosmere", undefined], ["Epic fantasy", "shelf"],
    ]);
    expect(offerChips(null)).toEqual([]);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, prior: "reading" })));
    const done = await chips[0].take();
    expect(sent().at(-1)).toEqual({ kind: "series", id: "stormlight", state: "tracking" });
    expect([done.label, done.detail]).toEqual(["Tracking Stormlight", "series · was reading"]);
    await done.undo();
    expect(sent().at(-1)).toEqual({ kind: "series", id: "stormlight", state: "reading" });

    const take = await chips[1].take();
    expect(sent().at(-1)).toEqual({ kind: "series", id: "mistborn", state: "reading" });
    expect([take.label, take.detail]).toEqual(["Reading Mistborn", "series · was not followed"]);
    await take.undo();
    expect(sent().at(-1)).toEqual({ kind: "series", id: "mistborn", state: null });
  });
});
