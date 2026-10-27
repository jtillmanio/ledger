// What the browser suite (task 0.11, D-72) runs against: `next dev` on the TEST
// database, signed in with a passcode of its own. Decided here so the wrapper
// (scripts/e2e.mjs) and playwright.config.ts agree, and so it can be tested
// without a browser. Like every test, it reads TEST_DATABASE_URL and nothing
// else, and never falls back to DATABASE_URL (testdb.mjs).
import { checkTestUrl } from "./testdb.mjs";

// Below ui.portBase (3100 + a task number mod 100) so no ui-verifier server
// shares it, and not 3000, which is the owner's `npm run dev`.
export const E2E_PORT = 3199;
// Fixed and public: the suite's server, never the owner's APP_PASSCODE.
export const E2E_PASSCODE = "e2e-passcode";
export const E2E_USER = "e2e-user";
// `next dev`'s output and Turbopack cache, relative to where the server runs.
// A stale one makes the sign-in page reload in a Fast Refresh loop until the
// setup project times out (TASK-015; again on 2026-10-27), so a dev run starts
// without it. `next start` serves the `next build` output in .next and never
// reads this folder.
export const DEV_CACHE = ".next/dev";

// The projects a screen is checked in: the six `ui.viewports` in
// .claude/kit.json, light and dark (D-33), then the reduced-motion and touch
// checks (the feel pass, D-40).
const WIDTHS = [[360, 780], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800]];
export const E2E_PROJECTS = [
  ...WIDTHS.flatMap(([width, height]) =>
    ["light", "dark"].map((colorScheme) => ({ name: `w${width}-${colorScheme}`, use: { viewport: { width, height }, colorScheme } })),
  ),
  { name: "w390-reduced-motion", use: { viewport: { width: 390, height: 844 }, reducedMotion: "reduce" } },
  { name: "w390-touch", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
];

// The core scope: a phone in both themes, the tablet, the desktop, reduced
// motion and touch. What a local run (and /verify) checks; CI's full run is the gate.
export const E2E_CORE = ["w390-light", "w390-dark", "w768-light", "w1280-light", "w390-reduced-motion", "w390-touch"];

/**
 * The projects a scope runs, each with the grep that picks its tests. A test
 * with no `@at-` tag runs in every project of the scope; one tagged
 * `@at-<project>` runs only there, and nowhere when the scope leaves that
 * project out. Playwright filters on the title path plus every tag (a
 * describe's too) before it schedules anything, so a test filtered out never
 * opens a page or runs a hook.
 */
export function e2eProjects(scope) {
  return E2E_PROJECTS.filter((p) => scope === "full" || E2E_CORE.includes(p.name)).map((p) => ({
    ...p,
    grep: [/^(?!.*@at-)/, new RegExp(`@at-${p.name}(?![\\w-])`)],
  }));
}

/**
 * `{ error }` when TEST_DATABASE_URL is unset or names the same database as
 * DATABASE_URL (testdb.mjs's own message), else the environment the dev server
 * runs in, the command that starts it and where it listens. The Playwright
 * process itself keeps DATABASE_URL as it was: testdb.mjs needs both to tell
 * them apart.
 *
 * E2E_SERVER picks the server: `dev` (the default, what a local run uses) or
 * `start`, the production server over an existing `next build`, which CI's
 * shards use so no route is compiled on its first request.
 *
 * E2E_SCOPE picks the projects: `core` (the default, E2E_CORE) or `full`,
 * every project, which CI runs.
 *
 * clear is the folder the wrapper deletes before Playwright starts: DEV_CACHE
 * for a dev server, null for `next start`.
 */
export function planE2e(env) {
  const error = checkTestUrl(env.TEST_DATABASE_URL, env.DATABASE_URL);
  if (error) return { error };
  const mode = env.E2E_SERVER || "dev";
  if (mode !== "dev" && mode !== "start") return { error: `E2E_SERVER is "${mode}": use dev or start.` };
  const scope = env.E2E_SCOPE || "core";
  if (scope !== "core" && scope !== "full") return { error: `E2E_SCOPE is "${scope}": use core or full.` };
  return {
    scope,
    clear: mode === "dev" ? DEV_CACHE : null,
    serverCommand: `npx next ${mode} --port ${E2E_PORT}`,
    serverEnv: {
      DATABASE_URL: env.TEST_DATABASE_URL,
      APP_PASSCODE: E2E_PASSCODE,
      SESSION_SECRET: "e2e-only-secret",
      OWNER_ID: E2E_USER,
    },
    baseUrl: `http://localhost:${E2E_PORT}`,
  };
}
