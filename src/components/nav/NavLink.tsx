"use client";

import Link from "next/link";
import type { NavItem } from "./items";

/**
 * One nav entry. A route handler is a plain `<a>`: a `<Link>` prefetches, and a
 * prefetch of a handler runs it (task 0.9). `data-tip` is the sidebar's tooltip
 * text, shown only where the label is hidden (the 64px rail).
 */
export function NavLink({ item, current, className, children }: {
  item: NavItem; current: boolean; className: string; children: React.ReactNode;
}) {
  const props = { className, "aria-current": current ? ("page" as const) : undefined, "data-tip": item.label };
  return item.plain
    ? <a href={item.href} {...props}>{children}</a>
    : <Link href={item.href} {...props}>{children}</Link>;
}
