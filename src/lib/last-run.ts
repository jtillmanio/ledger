// The run you last added issues to (roadmap 1.19), so the comics Add item
// lands on its Add issues screen. A cookie, as the last medium is (R1-13): per
// browser, and no column (owner, 2026-11-02). The insert's answer writes it
// (POST /api/runs/[runId]/issues); a dry run, a refusal and an undo don't.

export const LAST_RUN_COOKIE = "ledger_last_run";
export const LAST_RUN_MAX_AGE = 60 * 60 * 24 * 365;
export const LAST_RUN_OPTIONS = {
  httpOnly: true, sameSite: "lax", path: "/", maxAge: LAST_RUN_MAX_AGE,
} as const;

// Longer than any run id; a longer value was not written by the app.
const MAX_ID = 200;

/** The cookie's value as a run id, or null when it is missing or no run id. */
export function parseLastRun(value: string | undefined): string | null {
  return value && value.length <= MAX_ID ? value : null;
}

/** Where comics Add goes: the run's Add issues, or the run list before any add. */
export function addHref(runId: string | null): string {
  return runId === null ? "/comics/runs" : `/comics/${encodeURIComponent(runId)}/add`;
}
