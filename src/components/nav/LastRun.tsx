import { cookies } from "next/headers";
import { liveRun } from "@/db/queries";
import { currentUserId } from "@/lib/auth";
import { LAST_RUN_COOKIE, parseLastRun } from "@/lib/last-run";
import { RememberRun } from "./ShellFrame";

/**
 * The run you last added issues to, for comics Add (1.19). Streamed inside a
 * <Suspense> beside the Inbox count, so it is outside every page's query budget
 * (D-77) and a cold database never holds the skeleton back. A soft-deleted run,
 * a signed-out visitor or a failing read draws nothing, and Add lands on the
 * run list.
 */
export default async function LastRun() {
  const runId = parseLastRun((await cookies()).get(LAST_RUN_COOKIE)?.value);
  if (runId === null || !(await currentUserId())) return null;
  let live = false;
  try {
    live = await liveRun(runId);
  } catch {
    // Drawn as nothing: the run list is a safe place to land.
  }
  return live ? <RememberRun runId={runId} /> : null;
}
