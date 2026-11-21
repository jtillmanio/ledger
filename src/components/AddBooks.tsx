"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BookSearch, { authorList, pickKey, type Outcome, type Pick } from "@/components/BookSearch";
import ByHand from "@/components/ByHand";
import PasteBooks, { AFTER_ADD } from "@/components/PasteBooks";
import type { PickerBook, Verb } from "@/components/PlanPicker";
import ReleaseDate, { NO_RELEASE, releaseDateOf, type ReleaseValue } from "@/components/ReleaseDate";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { AddBookResult, AddedEntry, Destination, HandItem } from "@/db/writes";
import {
  COMING_OUT, destinationOf, OWNED_CHOICES, OWNED_HAVE, OWNED_NAMES, shelfLabel, targetName, undoAdd, type Target,
} from "@/lib/book-add";
import { MAX_FIELD } from "@/lib/book-parse";
import { useQueueListen } from "@/lib/listen-queue";

// Loaded on the first *Year or quarter…*, as the Library row's *Plan for…* loads it: every page with an
// Add button carries Add books, and none of them should carry the picker until it opens (perf budget).
const PlanPickerBody = dynamic(() => import("@/components/PlanPicker").then((m) => m.PlanPickerBody), { ssr: false });

type Mode = "search" | "paste" | "hand";
type Shelf = { id: string; name: string };
type Picker =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "failed" }
  | { phase: "open"; shelves: Shelf[] };

type Added = Extract<AddBookResult, { ok: true }>;

/** A shelf's page (task 5.1). */
const shelfHref = (id: string) => `/books/shelves/${encodeURIComponent(id)}`;

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
  // A book you have but haven't listed (task 1.21): *Coming out* leaves it as it is, and says so (task 5.7).
  unlisted: "Unlisted",
};

/**
 * Add books (task 1.4c; mockups `add`, `shelves`, `apistates`): *Search ·
 * Paste a list · By hand*, Search first, then **Add to**, which names where a
 * book goes before you look for it. Someday is the default; *On deck* (task
 * 1.7) puts a to-read book next in line, with no year; a shelf is chosen
 * through *Shelf…*, or arrives chosen from a shelf's *+ Add to shelf*.
 * *New shelf…* ends the shelves (task 5.1): a *Shelf name* field, and the
 * add makes the shelf in its own write, one Undo removing both; from then on
 * Add to is that shelf. A name in use is refused, the reason under the field. *Coming
 * out* (task 5.7; Search and By hand, one book and one date) adds a book you're
 * waiting for, with its release date or *No date yet*, to `/books/releases`.
 * *Year or quarter…* (2.3) opens the plan picker, which sets the target (a year, a
 * quarter, On deck or Someday); a result's own *Year or quarter…* opens it for that
 * one book and adds it there. In a sheet the picker is a step swapped inside the same
 * sheet (D-34: never two), heading and focus moving to it, *‹ Add books* back; on
 * the full page it is a sheet of its own.
 *
 * A result that is a book (a library one, or a Hardcover one once added) also
 * offers *Queue to listen* (task 5.14), a second write with its own toast: one
 * toast at a time, so it commits the add, and the add's undo never meets a book
 * it queued.
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
  /** The book each added result became (task 5.14), for its *Queue to listen*. */
  const [added, setAdded] = useState<Record<string, string>>({});
  const [step, setStep] = useState<{ what: Step; opener: HTMLElement } | null>(null);
  const stepped = useRef(false);
  const lastOpener = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  /** Why a new shelf's name can't be used (task 5.1): under the name field. */
  const [why, setWhy] = useState<string | null>(null);
  const nameField = useRef<HTMLInputElement>(null);
  // *Add it by hand* carries the search over: a new key remounts the form with it.
  const [hand, setHand] = useState({ key: 0, title: "" });
  /** *Coming out*'s date (task 5.7), kept while you switch destinations; `releaseError` is the refusal under it. */
  const [release, setRelease] = useState<ReleaseValue>(NO_RELEASE);
  const [releaseError, setReleaseError] = useState(false);
  const router = useRouter();
  const { push, notify } = useUndo();
  const queueListen = useQueueListen();

  function choose(next: Target) {
    setTarget(next);
    // A result says what happened to it on the way to *that* destination.
    setOutcomes({});
    setWheres({});
    setWhy(null);
    setPicker({ phase: "closed" });
  }

  /** *New shelf…* (task 5.1): the picker stays open with it chosen, and its name field takes focus. */
  function chooseNew() {
    if (target.kind !== "new_shelf") {
      setTarget({ kind: "new_shelf", name: "" });
      setOutcomes({});
      setWheres({});
    }
    setWhy(null);
    // The field mounts with the choice; it takes focus once it is there.
    requestAnimationFrame(() => nameField.current?.focus());
  }

  /** The reason a new shelf's name can't be used, under its field, which takes focus. */
  function refuse(reason: string) {
    setWhy(reason);
    nameField.current?.focus();
  }

  /** True, saying why, when `goes` is a new shelf with no name yet: then nothing is sent. */
  function unnamed(goes: Target) {
    if (goes.kind !== "new_shelf" || shelfLabel(goes.name)) return false;
    refuse("Give the shelf a name.");
    return true;
  }

  /** The add made its shelf (task 5.1): Add to is that shelf from now on, and an open picker lists it. */
  function made(shelf: { id: string; name: string }) {
    setTarget({ kind: "shelf", shelfId: shelf.id, name: shelf.name });
    setPicker((p) => (p.phase === "open" ? { ...p, shelves: [...p.shelves, shelf] } : p));
  }

  /** Its undo removed the shelf: when Add to is still that shelf, it is *New shelf…* again, with the same name. */
  function unmade(shelf: { id: string; name: string }) {
    setTarget((t) => (t.kind === "shelf" && t.shelfId === shelf.id ? { kind: "new_shelf", name: shelf.name } : t));
    setPicker((p) => (p.phase === "open" ? { ...p, shelves: p.shelves.filter((s) => s.id !== shelf.id) } : p));
  }

  /**
   * A format you own is Add to's in every mode (task 5.17 for *Paste a list*, 5.17b for Search and By hand), so
   * switching keeps it. *Coming out* is Search's and By hand's alone (task 5.7): leaving for *Paste a list*
   * goes back to Someday.
   */
  function switchTo(next: Mode) {
    setMode(next);
    if (next === "paste" && target.kind === "release") choose({ kind: "someday" });
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
  function tell(result: Added, key: string | undefined, goes: Target, shelf: { id: string; name: string } | null) {
    const { title, reused, status, created, added, bookId, note: resolved } = result;
    const fromNote = resolved == null ? "" : " · inbox note resolved";
    const where = targetName(goes);
    if (created.length + added.length === 0) {
      // A book with a release keeps it, and one with a status isn't wanted: either way nothing was written (task 5.7).
      // A format you own it in already is said as that (task 5.17b), not as the book's status: it has its copy.
      const kept = goes.kind === "shelf" || (goes.kind === "release" && status === null) ? `already on ${where}`
        : goes.kind === "owned" ? OWNED_HAVE[goes.format] : STATUS[status ?? ""] ?? "kept as it was";
      notify("Already in your library", `${title} · ${kept}${fromNote}`);
      return;
    }
    const entry: AddedEntry = {
      destination: result.destination, created, added, statused: result.statused, promoted: result.promoted,
      unparked: result.unparked, ...(shelf && { newShelf: true }),
    };
    const reopen = resolved == null ? undefined : { id: resolved, bookId };
    push({
      label: `Added to ${where}`,
      detail: `${reused ? `${title} · already in your library` : title}${shelf ? " · new shelf" : ""}${fromNote}`,
      undo: async () => {
        await undoAdd(entry, reopen);
        // The result is addable again, whatever level it went to (task 1.7's reset, kept by task 2.3).
        if (key) {
          setOutcomes((o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key)));
          setAdded((a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== key)));
        }
        if (shelf) unmade(shelf);
        router.refresh();
      },
    });
  }

  /** One add. `goes` is where it goes: the Add to target, or the level a result's own picker chose. */
  async function send(item: unknown, key?: string, goes: Target = target): Promise<Added | null> {
    setFailed(null);
    // *Coming out* needs its date, or *No date yet*: refused under the field, with focus there, sending nothing.
    const date = goes.kind === "release" ? releaseDateOf(release) : null;
    if (date === undefined) {
      setReleaseError(true);
      document.getElementById("release-date")?.focus();
      return null;
    }
    setReleaseError(false);
    // A new shelf needs its name (task 5.1): said under its field, sending nothing.
    if (unnamed(goes)) return null;
    try {
      const res = await fetch("/api/books", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ item, destination: destinationOf(goes, date), ...(noteId !== null && { note: noteId }) }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({})) as { reason?: string; error?: string };
        // A new shelf's name in use (task 5.1) is the field's to say; nothing was written.
        if (body.reason === "taken" && body.error) refuse(body.error);
        else setFailed("That book or shelf is gone. Nothing was written; search again.");
        return null;
      }
      if (!res.ok) throw new Error(String(res.status));
      const result = await res.json() as Added;
      // A note is resolved once: later adds here are plain adds.
      setNoteId(null);
      // The add made its shelf (task 5.1): named as the write stores it.
      const shelf = result.newShelf && goes.kind === "new_shelf" && result.destination.kind === "shelf"
        ? { id: result.destination.shelfId, name: shelfLabel(goes.name) } : null;
      tell(result, key, goes, shelf);
      if (shelf) made(shelf);
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
      setAdded((a) => ({ ...a, [key]: result.bookId }));
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
    switchTo("hand");
    // The form mounts with the switch; its title takes focus once it is there.
    requestAnimationFrame(() => document.getElementById("hand-title")?.focus());
  }

  /** A paste went through, to `went`: Add to's destination, or the shelf a new shelf became (task 5.1). */
  function pasted(went: Destination) {
    if (close) {
      close();
      router.refresh();
    } else {
      // A format you own lands on the Library's Owned filter for it (task 5.17), where an Unlisted book shows too (D-152).
      // A shelf's books land on its page (task 5.1), where they joined the end of its order.
      router.push(went.kind === "shelf" ? shelfHref(went.shelfId)
        : went.kind === "owned" ? `/books/list?owned=${went.format}` : AFTER_ADD);
    }
  }

  // Opened from a shelf's *+ Add to shelf* (task 5.1), Cancel goes back to that shelf; otherwise to the Library.
  const cancel = (label: string) => (close
    ? <button type="button" className="btn sec" onClick={close}>{label}</button>
    : <Link prefetch={false} href={initial.kind === "shelf" ? shelfHref(initial.shelfId) : "/books/list"} className="btn sec">{label}</Link>);

  // The plan picker for the open step: Add to's *Year or quarter…* sets the target, a result's adds that book.
  const pickerBody = (leave: () => void) => {
    if (!step) return null;
    const { what } = step;
    const verb: Verb = what.what === "target" ? "Choose" : "Add";
    const book: PickerBook = what.what === "target"
      ? { author: null, words: null, estimated: false }
      : {
        author: what.pick.kind === "library" ? what.pick.book.author : authorList(what.pick.book.authors),
        // A library pick says where it belongs, as its row does; a Hardcover result has no universe and stays as it was.
        ...(what.pick.kind === "library"
          ? { universe: what.pick.book.universe, series: what.pick.book.series, series_position: what.pick.book.series_position }
          : {}),
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
        <button type="button" aria-pressed={mode === "search"} onClick={() => switchTo("search")}>Search</button>
        <button type="button" aria-pressed={mode === "paste"} onClick={() => switchTo("paste")}>Paste a list</button>
        <button type="button" aria-pressed={mode === "hand"} onClick={() => switchTo("hand")}>By hand</button>
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
        <button type="button" className="chip" aria-pressed={target.kind === "shelf" || target.kind === "new_shelf"}
          aria-expanded={picker.phase !== "closed"} aria-controls="addto-shelves" onClick={openPicker}>
          {target.kind === "shelf" ? target.name : "Shelf…"}
        </button>
        {/* A book you're waiting for (task 5.7, D-35): one book and one date, so not *Paste a list*'s (owner, TASK-100). */}
        {mode !== "paste" && (
          <button type="button" className="chip" aria-pressed={target.kind === "release"}
            onClick={() => choose({ kind: "release" })}>{COMING_OUT}</button>
        )}
        {/* What you own (task 5.17, 5.17b, D-132), in every mode: the add marks each book, creating a new one Unlisted. */}
        {OWNED_CHOICES.map((format) => (
          <button key={format} type="button" className="chip"
            aria-pressed={target.kind === "owned" && target.format === format}
            onClick={() => choose({ kind: "owned", format })}>{OWNED_NAMES[format]}</button>
        ))}
      </div>
      <div id="addto-shelves" role="status" aria-live="polite">
        {picker.phase === "loading" && <p className="small muted addto-pick">Loading your shelves…</p>}
        {picker.phase === "failed" && (
          <p className="neutral-error addto-pick">
            <span aria-hidden="true">×</span> Couldn&apos;t load your shelves.{" "}
            <button type="button" className="linkbtn" onClick={openPicker}>Try again</button>
          </p>
        )}
        {picker.phase === "open" && (
          <>
            {picker.shelves.length === 0 && <p className="small muted addto-pick">No shelves yet. You can still add to Someday.</p>}
            {/* *New shelf…* ends the list (task 5.1), there too when you have none. */}
            <div className="addto addto-pick" role="group" aria-label="Your shelves">
              {picker.shelves.map((s) => (
                <button key={s.id} type="button" className="chip"
                  aria-pressed={target.kind === "shelf" && target.shelfId === s.id}
                  onClick={() => choose({ kind: "shelf", shelfId: s.id, name: s.name })}>{s.name}</button>
              ))}
              <button type="button" className="chip" aria-pressed={target.kind === "new_shelf"} onClick={chooseNew}>
                New shelf…
              </button>
            </div>
          </>
        )}
      </div>
      {/* The new shelf's name, outside the picker's live region: typing is not a status. */}
      {target.kind === "new_shelf" && (
        <div className="hfield addto-name">
          <label htmlFor="addto-new-name" className="add-label">Shelf name</label>
          <input ref={nameField} id="addto-new-name" type="text" className="txt" autoComplete="off" spellCheck={false}
            maxLength={MAX_FIELD} value={target.name}
            aria-invalid={why ? true : undefined} aria-describedby={why ? "addto-new-why" : undefined}
            onChange={(e) => {
              setTarget({ kind: "new_shelf", name: e.target.value });
              setWhy(null);
            }} />
          {/* A name in use is a validation failure, so its line may be red (UX floor), as By hand's is. */}
          {why && <p id="addto-new-why" className="field-err" role="alert"><span aria-hidden="true">!</span> {why}</p>}
        </div>
      )}

      {target.kind === "release" && (
        <ReleaseDate value={release} error={releaseError}
          onChange={(next) => { setRelease(next); setReleaseError(false); }} />
      )}

      {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}

      {/* Search shows *Or paste a list* under its results, as the mockup draws it (beside them on the
          full page from 1024px); Paste a list is the paste alone, By hand the form alone. Search and
          Paste stay mounted, so what you found or pasted is still there when you come back. */}
      <div className="add-2up">
        <div>
          <div className="pane pane-search" hidden={mode !== "search"}>
            <BookSearch level={level} target={target} outcomes={outcomes} wheres={wheres} busy={busy}
              onAdd={(pick) => void addPick(pick)} onPlan={(pick, words, opener) => openStep({ what: "pick", pick, words }, opener)}
              onByHand={byHand} initialQuery={query} added={added} onListen={(id, title) => void queueListen(id, title)} />
          </div>
          <div className="pane pane-hand" hidden={mode !== "hand"}>
            <ByHand key={hand.key} target={target} title={hand.title} onSubmit={addByHand} cancel={cancel("Cancel")} />
          </div>
        </div>
        <div className="pane pane-paste" hidden={mode === "hand"}>
          <PasteBooks level={level} target={target} cancel={cancel("Cancel")} onAdded={pasted}
            hold={() => unnamed(target)} refused={refuse} />
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
