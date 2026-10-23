// @vitest-environment happy-dom
// Task 1.8b, AC-3: `+ batch` opens the batch sheet: Mark next N (a stepper, one
// range request, one undo), Mark through… (the range sheet's date choice), and
// Log a session, which waits for 2.1b and says so.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rangeText } from "../src/components/BatchSheet";
import { ThumbBar, VerbsProvider, type BarConfig, type Upcoming } from "../src/components/ThumbBar";
import { UndoProvider } from "../src/components/Undo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
const refresh = vi.fn();

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    if (url === "/api/progress/range" && init?.method === "POST") {
      return new Response(JSON.stringify({ ok: true, inserted: body.placementIds, skipped: 0 }));
    }
    return new Response(JSON.stringify({ ok: true, deleted: 1 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  refresh.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.querySelectorAll(".sheet-host").forEach((n) => n.remove());
  vi.unstubAllGlobals();
});

const up = (id: number, n: number): Upcoming => ({ placement_id: id, label: `Uncanny X-Men (1963) #${n}`, type: "core", notes: null });
const upcoming = [up(4, 141), up(5, 142), up(6, 143), up(7, 144)];
const config: BarConfig = { kind: "comics", runId: "r", title: "Uncanny X-Men", read: 3, total: 10, upcoming, single: true };

function open(over: Partial<BarConfig> = {}) {
  act(() => root.render(
    <UndoProvider>
      <VerbsProvider config={{ ...config, ...over } as BarConfig} refresh={refresh}><ThumbBar variant="dash" /></VerbsProvider>
    </UndoProvider>,
  ));
  act(() => [...container.querySelectorAll<HTMLButtonElement>(".actionbar button")].find((b) => b.textContent === "+ batch")!.click());
}

const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]')!;
const button = (name: string) =>
  [...dialog().querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name || b.getAttribute("aria-label") === name)!;
const click = (name: string) => act(async () => button(name).click());
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

describe("the batch sheet", () => {
  it("opens from + batch with three rows: Mark the next, Mark through…, Log a session", () => {
    open();
    expect(dialog().querySelector("h2")!.textContent).toBe("Batch");
    expect(dialog().textContent).toContain("Uncanny X-Men · next unread is #141");
    expect(dialog().textContent).toContain("Mark the next");
    expect(dialog().textContent).toContain("Mark through…");
    expect(dialog().textContent).toContain("Log a session");
  });

  it("Mark next N: a stepper that shows the range, and one range request of that many placements", async () => {
    open();
    // Four are upcoming, so the stepper starts at four, not five.
    expect(dialog().querySelector("output")!.textContent).toBe("4");
    await click("Fewer");
    expect(dialog().querySelector("output")!.textContent).toBe("3");
    expect(dialog().textContent).toContain("#141–143");
    await click("Mark 3 read");

    expect(posts()).toHaveLength(1);
    const [url, init] = posts()[0];
    expect(url).toBe("/api/progress/range");
    expect(JSON.parse(init.body)).toEqual({ runId: "r", placementIds: [4, 5, 6], mode: "today" });
    // Done: the sheet closes and the page refreshes.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(refresh).toHaveBeenCalled();
    // One undo entry, saying what happened and how far along the run is.
    expect([...document.querySelectorAll(".toast-label, .toast-detail")].map((n) => n.textContent))
      .toEqual(["3 issues marked read", "6 of 10 in Uncanny X-Men"]);
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    expect(fetchMock.mock.calls.at(-1)).toEqual(["/api/progress/range", expect.objectContaining({ method: "DELETE" })]);
    expect(JSON.parse(fetchMock.mock.calls.at(-1)![1].body)).toEqual({ runId: "r", placementIds: [4, 5, 6] });
  });

  it("the stepper stays between one and the issues there are", async () => {
    open();
    for (let i = 0; i < 6; i++) await click("More");
    expect(dialog().querySelector("output")!.textContent).toBe("4");
    for (let i = 0; i < 6; i++) await click("Fewer");
    expect(dialog().querySelector("output")!.textContent).toBe("1");
    expect(dialog().textContent).toContain("#141");
  });

  it("Log a session is aria-disabled, says why in words, and sends nothing", async () => {
    open();
    const log = button("Log");
    expect(log.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(log.getAttribute("aria-describedby")!)!;
    expect(reason.textContent).toBe("Sessions aren't here yet.");
    await act(async () => log.click());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("Mark through… → Choose lists the unread rows, then the range sheet dates the range", async () => {
    open();
    await click("Choose");
    expect(dialog().querySelector("h2")!.textContent).toBe("Mark through…");
    expect([...dialog().querySelectorAll(".pick-label")].map((n) => n.textContent)).toEqual(upcoming.map((u) => u.label));

    await act(async () => dialog().querySelectorAll<HTMLButtonElement>(".pick-row")[1].click());
    // The same date choice as any range: Today, Pick a date, Spread, No date.
    expect(dialog().querySelector("h2")!.textContent).toBe("Mark 2 issues read");
    expect([...dialog().querySelectorAll(".opt")].map((n) => n.textContent)).toEqual(["Today", "Pick a date", "Spread over a range", "No date"]);
    await click("Mark 2 read");
    expect(JSON.parse(posts()[0][1].body)).toEqual({ runId: "r", placementIds: [4, 5], mode: "today" });
  });

  it("Back from the picker returns to the batch sheet; Cancel closes it", async () => {
    open();
    await click("Choose");
    await click("Back");
    expect(dialog().querySelector("h2")!.textContent).toBe("Batch");
    await click("Cancel");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("a range that fails to save stays open and says so; nothing is on the undo stack", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    open();
    await click("Mark 4 read");
    expect(dialog().querySelector('[role="alert"]')!.textContent).toContain("That didn't save");
    expect(document.querySelector(".toast-undo")).toBeNull();
  });
});

describe("rangeText", () => {
  it("is #141–145 on one series, A through B across series, and the one issue for one", () => {
    expect(rangeText(upcoming.slice(0, 3), true)).toBe("#141–143");
    expect(rangeText(upcoming.slice(0, 1), true)).toBe("#141");
    expect(rangeText([up(1, 8), up(2, 9)].map((u, i) => ({ ...u, label: ["X-Men (2019) #8", "Excalibur (2019) #1"][i] })), false))
      .toBe("X-Men (2019) #8 through Excalibur (2019) #1");
    expect(rangeText([], true)).toBe("");
  });
});
