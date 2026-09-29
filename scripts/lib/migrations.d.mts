export const GRANDFATHERED_NO_DOWN: Record<string, string>;
export function stripSqlComments(text: string): string;
export function destructiveStatements(text: string): { kind: string; statement: string }[];
export function checkMigrationFiles(input: {
  journalTags: string[];
  sql: Record<string, string>;
  downTags: string[];
}): string[];
export function checkAppendOnly(input: {
  nameStatus: string[];
  baseJournal: { tag: string; when: number }[];
  headJournal: { tag: string; when: number }[];
}): string[];
export function describeNewMigrations(input: {
  nameStatus: string[];
  sql: Record<string, string>;
  downTags: string[];
}): string[];
