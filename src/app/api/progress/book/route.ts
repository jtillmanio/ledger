import { NextResponse } from "next/server";
import { saveBookStatus } from "@/db/writes";
import { apiUserId, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";

const ALLOWED = new Set(["to_read", "reading", "read", "dnf"]);

export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const { bookId, status, finishedYear, rating } = await req.json();

  if (typeof bookId !== "string" || !ALLOWED.has(status)) {
    return NextResponse.json(
      { error: `status must be one of ${[...ALLOWED].join(", ")}` }, { status: 400 },
    );
  }

  await saveBookStatus(userId, { bookId, status, finishedYear, rating });

  return NextResponse.json({ ok: true });
}
