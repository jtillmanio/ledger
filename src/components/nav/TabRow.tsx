"use client";

import { Fragment, useLayoutEffect, useRef } from "react";
import { currentItem, tabRowItems, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import type { Medium } from "@/lib/last-medium";

/**
 * The phone's tab row (2.2i, D-120): every screen of the medium you are in, then a 1px divider and
 * the pages across media, Inbox with its count and Progress (6.25, D-178, frame A7), inside the
 * sticky bar and below 768px only (CSS hides it with the bar). It scrolls sideways inside itself;
 * the current item is brought into view by setting `scrollLeft`, never `scrollIntoView`, so the
 * page cannot move. Hue never names an item: the current one is heavier and underlined.
 */
export default function TabRow({ items, medium, pathname, inbox = null }: {
  items: NavItem[]; medium: Medium | null; pathname: string;
  /** The shell's streamed Inbox count (`InboxCount`, shared with the rail and the sidebar). */
  inbox?: React.ReactNode;
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
      {list.map((i, n) => (
        <Fragment key={i.id}>
          {/* The medium's screens end here: what follows spans every medium. Decoration, not an item. */}
          {i.group === "global" && n > 0 && list[n - 1].group !== "global" && <span className="tabdiv" aria-hidden="true" />}
          <NavLink item={i} current={i === now} className="tab">
            {/* The space makes the name "Inbox 6"; the flex row drops it from the drawing. */}
            {i.id === "inbox" && inbox ? <>{`${i.label} `}<span className="count">{inbox}</span></> : i.label}
          </NavLink>
        </Fragment>
      ))}
    </nav>
  );
}
