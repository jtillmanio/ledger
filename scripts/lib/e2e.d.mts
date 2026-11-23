import type { ShardUnit } from "./e2e-shards.mjs";

export const E2E_PORT: number;
export function e2ePort(env: Record<string, string | undefined>): { port: number; error?: undefined } | { error: string; port?: undefined };
export const E2E_PASSCODE: string;
export const E2E_USER: string;
export const E2E_HARDCOVER_TOKEN: string;
export const DEV_CACHE: string;
export type E2eScope = "core" | "full";
export type E2eProject = {
  name: string;
  use: {
    viewport: { width: number; height: number };
    colorScheme?: "light" | "dark";
    reducedMotion?: "reduce";
    hasTouch?: boolean;
    isMobile?: boolean;
  };
};
export const E2E_PROJECTS: E2eProject[];
export const E2E_CORE: string[];
export const E2E_BEHAVIOUR: string[];
export const FLOOR_TAG: "@floor";
export const E2E_FLOOR: string[];
export const FEEL_TAG: "@feel";
export const E2E_FEEL: string[];
export const MOTION_TAG: "@motion";
export const MOTION_PROJECT: "w390-reduced-motion";
export const TOUCH_TAG: "@touch";
export const TOUCH_PROJECT: "w390-touch";
export type E2eArea = "books" | "comics" | "watch" | "music" | "games" | "shared";
export const AREAS: E2eArea[];
export function specArea(text: string): { area: E2eArea; error?: undefined } | { error: string; area?: undefined };
export type SpecText = { file: string; text: string };
export function areaProblems(specs: SpecText[]): string[];
export const CRITICAL_TAG: "@critical";
export function hasCritical(text: string): boolean;
export function parseAreas(value: string | undefined): { areas: E2eArea[] | null; error?: undefined } | { error: string; areas?: undefined };
export type AreaPlan = { selected: string[]; critical: string[] };
export function areaPlan(specs: SpecText[], areas: E2eArea[] | null): AreaPlan | null;
export function areaFilter(project: string, plan: AreaPlan | null): { files: string[]; grepInvert?: RegExp } | null;
export function e2eProjects(scope: E2eScope): (E2eProject & { grep: RegExp[] })[];
export type PlannedProject = E2eProject & { grep: RegExp[]; area: { files: string[]; grepInvert?: RegExp } | null };
export function plannedProjects(scope: E2eScope, areas: E2eArea[] | null, specs: SpecText[]): PlannedProject[];
export function plannedUnits(projects: PlannedProject[], specFiles: string[], times: Record<string, number>): ShardUnit[];
export type E2ePlan =
  | { error: string; scope?: undefined; areas?: undefined; clear?: undefined; serverCommand?: undefined; serverEnv?: undefined; baseUrl?: undefined }
  | { error?: undefined; scope: E2eScope; areas: E2eArea[] | null; clear: string | null; serverCommand: string; serverEnv: Record<string, string>; baseUrl: string };
export function planE2e(env: Record<string, string | undefined>): E2ePlan;
