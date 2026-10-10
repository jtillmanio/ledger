// @vitest-environment happy-dom
// Task 1.1 in the browser: selecting a range on the spine, the range sheet and
// its UX floor (R1-11, UX-N11, UX-N17, D-33), Adopt, and the run's copy menu.
// The endpoint and its date rules are test/range-marking.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunSpine from "../src/components/IssueRow";
import { UndoProvider } from "../src/components/Undo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = Parameters<typeof RunSpine>[0]["issues"][number];

/** Rows 1..n of run `r`: placement ids 101.., labels `Run #1`.. */
const rows = (n: number, edit: (row: Row, at: number) => Partial<Row> = () => ({})): Row[] =>
  Array.from({ length: n }, (_, k) => {
    const row: Row = {
      id: `i${k + 1}`, placement_id: 101 + k, sequence: k + 1, label: `Run #${k + 1}`, type: "core",
      notes: null, completed: false, read_elsewhere: [], read_elsewhere_when: null,
    };
    return { ...row, ...edit(row, k) };
  });

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let writeText: ReturnType<typeof vi.fn>;

/** A mouse or trackpad when `fine`, touch otherwise. */
function pointer(fine: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: fine && query.includes("pointer:fine"), media: query,
    addEventListener: () => {}, removeEventListener: () => {},
  }));
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, inserted: [], skipped: 0 })));
  vi.stubGlobal("fetch", fetchMock);
  writeText = vi.fn(async () => {});
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  pointer(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function render(issues: Row[], ranges: string | null = null) {
  act(() => root.render(
    <UndoProvider><RunSpine runId="r" title="Run" issues={issues} ranges={ranges} /></UndoProvider>,
  ));
}

const row = (n: number) => container.querySelectorAll<HTMLElement>(".iss")[n - 1];
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const heading = () => dialog()?.querySelector("h2")?.textContent;
const buttonNamed = (scope: ParentNode, name: string) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name);
const toastLines = () => [...container.querySelectorAll(".toast-label, .toast-detail")].map((n) => n.textContent);
const sent = () => fetchMock.mock.calls.map(([url, init]) =>
  ({ url, method: (init as RequestInit).method, body: JSON.parse((init as RequestInit).body as string) }));

const click = (el: Element, init: MouseEventInit = {}) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init }));
});
const hoverOn = (el: Element) => act(async () => {
  el.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, pointerType: "mouse" }));
});
const key = (target: EventTarget, k: string, init: KeyboardEventInit = {}) => act(async () => {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
});
/** The row body: a click there is not a click on the checkbox. */
const body = (n: number) => row(n).querySelector(".ib")!;
const openRowMenu = async (n: number) => {
  const trigger = row(n).querySelector<HTMLButtonElement>(".rowmenu-btn")!;
  await click(trigger);
  return trigger;
};

describe("selecting a range with a fine pointer (UX-N17)", () => {
  it("a click on the fifth row and a shift-click on the twenty-second opens the sheet counting 18", async () => {
    render(rows(30));
    await click(body(5));
    expect(row(5).hasAttribute("data-anchor")).toBe(true);
    expect(dialog()).toBeNull();

    await hoverOn(row(22));
    const tinted = [...container.querySelectorAll(".iss")].filter((r) => r.hasAttribute("data-inrange"));
    expect(tinted).toHaveLength(18);
    expect(container.querySelector(".range-pill")?.textContent).toBe("Mark 18 read · Shift-click to finish");

    await click(body(22), { shiftKey: true });
    expect(heading()).toBe("Mark 18 issues read");
    expect(dialog()!.querySelector(".range-count")?.textContent).toBe("18 issues");
    expect(dialog()!.textContent).toContain("Run #5 through Run #22");
  });

  it("Esc clears the anchor", async () => {
    render(rows(10));
    await click(body(3));
    expect(row(3).hasAttribute("data-anchor")).toBe(true);
    await key(window, "Escape");
    expect(row(3).hasAttribute("data-anchor")).toBe(false);
    expect(container.querySelector(".range-pill")).toBeNull();
  });

  it("a single click never opens the sheet or prompts for a date: the box ticks one row", async () => {
    render(rows(10));
    await click(row(4).querySelector("button.chk")!);
    await click(body(6));
    expect(dialog()).toBeNull();
    expect(sent()).toEqual([{ url: "/api/progress/issue", method: "POST", body: { placementId: 104, completed: true } }]);
  });

  it("has no anchor, tint or pill with a coarse pointer", async () => {
    pointer(false);
    render(rows(10));
    await click(body(3));
    await hoverOn(row(6));
    expect(container.querySelector("[data-anchor], [data-inrange], .range-pill")).toBeNull();
    expect(dialog()).toBeNull();
  });
});

describe("selecting a range by touch", () => {
  it("a long-press runs from the first unread placement to the pressed row", async () => {
    pointer(false);
    vi.useFakeTimers();
    render(rows(12, (_, at) => ({ completed: at < 3 })));
    await act(async () => {
      row(8).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      vi.advanceTimersByTime(500);
    });
    expect(heading()).toBe("Mark 5 issues read");
    expect(dialog()!.textContent).toContain("Run #4 through Run #8");
  });

  it("a short tap is not a long-press", async () => {
    pointer(false);
    vi.useFakeTimers();
    render(rows(12));
    await act(async () => {
      row(8).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));
      vi.advanceTimersByTime(200);
      row(8).dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch" }));
      vi.advanceTimersByTime(1000);
    });
    expect(dialog()).toBeNull();
  });

  it("each row's menu offers Mark everything through here", async () => {
    pointer(false);
    render(rows(12, (_, at) => ({ completed: at < 2 })));
    await openRowMenu(6);
    const item = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    expect(item.textContent).toBe("Mark everything through here");
    await click(item);
    expect(heading()).toBe("Mark 4 issues read");
  });
});

describe("the range sheet (UX floor, R1-11)", () => {
  it("is a dialog labelled by its heading, which takes focus; the page behind is inert", async () => {
    render(rows(10));
    await openRowMenu(4);
    await click(document.querySelector('[role="menuitem"]')!);
    const h = dialog()!.querySelector("h2")!;
    expect(dialog()!.getAttribute("aria-modal")).toBe("true");
    expect(dialog()!.getAttribute("aria-labelledby")).toBe(h.id);
    expect(h.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(h);
    expect(container.hasAttribute("inert")).toBe(true);
  });

  it("offers four dates as real, named radio inputs, and no Original dates", async () => {
    render(rows(10));
    await openRowMenu(4);
    await click(document.querySelector('[role="menuitem"]')!);
    const radios = [...dialog()!.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios.map((r) => r.closest("label")!.textContent)).toEqual(["Today", "Pick a date", "Spread over a range", "No date"]);
    expect(radios.every((r) => r.name === "mode")).toBe(true);
    expect(radios[0].checked).toBe(true);
  });

  it("an unavailable confirm is aria-disabled with its reason shown, and sends nothing", async () => {
    render(rows(10));
    await openRowMenu(4);
    await click(document.querySelector('[role="menuitem"]')!);
    await click(dialog()!.querySelectorAll('input[type="radio"]')[2]);
    const confirm = buttonNamed(dialog()!, "Mark 4 read")!;
    expect(confirm.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(confirm.getAttribute("aria-describedby")!)!;
    expect(reason.textContent).toBe("Pick the day you started.");
    await click(confirm);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it("traps Tab inside", async () => {
    render(rows(10));
    await openRowMenu(4);
    await click(document.querySelector('[role="menuitem"]')!);
    const cancel = buttonNamed(dialog()!, "Cancel")!;
    cancel.focus();
    await key(cancel, "Tab");
    expect(document.activeElement).toBe(dialog()!.querySelector("input"));
    await key(document.activeElement!, "Tab", { shiftKey: true });
    expect(document.activeElement).toBe(cancel);
  });

  it.each([
    ["Esc", async () => key(document.activeElement!, "Escape")],
    ["Cancel", async () => click(buttonNamed(dialog()!, "Cancel")!)],
    ["Back", async () => act(async () => { window.dispatchEvent(new PopStateEvent("popstate")); })],
  ])("%s closes it, wakes the page and returns focus to the control that opened it", async (_, dismiss) => {
    render(rows(10));
    const trigger = await openRowMenu(4);
    await click(document.querySelector('[role="menuitem"]')!);
    expect(dialog()).not.toBeNull();
    await dismiss();
    expect(dialog()).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a range of 12 with 2 optional and 3 already read here", () => {
  const twelve = () => rows(12, (_, at) => ({ type: at === 1 || at === 6 ? "optional" : "core", completed: [3, 5, 9].includes(at) }));

  it("says 12 issues · 2 optional, then 9 marked and 3 kept, over the run count; one Undo deletes the 9", async () => {
    render(twelve());
    await click(body(1));
    await click(body(12), { shiftKey: true });
    expect(dialog()!.querySelector(".range-count")?.textContent).toBe("12 issues · 2 optional");

    const unread = twelve().filter((r) => !r.completed).map((r) => r.placement_id);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, inserted: unread, skipped: 3 })));
    await click(buttonNamed(dialog()!, "Mark 12 read")!);
    expect(sent()[0]).toEqual({
      url: "/api/progress/range", method: "POST",
      body: { runId: "r", placementIds: twelve().map((r) => r.placement_id), mode: "today" },
    });
    expect(dialog()).toBeNull();
    expect(toastLines()).toEqual(["9 issues marked read · 3 already read, kept their dates", "12 of 12 in Run"]);
    expect(container.querySelector(".run-count")?.textContent).toBe("12 of 12 read");

    await click(buttonNamed(container, "Undo")!);
    expect(sent()[1]).toEqual({ url: "/api/progress/range", method: "DELETE", body: { runId: "r", placementIds: unread } });
    expect(container.querySelector(".run-count")?.textContent).toBe("3 of 12 read");
  });

  it("stays open and says so when the write fails", async () => {
    render(twelve());
    await click(body(1));
    await click(body(12), { shiftKey: true });
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 500 }));
    await click(buttonNamed(dialog()!, "Mark 12 read")!);
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toContain("didn't save");
    expect(container.querySelector(".run-count")?.textContent).toBe("3 of 12 read");
  });
});

describe("Adopt N prior reads", () => {
  // Rows 2..10 are unread here and read in another run; row 11 is read in
  // another run and here too, so it is not adoptable.
  const adoptable = () => rows(12, (_, at) => ({
    read_elsewhere: at >= 1 && at <= 10 ? ["Other run"] : [],
    completed: at === 10,
  }));

  it("shows Adopt 9 prior reads, which opens the sheet on those 9 with Original dates", async () => {
    render(adoptable());
    const adopt = buttonNamed(container, "Adopt 9 prior reads")!;
    expect(adopt).toBeDefined();
    await click(adopt);
    expect(heading()).toBe("Mark 9 issues read");
    const original = [...dialog()!.querySelectorAll<HTMLInputElement>('input[type="radio"]')].at(-1)!;
    expect(original.closest("label")!.textContent).toBe("Original dates");
    expect(original.checked).toBe(true);

    await click(buttonNamed(dialog()!, "Mark 9 read")!);
    expect(sent()[0].body).toEqual({
      runId: "r", placementIds: adoptable().slice(1, 10).map((r) => r.placement_id), mode: "original",
    });
    await act(async () => {});
    expect(document.activeElement).toBe(adopt);
  });

  it("renders no Adopt control when no unread placement is read elsewhere", async () => {
    render(rows(12));
    expect([...container.querySelectorAll("button")].some((b) => b.textContent?.startsWith("Adopt"))).toBe(false);
  });
});

describe("the run's ⋯ menu", () => {
  const four = () => rows(4, (_, at) => ({ completed: at === 1 }));
  const copyItem = async (name: string) => {
    await click(container.querySelector<HTMLButtonElement>(".run-actions .more")!);
    const item = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find((b) => b.textContent === name)!;
    await click(item);
  };

  it("offers Copy unread · Copy all · Copy as ranges", async () => {
    render(four(), "Run #1-4");
    await click(container.querySelector<HTMLButtonElement>(".run-actions .more")!);
    expect([...document.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent))
      .toEqual(["Copy unread (3)", "Copy all (4)", "Copy as ranges"]);
  });

  it("copies the unread labels one per line in sequence order, confirmed by a status toast", async () => {
    render(four(), "Run #1-4");
    await copyItem("Copy unread (3)");
    expect(writeText).toHaveBeenCalledWith("Run #1\nRun #3\nRun #4");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Copied 3 unread issues");
  });

  it("copies every label, and the run's series text as ranges", async () => {
    render(four(), "Run #1-4");
    await copyItem("Copy all (4)");
    expect(writeText).toHaveBeenLastCalledWith("Run #1\nRun #2\nRun #3\nRun #4");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Copied 4 issues");
    await copyItem("Copy as ranges");
    expect(writeText).toHaveBeenLastCalledWith("Run #1-4");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Copied as ranges");
  });
});
