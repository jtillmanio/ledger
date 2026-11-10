"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BookSearch, { authorList, pickKey, type Outcome, type Pick } from "@/components/BookSearch";
import ByHand from "@/components/ByHand";
import PasteBooks, { AFTER_ADD } from "@/components/PasteBooks";
import { PlanPickerBody, type PickerBook, type Verb } from "@/components/PlanPicker";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { AddBookResult, AddedEntry, HandItem } from "@/db/writes";
import { destinationOf, targetName, undoAdd, type Target } from "@/lib/book-add";

type Mode = "search" | "paste" | "hand";
type Shelf = { id: string; name: string };
type Picker =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "open"; shelves: Shelf[] };

type Added = Extract<AddBookResult, { ok: true }>;

/** The plan picker, opened for Add books' *Year or quarter…* chip or for one result (task 2.3). */
type Step = { what: "target" } | { what: "pick"; pick: Pick; words: number | null };

/** The picker inside its own sheet (the full page): it leaves through the sheet's close, which pops its history entry. */
function InSheet({ build }: { build: (leave: () => void) => React.ReactNode }) {
  return <>{build(useSheetClose())}</>;
}

/** A plan end the picker chose, as an Add books target. */
const targetOf = (to: string): Target => (to === "someday" ? { kind: "someday" } : to === "on_deck" ? { kind: "on_deck" } : { kind: "period", period: to });

const STATUS: Record<string, string> = {
  to_read: "on your to-read list", reading: "reading", listening: "listening", read: "read", dnf: "did not finish",
};

/**
 * Add books (task 1.4c; mockups `add`, `shelves`, `apistates`): *Search ·
 * Paste a list · By hand*, Search first, then **Add to**, which names where a
 * book goes before you look for it. Someday is the default; *On deck* (task
 * 1.7) puts a to-read book next in line, with no year; a shelf is chosen
 * through *Shelf…*, or arrives chosen from a shelf's *+ Add to shelf*.
 * *Year or quarter…* (2.3) opens the plan picker, which sets the target (a year, a
 * quarter, On deck or Someday); a result's own *Year or quarter…* opens it for that
 * one book and adds it there. In a sheet the picker is a step swapped inside the same
 * sheet (D-34: never two), heading and focus moving to it, *‹ Add books* back; on
 * the full page it is a sheet of its own.
 *
 * Every add is one transaction on the server and pushes one undo onto the
 * app's stack (task 1.2, R1-09). A book you already have is reused, and the
 * toast says so. In a sheet (`close` given) the page behind refreshes after
 * each add; on the full page, *Paste a list* goes on to To read as before.
 *
 * Opened from an inbox note's **Resolve** (task 1.4b), Search starts with the
 * note's text in it, and the first Search or By hand add that goes through
 * resolves the note in its own transaction; undoing that add reopens it.
 */
export default function AddBooks({ initial, close, onHeading, query = "", note = null }: {
  initial: Target;
  /** Closes the sheet this is in; absent on the full page. */
  close?: () => void;
  /** The sheet's heading, told when the plan picker step takes it and gives it back. */
  onHeading?: (heading: string) => void;
  /** Search's starting text. */
  query?: string;
  /** The inbox note this add resolves. */
  note?: number | null;
}) {
  const level = close ? 3 : 2;
  const [target, setTarget] = useState<Target>(initial);
  const [noteId, setNoteId] = useState(note);
  const [mode, setMode] = useState<Mode>("search");
  const [picker, setPicker] = useState<Picker>({ phase: "closed" });
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  /** Where a result went when its own *Year or quarter…* sent it somewhere other than `target`. */
  const [wheres, setWheres] = useState<Record<string, Target>>({});
  const [step, setStep] = useState<{ what: Step; opener: HTMLElement } | null>(null);
  const stepped = useRef(false);
  const lastOpener = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // *Add it by hand* carries the search over: a new key remounts the form with it.
  const [hand, setHand] = useState({ key: 0, title: "" });
  const router = useRouter();
  const { push, notify } = useUndo();

  function choose(next: Target) {
    setTarget(next);
    // A result says what happened to it on the way to *that* destination.
    setOutcomes({});
    setWheres({});
    setPicker({ phase: "closed" });
  }

  const stepHeading = (what: Step) => (what.what === "target" ? "Year or quarter" : what.pick.book.title);

  function openStep(what: Step, opener: HTMLElement) {
    lastOpener.current = opener;
    setStep({ what, opener });
    onHeading?.(stepHeading(what));
  }

  function closeStep() {
    setStep(null);
    onHeading?.("Add books");
  }

  // In a sheet the picker is a step in the same dialog: its heading takes focus, as the sheet's does on
  // open, and leaving it puts focus back on the control that opened it.
  useEffect(() => {
    if (!close) return;
    if (step) {
      document.querySelector<HTMLElement>(".sheet h2")?.focus();
    } else if (stepped.current) {
      lastOpener.current?.focus();
    }
    stepped.current = step !== null;
  }, [step, close]);

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

  /** The add's toast: one undo entry when it wrote anything, else what it found. Its undo clears the result's *Added*. */
  function tell(result: Added, key: string | undefined, goes: Target) {
    const { title, reused, status, created, added, bookId, note: resolved } = result;
    const fromNote = resolved == null ? "" : " · inbox note resolved";
    const where = targetName(goes);
    if (created.length + added.length === 0) {
      notify("Already in your library",
        `${title} · ${goes.kind === "shelf" ? `already on ${where}` : STATUS[status ?? ""] ?? "kept as it was"}${fromNote}`);
      return;
    }
    const entry: AddedEntry = {
      destination: result.destination, created, added, statused: result.statused, promoted: result.promoted,
    };
    const reopen = resolved == null ? undefined : { id: resolved, bookId };
    push({
      label: `Added to ${where}`,
      detail: `${reused ? `${title} · already in your library` : title}${fromNote}`,
      undo: async () => {
        await undoAdd(entry, reopen);
        // The result is addable again, whatever level it went to (task 1.7's reset, kept by task 2.3).
        if (key) setOutcomes((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)));
        router.refresh();
      },
    });
  }

  /** One add. `goes` is where it goes: the Add to target, or the level a result's own picker chose. */
  async function send(item: unknown, key?: string, goes: Target = target): Promise<Added | null> {
    setFailed(null);
    try {
      const res = await fetch("/api/books", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, destination: destinationOf(goes), ...(noteId !== null && { note: noteId }) }),
      });
      if (res.status === 409) {
        setFailed("That book or shelf is gone. Nothing was written; search again.");
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const result = await res.json() as Added;
      // A note is resolved once: later adds here are plain adds.
      setNoteId(null);
      tell(result, key, goes);
      router.refresh();
      return result;
    } catch {
      setFailed("Couldn't add it. Nothing was written.");
      return null;
    }
  }

  async function addPick(pick: Pick, goes: Target = target) {
    const key = pickKey(pick);
    setBusy(key);
    const item = pick.kind === "library" ? { use: pick.book.id } : {
      hardcover: {
        hardcoverId: pick.book.hardcoverId, title: pick.book.title, authors: pick.book.authors,
        year: pick.book.year, pages: pick.book.pages, coverUrl: pick.book.coverUrl,
      },
    };
    const result = await send(item, key, goes);
    setBusy(null);
    if (result) {
      setWheres((w) => ({ ...w, [key]: goes }));
      setOutcomes((o) => ({ ...o, [key]: result.added.length ? "added" : "there" }));
    }
    return result !== null;
  }

  /** The picker's confirm: set the Add to target, or add one result there. Answers an error line, or null. */
  async function planned(what: Step, to: string, leave: () => void): Promise<string | null> {
    if (what.what === "target") {
      choose(targetOf(to));
      leave();
      return null;
    }
    if (!(await addPick(what.pick, targetOf(to)))) return "Couldn't add it. Nothing was written.";
    leave();
    return null;
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
      router.push(target.kind === "shelf" ? "/books/list" : AFTER_ADD);
    }
  }

  const cancel = (label: string) => (close
    ? <button type="button" className="btn sec" onClick={close}>{label}</button>
    : <Link prefetch={false} href="/books/list" className="btn sec">{label}</Link>);

  // The plan picker for the open step: Add to's *Year or quarter…* sets the target, a result's adds that book.
  const pickerBody = (leave: () => void) => {
    if (!step) return null;
    const { what } = step;
    const verb: Verb = what.what === "target" ? "Choose" : "Add";
    const book: PickerBook = what.what === "target"
      ? { author: null, words: null, estimated: false }
      : {
        author: what.pick.kind === "library" ? what.pick.book.author : authorList(what.pick.book.authors),
        words: what.words, estimated: what.pick.kind === "hardcover" || what.pick.book.word_count === null,
      };
    return <PlanPickerBody book={book} verb={verb} onConfirm={(to) => planned(what, to, leave)} onCancel={leave} />;
  };

  return (
    <>
    <div className="addb" data-mode={mode} hidden={step !== null && close !== undefined}>
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
        <button type="button" className="chip" aria-pressed={target.kind === "on_deck"}
          onClick={() => choose({ kind: "on_deck" })}>On deck</button>
        <button type="button" className="chip" aria-pressed={target.kind === "period"} aria-haspopup="dialog"
          onClick={(e) => openStep({ what: "target" }, e.currentTarget)}>
          {target.kind === "period" ? targetName(target) : "Year or quarter…"}
        </button>
        <button type="button" className="chip" aria-pressed={target.kind === "shelf"}
          aria-expanded={picker.phase !== "closed"} aria-controls="addto-shelves" onClick={openPicker}>
          {target.kind === "shelf" ? target.name : "Shelf…"}
        </button>
      </div>
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
            <BookSearch level={level} target={target} outcomes={outcomes} wheres={wheres} busy={busy}
              onAdd={(pick) => void addPick(pick)} onPlan={(pick, words, opener) => openStep({ what: "pick", pick, words }, opener)}
              onByHand={byHand} initialQuery={query} />
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
    {step && (close ? (
      <div className="pp-step">
        <div className="btnrow"><button type="button" className="btn sec sm pp-back" onClick={closeStep}>‹ Add books</button></div>
        {pickerBody(closeStep)}
      </div>
    ) : (
      <Sheet heading={stepHeading(step.what)} opener={step.opener} onClose={closeStep}>
        <InSheet build={pickerBody} />
      </Sheet>
    ))}
    </>
  );
}
