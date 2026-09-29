import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, issueProgress } from "@/db";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { issueId, completed } = await req.json();

  if (typeof issueId !== "string" || typeof completed !== "boolean") {
    return NextResponse.json({ error: "issueId and completed are required" }, { status: 400 });
  }

  if (completed) {
    await db.insert(issueProgress).values({ userId, issueId }).onConflictDoNothing();
  } else {
    await db.delete(issueProgress).where(
      and(eq(issueProgress.userId, userId), eq(issueProgress.issueId, issueId)),
    );
  }
  return NextResponse.json({ ok: true });
}
