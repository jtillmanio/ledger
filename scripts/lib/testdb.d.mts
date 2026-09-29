export function dbIdentity(url: string): string | null;
export function checkTestUrl(testUrl: string | undefined, liveUrl: string | undefined): string | null;
export function requireTestUrl(env?: Record<string, string | undefined>): string;
export function loadDotEnv(file?: string): void;
