// The export is the exit ramp (D-17): every table in the database is in it, or
// deliberately left out. A new table that nobody adds to the list fails here (S-12).
import { afterAll, describe, expect, it } from "vitest";
import { CATALOG_TABLES, NOT_EXPORTED, USER_TABLES } from "../src/db/export-tables";
import { testSql } from "./db";

const sql = testSql();

afterAll(async () => {
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
});
