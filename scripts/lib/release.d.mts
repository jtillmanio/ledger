export function needsBuild(files: string[]): boolean;
export function deploymentNeedsBuild(files: string[]): boolean;
export function pendingMigrations(
  entries: { tag: string; when: number }[],
  appliedCreatedAt: (string | number)[],
): { pending: string[]; unknown: number[] };
export function directUrl(url: string): string;
export function releaseProblems(input: {
  live: boolean;
  target: { sha: string; url: string } | null;
  ci: { status: string; conclusion: string | null } | null;
  unreleasedFiles: string[];
  pending: string[];
  unknown: number[];
}): string[];
export function promoteProblem(deployment: { url: string; target?: string | null; readyState?: string }): string | null;
export function alreadyProduction(status: number, body: { error?: { code?: string; message?: string } } | null): boolean;
export function smokeProblem(input: {
  status: number;
  body: { ok?: boolean; failed?: string; commit?: string | null } | null;
  sha: string;
  finalUrl?: string;
  bypass?: boolean;
}): string | null;
export function snapshotsToPrune<T extends { name: string; created_at: string }>(branches: T[], keep: number): T[];
