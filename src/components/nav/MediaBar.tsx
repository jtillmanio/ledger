"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mediumOf } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { inGroup, NAV_ITEMS, type NavItem } from "./items";
import { NavLink } from "./NavLink";

/**
 * The phone's one bar, on every screen: the wordmark, the media switch and Settings' gear (one
 * tap from anywhere, 2.0). It is the same markup on every route; only `aria-current` follows the
 * path. It is the app header only (era and block meters are `.emeter`), and the one sticky element
 * at the top. From 768px the rail takes over and it is hidden.
 */
export default function MediaBar({ items = NAV_ITEMS }: { items?: NavItem[] }) {
  const pathname = usePathname();
  const here = mediumOf(pathname);
  const settings = inGroup(items, "foot").find((i) => i.id === "settings");
  return (
    <header className="bar">
      {/* / is a redirect (task 1.8c): a prefetch of it only fetches the page you are on or the other medium. */}
      <Link href="/" prefetch={false} className="home">Ledger</Link>
      <nav aria-label="Media">
        {inGroup(items, "media").map((m) => (
          <Link key={m.id} href={m.href} aria-current={m.medium === here ? "page" : undefined}>{m.label}</Link>
        ))}
      </nav>
      {settings && (
        <NavLink item={settings} current={pathname === settings.href} className="iconbtn gear">
          <Icon name="settings" />
          <span className="sr-only">{settings.label}</span>
        </NavLink>
      )}
    </header>
  );
}
