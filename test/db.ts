import postgres from "postgres";
import { requireTestUrl } from "../scripts/lib/testdb.mjs";

/** A client on the TEST database only. Never imports src/db, which reads DATABASE_URL. */
export function testSql() {
  return postgres(requireTestUrl(), { max: 1, prepare: false, onnotice: () => {} });
}

export type TestSql = ReturnType<typeof testSql>;

/** Mark an issue read in one run: one progress row on that run's placement of
 * it (data model 2.14). Undated reads pass `{ at: null, precision: "none" }`. */
export async function markRead(
  sql: TestSql, userId: string, runId: string, issueId: string,
  when: { at?: string | null; precision?: "exact" | "approximate" | "none" } = {},
) {
  const precision = when.precision ?? "exact";
  const at = when.at === undefined ? (precision === "none" ? null : new Date().toISOString()) : when.at;
  const rows = await sql`
    INSERT INTO issue_progress (user_id, placement_id, completed_at, completed_at_precision)
    SELECT ${userId}, id, ${at}, ${precision} FROM run_issues
    WHERE run_id = ${runId} AND issue_id = ${issueId}
    RETURNING placement_id`;
  if (rows.length !== 1) throw new Error(`no placement of ${issueId} in ${runId}`);
  return rows[0].placement_id as number;
}

/** Empty every table the tests touch. Order does not matter: CASCADE. */
export async function truncateAll(sql: TestSql) {
  await sql.unsafe(`
    TRUNCATE issue_progress, edition_progress, book_status, reading_plan, read_events, run_queue,
             run_tracks, event_runs, prereqs, issue_credits, creators,
             run_issues, issues, events, editions,
             runs, blocks, tracks, releases, wishlist, external_lists,
             books, book_series, authors, users, inbox, metron_cache, open_library_cache RESTART IDENTITY CASCADE`);
}
