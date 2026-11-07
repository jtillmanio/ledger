// @vitest-environment happy-dom
// Task 2.0b (F-21, D-123): a stepper's number can be typed, and a held − or + repeats. The
// Stepper alone (AC-1, AC-2, AC-3), then PaceSettings with fetch mocked (AC-4). Fake timers
// stand in for the hold; the touch rules (no text selection, no menu) are CSS, checked in the
// browser suite.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaceSettings from "../src/components/PaceSettings";
import Stepper from "../src/components/Stepper";
import { UndoProvider } from "../src/components/Undo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** A Stepper that keeps its own value, as PaceSettings does, and reports every change. */
function Harness({ start, min = 1, max = 600, step = 1, seen }: { start: number; min?: number; max?: number; step?: number; seen: number[] }) {
  const [value, setValue] = useState(start);
  return <Stepper label="Minutes a day" value={value} min={min} max={max} step={step} onChange={(n) => { seen.push(n); setValue(n); }} />;
}

function mount(props: Parameters<typeof Harness>[0]) {
  act(() => root.render(<Harness {...props} />));
}

const numberBtn = () => container.querySelector('button[aria-label="Edit minutes a day"]') as HTMLButtonElement;
const input = () => container.querySelector("input") as HTMLInputElement | null;
const plus = () => container.querySelector('button[aria-label="Increase minutes a day"]') as HTMLButtonElement;
const minus = () => container.querySelector('button[aria-label="Decrease minutes a day"]') as HTMLButtonElement;
const shown = () => (numberBtn() ?? input())?.textContent ?? "";
const text = () => container.textContent ?? "";

function fire(el: Element, type: string, init: Record<string, unknown> = {}) {
  const opts = { bubbles: true, cancelable: true, ...init };
  const ev = type.startsWith("key") ? new KeyboardEvent(type, opts)
    : type === "pointerleave" ? new PointerEvent("pointerout", { pointerType: "touch", ...opts }) // React derives onPointerLeave from pointerout
    : type.startsWith("pointer") ? new PointerEvent(type, { pointerType: "touch", ...opts })
    : new Event(type, opts);
  act(() => { el.dispatchEvent(ev); });
}
const pointer = (el: Element, type: string) => fire(el, type);
const tap = (el: HTMLElement) => { pointer(el, "pointerdown"); pointer(el, "pointerup"); act(() => el.click()); };
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Types into the open field the way a user would: React reads the native value setter. */
function type(value: string) {
  const el = input()!;
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => { set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); });
}
function key(k: string) {
  fire(input()!, "keydown", { key: k });
}
function open() {
  act(() => numberBtn().click());
}

describe("typing a number (AC-1, AC-2)", () => {
  it("the number is a button named for its row; a tap swaps it for a numeric input with the text selected", () => {
    mount({ start: 45, seen: [] });
    expect(numberBtn().textContent).toBe("45");
    expect(input()).toBeNull();
    open();
    expect(numberBtn()).toBeNull();
    expect(input()!.getAttribute("inputmode")).toBe("numeric");
    expect(input()!.value).toBe("45");
    expect(document.activeElement).toBe(input());
    expect(input()!.selectionStart).toBe(0);
    expect(input()!.selectionEnd).toBe(2);
  });

  it("typing 45 and Enter changes the value to 45 and returns focus to the number", () => {
    const seen: number[] = [];
    mount({ start: 30, seen });
    open();
    type("45");
    key("Enter");
    expect(seen).toEqual([45]);
    expect(shown()).toBe("45");
    expect(input()).toBeNull();
    expect(document.activeElement).toBe(numberBtn());
  });

  it("a value over the maximum commits the maximum and shows the reason", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("9000");
    key("Enter");
    expect(seen).toEqual([600]);
    expect(text()).toContain("The highest is 600");
    expect(plus().getAttribute("aria-disabled")).toBe("true");
  });

  it("a value under the minimum commits the minimum and shows the reason", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("0");
    key("Enter");
    expect(seen).toEqual([1]);
    expect(text()).toContain("The lowest is 1");
  });

  it("Esc puts the old value back, sends nothing and returns focus to the number", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("99");
    key("Escape");
    expect(seen).toEqual([]);
    expect(shown()).toBe("45");
    expect(document.activeElement).toBe(numberBtn());
  });

  it.each(["", "   ", "abc", "12.5", "-5", "1e3"])("%j changes nothing", (draft) => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type(draft);
    key("Enter");
    expect(seen).toEqual([]);
    expect(shown()).toBe("45");
    expect(input()).toBeNull();
  });

  it("leaving the field commits without Enter and does not pull focus back", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("50");
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    act(() => elsewhere.focus());
    expect(seen).toEqual([50]);
    expect(shown()).toBe("50");
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it("a whole number off the step stays as typed, and + goes on from it", () => {
    const seen: number[] = [];
    mount({ start: 185, step: 5, max: 400, seen });
    open();
    type("187");
    key("Enter");
    tap(plus());
    expect(seen).toEqual([187, 192]);
  });

  it("an open draft is committed when the page is left", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("52");
    fire(window as unknown as Element, "pagehide");
    expect(seen).toEqual([52]);
  });

  it("an open draft is committed when the screen unmounts", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    open();
    type("53");
    act(() => root.render(<div />));
    expect(seen).toEqual([53]);
  });

  it("keeps the value announced: one status output carries it", () => {
    mount({ start: 45, seen: [] });
    const outputs = container.querySelectorAll("output");
    expect(outputs).toHaveLength(1);
    expect(outputs[0].textContent).toBe("45");
  });
});

describe("hold to step (AC-3)", () => {
  it("a tap steps once", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    tap(plus());
    advance(2000);
    expect(seen).toEqual([46]);
  });

  it("nothing repeats before 400ms, then it repeats; the closing click adds no step", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    pointer(plus(), "pointerdown");
    advance(399);
    expect(seen).toEqual([]);
    advance(1);
    expect(seen).toEqual([46]);
    advance(300);
    expect(seen).toEqual([46, 47]);
    pointer(plus(), "pointerup");
    act(() => plus().click());
    expect(seen).toEqual([46, 47]);
    expect(shown()).toBe("47");
  });

  it("repeats faster after its first second, and never more than 500ms apart", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    pointer(plus(), "pointerdown");
    const stamps: number[] = [];
    let last = 0;
    for (let t = 1; t <= 3000; t++) {
      advance(1);
      if (seen.length > stamps.length) { stamps.push(t); last = t; }
    }
    expect(last).toBeGreaterThan(0);
    const gaps = stamps.slice(1).map((t, i) => t - stamps[i]);
    expect(Math.max(...gaps, stamps[0] - 0)).toBeLessThan(500);
    const early = gaps.filter((_, i) => stamps[i] < 1000);
    const late = gaps.filter((_, i) => stamps[i] >= 1400);
    expect(Math.min(...early)).toBeGreaterThan(Math.max(...late));
  });

  it.each(["pointerup", "pointerleave", "pointercancel"])("%s stops the repeat", (ending) => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    pointer(plus(), "pointerdown");
    advance(700);
    const n = seen.length;
    expect(n).toBeGreaterThan(0);
    pointer(plus(), ending);
    advance(3000);
    expect(seen).toHaveLength(n);
  });

  it("a hold of N repeats moves the value by N steps", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    pointer(minus(), "pointerdown");
    advance(2500);
    pointer(minus(), "pointerup");
    act(() => minus().click());
    expect(45 - Number(shown())).toBe(seen.length);
    expect(seen.length).toBeGreaterThan(3);
  });

  it("a hold that reaches the bound stops there with the button aria-disabled and the reason", () => {
    const seen: number[] = [];
    mount({ start: 597, seen });
    pointer(plus(), "pointerdown");
    advance(10_000);
    expect(seen).toEqual([598, 599, 600]);
    expect(plus().getAttribute("aria-disabled")).toBe("true");
    expect(text()).toContain("The highest is 600");
  });

  it("each repeat steps from the latest value, and a new press after a hold still steps once", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    pointer(plus(), "pointerdown");
    advance(800);
    pointer(plus(), "pointerleave");
    const held = seen.length;
    tap(plus());
    expect(seen).toHaveLength(held + 1);
    expect(seen[held]).toBe(45 + held + 1);
  });

  it("a keyboard press (a click with no pointer) steps once; Enter and Space on + each step once", () => {
    const seen: number[] = [];
    mount({ start: 45, seen });
    act(() => plus().click());
    expect(seen).toEqual([46]);
    act(() => plus().click());
    expect(seen).toEqual([46, 47]);
    advance(2000);
    expect(seen).toEqual([46, 47]);
  });

  it("the buttons refuse the context menu", () => {
    mount({ start: 45, seen: [] });
    const ev = new Event("contextmenu", { bubbles: true, cancelable: true });
    act(() => { plus().dispatchEvent(ev); });
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("PaceSettings sends one save (AC-4)", () => {
  const initial = { minutesPerDay: 45, wordsPerMinute: 185, wordsPerPage: 275 };
  const mountPace = () => act(() => root.render(<UndoProvider><PaceSettings initial={initial} year={2027} /></UndoProvider>));
  const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));

  it("a hold longer than a second sends one PATCH with the final value and only that field", async () => {
    mountPace();
    pointer(plus(), "pointerdown");
    advance(1500);
    pointer(plus(), "pointerup");
    act(() => plus().click());
    expect(fetchMock).not.toHaveBeenCalled();
    const final = Number(shown());
    expect(final).toBeGreaterThan(48);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sent()).toEqual([{ minutesPerDay: final }]);
  });

  it("a typed value and a − press inside 500ms send one PATCH", async () => {
    mountPace();
    open();
    type("50");
    key("Enter");
    advance(200);
    tap(minus());
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(sent()).toEqual([{ minutesPerDay: 49 }]);
  });

  it("a draft left open when the page is hidden is saved", async () => {
    mountPace();
    open();
    type("52");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fire(window as unknown as Element, "pagehide");
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(sent()).toEqual([{ minutesPerDay: 52 }]);
  });

  it("a typed word that isn't a number sends nothing", async () => {
    mountPace();
    open();
    type("abc");
    key("Enter");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(shown()).toBe("45");
  });

  it("a failed save puts the number back and raises the failed-write line with Retry", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    mountPace();
    open();
    type("60");
    key("Enter");
    expect(shown()).toBe("60");
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(shown()).toBe("45");
    expect(text()).toContain("Couldn't save your reading pace");
    expect(text()).toContain("Retry");
  });
});
