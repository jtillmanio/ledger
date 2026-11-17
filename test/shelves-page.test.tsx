// Task 5.1, 2 of 3 (TASK-096, AC-6): the states the browser suite can't reach on the shared TEST
// database. With no shelves the Shelves page is an empty slate whose one action is *+ New shelf*,
// filled (primary), with no list and no rail; each route's error state is a neutral line with a grey ×
// and a real *Try again* button that calls reset, nothing red. The list with shelves, a shelf's page,
// an empty shelf and every write are test/e2e/shelves.spec.ts's.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UndoProvider } from "../src/components/Undo";
import ShelfList from "../src/components/ShelfList";
import ShelvesError from "../src/app/books/shelves/error";
import ShelfError from "../src/app/books/shelves/[id]/error";

vi.mock("next/navigation", () => ({
  usePathname: () => "/books/shelves",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const render = (shelves: Parameters<typeof ShelfList>[0]["shelves"]) =>
  renderToStaticMarkup(createElement(UndoProvider, null, createElement(ShelfList, { shelves })));

describe("the Shelves list's empty state (AC-6)", () => {
  it("is one slate with one action, + New shelf, filled; no list and no rail", () => {
    const html = render([]);
    expect(html).toContain('class="slate"');
    expect(html).toContain("No shelves yet");
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)];
    expect(buttons.map((m) => m[1])).toEqual(["+ New shelf"]);
    expect(buttons[0][0]).toMatch(/class="btn wide"/);
    expect(html).not.toMatch(/<a [^>]*href=/);
    expect(html).not.toContain("shelf-rows");
    expect(html).not.toContain("shelves-aside");
  });

  it("with a shelf it draws the list and the rail's + New shelf, not the slate", () => {
    const html = render([{ id: "dt", name: "Dark Tower", description: null, read: 0, total: 0, followState: null, next: [] }]);
    expect(html).not.toContain('class="slate"');
    expect(html).toMatch(/<a [^>]*href="\/books\/shelves\/dt"[^>]*>Dark Tower<\/a>/);
    expect(html).toContain("Nothing on it yet");
    expect(html).toMatch(/<button[^>]*class="btn sec wide"[^>]*>\+ New shelf<\/button>/);
  });
});

describe("the error states (AC-6)", () => {
  for (const [name, Error_, line] of [
    ["the list", ShelvesError, "Couldn't load your shelves. Nothing was changed."],
    ["a shelf's page", ShelfError, "Couldn't load this shelf. Nothing was changed."],
  ] as const) {
    it(`${name}: a grey × line, a real Try again that calls reset, nothing red`, () => {
      const reset = vi.fn();
      const tree = Error_({ error: new Error("boom"), reset });
      const html = renderToStaticMarkup(tree);
      expect(html.replace(/&#x27;/g, "'")).toContain(line);
      expect(html).toMatch(/<p class="plan-error" role="alert"><span aria-hidden="true">×<\/span>/);
      expect(html).toMatch(/<button[^>]*type="button"[^>]*>Try again<\/button>/);
      expect(html).not.toMatch(/danger|#[0-9a-f]{6}\b/i);
      const press = (node: unknown): boolean => {
        if (!node || typeof node !== "object") return false;
        const el = node as { type?: unknown; props?: { onClick?: () => void; children?: unknown } };
        if (el.type === "button" && el.props?.onClick) { el.props.onClick(); return true; }
        const kids = el.props?.children;
        return (Array.isArray(kids) ? kids : [kids]).some(press);
      };
      expect(press(tree)).toBe(true);
      expect(reset).toHaveBeenCalledOnce();
    });
  }
});
