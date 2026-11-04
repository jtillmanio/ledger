// Task 2.0 (F-21, R1-05): Settings against the TEST database. A user with no
// `reading_settings` row reads the column defaults; the first edit inserts the
// row and a later one changes only the fields it names; the read never caches,
// so another render sees the new value without a redeploy; the write route
// refuses what is out of bounds and writes nothing. The Stepper is a named
// button group whose bound is `aria-disabled` with a visible reason, never a
// bare `disabled`.
import { renderToStaticMarkup, renderToString } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import Stepper from "../src/components/Stepper";
import { UndoProvider } from "../src/components/Undo";
import { DEFAULT_SETTINGS, SETTING_BOUNDS, wordsPerYear } from "../src/lib/settings";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
  requireUserId: async () => USER,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const sql = testSql();
let q: typeof import("../src/db/queries");
let route: typeof import("../src/app/api/settings/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  q = await import("../src/db/queries");
  route = await import("../src/app/api/settings/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(sql);
  await sql`TRUNCATE reading_settings, volume_rules RESTART IDENTITY CASCADE`;
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
});

const patch = (body: unknown) =>
  route.PATCH(new Request("http://test/api/settings", {
    method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body),
  }));
const rows = () => sql`SELECT minutes_per_day, words_per_minute, words_per_page FROM reading_settings WHERE user_id = ${USER}`;

describe("a user with no row (AC-1, AC-2)", () => {
  it("gets the column defaults, and the code's defaults are the column's", async () => {
    expect(await rows()).toHaveLength(0);
    expect(await q.readingSettings(USER)).toEqual({ minutesPerDay: 45, wordsPerMinute: 185, wordsPerPage: 275 });
    const cols = await sql`
      SELECT column_name, column_default FROM information_schema.columns
      WHERE table_name = 'reading_settings' AND column_name IN ('minutes_per_day', 'words_per_minute', 'words_per_page')`;
    const dflt = Object.fromEntries(cols.map((c) => [c.column_name, Number(c.column_default)]));
    expect(DEFAULT_SETTINGS).toEqual({
      minutesPerDay: dflt.minutes_per_day, wordsPerMinute: dflt.words_per_minute, wordsPerPage: dflt.words_per_page,
    });
  });

  it("a read writes no row", async () => {
    await q.readingSettings(USER);
    expect(await rows()).toHaveLength(0);
  });
});

describe("PATCH /api/settings", () => {
  it("60 minutes a day leaves one row, and the next read sees it (no cache)", async () => {
    expect((await q.readingSettings(USER)).minutesPerDay).toBe(45);
    const res = await patch({ minutesPerDay: 60 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, settings: { minutesPerDay: 60, wordsPerMinute: 185, wordsPerPage: 275 } });
    expect(await rows()).toEqual([{ minutes_per_day: 60, words_per_minute: 185, words_per_page: 275 }]);
    expect((await q.readingSettings(USER)).minutesPerDay).toBe(60);
    // The other readers of the row see it too: add-book's words per page.
    expect(await q.wordsPerPage(USER)).toBe(275);
  });

  it("changes only the fields it names, on the existing row", async () => {
    await patch({ wordsPerMinute: 200 });
    await patch({ minutesPerDay: 60, wordsPerPage: 300 });
    expect(await rows()).toEqual([{ minutes_per_day: 60, words_per_minute: 200, words_per_page: 300 }]);
    expect(await q.wordsPerPage(USER)).toBe(300);
  });

  it("takes the bounds themselves", async () => {
    for (const [key, { min, max }] of Object.entries(SETTING_BOUNDS)) {
      for (const value of [min, max]) expect((await patch({ [key]: value })).status, `${key} ${value}`).toBe(200);
    }
  });

  it("refuses 0, a negative, a non-integer, text, an over-bound value, an unknown or missing field and a bad body with 400, writing nothing", async () => {
    const bad: unknown[] = [
      { minutesPerDay: 0 }, { minutesPerDay: -15 }, { minutesPerDay: 1.5 }, { minutesPerDay: "60" }, { minutesPerDay: null },
      { minutesPerDay: SETTING_BOUNDS.minutesPerDay.max + 1 }, { wordsPerMinute: SETTING_BOUNDS.wordsPerMinute.min - 1 },
      { wordsPerMinute: SETTING_BOUNDS.wordsPerMinute.max + 1 }, { wordsPerPage: 0 }, { wordsPerPage: 1e9 },
      { minutesPerDay: 60, wordsPerMinute: 0 }, // one good field never carries a bad one
      { minutesPerDay: 60, theme: "dark" }, { theme: "dark" }, { userId: "someone-else", minutesPerDay: 60 },
      {}, [], [60], null, 60, "not json", "",
    ];
    for (const body of bad) {
      const res = await patch(typeof body === "string" ? body : JSON.stringify(body));
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json(), JSON.stringify(body)).toEqual({ error: expect.any(String) });
    }
    expect(await rows()).toHaveLength(0);
  });
});

describe("the volume map line (AC-4)", () => {
  it("counts rules and distinct series: 3 rules over 2 series", async () => {
    expect(await q.volumeMapCounts()).toEqual({ rules: 0, series: 0 });
    await sql`INSERT INTO volume_rules (series, year) VALUES ('X-Men', 1991), ('X-Men', 2019), ('Avengers', 2018)`;
    expect(await q.volumeMapCounts()).toEqual({ rules: 3, series: 2 });
  });
});

describe("the year figure", () => {
  it("is minutes × words a minute × the days in the year, 366 in a leap year", () => {
    expect(wordsPerYear({ minutesPerDay: 60, wordsPerMinute: 185 }, 2027)).toBe(60 * 185 * 365);
    expect(wordsPerYear({ minutesPerDay: 45, wordsPerMinute: 185 }, 2028)).toBe(45 * 185 * 366);
    expect(wordsPerYear({ minutesPerDay: 45, wordsPerMinute: 185 }, 2100)).toBe(45 * 185 * 365);
  });
});

describe("the Stepper (AC-3, AC-5)", () => {
  const stepper = (value: number, extra: Partial<React.ComponentProps<typeof Stepper>> = {}) =>
    renderToString(<Stepper label="Minutes a day" value={value} min={1} max={600} step={1} onChange={() => {}} {...extra} />);

  it("is a named group of two real buttons and an output", () => {
    const html = stepper(45);
    expect(html).toMatch(/role="group"[^>]*aria-label="Minutes a day"|aria-label="Minutes a day"[^>]*role="group"/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Decrease minutes a day"/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Increase minutes a day"/);
    expect(html).toMatch(/<output[^>]*>45<\/output>/);
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
  });

  it("the − at the lower bound is aria-disabled with a visible reason, never disabled", () => {
    const html = stepper(1);
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(1);
    expect(html).not.toMatch(/\sdisabled(=|\s|>)/);
    const decrease = html.match(/<button[^>]*aria-label="Decrease minutes a day"[^>]*>/)![0];
    expect(decrease).toContain('aria-disabled="true"');
    const reasonId = decrease.match(/aria-describedby="([^"]+)"/)![1];
    expect(html).toMatch(new RegExp(`<[a-z]+[^>]*id="${reasonId}"[^>]*>[^<]*lowest[^<]*1`));
    expect(html.match(/<button[^>]*aria-label="Increase minutes a day"[^>]*>/)![0]).not.toContain("aria-disabled");
  });

  it("the + at the upper bound is aria-disabled with its reason", () => {
    const html = stepper(600);
    const increase = html.match(/<button[^>]*aria-label="Increase minutes a day"[^>]*>/)![0];
    expect(increase).toContain('aria-disabled="true"');
    expect(html).toContain("highest is 600");
    expect(html.match(/<button[^>]*aria-label="Decrease minutes a day"[^>]*>/)![0]).not.toContain("aria-disabled");
  });
});

describe("the screen reads the row live (AC-2)", () => {
  it("shows the saved value in the stepper and the year figure beside it", async () => {
    const render = async () => {
      const Page = (await import("../src/app/settings/page")).default;
      return renderToStaticMarkup(<UndoProvider>{await Page()}</UndoProvider>);
    };
    const before = await render();
    expect(before).toMatch(/aria-label="Minutes a day"[\s\S]*?<output[^>]*>45<\/output>/);
    expect(before).toContain("At 45 minutes a day");
    expect(before.match(/<h1/g)).toHaveLength(1);

    await patch({ minutesPerDay: 60 });
    const after = await render();
    expect(after).toMatch(/aria-label="Minutes a day"[\s\S]*?<output[^>]*>60<\/output>/);
    expect(after).toContain("At 60 minutes a day");
    const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric" }).format(new Date()));
    const days = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
    expect(after).toContain(`${((60 * 185 * days) / 1e6).toFixed(1)}M`);
  });

  it("draws the volume map line and Export everything as a plain link", async () => {
    await sql`INSERT INTO volume_rules (series, year) VALUES ('X-Men', 1991), ('X-Men', 2019), ('Avengers', 2018)`;
    const Page = (await import("../src/app/settings/page")).default;
    const html = renderToStaticMarkup(<UndoProvider>{await Page()}</UndoProvider>);
    expect(html).toContain("3 rules · 2 series");
    expect(html).toMatch(/<a [^>]*href="\/api\/export"[^>]*>Download<\/a>/);
    expect(html).toContain("Export everything");
  });
});
