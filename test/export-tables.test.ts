// The export is the exit ramp (D-17): every table in the database is in it, or
// deliberately left out. A new table that nobody adds to the list fails here (S-12).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";
import { CATALOG_TABLES, NOT_EXPORTED, USER_TABLES } from "../src/db/export-tables";
import { testSql, truncateAll } from "./db";

const USER = "test-user";

vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/auth")>()),
  apiUserId: async () => USER,
}));

const sql = testSql();
let exportRoute: typeof import("../src/app/api/export/route");
let appSql: { end: () => Promise<void> };

beforeAll(async () => {
  // src/db reads DATABASE_URL at import time: point it at the TEST database first.
  process.env.DATABASE_URL = requireTestUrl();
  exportRoute = await import("../src/app/api/export/route");
  appSql = (await import("../src/db")).sql;
});

afterAll(async () => {
  await appSql.end();
  await sql.end();
});

describe("GET /api/export table list", () => {
  it("names every table in the schema exactly once", async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const inDb = rows.map((r) => r.table_name).sort();
    const listed = [...CATALOG_TABLES, ...USER_TABLES, ...NOT_EXPORTED].sort();
    expect(listed).toEqual(inDb);
  });

  it("scopes by user exactly the tables that have a user_id", async () => {
    const rows = await sql<{ table_name: string }[]>`
      SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t USING (table_schema, table_name)
      WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
        AND t.table_type = 'BASE TABLE'`;
    const withUser = rows.map((r) => r.table_name).sort();
    expect([...USER_TABLES].sort()).toEqual(withUser);
  });

  it("exports plan_acceptance whole: a stretch year carries no user_id (task 2.7, D-91, AC-6)", async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'plan_acceptance'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(["accepted_at", "accepted_total", "year"]);
    expect(CATALOG_TABLES).toContain("plan_acceptance");
  });

  it("exports owned_copies whole: what you own carries no user_id (task 5.17, D-91, D-132, AC-4)", async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'owned_copies'`;
    expect(cols.map((c) => c.column_name).sort()).toEqual(["book_id", "format"]);
    expect(CATALOG_TABLES).toContain("owned_copies");

    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
    await sql`INSERT INTO books (id, title) VALUES ('dune', 'Dune'), ('emma', 'Emma')`;
    await sql`INSERT INTO owned_copies (book_id, format) VALUES ('dune', 'physical'), ('dune', 'audio'), ('emma', 'audio')`;
    const res = await exportRoute.GET();
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, { book_id: string; format: string }[]>;
    const rows = body.owned_copies.map((r) => `${r.book_id}:${r.format}`).sort();
    expect(rows).toEqual(["dune:audio", "dune:physical", "emma:audio"]);
  });
});
