// Task 4.4, part 2 of 3 (TASK-082, D-133): scripts/calibre-sync-schedule.ps1
// registers one weekly Task Scheduler run of the Calibre sync, and a second
// registration replaces it. Against test/fixtures/fake-schtasks.ps1, never the
// real scheduler; under pwsh (CI's Linux runner) or Windows PowerShell.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const works = (cmd: string) => {
  const r = spawnSync(cmd, ["-NoProfile", "-Command", "exit 0"], { encoding: "utf8" });
  return !r.error && r.status === 0;
};
const ps = ["pwsh", "powershell.exe"].find(works);
const SCRIPT = resolve("scripts/calibre-sync-schedule.ps1");
const FAKE = resolve("test/fixtures/fake-schtasks.ps1");
// A cold pwsh on the CI runner has taken over 5s on its own.
const SPAWN_TIMEOUT = 30_000;

let dir = "";
let state = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ledger-schtasks-"));
  state = join(dir, "tasks.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function schedule(...args: string[]) {
  const r = spawnSync(ps!, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-Schtasks", FAKE, ...args], {
    encoding: "utf8", env: { ...process.env, FAKE_SCHTASKS_STATE: state },
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

type Task = { schedule: string; day: string; time: string; run: string };
const tasks = (): Record<string, Task> => (existsSync(state) ? JSON.parse(readFileSync(state, "utf8").replace(/^﻿/, "")) : {});

describe.skipIf(!ps)("scripts/calibre-sync-schedule.ps1", () => {
  it("registers one weekly task that runs the sync, and a second registration replaces it", () => {
    const first = schedule();
    expect(first.status, first.out).toBe(0);
    expect(Object.keys(tasks())).toEqual(["Ledger Calibre sync"]);
    const second = schedule("-Day", "WED", "-Time", "20:30");
    expect(second.status, second.out).toBe(0);
    const all = tasks();
    expect(Object.keys(all)).toEqual(["Ledger Calibre sync"]);
    const task = all["Ledger Calibre sync"];
    expect([task.schedule, task.day, task.time]).toEqual(["WEEKLY", "WED", "20:30"]);
    // It runs this script's -Run, which runs `npm run calibre:sync` and nothing else.
    expect(task.run).toMatch(/^powershell\.exe -NoProfile -ExecutionPolicy Bypass -File (\\")?.*calibre-sync-schedule\.ps1(\\")? -Run$/);
  }, SPAWN_TIMEOUT);

  it("-Run runs npm run calibre:sync in the repo (shown with -WhatIf)", () => {
    const r = spawnSync(ps!, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", SCRIPT, "-Run", "-WhatIf"], { encoding: "utf8" });
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout.replace(/\s+/g, " ")).toMatch(/What if: Performing the operation "npm run calibre:sync" on target ".+"/);
  }, SPAWN_TIMEOUT);

  it("-WhatIf registers nothing", () => {
    const r = schedule("-WhatIf");
    expect(r.status, r.out).toBe(0);
    expect(r.out).toMatch(/What if/);
    expect(existsSync(state)).toBe(false);
  }, SPAWN_TIMEOUT);
});
