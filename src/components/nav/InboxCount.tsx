import { cache } from "react";
import { inboxCount } from "@/db/queries";
import { currentUserId } from "@/lib/auth";

// The rail and the sidebar both draw the count; one query per request serves both.
const count = cache((userId: string) => inboxCount(userId));

/**
 * The shell's global Inbox (N) (FP-D16). Streamed inside a <Suspense>, so a
 * Neon cold start delays the number and never the page's skeleton. A signed-out
 * or failing read draws nothing: the nav is not worth a 500.
 */
export default async function InboxCount() {
  const userId = await currentUserId();
  if (!userId) return null;
  let n: number | null = null;
  try {
    n = await count(userId);
  } catch {
    // Drawn as nothing; the page's own read will say what is wrong.
  }
  return n === null ? null : <>{n}</>;
}
