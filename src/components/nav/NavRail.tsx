"use client";

import { usePathname } from "next/navigation";
import { mediumOf } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { currentItem, inGroup, mediumFor, mediumItems, NAV_ITEMS, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import SyncPill from "./SyncPill";

/**
 * The tablet's rail, 768–1023px (D-33; STYLE_GUIDE §14.5): the media switch,
 * then the medium's items, each a 56px target with an icon over an 11px label
 * (touch has no tooltips), then Inbox, with Export and sync at the foot.
 * `inbox` is the server's count, in a Suspense so a cold database never holds
 * a skeleton back.
 */
export default function NavRail({ items = NAV_ITEMS, inbox }: { items?: NavItem[]; inbox: React.ReactNode }) {
  const pathname = usePathname();
  const here = mediumOf(pathname);
  const set = mediumItems(items, mediumFor(pathname));
  const now = currentItem(set, pathname);
  const item = (i: NavItem, current: boolean) => (
    <NavLink key={i.id} item={i} current={current} className="ri">
      <span className="pill"><Icon name={i.icon} />{i.id === "inbox" && inbox ? <span className="count">{inbox}</span> : null}</span>
      <span className="rl">{i.label}</span>
    </NavLink>
  );
  return (
    <nav aria-label="Main" className="rail">
      <div role="group" aria-label="Medium" className="rail-group">
        {inGroup(items, "media").map((m) => item(m, m.medium === here))}
      </div>
      <div className="rail-group">{set.map((i) => item(i, i === now))}</div>
      <div className="rail-rule" aria-hidden="true" />
      <div className="rail-group">
        {inGroup(items, "global").map((i) => item(i, pathname === i.href))}
      </div>
      <span className="grow" />
      <div className="rail-group">{inGroup(items, "foot").map((i) => item(i, pathname === i.href))}</div>
      <SyncPill />
    </nav>
  );
}
