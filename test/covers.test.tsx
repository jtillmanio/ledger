// @vitest-environment happy-dom
// Task 4.3, part 3 (F-33): Show covers, and no image requested when data is
// reduced. The gate is on the client, because the server can't see a media
// query: the server HTML of every cover carries the placeholder and no <img>;
// after hydration the one CoverImage draws the <img> only when covers are on
// (the `ledger_covers` cookie isn't `off`) and the device isn't asking for
// reduced data (`prefers-reduced-data: reduce` or Save-Data). A broken image
// falls back to the placeholder. The switch in Settings writes the cookie.
// The requests themselves are counted in the browser: test/e2e/covers.spec.ts.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Cover, { ArtCover, RowCover } from "../src/components/Cover";
import ShowCovers from "../src/components/ShowCovers";
import { UndoProvider } from "../src/components/Undo";
import {
  COVERS_COOKIE, COVERS_EVENT, coversAllowed, coversOffIn, coversOn, reducedData,
} from "../src/lib/covers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL_X = "https://static.metron.cloud/media/issue/x.jpg";

/** A window-shaped stub: the media query's answer, and Save-Data. */
const win = (o: { media?: boolean; saveData?: boolean | "none" | "no-matchmedia" } = {}) => ({
  ...(o.saveData === "none" ? {} : { navigator: { connection: { saveData: o.saveData === true } } }),
  ...(o.saveData === "no-matchmedia" ? {} : {
    matchMedia: (q: string) => ({ matches: o.media === true && q.includes("prefers-reduced-data") }),
  }),
}) as unknown as Window;

const clearCookie = () => { document.cookie = `${COVERS_COOKIE}=; path=/; max-age=0`; };

describe("the gate (AC-2, AC-3)", () => {
  it("covers are on unless the cookie says off", () => {
    expect(coversOn(undefined)).toBe(true);
    expect(coversOn("on")).toBe(true);
    expect(coversOn("garbage")).toBe(true);
    expect(coversOn("off")).toBe(false);
    expect(coversOffIn("")).toBe(false);
    expect(coversOffIn("a=1; b=2")).toBe(false);
    expect(coversOffIn(`a=1; ${COVERS_COOKIE}=off; b=2`)).toBe(true);
    expect(coversOffIn(`${COVERS_COOKIE}=off`)).toBe(true);
    expect(coversOffIn(`x${COVERS_COOKIE}=off`)).toBe(false);
    expect(coversOffIn(`${COVERS_COOKIE}=on`)).toBe(false);
  });

  it("reduced data is the media query or Save-Data, and a browser with neither reads as not reduced", () => {
    expect(reducedData(win())).toBe(false);
    expect(reducedData(win({ media: true }))).toBe(true);
    expect(reducedData(win({ saveData: true }))).toBe(true);
    expect(reducedData(win({ saveData: "none" }))).toBe(false);
    expect(reducedData(win({ saveData: "no-matchmedia" }))).toBe(false);
    expect(reducedData({} as Window)).toBe(false);
  });

  it("covers are allowed only when on and not reduced", () => {
    expect(coversAllowed(win(), "")).toBe(true);
    expect(coversAllowed(win(), `${COVERS_COOKIE}=off`)).toBe(false);
    expect(coversAllowed(win({ media: true }), "")).toBe(false);
    expect(coversAllowed(win({ saveData: true }), "")).toBe(false);
    expect(coversAllowed(win({ media: true }), `${COVERS_COOKIE}=off`)).toBe(false);
  });
});

describe("the server HTML carries the placeholder and no <img> (AC-2, AC-3)", () => {
  it("RowCover with a url is the placeholder box with its text", () => {
    const html = renderToStaticMarkup(<RowCover url={URL_X} text="141" />);
    expect(html).not.toContain("<img");
    expect(html).not.toContain(URL_X);
    expect(html).toBe('<span class="cv rcv none" aria-hidden="true">141</span>');
  });

  it("ArtCover and Cover with a url are the placeholder, with no <img>", () => {
    expect(renderToStaticMarkup(<ArtCover url={URL_X} w={96} />)).toBe('<span class="cv none" aria-hidden="true"></span>');
    expect(renderToStaticMarkup(<Cover url={URL_X} pending={false} />)).toBe('<span class="cv none" aria-hidden="true"></span>');
  });

  it("a pending cover keeps its dashed outline", () => {
    expect(renderToStaticMarkup(<RowCover url={URL_X} pending text="141" />)).toContain('data-enrich="pending"');
  });
});

describe("the client draws the image only when it may (AC-1, AC-2, AC-3)", () => {
  let container: HTMLElement;
  let root: Root;
  let matches = false;
  let saveData = false;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    matches = false;
    saveData = false;
    clearCookie();
    window.matchMedia = ((q: string) => ({
      matches: matches && q.includes("prefers-reduced-data"),
      addEventListener: () => {}, removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    Object.defineProperty(navigator, "connection", { configurable: true, get: () => ({ saveData }) });
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    clearCookie();
  });

  const draw = (node: React.ReactNode) => act(() => root.render(node));
  const imgs = () => [...container.querySelectorAll("img")];

  it("draws exactly one 28×42 lazy decorative <img> in the row box", () => {
    draw(<RowCover url={URL_X} text="141" />);
    expect(imgs()).toHaveLength(1);
    const img = imgs()[0];
    expect(img.getAttribute("src")).toBe(URL_X);
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("width")).toBe("28");
    expect(img.getAttribute("height")).toBe("42");
    expect(container.innerHTML).toMatch(/^<span class="cv rcv"><img /);
  });

  it("draws the art cover and the search cover at their sizes", () => {
    draw(<ArtCover url={URL_X} w={96} />);
    expect(container.innerHTML).toMatch(/^<span class="cv art"><img /);
    expect(imgs()[0].getAttribute("width")).toBe("96");
    expect(imgs()[0].getAttribute("height")).toBe("144");
    draw(<Cover url={URL_X} pending={false} />);
    expect(container.querySelector("img.cv")).not.toBeNull();
  });

  it("with Show covers off every cover is its placeholder and no <img>", () => {
    document.cookie = `${COVERS_COOKIE}=off; path=/`;
    draw(<><RowCover url={URL_X} text="141" /><ArtCover url={URL_X} w={96} /><Cover url={URL_X} pending={false} /></>);
    expect(imgs()).toHaveLength(0);
    expect(container.innerHTML).not.toContain(URL_X);
    expect(container.querySelector(".cv.rcv.none")!.textContent).toBe("141");
    expect(container.querySelectorAll(".cv.none")).toHaveLength(3);
  });

  it("with prefers-reduced-data: reduce, covers on, every cover is its placeholder", () => {
    matches = true;
    draw(<RowCover url={URL_X} text="141" />);
    expect(imgs()).toHaveLength(0);
    expect(container.querySelector(".cv.rcv.none")!.textContent).toBe("141");
  });

  it("with Save-Data on, every cover is its placeholder", () => {
    saveData = true;
    draw(<ArtCover url={URL_X} w={96} />);
    expect(imgs()).toHaveLength(0);
  });

  it("an image that fails to load falls back to the placeholder text, in the same box", () => {
    draw(<RowCover url={URL_X} text="141" />);
    act(() => { imgs()[0].dispatchEvent(new Event("error")); });
    expect(imgs()).toHaveLength(0);
    expect(container.innerHTML).toBe('<span class="cv rcv none" aria-hidden="true">141</span>');
  });

  it("a row with no url is the placeholder whatever the setting", () => {
    draw(<RowCover url={null} text="141" />);
    expect(container.innerHTML).toBe('<span class="cv rcv none" aria-hidden="true">141</span>');
  });

  it("turning covers off with the event takes the image away at once, and on brings it back", () => {
    draw(<RowCover url={URL_X} text="141" />);
    expect(imgs()).toHaveLength(1);
    act(() => { document.cookie = `${COVERS_COOKIE}=off; path=/`; window.dispatchEvent(new Event(COVERS_EVENT)); });
    expect(imgs()).toHaveLength(0);
    act(() => { clearCookie(); window.dispatchEvent(new Event(COVERS_EVENT)); });
    expect(imgs()).toHaveLength(1);
  });
});

describe("the Show covers switch (AC-4, AC-5)", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    clearCookie();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    clearCookie();
    vi.restoreAllMocks();
  });

  const draw = (initial: boolean) => act(() => root.render(<UndoProvider><ShowCovers initial={initial} /></UndoProvider>));
  const sw = () => container.querySelector<HTMLButtonElement>('button[role="switch"]')!;
  const press = () => act(() => { sw().click(); });

  it("is a switch named Show covers, on by default, with the shared .switch class (its 44px is test/e2e/settings.spec.ts)", () => {
    draw(true);
    expect(sw()).not.toBeNull();
    expect(sw().getAttribute("aria-checked")).toBe("true");
    expect(sw().className).toContain("switch");
    const labelledBy = sw().getAttribute("aria-labelledby");
    expect(container.querySelector(`#${labelledBy}`)!.textContent).toBe("Show covers");
  });

  it("starts off when the server read the cookie as off", () => {
    draw(false);
    expect(sw().getAttribute("aria-checked")).toBe("false");
  });

  it("a press writes the cookie and flips the switch, and the next press clears it", () => {
    draw(true);
    press();
    expect(sw().getAttribute("aria-checked")).toBe("false");
    expect(coversOffIn(document.cookie)).toBe(true);
    press();
    expect(sw().getAttribute("aria-checked")).toBe("true");
    expect(coversOffIn(document.cookie)).toBe(false);
  });

  it("a press tells the covers on the page, once", () => {
    const seen = vi.fn();
    window.addEventListener(COVERS_EVENT, seen);
    draw(true);
    press();
    window.removeEventListener(COVERS_EVENT, seen);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("a cookie that doesn't stick puts the switch back and raises the failed-write line", () => {
    const jar = vi.spyOn(document, "cookie", "set").mockImplementation(() => {});
    draw(true);
    press();
    expect(jar).toHaveBeenCalled();
    expect(sw().getAttribute("aria-checked")).toBe("true");
    expect(document.body.textContent).toContain("Couldn't save Show covers");
  });
});
