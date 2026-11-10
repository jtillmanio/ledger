import { describe, expect, it } from "vitest";
import { buildSteps, endpointId, previewBranchToDelete, previewDbProblem, SWEEP_GRACE_MS, sweepDecision } from "../scripts/lib/preview.mjs";

const LIVE_POOLED = "postgresql://u:p@ep-live-a1b2-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
const LIVE_HOST = "ep-live-a1b2.c-2.us-east-2.aws.neon.tech";
const BRANCH_POOLED = "postgresql://u:p@ep-branch-c3d4-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";
const BRANCH_DIRECT = "postgresql://u:p@ep-branch-c3d4.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

const preview = {
  VERCEL_ENV: "preview",
  DATABASE_URL: BRANCH_POOLED,
  DATABASE_URL_UNPOOLED: BRANCH_DIRECT,
  LEDGER_LIVE_DB_HOST: LIVE_HOST,
};

describe("endpointId", () => {
  it("is the same for pooled, direct and bare-host spellings", () => {
    expect(endpointId(LIVE_POOLED)).toBe("ep-live-a1b2");
    expect(endpointId(LIVE_HOST)).toBe("ep-live-a1b2");
    expect(endpointId("EP-LIVE-A1B2-POOLER.c-2.us-east-2.aws.neon.tech")).toBe("ep-live-a1b2");
    expect(endpointId(undefined)).toBeNull();
  });
});

describe("buildSteps: only a preview migrates, and only its own branch", () => {
  it("never migrates production, whatever else is set", () => {
    expect(buildSteps({ ...preview, VERCEL_ENV: "production" })).toEqual(["next build"]);
    expect(buildSteps({ VERCEL_ENV: "production", DATABASE_URL: LIVE_POOLED })).toEqual(["next build"]);
  });

  it("never migrates outside Vercel or in development", () => {
    expect(buildSteps({ DATABASE_URL: LIVE_POOLED })).toEqual(["next build"]);
    expect(buildSteps({ ...preview, VERCEL_ENV: "development" })).toEqual(["next build"]);
  });

  it("migrates a preview on the integration's branch, then applies views, then builds", () => {
    expect(buildSteps(preview)).toEqual(["migrate", "views", "next build"]);
  });

  it("refuses a preview holding the live database, pooled or direct, however it is spelled", () => {
    expect(() => buildSteps({ ...preview, DATABASE_URL: LIVE_POOLED })).toThrow(/is the live database/);
    expect(() => buildSteps({ ...preview, DATABASE_URL_UNPOOLED: LIVE_POOLED.replace("-pooler", "") }))
      .toThrow(/is the live database/);
    expect(() => buildSteps({ ...preview, DATABASE_URL: LIVE_POOLED, DATABASE_URL_UNPOOLED: undefined, LEDGER_LIVE_DB_HOST: LIVE_POOLED }))
      .toThrow(/is the live database/);
  });

  it("refuses when it cannot prove the database is not live", () => {
    expect(() => buildSteps({ ...preview, LEDGER_LIVE_DB_HOST: undefined })).toThrow(/LEDGER_LIVE_DB_HOST is not set/);
    expect(() => buildSteps({ ...preview, LEDGER_LIVE_DB_HOST: "" })).toThrow(/LEDGER_LIVE_DB_HOST is not set/);
  });

  it("refuses a preview the integration gave no database", () => {
    expect(previewDbProblem({ VERCEL_ENV: "preview", LEDGER_LIVE_DB_HOST: LIVE_HOST })).toMatch(/no DATABASE_URL/);
  });

  it("names the fix for a stale Obsolete branch, which blocked every preview on 2026-11-10 (PR #229, #231)", () => {
    const said = previewDbProblem({ VERCEL_ENV: "preview", LEDGER_LIVE_DB_HOST: LIVE_HOST });
    expect(said).toMatch(/Settings > Vercel > Branches/);
    expect(said).toMatch(/Obsolete branch: delete it/);
  });
});

describe("previewBranchToDelete", () => {
  const branches = [
    { id: "br-live", name: "main", default: true, protected: false },
    { id: "br-test", name: "test", default: false },
    { id: "br-snap", name: "pre-release/202610150900-abc1234", default: false },
    { id: "br-pr", name: "preview/task/1.3-bulk-entry-parser", default: false, protected: false },
    { id: "br-other", name: "preview/task/1.3-bulk-entry-parser-2", default: false },
  ];

  it("picks exactly preview/<git branch>", () => {
    expect(previewBranchToDelete(branches, "task/1.3-bulk-entry-parser")?.id).toBe("br-pr");
    expect(previewBranchToDelete(branches, "task/1.3")).toBeNull();
    expect(previewBranchToDelete(branches, "fix/gone")).toBeNull();
  });

  it("never picks the live, test or snapshot branches", () => {
    for (const git of ["main", "test", "202610150900-abc1234", "", " ", undefined]) {
      expect(previewBranchToDelete(branches, git)).toBeNull();
    }
    // Even when a default or protected branch carries a preview name.
    const live = [{ id: "br-live", name: "preview/main", default: true }];
    const kept = [{ id: "br-kept", name: "preview/keep", default: false, protected: true }];
    expect(previewBranchToDelete(live, "main")).toBeNull();
    expect(previewBranchToDelete(kept, "keep")).toBeNull();
  });
});

describe("sweepDecision (the daily Neon sweep, a backstop to the integration)", () => {
  const now = Date.parse("2026-11-12T09:17:00Z");
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const preview = (name: string, createdHoursAgo = 72) => ({ name: `preview/${name}`, default: false, protected: false, created_at: ago(createdHoursAgo) });
  const closed = (number: number, hoursAgo: number) => ({ number, state: "closed", closed_at: ago(hoursAgo) });

  it("gives the grace period a day", () => {
    expect(SWEEP_GRACE_MS).toBe(24 * 3_600_000);
  });

  it("keeps a branch whose PR is open, however old", () => {
    expect(sweepDecision(preview("dependabot/npm_and_yarn/x", 500), [{ number: 216, state: "open", closed_at: null }], true, now))
      .toEqual({ delete: false, why: "PR #216 is open" });
  });

  it("leaves a PR closed under a day ago to the integration, and deletes it after", () => {
    // 2026-11-10: the workflow deleted preview/chore/ci-browser-gate at the PR's
    // close, under the integration, and its stale entry blocked every preview.
    expect(sweepDecision(preview("chore/ci-browser-gate"), [closed(227, 2)], false, now))
      .toEqual({ delete: false, why: "PR #227 closed 2 h ago: the integration's turn" });
    expect(sweepDecision(preview("chore/ci-browser-gate"), [closed(227, 24)], false, now))
      .toEqual({ delete: true, why: "PR #227 closed 24 h ago" });
  });

  it("goes by the latest PR when a branch had several", () => {
    // docs/perf-budget-gate: #229 closed, the same branch could be reopened as a new PR.
    expect(sweepDecision(preview("docs/x"), [closed(229, 30), closed(231, 3)], true, now))
      .toEqual({ delete: false, why: "PR #231 closed 3 h ago: the integration's turn" });
    expect(sweepDecision(preview("docs/x"), [closed(229, 30), { number: 231, state: "open", closed_at: null }], true, now))
      .toEqual({ delete: false, why: "PR #231 is open" });
  });

  it("keeps a pushed branch with no PR yet, and deletes one whose git branch is gone once it is a day old", () => {
    expect(sweepDecision(preview("fix/wip", 200), [], true, now))
      .toEqual({ delete: false, why: "no PR yet, and the git branch is still there" });
    expect(sweepDecision(preview("fix/gone", 5), [], false, now))
      .toEqual({ delete: false, why: "no PR and the git branch is gone, but the Neon branch is only 5 h old" });
    expect(sweepDecision(preview("fix/gone", 30), [], false, now))
      .toEqual({ delete: true, why: "no PR, the git branch is gone, and the Neon branch is 30 h old" });
  });

  it("never considers the live, test, snapshot, default or protected branches", () => {
    for (const name of ["production", "development", "test", "pre-release/202610150900-abc1234"]) {
      expect(sweepDecision({ name, created_at: ago(1000) }, [], false, now)).toBeNull();
    }
    expect(sweepDecision({ ...preview("main"), default: true }, [], false, now)).toBeNull();
    expect(sweepDecision({ ...preview("keep"), protected: true }, [closed(1, 999)], false, now)).toBeNull();
  });
});
