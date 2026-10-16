import { describe, expect, it } from "vitest";
import { buildSteps, endpointId, previewBranchToDelete, previewDbProblem } from "../scripts/lib/preview.mjs";

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
