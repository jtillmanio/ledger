// .github/actions/start-postgres installs PostgreSQL from apt on every CI job
// and on the nightly backup. A mirror that stopped answering once held one e2e
// shard silent in that step until its 20-minute job timeout, while the other
// three took 16s (PR #218, 2026-11-10). Every network fetch now goes through
// `fetch`, which caps an attempt and retries; this runs that function in bash.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync(".github/actions/start-postgres/action.yml", "utf8");

/** The Install PostgreSQL step's `run: |` script, unindented. */
function installScript(): string {
  const step = action.slice(action.indexOf("- name: Install PostgreSQL"));
  const body = step.slice(step.indexOf("run: |") + "run: |".length).split("\n").slice(1);
  const end = body.findIndex((l) => l !== "" && !l.startsWith("        "));
  return body.slice(0, end === -1 ? undefined : end).map((l) => l.slice(8)).join("\n");
}

/**
 * Runs the step's `fetch` on `cmd`, with sudo and the pause between attempts
 * stubbed out. `timeout` is pinned to coreutils', the runner's: on Windows the
 * PATH Node hands bash finds system32's timeout.exe first.
 */
function runFetch(cmd: string, attemptSeconds = "1") {
  const fn = installScript().match(/^fetch\(\) \{\n[\s\S]*?\n\}$/m);
  if (!fn) throw new Error("the Install PostgreSQL step defines no fetch()");
  const script = [
    "set -eo pipefail",
    'sudo() { "$@"; }',
    "sleep() { :; }",
    'timeout() { /usr/bin/timeout "$@"; }',
    fn[0],
    cmd,
  ].join("\n");
  return spawnSync("bash", ["-c", script], {
    env: { ...process.env, ATTEMPT_SECONDS: attemptSeconds },
    encoding: "utf8",
    timeout: 30_000,
  });
}

describe("start-postgres fails fast on a stalled apt mirror", () => {
  it("kills an attempt that hangs, retries it, and gives up after three", () => {
    // The real sleep, not the stub: timeout runs the program, not the function.
    const run = runFetch("fetch sleep 30");
    expect(run.status).toBe(1);
    expect(run.stdout.match(/::warning::Attempt \d of 3/g)).toHaveLength(3);
    expect(run.stdout).toContain("::error::Gave up after 3 attempts");
  });

  it("returns as soon as an attempt succeeds", () => {
    // Fails the first time, succeeds the second: the count lives in a file,
    // since each attempt is a new process.
    const run = runFetch(
      `f=$(mktemp); echo 0 > "$f"; fetch bash -c 'c=$(cat "$0"); echo $((c+1)) > "$0"; [ "$c" -ge 1 ]' "$f"; echo "tries=$(cat "$f")"`,
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("tries=2");
    expect(run.stdout.match(/::warning::/g)).toHaveLength(1);
  });

  it("sends every download through fetch, and only the downloads", () => {
    const lines = installScript().split("\n").map((l) => l.trim());
    const network = lines.filter((l) => /apt-get update|--download-only|apt\.postgresql\.org\.sh/.test(l));
    expect(network.length).toBe(4);
    for (const l of network) expect(l).toMatch(/^fetch /);
    // The installs unpack what was already fetched: never killed mid-dpkg.
    const installs = lines.filter((l) => /apt-get install/.test(l) && !l.includes("--download-only"));
    expect(installs.length).toBe(2);
    for (const l of installs) expect(l).toMatch(/^sudo apt-get install /);
  });

  it("gives apt its own connection timeouts and retries, for the fetches the PGDG script makes", () => {
    const script = installScript();
    expect(script).toContain('Acquire::Retries "3";');
    expect(script).toContain('Acquire::http::Timeout "30";');
    expect(script).toContain('Acquire::https::Timeout "30";');
    expect(script).toMatch(/\/etc\/apt\/apt\.conf\.d\//);
  });
});
