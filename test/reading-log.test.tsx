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
    "/api/progress/book/read": (await import("../src/app/api/progress/book/read/route")) as unknown as Handlers,
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
/** Every request the controls made, `METHOD /path`, for the tests that count them. */
const requests: string[] = [];

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('wok', 'The Way of Kings')`;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  // Every request the controls make lands on the real handler.
  requests.length = 0;
  vi.stubGlobal("fetch", (url: string, init: RequestInit = {}) => {
    const path = url.split("?")[0];
    requests.push(`${init.method ?? "GET"} ${path}`);
    const res = routes[path][init.method ?? "GET"](new Request(`http://test${url}`, init));
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
/** A picker's radio; `legend` names which picker when *Started* and *Finished* are open together. */
const radio = (label: string, legend?: string) => {
  const scope = legend
    ? [...document.querySelectorAll("fieldset")].find((f) => f.querySelector("legend")!.textContent === legend)!
    : document;
  return [...scope.querySelectorAll<HTMLLabelElement>("label.opt")].find((l) => l.textContent === label)!
    .querySelector("input")!;
};
/** Type a day into a picker's date input. */
const setDay = (input: HTMLInputElement, day: string) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, day);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
/** The date input of the picker with this legend. */
const dayInput = (legend: string) =>
  [...document.querySelectorAll("fieldset")].find((f) => f.querySelector("legend")!.textContent === legend)!
    .closest(".finish")!.querySelector<HTMLInputElement>('input[type="date"]')!;
const status = async () => (await sql`
  SELECT status, finished_on::text AS on, finished_on_precision AS precision, rating
  FROM book_status WHERE user_id = ${USER} AND book_id = 'wok'`)[0] ?? null;
const pressed = () => [...container.querySelectorAll(".status-group button[aria-pressed='true']")]
  .map((b) => b.textContent);

function renderBook(row: {
  status: string; on?: string | null; precision?: "exact" | "approximate" | "none";
  started?: string | null; startPrecision?: "exact" | "approximate" | "none"; listened?: boolean;
}) {
  act(() => root.render(
    <UndoProvider>
      <BookStatus bookId="wok" status={row.status}
        finishedOn={row.on ?? null} precision={row.precision ?? "none"}
        startedOn={row.started ?? null} startPrecision={row.startPrecision ?? "none"} listened={row.listened} />
    </UndoProvider>,
  ));
}
async function expand() {
  await click(container.querySelector(".status-toggle")!);
}
/** Year only, stepped from this year down to `year`. */
async function yearOnly(year: number, legend?: string) {
  await click(radio("Year only", legend));
  const thisYear = Number(new Date().toLocaleDateString("en-CA").slice(0, 4));
  for (let y = thisYear; y > year; y--) await click(button("−"));
  // From the document: the spine's control is in a sheet, portalled out of the container.
  expect(document.querySelector(".stepper output")!.textContent).toBe(String(year));
}

describe("the master list's status control", () => {
  it("to_read → reading → read round-trips through the UI, and Year only 2019 stores 2019-07-01 approximate", async () => {
    // Reading stamps today as the start (task 1.17): a 2019 today keeps Year only 2019 no earlier than it.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2019-08-01T17:00:00Z"));
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
    renderBook({ status: "to_read" });
    await expand();
    expect(pressed()).toEqual(["To read"]);

    await click(button("Reading"));
    expect(await status()).toMatchObject({ status: "reading" });
    expect(pressed()).toEqual(["Reading"]);

    await click(button("Read"));
    // Read asks both dates (task 1.17b): Started, then Finished.
    expect([...container.querySelectorAll("legend")].map((l) => l.textContent)).toEqual(["Started", "Finished"]);
    await yearOnly(2019, "Finished");
    expect([...container.querySelectorAll(".finish")].at(-1)!.querySelector(".finish-note")!.textContent)
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
    await click(radio("No date", "Finished"));
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
    expect(radio("Today", "Finished").checked).toBe(true);
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
    await click(radio("Pick a date", "Finished"));
    await setDay(dayInput("Finished"), "2025-06-01");
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
      .toEqual([["To read", "false"], ["Reading", "false"], ["Listening", "false"], ["Read", "false"], ["DNF", "true"]]);
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
    const finished = [...container.querySelectorAll("fieldset")].find((f) => f.querySelector("legend")!.textContent === "Finished")!;
    const radios = [...finished.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
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

describe("Listening in the status control (task 1.23, AC-4, AC-6)", () => {
  /** The headphones glyph beside the badge: its role and name, or null when there is none. */
  const glyph = () => {
    const svg = container.querySelector(".status-line svg");
    return svg && [svg.getAttribute("role"), svg.getAttribute("aria-label")];
  };

  it("offers Listening beside Reading, a real button with its name; choosing it writes listening and shows the glyph named Listening", async () => {
    renderBook({ status: "to_read" });
    expect(glyph()).toBeNull();
    await expand();
    const names = [...container.querySelectorAll(".status-group button")].map((b) => b.textContent);
    expect(names.indexOf("Listening")).toBe(names.indexOf("Reading") + 1);
    await click(button("Listening"));
    expect(await status()).toMatchObject({ status: "listening" });
    expect(pressed()).toEqual(["Listening"]);
    expect(glyph()).toEqual(["img", "Listening"]);
    // Listening is a read in progress: its start shows on the date line, as Reading's does.
    expect(container.querySelector(".date-line button")!.textContent).toMatch(/^Started /);
  });

  it("finishing from Listening logs an audio read and the glyph becomes Listened; Undo puts Listening back", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'listening')`;
    renderBook({ status: "listening" });
    await expand();
    await click(button("Read"));
    await click(button("Save"));
    expect(await sql`SELECT format FROM read_events`).toEqual([{ format: "audio" }]);
    expect(glyph()).toEqual(["img", "Listened"]);
    await click(button("Undo"));
    expect(await sql`SELECT 1 FROM read_events`).toHaveLength(0);
    expect(pressed()).toEqual(["Listening"]);
    expect(glyph()).toEqual(["img", "Listening"]);
  });

  it("a book only read on the page shows no glyph; one with a listen shows Listened whatever its status", async () => {
    renderBook({ status: "read", on: "2025-06-01", precision: "exact" });
    expect(glyph()).toBeNull();
    renderBook({ status: "reading", listened: true });
    expect(glyph()).toEqual(["img", "Listened"]);
  });

  it("the glyph is an outline in the text's own colour, never a colour of its own", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rules = css.split("}").filter((r) => /\.(ico|listen)\b/.test(r) && !r.includes("@media"));
    expect(rules.some((r) => r.includes("stroke:currentColor"))).toBe(true);
    expect(rules.filter((r) => r.includes(".listen")).every((r) => !/color|stroke:|fill:/.test(r.split("{")[1] ?? ""))).toBe(true);
  });
});

describe("the status control's date line (task 1.17, AC-6)", () => {
  const started = () => [...container.querySelectorAll<HTMLButtonElement>(".date-line button")]
    .map((b) => b.textContent);
  const reasonLine = () => container.querySelector<HTMLParagraphElement>(".sheet-reason")!;
  async function pickDay(date: string, legend: string) {
    await click(radio("Pick a date", legend));
    await setDay(dayInput(legend), date);
  }
  const startOf = async () => (await sql`
    SELECT started_on::text AS on, started_on_precision AS p FROM book_status WHERE book_id = 'wok'`)[0];

  it("Started and Finished are real buttons named with the dates they hold", async () => {
    renderBook({ status: "read", on: "2026-03-17", precision: "exact", started: "2026-03-01", startPrecision: "exact" });
    await expand();
    expect(started()).toEqual(["Started 1 March 2026", "Finished 17 March 2026"]);
    for (const b of container.querySelectorAll(".date-line > *")) expect(b.tagName).toBe("BUTTON");
    act(() => root.unmount());
    root = createRoot(container);
    renderBook({ status: "reading", started: "2025-07-01", startPrecision: "approximate" });
    await expand();
    expect(started()).toEqual(["Started 2025, approximate"]);
  });

  it("A to-read book has no date line; the same book being read has one", async () => {
    renderBook({ status: "reading", started: "2026-03-02", startPrecision: "exact" });
    await expand();
    expect(started()).toEqual(["Started 2 March 2026"]);
    // The server's row comes back as To read (as a refresh brings it): the line goes.
    renderBook({ status: "to_read", started: "2026-03-02", startPrecision: "exact" });
    expect(container.querySelector(".date-line")).toBeNull();
  });

  it("Started opens the four named radio inputs; Cancel, Esc and Save put focus back on Started", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
              VALUES (${USER}, 'wok', 'reading', '2026-03-02', 'exact')`;
    renderBook({ status: "reading", started: "2026-03-02", startPrecision: "exact" });
    await expand();
    const opener = () => button("Started 2 March 2026");
    await click(opener());
    expect(container.querySelector("legend")!.textContent).toBe("Started");
    const radios = [...container.querySelectorAll<HTMLInputElement>('fieldset input[type="radio"]')];
    expect(radios.map((r) => r.closest("label")!.textContent)).toEqual(["Today", "Pick a date", "Year only", "No date"]);
    expect(radios.every((r) => r.name === "started-wok")).toBe(true);
    expect(opener().getAttribute("aria-expanded")).toBe("true");

    await click(button("Cancel"));
    expect(container.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(opener());
    await click(opener());
    await key("Escape");
    expect(container.querySelector("fieldset")).toBeNull();
    expect(document.activeElement).toBe(opener());

    await click(opener());
    await yearOnly(2025);
    await click(button("Save"));
    expect(await startOf()).toEqual({ on: "2025-07-01", p: "approximate" });
    expect(document.activeElement).toBe(button("Started 2025, approximate"));
    // Its undo puts the day back.
    await click(button("Undo"));
    expect(await startOf()).toEqual({ on: "2026-03-02", p: "exact" });
    expect(started()).toEqual(["Started 2 March 2026"]);
  });

  it("a start after the finish can't be saved: the reason sits under the control, announced, and nothing is written", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
              VALUES (${USER}, 'wok', 'read', '2026-03-17', 'exact')`;
    await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
              VALUES (${USER}, 'wok', '2026-03-17', 'exact', '2026-03-01', 'exact')`;
    renderBook({ status: "read", on: "2026-03-17", precision: "exact", started: "2026-03-01", startPrecision: "exact" });
    await expand();
    await click(button("Started 1 March 2026"));
    await pickDay("2026-03-20", "Started");
    expect(reasonLine().getAttribute("aria-live")).toBe("polite");
    expect(reasonLine().textContent).toBe("That's after the day you finished.");
    const save = button("Save");
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(save.getAttribute("aria-describedby")).toBe(reasonLine().id);
    await click(save);
    expect(await sql`SELECT started_on::text AS on FROM read_events`).toEqual([{ on: "2026-03-01" }]);
    // Grey, never --danger: a validation reason, not a destructive action.
    expect(reasonLine().classList.contains("muted")).toBe(true);
    expect(reasonLine().classList.contains("sheet-error")).toBe(false);
  });

  it("a finish before the start in progress shows why, and so does the server's refusal", async () => {
    // The server holds a start the row doesn't know of yet: the client lets it through, the server refuses.
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
              VALUES (${USER}, 'wok', 'reading', '2026-03-10', 'exact')`;
    renderBook({ status: "reading", started: "2026-03-10", startPrecision: "exact" });
    await expand();
    await click(button("Read"));
    await pickDay("2026-03-05", "Finished");
    // *Read* asks both dates: the reason sits under *Started* (task 1.17b).
    expect(reasonLine().textContent).toBe("That's after the day you finished.");

    act(() => root.unmount());
    root = createRoot(container);
    renderBook({ status: "reading" });
    await expand();
    await click(button("Read"));
    await pickDay("2026-03-05", "Finished");
    expect(reasonLine().textContent).toBe("");
    await click(button("Save"));
    const refusal = () => [...container.querySelectorAll(".sheet-reason")].at(-1)!.textContent;
    expect(refusal()).toBe("Not saved: the start is after the finish.");
    expect(await sql`SELECT 1 FROM read_events`).toHaveLength(0);
    expect(container.querySelector("fieldset")).not.toBeNull();
    // A new choice clears the server's reason: it was about the last one.
    await click(radio("No date", "Finished"));
    expect(refusal()).toBe("");
  });

  it("the date line, the row's dates and the hero's span never resolve to --danger", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const rules = css.split("}").filter((r) => /\.(date-line|row-dates|runhero-span)\b/.test(r));
    expect(rules).toHaveLength(3);
    expect(rules.every((r) => !r.includes("--danger"))).toBe(true);
  });
});

describe("the status control asks the dates (task 1.17b, D-131)", () => {
  const today = "2026-11-10";
  const startOf = async () => (await sql`
    SELECT status, started_on::text AS on, started_on_precision AS p FROM book_status WHERE book_id = 'wok'`)[0];
  const undoButtons = () => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Undo");
  const pickers = () => [...container.querySelectorAll("legend")].map((l) => l.textContent);
  const reasons = () => [...container.querySelectorAll(".sheet-reason")];
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${today}T17:00:00Z`));
  });

  describe("Reading asks the start (AC-2)", () => {
    beforeEach(async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'to_read')`;
      renderBook({ status: "to_read" });
      await expand();
    });

    it("saves at once, then opens Started on Today; Esc keeps today's start and sends nothing more", async () => {
      await click(button("Reading"));
      expect(await startOf()).toEqual({ status: "reading", on: today, p: "exact" });
      expect(pickers()).toEqual(["Started"]);
      expect(radio("Today", "Started").checked).toBe(true);
      expect(requests.filter((r) => r.startsWith("POST"))).toEqual(["POST /api/progress/book"]);

      await key("Escape");
      expect(pickers()).toEqual([]);
      expect(document.activeElement).toBe(button("Reading"));
      expect(await startOf()).toEqual({ status: "reading", on: today, p: "exact" });
      expect(requests.filter((r) => r.startsWith("POST"))).toEqual(["POST /api/progress/book"]);
    });

    it("Save on Today sends nothing; the toast's single Undo puts the book back at to_read with no start", async () => {
      await click(button("Reading"));
      await click(button("Save"));
      expect(requests.filter((r) => r.startsWith("POST"))).toEqual(["POST /api/progress/book"]);
      expect(pickers()).toEqual([]);
      expect(undoButtons()).toHaveLength(1);
      await click(undoButtons()[0]);
      expect(await startOf()).toEqual({ status: "to_read", on: null, p: "none" });
      expect(pressed()).toEqual(["To read"]);
    });

    it("another day re-dates the start alone, with no second toast; the one Undo restores the status and the start", async () => {
      await click(button("Reading"));
      await click(radio("Pick a date", "Started"));
      await setDay(dayInput("Started"), "2026-11-02");
      await click(button("Save"));
      expect(await startOf()).toEqual({ status: "reading", on: "2026-11-02", p: "exact" });
      expect(requests).toContain("POST /api/progress/book/read");
      expect(pickers()).toEqual([]);
      expect(container.querySelector(".date-line button")!.textContent).toBe("Started 2 November 2026");
      // One toast, one Undo: the status change's, which puts back the whole row.
      expect(undoButtons()).toHaveLength(1);
      await click(undoButtons()[0]);
      expect(await startOf()).toEqual({ status: "to_read", on: null, p: "none" });
    });

    it("the page refresh waits while Started is offered (the row may be about to leave its tab) and runs when it closes", async () => {
      router.refresh.mockClear();
      await click(button("Reading"));
      expect(pickers()).toEqual(["Started"]);
      expect(router.refresh).not.toHaveBeenCalled();
      await key("Escape");
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });

    it("an Undo while Started is open closes it", async () => {
      await click(button("Reading"));
      expect(pickers()).toEqual(["Started"]);
      await click(undoButtons()[0]);
      expect(pickers()).toEqual([]);
      expect(pressed()).toEqual(["To read"]);
    });
  });

  it("switching between Reading and Listening keeps the start and opens nothing", async () => {
    await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
              VALUES (${USER}, 'wok', 'reading', '2026-10-01', 'exact')`;
    renderBook({ status: "reading", started: "2026-10-01", startPrecision: "exact" });
    await expand();
    await click(button("Listening"));
    expect(pickers()).toEqual([]);
    expect(await startOf()).toEqual({ status: "listening", on: "2026-10-01", p: "exact" });
  });

  describe("Read asks both (AC-3)", () => {
    it("opens Started on the stored start and Finished on Today", async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
                VALUES (${USER}, 'wok', 'reading', '2026-10-01', 'exact')`;
      renderBook({ status: "reading", started: "2026-10-01", startPrecision: "exact" });
      await expand();
      await click(button("Read"));
      expect(pickers()).toEqual(["Started", "Finished"]);
      expect(radio("Pick a date", "Started").checked).toBe(true);
      expect(dayInput("Started").value).toBe("2026-10-01");
      expect(radio("Today", "Finished").checked).toBe(true);
      // One Save, one Cancel.
      expect(["Save", "Cancel"].map((n) => [...container.querySelectorAll("button")].filter((b) => b.textContent === n).length))
        .toEqual([1, 1]);
    });

    it("with no start held, Started opens on No date", async () => {
      renderBook({ status: "to_read" });
      await expand();
      await click(button("Read"));
      expect(radio("No date", "Started").checked).toBe(true);
      expect(radio("Today", "Finished").checked).toBe(true);
    });

    it("confirming writes one read_events row carrying both dates", async () => {
      renderBook({ status: "to_read" });
      await expand();
      await click(button("Read"));
      await click(radio("Pick a date", "Started"));
      await setDay(dayInput("Started"), "2026-10-20");
      await click(radio("Pick a date", "Finished"));
      await setDay(dayInput("Finished"), "2026-11-01");
      await click(button("Save"));
      expect(await sql`
        SELECT started_on::text AS s, started_on_precision AS sp, finished_on::text AS f, finished_on_precision AS fp
        FROM read_events`).toEqual([{ s: "2026-10-20", sp: "exact", f: "2026-11-01", fp: "exact" }]);
      expect(await status()).toMatchObject({ status: "read", on: "2026-11-01", precision: "exact" });
      expect(pickers()).toEqual([]);
      expect(document.activeElement).toBe(button("Read"));
    });

    it("a start that was not changed is never re-sent: a held guess stays a guess", async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status, started_on, started_on_precision)
                VALUES (${USER}, 'wok', 'reading', '2025-07-01', 'approximate')`;
      renderBook({ status: "reading", started: "2025-07-01", startPrecision: "approximate" });
      await expand();
      await click(button("Read"));
      expect(radio("Year only", "Started").checked).toBe(true);
      await click(button("Save"));
      expect(await sql`SELECT started_on::text AS s, started_on_precision AS sp FROM read_events`)
        .toEqual([{ s: "2025-07-01", sp: "approximate" }]);
    });

    it("a start after the finish: the reason under Started, Save aria-disabled with it, and nothing is sent", async () => {
      renderBook({ status: "to_read" });
      await expand();
      await click(button("Read"));
      await click(radio("Pick a date", "Started"));
      await setDay(dayInput("Started"), "2026-11-05");
      await click(radio("Pick a date", "Finished"));
      await setDay(dayInput("Finished"), "2026-11-01");
      const started = document.getElementById(reasons()[0].id)!;
      expect(started.textContent).toBe("That's after the day you finished.");
      expect(started.getAttribute("aria-live")).toBe("polite");
      // Grey, never --danger.
      expect(started.classList.contains("muted")).toBe(true);
      const save = button("Save");
      expect(save.getAttribute("aria-disabled")).toBe("true");
      expect(save.getAttribute("aria-describedby")!.split(" ")).toContain(started.id);
      const before = requests.length;
      await click(save);
      expect(requests.length).toBe(before);
      expect(await sql`SELECT 1 FROM read_events`).toHaveLength(0);
      expect(pickers()).toEqual(["Started", "Finished"]);
    });

    it("on a book already Read, both open on the latest read's own dates and Save corrects it", async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${USER}, 'wok', 'read', '2026-03-17', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
                VALUES (${USER}, 'wok', '2026-03-17', 'exact', '2026-03-01', 'exact')`;
      renderBook({ status: "read", on: "2026-03-17", precision: "exact", started: "2026-03-01", startPrecision: "exact" });
      await expand();
      await click(button("Read"));
      expect(dayInput("Started").value).toBe("2026-03-01");
      expect(radio("Pick a date", "Finished").checked).toBe(true);
      await setDay(dayInput("Finished"), "2026-03-19");
      await click(button("Save"));
      expect(await sql`SELECT started_on::text AS s, finished_on::text AS f FROM read_events`)
        .toEqual([{ s: "2026-03-01", f: "2026-03-19" }]);
    });
  });

  describe("every read (AC-4)", () => {
    /** Two reads: a text read, then a listen; the status holds the listen's finish. */
    async function twoReads() {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${USER}, 'wok', 'read', '2025-03-19', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision, format)
                VALUES (${USER}, 'wok', '2022-07-01', 'approximate', '2022-06-03', 'exact', 'text'),
                       (${USER}, 'wok', '2025-03-19', 'exact', '2025-03-02', 'exact', 'audio')`;
      renderBook({ status: "read", on: "2025-03-19", precision: "exact", started: "2025-03-02", startPrecision: "exact", listened: true });
      await expand();
    }
    const list = () => container.querySelector<HTMLElement>(".reads")!;
    const readsDb = async () => (await sql`
      SELECT started_on::text AS s, finished_on::text AS f FROM read_events ORDER BY id`);

    it("a book with one read shows no All reads line", async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status, finished_on, finished_on_precision)
                VALUES (${USER}, 'wok', 'read', '2025-03-19', 'exact')`;
      await sql`INSERT INTO read_events (user_id, book_id, finished_on, finished_on_precision, started_on, started_on_precision)
                VALUES (${USER}, 'wok', '2025-03-19', 'exact', '2025-03-02', 'exact')`;
      renderBook({ status: "read", on: "2025-03-19", precision: "exact", started: "2025-03-02", startPrecision: "exact" });
      await expand();
      expect(requests).toContain("GET /api/progress/book/read");
      expect([...container.querySelectorAll("button")].some((b) => /^All reads/.test(b.textContent!))).toBe(false);
      expect(container.querySelector(".reads")).toBeNull();
    });

    it("the reads load when the row opens, not before", async () => {
      await twoReads();
      expect(requests.filter((r) => r.startsWith("GET"))).toEqual(["GET /api/progress/book/read"]);
      act(() => root.unmount());
      requests.length = 0;
      root = createRoot(container);
      renderBook({ status: "read", on: "2025-03-19", precision: "exact" });
      expect(requests).toEqual([]);
    });

    it("two reads: All reads (2) in the date line, each read with its Started and Finished, the listen named Listened", async () => {
      await twoReads();
      const toggle = button("All reads (2)", container.querySelector(".date-line")!);
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(".reads")).toBeNull();
      await click(toggle);
      expect(toggle.getAttribute("aria-expanded")).toBe("true");
      const items = [...list().querySelectorAll("li")];
      expect(items.map((li) => [...li.querySelectorAll("button")].map((b) => b.textContent))).toEqual([
        ["Started 3 June 2022", "Finished 2022, approximate"],
        ["Started 2 March 2025", "Finished 19 March 2025"],
      ]);
      // The glyph is an image named *Listened* on the listen alone.
      expect(items.map((li) => li.querySelector("svg")?.getAttribute("aria-label") ?? null)).toEqual([null, "Listened"]);
      // Every date is a real button with a name of its own.
      for (const b of list().querySelectorAll("button")) expect(b.getAttribute("aria-label")).toMatch(/, read [12]$/);
    });

    it("each date opens the four-choice picker; Cancel and Esc put focus back on it", async () => {
      await twoReads();
      await click(button("All reads (2)"));
      const first = () => button("Started 3 June 2022", list());
      await click(first());
      expect(first().getAttribute("aria-expanded")).toBe("true");
      expect([...list().querySelectorAll<HTMLInputElement>('input[type="radio"]')]
        .map((r) => r.closest("label")!.textContent)).toEqual(["Today", "Pick a date", "Year only", "No date"]);
      await click(button("Cancel", list()));
      expect(list().querySelector("fieldset")).toBeNull();
      expect(document.activeElement).toBe(first());
      await click(first());
      await key("Escape");
      expect(list().querySelector("fieldset")).toBeNull();
      expect(document.activeElement).toBe(first());
    });

    it("re-dating the first read changes only its row; book_status is untouched", async () => {
      await twoReads();
      await click(button("All reads (2)"));
      await click(button("Started 3 June 2022", list()));
      await click(radio("Pick a date"));
      await setDay(list().querySelector<HTMLInputElement>('input[type="date"]')!, "2022-06-10");
      await click(button("Save", list()));
      expect(await readsDb()).toEqual([{ s: "2022-06-10", f: "2022-07-01" }, { s: "2025-03-02", f: "2025-03-19" }]);
      expect(await status()).toMatchObject({ status: "read", on: "2025-03-19", precision: "exact" });
      expect(document.activeElement).toBe(button("Started 10 June 2022", list()));
      // The list reloaded: it shows the new day.
      expect(list().textContent).toContain("Started 10 June 2022");
    });

    it("re-dating the second (the latest) read changes its row and book_status", async () => {
      await twoReads();
      await click(button("All reads (2)"));
      await click(button("Finished 19 March 2025", list()));
      await click(radio("Pick a date"));
      await setDay(list().querySelector<HTMLInputElement>('input[type="date"]')!, "2025-03-25");
      await click(button("Save", list()));
      expect(await readsDb()).toEqual([{ s: "2022-06-03", f: "2022-07-01" }, { s: "2025-03-02", f: "2025-03-25" }]);
      expect(await status()).toMatchObject({ status: "read", on: "2025-03-25", precision: "exact" });
    });

    it("a start after the finish is refused under the control and writes nothing; the toast's Undo takes a re-date back", async () => {
      await twoReads();
      await click(button("All reads (2)"));
      await click(button("Started 2 March 2025", list()));
      await click(radio("Pick a date"));
      await setDay(list().querySelector<HTMLInputElement>('input[type="date"]')!, "2025-04-01");
      const line = list().querySelector<HTMLElement>(".sheet-reason")!;
      expect(line.textContent).toBe("That's after the day you finished.");
      expect(button("Save", list()).getAttribute("aria-disabled")).toBe("true");
      const before = requests.length;
      await click(button("Save", list()));
      expect(requests.length).toBe(before);
      expect(await readsDb()).toEqual([{ s: "2022-06-03", f: "2022-07-01" }, { s: "2025-03-02", f: "2025-03-19" }]);

      await setDay(list().querySelector<HTMLInputElement>('input[type="date"]')!, "2025-03-05");
      await click(button("Save", list()));
      expect((await readsDb())[1]).toEqual({ s: "2025-03-05", f: "2025-03-19" });
      await click(undoButtons()[0]);
      expect((await readsDb())[1]).toEqual({ s: "2025-03-02", f: "2025-03-19" });
    });

    it("a load that fails says so in grey, never --danger", async () => {
      await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'wok', 'reading')`;
      renderBook({ status: "reading" });
      const real = globalThis.fetch;
      vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
      await expand();
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      const line = container.querySelector(".sheet-error")!;
      expect(line.textContent).toContain("Couldn't load this book's reads.");
      expect(line.getAttribute("role")).toBe("status");
      vi.stubGlobal("fetch", real);
      const css = readFileSync("src/app/globals.css", "utf8");
      const rules = css.split("}").filter((r) => /\.(reads|read-item|read-name|read-dates|now-status|row-control)\b/.test(r));
      expect(rules.length).toBeGreaterThanOrEqual(4);
      expect(rules.every((r) => !r.includes("--danger"))).toBe(true);
    });
  });
});

describe("the run hero's span line (task 1.17, AC-5)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO runs (id, title) VALUES ('r', 'Run')`;
    await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('x2', 'X #2')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES ('r', 1, 'x1'), ('r', 2, 'x2')`;
  });
  function renderRun(read: boolean[], span: { started?: string | null; span?: string | null }) {
    const issues = read.map((completed, i) => ({
      id: `x${i + 1}`, placement_id: i + 1, sequence: i + 1, label: `X #${i + 1}`, type: "core", notes: null,
      completed, read_elsewhere: [], read_elsewhere_when: null,
    }));
    act(() => root.render(
      <UndoProvider><RunSpine runId="r" title="Run" issues={issues} {...span} /></UndoProvider>,
    ));
  }
  const line = () => container.querySelector(".runhero-span")?.textContent ?? null;

  it("reads Started Mar 2026 while unread remain and Mar–Sep 2026 once every placement is read", () => {
    renderRun([true, false], { started: "Started Mar 2026" });
    expect(line()).toBe("Started Mar 2026");
    renderRun([true, true], { started: "Started Mar 2026", span: "Mar–Sep 2026" });
    expect(line()).toBe("Mar–Sep 2026");
  });

  it("a run whose reads are all undated shows no span line, while a dated one does", () => {
    renderRun([true, true], { started: "Started Mar 2026", span: "Mar 2026" });
    expect(line()).toBe("Mar 2026");
    // The server gives an all-undated run neither string.
    renderRun([true, true], { started: null, span: null });
    expect(line()).toBeNull();
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
      [placements[0], "2019-07-01T04:00:00.000Z", "approximate"],
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
