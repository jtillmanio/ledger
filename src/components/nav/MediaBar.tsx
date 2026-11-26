"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { mediumOf, type Medium } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { inGroup, NAV_ITEMS, type NavItem } from "./items";
import { NavLink } from "./NavLink";
import SearchButton from "./SearchButton";
import TabRow from "./TabRow";

// Loaded when the button is first pressed (and fetched on the press's pointerdown or focus), so the
// shell every route loads carries the button, not the sheet.
const MediumSheet = dynamic(() => import("./MediumSheet"), { ssr: false });
const preload = () => void import("./MediumSheet");

/**
 * The phone's one bar, on every screen (6.25, D-178, frame A5): the wordmark, the current medium as
 * a button that opens *Switch medium*, search, and Settings' gear (one tap from anywhere, 2.0). The
 * rule depends on width, not on the count, so a fourth and fifth medium fit: at 360px the bar is
 * 264px whatever the medium (STYLE_GUIDE §17.1). Below it, inside the same sticky box, the tab row
 * lists the medium's screens, then the pages across media (2.2i, D-120). It is the app header only
 * (era and block meters are `.emeter`), and the one sticky element at the top. From 768px the rail
 * takes over and it is hidden.
 */
export default function MediaBar({ items = NAV_ITEMS, lastMedium = null, inbox = null }: {
  items?: NavItem[]; lastMedium?: Medium | null;
  /** The shell's streamed Inbox count, for the tab row's Inbox. */
  inbox?: React.ReactNode;
}) {
  const pathname = usePathname();
  // The medium you are in, else the one the tab row draws on a screen under none (2.2i).
  const medium = mediumOf(pathname) ?? lastMedium;
  const settings = inGroup(items, "foot").find((i) => i.id === "settings");
  return (
    <header className="bar">
      {/* / is a redirect (task 1.8c): a prefetch of it only fetches the page you are on or the other medium. */}
      <Link href="/" prefetch={false} className="home">Ledger</Link>
      <MediumButton items={items} medium={medium} pathname={pathname} />
      <SearchButton className="iconbtn search" />
      {settings && (
        <NavLink item={settings} current={pathname === settings.href} className="iconbtn gear">
          <Icon name="settings" />
          <span className="sr-only">{settings.label}</span>
        </NavLink>
      )}
      <TabRow items={items} medium={medium} pathname={pathname} inbox={inbox} />
    </header>
  );
}

/**
 * The current medium as a 44px button with a chevron, underlined in its `--m-*` (data identity, beside
 * its name), named "Books, switch medium". Before any medium is known (a first visit to /inbox) it
 * reads *Media*, in no medium's colour.
 */
function MediumButton({ items, medium, pathname }: { items: NavItem[]; medium: Medium | null; pathname: string }) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const label = inGroup(items, "media").find((m) => m.medium === medium)?.label ?? "Media";
  return (
    <>
      {/* Named by aria-label: the button is a flex box, so text spread over its children reads "Books , switch medium". */}
      <button type="button" className="medbtn" data-medium={medium ?? undefined} aria-label={`${label}, switch medium`}
        aria-haspopup="dialog" aria-expanded={opener !== null}
        onPointerDown={preload} onFocus={preload}
        onClick={(e) => setOpener(e.currentTarget)}>
        <span className="medbtn-name">{label}</span>
        <Icon name="chevron-down" />
      </button>
      {opener && (
        <MediumSheet items={items} medium={medium} pathname={pathname} opener={opener} onClose={() => setOpener(null)} />
      )}
    </>
  );
}
