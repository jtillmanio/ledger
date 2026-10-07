export const NETWORK: { download: number; upload: number; latency: number };
export const CPU_SLOWDOWN: number;
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
  apiRequests: string[];
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
  tap: { first: number | null; median: number | null; rscBytes: number | null };
  apiRequests: string[];
}
export type RouteBudget = Partial<Record<"docRscBytes" | "jsBytes" | "requests" | "a11y", number | null>>;

export function isPreviewToolbar(url: string): boolean;
export function apiPath(url: string): string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function summariseLhr(lhr: any): LoadSummary;
export function median(values: (number | null | undefined)[]): number | null;
export function aggregateRoute(measured: MeasuredRoute): RouteResult;
export function gateProblems(routes: Record<string, RouteResult>, budget: Record<string, RouteBudget>): string[];
export function unbudgeted(routes: Record<string, RouteResult>, budget: Record<string, RouteBudget>): string[];
export function fmt(v: number | null | undefined, unit: "bytes" | "ms" | "count"): string;
export function renderComment(args: {
  current: { url: string; sha?: string; lighthouse?: string; runs?: number; routes: Record<string, RouteResult> };
  baseline: {
    pr: number;
    at: string;
    routes: Record<string, { median?: Record<string, number | null>; tap?: { median?: number | null } }>;
  } | null;
  budget: Record<string, RouteBudget>;
  problems: string[];
  missingBudget?: string[];
}): string;
export function findComment<T extends { body?: string }>(comments: T[]): T | undefined;
export function measurable(args: {
  eventName: string;
  environment?: string;
  state?: string;
  deploymentUrl?: string;
  inputUrl?: string;
  productionUrl?: string;
  allowProduction?: boolean;
}): { url: string } | { skip: string } | { problem: string };
export function sessionCookie(setCookies: string[]): string | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scrubLhr(lhr: any, secrets: (string | undefined)[]): any;
export function filesWithSecrets(files: { name: string; text: string }[], secrets: (string | undefined)[]): string[];
export function baselinePr<T extends { number: number; merged_at: string | null }>(pulls: T[], currentPrs?: number[]): T | null;
export function baselineRun<T extends { status: string; conclusion: string | null; created_at: string }>(runs: T[]): T | null;
