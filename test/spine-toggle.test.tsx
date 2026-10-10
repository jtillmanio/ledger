// @vitest-environment happy-dom
// The spine checkbox in a browser: ticking a row must stay ticked once the
// write lands. useOptimistic falls back to its base state when the transition
// ends, so a base that never learns about the save snaps the row back to the
// server's first render until the page is reloaded.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunSpine from "../src/components/IssueRow";
import { UndoProvider } from "../src/components/Undo";

const IssueList = ({ issues }: { issues: Parameters<typeof RunSpine>[0]["issues"] }) => (
  <UndoProvider><RunSpine runId="r" title="Run" issues={issues} /></UndoProvider>
);

// React only flushes act() work when it is told it is under test.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (completed: boolean) => ({
  id: "x", placement_id: 7, sequence: 1, label: "X-Men (2019) #8", type: "core",
  notes: null, completed, read_elsewhere: [], read_elsewhere_when: null,
});

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
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
});

const box = () => container.querySelector<HTMLButtonElement>("button.chk")!;
const ticked = () => box().getAttribute("aria-pressed");
const sent = () => fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string).completed);

async function click() {
  await act(async () => box().click());
}

describe("ticking a spine row", () => {
  it("stays ticked after the write lands", async () => {
    act(() => root.render(<IssueList issues={[row(false)]} />));
    await click();
    expect(ticked()).toBe("true");
    expect(sent()).toEqual([true]);
  });

  it("check, uncheck, check again ends ticked and sends each state", async () => {
    act(() => root.render(<IssueList issues={[row(false)]} />));
    await click();
    expect(ticked()).toBe("true");
    await click();
    expect(ticked()).toBe("false");
    await click();
    expect(ticked()).toBe("true");
    expect(sent()).toEqual([true, false, true]);
  });

  it("snaps back when the write fails", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("alert", vi.fn());
    act(() => root.render(<IssueList issues={[row(false)]} />));
    await click();
    expect(ticked()).toBe("false");
    expect(alert).toHaveBeenCalledOnce();
  });

  it("takes fresh rows from the server over its own", async () => {
    act(() => root.render(<IssueList issues={[row(false)]} />));
    await click();
    act(() => root.render(<IssueList issues={[row(false)]} />));
    expect(ticked()).toBe("false");
  });
});
