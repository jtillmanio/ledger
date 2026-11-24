import Link from "next/link";
import { partHref } from "@/components/BookPlace";
import type { Level } from "@/db/queries";

/** How much of the track a level fills: read over total, whole at most; nothing for an empty total. */
export function fillShare(read: number, total: number): number {
  return total > 0 ? Math.min(1, read / total) : 0;
}

/** Each level's kind key, a word: the CSS draws it in capitals, so a screen reader reads the word, not letters. */
const KEY: Record<Level["kind"], string> = { universe: "Universe", author: "Author", series: "Series", subseries: "Subseries" };

/**
 * Where the book sits (task 2.2g, D-119; redrawn by 6.21 from frames E1–E6 of `design/MR-E-Review-1.dc.html`,
 * MR-D19): inside Now's band, one row per level the book belongs to, outermost first. Each row is a ladder
 * rung: the level's kind key in mono, each deeper level stepped in once more with a hairline elbow; the name;
 * a meter filled with --ready; and `read / total` in mono. The columns are one grid (globals.css), so every
 * row's meter and count line up.
 * Position, not a follow (D-108): a level you don't follow draws as one you do. The universe, author and
 * series names link to their own pages (tasks 5.9, 5.11; TASK-125); a subseries has none, so its name is
 * text. The figure is the visible text, so the meter and the elbow say nothing to a screen reader.
 * Renders nothing for a book with no levels: never an empty row.
 */
export default function WhereItSits({ levels }: { levels: Level[] }) {
  if (levels.length === 0) return null;
  return (
    <ul className="now-where" aria-label="Where this book sits">
      {levels.map((l, depth) => {
        const href = l.kind === "subseries" ? null : partHref({ kind: l.kind, id: l.id });
        return (
          <li key={`${l.kind}-${l.id}`} data-depth={depth}>
            <span className="now-where-key mono">{depth > 0 && <span className="now-where-elbow" aria-hidden="true" />}{KEY[l.kind]}</span>
            <span className="now-where-name">{href ? <Link href={href} prefetch={false}>{l.name}</Link> : l.name}</span>
            <span className="emeter" aria-hidden="true"><i style={{ width: `${fillShare(l.read, l.total) * 100}%` }} /></span>
            <span className="now-where-n mono">{l.read} / {l.total}</span>
          </li>
        );
      })}
    </ul>
  );
}
