"use client";

import { useState } from "react";
import Cover from "@/components/Cover";
import { FollowOptions, useFollowChange } from "@/components/FollowOptions";
import InlineText, { type TextSave } from "@/components/InlineText";
import ReorderList, { type MoveResult, type ReorderRow } from "@/components/ReorderList";
import type { Grouping, ShelfRow } from "@/db/queries";
import type { FollowState } from "@/db/writes";

/**
 * A shelf's page, its client parts (task 5.1; TASK-095's routes). Every write
 * goes through `PATCH /api/shelves/<id>`, which answers `{ change }`; sending
 * `{ undo: change }` back puts things as they were (409 when something changed
 * since), so each Undo is the write's own.
 */

/** A write to the shelf, answered with its own undo; rejects when it didn't save. */
async function shelfWrite(shelfId: string, body: unknown): Promise<{ undo: () => Promise<void> }> {
  const call = async (b: unknown) => {
    const res = await fetch(`/api/shelves/${encodeURIComponent(shelfId)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b),
    });
    if (!res.ok) throw new Error(`shelf PATCH ${res.status}`);
    return res.json() as Promise<{ change?: unknown }>;
  };
  const { change } = await call(body);
  if (!change) throw new Error("shelf PATCH: no change");
  return { undo: async () => { await call({ undo: change }); } };
}

/** How a book's status reads on its row: glyph and text, never colour alone. */
const STATUS: Record<string, string> = {
  read: "✓ Read", reading: "◐ Reading", listening: "◐ Listening", dnf: "DNF",
};

type Row = ReorderRow & ShelfRow;

/**
 * The shelf's books in shelf order, with 1.10's reorder controls (`ReorderList`:
 * a keyboard-operable handle, *Move to top · Move up · Move down*, drag with a
 * long-press route for touch). A row's ordinal is its place among the live
 * books, which is what a move's `to` counts, and each move's undo sends its
 * change back, so the whole order before it returns. Under each book, the note
 * that says why it is on this shelf, edited in place (`InlineText`); the same
 * book on another shelf keeps its own.
 */
export default function ShelfBooks({ shelfId, shelfName, books }: { shelfId: string; shelfName: string; books: ShelfRow[] }) {
  async function move(id: string, to: number): Promise<MoveResult> {
    return shelfWrite(shelfId, { bookId: id, to });
  }

  const note = (bookId: string): TextSave => (text) => shelfWrite(shelfId, { bookId, note: text });

  return (
    <ReorderList<Row>
      rows={books.map((b, i) => ({ ...b, ordinal: i + 1 }))}
      move={move}
      label={`Books on ${shelfName}`}
      renderBody={(r) => (
        <>
          <Cover url={r.coverUrl} pending={false} />
          <span className="qbody">
            <span className="qtitle">{r.title}</span>
            {(r.author || (r.status && STATUS[r.status])) && (
              <span className="qmeta">
                {r.author && <span className="qplace">{r.author}</span>}
                {r.status && STATUS[r.status] && <span className="shelf-status">{STATUS[r.status]}</span>}
              </span>
            )}
            <InlineText
              value={r.note}
              label={`Note on ${r.title}`}
              add={{ text: "Add a note", context: `on ${r.title}` }}
              saved={`Saved the note on ${r.title}`}
              textClass="shelf-note"
              save={note(r.id)}
            />
          </span>
        </>
      )}
    />
  );
}

/**
 * What the shelf is for, under its name: drawn only when there is one, else a
 * quiet *Add a description*, never an empty line (the roadmap's Check).
 */
export function ShelfDescription({ shelfId, name, description }: { shelfId: string; name: string; description: string | null }) {
  return (
    <InlineText
      value={description}
      label={`Description of ${name}`}
      add={{ text: "Add a description", context: `of ${name}` }}
      saved={`Saved the description of ${name}`}
      textClass="shelf-desc"
      save={(text) => shelfWrite(shelfId, { description: text })}
    />
  );
}

/** *Reading · Tracking · Not following* for the shelf (task 2.2c), as the *Follow…* sheet draws it. */
export function ShelfFollow({ grouping }: { grouping: Grouping }) {
  const [g, setG] = useState(grouping);
  const [seen, setSeen] = useState(grouping);
  if (grouping !== seen) {
    setSeen(grouping);
    setG(grouping);
  }
  const change = useFollowChange((_g, state: FollowState | null) => setG((x) => ({ ...x, state })));
  return <FollowOptions g={g} onChange={(state) => void change(g, state)} />;
}
