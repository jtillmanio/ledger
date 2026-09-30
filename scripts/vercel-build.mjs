// Vercel's build command (vercel.json buildCommand). `npm run build` is still
// plain `next build` everywhere else.
//
// A preview deployment gets its own Neon branch from the Neon integration
// (preview/<git branch>, copied from live), and this brings that branch up to
// the PR's schema before building, so the preview runs the PR's code on the
// PR's schema and never touches the live ledger. Production only builds: its
// migration is a step of the Release workflow, started by hand (Step 13).
import { spawnSync } from "node:child_process";
import { buildSteps } from "./lib/preview.mjs";
import { directUrl } from "./lib/release.mjs";

let steps;
try {
  steps = buildSteps(process.env);
} catch (e) {
  console.error(`vercel-build: ${e.message}`);
  process.exit(1);
}
console.log(`vercel-build (${process.env.VERCEL_ENV ?? "no VERCEL_ENV"}): ${steps.join(" → ")}`);

// Migrations and views take the direct endpoint; the app keeps the pooled one.
// Only a preview gets here with a step that needs it.
const dbUrl = () => process.env.DATABASE_URL_UNPOOLED || directUrl(process.env.DATABASE_URL);
const commands = {
  migrate: ["node_modules/drizzle-kit/bin.cjs", "migrate"],
  views: ["scripts/sql.mjs", "live", "etl/views.sql"],
  "next build": ["node_modules/next/dist/bin/next", "build"],
};

for (const step of steps) {
  const env = step === "next build" ? process.env : { ...process.env, DATABASE_URL: dbUrl() };
  const r = spawnSync(process.execPath, commands[step], { stdio: "inherit", env });
  if (r.status !== 0) {
    console.error(`vercel-build: ${step} failed.` + (step === "migrate"
      ? " If this branch's migration was regenerated after its preview first ran, delete the Neon branch" +
        " preview/<this git branch> and redeploy: it is re-copied from live (START-HERE 10f)."
      : ""));
    process.exit(r.status ?? 1);
  }
}
