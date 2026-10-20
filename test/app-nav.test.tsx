// The app header is not on /login. Each nav <Link> prefetches its route, the
// passcode gate answers a signed-out prefetch with a redirect to /login, and
// the sign-in page went over its Lighthouse document + RSC budget fetching
// four pages it could not show. Every other page keeps the header.
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RootLayout from "../src/app/layout";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const page = () => renderToString(<RootLayout><main>page</main></RootLayout>);

describe("the app header", () => {
  beforeEach(() => { nav.pathname = "/"; });

  it("is not drawn on /login, so the sign-in page links (and prefetches) nothing", () => {
    nav.pathname = "/login";
    const html = page();
    expect(html).toContain("<main>page</main>");
    expect(html).not.toContain('class="bar"');
    for (const href of ["/comics", "/books/list", "/inbox", "/api/export"]) expect(html).not.toContain(`href="${href}"`);
  });

  it("is drawn everywhere else, with every link", () => {
    nav.pathname = "/comics";
    const html = page();
    expect(html).toContain('class="bar"');
    for (const href of ["/", "/comics", "/books/list", "/inbox", "/api/export"]) expect(html).toContain(`href="${href}"`);
  });

  it("never prefetches a redirect: / is not prefetched, and Books links the list, not /books (task 1.8c)", () => {
    // Both redirect (`/` to the last medium, `/books` to its list until 2.2). A prefetch of one
    // fetched the page already on screen, and held the tap runner's network from going idle.
    const nav = readFileSync("src/components/AppNav.tsx", "utf8");
    expect(nav).toMatch(/<Link href="\/" prefetch=\{false\}/);
    expect(nav).not.toMatch(/href="\/books"/);
  });
});
