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

// A mark that finishes the run asks the server for the badge's date (task 1.6).
// The app router's instance is stable across renders, and so is this one.
const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const IssueList = ({ issues, lastRead }: {
  issues: Parameters<typeof RunSpine>[0]["issues"]; lastRead?: string;
}) => (
  <UndoProvider><RunSpine runId="r" title="Run" issues={issues} lastRead={lastRead} /></UndoProvider>
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
  refresh.mockClear();
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

describe("the resume pointer moves with a mark (task 1.6)", () => {
  const two = () => [
    { ...row(false), id: "a", placement_id: 1, sequence: 1, label: "Uncanny X-Men (1963) #141" },
    { ...row(false), id: "b", placement_id: 2, sequence: 2, label: "Uncanny X-Men (1963) #142" },
  ];
  const strip = () => container.querySelector(".nextis");
  const resume = () => container.querySelector("a.resume");

  it("ticking the pointer's row moves the strip, Resume and data-next to the next row", async () => {
    act(() => root.render(<IssueList issues={two()} />));
    expect(strip()!.getAttribute("aria-label")).toBe("Next: 1 of 2, Uncanny X-Men (1963) #141");
    await click();
    expect(strip()!.getAttribute("aria-label")).toBe("Next: 2 of 2, Uncanny X-Men (1963) #142");
    expect(resume()!.textContent).toBe("Resume #142");
    expect(resume()!.getAttribute("href")).toBe("#p-2");
    expect(container.querySelector("[data-next]")!.id).toBe("p-2");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("finishing the run swaps in the badge and asks the server once for its date", async () => {
    act(() => root.render(<IssueList issues={[row(false)]} lastRead="Jan 2020" />));
    await click();
    expect(strip()).toBeNull();
    expect(resume()).toBeNull();
    // Jan 2020 predates the read that just finished the run: no date until the server says.
    expect(container.querySelector(".bdg")!.textContent).toBe("✓ read");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("a run read when it loaded shows the server's date and asks for nothing", () => {
    act(() => root.render(<IssueList issues={[row(true)]} lastRead="Mar 2025" />));
    expect(container.querySelector(".bdg")!.textContent).toBe("✓ read · Mar 2025");
    expect(refresh).not.toHaveBeenCalled();
  });
});
