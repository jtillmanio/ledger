// @vitest-environment happy-dom
// Task 1.8b, AC-1 "the mark storyboard": press at 0, the green confirm at
// 120ms and still there at 700ms, the next label after 1.3s, and a write that
// fails never shows the confirm longer than the revert. The clock is faked, so
// each state is asserted at its time and not at "eventually".
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MarkButton, { CONFIRM_MS, NEXT_MS } from "../src/components/MarkButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const button = () => container.querySelector<HTMLButtonElement>("button")!;
const state = () => button().dataset.state;
const text = () => button().textContent;
const after = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const tap = () => act(async () => button().click());

function draw(props: { idle?: string; onMark?: () => Promise<boolean> | boolean; disabled?: boolean } = {}) {
  act(() => root.render(
    <MarkButton idle={props.idle ?? "Mark #141 read"} done="✓ #141 read"
      onMark={props.onMark ?? (async () => true)} disabled={props.disabled} />,
  ));
}

describe("the mark storyboard", () => {
  it("rests on the verb, in no state", () => {
    draw();
    expect(state()).toBe("idle");
    expect(text()).toBe("Mark #141 read");
  });

  it("presses at 0, turns green reading ✓ at 120ms, still at 700ms, and shows the next label at 1.3s", async () => {
    const onMark = vi.fn(async () => true);
    draw({ onMark });
    await tap();
    expect(onMark).toHaveBeenCalledOnce();
    expect([state(), text()]).toEqual(["press", "Mark #141 read"]);

    await after(CONFIRM_MS - 1);
    expect(state()).toBe("press");
    await after(1);
    expect([state(), text()]).toEqual(["confirm", "✓ #141 read"]);

    // The page behind has moved to #142 already; the button doesn't follow yet.
    draw({ idle: "Mark #142 read", onMark });
    await after(580);
    expect([state(), text()]).toEqual(["confirm", "✓ #141 read"]);

    await after(NEXT_MS - 700 - 1);
    expect(state()).toBe("confirm");
    await after(1);
    expect([state(), text()]).toEqual(["next", "Mark #142 read"]);
  });

  it("names the button what it shows, so a truncated label keeps its full name", async () => {
    draw();
    expect(button().getAttribute("aria-label")).toBe("Mark #141 read");
    expect(button().title).toBe("Mark #141 read");
    await tap();
    await after(CONFIRM_MS);
    expect(button().getAttribute("aria-label")).toBe("✓ #141 read");
  });

  it("ignores taps until the next label is there, then marks again", async () => {
    const onMark = vi.fn(async () => true);
    draw({ onMark });
    await tap();
    await tap();
    await after(CONFIRM_MS);
    await tap();
    await after(NEXT_MS);
    expect(onMark).toHaveBeenCalledOnce();
    await tap();
    expect(onMark).toHaveBeenCalledTimes(2);
    expect(state()).toBe("press");
  });

  it("does nothing, and says so to assistive tech, when there is nothing to mark", async () => {
    const onMark = vi.fn(async () => true);
    draw({ onMark, disabled: true });
    expect(button().getAttribute("aria-disabled")).toBe("true");
    await tap();
    expect(onMark).not.toHaveBeenCalled();
    expect(state()).toBe("idle");
  });
});

describe("a write that fails", () => {
  it("before 120ms never shows the confirm: it goes back to rest at once", async () => {
    let fail!: (ok: boolean) => void;
    draw({ onMark: () => new Promise<boolean>((resolve) => { fail = resolve; }) });
    await tap();
    await after(50);
    await act(async () => fail(false));
    expect(state()).toBe("idle");
    await after(NEXT_MS);
    expect(state()).toBe("idle");
    expect(text()).toBe("Mark #141 read");
  });

  it("after the confirm shows is reverted at once, not left green until 1.3s", async () => {
    let fail!: (ok: boolean) => void;
    draw({ onMark: () => new Promise<boolean>((resolve) => { fail = resolve; }) });
    await tap();
    await after(300);
    expect(state()).toBe("confirm");
    await act(async () => fail(false));
    expect([state(), text()]).toEqual(["idle", "Mark #141 read"]);
    await after(NEXT_MS);
    expect(state()).toBe("idle");
  });

  it("a rejected write is a failed write", async () => {
    draw({ onMark: async () => { throw new Error("offline"); } });
    await tap();
    expect(state()).toBe("idle");
  });

  it("can be tried again straight away", async () => {
    const onMark = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    draw({ onMark });
    await tap();
    await tap();
    expect(onMark).toHaveBeenCalledTimes(2);
    await after(CONFIRM_MS);
    expect(state()).toBe("confirm");
  });
});
