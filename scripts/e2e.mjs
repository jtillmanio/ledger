// Run the browser suite (task 0.11): Playwright and axe against `next dev` on
// the TEST database.
//   npm run test:e2e [-- <playwright test arguments>]       the core projects
//   npm run test:e2e:full [-- <playwright test arguments>]  every project (--full)
//   npm run test:e2e:build [-- <playwright test arguments>] build, then serve it with next start (--build, D-97)
// Refuses before a browser, a build or a server starts unless TEST_DATABASE_URL
// is safe (scripts/lib/testdb.mjs); playwright.config.ts checks again, so a bare
// `npx playwright test` is no way round it. Stop `npm run dev` first: both run
// from this folder's .next, and a dev run deletes .next/dev before it starts
// (DEV_CACHE in scripts/lib/e2e.mjs).
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./lib/testdb.mjs";
import { planE2e } from "./lib/e2e.mjs";

// --full and --build are the wrapper's own: --full sets E2E_SCOPE, --build
// builds first and serves that build (E2E_SERVER=start), so the suite never
// runs against a stale one. Playwright sees neither flag.
const own = ["--full", "--build"];
const args = process.argv.slice(2);
if (args.includes("--full")) process.env.E2E_SCOPE = "full";
const build = args.includes("--build");
if (build) process.env.E2E_SERVER = "start";

loadDotEnv();
const plan = planE2e(process.env);
if (plan.error) {
  console.error(`e2e: ${plan.error}`);
  process.exit(1);
}
if (build) {
  // The build gets the server's environment, as CI's gets a DATABASE_URL that
  // names no real database: nothing built can carry the development database.
  // NEXT_CLI stands in for the real one in test/e2e-guard.test.ts.
  const next = process.env.NEXT_CLI ?? fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
  const b = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", env: { ...process.env, ...plan.serverEnv } });
  if (b.status !== 0) {
    console.error("e2e: next build failed; the browser suite did not run.");
    process.exit(b.status ?? 1);
  }
}
if (plan.clear) {
  rmSync(plan.clear, { recursive: true, force: true });
  console.log(`e2e: cleared ${plan.clear}, so next dev starts from a cold cache`);
}

// PLAYWRIGHT_CLI stands in for the real one in test/e2e-guard.test.ts.
const cli = process.env.PLAYWRIGHT_CLI ?? fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const r = spawnSync(process.execPath, [cli, "test", ...args.filter((a) => !own.includes(a))], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
