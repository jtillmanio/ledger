// Reads .github/workflows/ci.yml for the tests that pin its shape: one job's
// text at a time, and the `check` job's verdict script, so it can be run.
import { readFileSync } from "node:fs";

export const ci = readFileSync(".github/workflows/ci.yml", "utf8");

/** The names of the workflow's jobs, in order. */
export const ciJobs = (): string[] => {
  const jobs = ci.slice(ci.indexOf("\njobs:\n"));
  return [...jobs.matchAll(/^ {2}([\w-]+):$/gm)].map((m) => m[1]);
};

/** One job's text, from its name to the next job's. */
export function ciJob(name: string): string {
  const jobs = ci.slice(ci.indexOf("\njobs:\n"));
  const start = jobs.indexOf(`\n  ${name}:\n`);
  if (start === -1) throw new Error(`ci.yml has no job ${name}`);
  const next = jobs.slice(start + 1).search(/\n {2}[\w-]+:\n/);
  return next === -1 ? jobs.slice(start) : jobs.slice(start, start + 1 + next);
}

/** The `check` job's `run: |` script, unindented. */
export function checkScript(): string {
  const job = ciJob("check");
  const lines = job.slice(job.indexOf("run: |") + "run: |".length).split("\n").slice(1);
  return lines.filter((l) => l.startsWith("          ") || l === "").map((l) => l.slice(10)).join("\n");
}
