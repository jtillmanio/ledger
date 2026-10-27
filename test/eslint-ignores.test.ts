// `npm run lint` is `eslint .`, so anything a tool writes into the project
// tree is linted unless eslint.config.mjs ignores it.
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

describe("eslint.config.mjs ignores", () => {
  const eslint = new ESLint();

  it("skips the e2e suite's output (the trace viewer bundle after a failure)", async () => {
    expect(await eslint.isPathIgnored("playwright-report/trace/index.oNry3Hjv.js")).toBe(true);
    expect(await eslint.isPathIgnored("test-results/auth.setup.ts-sign-in/trace/sw.bundle.js")).toBe(true);
  });

  it("still lints the app, the scripts and the tests", async () => {
    expect(await eslint.isPathIgnored("src/components/Cover.tsx")).toBe(false);
    expect(await eslint.isPathIgnored("scripts/release.mjs")).toBe(false);
    expect(await eslint.isPathIgnored("test/e2e/auth.setup.ts")).toBe(false);
  });
});
