import { sql } from "@/db";
import { apiUserId, unauthorized } from "@/lib/auth";
import { CATALOG_TABLES, USER_TABLES } from "@/db/export-tables";

export const runtime = "nodejs";

/**
 * Your exit ramp. One request returns every table as JSON, so the data is
 * never trapped behind this app. Pair it with the nightly pg_dump action.
 */
export async function GET() {
  const userId = await apiUserId();
  if (!userId) return unauthorized();

  const out: Record<string, unknown[]> = {};
  for (const t of CATALOG_TABLES) out[t] = [...(await sql`SELECT * FROM ${sql(t)}`)];
  for (const t of USER_TABLES) out[t] = [...(await sql`SELECT * FROM ${sql(t)} WHERE user_id = ${userId}`)];

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="ledger-${stamp}.json"`,
    },
  });
}
