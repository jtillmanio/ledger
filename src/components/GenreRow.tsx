"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** A tap scrolls this share of the row's width; a hold then glides at a steady speed (px per ms). */
const STEP = 0.85;
const GLIDE = 0.9;
/** Under reduced motion a hold repeats the tap's jump this often. */
const REDUCED_GAP_MS = 300;

type Dir = 1 | -1;

/**
 * The Library's genre row (task 4.5, D-98; arrows task 6.26). The chips are the server's links, passed
 * as children, so the page's markup and payload don't change. One row that scrolls sideways with no
 * browser scrollbar; from 768px an arrow at each end that has more (CSS hides both on the phone, which
 * keeps the swipe). A tap scrolls about the row's width over `--dur-4`; a held press keeps going at a
 * steady speed until release or the end, as the Stepper's hold (D-123). Under reduced motion a tap
 * jumps the same distance and a hold steps. Enter or Space on a focused arrow is one step; a chip
 * reached by Tab is scrolled fully into view, clear of the arrows (`scroll-padding-inline`).
 */
export default function GenreRow({ children }: { children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  // Nothing is known about the row before it is laid out: no arrow until it is measured.
  const [more, setMore] = useState({ left: false, right: false });
  // What was last drawn: measure sets state only when it changes, as it runs after every render.
  const drawn = useRef(more);
  const held = useRef(false);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The arrow that had focus when it went (it is hidden), so focus lands somewhere near. */
  const lost = useRef<Dir | 0>(0);

  function measure() {
    const el = row.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    const focused = document.activeElement;
    if (focused === prev.current && !left) lost.current = -1;
    if (focused === next.current && !right) lost.current = 1;
    if (drawn.current.left === left && drawn.current.right === right) return;
    drawn.current = { left, right };
    setMore(drawn.current);
  }

  function stop() {
    cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
    frame.current = 0;
  }

  // Measured on mount, on every render (a chosen chip may change width), on scroll and on resize.
  useEffect(measure);
  useEffect(() => {
    const el = row.current!;
    el.addEventListener("scroll", measure, { passive: true });
    const seen = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    seen?.observe(el);
    document.fonts?.ready.then(measure);
    return () => { el.removeEventListener("scroll", measure); seen?.disconnect(); stop(); };
  }, []);

  // A focused arrow that went: to the other arrow if it is drawn, else to the chip at that end.
  useLayoutEffect(() => {
    const dir = lost.current;
    if (!dir) return;
    lost.current = 0;
    const other = dir === 1 ? prev.current : next.current;
    const chips = row.current?.querySelectorAll("a");
    (other && !other.hidden ? other : chips?.[dir === 1 ? chips.length - 1 : 0])?.focus();
  }, [more]);

  /** A held press's steady scroll, after its step: `since` is the step's last frame, the glide's clock. */
  function glide(dir: Dir, since: number) {
    const el = row.current!;
    let pos = el.scrollLeft;
    let last = since;
    const tick = (now: number) => {
      // Let go since the last frame: not one pixel more.
      if (!held.current) { frame.current = 0; return; }
      const max = el.scrollWidth - el.clientWidth;
      pos = Math.min(max, Math.max(0, pos + dir * GLIDE * (now - last)));
      last = now;
      el.scrollLeft = pos;
      if (pos <= 0 || pos >= max) { held.current = false; frame.current = 0; return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }

  /** One step: animated over --dur-4, or one jump under reduced motion. A hold carries on after it. */
  function step(dir: Dir) {
    const el = row.current;
    if (!el) return;
    stop();
    const max = el.scrollWidth - el.clientWidth;
    const from = el.scrollLeft;
    const to = Math.min(max, Math.max(0, from + dir * Math.round(el.clientWidth * STEP)));
    const atEnd = to <= 0 || to >= max;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = to;
      if (held.current && !atEnd) timer.current = setTimeout(() => step(dir), REDUCED_GAP_MS);
      else held.current = false;
      return;
    }
    // The build writes 300ms as .3s: read the unit.
    const token = getComputedStyle(el).getPropertyValue("--dur-4").trim();
    const dur = parseFloat(token) * (token.endsWith("ms") ? 1 : 1000) || 300;
    // Timed from the first frame: rAF's own clock, no read of the time outside it.
    let start = -1;
    const tick = (now: number) => {
      if (start < 0) start = now - 16;
      const t = Math.min(1, (now - start) / dur);
      el.scrollLeft = from + (to - from) * (1 - (1 - t) ** 3);
      // Held, the step hands over to the glide once it has slowed to the glide's speed: no dip between them.
      // The glide is timed from this frame, so a slow next frame moves it as far as the time says.
      if (held.current && !atEnd && 3 * (1 - t) ** 2 * Math.abs(to - from) / dur <= GLIDE) glide(dir, now);
      else if (t < 1) frame.current = requestAnimationFrame(tick);
      else { held.current = false; frame.current = 0; }
    };
    frame.current = requestAnimationFrame(tick);
  }

  const release = () => {
    held.current = false;
    clearTimeout(timer.current);
  };

  const arrow = (dir: Dir) => (
    <button ref={dir === 1 ? next : prev} type="button" className={`genre-arrow ${dir === 1 ? "next" : "prev"}`}
            aria-label={`Scroll genres ${dir === 1 ? "right" : "left"}`} hidden={!(dir === 1 ? more.right : more.left)}
            onPointerDown={(e) => {
              if (e.button !== 0 && e.pointerType !== "touch") return;
              held.current = true;
              step(dir);
            }}
            onPointerUp={release} onPointerLeave={release} onPointerCancel={release}
            onContextMenu={(e) => e.preventDefault()}
            // A pointer's click follows the press that already stepped; a key's (detail 0) is one step.
            onClick={(e) => { if (e.detail === 0) { held.current = false; step(dir); } }}>
      <span aria-hidden="true">{dir === 1 ? "›" : "‹"}</span>
    </button>
  );

  return (
    <div className="filters genre-wrap" role="group" aria-label="Genre">
      {arrow(-1)}
      <div ref={row} className="genre-row"
           onFocus={(e) => { if (e.target !== row.current) e.target.scrollIntoView({ block: "nearest", inline: "nearest" }); }}>
        {children}
      </div>
      {arrow(1)}
    </div>
  );
}
