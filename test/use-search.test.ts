// @vitest-environment happy-dom
// Task 1.22: the search every box shares (src/lib/use-search.ts), with fake
// timers. At 3 characters it searches 500 ms after the last keystroke and not
// before; under 3 it sends nothing and clears what was shown; Enter sends at
// once and the pause then sends nothing more; a newer query aborts the older
// request's signal, and a late answer to the older query is dropped (AC-1's
// vitest, AC-2). The boxes on screen are test/add-book-sheet.test.tsx,
// test/issue-search.test.tsx and the e2e specs.
import { readFileSync } from "node:fs";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MIN_CHARS, PAUSE_MS, useSearch, type SearchState } from "../src/lib/use-search";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Call = { q: string; signal: AbortSignal; resolve: (answer: string) => void; reject: (e: unknown) => void };

let container: HTMLDivElement;
let root: Root;
let calls: Call[];
let api: ReturnType<typeof useSearch<string>>;
let answers: string[];

/** Every request waits until the test answers it, and ignores its signal: so a late answer can arrive. */
function fetcher(q: string, signal: AbortSignal) {
  return new Promise<string>((resolve, reject) => calls.push({ q, signal, resolve, reject }));
}

function Harness({ hold }: { hold: boolean }) {
  const search = useSearch(fetcher, { hold, onAnswer: (a: string) => answers.push(a) });
  useEffect(() => { api = search; });
  return null;
}

function mount(hold = false) {
  act(() => root.render(createElement(Harness, { hold })));
}

const type = (text: string) => act(() => api.change(text));
const wait = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const answer = (call: Call, a = `answer to ${call.q}`) => act(async () => { call.resolve(a); });
const state = (): SearchState<string> => api.state;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  calls = [];
  answers = [];
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("when it searches (AC-2)", () => {
  it("is 3 characters and a 500 ms pause", () => {
    expect([MIN_CHARS, PAUSE_MS]).toEqual([3, 500]);
  });

  it("at 3 characters, sends 500 ms after the last keystroke and not before", async () => {
    type("p");
    await wait(100);
    type("pi");
    await wait(100);
    type("pir");
    await wait(499);
    expect(calls).toHaveLength(0);
    expect(state()).toEqual({ phase: "idle" });
    await wait(1);
    expect(calls.map((c) => c.q)).toEqual(["pir"]);
    expect(state()).toEqual({ phase: "loading", q: "pir" });
    await answer(calls[0]);
    expect(state()).toEqual({ phase: "answered", q: "pir", answer: "answer to pir" });
    expect(answers).toEqual(["answer to pir"]);
  });

  it("at 2 characters and 600 ms nothing is sent, and the results shown clear", async () => {
    type("pir");
    await wait(500);
    await answer(calls[0]);
    expect(state().phase).toBe("answered");
    type("pi");
    expect(state()).toEqual({ phase: "idle" });
    await wait(600);
    expect(calls).toHaveLength(1);
    expect(state()).toEqual({ phase: "idle" });
  });

  it("two characters from the start send nothing", async () => {
    type("p");
    type("pi");
    await wait(600);
    expect(calls).toHaveLength(0);
  });

  it("piranesi typed quickly is one request, not six", async () => {
    for (let i = 1; i <= "piranesi".length; i++) {
      type("piranesi".slice(0, i));
      await wait(120);
    }
    await wait(500);
    expect(calls.map((c) => c.q)).toEqual(["piranesi"]);
  });

  it("spaces around the query don't count, and aren't sent", async () => {
    type("  pi  ");
    await wait(600);
    expect(calls).toHaveLength(0);
    type(" pir ");
    await wait(500);
    expect(calls.map((c) => c.q)).toEqual(["pir"]);
  });

  it("a pause on the query already shown asks nothing again", async () => {
    type("pir");
    await wait(500);
    await answer(calls[0]);
    type("pira");
    await wait(200);
    type("pir");
    await wait(600);
    expect(calls).toHaveLength(1);
  });
});

describe("Enter (AC-2)", () => {
  it("sends at once, and the pending pause sends nothing more", async () => {
    type("pir");
    await wait(100);
    let sent = false;
    act(() => { sent = api.submit(); });
    expect(sent).toBe(true);
    expect(calls.map((c) => c.q)).toEqual(["pir"]);
    await wait(1000);
    expect(calls).toHaveLength(1);
  });

  it("sends under 3 characters too, and an empty box sends nothing", async () => {
    let sent = true;
    act(() => { sent = api.submit(); });
    expect(sent).toBe(false);
    type("pi");
    act(() => { sent = api.submit(); });
    expect(sent).toBe(true);
    expect(calls.map((c) => c.q)).toEqual(["pi"]);
  });
});

describe("a newer query (AC-1, AC-2)", () => {
  it("aborts the older request's signal, and the older answer arriving late is dropped", async () => {
    type("pir");
    await wait(500);
    type("piranesi");
    await wait(500);
    expect(calls.map((c) => c.q)).toEqual(["pir", "piranesi"]);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
    await answer(calls[1]);
    await answer(calls[0]);
    expect(state()).toEqual({ phase: "answered", q: "piranesi", answer: "answer to piranesi" });
    expect(answers).toEqual(["answer to piranesi"]);
  });

  it("Enter on a newer query aborts the older one too", async () => {
    type("pir");
    await wait(500);
    type("piranesi");
    act(() => { api.submit(); });
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("going under 3 characters aborts the request out, and its answer is dropped", async () => {
    type("pir");
    await wait(500);
    type("pi");
    expect(calls[0].signal.aborted).toBe(true);
    await answer(calls[0]);
    expect(state()).toEqual({ phase: "idle" });
    expect(answers).toEqual([]);
  });

  it("a failed request is failed; an aborted one's failure is dropped", async () => {
    type("pir");
    await wait(500);
    type("piranesi");
    await wait(500);
    await act(async () => calls[0].reject(new DOMException("aborted", "AbortError")));
    expect(state()).toEqual({ phase: "loading", q: "piranesi" });
    await act(async () => calls[1].reject(new Error("500")));
    expect(state()).toEqual({ phase: "failed", q: "piranesi" });
    // After a failure the same query searches again on a pause.
    type("piranesi ");
    await wait(500);
    expect(calls.map((c) => c.q)).toEqual(["pir", "piranesi", "piranesi"]);
  });
});

describe("the rule (AC-4, D-84)", () => {
  it(".claude/rules/ui.md lets an add flow ask its API when the user submits or pauses typing", () => {
    const rule = readFileSync(".claude/rules/ui.md", "utf8").replace(/\s+/g, " ");
    expect(rule).toContain("when the user submits or pauses typing");
    expect(rule).not.toContain("when the user submits a search in Add");
  });
});

describe("run and hold", () => {
  it("run searches a query at once: Try again, a retry, a rerun", async () => {
    act(() => api.run("thor 337"));
    expect(calls.map((c) => c.q)).toEqual(["thor 337"]);
  });

  it("while held (a rate-limited wait), typing and Enter send nothing", async () => {
    mount(true);
    type("piranesi");
    await wait(600);
    act(() => { api.submit(); });
    expect(calls).toHaveLength(0);
    expect(api.q).toBe("piranesi");
  });
});
