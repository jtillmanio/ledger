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

/**
 * `{ error }` when TEST_DATABASE_URL is unset or names the same database as
 * DATABASE_URL (testdb.mjs's own message), else the environment the dev server
 * runs in and where it listens. The Playwright process itself keeps
 * DATABASE_URL as it was: testdb.mjs needs both to tell them apart.
 */
export function planE2e(env) {
  const error = checkTestUrl(env.TEST_DATABASE_URL, env.DATABASE_URL);
  if (error) return { error };
  return {
    serverEnv: {
      DATABASE_URL: env.TEST_DATABASE_URL,
      APP_PASSCODE: E2E_PASSCODE,
      SESSION_SECRET: "e2e-only-secret",
      OWNER_ID: E2E_USER,
    },
    baseUrl: `http://localhost:${E2E_PORT}`,
  };
}
