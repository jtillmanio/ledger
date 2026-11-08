// The one list every bar draws from (R1-06): the phone's media bar, the
// tablet's rail and the desktop sidebar. An item with `enabled: false` is
// rendered nowhere, so the nav never leads to a screen that does not exist
// yet; the task that builds the screen flips the flag (and its check includes
// the flip). Hue identifies data, never navigation: icons are neutral.
import { mediumOf, type Medium } from "@/lib/last-medium";
import { addHref } from "@/lib/last-run";

export type NavGroup = "media" | "medium" | "global" | "foot";
export type IconName =
  | "layout-dashboard" | "list-checks" | "layers" | "route" | "plus" | "calendar-range" | "library"
  | "list-ordered" | "book-open" | "book" | "book-copy" | "tv" | "inbox" | "download" | "search" | "settings" | "film";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  enabled: boolean;
  group: NavGroup;
  /** The medium this item belongs to: a switch entry for itself, a sidebar item for its set. */
  medium?: Medium;
  /** The medium's dashboard: current on its own path only, never on a longer one. */
  dash?: boolean;
  /** The item that holds the medium's pages no other item claims (a run's own pages are under Runs). */
  holdsDetail?: boolean;
  /** A route handler: a plain `<a>`, because a `<Link>` prefetch would run it (task 0.9). */
  plain?: boolean;
  /** Never prefetched: the screen's queries wait for the tap (task 1.3c). */
  noPrefetch?: boolean;
  /** Screens this item is current on besides its own href (comics Add: any run's Add issues). */
  currentOn?: RegExp;
}

export const NAV_ITEMS: NavItem[] = [
  // The media switch: each medium's dashboard (Books since task 2.2).
  { id: "comics", label: "Comics", href: "/comics", icon: "book-open", enabled: true, group: "media", medium: "comics" },
  { id: "books", label: "Books", href: "/books", icon: "book", enabled: true, group: "media", medium: "books" },
  { id: "watch", label: "Watch", href: "/watch", icon: "tv", enabled: true, group: "media", medium: "watch" },

  { id: "comics-dash", label: "Dashboard", href: "/comics", icon: "layout-dashboard", enabled: true, group: "medium", medium: "comics", dash: true },
  { id: "comics-status", label: "Status", href: "/comics/status", icon: "list-checks", enabled: true, group: "medium", medium: "comics" },
  { id: "comics-runs", label: "Runs", href: "/comics/runs", icon: "layers", enabled: true, group: "medium", medium: "comics", holdsDetail: true },
  { id: "comics-tracks", label: "Tracks", href: "/comics/tracks", icon: "route", enabled: false, group: "medium", medium: "comics" },
  // No comics route adds without a run: the shell swaps in the run you last added to (roadmap
  // 1.19, withLastRun), and before any add this lands on the run list.
  {
    id: "comics-add", label: "Add", href: "/comics/runs", icon: "plus", enabled: true, group: "medium", medium: "comics",
    noPrefetch: true, currentOn: /^\/comics\/[^/]+\/add$/,
  },

  // The books dashboard (task 2.2).
  { id: "books-dash", label: "Dashboard", href: "/books", icon: "layout-dashboard", enabled: true, group: "medium", medium: "books", dash: true },
  { id: "books-status", label: "Status", href: "/books/status", icon: "list-checks", enabled: true, group: "medium", medium: "books" },
  // The master list, named and given its own page (task 2.2e, D-110). `library` is Shelves' icon.
  { id: "books-library", label: "Library", href: "/books/list", icon: "book-copy", enabled: true, group: "medium", medium: "books" },
  { id: "books-plan", label: "Plan", href: "/books/plan", icon: "calendar-range", enabled: false, group: "medium", medium: "books" },
  { id: "books-shelves", label: "Shelves", href: "/books/shelves", icon: "library", enabled: false, group: "medium", medium: "books" },
  { id: "books-top", label: "Top", href: "/books/top", icon: "list-ordered", enabled: false, group: "medium", medium: "books" },
  { id: "books-add", label: "Add", href: "/books/add", icon: "plus", enabled: true, group: "medium", medium: "books" },

  { id: "watch-dash", label: "Dashboard", href: "/watch", icon: "layout-dashboard", enabled: true, group: "medium", medium: "watch", dash: true },
  { id: "watch-status", label: "Status", href: "/watch/status", icon: "list-checks", enabled: false, group: "medium", medium: "watch" },
  { id: "watch-franchises", label: "Franchises", href: "/watch/franchises", icon: "film", enabled: false, group: "medium", medium: "watch" },
  { id: "watch-add", label: "Add", href: "/watch/add", icon: "plus", enabled: false, group: "medium", medium: "watch" },

  { id: "inbox", label: "Inbox", href: "/inbox", icon: "inbox", enabled: true, group: "global" },

  // Search is 6.1. Settings (2.0) is the rail's and the sidebar's foot and, on the phone, the gear at
  // the bar's right end; Export moved into it as *Export everything* (a plain <a href="/api/export">
  // there, never a <Link>: owner, 2026-10-19 and 2026-11-04).
  { id: "search", label: "Search", href: "/search", icon: "search", enabled: false, group: "foot" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings", enabled: true, group: "foot" },
];

/** The items with comics Add aimed at `runId`'s Add issues, or at the run list for none (1.19). */
export function withLastRun(items: NavItem[], runId: string | null): NavItem[] {
  return items.map((i) => (i.id === "comics-add" ? { ...i, href: addHref(runId) } : i));
}

/** What every bar draws: the enabled items, in order. */
export function visibleItems(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.filter((i) => i.enabled);
}

export const inGroup = (items: NavItem[], group: NavGroup) => visibleItems(items).filter((i) => i.group === group);

/** The medium a screen is under, or comics: the rail and sidebar need a set to draw on /inbox too. */
export const mediumFor = (pathname: string): Medium => mediumOf(pathname) ?? "comics";

export const mediumItems = (items: NavItem[], medium: Medium) =>
  inGroup(items, "medium").filter((i) => i.medium === medium);

/**
 * What the phone's tab row draws (2.2i, D-120): the medium's enabled items, then Inbox. With no
 * medium yet (a hard load of /inbox or /settings, before the server's last medium streams in)
 * it is Inbox alone, so the row never flashes the wrong medium's screens.
 */
export const tabRowItems = (items: NavItem[], medium: Medium | null): NavItem[] => [
  ...(medium ? mediumItems(items, medium) : []),
  ...inGroup(items, "global").filter((i) => i.id === "inbox"),
];

/**
 * The item `pathname` is on: the exact match, else the item that claims it (`currentOn`), else
 * the longest item it is under (the dashboard excepted: it is every page's prefix), else the item
 * that holds the medium's detail pages.
 */
export function currentItem(list: NavItem[], pathname: string): NavItem | undefined {
  const exact = list.find((i) => i.href === pathname) ?? list.find((i) => i.currentOn?.test(pathname));
  if (exact) return exact;
  const under = list
    .filter((i) => !i.dash && pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (under) return under;
  return list.find((i) => i.holdsDetail && mediumOf(pathname) === i.medium);
}
