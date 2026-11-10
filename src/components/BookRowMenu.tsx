"use client";

import { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Menu, { type MenuItem } from "@/components/Menu";

// Loaded on the first *Follow…* or *Plan for…*: a Library of 500 rows carries none of it until then.
const FollowSheet = dynamic(() => import("@/components/FollowSheet"), { ssr: false });
const PlanPickerSheet = dynamic(() => import("@/components/PlanPicker"), { ssr: false });

/**
 * A Library row's `⋯` (task 2.2c; mockup `follow`), named *More for <title>*,
 * whose items are *Plan for…* (task 2.3; a to-read book only), which opens the
 * plan picker, and *Follow…*, which opens the sheet of what the book belongs to.
 * `BookStatus` draws it with the book's live status, so a row costs no more
 * RSC and *Plan for…* follows a status change; the title is read from the
 * row's `.row-title`, as `BookStatus` reads it. Closing a sheet puts focus
 * back on the `⋯`.
 */
export default function BookRowMenu({ bookId, status = "to_read" }: { bookId: string; status?: string }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const [title, setTitle] = useState("this book");
  const [open, setOpen] = useState<{ sheet: "follow" | "plan"; opener: HTMLButtonElement } | null>(null);

  useLayoutEffect(() => {
    const shown = wrap.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (shown) setTitle(shown);
  }, []);

  const items: MenuItem[] = [
    ...(status === "to_read" ? [{ label: "Plan for…", onSelect: (opener: HTMLButtonElement) => setOpen({ sheet: "plan", opener }) }] : []),
    { label: "Follow…", onSelect: (opener) => setOpen({ sheet: "follow", opener }) },
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
