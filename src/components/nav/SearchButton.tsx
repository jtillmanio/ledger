import Link from "next/link";
import { Icon } from "./Icons";
import { NAV_ITEMS } from "./items";

// Search is 6.1: until the item is enabled the button is drawn and says why it does nothing.
const SEARCH = NAV_ITEMS.find((i) => i.id === "search");

/**
 * Search, on every nav (6.25, D-178): the phone bar's 44px button left of the gear, the tablet
 * rail's foot, the icon rail's icon above the switch and *Search · Ctrl K* under the sidebar's
 * wordmark. Each nav draws its own inside (`children`; the magnifier alone by default), named
 * *Search (Ctrl K)*; where the inside shows the shortcut too (the sidebar's *Search · Ctrl K*), it
 * is named by what it shows (`named`), because a name must hold the visible text (axe
 * label-content-name-mismatch). Ctrl K binds nothing until 6.1. Its own small file so the shell
 * draws it without importing the thumb bar's verbs and sheets.
 */
export default function SearchButton({ className = "iconbtn", tip, named = false, children = <Icon name="search" /> }: {
  className?: string;
  /** The icon rail's tooltip text (`data-tip`), where the label is hidden. */
  tip?: string;
  /** The children's text is the name (they show the shortcut), so no aria-label covers it. */
  named?: boolean;
  children?: React.ReactNode;
}) {
  const label = named ? undefined : "Search (Ctrl K)";
  if (SEARCH?.enabled) {
    return (
      <Link href={SEARCH.href} className={className} aria-label={label} title="Search (Ctrl K)" data-tip={tip}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} aria-label={label} aria-disabled="true" title="Search isn't built yet" data-tip={tip}>
      {children}
    </button>
  );
}
