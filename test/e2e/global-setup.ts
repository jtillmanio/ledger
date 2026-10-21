// Runs once before the browser projects: empties the TEST database and seeds
// the one user and one run the specs load. testSql() is on TEST_DATABASE_URL
// only and refuses otherwise (R3-02); this never imports src/db.
import { loadDotEnv } from "../../scripts/lib/testdb.mjs";
import { E2E_USER } from "../../scripts/lib/e2e.mjs";
import { markRead, testSql, truncateAll } from "../db";
import {
  E2E_BOOK_COUNT, E2E_INBOX_COUNT, E2E_ISSUE_COUNT, E2E_LONG_LABEL, E2E_LONG_RUN_ID, E2E_READ_COUNT, E2E_RUN_ID, E2E_RUN_TITLE,
} from "./helpers";

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
    await sql`INSERT INTO runs (id, title) VALUES (${E2E_LONG_RUN_ID}, 'E2E Long Run')`;
    // An unnumbered second label makes the run multi-series, so Resume names the whole first label (M-10).
    await sql`INSERT INTO issues (id, label) VALUES ('e2e-long-1', ${E2E_LONG_LABEL}), ('e2e-long-2', 'Dark Reign: The Cabal')`;
    await sql`INSERT INTO run_issues (run_id, sequence, issue_id) VALUES (${E2E_LONG_RUN_ID}, 1, 'e2e-long-1'), (${E2E_LONG_RUN_ID}, 2, 'e2e-long-2')`;
    await sql`INSERT INTO inbox (user_id, raw_text)
              SELECT ${E2E_USER}, 'E2E note ' || n FROM generate_series(1, ${E2E_INBOX_COUNT}::int) n`;
    await sql`INSERT INTO books (id, title, genre)
              SELECT 'e2e-book-' || n, 'E2E Book ' || n, 'Fantasy' FROM generate_series(1, ${E2E_BOOK_COUNT}::int) n`;
    for (let n = 1; n <= E2E_READ_COUNT; n++) await markRead(sql, E2E_USER, E2E_RUN_ID, `e2e-comic-${n}`);
  } finally {
    await sql.end();
  }
}
