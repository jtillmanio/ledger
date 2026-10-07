// Signs the Lighthouse job in to one deployment (task 0.10), the way the owner
// does: posts APP_PASSCODE to /api/login past Vercel Authentication, and keeps
// the rt_session cookie it answers with.
//
//   TARGET_URL=https://ledger-….vercel.app HEADERS_DIR=… node scripts/perf/login.mjs
//
// Writes HEADERS_DIR/signed-in.json and signed-out.json (the headers Lighthouse
// is given) and nothing else. HEADERS_DIR must be outside the reports folder:
// the workflow deletes it when the job ends. Prints the status, never a value;
// on Actions it masks the passcode, the bypass secret and the new cookie first.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sessionCookie } from "./lib/perf.mjs";

const { TARGET_URL, HEADERS_DIR, APP_PASSCODE, VERCEL_AUTOMATION_BYPASS_SECRET: bypass } = process.env;
const mask = (v) => process.env.GITHUB_ACTIONS === "true" && v && console.log(`::add-mask::${v}`);
mask(APP_PASSCODE);
mask(bypass);

function fail(message) {
  console.error(`login: ${message}`);
  process.exit(1);
}
if (!TARGET_URL || !HEADERS_DIR) fail("TARGET_URL and HEADERS_DIR are required.");
if (!APP_PASSCODE) fail("APP_PASSCODE is not set: add the preview's passcode as the APP_PASSCODE repository secret (START-HERE 10e).");
if (!bypass) fail("VERCEL_AUTOMATION_BYPASS_SECRET is not set (START-HERE 10e step 4).");

// Every deployment is behind Vercel Authentication; the header is how
// automation gets past it, and the second keeps the preview toolbar out.
const vercel = { "x-vercel-protection-bypass": bypass, "x-vercel-skip-toolbar": "1" };
const res = await fetch(new URL("/api/login", TARGET_URL), {
  method: "POST",
  redirect: "manual",
  headers: { ...vercel, "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ passcode: APP_PASSCODE, next: "/login" }),
});
const cookie = sessionCookie(res.headers.getSetCookie());
mask(cookie?.slice("rt_session=".length));
const location = res.headers.get("location") ?? "";

if (/^https:\/\/vercel\.com\//.test(location) || res.status === 401) {
  fail(`Vercel Authentication refused the bypass secret (${res.status}). VERCEL_AUTOMATION_BYPASS_SECRET must match ` +
    "the project's Protection Bypass for Automation secret (START-HERE 10e step 4).");
}
if (!cookie) {
  fail(`/api/login answered ${res.status} without a session${/error=1/.test(location) ? ": the passcode did not match" : ""}. ` +
    "The APP_PASSCODE repository secret must be the passcode Vercel's Preview environment has (START-HERE 10e).");
}

mkdirSync(HEADERS_DIR, { recursive: true, mode: 0o700 });
writeFileSync(join(HEADERS_DIR, "signed-in.json"), JSON.stringify({ ...vercel, Cookie: cookie }), { mode: 0o600 });
writeFileSync(join(HEADERS_DIR, "signed-out.json"), JSON.stringify(vercel), { mode: 0o600 });
console.log(`login: signed in to ${new URL(TARGET_URL).host} (${res.status})`);
