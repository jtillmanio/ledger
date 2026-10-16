type Env = Record<string, string | undefined>;
export function endpointId(urlOrHost: string | undefined): string | null;
export function previewDbProblem(env: Env): string | null;
export function buildSteps(env: Env): ("migrate" | "views" | "next build")[];
export function previewBranchToDelete<T extends { name: string; default?: boolean; protected?: boolean }>(
  branches: T[],
  gitBranch: string | undefined,
): T | null;
