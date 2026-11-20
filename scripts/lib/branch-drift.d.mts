export function isDependency(file: string): boolean;
export function isFoundation(file: string): boolean;
export function isMigration(file: string): boolean;
export function driftVerdict(state: {
  behind: number;
  conflicts: string[];
  mine: string[];
  theirs: string[];
  addedMine: string[];
  addedTheirs: string[];
}): { update: boolean; reasons: string[] };
