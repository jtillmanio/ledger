// The test database never JIT-compiles a query, because the live one can't:
// Neon has no JIT provider (pg_jit_available() is false). CI's PGDG server has
// one, and on freshly truncated tables the planner's default row guesses
// pushed run_readiness past every JIT threshold, so a six-row query spent over
// 5s compiling and run-readiness.test.ts timed out (#91, #94; PR #95's log).
// .github/actions/start-postgres starts that server with jit=off.
import { afterAll, describe, expect, it } from "vitest";
import { testSql } from "./db";

const sql = testSql();

afterAll(async () => {
  await sql.end();
});

describe("the test database", () => {
  it("never JIT-compiles, as Neon can't", async () => {
    const [{ jit }] = await sql`SELECT current_setting('jit') = 'on' AND pg_jit_available() AS jit`;
    expect(jit).toBe(false);
  });
});
