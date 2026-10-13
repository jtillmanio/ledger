"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import BookSearch, { pickKey, type Outcome, type Pick } from "@/components/BookSearch";
import ByHand from "@/components/ByHand";
import PasteBooks, { AFTER_ADD } from "@/components/PasteBooks";
import { useUndo } from "@/components/Undo";
import type { AddBookResult, AddedEntry, HandItem } from "@/db/writes";
import { destinationOf, undoAdd, type Target } from "@/lib/book-add";

type Mode = "search" | "paste" | "hand";
type Shelf = { id: string; name: string };
type Picker =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "open"; shelves: Shelf[] };

type Added = Extract<AddBookResult, { ok: true }>;

const STATUS: Record<string, string> = { to_read: "on your to-read list", reading: "reading", read: "read", dnf: "did not finish" };

/**
 * Add books (task 1.4c; mockups `add`, `shelves`, `apistates`): *Search ·
 * Paste a list · By hand*, Search first, then **Add to**, which names where a
 * book goes before you look for it. Someday is the default; a shelf is chosen through
 * *Shelf…*, or arrives chosen from a shelf's *+ Add to shelf*. *On deck* (1.7)
 * and *Year or quarter…* (2.3) are drawn, unavailable, with the reason under
 * them.
 *
 * Every add is one transaction on the server and pushes one undo onto the
 * app's stack (task 1.2, R1-09). A book you already have is reused, and the
 * toast says so. In a sheet (`close` given) the page behind refreshes after
 * each add; on the full page, *Paste a list* goes on to To read as before.
 */
export default function AddBooks({ initial, close }: {
  initial: Target;
  /** Closes the sheet this is in; absent on the full page. */
  close?: () => void;
}) {
  const level = close ? 3 : 2;
  const [target, setTarget] = useState<Target>(initial);
  const [mode, setMode] = useState<Mode>("search");
  const [picker, setPicker] = useState<Picker>({ phase: "closed" });
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // *Add it by hand* carries the search over: a new key remounts the form with it.
  const [hand, setHand] = useState({ key: 0, title: "" });
  const router = useRouter();
  const { push, notify } = useUndo();
  const where = target.kind === "someday" ? "Someday" : target.name;

  function choose(next: Target) {
    setTarget(next);
    // A result says what happened to it on the way to *that* destination.
    setOutcomes({});
    setPicker({ phase: "closed" });
  }

  async function openPicker() {
    if (picker.phase !== "closed" && picker.phase !== "failed") {
      setPicker({ phase: "closed" });
      return;
    }
    setPicker({ phase: "loading" });
    try {
      const res = await fetch("/api/shelves");
      if (!res.ok) throw new Error(String(res.status));
      const { shelves } = await res.json() as { shelves: Shelf[] };
      setPicker({ phase: "open", shelves });
    } catch {
      setPicker({ phase: "failed" });
    }
  }

  /** The add's toast: one undo entry when it wrote anything, else what it found. */
  function tell(result: Added) {
    const { title, reused, status, created, added } = result;
    if (created.length + added.length === 0) {
      notify("Already in your library", `${title} · ${target.kind === "shelf" ? `already on ${where}` : STATUS[status ?? ""] ?? "kept as it was"}`);
      return;
    }
    const entry: AddedEntry = { destination: result.destination, created, added };
    push({
      label: `Added to ${where}`,
      detail: reused ? `${title} · already in your library` : title,
      undo: async () => { await undoAdd(entry); router.refresh(); },
    });
  }

  async function send(item: unknown): Promise<Added | null> {
    setFailed(null);
    try {
      const res = await fetch("/api/books", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, destination: destinationOf(target) }),
      });
      if (res.status === 409) {
        setFailed("That book or shelf is gone. Nothing was written; search again.");
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const result = await res.json() as Added;
      tell(result);
      router.refresh();
      return result;
    } catch {
      setFailed("Couldn't add it. Nothing was written.");
      return null;
    }
  }

  async function addPick(pick: Pick) {
    const key = pickKey(pick);
    setBusy(key);
    const item = pick.kind === "library" ? { use: pick.book.id } : {
      openLibrary: {
        openLibraryId: pick.book.openLibraryId, title: pick.book.title, author: pick.book.author,
        year: pick.book.year, pages: pick.book.pages, coverUrl: pick.book.coverUrl,
      },
    };
    const result = await send(item);
    setBusy(null);
    if (result) setOutcomes((o) => ({ ...o, [key]: result.added.length ? "added" : "there" }));
  }

  async function addByHand(item: HandItem) {
    return (await send({ hand: item })) !== null;
  }

  function byHand(title: string) {
    setHand((h) => ({ key: h.key + 1, title }));
    setMode("hand");
    // The form mounts with the switch; its title takes focus once it is there.
    requestAnimationFrame(() => document.getElementById("hand-title")?.focus());
  }

  function pasted() {
    if (close) {
      close();
      router.refresh();
    } else {
      router.push(target.kind === "someday" ? AFTER_ADD : "/books");
    }
  }

  const cancel = (label: string) => (close
    ? <button type="button" className="btn sec" onClick={close}>{label}</button>
    : <Link prefetch={false} href="/books" className="btn sec">{label}</Link>);

  return (
    <div className="addb" data-mode={mode}>
      {!close && <h1 className="t">Add books</h1>}
      {/* The add surface opens on its segmented control (ui.md, mockup `add`); Add to comes next. */}
      <div className="seg" role="group" aria-label="Add by">
        <button type="button" aria-pressed={mode === "search"} onClick={() => setMode("search")}>Search</button>
        <button type="button" aria-pressed={mode === "paste"} onClick={() => setMode("paste")}>Paste a list</button>
        <button type="button" aria-pressed={mode === "hand"} onClick={() => setMode("hand")}>By hand</button>
      </div>
      <div className="addto" role="group" aria-labelledby="addto-label">
        <span id="addto-label" className="addto-k">Add to</span>
        <button type="button" className="chip" aria-pressed={target.kind === "someday"}
          onClick={() => choose({ kind: "someday" })}>Someday</button>
        <button type="button" className="chip" aria-disabled="true" aria-describedby="addto-later">On deck</button>
        <button type="button" className="chip" aria-disabled="true" aria-describedby="addto-later">Year or quarter…</button>
        <button type="button" className="chip" aria-pressed={target.kind === "shelf"}
          aria-expanded={picker.phase !== "closed"} aria-controls="addto-shelves" onClick={openPicker}>
          {target.kind === "shelf" ? target.name : "Shelf…"}
        </button>
      </div>
      <p id="addto-later" className="small muted addto-later">On deck and Year or quarter… arrive with the reading plan.</p>
      <div id="addto-shelves" role="status" aria-live="polite">
        {picker.phase === "loading" && <p className="small muted addto-pick">Loading your shelves…</p>}
        {picker.phase === "failed" && (
          <p className="neutral-error addto-pick">
            <span aria-hidden="true">×</span> Couldn&apos;t load your shelves.{" "}
            <button type="button" className="linkbtn" onClick={openPicker}>Try again</button>
          </p>
        )}
        {picker.phase === "open" && (picker.shelves.length === 0 ? (
          <p className="small muted addto-pick">No shelves yet. You can still add to Someday.</p>
        ) : (
          <div className="addto addto-pick" role="group" aria-label="Your shelves">
            {picker.shelves.map((s) => (
              <button key={s.id} type="button" className="chip"
                aria-pressed={target.kind === "shelf" && target.shelfId === s.id}
                onClick={() => choose({ kind: "shelf", shelfId: s.id, name: s.name })}>{s.name}</button>
            ))}
          </div>
        ))}
      </div>

      {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}

      {/* Search shows *Or paste a list* under its results, as the mockup draws it (beside them on the
          full page from 1024px); Paste a list is the paste alone, By hand the form alone. Search and
          Paste stay mounted, so what you found or pasted is still there when you come back. */}
      <div className="add-2up">
        <div>
          <div className="pane pane-search" hidden={mode !== "search"}>
            <BookSearch level={level} target={target} outcomes={outcomes} busy={busy} onAdd={addPick} onByHand={byHand} />
          </div>
          <div className="pane pane-hand" hidden={mode !== "hand"}>
            <ByHand key={hand.key} target={target} title={hand.title} onSubmit={addByHand} cancel={cancel("Cancel")} />
          </div>
        </div>
        <div className="pane pane-paste" hidden={mode === "hand"}>
          <PasteBooks level={level} target={target} cancel={cancel("Cancel")} onAdded={pasted} />
        </div>
      </div>
    </div>
  );
}
