import type { E2eArea } from "./e2e.mjs";

export function isDocsOnly(files: string[]): boolean;
export function needsBrowserAndBuild(files: string[]): boolean;
export const FULL_E2E_LABEL: string;
type EventPayload = { pull_request?: { draft?: boolean; labels?: { name: string }[] } } | null | undefined;
export function e2eScope(eventName: string | undefined, payload: EventPayload): "core" | "full";

export type CiJob = { name: string; conclusion: string | null };
export type CiRun = { id: number; head_sha: string };
export function coveredAreas(jobs: CiJob[]): "every" | string[] | null;
export function ranEveryProject(jobs: CiJob[]): boolean;
export function greenFullRunToReuse<R extends CiRun>(
  runs: R[],
  world: {
    jobsOf: (id: number) => CiJob[];
    isAncestor: (sha: string) => boolean;
    changedSince: (sha: string) => string[] | null;
  },
  needed?: string[] | null,
): { run: R; files: string[] } | null;

export const MEDIUM_COMPONENTS: Partial<Record<E2eArea, string[]>>;
export type AreaChoice = { area: E2eArea | null; path: string | null; rule: string };
export type Areas = { areas: E2eArea[] | null; why: AreaChoice[] };
export type SpecFile = { file: string; text: string };
export function routeArea(path: string): { area: E2eArea; rule: string } | null;
export function prAreas(files: string[], specs: SpecFile[]): Areas;
export function areasForRun(eventName: string | undefined, payload: EventPayload, files: string[] | null, specs: SpecFile[]): Areas;
export function e2eLabel(scope: string, areas: readonly string[] | null): string;
export function describeAreas(areas: Areas): string[];
