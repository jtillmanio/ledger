export const GROWTH_LIMIT_MS: number;
export const SHARD_CEILING_MS: number;
export const GROWTH_LABEL: "e2e-growth";
export type Times = Record<string, number>;
export function timesFromReport(report: unknown): Times;
export function testOf(key: string): string;
export type Comparison = {
  runs: number;
  measured: number;
  projected: number;
  perShard: number;
  shards: number;
  baseline: { runs: number; total: number } | null;
  addedRuns: number;
  removedRuns: number;
  growth: number;
  costliest: { test: string; projects: number; ms: number }[];
};
export function compareTimes(current: Times, baseline: Times | null, shards: number): Comparison;
export const NO_AREA: "(no area)";
/** One shard of a plan, as planShards makes it: only its units' keys are read. */
export type PlannedShard = { ms: number; units: { key: string; project: string; file: string; ms: number }[] };
export function shardTimes(plan: PlannedShard[], current: Times, baseline: Times | null): number[];
export type AreaRow = {
  area: string;
  ran: "area" | "critical";
  measured: number;
  baseline: number | null;
  growth: number;
  addedRuns: number;
  removedRuns: number;
};
export type AreaComparison = Comparison & { areas: string[] | null; byArea: AreaRow[]; shardMs: number[] | null };
export function compareAreas(
  current: Times,
  baseline: Times | null,
  shards: number,
  opts: { areaOf: Record<string, string>; areas?: string[] | null; plan?: PlannedShard[] | null },
): AreaComparison;
export function budgetProblems(c: Comparison | AreaComparison): string[];
export function min(ms: number): string;
export function renderSummary(c: Comparison | AreaComparison, opts: { problems: string[]; accepted: boolean; baselineRun: string }): string;
