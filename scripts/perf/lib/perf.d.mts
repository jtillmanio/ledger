export const NETWORK: { download: number; upload: number; latency: number };
export const CPU_SLOWDOWN: number;
export function measureRuns(env: { RUNS?: string }): number;
export const RSC_BLOCK: string;
export function lighthouseArgs(args: { url: string; headerFile: string; outputPath: string; chromeFlags: string[] }): string[];
export const CLS_LIMIT: number;
export const MARKER: string;
export const BUDGETED: { key: "docRscBytes" | "jsBytes" | "requests"; label: string; unit: "bytes" | "count" }[];
export const TIMINGS: { key: "ttfb" | "responseMs" | "fcp" | "lcp" | "tbt"; label: string }[];

export interface LoadSummary {
  landedOn: string | null;
  ttfb: number | null;
  responseMs: number | null;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  a11y: number | null;
  docRscBytes: number;
  jsBytes: number;
  requests: number;
  /** Requests to another origin: reported, never budgeted (task 0.13). Absent before 0.13. */
  otherOriginRequests?: number;
  /** The page's own scripts by path → bytes, the shared JS's input (task 0.13). Absent before 0.13. */
  scripts?: Record<string, number>;
  apiRequests: string[];
  rscSent: number;
}
export interface MeasuredRoute {
  path: string;
  loads: (LoadSummary | { error: string })[];
  taps: ({ ms: number; rscBytes?: number | null } | { error: string })[];
  tapApiRequests?: string[];
}
export interface RouteResult {
  path: string;
  runs: number;
  errors: string[];
  landedOn: (string | null)[];
  first: LoadSummary | null;
  median: Record<string, number | null>;
  scripts: Record<string, number | null>;
  tap: { first: number | null; median: number | null; rscBytes: number | null };
  apiRequests: string[];
  rscSent: number;
}
export type RouteBudget = Partial<Record<"docRscBytes" | "jsBytes" | "requests" | "a11y", number | null>>;

export function isPreviewToolbar(url: string): boolean;
export function apiPath(url: string): string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summariseLhr(lhr: any): LoadSummary;
export function median(values: (number | null | undefined)[]): number | null;
export function aggregateRoute(measured: MeasuredRoute): RouteResult;
export type SharedBudget = { jsBytes?: number | null };
export function sharedScripts(routes: Record<string, RouteResult>): string[];
export function sharedJs(route: RouteResult, shared: string[]): number;
export function ownJs(route: RouteResult, shared: string[]): number | null;
export function gateProblems(
  routes: Record<string, RouteResult>, budget: Record<string, RouteBudget>, expected?: string[],
  sharedBudget?: SharedBudget | null): string[];
export function unbudgeted(routes: Record<string, RouteResult>, budget: Record<string, RouteBudget>): string[];
export const GROWTH_LABEL: string;
export const GROWTH: { jsBytes: number; docRscBytes: { bytes: number; share: number }; requests: number };
export interface Baseline {
  pr: number | string;
  at: string;
  routes: Record<string, { runs?: number; median?: Record<string, number | null>; tap?: { median?: number | null } }>;
}
export function growthUnchecked(routes: Record<string, RouteResult>, baseline: Baseline | null): string[];
export function growthProblems(routes: Record<string, RouteResult>, baseline: Baseline | null): string[];
export function judge(args: { gate: string[]; growth: string[]; labels: (string | { name?: string })[] | null | undefined }):
  { problems: string[]; accepted: string[] };
export function ceilingsFrom(routes: Record<string, RouteResult>): {
  shared: { jsBytes: number };
  routes: Record<string, { docRscBytes: number; jsBytes: number; requests: number; a11y: number | null }>;
  lines: string[];
};
export function fmt(v: number | null | undefined, unit: "bytes" | "ms" | "count"): string;
export function renderComment(args: {
  current: { url: string; sha?: string; lighthouse?: string; runs?: number; routes: Record<string, RouteResult> };
  baseline: Baseline | null;
  budget: Record<string, RouteBudget>;
  problems: string[];
  missingBudget?: string[];
  shared?: SharedBudget | null;
  growth?: { accepted: string[] } | null;
}): string;
export interface Metrics {
  url: string;
  sha: string | null;
  lighthouse: string;
  chrome?: string;
  measuredAt: string;
  runs?: number;
  routes: Record<string, MeasuredRoute>;
}
export function mergeMetrics(parts: Metrics[], order: string[]): Metrics;
export function findComment<T extends { body?: string }>(comments: T[]): T | undefined;
export function unchangedApp(files: string[] | null): string | null;
export function measurable(args: {
  eventName: string;
  environment?: string;
  state?: string;
  deploymentUrl?: string;
  inputUrl?: string;
  productionUrl?: string;
  allowProduction?: boolean;
}): { url: string } | { skip: string } | { problem: string };
export const DEBOUNCE_SECONDS: number;
export const DEFAULT_MONTHLY_CAP: number;
export function gates(args: { realEventName: string | undefined; dryRun?: boolean }): { wait: boolean; decide: boolean; act: boolean };
export function notHead(args: { number: number; sha: string; head: string | null | undefined }): string | null;
export function monthlyCap(value: string | null | undefined): number;
export function monthStart(now: Date): string;
export function automaticCandidates<T extends { id: number | string; event: string; created_at: string }>(
  runs: T[],
  args: { since: string; exclude?: number | string },
): T[];
export function measureRan(jobs: { name: string; status?: string; conclusion: string | null; steps?: unknown[] }[]): boolean;
export function capReached(args: { count: number; cap: number; since: string }): string | null;
export function renderCapComment(args: { sha: string; count: number; cap: number; since: string; branch?: string }): string;
export const COUNT_CONCURRENCY: number;
export function countMeasured<T extends { created_at: string }>(
  runs: T[],
  args: {
    cap: number;
    jobsFor: (run: T) => Promise<{ name: string; status?: string; conclusion: string | null; steps?: unknown[] }[]>;
    concurrency?: number;
  },
): Promise<number>;
export function capMarkerName(args: { since: string; cap: number }): string;
export function capMarked(artifacts: { name: string; expired?: boolean }[] | null | undefined, name: string): boolean;
export function sessionCookie(setCookies: string[]): string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubLhr(lhr: any, secrets: (string | undefined)[]): any;
export function filesWithSecrets(files: { name: string; text: string }[], secrets: (string | undefined)[]): string[];
type Job = { id?: number; name: string; conclusion: string | null };
export function baselineRun<T extends { status: string; conclusion: string | null; created_at: string; jobs?: Job[] }>(
  runs: T[]): T | null;
export function findBaseline<
  P extends { number: number; merged_at: string | null; head: { ref: string; sha: string } },
  R extends { status: string; conclusion: string | null; created_at: string },
>(args: {
  pulls: P[];
  currentPrs?: number[];
  runsFor: (pr: P) => Promise<R[]>;
  jobsFor: (run: R) => Promise<Job[]>;
  now?: Date;
}): Promise<{ pr: P; run: R & { jobs: Job[] } } | null>;
export const BASELINE_DAYS: number;
export function rejudgeTarget(runs: { id: number; status: string; created_at: string; jobs?: Job[] }[]):
  { run: number; job: number } | null;
export function listPages(dir: string): string[];
export function pagePattern(file: string): string;
export function unmeasuredPages(args: { pages: string[]; routes: string[]; exempt: Record<string, string> }): string[];
export function resolvedPath(
  route: { id: string; path: string; resolve?: { from: string; selector: string } },
  hrefs: (string | null | undefined)[],
): { path: string } | { error: string };
export function samePage(from: string, url: string): boolean;
