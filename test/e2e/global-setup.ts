// Runs once before the browser projects: empties the TEST database and seeds
// the one user and one run the specs load. testSql() is on TEST_DATABASE_URL
// only and refuses otherwise (R3-02); this never imports src/db.
import { loadDotEnv } from "../../scripts/lib/testdb.mjs";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { markRead, testSql, truncateAll } from "../db";
import { E2E_ISSUE_COUNT, E2E_READ_COUNT, E2E_RUN_ID, E2E_RUN_TITLE } from "./helpers";

export default async function globalSetup() {
  loadDotEnv();
  const sql = testSql();
  try {
    await truncateAll(sql);
    await sql`INSERT INTO users (id, name) VALUES (${E2E_USER}, 'E2E')`;
    await sql`INSERT INTO runs (id, title) VALUES (${E2E_RUN_ID}, ${E2E_RUN_TITLE})`;
    await sql`INSERT INTO issues (id, label)
              SELECT 'e2e-comic-' || n, 'E2E Comic (2000) #' || n FROM generate_series(1, ${E2E_ISSUE_COUNT}::int) n`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id)
              SELECT ${E2E_RUN_ID}, n, 'e2e-comic-' || n FROM generate_series(1, ${E2E_ISSUE_COUNT}::int) n`;
    for (let n = 1; n <= E2E_READ_COUNT; n++) await markRead(sql, E2E_USER, E2E_RUN_ID, `e2e-comic-${n}`);
  } finally {
    await sql.end();
  }
}
