import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { bookShelves } from "@/db/queries";

export const runtime = "nodejs";

/**
 * Your book shelves, for Add books' *Shelf…* (task 1.4c). Asked when you tap
 * *Shelf…*, never while a page loads (task 0.9). Creating shelves is Phase 5.
 */
export async function GET() {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  return NextResponse.json({ shelves: await bookShelves(userId) });
}
