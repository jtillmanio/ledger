// Task 1.8c: opening the app lands on the medium you last used (R1-13). The
// proxy writes the `ledger_medium` cookie on any request under a medium, and
// `/` reads it. A cookie, not localStorage or a column: the server decides the
// redirect before a page exists to read either.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../src/app/route";
import {
  MEDIA, MEDIUM_COOKIE, START_COOKIE, mediumOf, pickMedium, startMedium, writeStartCookie,
} from "../src/lib/last-medium";
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

describe("GET / with Start on (task 6.25, TASK-147, AC-2, AC-3)", () => {
  it("Last used (the default): the medium visited last, else comics", () => {
    expect(where(GET(request("/", { ledger_medium: "watch" })))).toBe("/watch");
    expect(where(GET(request("/", { ledger_medium: "watch", ledger_start: "last" })))).toBe("/watch");
    expect(where(GET(request("/")))).toBe("/comics");
  });

  it("a medium named by Start on wins over the one visited last", () => {
    expect(where(GET(request("/", { ledger_start: "books", ledger_medium: "comics" })))).toBe("/books");
    expect(where(GET(request("/", { ledger_start: "watch" })))).toBe("/watch");
    expect(where(GET(request("/", { ledger_start: "comics", ledger_medium: "books" })))).toBe("/comics");
  });

  it("a stored value that names no built medium behaves as Last used", () => {
    expect(where(GET(request("/", { ledger_start: "bogus", ledger_medium: "watch" })))).toBe("/watch");
    expect(where(GET(request("/", { ledger_start: "__proto__", ledger_medium: "books" })))).toBe("/books");
    expect(where(GET(request("/", { ledger_start: "constructor" })))).toBe("/comics");
  });
});

describe("startMedium and the Start on writer (task 6.25, TASK-147)", () => {
  // A document with a cookie jar that behaves like the browser's for the one cookie.
  function fakeDoc(protocol = "http:", { refuse = false } = {}) {
    const jar = new Map<string, string>();
    const writes: string[] = [];
    const doc = {
      location: { protocol },
      get cookie() { return [...jar].map(([k, v]) => `${k}=${v}`).join("; "); },
      set cookie(line: string) {
        writes.push(line);
        if (refuse) return;
        const [pair, ...attrs] = line.split(";").map((s) => s.trim());
        const [k, v] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
        if (attrs.some((a) => a === "max-age=0")) jar.delete(k); else jar.set(k, v);
      },
    };
    return { doc: doc as unknown as Document, jar, writes };
  }

  it("startMedium: a built medium wins; anything else falls to the last one used", () => {
    expect(startMedium("books", "comics")).toBe("books");
    expect(startMedium(undefined, "watch")).toBe("watch");
    expect(startMedium("last", "watch")).toBe("watch");
    expect(startMedium("nope", undefined)).toBe("comics");
    expect(startMedium("__proto__", "books")).toBe("books");
  });

  it("writes a medium as a year-long, Lax, JS-readable cookie, and reads back", () => {
    const { doc, jar, writes } = fakeDoc();
    expect(writeStartCookie("books", doc)).toBe(true);
    expect(jar.get(START_COOKIE)).toBe("books");
    expect(writes[0]).toBe(`${START_COOKIE}=books; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`);
  });

  it("is Secure on https", () => {
    const { doc, writes } = fakeDoc("https:");
    writeStartCookie("watch", doc);
    expect(writes[0]).toMatch(/; Secure$/);
  });

  it("Last used deletes the cookie, and that reads back too", () => {
    const { doc, jar, writes } = fakeDoc();
    writeStartCookie("books", doc);
    expect(writeStartCookie("last", doc)).toBe(true);
    expect(jar.has(START_COOKIE)).toBe(false);
    expect(writes[1]).toContain("max-age=0");
  });

  it("returns false when the browser keeps no cookie, so the control can put the choice back", () => {
    const { doc } = fakeDoc("http:", { refuse: true });
    expect(writeStartCookie("books", doc)).toBe(false);
    expect(writeStartCookie("last", doc)).toBe(true); // nothing stored is what Last used means
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
