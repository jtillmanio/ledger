"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mediumOf } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { currentItem, inGroup, mediumFor, mediumItems, NAV_ITEMS, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import SyncPill from "./SyncPill";

/**
 * The desktop sidebar (D-33; STYLE_GUIDE §14.6), one markup at two widths. From
 * 1280px it is 224px with labels; from 1024px it is a 64px icon rail where the
 * label is visually hidden (it stays the accessible name) and a tooltip shows
 * on hover after --dur-4 and at once on :focus-visible. Items are neutral:
 * hue identifies data, never navigation.
 */
export default function Sidebar({ items = NAV_ITEMS, inbox }: { items?: NavItem[]; inbox: React.ReactNode }) {
  const pathname = usePathname();
  const here = mediumOf(pathname);
  const set = mediumItems(items, mediumFor(pathname));
  const now = currentItem(set, pathname);
  const item = (i: NavItem, current: boolean, className = "si") => (
    <NavLink key={i.id} item={i} current={current} className={className}>
      <Icon name={i.icon} />
      <span className="nl">{i.label}</span>
      {i.id === "inbox" && inbox ? <span className="count">{inbox}</span> : null}
    </NavLink>
  );
  return (
    <nav aria-label="Main" className="side">
      {/* / is a redirect (task 1.8c): never prefetched. */}
      <Link href="/" prefetch={false} className="brand" aria-label="Ledger">
        <span aria-hidden="true" className="full">Ledger</span>
        <span aria-hidden="true" className="short">L</span>
      </Link>
      <div role="group" aria-label="Medium" className="seg">
        {inGroup(items, "media").map((m) => item(m, m.medium === here, "sm"))}
      </div>
      <div className="side-items">{set.map((i) => item(i, i === now))}</div>
      <div className="side-rule" aria-hidden="true" />
      {inGroup(items, "global").map((i) => item(i, pathname === i.href))}
      <span className="grow" />
      {inGroup(items, "foot").map((i) => item(i, pathname === i.href))}
      <SyncPill />
    </nav>
  );
}
