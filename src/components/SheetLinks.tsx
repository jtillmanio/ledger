"use client";

import { useRouter } from "next/navigation";

/**
 * The Library's rows (task 3.5): each title is a plain `<a href="/book/{id}">`,
 * and this one wrapper turns a plain click on one into the soft navigation that
 * opens the book's sheet over the list, keeping its scroll. A `<Link>` on each
 * of 500 rows carried its props in the payload, over the route's byte budget
 * (docs/02-architecture.md, Performance budget); a plain anchor also works
 * before hydration, as the full page. A modified click (a new tab) is the
 * browser's.
 */
export default function SheetLinks({ className, children }: { className: string; children: React.ReactNode }) {
  const router = useRouter();
  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.<HTMLAnchorElement>(".row-title > a[href]");
    if (!a || !e.currentTarget.contains(a)) return;
    e.preventDefault();
    router.push(a.getAttribute("href")!, { scroll: false });
  }
  return <div className={className} onClick={onClick}>{children}</div>;
}
