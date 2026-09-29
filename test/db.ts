import postgres from "postgres";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";

/** A client on the TEST database only. Never imports src/db, which reads DATABASE_URL. */
export function testSql() {
  return postgres(requireTestUrl(), { max: 1, prepare: false, onnotice: () => {} });
}

export type TestSql = ReturnType<typeof testSql>;

/** Empty every table the tests touch. Order does not matter: CASCADE. */
export async function truncateAll(sql: TestSql) {
  await sql.unsafe(`
    TRUNCATE issue_progress, edition_progress, book_status, reading_plan,
             run_tracks, event_runs, prereqs, issue_credits, creators,
             run_issues, issues, events, editions,
             runs, blocks, tracks, releases, wishlist, external_lists,
             books, book_series, authors, users RESTART IDENTITY CASCADE`);
}
