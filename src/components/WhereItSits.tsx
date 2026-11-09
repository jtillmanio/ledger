import type { Level } from "@/db/queries";

/** How much of the track a level fills: read over total, whole at most; nothing for an empty total. */
export function fillShare(read: number, total: number): number {
  return total > 0 ? Math.min(1, read / total) : 0;
}

/**
 * Where the book sits (task 2.2g, D-119): under Now's band, one thin row per level the book
 * belongs to, outermost first: the name, a meter filled with --ready, and `read / total` in mono.
 * Position, not a follow (D-108): a level you don't follow draws as one you do. Read-only and not
 * links. The figure is the visible text, so the meter itself says nothing to a screen reader.
 * Renders nothing for a book with no levels: never an empty row.
 */
export default function WhereItSits({ levels }: { levels: Level[] }) {
  if (levels.length === 0) return null;
  return (
    <ul className="now-where" aria-label="Where this book sits">
      {levels.map((l) => (
        <li key={`${l.kind}-${l.id}`}>
          <span className="now-where-name">{l.name}</span>
          <span className="emeter" aria-hidden="true"><i style={{ width: `${fillShare(l.read, l.total) * 100}%` }} /></span>
          <span className="now-where-n mono">{l.read} / {l.total}</span>
        </li>
      ))}
    </ul>
  );
}
