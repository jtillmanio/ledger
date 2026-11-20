// Task 5.15, part 3 of 4 (TASK-110, F-66, D-105) against the TEST database:
// how often the parked review comes due (`reading_settings.parked_review`,
// monthly · quarterly · never, quarterly by default), when it is due (derived
// by src/lib/parked.ts reviewDue, never stored: something parked, the cadence
// not never, and no review yet or the last one a calendar month or three
// back), and *Done reviewing*, which records today's Eastern day in
// `parked_reviewed_on` with an undo that puts the day before back. The status
// is TASK-108's, the verb and chip TASK-109's, /parked and the reminders TASK-111's.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { addMonths, reviewDue } from "../src/lib/parked";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let review: typeof import("../src/app/api/parked/review/route");
let settings: typeof import("../src/app/api/settings/route");
let q: typeof import("../src/db/queries");
let appSql: { end: () => Promise<void> };

/** Noon UTC on 2027-03-15 is the 15th in Eastern too: a fixed today. */
const NOW = new Date("2027-03-15T12:00:00Z");
const TODAY = "2027-03-15";
/** `days` before TODAY, as a `YYYY-MM-DD`. */
const ago = (days: number) => new Date(Date.UTC(2027, 2, 15 - days)).toISOString().slice(0, 10);

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  review = await import("../src/app/api/parked/review/route");
  settings = await import("../src/app/api/settings/route");
  q = await import("../src/db/queries");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  vi.useRealTimers();
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  vi.useRealTimers();
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  await sql`INSERT INTO books (id, title) VALUES ('a', 'Alpha'), ('b', 'Bravo')`;
  await sql`INSERT INTO books (id, title, deleted_at) VALUES ('gone', 'Removed', now())`;
  await sql`INSERT INTO book_status (user_id, book_id, status) SELECT ${USER}, id, 'to_read' FROM books`;
});

/** Park one book as TASK-108's write leaves it: the status and the day. */
async function parkOne(bookId = "a") {
  await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(200)} WHERE book_id = ${bookId}`;
}

async function settle(cadence: string, reviewedOn: string | null) {
  await sql`INSERT INTO reading_settings (user_id, parked_review, parked_reviewed_on)
            VALUES (${USER}, ${cadence}, ${reviewedOn})`;
}

const stored = async () =>
  (await sql`SELECT parked_review, parked_reviewed_on::text AS on FROM reading_settings WHERE user_id = ${USER}`)[0];

function patch(body: unknown) {
  return settings.PATCH(new Request("http://ledger.test/api/settings", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }));
}

function undo(change: unknown) {
  return review.DELETE(new Request("http://ledger.test/api/parked/review", {
    method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }),
  }));
}

describe("when the review is due (AC-1, AC-2)", () => {
  it("monthly, one parked book and a last review 40 days ago: due", async () => {
    await parkOne();
    await settle("monthly", ago(40));
    expect(await q.parkedReview(USER, NOW)).toEqual({ cadence: "monthly", reviewedOn: ago(40), parked: 1, due: true });
  });

  it("monthly with nothing parked: not due, a removed parked book counting for nothing", async () => {
    await settle("monthly", ago(40));
    expect((await q.parkedReview(USER, NOW)).due).toBe(false);
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(200)} WHERE book_id = 'gone'`;
    expect(await q.parkedReview(USER, NOW)).toMatchObject({ parked: 0, due: false });
  });

  it("quarterly with a review 40 days ago is not due; at 100 days it is", async () => {
    await parkOne();
    await settle("quarterly", ago(40));
    expect((await q.parkedReview(USER, NOW)).due).toBe(false);
    await sql`UPDATE reading_settings SET parked_reviewed_on = ${ago(100)}`;
    expect((await q.parkedReview(USER, NOW)).due).toBe(true);
  });

  it("never is never due, a year after the last review or with none", async () => {
    await parkOne();
    await settle("never", ago(400));
    expect((await q.parkedReview(USER, NOW)).due).toBe(false);
    await sql`UPDATE reading_settings SET parked_reviewed_on = NULL`;
    expect((await q.parkedReview(USER, NOW)).due).toBe(false);
  });

  it("no review yet and one parked book: due, on the quarterly default with no settings row", async () => {
    await parkOne();
    expect(await q.parkedReview(USER, NOW)).toEqual({ cadence: "quarterly", reviewedOn: null, parked: 1, due: true });
    expect(await sql`SELECT 1 FROM reading_settings`).toHaveLength(0);
  });

  it("comes due on the day a calendar month (or three) has passed, not the day before", () => {
    const s = { cadence: "monthly" as const, reviewedOn: "2027-02-15", parked: 1 };
    expect(reviewDue(s, "2027-03-14")).toBe(false);
    expect(reviewDue(s, "2027-03-15")).toBe(true);
    expect(reviewDue({ ...s, cadence: "quarterly" }, "2027-05-14")).toBe(false);
    expect(reviewDue({ ...s, cadence: "quarterly" }, "2027-05-15")).toBe(true);
  });

  it("counts months as Postgres does: the 31st clamps to a shorter month's end, across a year", async () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    const days = ["2027-01-31", "2028-01-31", "2026-11-30", "2026-12-15", "2027-08-31"];
    for (const d of days) {
      for (const n of [1, 3]) {
        const [row] = await sql`SELECT (${d}::date + make_interval(months => ${n}))::date::text AS d`;
        expect(addMonths(d, n), `${d} + ${n}`).toBe(row.d);
      }
    }
  });
});

describe("Done reviewing (AC-1, AC-3)", () => {
  it("records today's Eastern day and makes the review not due; its undo puts NULL back", async () => {
    await parkOne();
    // 01:00 UTC on the 16th is still the 15th in Eastern.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-03-16T01:00:00Z"));
    expect((await q.parkedReview(USER)).due).toBe(true);
    const res = await review.POST();
    expect(res.status).toBe(200);
    const { change } = await res.json();
    expect(change).toEqual({ prior: null, reviewedOn: TODAY });
    expect(await stored()).toEqual({ parked_review: "quarterly", on: TODAY });
    expect(await q.parkedReview(USER)).toMatchObject({ reviewedOn: TODAY, parked: 1, due: false });
    vi.useRealTimers();

    expect((await undo(change)).status).toBe(200);
    expect((await stored()).on).toBeNull();
  });

  it("on a monthly cadence 40 days on, makes it not due; undo puts the day before back and it is due again", async () => {
    await parkOne();
    await settle("monthly", ago(40));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { change } = await (await review.POST()).json();
    expect(change).toEqual({ prior: ago(40), reviewedOn: TODAY });
    expect((await q.parkedReview(USER)).due).toBe(false);
    expect((await undo(change)).status).toBe(200);
    expect(await stored()).toEqual({ parked_review: "monthly", on: ago(40) });
    expect((await q.parkedReview(USER)).due).toBe(true);
  });

  it("an undo after another review since is a 409 and changes nothing; a bad change is a 400", async () => {
    await settle("monthly", ago(40));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const { change } = await (await review.POST()).json();
    await sql`UPDATE reading_settings SET parked_reviewed_on = ${ago(-1)}`;
    expect((await undo(change)).status).toBe(409);
    expect((await stored()).on).toBe(ago(-1));
    for (const bad of [null, {}, { prior: null }, { prior: "yesterday", reviewedOn: TODAY }, { prior: null, reviewedOn: "2027-02-30" }]) {
      expect((await undo(bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await stored()).on).toBe(ago(-1));
  });
});

describe("the cadence (AC-3, AC-4)", () => {
  it("PATCH parkedReview monthly saves, the next read sees it, and the pace is untouched", async () => {
    const res = await patch({ parkedReview: "monthly" });
    expect(res.status).toBe(200);
    expect((await res.json()).settings).toEqual({ minutesPerDay: 45, wordsPerMinute: 185, wordsPerPage: 275, parkedReview: "monthly" });
    expect((await q.parkedReview(USER, NOW)).cadence).toBe("monthly");
    expect((await patch({ parkedReview: "never" })).status).toBe(200);
    expect((await q.parkedReview(USER, NOW)).cadence).toBe("never");
  });

  it("refuses any other cadence with 400 and writes nothing", async () => {
    await settle("monthly", null);
    for (const bad of ["weekly", "Monthly", "", null, 3, ["monthly"]]) {
      const res = await patch({ parkedReview: bad });
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    // One bad field refuses the lot: the good pace value beside it is not written either.
    expect((await patch({ minutesPerDay: 60, parkedReview: "yearly" })).status).toBe(400);
    expect((await sql`SELECT minutes_per_day, parked_review FROM reading_settings`)[0])
      .toEqual({ minutes_per_day: 45, parked_review: "monthly" });
  });

  it("the CHECK refuses any other cadence written straight to the table", async () => {
    await expect(settle("weekly", null)).rejects.toThrow(/reading_settings_parked_review_check/);
    await settle("never", null);
    await expect(sql`UPDATE reading_settings SET parked_review = 'yearly'`).rejects.toThrow(/reading_settings_parked_review_check/);
    expect((await stored()).parked_review).toBe("never");
  });
});

// ---- Task 5.15, part 5 of 5 (TASK-111): what /parked lists, and how it says each book's age ----

describe("parkedBooks: what /parked lists (TASK-111 AC-2)", () => {
  beforeEach(async () => {
    await sql`INSERT INTO authors (id, name) VALUES ('au', 'Brandon Sanderson')`;
    await sql`INSERT INTO book_universes (id, name) VALUES ('cos', 'Cosmere')`;
    await sql`INSERT INTO book_series (id, name, total_books) VALUES ('mb', 'Mistborn', 7)`;
    await sql`INSERT INTO books (id, title, author_id, universe_id, series_id, series_position, word_count, word_count_source)
              VALUES ('c', 'Charlie', 'au', 'cos', 'mb', 4, 120000, 'stated'), ('d', 'Delta', NULL, NULL, NULL, NULL, NULL, NULL)`;
    await sql`INSERT INTO book_status (user_id, book_id, status) VALUES (${USER}, 'c', 'to_read'), (${USER}, 'd', 'to_read')`;
  });

  it("every live Parked book, oldest parked first, then by title; a removed or unparked book isn't listed", async () => {
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(14)} WHERE book_id = 'a'`;
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(120)} WHERE book_id IN ('c', 'gone')`;
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(14)} WHERE book_id = 'd'`;
    expect((await q.parkedBooks(USER)).map((b) => [b.id, b.parked_on])).toEqual([
      ["c", ago(120)], ["a", ago(14)], ["d", ago(14)],
    ]);
  });

  it("carries the row's line and the picker's header: author, universe, series #n, words, and whether it was mid-read", async () => {
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(120)}, started_on = ${ago(150)},
                                     started_on_precision = 'exact' WHERE book_id = 'c'`;
    await sql`UPDATE book_status SET status = 'parked', parked_on = ${ago(14)} WHERE book_id = 'd'`;
    const [c, d] = await q.parkedBooks(USER);
    expect(c).toMatchObject({
      id: "c", title: "Charlie", author: "Brandon Sanderson", universe: "Cosmere", series: "Mistborn", series_position: 4,
      words: 120000, estimated: false, started_on_precision: "exact",
    });
    expect(d).toMatchObject({
      id: "d", title: "Delta", author: null, universe: null, series: null, series_position: null,
      words: null, estimated: false, started_on_precision: "none",
    });
  });

  it("nothing parked lists nothing", async () => {
    expect(await q.parkedBooks(USER)).toEqual([]);
  });
});

describe("the Inbox row's line: N parked, and since when it has been due (TASK-111 AC-4)", () => {
  it("monthly, reviewed 40 days ago: due since a month after that review; never reviewed: just the count; never: no day", async () => {
    const { reviewDueOn } = await import("../src/lib/parked");
    const { parkedReviewLine } = await import("../src/lib/inbox");
    expect(reviewDueOn({ cadence: "monthly", reviewedOn: ago(40) })).toBe("2027-03-03");
    expect(reviewDueOn({ cadence: "quarterly", reviewedOn: "2026-11-30" })).toBe("2027-02-28");
    expect(reviewDueOn({ cadence: "monthly", reviewedOn: null })).toBeNull();
    expect(reviewDueOn({ cadence: "never", reviewedOn: ago(40) })).toBeNull();
    expect(parkedReviewLine({ cadence: "monthly", reviewedOn: ago(40), parked: 3 }, NOW)).toBe("3 parked · due since 3 Mar");
    expect(parkedReviewLine({ cadence: "quarterly", reviewedOn: null, parked: 1 }, NOW)).toBe("1 parked");
    // The day it fell due agrees with the due rule: due on it, not the day before.
    const state = { cadence: "monthly" as const, reviewedOn: ago(40), parked: 3 };
    expect(reviewDue(state, "2027-03-03")).toBe(true);
    expect(reviewDue(state, "2027-03-02")).toBe(false);
  });
});

describe("parkedAge: how long a book has been parked (TASK-111 AC-2)", () => {
  it("today, days, weeks, calendar months, then years", async () => {
    const { parkedAge } = await import("../src/lib/parked");
    expect(parkedAge(TODAY, TODAY)).toBe("Parked today");
    expect(parkedAge(ago(1), TODAY)).toBe("Parked 1 day");
    expect(parkedAge(ago(6), TODAY)).toBe("Parked 6 days");
    expect(parkedAge(ago(7), TODAY)).toBe("Parked 1 week");
    expect(parkedAge(ago(14), TODAY)).toBe("Parked 2 weeks");
    // Feb 15 to Mar 15 is a calendar month: 28 days here.
    expect(parkedAge("2027-02-15", TODAY)).toBe("Parked 1 month");
    expect(parkedAge("2027-02-16", TODAY)).toBe("Parked 3 weeks");
    expect(parkedAge("2026-11-15", TODAY)).toBe("Parked 4 months");
    expect(parkedAge("2026-11-16", TODAY)).toBe("Parked 3 months");
    expect(parkedAge("2026-03-15", TODAY)).toBe("Parked 1 year");
    expect(parkedAge("2024-01-01", TODAY)).toBe("Parked 3 years");
  });
});
