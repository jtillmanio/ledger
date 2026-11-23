// The browser suite (task 0.11, D-72): Chromium against `next dev` (CI's shards:
// `next start`, E2E_SERVER) on the TEST database, at every target width (D-33),
// light and dark (E2E_SCOPE=full, what CI runs; a local run checks the core
// projects). Run it with `npm run test:e2e` (`npm run test:e2e:full` for
// every project), which refuses first when TEST_DATABASE_URL is unsafe;
// this file checks again, so a bare `npx playwright test` is no way round it.
import { readdirSync, readFileSync } from "node:fs";
import { defineConfig, type Project } from "@playwright/test";
import { loadDotEnv } from "./scripts/lib/testdb.mjs";
import { areaFilter, areaPlan, e2eProjects, planE2e } from "./scripts/lib/e2e.mjs";
import { filesByProject, filesMatcher, parseShard, planShards, shardUnits } from "./scripts/lib/e2e-shards.mjs";

loadDotEnv();
const plan = planE2e(process.env);
if (plan.error !== undefined) throw new Error(plan.error);

const STATE = "test/e2e/.auth/state.json";
const specFiles = readdirSync("test/e2e").filter((f) => f.endsWith(".spec.ts"));

// E2E_AREAS (roadmap 0.15): each project runs the chosen areas' spec files,
// and a core project the `@critical` tests of the rest too (areaFilter).
// Unset, `areas` is null and every project runs every spec file.
const areas = areaPlan(
  plan.areas === null ? [] : specFiles.map((file) => ({ file, text: readFileSync(`test/e2e/${file}`, "utf8") })),
  plan.areas,
);
const projectsOfScope = e2eProjects(plan.scope).map((p) => ({ ...p, area: areaFilter(p.name, areas) }));

// CI's shard n of N (E2E_SHARD, D-167): the spec files each project runs in
// this shard, from the recorded times in test/e2e/shard-times.json. Every
// (project, file) pair belongs to exactly one shard whatever its time, so a new
// spec runs. Unset (a local run), every project runs every spec file (of its areas).
const shard = parseShard(process.env.E2E_SHARD);
const times = shard && !("error" in shard) ? JSON.parse(readFileSync("test/e2e/shard-times.json", "utf8")) : null;
const mine = shard && !("error" in shard)
  ? filesByProject(
      planShards(
        projectsOfScope.flatMap((p) => shardUnits([p.name], p.area ? p.area.files : specFiles, times)),
        shard.total,
      ),
      shard.current,
    )
  : null;

// The projects, and which tests each runs: scripts/lib/e2e.mjs (E2E_SCOPE,
// the untagged, `@floor`, `@feel`, `@motion` and `@at-<project>` tags, D-161;
// E2E_AREAS and `@critical`, 0.15).
const projects: Project[] = [
  { name: "setup", testMatch: /auth\.setup\.ts/ },
  ...projectsOfScope.map(({ name, use, grep, area }) => ({
    name,
    testMatch: mine ? filesMatcher(mine.get(name) ?? []) : area ? filesMatcher(area.files) : /.*\.spec\.ts/,
    grep,
    ...(area?.grepInvert ? { grepInvert: area.grepInvert } : {}),
    dependencies: ["setup"],
    use: { storageState: STATE, ...use },
  })),
];

export default defineConfig({
  testDir: "test/e2e",
  // One database, and the seed is shared: one file at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./test/e2e/global-setup.ts",
  use: { baseURL: plan.baseUrl, trace: "retain-on-failure" },
  projects,
  webServer: {
    command: plan.serverCommand,
    url: `${plan.baseUrl}/api/health`,
    // Never someone else's server: it would be on whichever database it was started with.
    reuseExistingServer: false,
    timeout: 180_000,
    env: plan.serverEnv,
  },
});
