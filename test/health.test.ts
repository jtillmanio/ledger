// /api/health is Release's smoke test: it must say when the database or the
// views are missing, name the build's commit, and be reachable without the
// passcode cookie.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { testSql } from "./db";

const sql = testSql();
let GET: () => Promise<Response>;
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  process.env.VERCEL_GIT_COMMIT_SHA = "abc1234def";
  GET = (await import("../src/app/api/health/route")).GET;
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  await appSql.end();
  await sql.end();
});

describe("/api/health", () => {
  it("answers ok with the build's commit when the database and views are there", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ ok: true, commit: "abc1234def" });
  });

  it("answers 503 naming the views when etl/views.sql is not applied", async () => {
    await sql`ALTER VIEW run_progress RENAME TO run_progress_hidden_by_health_test`;
    try {
      const res = await GET();
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ ok: false, failed: "views", commit: "abc1234def" });
    } finally {
      await sql`ALTER VIEW run_progress_hidden_by_health_test RENAME TO run_progress`;
    }
  });
});

describe("proxy (the passcode gate)", () => {
  it("is exported under the name Next 16 runs, and sends a request without a cookie to /login", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("../src/proxy");
    const out = proxy(new NextRequest("http://ledger.test/comics"));
    expect(out.status).toBe(307);
    expect(out.headers.get("location")).toBe("http://ledger.test/login?next=%2Fcomics");

    const withCookie = new NextRequest("http://ledger.test/comics", { headers: { cookie: "rt_session=x" } });
    expect(proxy(withCookie).headers.get("x-middleware-next")).toBe("1");
  });

  it("lets /api/health past the passcode gate and nothing else new", async () => {
    const { config } = await import("../src/proxy");
    const gated = new RegExp(`^${config.matcher[0]}$`);
    expect(gated.test("/api/health")).toBe(false);
    expect(gated.test("/login")).toBe(false);
    expect(gated.test("/api/export")).toBe(true);
    expect(gated.test("/api/progress/issue")).toBe(true);
    expect(gated.test("/comics")).toBe(true);
  });
});
