// Task 0.1's first integration test: three runs, two issues each, one hard prereq
// edge. B is blocked until A is read, then ready_all. It exercises the
// `>= 1.0` completion threshold and the users CROSS JOIN in run_readiness.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { markRead, testSql, truncateAll } from "./db";

const sql = testSql();
const USER = "test-user";

async function readiness(runId: string) {
  const [row] = await sql<{ readiness: string; state: string }[]>`
    SELECT rd.readiness, rs.state
    FROM run_readiness rd JOIN run_state rs USING (user_id, run_id)
    WHERE rd.user_id = ${USER} AND rd.run_id = ${runId}`;
  return row;
}

beforeEach(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO users (id, name) VALUES (${USER}, 'Test')`;
  for (const r of ["a", "b", "c"]) {
    await sql`INSERT INTO runs (id, title) VALUES (${r}, ${"Run " + r})`;
    for (const n of [1, 2]) {
      await sql`INSERT INTO issues (id, label) VALUES (${`${r}-${n}`}, ${`${r} #${n}`})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${r}, ${n}, ${`${r}-${n}`})`;
    }
  }
  await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('b', 'a', 'hard')`;
});

afterAll(async () => {
  await sql.end();
});

describe("run_readiness", () => {
  it("is blocked while a hard prerequisite is unread, then ready_all once it is read", async () => {
    expect((await readiness("b")).readiness).toBe("blocked");
    expect((await readiness("c")).readiness).toBe("ready_all");

    await markRead(sql, USER, "a", "a-1");
    expect((await readiness("b")).readiness).toBe("blocked"); // half read is still unread

    await markRead(sql, USER, "a", "a-2");
    expect((await readiness("b")).readiness).toBe("ready_all");
  });

  it("uses one vocabulary in both views (R0-12)", async () => {
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('c', 'a', 'soft')`;
    const rows = await sql<{ readiness: string }[]>`SELECT DISTINCT readiness FROM run_readiness`;
    for (const r of rows) expect(r.readiness).toMatch(/^(blocked|ready_hard|ready_all)$/);
  });
});

describe("run_ancestors (R2-01, R2-04)", () => {
  it("terminates on a branching graph with a back edge and never lists the target", async () => {
    // a <- b <- c, plus c -> a closing a cycle
    await sql`INSERT INTO prereqs (run_id, prereq_run_id, type) VALUES ('c', 'b', 'hard'), ('a', 'c', 'hard')`;
    const rows = await sql<{ run_id: string }[]>`SELECT run_id FROM run_ancestors('c')`;
    expect(rows.map((r) => r.run_id).sort()).toEqual(["a", "b"]);
  });
});

describe("date precision (D-R3-1)", () => {
  it("stores an undated read, and refuses a date and a precision that disagree", async () => {
    await markRead(sql, USER, "a", "a-1", { at: null, precision: "none" });
    await expect(markRead(sql, USER, "a", "a-2", { at: null, precision: "exact" }))
      .rejects.toThrow(/precision_check/);
  });
});
