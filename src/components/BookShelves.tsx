"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";

type Shelf = { id: string; name: string };

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * On a shelf through Add books' own write (`POST /api/books` with a shelf destination, task 1.4c): one
 * `shelf_books` row at the shelf's end. Answers its undo (`DELETE /api/books` with what the add answered),
 * or null when the book was on the shelf already (another tab put it there): nothing written, nothing to undo.
 */
async function putOn(bookId: string, shelfId: string): Promise<(() => Promise<void>) | null> {
  const res = await fetch("/api/books", {
    method: "POST", headers: JSON_HEADERS,
    body: JSON.stringify({ item: { use: bookId }, destination: { kind: "shelf", shelfId } }),
  });
  if (!res.ok) throw new Error(`shelf add ${res.status}`);
  const entry = await res.json() as {
    destination: unknown; created: string[]; added: string[]; statused: string[]; promoted?: string[];
    unparked?: { bookId: string; parkedOn: string }[];
  };
  if (entry.added.length === 0) return null;
  const { destination, created, added, statused, promoted = [], unparked = [] } = entry;
  return async () => {
    const back = await fetch("/api/books", {
      method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ destination, created, added, statused, promoted, unparked }),
    });
    if (!back.ok) throw new Error(`shelf add undo ${back.status}`);
  };
}

/**
 * Off a shelf through 5.1b's write (`PATCH /api/shelves/{id}` `{ bookId, remove: true }`, TASK-124): its row
 * goes and the rest close up. Answers its undo, `{ undo: change }`, which puts the row back at its place with
 * its note (409, changing nothing, once the shelf's order has moved since).
 */
async function takeOff(bookId: string, shelfId: string): Promise<() => Promise<void>> {
  const call = async (body: unknown) => {
    const res = await fetch(`/api/shelves/${encodeURIComponent(shelfId)}`, {
      method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`shelf PATCH ${res.status}`);
    return res.json() as Promise<{ change?: unknown }>;
  };
  const { change } = await call({ bookId, remove: true });
  if (!change) throw new Error("shelf PATCH: no change");
  return async () => { await call({ undo: change }); };
}

/**
 * *Shelves Edit* (task 3.5b; mockup `bookdetail`, its third frame): every one of your book shelves,
 * by name (`GET /api/shelves`, asked when it opens, never while a page loads), each an `aria-pressed`
 * toggle, on with a ✓ when the book is on it. A toggle saves as it is pressed, through the routes
 * that already exist (`putOn`, `takeOff`), shows at once, refreshes the page so the book's *Shelves*
 * line says it, and pushes its own undo toast whose Undo reverses that one write. A failed write puts
 * the toggle back and raises a failure toast with *Retry*. No *New shelf…* here: Add books and
 * Shelves make shelves (TASK-097). `on` is the ids of the shelves the book is on as the sheet drew it.
 */
export default function BookShelves({ bookId, title, on: drawn }: { bookId: string; title: string; on: readonly string[] }) {
  const router = useRouter();
  const { push, fail } = useUndo();
  const [shelves, setShelves] = useState<Shelf[] | "failed" | null>(null);
  const [on, setOn] = useState(() => new Set(drawn));
  const busy = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    fetch("/api/shelves")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("shelves failed"))))
      .then((body: { shelves: Shelf[] }) => { if (live) setShelves(body.shelves); })
      .catch(() => { if (live) setShelves("failed"); });
    return () => { live = false; };
  }, []);

  const show = (id: string, value: boolean) => setOn((now) => {
    const next = new Set(now);
    if (value) next.add(id);
    else next.delete(id);
    return next;
  });

  async function toggle(shelf: Shelf, next: boolean) {
    if (busy.current.has(shelf.id)) return;
    busy.current.add(shelf.id);
    show(shelf.id, next);
    try {
      const undo = next ? await putOn(bookId, shelf.id) : await takeOff(bookId, shelf.id);
      router.refresh();
      if (undo) {
        push({
          label: next ? `Added to ${shelf.name}` : `Removed from ${shelf.name}`,
          detail: title,
          undo: async () => {
            await undo();
            show(shelf.id, !next);
            router.refresh();
          },
        });
      }
    } catch {
      show(shelf.id, !next);
      fail({ label: `Couldn't save ${title}. Nothing changed.`, retry: () => void toggle(shelf, next) });
    } finally {
      busy.current.delete(shelf.id);
    }
  }

  if (shelves === null) return <p className="small muted" role="status">Loading your shelves…</p>;
  if (shelves === "failed") {
    return <p className="neutral-error" role="alert"><span aria-hidden="true">×</span> Couldn&apos;t load your shelves. Go back and try again.</p>;
  }
  if (shelves.length === 0) {
    return (
      <div className="empty book-shelves-empty">
        <b>No shelves yet</b>
        Make one on <Link href="/books/shelves">Shelves</Link>, then put this book on it here.
      </div>
    );
  }
  return (
    <>
      <p className="lede book-shelves-lede">Tap a shelf to put the book on it or take it off. Each one saves at once, with an Undo.</p>
      <div className="pp-chips book-shelves" role="group" aria-label={`Shelves for ${title}`}>
        {shelves.map((s) => {
          const pressed = on.has(s.id);
          return (
            // The name is the visible text (WCAG 2.5.3); the ✓ is a glyph beside the state, never colour alone.
            <button key={s.id} type="button" className="chip pp-chip" aria-pressed={pressed}
              onClick={() => void toggle(s, !pressed)}>
              {pressed && <span aria-hidden="true">✓</span>}{s.name}
            </button>
          );
        })}
      </div>
    </>
  );
}
