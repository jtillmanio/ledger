export const E2E_PORT: number;
export const E2E_PASSCODE: string;
export const E2E_USER: string;
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
export function e2eProjects(scope: E2eScope): (E2eProject & { grep: RegExp[] })[];
export type E2ePlan =
  | { error: string; scope?: undefined; clear?: undefined; serverCommand?: undefined; serverEnv?: undefined; baseUrl?: undefined }
  | { error?: undefined; scope: E2eScope; clear: string | null; serverCommand: string; serverEnv: Record<string, string>; baseUrl: string };
export function planE2e(env: Record<string, string | undefined>): E2ePlan;
