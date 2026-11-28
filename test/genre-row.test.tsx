// @vitest-environment happy-dom
// Task 6.26 (TASK-163, AC-2): the Library's genre row draws an arrow only on a side that has more
// to show. Widths are stubbed on the scroller (happy-dom lays nothing out), then a scroll event
// makes the row measure again. The scrolling itself, the hold and reduced motion are
// test/e2e/library-genres.spec.ts, in a browser.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import GenreRow from "../src/components/GenreRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(
    <GenreRow>
      {["Fantasy", "Sci-Fi", "Horror"].map((g) => <a key={g} href={`/books/list?genre=${g}`} className="chip">{g}</a>)}
    </GenreRow>,
  ));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const group = () => container.querySelector<HTMLElement>('[role="group"][aria-label="Genre"]')!;
const left = () => container.querySelector<HTMLButtonElement>('button[aria-label="Scroll genres left"]')!;
const right = () => container.querySelector<HTMLButtonElement>('button[aria-label="Scroll genres right"]')!;

/** Lays the scroller out as a browser would, then scrolls it so the row measures. */
function layout(scrollWidth: number, clientWidth: number, scrollLeft: number) {
  const row = group().querySelector<HTMLElement>(".genre-row")!;
  Object.defineProperty(row, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(row, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(row, "scrollLeft", { configurable: true, writable: true, value: scrollLeft });
  act(() => { row.dispatchEvent(new Event("scroll")); });
}

describe("the genre row's arrows (task 6.26)", () => {
  it("keeps the chips in a group named Genre, between the two named arrows", () => {
    const order = [...group().querySelectorAll("button, a")].map((el) => el.getAttribute("aria-label") ?? el.textContent);
    expect(order).toEqual(["Scroll genres left", "Fantasy", "Sci-Fi", "Horror", "Scroll genres right"]);
  });

  it("draws no arrow when the row fits (AC-2)", () => {
    layout(500, 500, 0);
    expect(left().hidden).toBe(true);
    expect(right().hidden).toBe(true);
  });

  it("draws only › at the start of a row that overflows", () => {
    layout(1500, 500, 0);
    expect(left().hidden).toBe(true);
    expect(right().hidden).toBe(false);
  });

  it("draws both in the middle, and only ‹ at the end", () => {
    layout(1500, 500, 400);
    expect(left().hidden).toBe(false);
    expect(right().hidden).toBe(false);
    layout(1500, 500, 1000);
    expect(left().hidden).toBe(false);
    expect(right().hidden).toBe(true);
  });
});
