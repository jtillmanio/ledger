"use client";

import BookPlace from "@/components/BookPlace";
import BookStatus from "@/components/BookStatus";
import { ArtCover } from "@/components/Cover";
import { Headphones } from "@/components/nav/Icons";
import ReorderList from "@/components/ReorderList";
import type { ListenNextBook } from "@/db/queries";
import { bookSub, listenGlyph, subParts, wordsK } from "@/lib/format";
import { listenCall } from "@/lib/listen-queue";
import { LISTEN_NEXT } from "@/lib/status-tabs";

/**
 * Up next's *Listen next* (task 5.14, F-59; mockup `status`): the listen queue
 * in its order, with 1.10's controls (`ReorderList`): the drag handle (Space
 * lifts, the arrows move, Space drops; a long press on touch) and the row
 * menu's *Move to top · Move up · Move down*, each one write with an undo that
 * moves it back, and *Remove from Listen next*, whose undo puts it back where it
 * was. A move sends the stored position of the row it lands on, so a hidden
 * row (a soft-deleted book keeps its place, TASK-106) never shifts. The places
 * named are the rows drawn, 1 to N. Each row carries the status control, so
 * *Listening* starts it from here, and that takes it off the queue.
 */
export default function ListenNext({ rows }: { rows: ListenNextBook[] }) {
  return (
    <ReorderList
      rows={rows}
      label={LISTEN_NEXT}
      scopeLabel={` in ${LISTEN_NEXT}`}
      helpId="dnd-help-listen"
      help={`Space lifts a row, arrows move it within ${LISTEN_NEXT}, Space drops it, Esc cancels.`}
      helpHidden
      move={async (id, to) => { await listenCall("PATCH", { bookId: id, to }); }}
      remove={{
        label: `Remove from ${LISTEN_NEXT}`,
        // Grey, as *Remove from shelf* is (MR-D16): the book stays in the library and the plan, and Undo puts it back.
        danger: false,
        toast: (title) => `Removed ${title} from ${LISTEN_NEXT}`,
        run: async (id) => {
          const { position } = await listenCall("DELETE", { bookId: id });
          return async () => { await listenCall("POST", { bookId: id, restore: position }); };
        },
      }}
      renderBody={(b) => {
        const glyph = listenGlyph(b.status, b.listened);
        return (
          <>
            <ArtCover url={b.cover_url} w={36} />
            <span className="qbody">
              <span className="qtitle">{b.title}{glyph && <> <Headphones label={glyph} /></>}</span>
              <span className="qmeta">
                {bookSub(b) && <span className="mono qplace"><BookPlace parts={subParts(b)} /></span>}
                {wordsK(b.word_count) && <span className="mono qwords">{wordsK(b.word_count)}</span>}
              </span>
              <BookStatus bookId={b.id} title={b.title} menu={false} glyph={false} listened={b.listened}
                {...(b.status && { status: b.status })} />
            </span>
          </>
        );
      }}
    />
  );
}
