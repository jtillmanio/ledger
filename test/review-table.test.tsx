// @vitest-environment happy-dom
// Task 1.3c on screen: the Add issues *Type it* review table (AC-3), the
// insertion preview and the run chip (AC-4), the undo toast after an insert
// (AC-5), and the screen's empty, checking and error states (AC-6). The
// insert itself, against the database, is test/bulk-insert.test.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddIssues, { type AddContext } from "../src/components/AddIssues";
import { UndoProvider } from "../src/components/Undo";
import { parseBulk } from "../src/lib/bulk-parse";
import { buildReview } from "../src/lib/bulk-review";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CAP_YEARS = [1968, 1996, 1998, 2004, 2011, 2012, 2018, 2023];
const knownSeries = [{ title: "Thor", years: [1966] }, { title: "Captain America", years: CAP_YEARS }];
const runs = [{ id: "other", title: "Other run" }, { id: "thor", title: "Simonson — Thor" }];
const thor = (n: number) => `Thor (1966) #${n}`;

/** Simonson — Thor: #330..#342 at 1..13, placement ids 1001..; #339 removed. */
const thorRun = (): AddContext => ({
  run: { id: "thor", title: "Simonson — Thor" },
  placements: Array.from({ length: 13 }, (_, i) => ({
    id: 1001 + i, sequence: i + 1, label: thor(330 + i), removed: 330 + i === 339,
  })),
});
/** Another run, where only Thor #400 sits. */
const otherRun = (): AddContext => ({
  run: { id: "other", title: "Other run" },
  placements: [{ id: 2001, sequence: 1, label: thor(400), removed: false }],
});

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
/** What the dry run answers: label → runs, for labels the catalog "has". */
let catalog: Record<string, number>;
let failDryRun: boolean;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  catalog = { [thor(400)]: 3 };
  failDryRun = false;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body as string) : null;
    if (method === "GET") return Response.json(url.includes("/other/") ? otherRun() : thorRun());
    if (method === "POST" && body.dryRun) {
      if (failDryRun) return new Response("{}", { status: 500 });
      const matches = (body.labels as string[]).filter((l) => l in catalog)
        .map((l) => ({ key: l.toLowerCase(), issue_id: l, label: l, runs: catalog[l] }));
      return Response.json({ matches });
    }
    if (method === "POST") {
      return Response.json({ ok: true, after: 13, created: [5001, 5002], restored: [{ id: 1009, sequence: 10 }],
        skipped: [], newIssues: [], revived: [], context: thorRun() });
    }
    return Response.json({ ok: true, context: thorRun() });
  });
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/comics/thor/add");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

/** The screen on its *Type it* half: Search is the default since 1.3b (test/issue-search.test.tsx). */
function render(ctx = thorRun()) {
  act(() => root.render(
    <UndoProvider><AddIssues initial={ctx} knownSeries={knownSeries} runs={runs} /></UndoProvider>,
  ));
  act(() => [...container.querySelectorAll<HTMLButtonElement>(".seg button")]
    .find((b) => b.textContent === "Type it")!.click());
}

/** Let the debounced catalog check go out and come back. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 400)));

async function type(text: string) {
  const area = container.querySelector<HTMLTextAreaElement>("textarea")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, text);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

const rows = () => [...container.querySelectorAll<HTMLElement>(".review .vrow")];
const glyphs = () => rows().map((r) => r.querySelector(".vd")!.textContent);
const whys = () => rows().map((r) => r.querySelector(".vm")?.textContent ?? "");
const groupsOf = (row: HTMLElement) => [...row.querySelectorAll<HTMLElement>('[role="radiogroup"]')];
const optionsOf = (group: HTMLElement) => [...group.querySelectorAll("label")].map((l) => l.textContent);
const header = () => container.querySelector("h2.s .more")!.textContent;
const confirmButton = () => [...container.querySelectorAll<HTMLButtonElement>(".add-buttons button")].at(-1)!;
const pick = (row: HTMLElement, option: string) => act(async () => {
  const label = [...row.querySelectorAll("label")].find((l) => l.textContent === option)!;
  label.querySelector("input")!.click();
});
const click = (el: Element) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
const posts = () => fetchMock.mock.calls
  .filter(([, init]) => init?.method === "POST" && !JSON.parse(init.body).dryRun)
  .map(([url, init]) => ({ url, body: JSON.parse(init.body) }));

const PASTE = ["Thor #337", "Thor #339", "Thor #400", "Captain America #1", "Thor Annual 13", "Thor #340-337"].join("\n");

describe("the review table (AC-3)", () => {
  it("draws each row's glyph, line, why and a radiogroup that fits it", async () => {
    render();
    await type(PASTE);
    expect(glyphs()).toEqual(["✓", "✓", "✓", "!", "×", "×"]);
    expect(rows().map((r) => r.querySelector(".vl")!.textContent)).toEqual(PASTE.split("\n"));
    expect(whys()[0]).toMatch(/^Already in this run\./);
    expect(whys()[1]).toMatch(/^Restore — was removed\./);
    expect(whys()[2]).toMatch(/^Already in 3 runs\./);
    expect(whys()[3]).toBe("Eight volumes of Captain America. Pick one:");
    expect(whys()[4]).toBe("Missing the #. Did you mean Thor (1966) Annual #13?");
    expect(whys()[5]).toBe("#340-337 runs backwards. Write it #337-340.");

    const groups = rows().map(groupsOf);
    expect(groups.every((g) => g.length >= 1)).toBe(true);
    expect(optionsOf(groups[0][0])).toEqual(["Skip"]);
    expect(optionsOf(groups[2][0])).toEqual(["Add", "Drop"]);
    expect(optionsOf(groups[3][0])).toEqual([...CAP_YEARS.map(String), "Drop"]);
    expect(optionsOf(groups[4][0])).toEqual(["Use that", "Keep as typed", "Drop"]);
    expect(optionsOf(groups[5][0])).toEqual(["Drop"]);
    // Real radios with a name, in a named radiogroup.
    for (const g of groups.flat()) {
      expect(g.getAttribute("aria-label")).toBeTruthy();
      expect(g.querySelectorAll('input[type="radio"]').length).toBe(g.querySelectorAll("label").length);
    }
    // The failed rows, and only they, are aria-invalid and point at their why.
    expect(groups.map((g) => g[0].getAttribute("aria-invalid"))).toEqual([null, null, null, null, "true", "true"]);
    const describedBy = groups[4][0].getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)!.textContent).toContain("Missing the #");
  });

  it("counts the real insert in the header and the button, and holds confirm while a row needs a choice", async () => {
    render();
    await type(PASTE);
    // #339 restored, #400 placed, Thor Annual #13 by default: 3. Captain America still open.
    expect(header()).toBe("3 will be added");
    expect(confirmButton().textContent).toBe("Add 3 issues");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(confirmButton().getAttribute("aria-describedby")!)!;
    expect(reason.textContent).toBe("Resolve 1 line to add");

    await click(confirmButton());
    expect(posts()).toEqual([]);

    await pick(rows()[3], "2004");
    expect(header()).toBe("4 will be added");
    expect(confirmButton().textContent).toBe("Add 4 issues");
    expect(confirmButton().hasAttribute("aria-disabled")).toBe(false);

    await pick(rows()[2], "Drop");
    expect(header()).toBe("3 will be added");
  });

  it("says 9 for the mockup's paste: ten issues, one already in the run", async () => {
    const ctx = thorRun();
    ctx.placements = ctx.placements.filter((p) => ![338, 339, 340].some((n) => p.label === thor(n)));
    render(ctx);
    await type("Thor #337-340\nBalder the Brave #1-4\nCaptain America #1\nThor Annual 13");
    await pick(rows()[1], "Keep as typed");
    await pick(rows()[2], "2004");
    expect(header()).toBe("9 will be added");
    expect(confirmButton().textContent).toBe("Add 9 issues");
    expect(whys()[0]).toMatch(/^4 issues, 3 to add: #337 is already in this run\./);
  });
});

describe("the insertion preview and the run chip (AC-4)", () => {
  it("shows three rows either side of the insertion point, the new rows highlighted, at the end by default", async () => {
    render();
    await type("Thor #400\nThor #401");
    // A row reads as its label; the new row as its summary, then its count in mono.
    const preview = () => [...container.querySelectorAll<HTMLElement>(".insertprev .ip")];
    const text = (p: HTMLElement) => p.classList.contains("new")
      ? [...p.children].map((c) => c.textContent).join(" | ") : p.textContent;
    expect(container.querySelectorAll("h2.s .more")[1].textContent).toBe("at the end");
    expect(preview().map(text)).toEqual([thor(340), thor(341), thor(342), "+ Thor (1966) #400–401 | 2"]);
    expect(preview()[3].classList.contains("new")).toBe(true);

    const select = container.querySelector<HTMLSelectElement>(".ip-after")!;
    expect(select.value).toBe("end");
    await act(async () => {
      select.value = "1007"; // Thor #336
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelectorAll("h2.s .more")[1].textContent).toBe(`after ${thor(336)}`);
    expect(preview().map(text)).toEqual([
      thor(334), thor(335), thor(336), "+ Thor (1966) #400–401 | 2", thor(337), thor(338), thor(340),
    ]);
    expect(preview().filter((p) => p.classList.contains("new"))).toHaveLength(1);

    await click(confirmButton());
    expect(posts()[0].body).toEqual({ labels: [thor(400), thor(401)], after: 1007 });
  });

  it("names the run, and Change picks another without leaving the screen; the review re-runs there", async () => {
    render();
    await type("Thor #337\nThor #400");
    const chip = container.querySelector<HTMLElement>(".runchip")!;
    expect(chip.textContent).toBe("Adding to: Simonson — Thor · Change");
    expect(whys()[0]).toMatch(/^Already in this run\./);

    await click([...chip.querySelectorAll("button")].find((b) => b.textContent === "Change")!);
    const other = [...document.querySelectorAll<HTMLButtonElement>(".picker-run")].find((b) => b.textContent === "Other run")!;
    await click(other);
    await settle();

    expect(container.querySelector(".runchip")!.textContent).toBe("Adding to: Other run · Change");
    expect(window.location.pathname).toBe("/comics/other/add");
    // The same lines, checked against the other run: #337 is new there, #400 is already in it.
    expect(container.querySelector("textarea")!.value).toBe("Thor #337\nThor #400");
    expect(whys()[0]).not.toMatch(/this run/);
    expect(whys()[1]).toMatch(/^Already in this run\./);
    expect(header()).toBe("1 will be added");
  });
});

describe("after the insert (AC-5)", () => {
  it("shows an undo toast whose Undo sends back exactly what the insert did", async () => {
    render();
    await type("Thor #400\nThor #339\nThor #401");
    await click(confirmButton());
    expect(container.querySelector(".toast-label")!.textContent).toBe("3 issues added");
    expect(container.querySelector(".toast-detail")!.textContent).toBe("to Simonson — Thor");
    expect(container.querySelector("textarea")!.value).toBe("");

    await click(container.querySelector(".toast-undo")!);
    const del = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE")!;
    expect(del[0]).toBe("/api/runs/thor/issues");
    expect(JSON.parse(del[1].body)).toEqual({ after: 13, created: [5001, 5002], restored: [{ id: 1009, sequence: 10 }], revived: [] });
  });
});

describe("the screen's states (AC-6)", () => {
  it("empty: one primary action, confirm held with its reason", () => {
    render();
    const slate = container.querySelector(".slate")!;
    expect(slate.querySelectorAll("button")).toHaveLength(1);
    expect(slate.querySelector("button")!.textContent).toBe("Paste from clipboard");
    expect(header()).toBe("0 will be added");
    expect(confirmButton().getAttribute("aria-disabled")).toBe("true");
    expect(container.querySelector("#add-reason")!.textContent).toBe("Type or paste issues to add");
    expect(container.querySelector(`label[for="${container.querySelector("textarea")!.id}"]`)!.textContent)
      .toBe("One per line, ranges allowed");
  });

  it("checking: says so while the catalog is asked, and the check column waits", async () => {
    render();
    const area = container.querySelector<HTMLTextAreaElement>("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(area, "Thor #400");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.querySelector(".review-status")!.textContent).toBe("Checking 1 label against your catalog…");
    expect(rows()[0].querySelector(".vcheck")!.textContent).toBe("checking…");
    await settle();
    expect(container.querySelector(".review-status")!.textContent).toBe("");
    expect(rows()[0].querySelector(".vcheck")!.textContent).toBe("in catalog");
  });

  it("error: a neutral line, the lines kept, and Try again asks again", async () => {
    failDryRun = true;
    render();
    await type("Thor #400");
    const error = container.querySelector(".neutral-error")!;
    expect(error.textContent).toContain("Couldn't check your catalog. Your lines are still here.");
    failDryRun = false;
    await click([...error.querySelectorAll("button")].find((b) => b.textContent === "Try again")!);
    await settle();
    expect(container.querySelector(".neutral-error")).toBeNull();
    expect(whys()[0]).toMatch(/^Already in 3 runs\./);
  });
});

describe("the review's rules (task 1.3c plan)", () => {
  const review = (text: string, placements = thorRun().placements, choices = {}) => buildReview(
    parseBulk(text, { knownSeries, runLabels: placements.filter((p) => !p.removed).map((p) => p.label) }),
    { knownSeries, placements, catalog: new Map(), choices });

  it("keeps a volume year the series never used, checked as a new volume (owner's answer 3)", () => {
    const [row] = review("Captain America (1969) #1").rows;
    expect(row.kind).toBe("ok");
    expect(row.check).toBe("new volume");
    expect(row.why).toBe("No Captain America (1969) in your catalog yet.");
  });

  it("counts a label repeated inside the paste once, and says where it already is", () => {
    const r = review("Thor #400\nThor #398-401");
    expect(r.writes.map((w) => w.label)).toEqual([thor(400), thor(398), thor(399), thor(401)]);
    expect(r.rows[1].why).toMatch(/^4 issues, 3 to add: #400 is also on line 1\./);
    expect(review("Thor #400\nthor (1966) #400").rows[1].why).toMatch(/^Also on line 1\./);
  });

  it("names which way a range is broken", () => {
    expect(review("Thor #5-5").rows[0].why).toBe("#5-5 is one issue. Write it #5.");
    expect(review("Thor #1-501").rows[0].why).toBe("#1-501 is 501 issues; a range stops at 500. Check it.");
    expect(review("Thor #340-337").rows[0].why).toBe("#340-337 runs backwards. Write it #337-340.");
  });
});

describe("a stale tab (the run changed since the review)", () => {
  it("says in the toast how many it skipped as already there", async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(init.body as string) : null;
      if (body?.dryRun) return Response.json({ matches: [] });
      return Response.json({ ok: true, after: 13, created: [5001], restored: [], skipped: [thor(401)],
        newIssues: [], revived: [], context: thorRun() });
    });
    render();
    await type("Thor #400\nThor #401");
    await click(confirmButton());
    expect(container.querySelector(".toast-label")!.textContent).toBe("1 issue added");
    expect(container.querySelector(".toast-detail")!.textContent).toBe("to Simonson — Thor · 1 already there");
  });
});
