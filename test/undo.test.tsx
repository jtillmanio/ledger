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

  it("Ctrl+Z and ⌘Z undo the newest entry", async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    let entry: UndoEntry = { label: "first", undo: first };
    const App = () => <UndoProvider><Pusher entry={entry} /></UndoProvider>;
    act(() => root.render(<App />));
    await push();
    entry = { label: "second", undo: second };
    act(() => root.render(<App />));
    await push();
    expect(lines()).toEqual(["second"]);
    await ctrlZ();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(lines()).toEqual(["first"]);
    await ctrlZ(document.body, { metaKey: true });
    expect(first).toHaveBeenCalledOnce();
    expect(toast()).toBeNull();
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
    vi.stubGlobal("alert", vi.fn());
    spine(uncanny, "Uncanny X-Men");
    await tick("Uncanny X-Men (1963) #141");
    expect(toast()).toBeNull();
    expect(count()).toBe("3 of 10 read");
  });
});
