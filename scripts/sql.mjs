// Run a .sql file against the live or the test database, with no psql needed.
//   node scripts/sql.mjs live etl/views.sql        (npm run db:views)
//   node scripts/sql.mjs test etl/test_views.sql   (npm run test:views)
// Works the same in PowerShell, cmd and bash, which `psql "%DATABASE_URL%"` did not.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { loadDotEnv, requireTestUrl } from "./lib/testdb.mjs";

const [target, file] = process.argv.slice(2);
if (!["live", "test"].includes(target) || !file) {
  console.error("usage: node scripts/sql.mjs <live|test> <file.sql>");
  process.exit(2);
}

loadDotEnv();
const url = target === "test" ? requireTestUrl() : process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(2);
}

// psql meta-commands (\echo, \set ...) are not SQL; drop those lines.
const text = readFileSync(file, "utf8").split(/\r?\n/).filter((l) => !l.startsWith(String.fromCharCode(92))).join("\n");

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.unsafe(text).simple();
  console.log(`${file}: ok (${target})`);
} catch (e) {
  console.error(`${file}: FAILED (${target})\n${e.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
