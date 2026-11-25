import Link from "next/link";

/** The two sibling lists and the address of each (task 5.11b): a list's own page, never a panel of one page. */
const TABS = [
  { key: "series", name: "Series", href: "/books/series" },
  { key: "universes", name: "Universes", href: "/books/universes" },
] as const;

export type BookListTab = (typeof TABS)[number]["key"];

/**
 * *Series · Universes* (task 5.11b; mockup `series`, `universes`): the row that joins the two list pages, each
 * with its count in mono. Real links, one per page, with `aria-current="page"` on the open one: a tap pushes
 * the next page, so Back returns to the tab. It is styled as the `.tabs` strip (STYLE_GUIDE §9: 44px, the open
 * tab `--ink` 600, the underline sliding by `--i`) but is not `Tablist`, which is for one page's panels (its
 * links are `role="tab"` with `aria-selected`); here nothing is a panel, so the tabs are plain links in a `nav`.
 * Each count is derived by the page's own queries, never stored (hard rule 2).
 */
export default function BookListTabs({ current, counts }: { current: BookListTab; counts: Record<BookListTab, number> }) {
  const at = TABS.findIndex((t) => t.key === current);
  return (
    <nav className="tabs list-tabs" aria-label="Series and universes"
         style={{ "--i": at, "--n": TABS.length } as React.CSSProperties}>
      {TABS.map((t) => (
        <Link key={t.key} prefetch={false} href={t.href} aria-current={t.key === current ? "page" : undefined}>
          {t.name} <span className="n mono">{counts[t.key]}</span>
        </Link>
      ))}
      <span className="tab-ink" aria-hidden="true" />
    </nav>
  );
}
