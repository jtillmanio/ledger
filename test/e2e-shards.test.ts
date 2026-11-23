// The browser suite's shard plan (D-167): spec files balanced across CI's
// shards by recorded time, in place of Playwright's `--shard` (equal test
// COUNTS, so minutes apart). Pure: no browser, no database. The real
// Playwright listing of every shard is checked by hand when the plan changes
// (the union of the shards' tests is exactly the unsharded list).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { E2E_CORE, e2eProjects, planE2e, plannedProjects, plannedUnits } from "../scripts/lib/e2e.mjs";
import {
  DEFAULT_UNIT_MS, averageTimes, filesByProject, filesMatcher, groupTimes, imbalance, parseShard, planShards, shardUnits, unitKey,
} from "../scripts/lib/e2e-shards.mjs";
import { ci, ciJob } from "./ci-yml";

const root = process.cwd();
const specs = readdirSync(join(root, "test", "e2e")).filter((f) => f.endsWith(".spec.ts"));
const committed = JSON.parse(readFileSync(join(root, "test", "e2e", "shard-times.json"), "utf8")) as Record<string, number>;
const projects = e2eProjects("full").map((p) => p.name);

describe("parseShard: E2E_SHARD is n/N", () => {
  it("reads n/N, and unset or empty is no shard", () => {
    expect(parseShard("3/10")).toEqual({ current: 3, total: 10 });
    expect(parseShard("1/1")).toEqual({ current: 1, total: 1 });
    expect(parseShard(undefined)).toBeNull();
    expect(parseShard("")).toBeNull();
  });

  it.each(["0/8", "9/8", "3", "a/b", "3/0", "-1/8", "1/8/2", " 1/8"])("refuses %j, naming the variable", (value) => {
    expect(parseShard(value)).toEqual({ error: expect.stringContaining("E2E_SHARD") });
  });

  it("planE2e refuses a bad one before a browser or a server starts", () => {
    const env = { TEST_DATABASE_URL: "postgresql://postgres@localhost:5433/ledger_test_9" };
    expect(planE2e({ ...env, E2E_SHARD: "9/8" }).error).toMatch(/E2E_SHARD/);
    expect(planE2e({ ...env, E2E_SHARD: "3/8" }).error).toBeUndefined();
    expect(planE2e(env).error).toBeUndefined();
  });
});

describe("shardUnits: every (project, file) pair, priced", () => {
  const times = { "w390-light|a.spec.ts": 5000, "w768-light|a.spec.ts": 3000 };

  it("a pair with a time costs it; a pair the file has no time in costs nothing; a file nobody has timed costs the default", () => {
    const units = shardUnits(["w390-light", "w768-light", "w1280-light"], ["a.spec.ts", "new.spec.ts"], times);
    const cost = (p: string, f: string) => units.find((u) => u.key === unitKey(p, f))!.ms;
    expect(units).toHaveLength(6);
    expect(cost("w390-light", "a.spec.ts")).toBe(5000);
    expect(cost("w768-light", "a.spec.ts")).toBe(3000);
    expect(cost("w1280-light", "a.spec.ts")).toBe(0);
    for (const p of ["w390-light", "w768-light", "w1280-light"]) expect(cost(p, "new.spec.ts")).toBe(DEFAULT_UNIT_MS);
  });
});

describe("planShards: longest first onto the lightest shard", () => {
  const unit = (key: string, ms: number) => ({ key, project: "p", file: key, ms });

  it("balances: 7 5 4 3 3 2 over two shards is 12 and 12", () => {
    const plan = planShards([7, 5, 4, 3, 3, 2].map((ms, i) => unit(`u${i}`, ms)), 2);
    expect(plan.map((s) => s.ms)).toEqual([12, 12]);
  });

  it("assigns every unit once, whatever it costs, the free ones too", () => {
    const units = [unit("a", 10), unit("b", 0), unit("c", 0), unit("d", 4), unit("e", 4)];
    const plan = planShards(units, 3);
    expect(plan.flatMap((s) => s.units.map((u) => u.key)).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("is the same plan from the same units, in any input order", () => {
    const units = Array.from({ length: 40 }, (_, i) => unit(`u${String(i).padStart(2, "0")}`, (i * 7919) % 13));
    const names = (p: ReturnType<typeof planShards>) => p.map((s) => s.units.map((u) => u.key));
    expect(names(planShards([...units].reverse(), 5))).toEqual(names(planShards(units, 5)));
  });

  it("filesByProject lists one shard's files per project, in name order", () => {
    const plan = planShards([
      { key: "p|b.spec.ts", project: "p", file: "b.spec.ts", ms: 5 }, { key: "p|a.spec.ts", project: "p", file: "a.spec.ts", ms: 1 },
      { key: "q|a.spec.ts", project: "q", file: "a.spec.ts", ms: 9 },
    ], 2);
    expect(filesByProject(plan, 1)).toEqual(new Map([["q", ["a.spec.ts"]]]));
    expect(filesByProject(plan, 2)).toEqual(new Map([["p", ["a.spec.ts", "b.spec.ts"]]]));
  });
});

describe("filesMatcher: a project's testMatch for the files a shard holds", () => {
  it("matches exactly those spec files by their last path segment, not a longer name", () => {
    const m = filesMatcher(["queue.spec.ts", "book-detail.spec.ts"]);
    expect(m.test("C:\\repo\\test\\e2e\\queue.spec.ts")).toBe(true);
    expect(m.test("/repo/test/e2e/book-detail.spec.ts")).toBe(true);
    expect(m.test("/repo/test/e2e/my-queue.spec.ts")).toBe(false);
    expect(m.test("/repo/test/e2e/queue.spec.tsx")).toBe(false);
    expect(m.test("/repo/test/e2e/other.spec.ts")).toBe(false);
  });

  it("escapes a dot: queueXspecXts is not queue.spec.ts", () => {
    expect(filesMatcher(["queue.spec.ts"]).test("/e2e/queueXspecXts")).toBe(false);
  });

  it("matches nothing for no files", () => {
    expect(filesMatcher([]).test("/repo/test/e2e/queue.spec.ts")).toBe(false);
    expect(filesMatcher([]).test("")).toBe(false);
  });
});

describe("the committed plan (test/e2e/shard-times.json)", () => {
  it("names only spec files that exist and projects the suite has", () => {
    for (const key of Object.keys(committed)) {
      const [project, file] = key.split("|");
      expect(projects, key).toContain(project);
      expect(specs, key).toContain(file);
    }
  });

  // The plan is a pure function of the committed times, the project list and the spec files on disk,
  // so these hold for every shard count CI may use, with a spec added since the times were recorded.
  it.each([8, 10])("splits into %i shards that together hold every (project, file) pair exactly once", (total) => {
    const units = shardUnits(projects, [...specs, "added-since.spec.ts"], committed);
    const plan = planShards(units, total);
    const placed = plan.flatMap((s) => s.units.map((u) => u.key));
    expect(placed).toHaveLength(units.length);
    expect(new Set(placed)).toEqual(new Set(units.map((u) => u.key)));
    // And a shard's files, by project, are exactly those units.
    const viaFiles = Array.from({ length: total }, (_, i) => [...filesByProject(plan, i + 1)]
      .flatMap(([project, files]) => files.map((f) => unitKey(project, f)))).flat();
    expect(viaFiles.sort()).toEqual(placed.slice().sort());
  });

  it.each([8, 10])("is balanced at %i shards: the slowest is within 3%% of the mean, priced with its own times", (total) => {
    const plan = planShards(shardUnits(projects, specs, committed), total);
    expect(imbalance(plan, committed).ratio).toBeLessThan(1.03);
  });

  it("imbalance prices a plan with another run's times", () => {
    const plan = planShards(shardUnits(["p"], ["a", "b"], { "p|a": 3, "p|b": 1 }), 2);
    const { sums, mean, slowest, ratio } = imbalance(plan, { "p|a": 3, "p|b": 1 });
    expect(sums.sort()).toEqual([1, 3]);
    expect(mean).toBe(2);
    expect(slowest).toBe(3);
    expect(ratio).toBe(1.5);
  });
});

describe("groupTimes: one time per spec file per project from a recorded run", () => {
  const tests = {
    "a.spec.ts › one [w390-light]": 1200, "a.spec.ts › d › two [w390-light]": 800,
    "a.spec.ts › one [w768-light]": 1000, "b.spec.ts › x [w390-light]": 449,
  };

  it("sums a file's tests in a project, rounded to 100 ms, in key order", () => {
    expect(groupTimes(tests)).toEqual({ "w390-light|a.spec.ts": 2000, "w390-light|b.spec.ts": 400, "w768-light|a.spec.ts": 1000 });
    expect(Object.keys(groupTimes(tests))).toEqual(["w390-light|a.spec.ts", "w390-light|b.spec.ts", "w768-light|a.spec.ts"]);
  });

  it("counts only the tests the suite still schedules when given them", () => {
    const keep = new Set(["a.spec.ts › one [w390-light]", "b.spec.ts › x [w390-light]"]);
    expect(groupTimes(tests, keep)).toEqual({ "w390-light|a.spec.ts": 1200, "w390-light|b.spec.ts": 400 });
  });
});

describe("averageTimes: the plan comes from the mean of several runs", () => {
  it("averages a unit over the runs that have it, rounded to 100 ms, in key order", () => {
    const runs: Record<string, number>[] = [
      { "p|a.spec.ts": 3000, "p|b.spec.ts": 1000 },
      { "p|a.spec.ts": 5000, "q|a.spec.ts": 700 },
      { "p|a.spec.ts": 4100 },
    ];
    expect(averageTimes(runs)).toEqual({ "p|a.spec.ts": 4000, "p|b.spec.ts": 1000, "q|a.spec.ts": 700 });
    expect(Object.keys(averageTimes(runs))).toEqual(["p|a.spec.ts", "p|b.spec.ts", "q|a.spec.ts"]);
  });

  it("one run is that run, and none is nothing", () => {
    expect(averageTimes([{ "p|a": 1234 }])).toEqual({ "p|a": 1200 });
    expect(averageTimes([])).toEqual({});
  });
});

describe("ci.yml gives each shard its own place in the plan", () => {
  const e2e = ciJob("e2e");

  it("the shard takes E2E_SHARD, not Playwright's --shard, and names its blob so merged reports don't collide", () => {
    expect(e2e).toContain("E2E_SHARD: ${{ matrix.shard }}/${{ strategy.job-total }}");
    expect(e2e).toContain("PLAYWRIGHT_BLOB_OUTPUT_NAME: report-${{ matrix.shard }}.zip");
    expect(e2e).not.toContain("--shard=");
    expect(e2e).toContain("npm run test:e2e -- --reporter=list,blob");
  });

  it("the budget job reports how balanced the plan was, and never fails on it", () => {
    const job = ciJob("e2e-budget");
    expect(job).toContain("node scripts/e2e-shards.mjs balance e2e-times.json");
    expect(job).toContain("SHARDS: ");
    expect(ci).not.toMatch(/e2e-shards\.mjs balance[^\n]*\n[^\n]*exit 1/);
  });

  it("the balance prices the plan the run made: its scope and its areas (0.15)", () => {
    const job = ciJob("e2e-budget");
    const step = job.slice(job.indexOf("name: Shard balance"));
    expect(step).toContain("E2E_SCOPE: ${{ needs.scope.outputs.e2e_scope }}");
    expect(step).toContain("E2E_AREAS: ${{ needs.scope.outputs.areas }}");
  });
});

// An area run (0.15) shards only its areas' files and the critical set; the
// balance has to price that plan, or every area run reads as lopsided.
describe("plannedUnits: the config and the balance plan the same units", () => {
  const specs = readdirSync("test/e2e")
    .filter((f) => f.endsWith(".spec.ts"))
    .map((file) => ({ file, text: readFileSync(`test/e2e/${file}`, "utf8") }));
  const files = specs.map((s) => s.file);
  const comics = specs.filter((s) => s.text.includes("// @area: comics")).map((s) => s.file);
  const critical = specs.filter((s) => s.text.includes('"@critical"')).map((s) => s.file);

  it("an area run's units are its areas' files everywhere and the critical set's at the core projects only", () => {
    const units = plannedUnits(plannedProjects("full", ["comics"], specs), files, {});
    expect(comics.length).toBeGreaterThan(0);
    for (const u of units) {
      if (comics.includes(u.file)) continue;
      expect(critical, u.key).toContain(u.file);
      expect(E2E_CORE, u.key).toContain(u.project);
    }
    expect(new Set(units.map((u) => u.file))).toEqual(new Set([...comics, ...critical]));
  });

  it("every area is every file in every project, as before 0.15", () => {
    const units = plannedUnits(plannedProjects("full", null, []), files, {});
    expect(units.length).toBe(e2eProjects("full").length * files.length);
  });

  it("e2e-shards.mjs balance counts the files the run's areas planned", () => {
    const dir = mkdtempSync(join(tmpdir(), "e2e-balance-"));
    try {
      const timesFile = join(dir, "e2e-times.json");
      writeFileSync(timesFile, JSON.stringify({ tests: {} }));
      const run = (areas: string) => {
        const env: NodeJS.ProcessEnv = { ...process.env, E2E_SCOPE: "full", E2E_AREAS: areas };
        delete env.GITHUB_STEP_SUMMARY;
        return spawnSync(process.execPath, ["scripts/e2e-shards.mjs", "balance", timesFile, "--shards", "10"], { encoding: "utf8", env });
      };
      const area = run("comics");
      expect(area.status, area.stderr).toBe(0);
      expect(area.stdout).toContain(`The plan splits ${new Set([...comics, ...critical]).size} spec files (comics and the critical set) over 10 shards`);
      const every = run("");
      expect(every.status, every.stderr).toBe(0);
      expect(every.stdout).toContain(`The plan splits ${files.length} spec files over 10 shards`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
