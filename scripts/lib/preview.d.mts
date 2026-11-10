type Env = Record<string, string | undefined>;
export function endpointId(urlOrHost: string | undefined): string | null;
export function previewDbProblem(env: Env): string | null;
export function buildSteps(env: Env): ("migrate" | "views" | "next build")[];
export function previewBranchToDelete<T extends { name: string; default?: boolean; protected?: boolean }>(
  branches: T[],
  gitBranch: string | undefined,
): T | null;
export const SWEEP_GRACE_MS: number;
export function sweepDecision(
  branch: { name: string; default?: boolean; protected?: boolean; created_at: string },
  prs: { number: number; state: string; closed_at: string | null }[],
  gitBranchExists: boolean,
  now: number,
  graceMs?: number,
): { delete: boolean; why: string } | null;
