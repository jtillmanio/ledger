// Task 1.8c: opening the app lands on the medium you last used (R1-13). The
// proxy writes the `ledger_medium` cookie on any request under a medium, and
// `/` reads it. A cookie, not localStorage or a column: the server decides the
// redirect before a page exists to read either.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../src/app/route";
import { MEDIA, MEDIUM_COOKIE, mediumOf, pickMedium } from "../src/lib/last-medium";
import { config, proxy } from "../src/proxy";

const ORIGIN = "http://localhost:3000";

function request(path: string, cookies: Record<string, string> = {}) {
  const header = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  return new NextRequest(`${ORIGIN}${path}`, { headers: header ? { cookie: header } : {} });
}

const where = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location).pathname : null;
};

describe("GET / (AC-1, AC-3)", () => {
  it("redirects to the last-touched medium", () => {
    const res = GET(request("/", { ledger_medium: "books" }));
    expect(res.status).toBe(307);
    expect(where(res)).toBe("/books");
  });

  it("redirects to /comics for a user with no history", () => {
    const res = GET(request("/"));
    expect(res.status).toBe(307);
    expect(where(res)).toBe("/comics");
  });

  it("redirects an unknown value to /comics", () => {
    expect(where(GET(request("/", { ledger_medium: "bogus" })))).toBe("/comics");
    expect(where(GET(request("/", { ledger_medium: "__proto__" })))).toBe("/comics");
  });
});

describe("GET / for watch (task 1.8, AC-5)", () => {
  it("redirects to /watch once it is the last-touched medium", () => {
    const res = GET(request("/", { ledger_medium: "watch" }));
    expect(res.status).toBe(307);
    expect(where(res)).toBe("/watch");
  });
});

describe("the medium helpers", () => {
  it("know comics, books and watch", () => {
    expect([...MEDIA]).toEqual(["comics", "books", "watch"]);
  });

  it("read a medium off a path, and only off a path under one", () => {
    expect(mediumOf("/comics")).toBe("comics");
    expect(mediumOf("/comics/runs")).toBe("comics");
    expect(mediumOf("/books/list")).toBe("books");
    expect(mediumOf("/books")).toBe("books");
    expect(mediumOf("/watch")).toBe("watch");
    expect(mediumOf("/inbox")).toBeNull();
    expect(mediumOf("/")).toBeNull();
    // A prefix of the name is not the medium.
    expect(mediumOf("/comicsx")).toBeNull();
    expect(mediumOf("/bookshelf")).toBeNull();
  });

  it("pick comics for anything that is not a medium", () => {
    expect(pickMedium("books")).toBe("books");
    expect(pickMedium("watch")).toBe("watch");
    expect(pickMedium("comics")).toBe("comics");
    expect(pickMedium(undefined)).toBe("comics");
    expect(pickMedium("")).toBe("comics");
    expect(pickMedium("constructor")).toBe("comics");
  });
});

describe("proxy() writes the cookie (AC-3)", () => {
  const session = { rt_session: "owner.0123abcd" };

  it("sets ledger_medium on a signed-in request under a medium, as an httpOnly, Lax, year-long cookie", () => {
    const res = proxy(request("/books/list", session));
    const cookie = res.cookies.get(MEDIUM_COOKIE);
    expect(cookie).toMatchObject({
      name: "ledger_medium", value: "books", httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    });
  });

  it("sets it for /comics and for a run page", () => {
    expect(proxy(request("/comics", session)).cookies.get(MEDIUM_COOKIE)?.value).toBe("comics");
    expect(proxy(request("/comics/some-run", session)).cookies.get(MEDIUM_COOKIE)?.value).toBe("comics");
  });

  it("sets watch for /watch, so a visit there is what / reopens", () => {
    expect(proxy(request("/watch", session)).cookies.get(MEDIUM_COOKIE)?.value).toBe("watch");
  });

  it("leaves the cookie alone on a request elsewhere", () => {
    const res = proxy(request("/inbox", { ...session, ledger_medium: "books" }));
    expect(res.cookies.get(MEDIUM_COOKIE)).toBeUndefined();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("leaves the cookie alone for a signed-out request, which goes to /login", () => {
    const res = proxy(request("/books/list"));
    expect(res.cookies.get(MEDIUM_COOKIE)).toBeUndefined();
    expect(res.status).toBe(307);
    expect(where(res)).toBe("/login");
  });

  it("is not run for a <Link> prefetch, which is not a visit (the matcher skips it)", () => {
    // Next hides the prefetch headers from proxy(), so only the matcher can tell.
    const [entry] = config.matcher;
    expect(config.matcher).toHaveLength(1);
    expect(entry.missing).toEqual(expect.arrayContaining([
      { type: "header", key: "next-router-prefetch" },
      { type: "header", key: "next-router-segment-prefetch" },
    ]));
  });
});
