import Link from "next/link";
import EmptySlate from "@/components/EmptySlate";
import { Icon } from "@/components/nav/Icons";
import { fillShare } from "@/components/WhereItSits";
import type { ProgressRow } from "@/db/queries";
import { finishedLabel, nestRows, rowHref, type MediumChip, type ProgressNode, type ProgressTab } from "@/lib/progress";

const MEDIUM_NAME = { books: "Books", comics: "Comics" } as const;

/**
 * One row of /progress (task 5.12, D-109): the medium's glyph, the kind, the name, `read / total` in mono, a
 * meter filled with --ready (D-26; a track has none, D-29) and, on *In the middle of*, the next thing named or, on *Completed*, the
 * finish's month. The name is a link where the thing has a page (`rowHref`), and its `row-link` overlay makes
 * the whole row the target; a row with no page yet is text. The figure is the visible text, so the meter says
 * nothing to a screen reader. A row's own rows nest beneath it in a list of their own (D-119).
 */
function Node({ node, tab }: { node: ProgressNode; tab: ProgressTab }) {
  const { row } = node;
  const href = rowHref(row, tab);
  const when = tab === "completed" ? finishedLabel(row.finishedMonth) : null;
  return (
    <li className="prog-li" data-kind={row.kind} data-medium={row.medium}>
      <div className="row prog-item">
        <span className="prog-glyph">
          <Icon name={row.medium === "comics" ? "book-open" : "book"} />
          <span className="sr-only">{MEDIUM_NAME[row.medium]}</span>
        </span>
        <div className="rb">
          <span className="rh">
            {href
              ? <Link prefetch={false} href={href} className="row-link rt prog-name">{row.name}</Link>
              : <span className="rt prog-name">{row.name}</span>}
            <span className="bdg dn prog-kind">{row.kind}</span>
            <span className="rm mono">{row.read} / {row.total}</span>
          </span>
          {/* A track is never drawn as one bar against the whole track (D-29): its `read / total` stays as text. */}
          {row.kind !== "track" && (
            <span className="emeter" aria-hidden="true"><i style={{ width: `${fillShare(row.read, row.total) * 100}%` }} /></span>
          )}
          {tab === "middle" && row.next && <div className="rs prog-next">Next: {row.next.label}</div>}
          {when && <div className="rs prog-next">{when}</div>}
        </div>
        {href && <span className="chev" aria-hidden="true">&#8250;</span>}
      </div>
      {node.children.length > 0 && (
        <ul className="prog-kids" aria-label={`In ${row.name}`}>
          {node.children.map((c) => <Node key={`${c.row.kind}-${c.row.id}`} node={c} tab={tab} />)}
        </ul>
      )}
    </li>
  );
}

/** The rows of one list, nested by their parents (D-119) in the order the query gave (newest read first). */
export default function ProgressRows({ rows, tab, label }: { rows: ProgressRow[]; tab: ProgressTab; label: string }) {
  return (
    <ul className="group prog-rows" aria-label={label}>
      {nestRows(rows).map((n) => <Node key={`${n.row.kind}-${n.row.id}`} node={n} tab={tab} />)}
    </ul>
  );
}

/**
 * An empty tab (task 5.12; UX floor, design § 10): calm, with the one action that fills it, never a bare
 * "nothing here". *In the middle of* asks for a Reading follow (D-108) or, on *Comics*, a started run; its
 * action is the Library, or the run list on *Comics*; *Completed* says what lands there.
 */
export function ProgressEmpty({ tab, medium }: { tab: ProgressTab; medium: MediumChip }) {
  const action = medium === "comics" ? { href: "/comics/runs", label: "Open Runs" } : { href: "/books/list", label: "Open the Library" };
  return tab === "middle" ? (
    <EmptySlate title="Nothing in the middle." href={action.href} label={action.label}>
      {medium === "comics" ? "Runs you start land here." : "Follow a series as Reading to see it here."}
    </EmptySlate>
  ) : (
    <EmptySlate title="Nothing completed yet." href={action.href} label={action.label}>
      A series, shelf or run with every book or issue read lands here.
    </EmptySlate>
  );
}
