"use client";

import { useState } from "react";
import BookShelves from "@/components/BookShelves";
import { MoveBody } from "@/components/PlanPicker";
import { useRoutePane } from "@/components/RouteSheet";
import Sheet from "@/components/Sheet";

/**
 * A *Your record* button that opens a sheet from the book's (task 3.5b): inside the route sheet, a pane
 * in its place, with a back control naming the book (D-34, `useRoutePane`); on the full page, where
 * there is no sheet under it, an ordinary `Sheet` with the same body. Either way focus comes back here.
 */
function PaneButton({ title, heading, body, children }: {
  title: string; heading: string; body: () => React.ReactNode; children: React.ReactNode;
}) {
  const openPane = useRoutePane();
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className="btn sec sm detail-act" onClick={(e) => {
        const at = e.currentTarget;
        if (openPane) openPane({ heading, back: title, body: body(), opener: at });
        else setOpener(at);
      }}>
        {children}
      </button>
      {opener && <Sheet heading={heading} opener={opener} onClose={() => setOpener(null)}>{body()}</Sheet>}
    </>
  );
}

/** *Planned for*'s *Move* (task 3.5b): the plan picker, 2.3's write and Undo (`MoveBody`), for a to-read book. */
export function PlanMove({ bookId, title }: { bookId: string; title: string }) {
  return (
    <PaneButton title={title} heading="Move in your plan" body={() => <MoveBody bookId={bookId} title={title} />}>
      Move<span className="sr-only"> {title} in your plan</span>
    </PaneButton>
  );
}

/** *Shelves*' *Edit* (task 3.5b): every shelf, on or off for this book (`BookShelves`). `on` is its shelves' ids. */
export function ShelvesEdit({ bookId, title, on }: { bookId: string; title: string; on: readonly string[] }) {
  return (
    <PaneButton title={title} heading="Shelves" body={() => <BookShelves bookId={bookId} title={title} on={on} />}>
      Edit<span className="sr-only"> the shelves for {title}</span>
    </PaneButton>
  );
}
