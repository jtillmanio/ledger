export function isDocsOnly(files: string[]): boolean;
export function needsBrowserAndBuild(files: string[]): boolean;
export const FULL_E2E_LABEL: string;
export function e2eScope(
  eventName: string | undefined,
  payload: { pull_request?: { draft?: boolean; labels?: { name: string }[] } } | null | undefined,
): "core" | "full";

export type CiJob = { name: string; conclusion: string | null };
export type CiRun = { id: number; head_sha: string };
export function ranEveryProject(jobs: CiJob[]): boolean;
export function greenFullRunToReuse<R extends CiRun>(
  runs: R[],
  world: {
    jobsOf: (id: number) => CiJob[];
    isAncestor: (sha: string) => boolean;
    changedSince: (sha: string) => string[] | null;
  },
): { run: R; files: string[] } | null;
