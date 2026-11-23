import Link from "next/link";
import type { ReactNode } from "react";
import type { PlacePart } from "@/lib/format";

/** A series' own page (task 5.9): `/books/series/<id>`. */
export const seriesHref = (id: string) => `/books/series/${encodeURIComponent(id)}`;

/** How a universe's page lists its books (task 5.11, owner at plan): under their series, or in universe order. */
export type UniverseOrder = "series" | "flat";

/** An author's and a universe's own pages (task 5.11). */
export const authorHref = (id: string) => `/books/authors/${encodeURIComponent(id)}`;
export const universeHref = (id: string, order: UniverseOrder = "series") =>
  `/books/universes/${encodeURIComponent(id)}${order === "flat" ? "?order=flat" : ""}`;

/** The page a part names: its author's, universe's or series' own (tasks 5.9, 5.11). */
export function partHref(p: Pick<PlacePart, "kind" | "id">): string | null {
  if (p.id === null) return null;
  return p.kind === "series" ? seriesHref(p.id) : p.kind === "author" ? authorHref(p.id) : universeHref(p.id);
}

/**
 * A book's place line with its names as links (task 5.9, 3 of 3; TASK-125, F-38, D-134): the parts
 * `subParts` or `placeParts` cut, joined by ` · `, each name a link to its own page and a series' `#n` after
 * its link, so the link is named by the series alone. A part with no id is text. `plain` draws bare anchors,
 * the leanest markup a row can carry: the Library prints 500 rows into one page within its byte budget
 * (`scripts/perf/budget.json`, `library`), as its titles do (`SheetLinks`); elsewhere a `<Link>` that
 * doesn't prefetch. Draws nothing for no parts. Styled by its container (`globals.css`, *place links*).
 */
export default function BookPlace({ parts, plain = false }: { parts: PlacePart[]; plain?: boolean }) {
  // A flat list, the text between links merged into one string: no fragment per part, which the payload of
  // 500 rows would carry.
  const out: ReactNode[] = [];
  let text = "";
  parts.forEach((p, i) => {
    if (i > 0) text += " · ";
    const href = partHref(p);
    if (href === null) text += p.name;
    else {
      if (text) out.push(text);
      text = "";
      out.push(plain
        ? <a key={p.kind} href={href}>{p.name}</a>
        : <Link key={p.kind} href={href} prefetch={false}>{p.name}</Link>);
    }
    if (p.position) text += ` ${p.position}`;
  });
  if (text) out.push(text);
  return out;
}
