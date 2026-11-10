"use client";

import { useState } from "react";
import AddBooks from "@/components/AddBooks";
import Sheet, { useSheetClose } from "@/components/Sheet";
import type { Target } from "@/lib/book-add";

/**
 * Opens Add books as a sheet over the page (task 1.4c), with its destination
 * chosen: Someday from Books and its *To read* filter; a shelf from a shelf's
 * *+ Add to shelf* (Phase 5); a quarter from the empty Up next's *Plan a book*
 * (task 2.3). The sheet asks for nothing until you use it, and focus comes back
 * here however it closes (docs/04-design.md § 10, *Focus returns where it came
 * from*). The plan picker is a step inside it, which takes the sheet's heading
 * while it is open.
 */
export default function AddBooksButton({ target = { kind: "someday" }, label = "Add books", className = "btn sec sm" }: {
  target?: Target;
  label?: string;
  className?: string;
}) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [heading, setHeading] = useState("Add books");
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={(e) => setOpener(e.currentTarget)}>
        {label}
      </button>
      {opener && (
        <Sheet heading={heading} opener={opener} onClose={() => { setOpener(null); setHeading("Add books"); }}>
          <InSheet target={target} onHeading={setHeading} />
        </Sheet>
      )}
    </>
  );
}

function InSheet({ target, onHeading }: { target: Target; onHeading: (heading: string) => void }) {
  return <AddBooks initial={target} close={useSheetClose()} onHeading={onHeading} />;
}
