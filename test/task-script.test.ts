import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// scripts/task.sh and scripts/task.ps1 print one task from TASKS.md. Phases 5
// and 6 write tasks as list items (`- ☐ 5.7 …`), which the scripts used to miss.
// Run against a fixture, never the live TASKS.md, so edits to the backlog can't
// break the test.
const FIXTURE = `# Tasks

## Phase 1 — Daily use

### ☐ 1.1 Heading task · M
Heading body.

**Check:** heading check.

### ☑ 1.2 Next heading · S
Second body.

## Phase 5 — Remaining surfaces

- ☐ 5.1 First item · M. Starts here
  and continues.
- ☐ 5.7 **List task** · M. Intro line.
  - nested bullet
  - another bullet

  Paragraph after a blank line.
- ☐ 5.8 Short item · S

---

## Phase 6 — Polish
`;

const dir = mkdtempSync(join(tmpdir(), "ledger-tasks-"));
const file = join(dir, "TASKS.md");
writeFileSync(file, FIXTURE, "utf8");

function works(cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return !r.error && r.status === 0;
}

const ps = ["pwsh", "powershell.exe"].find((c) => works(c, ["-NoProfile", "-Command", "exit 0"]));

type Run = (id: string) => { status: number | null; out: string };
const runners: [string, Run | null][] = [
  // On Windows, a bare `bash` may be the WSL launcher, which cannot read a Windows
  // temp path; CI's Linux runner covers the bash twin.
  [
    "task.sh",
    process.platform === "win32"
      ? null
      : (id) => {
          const r = spawnSync("bash", ["scripts/task.sh", id, file], { encoding: "utf8" });
          return { status: r.status, out: r.stdout };
        },
  ],
  [
    "task.ps1",
    ps
      ? (id) => {
          const r = spawnSync(
            ps,
            ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/task.ps1", id, file],
            { encoding: "utf8" },
          );
          return { status: r.status, out: r.stdout };
        }
      : null,
  ],
];

// Each test starts a fresh shell; a cold pwsh on the CI runner has taken over
// 5s on its own, past vitest's default timeout.
const SPAWN_TIMEOUT = 30_000;

const lines = (out: string) => out.replace(/\r/g, "").trimEnd().split("\n");

describe.each(runners)("%s", (_name, run) => {
  it.skipIf(!run)("prints a heading task up to the next heading", () => {
    const { status, out } = run!("1.1");
    expect(status).toBe(0);
    expect(out).toContain("1.1 Heading task");
    expect(out).toContain("**Check:** heading check.");
    expect(out).not.toContain("1.2");
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("prints a list-item task with its indented lines and inner blank line", () => {
    const { status, out } = run!("5.7");
    expect(status).toBe(0);
    const got = lines(out);
    // Line one holds ☐ and ·, which Windows PowerShell 5.1 re-encodes on a
    // captured stdout; check its ASCII part, and the rest exactly.
    expect(got[0]).toContain("5.7 **List task**");
    expect(got.slice(1)).toEqual([
      "  - nested bullet",
      "  - another bullet",
      "",
      "  Paragraph after a blank line.",
    ]);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("stops a list item at the next item, a rule or a heading", () => {
    expect(lines(run!("5.1").out)).toHaveLength(2);
    expect(lines(run!("5.8").out)).toHaveLength(1);
  }, SPAWN_TIMEOUT);

  it.skipIf(!run)("fails on an id that is not there", () => {
    expect(run!("9.9").status).not.toBe(0);
  }, SPAWN_TIMEOUT);
});
