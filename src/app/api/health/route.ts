import { healthCheck } from "@/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Release's smoke test (START-HERE Step 13): the database answers, the views
 * are applied, and which commit this build is, so Release can tell the build
 * it promoted is the one serving. Outside the passcode gate (middleware.ts);
 * it returns no data, and a failure says only which check failed.
 */
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const headers = { "cache-control": "no-store" };
  try {
    const { views } = await healthCheck();
    if (!views) return Response.json({ ok: false, failed: "views", commit }, { status: 503, headers });
    return Response.json({ ok: true, commit }, { headers });
  } catch (e) {
    console.error("health: database check failed", e);
    return Response.json({ ok: false, failed: "database", commit }, { status: 503, headers });
  }
}
