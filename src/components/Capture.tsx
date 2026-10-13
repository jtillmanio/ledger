"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useUndo } from "@/components/Undo";
import { EMPTY_NOTE, KIND_CHOICES, MAX_NOTE, noteText, type Kind } from "@/lib/inbox";

/** The capture field's id: the empty inbox's *Write a note* focuses it. */
export const CAPTURE_FIELD = "capture-text";

/**
 * Quick capture (task 1.4b; mockup `capture`): one text field, an optional
 * kind, *Save*. Nothing is required but the text; the kind starts on *Unsure*,
 * which saves as no kind. A blank note is refused under the field and nothing
 * is sent.
 */
export default function Capture() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { notify } = useUndo();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const note = noteText(text);
    if (!note) {
      setError(EMPTY_NOTE);
      field.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    setFailed(null);
    try {
      const res = await fetch("/api/inbox", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: note, kind }),
      });
      if (res.status === 400) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? EMPTY_NOTE);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setText("");
      setKind(null);
      notify("Saved to your inbox", note);
      router.refresh();
    } catch {
      setFailed("Couldn't save it. Your note is still here.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="capture" onSubmit={save} noValidate>
      <textarea id={CAPTURE_FIELD} ref={field} className="txt capture-field" rows={3} maxLength={MAX_NOTE}
        aria-label="Note" placeholder="Priest's Black Panther — apparently great, whole run"
        aria-invalid={error ? true : undefined} aria-describedby={error ? "capture-err" : undefined}
        value={text} onChange={(e) => { setText(e.target.value); if (error) setError(null); }} />
      {error && <p id="capture-err" className="field-err"><span aria-hidden="true">!</span> {error}</p>}
      {failed && <p className="neutral-error capture-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
      <div className="capture-ctl">
        <div className="seg" role="group" aria-label="Kind">
          {KIND_CHOICES.map((c) => (
            <button key={c.label} type="button" aria-pressed={kind === c.kind} onClick={() => setKind(c.kind)}>{c.label}</button>
          ))}
        </div>
        <button type="submit" className="btn sm capture-save" aria-disabled={saving ? true : undefined}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/** The empty inbox's one primary action: back to the field. */
export function WriteNote() {
  return (
    <button type="button" className="btn" onClick={() => document.getElementById(CAPTURE_FIELD)?.focus()}>
      Write a note
    </button>
  );
}

/**
 * **Resolve** on an *Unsure* note (task 1.4b; owner, 2026-10-09): it asks what
 * the note is first, as three links into the add flows.
 */
export function ResolvePick({ id, text, links }: {
  id: number; text: string; links: { label: string; href: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const menu = `resolve-${id}`;
  return (
    <div className="resolve">
      <button type="button" className="btn sec sm" aria-expanded={open} aria-controls={menu}
        aria-label={`Resolve: ${text}`} onClick={() => setOpen((o) => !o)}>
        Resolve
      </button>
      {open && (
        <div id={menu} className="resolve-pick" role="group" aria-label="Resolve as">
          {links.map((l) => (l.href
            ? <Link key={l.label} prefetch={false} href={l.href} className="chip">{l.label}</Link>
            : <span key={l.label} className="chip" aria-disabled="true">{l.label}</span>))}
        </div>
      )}
    </div>
  );
}
