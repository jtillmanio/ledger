// @vitest-environment happy-dom
// Task 1.8: the sync pill says `online` or `offline` and nothing else (the
// `queued` state arrives with the offline queue, 6.4). A 6px dot plus --ink-2
// text, never green text on glass, announced as a status.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import SyncPill from "../src/components/nav/SyncPill";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let online = true;

function setOnline(next: boolean) {
  online = next;
  act(() => { window.dispatchEvent(new Event(next ? "online" : "offline")); });
}

beforeEach(() => {
  online = true;
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("the sync pill (AC-3)", () => {
  it("reads online with a dot, as a status", () => {
    act(() => root.render(<SyncPill />));
    const pill = container.querySelector('[role="status"]')!;
    expect(pill.textContent).toBe("online");
    expect(pill.getAttribute("data-state")).toBe("online");
    expect(pill.querySelector("i")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("follows the browser's offline and online events, and says nothing else", () => {
    act(() => root.render(<SyncPill />));
    const pill = () => container.querySelector('[role="status"]')!;
    setOnline(false);
    expect(pill().textContent).toBe("offline");
    expect(pill().getAttribute("data-state")).toBe("offline");
    setOnline(true);
    expect(pill().textContent).toBe("online");
  });

  it("as the phone's strip, is empty while online and says offline when it is", () => {
    act(() => root.render(<SyncPill strip />));
    const strip = () => container.querySelector('[role="status"]')!;
    expect(strip().textContent).toBe("");
    expect(strip().classList.contains("sync-strip")).toBe(true);
    setOnline(false);
    expect(strip().textContent).toBe("offline");
    setOnline(true);
    expect(strip().textContent).toBe("");
  });
});
