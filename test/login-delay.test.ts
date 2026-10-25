// A wrong passcode is refused after one second, so guessing is slow (1.11,
// D-36). The wait is the same for every failure, a right passcode never waits,
// and nothing is kept between requests. Fake timers only: no real-clock wait.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PASSCODE = "correct horse battery staple";
let POST: (req: Request) => Promise<Response>;

beforeEach(async () => {
  process.env.APP_PASSCODE = PASSCODE;
  process.env.SESSION_SECRET = "test-session-secret";
  process.env.OWNER_ID = "justin";
  // Only setTimeout: undici's body parsing must still run.
  vi.useFakeTimers({ toFake: ["setTimeout"] });
  POST = (await import("../src/app/api/login/route")).POST;
});

afterEach(() => {
  vi.useRealTimers();
});

function form(fields: Record<string, string>) {
  return new Request("https://ledger.test/api/login", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

/** Yield on the real event loop until the handler has registered its timer. */
async function untilTimer() {
  for (let i = 0; i < 1000 && vi.getTimerCount() === 0; i++) {
    await new Promise<void>((r) => setImmediate(r));
  }
}

/** Run the request; assert it is pending at 999 ms and resolves at 1000 ms. */
async function refusedAfterASecond(req: Request) {
  let res: Response | undefined;
  const pending = POST(req).then((r) => (res = r));
  await untilTimer();
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(999);
  expect(res).toBeUndefined();
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  return res!;
}

function expectRefusal(res: Response) {
  expect(res.status).toBe(303);
  expect(new URL(res.headers.get("location")!).pathname + new URL(res.headers.get("location")!).search).toBe(
    "/login?error=1",
  );
  expect(res.headers.get("set-cookie") ?? "").not.toContain("rt_session");
}

describe("POST /api/login", () => {
  it("holds a wrong passcode for 1000 ms, then redirects to /login?error=1", async () => {
    expectRefusal(await refusedAfterASecond(form({ passcode: "nope-nope" })));
  });

  it("holds an empty passcode for 1000 ms", async () => {
    expectRefusal(await refusedAfterASecond(form({ passcode: "" })));
  });

  it("holds a missing passcode field for 1000 ms", async () => {
    expectRefusal(await refusedAfterASecond(form({})));
  });

  it("holds a wrong-length passcode for 1000 ms", async () => {
    expectRefusal(await refusedAfterASecond(form({ passcode: PASSCODE + "x" })));
    expectRefusal(await refusedAfterASecond(form({ passcode: PASSCODE.slice(0, -1) })));
  });

  it("holds a malformed body for 1000 ms and still answers 303, never a throw", async () => {
    const json = new Request("https://ledger.test/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expectRefusal(await refusedAfterASecond(json));
    const empty = new Request("https://ledger.test/api/login", { method: "POST" });
    expectRefusal(await refusedAfterASecond(empty));
  });

  it("takes exactly 1000 ms every time: no escalation or carry-over between attempts", async () => {
    for (let i = 0; i < 3; i++) {
      expectRefusal(await refusedAfterASecond(form({ passcode: `guess-${i}` })));
    }
  });

  it("signs the right passcode in without waiting, and sets the cookie", async () => {
    const res = await POST(form({ passcode: PASSCODE, next: "/runs" }));
    expect(vi.getTimerCount()).toBe(0);
    expect(res.status).toBe(303);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/runs");
    expect(res.headers.get("set-cookie")).toContain("rt_session=");
  });
});
