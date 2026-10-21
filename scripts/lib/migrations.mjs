// What a migration is allowed to look like, as pure functions over file contents
// so they can be tested without git or a database. scripts/check-migrations.mjs
// feeds them the repo; test/migrations-check.test.ts feeds them fixtures.

/**
 * Migrations that drop or retype a column without a drizzle/down file, written
 * before CLAUDE.md required one. Both ran only against disposable databases.
 * Nothing is ever added to this list.
 */
export const GRANDFATHERED_NO_DOWN = {
  "0002_blocks_and_derived_run_span": "predates the down-file rule (R3-09); disposable database",
  "0003_issue_metadata": "predates the down-file rule (R3-09); disposable database",
};

/** SQL with `--` line comments and block comments removed. */
export function stripSqlComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

const DESTRUCTIVE = [
  { kind: "drops a column", re: /\bDROP\s+COLUMN\b/i },
  { kind: "drops a table", re: /\bDROP\s+TABLE\b/i },
  { kind: "retypes a column", re: /\bALTER\s+COLUMN\s+("[^"]+"|\S+)\s+(SET\s+DATA\s+)?TYPE\b/i },
];

/** Each statement that drops or retypes a column (or drops a table), with why. */
export function destructiveStatements(text) {
  const found = [];
  for (const raw of stripSqlComments(text).split(";")) {
    const stmt = raw.replace(/\s+/g, " ").trim();
    const hit = DESTRUCTIVE.find((d) => d.re.test(stmt));
    if (hit) found.push({ kind: hit.kind, statement: stmt });
  }
  return found;
}

/**
 * Problems with the migration folder as it stands.
 *   journalTags: tags in drizzle/meta/_journal.json, in order
 *   sql:         { tag: file text } for drizzle/<tag>.sql
 *   downTags:    tags that have drizzle/down/<tag>.sql
 */
export function checkMigrationFiles({ journalTags, sql, downTags }) {
  const problems = [];
  const sqlTags = Object.keys(sql);
  for (const tag of sqlTags) {
    if (!journalTags.includes(tag)) {
      problems.push(`drizzle/${tag}.sql is not in drizzle/meta/_journal.json, so drizzle-kit migrate never runs it.`);
    }
  }
  for (const tag of journalTags) {
    if (!sqlTags.includes(tag)) problems.push(`_journal.json lists ${tag} but drizzle/${tag}.sql does not exist.`);
  }
  for (const tag of downTags) {
    if (!sqlTags.includes(tag)) problems.push(`drizzle/down/${tag}.sql has no drizzle/${tag}.sql to reverse.`);
  }
  for (const tag of sqlTags) {
    if (downTags.includes(tag) || tag in GRANDFATHERED_NO_DOWN) continue;
    const hits = destructiveStatements(sql[tag]);
    if (hits.length) {
      problems.push(
        `drizzle/${tag}.sql ${hits[0].kind} but there is no drizzle/down/${tag}.sql ` +
          `(CLAUDE.md: migrations that drop or retype a column ship a down file):\n    ${hits[0].statement}`,
      );
    }
  }
  return problems;
}

/**
 * Problems with how a branch changed migrations that already exist on its base
 * (standing rule 3, docs/06-tasklist.md: never edit a migration that has been applied).
 *   nameStatus:  `git diff --name-status <base> HEAD -- drizzle` output lines
 *   baseJournal: the base's journal entries; headJournal: this branch's
 */
export function checkAppendOnly({ nameStatus, baseJournal, headJournal }) {
  const problems = [];
  for (const line of nameStatus) {
    const [status, path, renamedTo] = line.split("\t");
    if (!/^drizzle\/[^/]+\.sql$/.test(path ?? "")) continue;
    if (status === "A") continue;
    const what = status.startsWith("R") ? `renamed to ${renamedTo}` : status === "D" ? "deleted" : "edited";
    problems.push(`${path} already exists on the base branch and was ${what}. Add a new migration instead.`);
  }
  baseJournal.forEach((b, i) => {
    const h = headJournal[i];
    if (!h || h.tag !== b.tag || h.when !== b.when) {
      problems.push(
        `_journal.json entry ${i} (${b.tag}) was changed or removed. Entries already on the base branch are append-only.`,
      );
    }
  });
  return problems;
}

/** One line per migration a branch adds: its tag and whether it is additive. */
export function describeNewMigrations({ nameStatus, sql, downTags }) {
  return nameStatus
    .map((l) => l.split("\t"))
    .filter(([status, path]) => status === "A" && /^drizzle\/[^/]+\.sql$/.test(path))
    .map(([, path]) => {
      const tag = path.slice("drizzle/".length, -".sql".length);
      const hits = destructiveStatements(sql[tag] ?? "");
      if (!hits.length) return `${tag}: additive`;
      return `${tag}: destructive (${[...new Set(hits.map((h) => h.kind))].join(", ")})` +
        (downTags.includes(tag) ? ", down file present" : ", NO down file");
    });
}
