export function needsBuild(files: string[]): boolean;
export function deploymentNeedsBuild(files: string[]): boolean;
export function ignoredBuildStep(
  previousSha: string | undefined,
  git: (args: string[]) => { status: number | null; stdout: string },
): { build: boolean; why: string };
export const CARRIED_PREVIEW_CONTEXT: string;
export function carriedPreview(
  commits: string[],
  previewsOf: (sha: string) => Promise<{ built: boolean; url: string | null }[]>,
  changedFiles: (base: string, head: string) => Promise<string[] | null>,
): Promise<{ carry: { sha: string; url: string } | null; why: string }>;
export function carriedPreviewStatus(
  head: string,
  carry: { sha: string; url: string },
): { state: "success"; context: string; target_url: string; description: string };
export function pendingMigrations(
  entries: { tag: string; when: number }[],
  appliedCreatedAt: (string | number)[],
): { pending: string[]; unknown: number[] };
export function directUrl(url: string): string;
export function refProblem(ref: string | undefined, dryRun: boolean): string | null;
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
