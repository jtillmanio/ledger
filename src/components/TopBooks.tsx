"use client";

import { useRouter } from "next/navigation";
import Cover from "@/components/Cover";
import { Headphones } from "@/components/nav/Icons";
import ReorderList, { type MoveResult, type ReorderRow } from "@/components/ReorderList";
import type { RankChange } from "@/db/writes";

/** The first ten of a year's ranking are its top ten (D-101): read off the order, never stored. */
export const TOP_TEN = 10;

/** One row of a year on Top books: a read, ranked or not, as the page hands it over. */
export type TopRow = ReorderRow & {
  /** The read to rank; null for a read its status holds alone, ranked by its book (logged first). */
  readId: number | null;
  bookId: string;
  rank: number | null;
  /** *Author · Universe · Series #n* (task 2.2j). */
  sub: string;
  /** The finish month, *Mar*, on an exact finish; null otherwise. */
  month: string | null;
  listened: boolean;
  cover: string | null;
  pending: boolean;
};

export const TOP_HELP =
  "Space lifts a book, arrows move it, Space drops it, Esc cancels. Moving a book past the line changes your top ten; " +
  "moving one up from Not ranked yet ranks it.";

async function rankCall(method: "POST" | "DELETE", body: unknown) {
  const res = await fetch("/api/progress/book/rank", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rank ${method} ${res.status}`);
  return res.json() as Promise<{ change?: RankChange }>;
}

/** What a row draws between its handle and its menu: the cover with its rank, the title, the line. */
function Body({ r }: { r: TopRow }) {
  return (
    <>
      <span className="topcv">
        <Cover url={r.cover} pending={r.pending} />
        {r.rank !== null && <span className="rankno mono">{r.rank}</span>}
      </span>
      <span className="qbody">
        <span className="qtitle">
          {r.title}
          {r.listened && <> <Headphones label="Listened" /></>}
        </span>
        {(r.sub || r.month) && (
          <span className="qmeta">
            {r.sub && <span className="qplace">{r.sub}</span>}
            {r.month && <span className="mono qwords">{r.month}</span>}
          </span>
        )}
      </span>
    </>
  );
}

/**
 * A year's whole list (task 3.4b, D-101, D-122; mockup `top`): every read of
 * the year, ranked first, then *Not ranked yet*, in one list with 1.10's reorder
 * controls (`ReorderList`), so a book moves anywhere, across the divider after
 * the top ten too. Nothing is collapsed. A move ranks the read at the place it
 * lands (`/api/progress/book/rank`; the server clamps a place past the ranked
 * reads to the end), so moving an unranked read up ranks it, and its undo sends
 * the write's change back. A row's handle names its rank, or *not ranked yet*.
 */
export default function TopBooks({ rows, year }: { rows: TopRow[]; year: number }) {
  const ranked = rows.filter((r) => r.rank !== null).length;
  const unranked = rows.length - ranked;

  async function move(id: string, to: number): Promise<MoveResult> {
    const row = rows.find((r) => r.id === id)!;
    const target = row.readId !== null ? { readId: row.readId } : { bookId: row.bookId };
    const { change } = await rankCall("POST", { ...target, rank: to });
    if (!change) throw new Error("rank: no change");
    const now = change.after.find((r) => r.readId === change.readId)?.rank;
    return {
      detail: now ? `rank ${now}` : undefined,
      undo: async () => { await rankCall("DELETE", { change }); },
    };
  }

  // The divider after the top ten, then the heading over the unranked reads: each fixed at its
  // index, so a row moved past one changes which side it is on.
  function marker(i: number) {
    if (i === TOP_TEN && ranked > TOP_TEN) {
      return <span className="qmark rankdiv" role="separator" aria-label={`The top ten ends here`}>Beyond the top ten</span>;
    }
    if (i === ranked && unranked > 0) {
      return <h2 className="qmark rankhead">Not ranked yet <span className="n mono">{unranked}</span></h2>;
    }
    return null;
  }

  return (
    <ReorderList
      // A row's ordinal is its place in this list: a move to place n asks for rank n.
      rows={rows.map((r, i) => ({ ...r, ordinal: i + 1 }))}
      move={move}
      place={(r) => (r.rank !== null ? `rank ${r.rank}` : "not ranked yet")}
      marker={marker}
      label={`Best of ${year}`}
      help={TOP_HELP}
      renderBody={(r) => <Body r={r} />}
    />
  );
}

/** *No year* (R2-08): the reads with no date, listed, with no handle: there is no year to rank them in. */
export function UndatedReads({ rows }: { rows: TopRow[] }) {
  return (
    <ol className="queue" aria-label="Reads with no finish date">
      {rows.map((r) => (
        <li key={r.id} className="qrow undated"><Body r={r} /></li>
      ))}
    </ol>
  );
}

/**
 * The year switcher (task 3.4b): every year with a finished read, newest first,
 * then *No year* when an undated read exists. The choice goes in the URL
 * (`?year=2024`, `?year=none`), so a reload keeps it.
 */
export function YearSwitch({ years, undated, chosen }: { years: number[]; undated: boolean; chosen: number | null }) {
  const router = useRouter();
  return (
    <label className="topyear">
      <span className="sr-only">Year</span>
      <select
        className="select"
        value={chosen === null ? "none" : String(chosen)}
        onChange={(e) => router.push(`/books/top?year=${e.target.value}`)}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
        {undated && <option value="none">No year</option>}
      </select>
    </label>
  );
}
