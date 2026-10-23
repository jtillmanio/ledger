// The browser suite (task 0.11, D-72): Chromium against `next dev` (CI's shards:
// `next start`, E2E_SERVER) on the TEST database, at every target width (D-33),
// light and dark (E2E_SCOPE=full, what CI runs; a local run checks the core
// projects). Run it with `npm run test:e2e` (`npm run test:e2e:full` for
// every project), which refuses first when TEST_DATABASE_URL is unsafe;
// this file checks again, so a bare `npx playwright test` is no way round it.
import { defineConfig, type Project } from "@playwright/test";
import { loadDotEnv } from "./scripts/lib/testdb.mjs";
import { e2eProjects, planE2e } from "./scripts/lib/e2e.mjs";

loadDotEnv();
const plan = planE2e(process.env);
if (plan.error !== undefined) throw new Error(plan.error);

const STATE = "test/e2e/.auth/state.json";

// The projects, and which tests each runs: scripts/lib/e2e.mjs (E2E_SCOPE,
// the `@at-<project>` tags).
const projects: Project[] = [
  { name: "setup", testMatch: /auth\.setup\.ts/ },
  ...e2eProjects(plan.scope).map(({ name, use, grep }) => ({
    name,
    testMatch: /.*\.spec\.ts/,
    grep,
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
