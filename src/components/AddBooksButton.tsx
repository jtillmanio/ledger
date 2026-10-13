"use client";

import { useState } from "react";
import AddBooks from "@/components/AddBooks";
import Sheet, { useSheetClose } from "@/components/Sheet";
import type { Target } from "@/lib/book-add";

/**
 * Opens Add books as a sheet over the page (task 1.4c), with its destination
 * chosen: Someday from Books and its *To read* filter; a shelf from a shelf's
 * *+ Add to shelf* (Phase 5). The sheet asks for nothing until you use it, and
 * focus comes back here however it closes (docs/TASKS.md § *Focus returns
 * where it came from*).
 */
export default function AddBooksButton({ target = { kind: "someday" }, label = "Add books", className = "btn sec sm" }: {
  target?: Target;
  label?: string;
  className?: string;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={(e) => setOpener(e.currentTarget)}>
        {label}
      </button>
      {opener && (
        <Sheet heading="Add books" opener={opener} onClose={() => setOpener(null)}>
          <InSheet target={target} />
        </Sheet>
      )}
    </>
  );
}

function InSheet({ target }: { target: Target }) {
  return <AddBooks initial={target} close={useSheetClose()} />;
}
