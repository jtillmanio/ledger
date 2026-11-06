"use client";

import { useLayoutEffect, useRef } from "react";
import { currentItem, tabRowItems, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import type { Medium } from "@/lib/last-medium";

/**
 * The phone's tab row (2.2i, D-120): every screen of the medium you are in, then Inbox, inside the
 * sticky bar and below 768px only (CSS hides it with the bar). It scrolls sideways inside itself;
 * the current item is brought into view by setting `scrollLeft`, never `scrollIntoView`, so the
 * page cannot move. Hue never names an item: the current one is heavier and underlined.
 */
export default function TabRow({ items, medium, pathname }: {
  items: NavItem[]; medium: Medium | null; pathname: string;
}) {
  const list = tabRowItems(items, medium);
  const now = currentItem(list, pathname);
  const ref = useRef<HTMLElement>(null);
  const nowId = now?.id;
  useLayoutEffect(() => {
    const nav = ref.current;
    const el = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < nav.scrollLeft) nav.scrollLeft = left;
    else if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth;
  }, [nowId, list.length]);
  return (
    <nav aria-label="Screens" className="tabrow" ref={ref}>
      {list.map((i) => <NavLink key={i.id} item={i} current={i === now} className="tab">{i.label}</NavLink>)}
    </nav>
  );
}
