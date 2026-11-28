"use client";

import { usePathname } from "next/navigation";
import { mediumOf } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { currentItem, inGroup, mediumFor, mediumItems, NAV_ITEMS, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import SearchButton from "./SearchButton";
import SyncPill from "./SyncPill";

/**
 * The tablet's rail, 768–1023px (D-33; STYLE_GUIDE §14.5, §17.1; frame A8). Every medium fits by
 * name here, so all of them are one tap away (D-178): under the *L*, a `--sunk` well of every built
 * medium, 58 × 46, its icon over an 11px name, the current one a raised `--surface` pill. Then the
 * medium's items, each a 56px target (touch has no tooltips), a rule and the pages across media,
 * Inbox (its count a badge) and Progress; Search and Settings at the foot with sync. In a short
 * window the medium's screens scroll and the rest stays; under 740px tall the whole rail scrolls as
 * one column (globals.css). `inbox` is the server's count, in a Suspense so a
 * cold database never holds a skeleton back.
 */
export default function NavRail({ items = NAV_ITEMS, inbox }: { items?: NavItem[]; inbox: React.ReactNode }) {
  const pathname = usePathname();
  const here = mediumOf(pathname);
  const set = mediumItems(items, mediumFor(pathname));
  const now = currentItem(set, pathname);
  const item = (i: NavItem, current: boolean) => (
    <NavLink key={i.id} item={i} current={current} className="ri">
      <span className="pill"><Icon name={i.icon} /></span>
      <span className="rl">{i.label}</span>
      {i.id === "inbox" && inbox ? <span className="count">{inbox}</span> : null}
    </NavLink>
  );
  return (
    <nav aria-label="Main" className="rail">
      <span className="rail-word" aria-hidden="true">L</span>
      <div role="group" aria-label="Medium" className="rail-well">
        {inGroup(items, "media").map((m) => (
          <NavLink key={m.id} item={m} current={m.medium === here} className="rw">
            <Icon name={m.icon} />
            <span className="rl">{m.label}</span>
          </NavLink>
        ))}
      </div>
      {/* Only the medium's screens scroll in a short window: what spans media and the foot stay in view
          (under 740px tall the whole rail scrolls instead). */}
      <div className="rail-mid">
        <div className="rail-group">{set.map((i) => item(i, i === now))}</div>
      </div>
      <div className="rail-rule" aria-hidden="true" />
      <div className="rail-group">
        {inGroup(items, "global").map((i) => item(i, pathname === i.href))}
      </div>
      <span className="grow" />
      <div className="rail-group rail-foot">
        <SearchButton className="ri">
          <span className="pill"><Icon name="search" /></span>
          <span className="rl">Search</span>
        </SearchButton>
        {/* Search is the button above, built or not: the item never draws a second one. */}
        {inGroup(items, "foot").filter((i) => i.id !== "search").map((i) => item(i, pathname === i.href))}
      </div>
      <SyncPill />
    </nav>
  );
}
