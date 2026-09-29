import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Deliberately minimal: one shared passcode, one signed cookie, one owner.
 *
 * The rest of the app never asks "is the user logged in" — it asks
 * currentUserId(), which already returns a per-user key. When you add a second
 * reader, replace the body of these two functions with a real provider and
 * nothing downstream changes.
 */

const COOKIE = "rt_session";

function sign(value: string): string {
  return createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
}

export function issueToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx < 1) return null;
  const [userId, mac] = [token.slice(0, idx), token.slice(idx + 1)];
  const expected = sign(userId);
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(mac), Buffer.from(expected)) ? userId : null;
}

export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return verify(jar.get(COOKIE)?.value);
}

/**
 * Use in server components. The middleware only checks that a cookie is present,
 * so a stale or tampered one (a rotated SESSION_SECRET, a truncated value) gets
 * this far; send it to /login instead of a 500 (R2-11).
 */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) redirect("/login");
  return id;
}

/** Use in route handlers: null means answer 401, not redirect a fetch() to HTML. */
export async function apiUserId(): Promise<string | null> {
  return currentUserId();
}

export function unauthorized(): Response {
  return Response.json({ error: "not signed in" }, { status: 401 });
}

export const SESSION_COOKIE = COOKIE;
