import { NextResponse } from "next/server";
import { apiUserId, unauthorized } from "@/lib/auth";
import { EMPTY_NOTE, MAX_NOTE, noteKind, noteText } from "@/lib/inbox";
import { saveNote } from "@/db/writes";

export const runtime = "nodejs";

/**
 * Quick capture (task 1.4b): POST `{ text, kind? }` saves a note, from a tap on
 * *Save*, never while a page loads (task 0.9). Nothing but the text is
 * required; a missing or null kind is *Unsure*. Blank text is refused with
 * *Write something first*, and nothing is written.
 */
export async function POST(req: Request) {
  const userId = await apiUserId();
  if (!userId) return unauthorized();
  const body = await req.json().catch(() => null);
  const text = noteText(body?.text);
  const kind = noteKind(body?.kind);
  if (text === undefined) {
    const long = typeof body?.text === "string" && body.text.trim().length > MAX_NOTE;
    return NextResponse.json({ error: long ? `A note is at most ${MAX_NOTE} characters` : EMPTY_NOTE }, { status: 400 });
  }
  if (kind === undefined) {
    return NextResponse.json({ error: "kind is books, comics, watch, or null for Unsure" }, { status: 400 });
  }
  const note = await saveNote(userId, text, kind);
  return NextResponse.json({ ok: true, id: note.id });
}
