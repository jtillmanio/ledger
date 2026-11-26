import Link from "next/link";
import { Icon } from "./Icons";
import { NAV_ITEMS } from "./items";

// Search is 6.1: until the item is enabled the button is drawn and says why it does nothing.
const SEARCH = NAV_ITEMS.find((i) => i.id === "search");

/**
 * Search's 44px button: the phone bar's, left of the gear, on every screen (6.25, D-178), and the
 * desktop page header's slot until TASK-149 moves it under the wordmark. Its own small file so the
 * shell draws it without importing the thumb bar's verbs and sheets.
 */
export default function SearchButton({ className = "iconbtn" }: { className?: string }) {
  if (SEARCH?.enabled) {
    return (
      <Link href={SEARCH.href} className={className} aria-label="Search (Ctrl K)" title="Search (Ctrl K)">
        <Icon name="search" />
      </Link>
    );
  }
  return (
    <button type="button" className={className} aria-label="Search (Ctrl K)" aria-disabled="true" title="Search isn't built yet">
      <Icon name="search" />
    </button>
  );
}
