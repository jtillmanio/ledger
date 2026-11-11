export const GUARD_TEST: RegExp;
export const TASK_FILE: RegExp;
export function changedPaths(diffOut: string, statusOut: string): string[];
export function guardTests(changed: string[], tests: { path: string; text: string }[]): string[];
