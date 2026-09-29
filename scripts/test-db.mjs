// Rebuild the TEST database from zero: drop everything, apply drizzle/*.sql in
// order through drizzle-kit migrate (the same path a rebuild uses, R3-11), then
// etl/views.sql. Only ever touches TEST_DATABASE_URL.
//   npm run test:db:reset
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { loadDotEnv, requireTestUrl } from "./lib/testdb.mjs";

loadDotEnv();
const url = requireTestUrl();

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await sql.unsafe("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;").simple();
} finally {
  await sql.end();
}

const run = (args) => {
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(["node_modules/drizzle-kit/bin.cjs", "migrate"]);
run(["scripts/sql.mjs", "live", "etl/views.sql"]); // "live" = DATABASE_URL, which is the test URL here
console.log("test database rebuilt");
