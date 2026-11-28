// @vitest-environment happy-dom
// Task 2.0c (TASK-153, AC-2): a pace save drops the router cache once it has landed, so the Plan screen
// and the books dashboard show the new capacity on their next visit without a reload. A held stepper is
// one PATCH (2.0b) and so one refresh, after that save succeeds, not one per step; a save that fails
// refreshes nothing, and its Retry refreshes once when it lands. Fake timers run the hold and the 500 ms
// wait. Back, the nav and the dashboard in a real browser are test/e2e/settings.spec.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaceSettings from "../src/components/PaceSettings";
import { UndoProvider } from "../src/components/Undo";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const router = { push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/settings" }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** Each PATCH waits on one of these, so a test decides when (and how) the save answers. */
let answers: ((res: Response) => void)[];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  router.refresh.mockClear();
  answers = [];
  fetchMock = vi.fn(() => new Promise<Response>((resolve) => answers.push(resolve)));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<UndoProvider><PaceSettings initial={DEFAULT_SETTINGS} year={2026} /></UndoProvider>));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const plus = () => container.querySelector<HTMLButtonElement>('button[aria-label="Increase minutes a day"]')!;
const minutes = () => container.querySelector('[role="group"][aria-label="Minutes a day"] output')!.textContent;
const patches = () => fetchMock.mock.calls.filter(([u, i]) => u === "/api/settings" && i?.method === "PATCH");
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const answer = (status: number) => act(async () => { answers.shift()!(new Response("{}", { status })); });

/** Holds + for `ms`, then lets go, as a pointer does: down, the repeats, up, and the click that ends a hold. */
async function hold(ms: number) {
  const button = plus();
  act(() => { button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })); });
  await wait(ms);
  act(() => {
    button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, pointerType: "mouse" }));
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
  });
}

describe("a pace save drops the router cache (TASK-153, AC-2)", () => {
  it("a held + sends one PATCH, and the cache is dropped once, after that save succeeds", async () => {
    await hold(1500);
    const held = Number(minutes());
    expect(held).toBeGreaterThan(DEFAULT_SETTINGS.minutesPerDay + 2); // the hold repeated, more than once
    expect(router.refresh).not.toHaveBeenCalled(); // not on a step

    await wait(500);
    expect(patches()).toHaveLength(1);
    expect(JSON.parse(patches()[0][1].body)).toEqual({ minutesPerDay: held });
    expect(router.refresh).not.toHaveBeenCalled(); // not before the save has answered

    await answer(200);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    await wait(2000);
    expect(patches()).toHaveLength(1);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("a save that fails drops nothing; its Retry, once it lands, drops the cache once", async () => {
    act(() => { plus().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 })); });
    await wait(500);
    expect(patches()).toHaveLength(1);
    await answer(500);
    expect(router.refresh).not.toHaveBeenCalled();
    expect(minutes()).toBe(String(DEFAULT_SETTINGS.minutesPerDay)); // put back, as 2.0 does

    const retry = [...document.querySelectorAll<HTMLButtonElement>(".toast button")].find((b) => b.textContent === "Retry")!;
    act(() => { retry.click(); });
    await wait(0);
    expect(patches()).toHaveLength(2);
    expect(router.refresh).not.toHaveBeenCalled();
    await answer(200);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
});
