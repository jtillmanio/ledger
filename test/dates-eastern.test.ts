// Task 1.16: dates in America/New_York. A calendar day is stored as its Eastern
// midnight and every date is decided and shown in Eastern, so a read marked
// *Today* late on a month's last evening names that day, not the next one.
// The clock is faked to 2026-10-31 21:30 and 23:30 Eastern (EDT, -04:00), when
// UTC is already on November 1st. Postgres's now() can't be faked, so a *Today*
// read is stamped with the faked moment directly. The migration that moves
// older rows is test/dates-eastern-migration.test.ts.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { markRead, testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let book: typeof import("../src/app/api/progress/book/route");
let issue: typeof import("../src/app/api/progress/issue/route");
let range: typeof import("../src/app/api/progress/range/route");
let exp: typeof import("../src/app/api/export/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  book = await import("../src/app/api/progress/book/route");
  issue = await import("../src/app/api/progress/issue/route");
  range = await import("../src/app/api/progress/range/route");
  exp = await import("../src/app/api/export/route");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

const TZ = process.env.TZ;
afterEach(() => {
  vi.useRealTimers();
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

// Run ra places x1 and x2; run rb places x1 too, so a read of x1 in ra is
// rb's *read in …* hint.
beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO runs (id, title) VALUES ('ra', 'Run A'), ('rb', 'Run B')`;
  await sql`INSERT INTO issues (id, label) VALUES ('x1', 'X #1'), ('x2', 'X #2'), ('x3', 'X #3')`;
  await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
            VALUES ('ra', 1, 'x1'), ('ra', 2, 'x2'), ('ra', 3, 'x3'), ('rb', 1, 'x1')`;
  await sql`INSERT INTO books (id, title) VALUES ('wok', 'The Way of Kings')`;
});

/** 2026-10-31 21:30 Eastern: UTC is 01:30 on November 1st. */
const EVENING = new Date("2026-10-31T21:30:00-04:00");
/** 2026-10-31 23:30 Eastern: UTC is 03:30 on November 1st. */
const LATE = new Date("2026-10-31T23:30:00-04:00");
const at = (now: Date) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
};

const req = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, { method, body: JSON.stringify(body) });
const placement = async (run: string, iss: string) =>
  (await sql`SELECT id FROM run_issues WHERE run_id = ${run} AND issue_id = ${iss}`)[0].id as number;
const stored = async (id: number) => (await sql`
  SELECT completed_at, completed_at_precision AS precision FROM issue_progress WHERE placement_id = ${id}`)[0];
const spine = async (run: string) => (await q.runDetail(USER, run))!;

describe("Today at 21:30 Eastern on October 31 (AC-1, roadmap 1.16 check)", () => {
  it("reads October 31 in the spine and the toast", async () => {
    at(EVENING);
    expect(EVENING.toISOString()).toBe("2026-11-01T01:30:00.000Z");
    const { finishWords } = await import("../src/components/FinishDate");
    // The toast a spine row's Today says (IssueRow's *read · …*).
    expect(finishWords({ mode: "today", date: "", year: 2026 })).toBe("31 October 2026");
    // The read itself, stamped at that moment as now() would.
    await markRead(sql, USER, "ra", "x1", { at: new Date().toISOString(), precision: "exact" });
    expect((await spine("ra")).run.last_read_when).toBe("Oct 2026");
    const hint = (await spine("rb")).issues.find((r) => r.id === "x1")!;
    expect(hint.read_elsewhere_when).toBe("Oct 2026");
  });

  it("keeps a none-precision row none, with a NULL date and no date shown", async () => {
    at(EVENING);
    await markRead(sql, USER, "ra", "x1", { precision: "none" });
    expect(await stored(await placement("ra", "x1"))).toEqual({ completed_at: null, precision: "none" });
    expect((await spine("ra")).run.last_read_when).toBeNull();
    expect((await spine("rb")).issues.find((r) => r.id === "x1")!.read_elsewhere_when).toBeNull();
  });
});

describe("the future-day line at 23:30 Eastern on October 31 (AC-2)", () => {
  it("/api/progress/range accepts October 31 and refuses November 1", async () => {
    at(LATE);
    const ids = [await placement("ra", "x1")];
    const ok = await range.POST(req("/api/progress/range", "POST", { runId: "ra", placementIds: ids, mode: "date", date: "2026-10-31" }));
    expect(ok.status).toBe(200);
    await sql`DELETE FROM issue_progress`;
    const no = await range.POST(req("/api/progress/range", "POST", { runId: "ra", placementIds: ids, mode: "date", date: "2026-11-01" }));
    expect(no.status).toBe(400);
    const spread = await range.POST(req("/api/progress/range", "POST",
      { runId: "ra", placementIds: ids, mode: "spread", from: "2026-10-01", to: "2026-11-01" }));
    expect(spread.status).toBe(400);
    expect(await sql`SELECT 1 FROM issue_progress`).toHaveLength(0);
  });

  it("PATCH /api/progress/issue accepts October 31 and refuses November 1", async () => {
    at(LATE);
    const id = await markRead(sql, USER, "ra", "x1", { at: "2026-10-01T16:00:00Z", precision: "exact" });
    const redate = (date: string) => issue.PATCH(req("/api/progress/issue", "PATCH",
      { placementId: id, finish: { mode: "date", date } }));
    expect((await redate("2026-10-31")).status).toBe(200);
    expect((await redate("2026-11-01")).status).toBe(400);
  });

  it("/api/progress/book accepts October 31, refuses November 1, and Today stores October 31", async () => {
    at(LATE);
    const finish = (f: object) => book.POST(req("/api/progress/book", "POST", { bookId: "wok", status: "read", finish: f }));
    expect((await finish({ mode: "date", date: "2026-11-01" })).status).toBe(400);
    expect((await finish({ mode: "date", date: "2026-10-31" })).status).toBe(200);
    await sql`DELETE FROM read_events`;
    await sql`DELETE FROM book_status`;
    expect((await finish({ mode: "today" })).status).toBe(200);
    const [row] = await sql`SELECT finished_on::text AS on, finished_on_precision AS p FROM book_status WHERE book_id = 'wok'`;
    expect(row).toEqual({ on: "2026-10-31", p: "exact" });
    const [event] = await sql`SELECT finished_on::text AS on FROM read_events WHERE book_id = 'wok'`;
    expect(event.on).toBe("2026-10-31");
  });

  it("Year only refuses next year until it is next year in Eastern", async () => {
    const { resolveFinish } = await import("../src/lib/finish-date");
    // 23:30 Eastern on New Year's Eve: UTC is already in 2027.
    const nye = new Date("2026-12-31T23:30:00-05:00");
    expect(resolveFinish({ mode: "year", year: 2027 }, nye).ok).toBe(false);
    expect(resolveFinish({ mode: "year", year: 2026 }, nye).ok).toBe(true);
  });

  it("the export's file is named for the Eastern day", async () => {
    at(LATE);
    const res = await exp.GET();
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="ledger-2026-10-31.json"');
  });
});

describe("a picked day reads back as that day (AC-3)", () => {
  it("the range sheet's Pick a date stores 2026-03-01's Eastern midnight and reads Mar 2026", async () => {
    const id = await placement("ra", "x1");
    const res = await range.POST(req("/api/progress/range", "POST", { runId: "ra", placementIds: [id], mode: "date", date: "2026-03-01" }));
    expect(res.status).toBe(200);
    const row = await stored(id);
    expect(row.completed_at.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    const { readWhen } = await import("../src/lib/format");
    expect(readWhen(row.completed_at, "exact")).toBe("Mar 2026");
    expect((await spine("ra")).run.last_read_when).toBe("Mar 2026");
    expect((await spine("rb")).issues.find((r) => r.id === "x1")!.read_elsewhere_when).toBe("Mar 2026");
  });

  it("Spread stores each day's Eastern midnight, in winter and in summer", async () => {
    const ids = [await placement("ra", "x1"), await placement("ra", "x2"), await placement("ra", "x3")];
    const res = await range.POST(req("/api/progress/range", "POST",
      { runId: "ra", placementIds: ids, mode: "spread", from: "2019-01-01", to: "2019-07-01" }));
    expect(res.status).toBe(200);
    const first = await stored(ids[0]);
    const last = await stored(ids[2]);
    expect(first.completed_at.toISOString()).toBe("2019-01-01T05:00:00.000Z");
    expect(last.completed_at.toISOString()).toBe("2019-07-01T04:00:00.000Z");
    const { readWhen } = await import("../src/lib/format");
    expect(readWhen(first.completed_at, "approximate")).toBe("~Jan 2019");
    expect(readWhen(last.completed_at, "approximate")).toBe("~Jul 2019");
  });

  it("Change date… stores 2026-03-01's Eastern midnight and reads Mar 2026", async () => {
    const id = await markRead(sql, USER, "ra", "x1", { at: "2026-10-01T16:00:00Z", precision: "exact" });
    const res = await issue.PATCH(req("/api/progress/issue", "PATCH",
      { placementId: id, finish: { mode: "date", date: "2026-03-01" } }));
    expect(res.status).toBe(200);
    expect((await stored(id)).completed_at.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect((await spine("ra")).run.last_read_when).toBe("Mar 2026");
  });

  it("a bare calendar day formats as that day, not the evening before", async () => {
    process.env.TZ = "America/New_York";
    const { readWhen } = await import("../src/lib/format");
    expect(readWhen("2026-03-01", "exact")).toBe("Mar 2026");
    expect(readWhen("2019-07-01", "approximate")).toBe("~Jul 2019");
    expect(readWhen("2026-03-01", "none")).toBeNull();
  });

  it("the inbox's month is the Eastern one", async () => {
    const { jotted } = await import("../src/lib/inbox");
    // 22:00 Eastern on February 28th is March 1st in UTC.
    expect(jotted("2026-03-01T03:00:00Z", new Date("2026-06-01T12:00:00Z"))).toBe("Feb 2026");
  });
});

describe("the client's today is the Eastern day (AC-4)", () => {
  for (const zone of ["Pacific/Kiritimati", "Pacific/Honolulu", "UTC"]) {
    it(`at 23:30 Eastern on October 31 the picker's max is 2026-10-31, the runner in ${zone}`, async () => {
      process.env.TZ = zone;
      at(LATE);
      const FinishDate = (await import("../src/components/FinishDate")).default;
      const { finishWords, initialFinish } = await import("../src/components/FinishDate");
      const html = renderToStaticMarkup(createElement(FinishDate, {
        value: { mode: "date", date: "2026-10-30", year: 2026 }, onChange: () => {}, name: "f",
      }));
      expect(html).toContain('max="2026-10-31"');
      const saved = renderToStaticMarkup(createElement(FinishDate, {
        value: initialFinish(null), onChange: () => {}, name: "f",
      }));
      expect(saved).toContain("Saved as <b>31 October 2026</b>");
      expect(finishWords({ mode: "today", date: "", year: 2026 })).toBe("31 October 2026");
      // The one today the server and the pickers share.
      const { today } = await import("../src/lib/finish-date");
      expect(today()).toBe("2026-10-31");
    });
  }
});
