import Link from "next/link";
import { Icon } from "./Icons";
import { NAV_ITEMS } from "./items";

// Search is 6.1: until the item is enabled the button is drawn and says why it does nothing.
const SEARCH = NAV_ITEMS.find((i) => i.id === "search");

/**
 * Search, on every nav (6.25, D-178): the phone bar's 44px button left of the gear, the tablet
 * rail's foot, the icon rail's icon above the switch and *Search · Ctrl K* under the sidebar's
 * wordmark. Each nav draws its own inside (`children`; the magnifier alone by default) and the name
 * is always *Search (Ctrl K)*. Ctrl K binds nothing until 6.1. Its own small file so the shell
 * draws it without importing the thumb bar's verbs and sheets.
 */
export default function SearchButton({ className = "iconbtn", tip, children = <Icon name="search" /> }: {
  className?: string;
  /** The icon rail's tooltip text (`data-tip`), where the label is hidden. */
  tip?: string;
  children?: React.ReactNode;
}) {
  if (SEARCH?.enabled) {
    return (
      <Link href={SEARCH.href} className={className} aria-label="Search (Ctrl K)" title="Search (Ctrl K)" data-tip={tip}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={className} aria-label="Search (Ctrl K)" aria-disabled="true" title="Search isn't built yet" data-tip={tip}>
      {children}
    </button>
  );
}
