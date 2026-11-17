"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useUndo } from "@/components/Undo";

/**
 * *+ New shelf* (task 5.1; TASK-095's `POST /api/shelves`): a button that opens
 * a name field with *Create* and *Cancel*. A new name makes an empty shelf,
 * which joins the list, and pushes an Undo that removes it again (`DELETE`,
 * refused once it holds a book, a description or a follow). A name you already
 * use, in any case, writes nothing: the reason the route gives sits under the
 * field, which is marked invalid. Any other failure says so with *Retry*
 * (R1-07). `primary` draws the button filled: the empty list's one action.
 */
export default function NewShelf({ primary = false }: { primary?: boolean }) {
  const router = useRouter();
  const undo = useUndo();
  const [open, setOpen] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const back = useRef(false);

  useLayoutEffect(() => {
    if (open) field.current?.focus();
    else if (back.current) {
      back.current = false;
      opener.current?.focus();
    }
  }, [open]);

  function close() {
    back.current = true;
    setWhy(null);
    setOpen(false);
  }

  async function create(name: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/shelves", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => ({})) as { shelf?: { id: string; name: string }; error?: string };
      if (res.status === 409 || res.status === 400) {
        setWhy(body.error ?? "That name can't be used.");
        field.current?.focus();
        return;
      }
      if (!res.ok || !body.shelf) throw new Error(`POST /api/shelves ${res.status}`);
      const made = body.shelf;
      undo.push({
        label: `Made ${made.name}`,
        detail: "a new shelf",
        undo: async () => {
          const gone = await fetch(`/api/shelves/${encodeURIComponent(made.id)}`, { method: "DELETE" });
          if (!gone.ok) throw new Error(`DELETE /api/shelves ${gone.status}`);
          router.refresh();
        },
      });
      close();
      router.refresh();
    } catch {
      undo.fail({ label: `Couldn't make ${name}. Nothing was written.`, retry: () => void create(name) });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button ref={opener} type="button" className={primary ? "btn wide" : "btn sec wide"} onClick={() => setOpen(true)}>
        + New shelf
      </button>
    );
  }

  return (
    <form
      className="new-shelf"
      onSubmit={(e) => {
        e.preventDefault();
        const name = field.current?.value.trim() ?? "";
        if (!name) {
          setWhy("Give the shelf a name.");
          field.current?.focus();
          return;
        }
        if (!busy) void create(name);
      }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }}
    >
      <label htmlFor="new-shelf-name" className="add-label">Shelf name</label>
      <input
        ref={field} id="new-shelf-name" name="name" type="text" className="txt" autoComplete="off" maxLength={300}
        aria-invalid={why ? true : undefined} aria-describedby={why ? "new-shelf-why" : undefined}
        onChange={() => { if (why) setWhy(null); }}
      />
      {/* A name in use is a validation failure, so its line may be red (UX floor), as By hand's is. */}
      {why && <p id="new-shelf-why" className="field-err" role="alert"><span aria-hidden="true">!</span> {why}</p>}
      <div className="btnrow">
        <button type="button" className="btn sec" onClick={close}>Cancel</button>
        <button type="submit" className="btn" aria-disabled={busy ? true : undefined}>Create</button>
      </div>
    </form>
  );
}
