// Run the browser suite (task 0.11): Playwright and axe against `next dev` on
// the TEST database.
//   npm run test:e2e [-- <playwright test arguments>]      the core projects
//   npm run test:e2e:full [-- <playwright test arguments>] every project (--full)
// Refuses before a browser or a server starts unless TEST_DATABASE_URL is safe
// (scripts/lib/testdb.mjs); playwright.config.ts checks again, so a bare
// `npx playwright test` is no way round it. Stop `npm run dev` first: both run
// from this folder's .next, and a dev run deletes .next/dev before it starts
// (DEV_CACHE in scripts/lib/e2e.mjs).
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./lib/testdb.mjs";
import { planE2e } from "./lib/e2e.mjs";

// --full is the wrapper's own: it sets E2E_SCOPE and Playwright never sees it.
const args = process.argv.slice(2);
if (args.includes("--full")) process.env.E2E_SCOPE = "full";

loadDotEnv();
const plan = planE2e(process.env);
if (plan.error) {
  console.error(`e2e: ${plan.error}`);
  process.exit(1);
}
if (plan.clear) {
  rmSync(plan.clear, { recursive: true, force: true });
  console.log(`e2e: cleared ${plan.clear}, so next dev starts from a cold cache`);
}

// PLAYWRIGHT_CLI stands in for the real one in test/e2e-guard.test.ts.
const cli = process.env.PLAYWRIGHT_CLI ?? fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
const r = spawnSync(process.execPath, [cli, "test", ...args.filter((a) => a !== "--full")], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
