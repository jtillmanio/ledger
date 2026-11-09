import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { WORKTREE_ENV } from "../scripts/lib/testdb.mjs";
import { E2E_PORT, e2ePort, planE2e } from "../scripts/lib/e2e.mjs";
import { claimSlot, envValue, renderClaim, slotFor } from "../scripts/lib/worktree-slot.mjs";

// Two sessions at once (workflow.wipLimit 2) each need a test database and a
// browser-suite port of their own: the tests truncate, and the suite's server
// refuses to share a port. Nothing here touches a database.

const MAIN = 'TEST_DATABASE_URL="postgresql://postgres@localhost:5433/ledger_test"\n';
const LIVE = "postgresql://l:l@live-host.example/reading";

describe("claimSlot: a worktree's own test database and port", () => {
  it("claims ledger_test_2 and port 3200 when nobody else has", () => {
    const claim = claimSlot({ mainEnv: MAIN, otherClaims: [], existing: ["ledger_test", "ledger_test_2"] });
    expect(claim.error).toBeUndefined();
    expect(claim.slot).toMatchObject({ n: 2, db: "ledger_test_2", port: 3200 });
    expect(envValue(claim.text, "TEST_DATABASE_URL")).toBe("postgresql://postgres@localhost:5433/ledger_test_2");
    expect(envValue(claim.text, "E2E_PORT")).toBe("3200");
  });

  it("skips a slot another worktree claimed, and takes the next that exists", () => {
    const other = renderClaim(slotFor("postgresql://postgres@localhost:5433/ledger_test", 2));
    const claim = claimSlot({ mainEnv: MAIN, otherClaims: [other, ""], existing: ["ledger_test", "ledger_test_2", "ledger_test_3"] });
    expect(claim.slot).toMatchObject({ db: "ledger_test_3", port: 3201 });
  });

  it("never hands out the main checkout's database or port", () => {
    const claim = claimSlot({ mainEnv: MAIN, otherClaims: [], existing: ["ledger_test", "ledger_test_2"] });
    expect(claim.slot?.db).not.toBe("ledger_test");
    expect(claim.slot?.port).not.toBe(E2E_PORT);
  });

  it("refuses, naming the database to create, when every slot that exists is taken", () => {
    const other = renderClaim(slotFor("postgresql://postgres@localhost:5433/ledger_test", 2));
    const claim = claimSlot({ mainEnv: MAIN, otherClaims: [other], existing: ["ledger_test", "ledger_test_2"] });
    expect(claim.slot).toBeUndefined();
    expect(claim.error).toMatch(/no free test database/);
    expect(claim.error).toContain("createdb -h localhost -p 5433 -U postgres ledger_test_3");
  });

  it("refuses when the main checkout has no TEST_DATABASE_URL, rather than guessing one", () => {
    expect(claimSlot({ mainEnv: "DATABASE_URL=x\n", otherClaims: [], existing: [] }).error).toMatch(/no TEST_DATABASE_URL/);
  });

  it("keeps the credentials and query string of the main checkout's URL", () => {
    const s = slotFor("postgresql://u:p%40ss@db.example:6543/reading_test?sslmode=require", 3);
    expect(s.url).toBe("postgresql://u:p%40ss@db.example:6543/reading_test_3?sslmode=require");
    expect(s.port).toBe(3201);
  });

  it("gives every slot a port past the ui-verifier range (3100 + a task number mod 100)", () => {
    for (let n = 2; n <= 9; n++) expect(slotFor("postgresql://h/x", n).port).toBeGreaterThanOrEqual(3200);
  });
});

describe("loadDotEnv: .env.worktree wins over .env", () => {
  it("takes TEST_DATABASE_URL and E2E_PORT from .env.worktree, the rest from .env", () => {
    const dir = mkdtempSync(join(tmpdir(), "ledger-slot-"));
    try {
      writeFileSync(join(dir, ".env"), `${MAIN}DATABASE_URL="${LIVE}"\n`);
      writeFileSync(join(dir, WORKTREE_ENV), renderClaim(slotFor("postgresql://postgres@localhost:5433/ledger_test", 2)));
      const lib = pathToFileURL(resolve(__dirname, "..", "scripts", "lib", "testdb.mjs")).href;
      const code = `const { loadDotEnv } = await import(${JSON.stringify(lib)}); loadDotEnv();
        console.log(JSON.stringify({ t: process.env.TEST_DATABASE_URL, p: process.env.E2E_PORT, d: process.env.DATABASE_URL }));`;
      const env = { ...process.env };
      delete env.TEST_DATABASE_URL;
      delete env.E2E_PORT;
      delete env.DATABASE_URL;
      const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: dir, env, encoding: "utf8" });
      expect(r.stderr).toBe("");
      expect(JSON.parse(r.stdout)).toEqual({ t: "postgresql://postgres@localhost:5433/ledger_test_2", p: "3200", d: LIVE });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("e2ePort: the browser suite listens where E2E_PORT says", () => {
  const env = { TEST_DATABASE_URL: "postgresql://t:t@test-host.example/reading_test", DATABASE_URL: LIVE };

  it("defaults to 3199 and takes E2E_PORT when set", () => {
    expect(e2ePort({})).toEqual({ port: 3199 });
    expect(planE2e({ ...env, E2E_PORT: "3200" })).toMatchObject({
      serverCommand: "npx next dev --port 3200",
      baseUrl: "http://localhost:3200",
    });
  });

  it("refuses an E2E_PORT that is not a usable port, before anything starts", () => {
    for (const bad of ["abc", "80", "70000", "3200.5"]) {
      const plan = planE2e({ ...env, E2E_PORT: bad });
      expect(plan.serverCommand).toBeUndefined();
      expect(plan.error).toMatch(/E2E_PORT is ".*": use a whole number from 1024 to 65535/);
    }
  });
});
