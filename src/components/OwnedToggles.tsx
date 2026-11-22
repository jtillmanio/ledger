"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";

/** A copy you can say you own (task 5.17, D-132). The ebook is Calibre's (`calibre_id`, D-90), never toggled. */
export type OwnedCopy = "physical" | "audio";

const COPIES = ["physical", "audio"] as const;

/** Each toggle's words: the row menu's item either way, the sheet's button, and the toast after it. */
export const OWNED_COPY: Record<OwnedCopy, { own: string; disown: string; owned: string; notOwned: string; short: string }> = {
  physical: {
    own: "I own it on paper", disown: "I don't own it on paper",
    owned: "You own it on paper", notOwned: "You don't own it on paper", short: "Paper",
  },
  audio: {
    own: "I own the audiobook", disown: "I don't own the audiobook",
    owned: "You own the audiobook", notOwned: "You don't own the audiobook", short: "Audiobook",
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

/** Which of the two toggled copies a book has; anything else in the list (the ebook) is ignored. */
const held = (owned: readonly string[]): Record<OwnedCopy, boolean> => ({
  physical: owned.includes("physical"), audio: owned.includes("audio"),
});

/**
 * What you own of a book, toggled (task 5.17, D-132; lifted out of the Library
 * row's `⋯` for the book sheet, task 3.5b): the one write path both use. A
 * toggle shows at once, posts `POST /api/books/owned`, refreshes the page so
 * what the server draws (the row's sub-line, the sheet's *Owned* line) says it
 * without a reload, and pushes an undo toast whose Undo posts the server's
 * `prior` back. A failed write puts the toggle back and raises a failure toast
 * with *Retry*. `owned` is what the server says the book has; a refresh that
 * changes it resets what the toggles show.
 */
export function useOwnedToggle(bookId: string, owned: readonly string[], title: string) {
  const router = useRouter();
  const { push, fail } = useUndo();

  // What the toggles say you own: set at once on a toggle, then the server's after the refresh.
  const fromServer = owned.join(" ");
  const [seen, setSeen] = useState(fromServer);
  const [have, setHave] = useState(() => held(owned));
  if (fromServer !== seen) {
    setSeen(fromServer);
    setHave(held(owned));
  }
  const show = (format: OwnedCopy, value: boolean) => setHave((h) => ({ ...h, [format]: value }));

  async function toggle(format: OwnedCopy, next: boolean) {
    show(format, next);
    try {
      const prior = await postOwned(bookId, format, next);
      router.refresh();
      push({
        label: next ? OWNED_COPY[format].owned : OWNED_COPY[format].notOwned,
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

  return { have, toggle };
}

/**
 * The book sheet's two toggles on its *Owned* line (task 3.5b): *Paper* and
 * *Audiobook*, named *I own it on paper* and *I own the audiobook*, each
 * `aria-pressed` with whether you own it, through `useOwnedToggle`, the Library
 * row's own write. No toggle for the ebook: it is Calibre's (D-90). Focus stays
 * on the toggle; the toast's Undo hands it back there.
 */
export default function OwnedToggles({ bookId, title, owned }: { bookId: string; title: string; owned: readonly string[] }) {
  const { have, toggle } = useOwnedToggle(bookId, owned, title);
  return (
    <div className="opts owned-toggles" role="group" aria-label={`What you own of ${title}`}>
      {COPIES.map((format) => (
        <button key={format} type="button" className="opt" aria-pressed={have[format]}
          aria-label={OWNED_COPY[format].own} onClick={() => void toggle(format, !have[format])}>
          {OWNED_COPY[format].short}
        </button>
      ))}
    </div>
  );
}
