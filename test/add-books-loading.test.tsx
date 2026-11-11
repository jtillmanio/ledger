// @vitest-environment happy-dom
// Task 1.30 (AC-5): Add books' code loads when its sheet opens, not with the
// page (the JS budgets, docs/02-architecture.md § Performance budget). While
// it loads, the sheet is already open, labelled and focused, and shows its
// drawn loading state (docs/04-design.md § 10: the loaded geometry in
// --sunk), never an empty body. The module is held here until the test lets it
// go; the sheet's behaviour once loaded is test/add-book-sheet.test.tsx.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddBooksButton from "../src/components/AddBooksButton";
import { UndoProvider } from "../src/components/Undo";

// Held until the test lets it go. The timer is a floor for a page that imports
// AddBooks statically (as before 1.30): its own import would wait on the gate,
// so the module comes after 3 s and the test fails on the missing loading state
// instead of hanging.
const gate = vi.hoisted(() => {
  let release = () => {};
  const held = new Promise<void>((r) => { release = r; });
  setTimeout(() => release(), 3000);
  return { held, release: () => release() };
});
vi.mock("../src/components/AddBooks", async (importOriginal) => {
  await gate.held;
  return importOriginal();
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = "";
});

const click = (el: Element) => act(async () => {
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
});
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const opener = () => container.querySelector<HTMLButtonElement>("button")!;

describe("Add books loads with its sheet (task 1.30, AC-5)", () => {
  it("shows the drawn loading state until its code arrives, then the sheet itself; the second open is at once", async () => {
    act(() => root.render(<UndoProvider><AddBooksButton /></UndoProvider>));
    expect(dialog()).toBeNull();
    await click(opener());

    // Open, labelled by its heading, which has focus: the sheet does not wait for the code.
    const sheet = dialog()!;
    expect(sheet).not.toBeNull();
    const heading = sheet.querySelector("h2")!;
    expect(heading.textContent).toBe("Add books");
    expect(document.activeElement).toBe(heading);
    // The body is the skeleton: busy, announced once, drawn in bars, and not yet the add surface.
    const busy = sheet.querySelector('[aria-busy="true"]')!;
    expect(busy).not.toBeNull();
    expect(busy.querySelector('[role="status"]')!.textContent).toBe("Loading");
    expect(busy.querySelectorAll(".sk").length).toBeGreaterThanOrEqual(4);
    expect(sheet.querySelector(".addb")).toBeNull();

    await act(async () => gate.release());
    await vi.waitFor(() => expect(dialog()!.querySelector(".addb")).not.toBeNull());
    expect(dialog()!.querySelector('[aria-busy="true"]')).toBeNull();
    expect(dialog()!.querySelector(".seg")!.textContent).toBe("SearchPaste a listBy hand");
    expect(document.activeElement).toBe(dialog()!.querySelector("h2"));

    // Closed and opened again, the code is already here: no loading state.
    await act(async () => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(document.activeElement).toBe(opener());
    await click(opener());
    expect(dialog()!.querySelector(".addb")).not.toBeNull();
    expect(dialog()!.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
