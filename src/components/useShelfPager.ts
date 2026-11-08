"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FINE = "(hover:hover) and (pointer:fine)";

/**
 * A cover shelf's ‹ › (STYLE_GUIDE §14.6, FP-D18; task 1.10, shared with the books shelf in
 * task 2.2): the row it watches, whether to draw the buttons (a fine pointer, from 1024px where
 * the shelf is contained in main, and only while the row overflows), which ends are reached,
 * and `page`, which scrolls by the number of covers fully in view (five at 1280, four at 1024).
 */
export function useShelfPager<T extends HTMLElement>() {
  const row = useRef<T>(null);
  const [pager, setPager] = useState(false);
  const [edge, setEdge] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    const fine = matchMedia(FINE).matches;
    const contained = matchMedia("(min-width:1024px)").matches;
    setPager(fine && contained && el.scrollWidth > el.clientWidth + 1);
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    measure();
    const resized = new ResizeObserver(measure);
    resized.observe(el);
    const fine = matchMedia(FINE);
    fine.addEventListener("change", measure);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      resized.disconnect();
      fine.removeEventListener("change", measure);
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  function page(dir: 1 | -1) {
    const el = row.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    const step = card.offsetWidth + gap;
    const visible = Math.max(1, Math.floor((el.clientWidth + gap) / step));
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * visible * step, behavior: still ? "auto" : "smooth" });
  }

  return { row, pager, edge, page };
}
