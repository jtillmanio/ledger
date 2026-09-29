export function needsBuild(files: string[]): boolean;
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
export function snapshotsToPrune<T extends { name: string; created_at: string }>(branches: T[], keep: number): T[];
