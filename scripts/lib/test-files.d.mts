export const DEFAULT_E2E_PROJECT: string;
export function normalize(file: string): string;
export function splitArgs(argv: string[]): { files: string[]; e2eArgs: string[] };
export function e2eArgsProblem(e2eArgs: string[]): string | null;
export function planTestRun(files: string[], e2eArgs?: string[]): { commands: string[]; unknown: string[] };
