export const E2E_PORT: number;
export const E2E_PASSCODE: string;
export const E2E_USER: string;
export type E2ePlan =
  | { error: string; serverCommand?: undefined; serverEnv?: undefined; baseUrl?: undefined }
  | { error?: undefined; serverCommand: string; serverEnv: Record<string, string>; baseUrl: string };
export function planE2e(env: Record<string, string | undefined>): E2ePlan;
