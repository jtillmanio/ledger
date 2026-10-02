import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

// .env holds the development database and .env.live the production one
// (START-HERE Step 13). Neither may ever be committed; only the template is.
function ignored(path: string): boolean {
  const r = spawnSync("git", ["check-ignore", "-q", "--no-index", path]);
  if (r.status !== 0 && r.status !== 1) throw new Error(`git check-ignore failed: ${r.stderr}`);
  return r.status === 0;
}

describe(".gitignore and env files", () => {
  it("ignores every env file that can hold a connection string", () => {
    for (const f of [".env", ".env.live", ".env.local", ".env.production", ".env.development.local"]) {
      expect(ignored(f), f).toBe(true);
    }
  });

  it("tracks the template", () => {
    expect(ignored(".env.example")).toBe(false);
  });
});
