// Whether a branch that is behind main needs updating before it merges, as a
// pure function. scripts/branch-drift.mjs feeds it the real git state;
// test/branch-drift.test.ts feeds it fixtures.
//
// The protect-main ruleset requires CI's `check` but not an up-to-date branch,
// so a PR can merge while behind main. That is safe when nothing main gained
// since the branch point touches what the PR touches; this decides when it does.
import { isDocsOnly } from "./ci-scope.mjs";

/**
 * What the code runs on: the npm manifest and lockfile, and the Node version
 * (.nvmrc, which CI and Vercel both read). A bump on main (Dependabot's,
 * usually) means a branch's green CI ran on the old versions.
 */
const DEPENDENCIES = [/^package(-lock)?\.json$/, /^\.nvmrc$/];

export function isDependency(file) {
  return DEPENDENCIES.some((re) => re.test(file));
}

/**
 * Paths most of the app leans on, where a change on main can break a branch
 * that never touched them: the schema, migrations and views, the design
 * tokens, the passcode gate, the build and test configuration, and the shared
 * test helpers and fixtures (not the tests themselves, which only test their
 * own area). Dependencies are reported on their own.
 */
const FOUNDATIONS = [
  /^src\/db\//,
  /^drizzle\//,
  /^etl\/views\.sql$/,
  /^src\/app\/globals\.css$/,
  /^src\/proxy\.ts$/,
  /^(next|playwright|vitest|drizzle)\.config\.ts$/,
  /^tsconfig\.json$/,
  /^test\/fixtures\//,
  /^test\/(e2e\/)?[^/]+\.ts$/,
];

export function isFoundation(file) {
  return FOUNDATIONS.some((re) => re.test(file)) && !/\.(test|spec)\.tsx?$/.test(file);
}

/** A migration (not its down script or drizzle/meta). */
export function isMigration(file) {
  return /^drizzle\/[^/]+\.sql$/.test(file);
}

const MAX_LISTED = 5;
function list(files) {
  const shown = files.slice(0, MAX_LISTED).join(", ");
  return files.length > MAX_LISTED ? `${shown} and ${files.length - MAX_LISTED} more` : shown;
}

/**
 * The verdict for a branch against main.
 *   behind       commits on main since the branch point
 *   conflicts    paths that conflict when the two are merged
 *   mine         paths the branch changed since the branch point
 *   theirs       paths main changed since the branch point
 *   addedMine    paths the branch added (migrations are found among these)
 *   addedTheirs  paths main added
 * Returns { update, reasons }: update is true when at least one reason holds.
 * Docs on both sides are not a reason: no test reads them together, and git
 * already reports the lines that clash.
 */
export function driftVerdict({ behind, conflicts, mine, theirs, addedMine, addedTheirs }) {
  if (behind === 0) return { update: false, reasons: [] };
  const reasons = [];
  if (conflicts.length) {
    reasons.push(`conflicts with main in ${list(conflicts)}: GitHub won't merge it until it is resolved`);
  }
  const myMigrations = addedMine.filter(isMigration);
  const theirMigrations = addedTheirs.filter(isMigration);
  if (myMigrations.length && theirMigrations.length) {
    reasons.push(
      `both add a migration (here ${list(myMigrations)}; main ${list(theirMigrations)}): rebase, check the order in drizzle/meta/_journal.json, and run npm run db:generate again if the snapshot is off`,
    );
  }
  const theirSet = new Set(theirs);
  const overlap = mine.filter((f) => theirSet.has(f) && !conflicts.includes(f) && !isDocsOnly([f]));
  if (overlap.length) {
    reasons.push(`both changed ${list(overlap)}: git merges them cleanly, but CI has never run them together`);
  }
  if (!isDocsOnly(mine)) {
    const seen = (f) => overlap.includes(f) || conflicts.includes(f);
    const deps = theirs.filter((f) => isDependency(f) && !seen(f));
    if (deps.length) {
      reasons.push(`main changed dependencies (${list(deps)}): this branch's CI ran on the old versions`);
    }
    const shared = theirs.filter((f) => isFoundation(f) && !seen(f));
    if (shared.length) {
      reasons.push(`main changed shared code this branch builds on: ${list(shared)}`);
    }
  }
  return { update: reasons.length > 0, reasons };
}
