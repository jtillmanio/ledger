"use client";

import { useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Menu, { type MenuItem } from "@/components/Menu";
import { useUndo } from "@/components/Undo";
import { useQueueListen } from "@/lib/listen-queue";
import { queueable } from "@/lib/status-tabs";

// Loaded on the first *Follow…* or *Plan for…*: a Library of 500 rows carries none of it until then.
const FollowSheet = dynamic(() => import("@/components/FollowSheet"), { ssr: false });
const PlanPickerSheet = dynamic(() => import("@/components/PlanPicker"), { ssr: false });

/** A copy you can say you own (task 5.17, D-132). The ebook is Calibre's (`calibre_id`, D-90), never toggled. */
export type OwnedCopy = "physical" | "audio";

/** Each toggle's words: the menu item either way, and the toast after it. */
const COPY: Record<OwnedCopy, { own: string; disown: string; owned: string; notOwned: string }> = {
  physical: {
    own: "I own it on paper", disown: "I don't own it on paper",
    owned: "You own it on paper", notOwned: "You don't own it on paper",
  },
  audio: {
    own: "I own the audiobook", disown: "I don't own the audiobook",
    owned: "You own the audiobook", notOwned: "You don't own the audiobook",
  },
};

/** `POST /api/books/owned` (task 5.17, TASK-092): answers whether the book had the copy before. Throws when it didn't save. */
async function postOwned(bookId: string, format: OwnedCopy, owned: boolean): Promise<boolean> {
  const res = await fetch("/api/books/owned", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ bookId, format, owned }),
  });
  if (!res.ok) throw new Error(`owned ${format} failed: ${res.status}`);
  const { prior } = (await res.json()) as { prior: boolean };
  return prior;
}

const held = (owned: readonly OwnedCopy[]): Record<OwnedCopy, boolean> => ({
  physical: owned.includes("physical"), audio: owned.includes("audio"),
});

/**
 * A Library row's `⋯` (task 2.2c; mockup `follow`), named *More for <title>*,
 * whose items are *Plan for…* (task 2.3; a to-read book only), which opens the
 * plan picker, *Queue to listen* (task 5.14; not while Listening or Parked), which
 * puts it at the end of Up next's *Listen next* with an undo toast, *Follow…*, which
 * opens the sheet of what the book belongs to, and
 * what you own (task 5.17, D-132): *I own it on paper* and *I own the audiobook*,
 * whatever the status. Each says which way it goes (*I don't own it on paper*
 * once you do), is one write with an undo toast whose Undo posts the server's
 * `prior` back, and refreshes the page, so the row's sub-line says it without a
 * reload. `BookStatus` draws it with the book's live status and the copies the
 * row owns, so a row costs no more RSC and *Plan for…* follows a status change;
 * the title is read from the row's `.row-title`, as `BookStatus` reads it.
 * Closing a sheet puts focus back on the `⋯`.
 */
export default function BookRowMenu({ bookId, status = "to_read", owned = [] }: {
  bookId: string; status?: string; owned?: readonly OwnedCopy[];
}) {
  const router = useRouter();
  const { push, fail } = useUndo();
  const queueListen = useQueueListen();
  const wrap = useRef<HTMLSpanElement>(null);
  const [title, setTitle] = useState("this book");
  const [open, setOpen] = useState<{ sheet: "follow" | "plan"; opener: HTMLButtonElement } | null>(null);

  // What the menu says you own: set at once on a toggle, then the server's after the refresh.
  const fromServer = owned.join(" ");
  const [seen, setSeen] = useState(fromServer);
  const [have, setHave] = useState(() => held(owned));
  if (fromServer !== seen) {
    setSeen(fromServer);
    setHave(held(owned));
  }
  const show = (format: OwnedCopy, value: boolean) => setHave((h) => ({ ...h, [format]: value }));

  useLayoutEffect(() => {
    const shown = wrap.current?.closest(".book-row")?.querySelector(".row-title")?.textContent;
    if (shown) setTitle(shown);
  }, []);

  async function toggle(format: OwnedCopy, next: boolean) {
    show(format, next);
    try {
      const prior = await postOwned(bookId, format, next);
      router.refresh();
      push({
        label: next ? COPY[format].owned : COPY[format].notOwned,
        detail: title,
        undo: async () => {
          await postOwned(bookId, format, prior);
          show(format, prior);
          router.refresh();
        },
      });
    } catch {
      show(format, !next);
      fail({ label: `Couldn't save ${title}. Nothing changed.`, retry: () => void toggle(format, next) });
    }
  }

  const items: MenuItem[] = [
    ...(status === "to_read" ? [{ label: "Plan for…", onSelect: (opener: HTMLButtonElement) => setOpen({ sheet: "plan", opener }) }] : []),
    // The listen queue (task 5.14): at its end, an undo toast; not while Listening or Parked.
    ...(queueable(status) ? [{ label: "Queue to listen", onSelect: () => void queueListen(bookId, title) }] : []),
    { label: "Follow…", onSelect: (opener) => setOpen({ sheet: "follow", opener }) },
    ...(["physical", "audio"] as const).map((format): MenuItem => ({
      label: have[format] ? COPY[format].disown : COPY[format].own,
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
