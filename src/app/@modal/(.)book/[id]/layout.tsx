import RouteSheet from "@/components/RouteSheet";

/**
 * `/book/[id]` arrived at from a list (task 3.5; docs/04-design.md § 13): the
 * book as a sheet over it. The sheet is the layout, so it stays put while its
 * skeleton gives way to the book, and its focus and motion run once.
 */
export default function BookSheetLayout({ children }: { children: React.ReactNode }) {
  return <RouteSheet label="Book">{children}</RouteSheet>;
}
