"use client";

import { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Menu, { type MenuItem } from "@/components/Menu";
import { OWNED_COPY, useOwnedToggle, type OwnedCopy } from "@/components/OwnedToggles";
import { useQueueListen } from "@/lib/listen-queue";
import { parkable } from "@/lib/parked";
import { queueable } from "@/lib/status-tabs";

// Loaded on the first *Follow…* or *Plan for…*: a Library of 500 rows carries none of it until then.
const FollowSheet = dynamic(() => import("@/components/FollowSheet"), { ssr: false });
const PlanPickerSheet = dynamic(() => import("@/components/PlanPicker"), { ssr: false });

export type { OwnedCopy };

/**
 * A Library row's `⋯` (task 2.2c; mockup `follow`), named *More for <title>*,
 * whose items are *Plan for…* (task 2.3; a to-read book only), which opens the
 * plan picker, *Queue to listen* (task 5.14; not while Listening or Parked), which
 * puts it at the end of Up next's *Listen next* with an undo toast, *Park* (task 5.15;
 * To read, Reading or Listening), which is `BookStatus`'s own park handed down as
 * `onPark`, one write and one Undo whichever route, *Follow…*, which
 * opens the sheet of what the book belongs to, and
 * what you own (task 5.17, D-132): *I own it on paper* and *I own the audiobook*,
 * whatever the status. Each says which way it goes (*I don't own it on paper*
 * once you do), is one write (`useOwnedToggle`, which the book sheet's toggles
 * share, task 3.5b) with an undo toast whose Undo posts the server's
 * `prior` back, and refreshes the page, so the row's sub-line says it without a
 * reload. `BookStatus` draws it with the book's live status and the copies the
 * row owns, so a row costs no more RSC and *Plan for…* follows a status change;
 * the title is read from the row's `.row-title`, as `BookStatus` reads it.
 * Closing a sheet puts focus back on the `⋯`.
 */
export default function BookRowMenu({ bookId, status = "to_read", owned = [], onPark }: {
  bookId: string; status?: string; owned?: readonly OwnedCopy[];
  /** Parks the book through the status control's write (task 5.15); `opener` is the `⋯`. Left out, no *Park*. */
  onPark?: (opener: HTMLButtonElement) => void;
}) {
  const queueListen = useQueueListen();
  const wrap = useRef<HTMLSpanElement>(null);
  const [title, setTitle] = useState("this book");
  const [open, setOpen] = useState<{ sheet: "follow" | "plan"; opener: HTMLButtonElement } | null>(null);

  useLayoutEffect(() => {
    const shown = wrap.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (shown) setTitle(shown);
  }, []);

  // What you own: the one toggle the book sheet uses too (task 3.5b).
  const { have, toggle } = useOwnedToggle(bookId, owned, title);

  const items: MenuItem[] = [
    ...(status === "to_read" ? [{ label: "Plan for…", onSelect: (opener: HTMLButtonElement) => setOpen({ sheet: "plan", opener }) }] : []),
    // The listen queue (task 5.14): at its end, an undo toast; not while Listening or Parked.
    ...(queueable(status) ? [{ label: "Queue to listen", onSelect: () => void queueListen(bookId, title) }] : []),
    // Put away on purpose (task 5.15): the status control's write, so its toast and Undo are the same.
    ...(onPark && parkable(status) ? [{ label: "Park", onSelect: (opener: HTMLButtonElement) => onPark(opener) }] : []),
    { label: "Follow…", onSelect: (opener) => setOpen({ sheet: "follow", opener }) },
    ...(["physical", "audio"] as const).map((format): MenuItem => ({
      label: have[format] ? OWNED_COPY[format].disown : OWNED_COPY[format].own,
      onSelect: () => void toggle(format, !have[format]),
    })),
  ];

  return (
    <span ref={wrap} className="row-more">
      <Menu label={`More for ${title}`} className="row-more-btn" items={items}>
        ⋯
      </Menu>
      {open?.sheet === "follow" && <FollowSheet bookId={bookId} title={title} opener={open.opener} onClose={() => setOpen(null)} />}
      {open?.sheet === "plan" && <PlanPickerSheet bookId={bookId} title={title} opener={open.opener} onClose={() => setOpen(null)} />}
    </span>
  );
}
