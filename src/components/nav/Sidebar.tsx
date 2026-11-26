"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import type { Medium } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { currentItem, inGroup, mediumFor, mediumItems, NAV_ITEMS, type NavItem } from "./items";
import MediumMenu from "./MediumMenu";
import { NavLink } from "./NavLink";
import SearchButton from "./SearchButton";
import SyncPill from "./SyncPill";

/**
 * The desktop nav (D-33; STYLE_GUIDE §14.6, §17.1; frames A9, A10), one markup at two widths, CSS
 * choosing what each draws so nothing flashes at hydration (D-178):
 *
 * - From 1280px, the 224px sidebar: the wordmark, *Search · Ctrl K*, then *Media*, a 36px row per
 *   built medium. The medium you are in is open (`aria-expanded`, a disclosure that can close), its
 *   items nested under it at 34px; the others are one-line links to their dashboards. Then
 *   *Across media*: Inbox with its mono count, and Progress. Settings and sync at the foot.
 * - From 1024px, the 64px icon rail: the *L*, Search as an icon, the medium switch (`MediumMenu`),
 *   the medium's items as icons, a rule, Inbox (its count a badge) and Progress. The labels are
 *   visually hidden (they stay the accessible names) and a tooltip shows on hover after --dur-4
 *   and at once on :focus-visible.
 *
 * Items are neutral: hue identifies data, never navigation, apart from the current item's `--m-*` bar.
 */
export default function Sidebar({ items = NAV_ITEMS, inbox }: { items?: NavItem[]; inbox: React.ReactNode }) {
  const pathname = usePathname();
  const shown = mediumFor(pathname);
  const set = mediumItems(items, shown);
  const now = currentItem(set, pathname);
  // The medium whose items you closed, if any. Going to another medium forgets it, so the medium
  // you are in always arrives open.
  const [closed, setClosed] = useState<Medium | null>(null);
  if (closed !== null && closed !== shown) setClosed(null);
  const open = closed !== shown;
  const ids = { media: useId(), across: useId(), nest: useId() };
  const item = (i: NavItem, current: boolean) => (
    <NavLink key={i.id} item={i} current={current} className="si">
      <Icon name={i.icon} />
      <span className="nl">{i.sideLabel ?? i.label}</span>
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
      <SearchButton className="si side-search" tip="Search · Ctrl K">
        <Icon name="search" />
        <span className="nl">Search</span>
        <span className="kbd" aria-hidden="true">Ctrl K</span>
      </SearchButton>
      <MediumMenu items={items} medium={shown} pathname={pathname} />
      <span className="side-head" id={ids.media}>Media</span>
      <ul className="side-media" aria-labelledby={ids.media}>
        {inGroup(items, "media").map((m) => m.medium === shown ? (
          <li key={m.id} className="side-open" data-open={open}>
            <button type="button" className="mrow" aria-expanded={open} aria-controls={ids.nest}
              onClick={() => setClosed(open ? shown : null)}>
              <Icon name={m.icon} />
              <span className="nl">{m.label}</span>
              <Icon name="chevron-down" />
            </button>
            <div id={ids.nest} className="side-items">{set.map((i) => item(i, i === now))}</div>
          </li>
        ) : (
          <li key={m.id}>
            <NavLink item={m} current={false} className="mrow">
              <Icon name={m.icon} />
              <span className="nl">{m.label}</span>
              <Icon name="chevron-right" />
            </NavLink>
          </li>
        ))}
      </ul>
      <div role="group" aria-labelledby={ids.across} className="side-across">
        <span className="side-head" id={ids.across}>Across media</span>
        <div className="side-rule" aria-hidden="true" />
        {inGroup(items, "global").map((i) => item(i, pathname === i.href))}
      </div>
      <span className="grow" />
      {/* Search is the button under the wordmark, built or not: the item never draws a second one. */}
      {inGroup(items, "foot").filter((i) => i.id !== "search").map((i) => item(i, pathname === i.href))}
      <SyncPill />
    </nav>
  );
}
