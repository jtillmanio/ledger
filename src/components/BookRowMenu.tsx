"use client";

import { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Menu from "@/components/Menu";

// Loaded on the first *Follow…*: a Library of 500 rows carries none of it until then.
const FollowSheet = dynamic(() => import("@/components/FollowSheet"), { ssr: false });

/**
 * A Library row's `⋯` (task 2.2c; mockup `follow`), named *More for <title>*,
 * whose one item, *Follow…*, opens the sheet of what the book belongs to.
 * `BookStatus` draws it, so a row costs no more RSC; the title is read from
 * the row's `.row-title`, as `BookStatus` reads it. Closing the sheet puts
 * focus back on the `⋯`.
 */
export default function BookRowMenu({ bookId }: { bookId: string }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const [title, setTitle] = useState("this book");
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    const shown = wrap.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (shown) setTitle(shown);
  }, []);

  return (
    <span ref={wrap} className="row-more">
      <Menu label={`More for ${title}`} className="row-more-btn"
        items={[{ label: "Follow…", onSelect: (trigger) => setOpener(trigger) }]}>
        ⋯
      </Menu>
      {opener && <FollowSheet bookId={bookId} title={title} opener={opener} onClose={() => setOpener(null)} />}
    </span>
  );
}
