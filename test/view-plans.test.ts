// Task 0.9: a view read for one run must filter by that run before it
// aggregates, not compute the whole catalog and throw the rest away. These read
// the planner's own plan (EXPLAIN, no ANALYZE), so they assert a shape, never a
// time: every scan of run_issues carries the run filter, nothing is
// materialized catalog-wide, and run_span's label regex never scans all issues.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testSql, truncateAll } from "./db";

const sql = testSql();

type PlanNode = {
  "Node Type": string; "Relation Name"?: string; "CTE Name"?: string;
  "Index Cond"?: string; "Filter"?: string; "Recheck Cond"?: string;
  Plans?: PlanNode[];
};

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

async function plan(query: string): Promise<PlanNode[]> {
  const [row] = await sql.unsafe(`EXPLAIN (FORMAT JSON) ${query}`);
  return nodes((row["QUERY PLAN"] as { Plan: PlanNode }[])[0].Plan);
}

/** The conditions a scan applies itself, before anything above it sees a row. */
const conds = (n: PlanNode) => [n["Index Cond"], n["Recheck Cond"], n.Filter].filter(Boolean).join(" ");

beforeAll(async () => {
  await truncateAll(sql);
  await sql`INSERT INTO creators (id, name) VALUES ('w', 'Writer'), ('art', 'Artist')`;
  for (const run of ["a", "b"]) {
    await sql`INSERT INTO runs (id, title) VALUES (${run}, ${"Run " + run})`;
    for (const n of [1, 2, 3]) {
      const issue = `${run}-${n}`;
      await sql`INSERT INTO issues (id, label) VALUES (${issue}, ${`Series ${run} (2001) #${n}`})`;
      await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${run}, ${n}, ${issue})`;
      await sql`INSERT INTO issue_credits (issue_id, creator_id, role, source)
                VALUES (${issue}, 'w', 'writer', 'hand'), (${issue}, 'art', 'artist', 'hand')`;
    }
  }
});

afterAll(async () => {
  await sql.end();
});

describe("views filter by run before they aggregate (task 0.9)", () => {
  for (const view of ["run_credit_line", "run_span", "run_creators"]) {
    it(`${view}: every run_issues scan carries the run filter`, async () => {
      const scans = (await plan(`SELECT * FROM ${view} WHERE run_id = 'a'`))
        .filter((n) => n["Relation Name"] === "run_issues");
      expect(scans.length).toBeGreaterThan(0);
      // 'a' itself, or r.id inside run_credit_line's per-run subqueries, where
      // r is the one run already filtered to 'a'.
      for (const scan of scans) {
        expect(conds(scan), `${scan["Node Type"]} on run_issues`).toMatch(/run_id = ('a'|r\.id\))/);
      }
    });
  }

  it("run_credit_line materializes nothing catalog-wide", async () => {
    const ctes = (await plan(`SELECT * FROM run_credit_line WHERE run_id = 'a'`))
      .filter((n) => n["Node Type"] === "CTE Scan");
    expect(ctes.map((n) => n["CTE Name"])).toEqual([]);
  });

  it("run_span parses only the run's labels, never every issue's", async () => {
    const issueScans = (await plan(`SELECT * FROM run_span WHERE run_id = 'a'`))
      .filter((n) => n["Relation Name"] === "issues");
    for (const scan of issueScans) expect(conds(scan)).not.toMatch(/regexp_match/);
  });
});
