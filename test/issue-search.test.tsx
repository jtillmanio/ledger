// @vitest-environment happy-dom
// Task 1.3b on screen: Add issues opens on Search (AC-2), searches only when
// submitted (AC-2), lists your catalog before Metron and stages results into
// 1.3c's review (AC-2, AC-3), and draws its loading, rate-limited and error
// states as role="status" lines (AC-4, AC-6). The search and the insert against
// the database are test/metron-search.test.ts.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchAnswer } from "../src/app/api/metron/search/route";
import AddIssues, { type AddContext } from "../src/components/AddIssues";
import { UndoProvider } from "../src/components/Undo";
import type { SearchResult } from "../src/lib/issue-search";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const thor = (n: number) => `Thor (1966) #${n}`;
const knownSeries = [{ title: "Thor", years: [1966] }];
const runs = [{ id: "thor", title: "Simonson — Thor" }];
/** Simonson — Thor: #330..#336 at 1..7. */
const thorRun = (): AddContext => ({
  run: { id: "thor", title: "Simonson — Thor" },
  placements: Array.from({ length: 7 }, (_, i) => ({ id: 1001 + i, sequence: i + 1, label: thor(330 + i), removed: false })),
});

const result = (n: number, over: Partial<SearchResult> = {}): SearchResult => ({
  key: thor(n).toLowerCase(), label: thor(n), issueId: null, metronId: 14525 + n - 337,
  coverDate: "1983-11-01", coverUrl: `https://static.metron.cloud/media/issue/2020/06/27/thor-v1-${n}.jpg`,
  runs: 0, runTitles: [], inThisRun: false, unparseable: false, idTaken: false, ...over,
});
const OK: SearchAnswer = {
  query: "thor 336-340", status: "ok",
  catalog: [
    result(336, { issueId: "thor-1966-336", runs: 1, inThisRun: true }),
    result(337, { issueId: "thor-1966-337", metronId: null, coverUrl: null, coverDate: null, runs: 2 }),
  ],
  metron: [result(338), result(339), result(340)],
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the search route answers next; a function to hold it back or fail it. */
let answer: () => Promise<Response>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  answer = async () => Response.json(OK);
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : null;
    if (url === "/api/metron/search") return answer();
    if (body?.dryRun) return Response.json({ matches: [], taken: [] });
    return Response.json({ ok: true, after: 7, created: [5001, 5002], restored: [], skipped: [], newIssues: [],
      revived: [], context: thorRun() });
  });
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/comics/thor/add");
});

afterEach(() => {
  vi.useRealTimers();
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function render() {
  act(() => root.render(<UndoProvider><AddIssues initial={thorRun()} knownSeries={knownSeries} runs={runs} /></UndoProvider>));
}

const searches = () => fetchMock.mock.calls.filter(([url]) => url === "/api/metron/search");
const input = () => container.querySelector<HTMLInputElement>("#issue-q")!;
const status = () => container.querySelector<HTMLElement>('[role="status"]#search-wait')!;
const searchButton = () => container.querySelector<HTMLButtonElement>('form[role="search"] button[type="submit"]')!;
const segButton = (name: string) => [...container.querySelectorAll<HTMLButtonElement>(".seg button")].find((b) => b.textContent === name)!;
const groups = () => [...container.querySelectorAll<HTMLElement>("ul.results")];
const confirmButton = () => [...container.querySelectorAll<HTMLButtonElement>(".add-buttons button")].at(-1)!;
const buttonNamed = (name: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name)!;
/** Let the stubbed fetches answer: microtasks only, so it works under fake timers too. */
const flush = () => act(async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
});

async function typeQuery(text: string) {
  for (let i = 1; i <= text.length; i++) {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), text.slice(0, i));
      input().dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
}

async function submit(text: string) {
  await typeQuery(text);
  await act(async () => {
    container.querySelector("form[role='search']")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await flush();
}

const css = readFileSync("src/app/globals.css", "utf8");
/** Every declaration block whose selector names one of these classes. */
const rulesFor = (...classes: string[]) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter(([, sel]) => classes.some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(sel)))
  .map(([, sel, body]) => `${sel.trim()}{${body}}`);

describe("Search is the default half (AC-2)", () => {
  it("opens on Search, with Type it the other half of the segmented control", () => {
    render();
    expect(segButton("Search").getAttribute("aria-pressed")).toBe("true");
    expect(segButton("Type it").getAttribute("aria-pressed")).toBe("false");
    expect(segButton("Search").hasAttribute("aria-disabled")).toBe(false);
    expect(input()).toBeTruthy();
    expect(container.querySelector("textarea")).toBeNull();
    act(() => segButton("Type it").click());
    expect(container.querySelector("textarea")).toBeTruthy();
  });

  it("empty: the query box and a slate, nothing staged, confirm held with its reason", () => {
    render();
    expect(container.querySelector("label[for='issue-q']")!.textContent).toBe("Series and number");
    expect(container.querySelector(".slate")!.textContent).toContain("Nothing staged yet");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("#add-reason")!.textContent).toBe("Search, then tap Add on the issues you want");
  });

  it("searches on submit, never per keystroke: ten characters typed make no call", async () => {
    render();
    await typeQuery("thor 337-3");
    await flush();
    expect(input().value).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      container.querySelector("form[role='search']")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(searches()).toHaveLength(1);
    expect(JSON.parse(searches()[0][1].body)).toEqual({ q: "thor 337-3", runId: "thor" });
  });
});

describe("results (AC-2, AC-3, AC-6)", () => {
  it("lists your catalog before Metron, with in N runs and already in this run", async () => {
    render();
    await submit("thor 336-340");
    const [catalog, metron] = groups();
    expect(catalog.getAttribute("aria-label")).toBe("In your catalog");
    expect(metron.getAttribute("aria-label")).toBe("From Metron");
    expect(catalog.compareDocumentPosition(metron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const [here, elsewhere] = [...catalog.querySelectorAll("li")];
    expect(here.textContent).toContain("already in this run");
    expect(here.querySelector("button")).toBeNull();
    expect(elsewhere.textContent).toContain("in 2 runs");
    expect([...metron.querySelectorAll(".rt")].map((e) => e.textContent)).toEqual([thor(338), thor(339), thor(340)]);
    expect(metron.querySelector(".rm")!.textContent).toBe("Nov 1983");
  });

  it("a catalog row in one run names it, as the mockup does", async () => {
    answer = async () => Response.json({ ...OK, metron: [], catalog: [
      result(1, { label: "Balder the Brave (1985) #1", key: "balder the brave (1985) #1", issueId: "bb-1", runs: 1, runTitles: ["Thor Tales"] }),
    ] });
    render();
    await submit("balder the brave 1");
    expect(groups()[0].querySelector(".tag")!.textContent).toBe("in 1 run · Thor Tales");
  });

  it("covers are decorative beside a text label; Add is a real, named button", async () => {
    render();
    await submit("thor 336-340");
    for (const img of container.querySelectorAll("ul.results img")) {
      expect(img.getAttribute("alt")).toBe("");
      expect(img.closest("li")!.querySelector(".rt")!.textContent).toBeTruthy();
    }
    // A comic with no cover gets a dashed, hidden placeholder, not an unlabelled image.
    expect(groups()[0].querySelectorAll("li")[1].querySelector(".cv.none")!.getAttribute("aria-hidden")).toBe("true");
    const adds = [...container.querySelectorAll<HTMLButtonElement>(".res-add")];
    expect(adds).toHaveLength(4);
    for (const b of adds) {
      expect(b.tagName).toBe("BUTTON");
      expect(b.getAttribute("type")).toBe("button");
      expect(b.getAttribute("aria-label")).toMatch(/^Add Thor \(1966\) #\d+$/);
      expect(b.getAttribute("aria-pressed")).toBe("false");
    }
    // At least 24px: .btn.sm's padding and .res-add's floor (measured at every viewport by ui-verifier).
    expect(rulesFor("res-add").join("")).toMatch(/min-height:32px/);
  });

  it("Add stages a result into the shared review, checked from Metron's answer, and Add N inserts it with Metron's id", async () => {
    render();
    await submit("thor 336-340");
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Add ${thor(337)}"]`)!.click());
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="Add ${thor(338)}"]`)!.click());
    expect(container.querySelector<HTMLButtonElement>(`[aria-label="Add ${thor(338)}"]`)!.getAttribute("aria-pressed")).toBe("true");
    const rows = [...container.querySelectorAll<HTMLElement>(".review .vrow")];
    expect(rows.map((r) => [r.querySelector(".vl")!.textContent, r.querySelector(".vcheck")!.textContent]))
      .toEqual([[thor(337), "in catalog"], [thor(338), "on Metron"]]);
    expect(rows[0].querySelector(".vm")!.textContent).toBe("Already in 2 runs.");
    expect(confirmButton().textContent).toBe("Add 2 issues");
    expect(container.querySelector(".insertprev .ip.new")!.textContent).toContain("Thor (1966) #337–338");

    await act(async () => confirmButton().click());
    await flush();
    const insert = fetchMock.mock.calls.find(([url, init]) => url === "/api/runs/thor/issues" && init?.method === "POST"
      && !JSON.parse(init.body).dryRun)!;
    expect(JSON.parse(insert[1].body)).toEqual({ labels: [thor(337), thor(338)], after: null, metronIds: [null, 14526] });
    // The search runs again, so its rows show what is now in the run.
    expect(searches()).toHaveLength(2);
    expect(container.querySelectorAll(".review .vrow")).toHaveLength(0);
  });

  it("a Metron result in a series the catalog doesn't have reads on Metron, and waits for its series choice", async () => {
    answer = async () => Response.json({ ...OK, catalog: [], metron: [
      result(1, { key: "journey into mystery (1952) #1", label: "Journey into Mystery (1952) #1" }),
    ] });
    render();
    await submit("journey into mystery 1");
    await act(async () => container.querySelector<HTMLButtonElement>(".res-add")!.click());
    const row = container.querySelector<HTMLElement>(".review .vrow")!;
    expect(row.querySelector(".vcheck")!.textContent).toBe("on Metron");
    expect(row.querySelector(".vm")!.textContent).toContain("No series called Journey into Mystery");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("a Metron label outside the grammar is staged with its flag and waits for a choice", async () => {
    answer = async () => Response.json({ ...OK, catalog: [], metron: [
      result(337, { key: "thor (1966) #337.bu", label: "Thor (1966) #337.BU", unparseable: true }),
    ] });
    render();
    await submit("thor 337");
    expect(groups()[0].textContent).toContain("not in the label grammar");
    await act(async () => container.querySelector<HTMLButtonElement>(".res-add")!.click());
    const row = container.querySelector<HTMLElement>(".review .vrow")!;
    expect(row.querySelector(".vd")!.textContent).toBe("×");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("#add-reason")!.textContent).toBe("Resolve 1 line to add");
  });
});

describe("the API states (AC-4, AC-6)", () => {
  it("loading: a status line and skeleton rows while the search is out", async () => {
    let release!: () => void;
    answer = () => new Promise((r) => { release = () => r(Response.json(OK)); });
    render();
    await typeQuery("thor 336-340");
    await act(async () => {
      container.querySelector("form[role='search']")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(status().textContent).toBe("Searching your catalog, then Metron…");
    expect(container.querySelectorAll(".results .sk").length).toBeGreaterThan(0);
    expect(searchButton().getAttribute("aria-disabled")).toBe("true");
    await act(async () => release());
    await flush();
    expect(status().textContent).toBe("");
  });

  it("rate-limited by Retry-After: 40 reads 40s, and its Type it instead carries the query to Type it", async () => {
    answer = async () => Response.json({ ...OK, status: "rate_limited", retryIn: 40, metron: [] });
    render();
    await submit("thor 336-340");
    const line = status().querySelector(".statusline.wait")!;
    expect(line.textContent).toContain("Metron is busy. Retrying in 40s.");
    expect(line.querySelector("b.mono")!.textContent).toBe("40s");
    const typeIt = [...line.querySelectorAll("button")].find((b) => b.textContent === "Type it instead")!;
    await act(async () => typeIt.click());
    expect(segButton("Type it").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("textarea")!.value).toBe("thor 336-340");
    expect(searches()).toHaveLength(1);
  });

  it("rate-limited: amber, a mono countdown to 0, Type it instead, then search works again and retries once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    answer = async () => Response.json({ ...OK, status: "rate_limited", retryIn: 3, metron: [] });
    render();
    await submit("thor 336-340");
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const line = status().querySelector(".statusline")!;
    expect(line.classList.contains("wait")).toBe(true);
    expect(line.querySelector("b.mono")!.textContent).toBe("3s");
    expect(line.textContent).toContain("Metron is busy. Retrying in 3s.");
    expect(searchButton().getAttribute("aria-disabled")).toBe("true");
    // The catalog's rows stay.
    expect(groups()[0].getAttribute("aria-label")).toBe("In your catalog");

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(line.querySelector("b.mono")!.textContent).toBe("2s");
    expect(searches()).toHaveLength(1);

    answer = async () => Response.json(OK);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(searches()).toHaveLength(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(searchButton().hasAttribute("aria-disabled")).toBe(false);
    expect(status().textContent).toBe("");
    // Amber is the held colour, in its own rule.
    expect(rulesFor("wait").join("")).toMatch(/var\(--blocked\)/);
  });

  it("rate-limited twice: the countdown reaches 0 and Search is enabled, with no second retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    answer = async () => Response.json({ ...OK, status: "rate_limited", retryIn: 1, metron: [] });
    render();
    await submit("thor 336-340");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(searches()).toHaveLength(2);
    expect(searchButton().hasAttribute("aria-disabled")).toBe(false);
    expect(status().textContent).toContain("Search again when you're ready");
  });

  it("error: a neutral line with a grey ×, nothing that resolves to --danger, Try again and Type it instead", async () => {
    answer = async () => new Response("{}", { status: 500 });
    render();
    await submit("thor 336-340");
    const line = status().querySelector(".statusline")!;
    expect(line.classList.contains("err")).toBe(true);
    expect(line.querySelector(".x")!.textContent).toBe("×");
    expect(line.textContent).toContain("Metron did not answer. Nothing was added.");
    // Every rule whose last compound's classes are all on the element is one that can style it.
    const applying = (el: Element) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, sel]) =>
      sel.split(",").some((s) => {
        const classes = [...(s.trim().split(/[\s>+~]+/).at(-1) ?? "").matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
        return classes.length > 0 && classes.every((c) => el.classList.contains(c));
      })).map(([, sel, body]) => `${sel.trim()}{${body}}`);
    const styled = [line, ...line.querySelectorAll("*")].flatMap(applying);
    expect(styled.length).toBeGreaterThan(0);
    expect(styled.filter((r) => r.includes("--danger"))).toEqual([]);

    answer = async () => Response.json(OK);
    await act(async () => buttonNamed("Try again").click());
    await flush();
    expect(searches()).toHaveLength(2);
    expect(groups()).toHaveLength(2);
  });

  it("Metron not set up here: says so, and the catalog's rows still show", async () => {
    answer = async () => Response.json({ ...OK, status: "error", unconfigured: true, metron: [] });
    render();
    await submit("thor 336-340");
    expect(status().textContent).toContain("Metron isn't set up here, so only your catalog was searched.");
    expect(groups()).toHaveLength(1);
  });

  it("Type it instead switches to Type it with the query in the textarea", async () => {
    answer = async () => new Response("{}", { status: 503 });
    render();
    await submit("balder the brave 1-4");
    await act(async () => buttonNamed("Type it instead").click());
    expect(segButton("Type it").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector("textarea")!.value).toBe("balder the brave 1-4");
  });

  it("nothing found, or too many numbers: a status line, and Type it instead", async () => {
    answer = async () => Response.json({ ...OK, catalog: [], metron: [] });
    render();
    await submit("thor 900");
    expect(status().textContent).toContain("Nothing in your catalog or on Metron for thor 900.");
    expect(buttonNamed("Type it instead")).toBeTruthy();

    answer = async () => Response.json({ ...OK, status: "too_many", catalog: [], metron: [] });
    await submit("thor 1-40");
    expect(status().textContent).toContain("Up to 10 issues a search.");
  });
});
