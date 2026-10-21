// Checks the migration folder before anything applies it. No database needed.
//   npm run check:migrations                 (base defaults to origin/main)
//   node scripts/check-migrations.mjs --base <ref>
//
// 1. Every drizzle/*.sql is in the journal and the other way round; a migration
//    that drops or retypes a column has drizzle/down/<tag>.sql (CLAUDE.md).
// 2. src/db/schema.ts has no change that `npm run db:generate` has not turned
//    into a migration: drizzle-kit generate, run against a copy of drizzle/,
//    must find nothing to write.
// 3. Migrations already on the base branch are not edited, renamed or deleted
//    (standing rule 3, docs/06-tasklist.md). Skipped, with a note, when the base is unknown.
//
// Prints the migrations the branch adds, and writes them to the GitHub job
// summary so a PR says whether merging it means a schema change to release.
import { spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { checkAppendOnly, checkMigrationFiles, describeNewMigrations } from "./lib/migrations.mjs";

const argBase = process.argv.indexOf("--base");
const base = argBase > 0 ? process.argv[argBase + 1] : process.env.MIGRATIONS_BASE || "origin/main";

const problems = [];
const notes = [];

// 1. the folder
const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries;
const sql = Object.fromEntries(
  readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .map((f) => [f.slice(0, -4), readFileSync(`drizzle/${f}`, "utf8")]),
);
const downTags = existsSync("drizzle/down")
  ? readdirSync("drizzle/down").filter((f) => f.endsWith(".sql")).map((f) => f.slice(0, -4))
  : [];
problems.push(...checkMigrationFiles({ journalTags: journal.map((e) => e.tag), sql, downTags }));

// 2. schema.ts vs the migrations. drizzle-kit resolves --out against the working
// directory, so the copy lives in a gitignored folder inside the repo. It exits
// 0 even on errors, so success is read from what it printed and wrote.
const scratch = "node_modules/.cache/migration-drift";
rmSync(scratch, { recursive: true, force: true });
cpSync("drizzle", `${scratch}/drizzle`, { recursive: true });
const gen = spawnSync(
  process.execPath,
  ["node_modules/drizzle-kit/bin.cjs", "generate", "--dialect", "postgresql",
    "--schema", "./src/db/schema.ts", "--out", `./${scratch}/drizzle`],
  { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
);
const written = readdirSync(`${scratch}/drizzle`).filter((f) => f.endsWith(".sql") && !(f.slice(0, -4) in sql));
if (written.length) {
  problems.push(
    `src/db/schema.ts has changes no migration covers. Run \`npm run db:generate\` and commit the result ` +
      `(drizzle-kit would write ${written.join(", ")}).`,
  );
} else if (gen.error?.code === "ETIMEDOUT" || /created or renamed/.test(gen.stdout)) {
  const question = gen.stdout.match(/Is .*created or renamed.*\?/)?.[0];
  problems.push(
    "src/db/schema.ts has changes no migration covers, and drizzle-kit needs an answer to write one " +
      `(${question ?? "renamed or new?"}). Run \`npm run db:generate\` and answer it.`,
  );
} else if (!/No schema changes/.test(gen.stdout)) {
  problems.push(`drizzle-kit generate did not confirm the schema matches the migrations:\n${gen.stdout}${gen.stderr}`);
}
rmSync(scratch, { recursive: true, force: true });

// 3. append-only against the base
const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
const mergeBase = git("merge-base", base, "HEAD");
let nameStatus = [];
if (mergeBase.status !== 0) {
  notes.push(`base ${base} not found; append-only check skipped (CI fetches it).`);
} else {
  const mb = mergeBase.stdout.trim();
  // Against the working tree, not HEAD, so an uncommitted edit fails locally too.
  nameStatus = git("diff", "--name-status", "-M", mb, "--", "drizzle").stdout.split("\n").filter(Boolean);
  const baseJournalText = git("show", `${mb}:drizzle/meta/_journal.json`);
  const baseJournal = baseJournalText.status === 0 ? JSON.parse(baseJournalText.stdout).entries : [];
  problems.push(...checkAppendOnly({ nameStatus, baseJournal, headJournal: journal }));
}

const added = describeNewMigrations({ nameStatus, sql, downTags });
const summary = added.length
  ? ["Migrations this branch adds (the live database gets them only at START-HERE Step 13):", ...added.map((a) => `- ${a}`)]
  : ["This branch adds no migrations."];

for (const n of notes) console.log(`note: ${n}`);
console.log(summary.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Migrations\n\n${summary.join("\n")}\n\n`);
}

if (problems.length) {
  console.error(`\ncheck:migrations found ${problems.length} problem(s):`);
  for (const p of problems) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`check:migrations: ok (${journal.length} migrations)`);
