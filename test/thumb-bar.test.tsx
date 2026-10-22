// @vitest-environment happy-dom
// Task 1.8b, AC-2 and AC-3: the three slots, in their fixed order, named by the
// issue; the header repeating them in reverse; and the mark being the spine's own
// write, once, with the spine's own undo entry.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunSpine from "../src/components/IssueRow";
import { HeaderVerbs, ThumbBar, VerbsProvider, DashboardVerbs, type BarConfig, type Upcoming } from "../src/components/ThumbBar";
import { UndoProvider } from "../src/components/Undo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { refresh, router } = vi.hoisted(() => {
  const refresh = vi.fn();
  return { refresh, router: { refresh } };
});
vi.mock("next/navigation", () => ({ useRouter: () => router }));

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, prior: null })));
  vi.stubGlobal("fetch", fetchMock);
  refresh.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const up = (id: number, label: string): Upcoming => ({ placement_id: id, label, type: "core", notes: null });
const uncanny = [up(4, "Uncanny X-Men (1963) #141"), up(5, "Uncanny X-Men (1963) #142"), up(6, "Uncanny X-Men (1963) #143")];
const krakoa = [up(3, "X-Men (2019) #8"), up(4, "Excalibur (2019) #1")];

const comics = (over: Partial<Extract<BarConfig, { kind: "comics" }>> = {}): BarConfig => ({
  kind: "comics", runId: "r", title: "Uncanny X-Men", read: 3, total: 10, upcoming: uncanny, single: true, ...over,
});

function draw(config: BarConfig) {
  act(() => root.render(
    <UndoProvider>
      <VerbsProvider config={config}>
        <header><HeaderVerbs /></header>
        <ThumbBar variant="dash" />
      </VerbsProvider>
    </UndoProvider>,
  ));
}

/** Each control's accessible name, in DOM order. */
const names = (where: string) =>
  [...container.querySelectorAll<HTMLElement>(`${where} > *`)].map((el) => el.getAttribute("aria-label") ?? el.textContent);
const bar = () => names(".actionbar");
const header = () => names(".headverbs");
const mark = () => container.querySelector<HTMLButtonElement>(".actionbar .mark")!;
const sent = () => fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse((init as RequestInit).body as string)]);
const toastLines = () => [...container.ownerDocument.querySelectorAll(".toast-label, .toast-detail")].map((n) => n.textContent);

describe("the slots are fixed (AC-2)", () => {
  it("comics: Mark #141 read · + batch · Search on the bar, Search · + batch · Mark #141 read in the header", () => {
    draw(comics());
    expect(bar()).toEqual(["Mark #141 read", "+ batch", "Search (Ctrl K)"]);
    expect(header()).toEqual(["Search (Ctrl K)", "+ batch", "Mark #141 read"]);
  });

  it("the mark is the primary and the only filled slot: .btn, then .btn.sec, then the icon button", () => {
    draw(comics());
    const [first, second, third] = [...container.querySelectorAll(".actionbar > *")];
    expect(first.className).toBe("btn mark");
    expect(second.classList.contains("sec")).toBe(true);
    expect(third.classList.contains("iconbtn")).toBe(true);
  });

  it("names the issue by its full label when the run spans series, and truncates with a title", () => {
    draw(comics({ upcoming: krakoa, single: false }));
    expect(bar()[0]).toBe("Mark X-Men (2019) #8 read");
    expect(mark().title).toBe("Mark X-Men (2019) #8 read");
    expect(header().at(-1)).toBe("Mark X-Men (2019) #8 read");
  });

  it("the run detail: Mark #141 read · Mark through… · + Add issues", () => {
    const config: BarConfig = {
      kind: "run", runId: "r", title: "Uncanny X-Men", upcoming: uncanny, single: true,
      onMark: async () => true, onRange: async () => {},
    };
    draw(config);
    expect(bar()).toEqual(["Mark #141 read", "Mark through…", "Add issues"]);
    expect(container.querySelector(".actionbar a")!.getAttribute("href")).toBe("/comics/r/add");
  });

  it("an empty state is Search · Start {next} and nothing else: no batch, no finish", () => {
    draw({ kind: "empty", verb: { label: "Start Uncanny X-Men", href: "/comics/uncanny" } });
    expect(bar()).toEqual(["Start Uncanny X-Men", "Search (Ctrl K)"]);
    expect(header()).toEqual(["Search (Ctrl K)", "Start Uncanny X-Men"]);
    expect(container.querySelector(".actionbar a")!.getAttribute("href")).toBe("/comics/uncanny");
  });

  it("with nothing to start it offers Pick a run, and watch offers Save to inbox", () => {
    draw({ kind: "empty", verb: { label: "Pick a run", href: "/comics/runs" } });
    expect(header()).toEqual(["Search (Ctrl K)", "Pick a run"]);
    draw({ kind: "empty", verb: { label: "Save to inbox", href: "/inbox" } });
    expect(header()).toEqual(["Search (Ctrl K)", "Save to inbox"]);
  });

  it("books: Log progress · ✓ finished · Search; the header says Finished it · Log pages", () => {
    draw({ kind: "books" });
    expect(bar()).toEqual(["Log progress", "✓ finished", "Search (Ctrl K)"]);
    expect(header()).toEqual(["Search (Ctrl K)", "Finished it", "Log pages"]);
  });

  it("watch: Mark S2 watched · + Add · Search", () => {
    draw({ kind: "watch" });
    expect(bar()).toEqual(["Mark S2 watched", "+ Add", "Search (Ctrl K)"]);
  });

  it("a verb whose screen isn't built is drawn, aria-disabled, with its reason as a title", () => {
    draw({ kind: "books" });
    for (const el of container.querySelectorAll<HTMLElement>(".actionbar > *")) {
      expect(el.tagName).toBe("BUTTON");
      expect(el.getAttribute("aria-disabled")).toBe("true");
      expect(el.title).not.toBe("");
    }
  });

  it("a run read through has nothing to mark: the primary says so and is disabled", () => {
    draw(comics({ upcoming: [], single: false }));
    expect(bar()[0]).toBe("All read");
    expect(mark().getAttribute("aria-disabled")).toBe("true");
  });
});

describe("the mark is the spine's own write (AC-3)", () => {
  it("one request per tap, to the same endpoint, and the page refreshes", async () => {
    draw(comics());
    await act(async () => mark().click());
    expect(sent()).toEqual([["/api/progress/issue", { placementId: 4, completed: true }]]);
    // A second tap while the answer is showing sends nothing.
    await act(async () => mark().click());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(refresh).not.toHaveBeenCalled(); // VerbsProvider alone doesn't know the router
  });

  it("DashboardVerbs refreshes the page when the mark lands, and again on undo", async () => {
    act(() => root.render(
      <UndoProvider>
        <DashboardVerbs config={comics()}><ThumbBar variant="dash" /></DashboardVerbs>
      </UndoProvider>,
    ));
    await act(async () => mark().click());
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("pushes the same undo entry a spine tick does: same words, same inverse", async () => {
    // The thumb bar's mark of placement 4 …
    draw(comics());
    await act(async () => mark().click());
    const bar = { lines: toastLines(), calls: sent() };
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    const barCalls = sent();
    act(() => root.unmount());

    // … and the spine's tick of the same placement.
    root = createRoot(container);
    fetchMock.mockClear();
    const rows = Array.from({ length: 10 }, (_, n) => ({
      id: `i${n}`, placement_id: n + 1, sequence: n + 1, label: `Uncanny X-Men (1963) #${138 + n}`, type: "core",
      notes: null, completed: n < 3, read_elsewhere: [], read_elsewhere_when: null,
    }));
    act(() => root.render(<UndoProvider><RunSpine runId="r" title="Uncanny X-Men" issues={rows} /></UndoProvider>));
    await act(async () => container.querySelector<HTMLButtonElement>('button.chk[aria-label="Mark Uncanny X-Men (1963) #141 read in this run"]')!.click());
    expect(toastLines()).toEqual(bar.lines);
    expect(bar.lines).toEqual(["#141 read", "4 of 10 in Uncanny X-Men"]);
    expect(sent()).toEqual(bar.calls);
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    expect(sent()).toEqual(barCalls);
  });

  it("restores a read's own date on undo, as the spine does", async () => {
    const prior = { completedAt: "2026-03-14 00:00:00+00", precision: "approximate" };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, prior })));
    draw(comics());
    await act(async () => mark().click());
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    expect(sent()[1]).toEqual(["/api/progress/issue", { placementId: 4, completed: true, restore: prior }]);
  });

  it("a write that fails raises That didn't save with Retry, and nothing to undo", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    draw(comics());
    await act(async () => mark().click());
    expect(toastLines()).toEqual(["That didn't save"]);
    expect(document.querySelector(".toast-undo")!.textContent).toBe("Retry");
    expect(mark().dataset.state).toBe("idle");
    await act(async () => document.querySelector<HTMLButtonElement>(".toast-undo")!.click());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(toastLines()).toEqual(["#141 read", "4 of 10 in Uncanny X-Men"]);
  });
});

describe("the run detail's bar", () => {
  const rows = [
    { id: "a", placement_id: 1, sequence: 1, label: "X-Men (2019) #7", type: "core", notes: null, completed: true, read_elsewhere: [], read_elsewhere_when: null },
    { id: "b", placement_id: 2, sequence: 2, label: "Marauders (2019) #1", type: "core", notes: null, completed: false, read_elsewhere: [], read_elsewhere_when: null },
    { id: "c", placement_id: 3, sequence: 3, label: "X-Men (2019) #8", type: "core", notes: null, completed: false, read_elsewhere: [], read_elsewhere_when: null },
  ];

  it("names the next unread by its full label on a run spanning two series, and marks it with the spine's write", async () => {
    act(() => root.render(<UndoProvider><RunSpine runId="r" title="Krakoa" issues={rows} /></UndoProvider>));
    expect(container.querySelector(".actionbar.run")).not.toBeNull();
    expect(bar()).toEqual(["Mark Marauders (2019) #1 read", "Mark through…", "Add issues"]);
    await act(async () => mark().click());
    expect(sent()).toEqual([["/api/progress/issue", { placementId: 2, completed: true }]]);
    // The row ticked at once, and the toast names the issue.
    expect(container.querySelector('button.chk[aria-label="Mark Marauders (2019) #1 read in this run"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(toastLines()).toEqual(["Marauders (2019) #1 read", "2 of 3 in Krakoa"]);
  });

  it("Mark through… opens the pick list of unread rows", async () => {
    act(() => root.render(<UndoProvider><RunSpine runId="r" title="Krakoa" issues={rows} /></UndoProvider>));
    await act(async () => container.querySelector<HTMLButtonElement>('.actionbar button[aria-haspopup="dialog"]')!.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector("h2")!.textContent).toBe("Mark through…");
    expect([...dialog.querySelectorAll(".pick-label")].map((n) => n.textContent)).toEqual(["Marauders (2019) #1", "X-Men (2019) #8"]);
  });
});
