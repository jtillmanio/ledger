// @vitest-environment happy-dom
// Task 1.5 in the browser: a master-list row's status control and the
// finish-date control, and a spine row's *Change date…*, through the real route
// handlers on the TEST database: `fetch` is routed into them, so each click is
// checked against the row it wrote. The UX floor (AC-6): a button group with
// the current value aria-pressed, DNF grey, the finish options named radios,
// focus back on the opener. The endpoints' own rules are test/reading-log.test.ts.
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));
const router = { push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sql = testSql();
type Handlers = Record<string, (req: Request) => Promise<Response>>;
let routes: Record<string, Handlers>;
let q: typeof import("../src/db/queries");
let BookStatus: typeof import("../src/components/BookStatus").default;
let RunSpine: typeof import("../src/components/IssueRow").default;
let UndoProvider: typeof import("../src/components/Undo").UndoProvider;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  routes = {
    "/api/progress/book": (await import("../src/app/api/progress/book/route")) as unknown as Handlers,
    "/api/progress/issue": (await import("../src/app/api/progress/issue/route")) as unknown as Handlers,
  };
  q = await import("../src/db/queries");
  BookStatus = (await import("../src/components/BookStatus")).default;
  RunSpine = (await import("../src/components/IssueRow")).default;
  UndoProvider = (await import("../src/components/Undo")).UndoProvider;
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

let container: HTMLDivElement;
let root: Root;
/** Requests still on their way to the database: a click is done when they land. */
const inFlight = new Set<Promise<Response>>();

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('wok', 'The Way of Kings')`;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // Every request the controls make lands on the real handler.
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const res = routes[url][init.method!](new Request(`http://test${url}`, init));
    inFlight.add(res);
    void res.finally(() => inFlight.delete(res)).catch(() => {});
    return res;
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Wait inside act until every request the UI started, and any it started after, has landed. */
const settle = () => act(async () => {
  while (inFlight.size) {
    await Promise.allSettled([...inFlight]);
    await new Promise((r) => setTimeout(r, 0));
  }
});
const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await settle();
};
/** A key press where focus is; it bubbles to window, where the controls listen. */
const key = (k: string) => act(async () => {
  (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
});
const button = (name: string, scope: ParentNode = document) =>
  [...scope.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === name)!;
const radio = (label: string) =>
  [...document.querySelectorAll<HTMLLabelElement>("label.opt")].find((l) => l.textContent === label)!
    .querySelector("input")!;
const status = async () => (await sql`
  SELECT status, finished_on::text AS on, finished_on_precision AS precision, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = 'wok'`)[0] ?? null;
const pressed = () => [...container.querySelectorAll(".status-group button[aria-pressed='true']")]
  .map((b) => b.textContent);

function renderBook(row: { status: string; on?: string | null; precision?: "exact" | "approximate" | "none" }) {
  act(() => root.render(
    <UndoProvider>
      <BookStatus bookId="wok" status={row.status}
        finishedOn={row.on ?? null} precision={row.precision ?? "none"} />
    </UndoProvider>,
  ));
}
async function expand() {
  await click(container.querySelector(".status-toggle")!);
}
/** Year only, stepped from this year down to `year`. */
async function yearOnly(year: number) {
  await click(radio("Year only"));
  const thisYear = Number(new Date().toLocaleDateString("en-CA").slice(0, 4));
  for (let y = thisYear; y > year; y--) await click(button("−"));
  // From the document: the spine's control is in a sheet, portalled out of the container.
  expect(document.querySelector(".stepper output")!.textContent).toBe(String(year));
}

describe("the master list's status control", () => {
  it("to_read → reading → read round-trips through the UI, and Year only 2019 stores 2019-07-01 approximate", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    renderBook({ status: "to_read" });
    await expand();
    expect(pressed()).toEqual(["To read"]);

    await click(button("Reading"));
    expect(await status()).toMatchObject({ status: "reading" });
    expect(pressed()).toEqual(["Reading"]);

    await click(button("Read"));
    expect(container.querySelector("legend")!.textContent).toBe("Finished");
    await yearOnly(2019);
    expect(container.querySelector(".finish-note")!.textContent)
      .toBe("Saved as 1 July 2019, approximate: it counts toward 2019, never as a real day.");
    await click(button("Save"));

    expect(await status()).toMatchObject({ status: "read", on: "2019-07-01", precision: "approximate" });
    expect(await sql`SELECT finished_on::text AS on, finished_on_precision AS p FROM read_events`)
      .toEqual([{ on: "2019-07-01", p: "approximate" }]);
    expect(pressed()).toEqual(["Read"]);
    expect(container.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(button("Read"));
    expect(container.querySelector(".status-toggle")!.textContent).toBe("Status: read ~Jul 2019");
  });

  it("No date stores NULL / none and the book is under No year", async () => {
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    await click(radio("No date"));
    await click(button("Save"));
    expect(await status()).toMatchObject({ status: "read", on: null, precision: "none" });
    expect(await q.readWithoutYear(USER)).toBe(1);
  });

  it("marked read with Today on 2026-10-02 is under the 2026 year chip and in books_by_year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T15:00:00Z"));
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    expect(radio("Today").checked).toBe(true);
    await click(button("Save"));
    expect(await status()).toMatchObject({ on: "2026-10-02", precision: "exact" });
    expect((await q.listBooks(USER, { year: 2026 })).map((r) => r.id)).toEqual(["wok"]);
    expect((await q.yearSummary(USER)).map((r) => [r.year, Number(r.books)])).toEqual([[2026, 1]]);
  });

  it("marking a book read from the list writes the event and keeps its rating (R0-C1)", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, rating) VALUES (${USER}, 'wok', 'reading', 4.5)`;
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    await click(radio("Pick a date"));
    const input = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "2025-06-01");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click(button("Save"));
    expect(await status()).toMatchObject({ status: "read", on: "2025-06-01", precision: "exact", rating: 4.5 });
    expect(await sql`SELECT 1 FROM read_events`).toHaveLength(1);
  });

  it("is a real button group, the current value aria-pressed, DNF grey and never --danger", async () => {
    renderBook({ status: "dnf" });
    await expand();
    const group = container.querySelector(".status-group")!;
    expect(group.getAttribute("role")).toBe("group");
    expect([...group.querySelectorAll("button")].map((b) => [b.textContent, b.getAttribute("aria-pressed")]))
      .toEqual([["To read", "false"], ["Reading", "false"], ["Read", "false"], ["DNF", "true"]]);
    expect(button("DNF").classList.contains("dnf")).toBe(true);
    const css = readFileSync("src/app/globals.css", "utf8");
    const dnfRules = css.split("}").filter((r) => /\.dnf\b/.test(r));
    expect(dnfRules.length).toBeGreaterThan(0);
    expect(dnfRules.some((r) => r.includes("--muted"))).toBe(true);
    expect(dnfRules.every((r) => !r.includes("--danger"))).toBe(true);
  });

  it("the finish options are four named radio inputs; Cancel and Esc put focus back on Read", async () => {
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    const radios = [...container.querySelectorAll<HTMLInputElement>('fieldset input[type="radio"]')];
    expect(radios.map((r) => r.closest("label")!.textContent)).toEqual(["Today", "Pick a date", "Year only", "No date"]);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios[0].name).not.toBe("");
    expect(button("Read").getAttribute("aria-expanded")).toBe("true");

    await click(button("Cancel"));
    expect(container.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(button("Read"));
    await click(button("Read"));
    await key("Escape");
    expect(container.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(button("Read"));
    expect(await status()).toBeNull();
  });

  it("the toast's Undo takes the read back out of the log", async () => {
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    await click(button("Save"));
    expect(await sql`SELECT 1 FROM read_events`).toHaveLength(1);
    await click(button("Undo"));
    expect(await sql`SELECT 1 FROM read_events`).toHaveLength(0);
    expect(pressed()).toEqual(["Reading"]);
  });
});

describe("Change date… on a spine row", () => {
  let placements: number[];
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('r', 'Run'), ('o', 'Other')`;
    await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('x2', 'X #2')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('r', 1, 'x1'), ('r', 2, 'x2'), ('o', 1, 'x1')`;
    placements = [
      await markRead(sql, USER, "r", "x1", { at: "2026-03-14T20:15:00Z", precision: "exact" }),
      await markRead(sql, USER, "o", "x1", { at: "2020-07-01T00:00:00Z", precision: "approximate" }),
    ];
  });

  function renderSpine() {
    const row = (n: number, completed: boolean) => ({
      id: `x${n}`, placement_id: 0, sequence: n, label: `X #${n}`, type: "core", notes: null,
      completed, read_elsewhere: [], read_elsewhere_when: null,
    });
    act(() => root.render(
      <UndoProvider>
        <RunSpine runId="r" title="Run" issues={[{ ...row(1, true), placement_id: placements[0] },
          { ...row(2, false), placement_id: placements[0] + 1 }]} />
      </UndoProvider>,
    ));
  }
  const openMenu = async (n: number) => {
    const trigger = container.querySelectorAll<HTMLButtonElement>(".rowmenu-btn")[n - 1];
    await click(trigger);
    return trigger;
  };
  const items = () => [...document.querySelectorAll('[role="menuitem"]')].map((b) => b.textContent);
  const progress = async () => (await sql`
    SELECT p.placement_id, p.completed_at, p.completed_at_precision AS p FROM issue_progress p ORDER BY 1`)
    .map((r) => [r.placement_id, r.completed_at?.toISOString() ?? null, r.p]);

  it("is offered only on a row read here", async () => {
    renderSpine();
    await openMenu(2);
    expect(items()).toEqual(["Mark everything through here"]);
    await key("Escape");
    await openMenu(1);
    expect(items()).toEqual(["Mark everything through here", "Change date…"]);
  });

  it("opens the four-option control; Year only writes July 1st approximate here and nowhere else", async () => {
    renderSpine();
    const trigger = await openMenu(1);
    await click(button("Change date…"));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.querySelector("h2")!.textContent).toBe("Change date");
    expect([...dialog.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
      .map((r) => r.closest("label")!.textContent)).toEqual(["Today", "Pick a date", "Year only", "No date"]);
    await yearOnly(2019);
    await click(button("Save", dialog));

    expect(await progress()).toEqual([
      [placements[0], "2019-07-01T00:00:00.000Z", "approximate"],
      [placements[1], "2020-07-01T00:00:00.000Z", "approximate"],
    ]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("No date writes NULL / none, and Undo puts the old date back", async () => {
    renderSpine();
    await openMenu(1);
    await click(button("Change date…"));
    await click(radio("No date"));
    await click(button("Save", document.querySelector('[role="dialog"]')!));
    expect((await progress())[0]).toEqual([placements[0], null, "none"]);
    await click(button("Undo"));
    expect((await progress())[0]).toEqual([placements[0], "2026-03-14T20:15:00.000Z", "exact"]);
  });
});
