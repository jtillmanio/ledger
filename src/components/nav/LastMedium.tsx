import { cookies } from "next/headers";
import { MEDIUM_COOKIE, pickMedium } from "@/lib/last-medium";
import { RememberMedium } from "./ShellFrame";

/**
 * The medium you last visited (R1-13), for the phone's tab row on /inbox and /settings. Streamed
 * inside a <Suspense> like LastRun, so it is outside every page's query budget (D-77). It reads a
 * cookie only (the proxy writes it): no cookie, or an unknown value, is comics.
 */
export default async function LastMedium() {
  return <RememberMedium medium={pickMedium((await cookies()).get(MEDIUM_COOKIE)?.value)} />;
}
