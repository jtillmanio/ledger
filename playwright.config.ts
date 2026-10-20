// The browser suite (task 0.11, D-72): Chromium against `next dev` on the TEST
// database, at every target width (D-33), light and dark. Run it with
// `npm run test:e2e`, which refuses first when TEST_DATABASE_URL is unsafe;
// this file checks again, so a bare `npx playwright test` is no way round it.
import { defineConfig, type Project } from "@playwright/test";
import { loadDotEnv } from "./scripts/lib/testdb.mjs";
import { E2E_PORT, planE2e } from "./scripts/lib/e2e.mjs";

loadDotEnv();
const plan = planE2e(process.env);
if (plan.error !== undefined) throw new Error(plan.error);

const STATE = "test/e2e/.auth/state.json";

// The six `ui.viewports` in .claude/kit.json that a screen is checked at.
const WIDTHS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];

const signedIn = { storageState: STATE };
const projects: Project[] = [
  { name: "setup", testMatch: /auth\.setup\.ts/ },
  ...WIDTHS.flatMap(({ width, height }) =>
    (["light", "dark"] as const).map((colorScheme) => ({
      name: `w${width}-${colorScheme}`,
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: { ...signedIn, viewport: { width, height }, colorScheme },
    })),
  ),
  // The reduced-motion and hover-at-rest checks (the feel pass, D-40).
  {
    name: "w390-reduced-motion",
    testMatch: /.*\.spec\.ts/,
    dependencies: ["setup"],
    use: { ...signedIn, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" },
  },
  {
    name: "w390-touch",
    testMatch: /.*\.spec\.ts/,
    dependencies: ["setup"],
    use: { ...signedIn, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  },
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
    command: `npx next dev --port ${E2E_PORT}`,
    url: `${plan.baseUrl}/api/health`,
    // Never someone else's server: it would be on whichever database it was started with.
    reuseExistingServer: false,
    timeout: 180_000,
    env: plan.serverEnv,
  },
});
