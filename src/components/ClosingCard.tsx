"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * The closing card (task 5.5, UX-N13; drawn in `blist`): what the finish moment
 * asks once a status has saved. Its first use is a DNF's reason, the book's
 * note: a one-line field, labelled, focused and filled with the note the book
 * already has, so the reason edits the note rather than replacing it unseen;
 * then *Save* and *Skip*, both grey (DNF is a grey stop, not a warning; nothing
 * here is `--ready` or `--danger`, and there is no celebration, D-40). 5.4 gives
 * the same card a rating for a run.
 *
 * *Skip*, and Esc anywhere in the card, close it writing nothing; so does *Save*
 * with the text unchanged. `onSave` writes and rejects when it couldn't: the card
 * stays open and says so, and *Save* becomes *Retry* (R1-07). `onClose` runs once
 * the card is done, and puts focus back where the caller wants it. Nothing moves:
 * it appears in place, so reduced motion has nothing to stop.
 */
export default function ClosingCard({ label, initial, onSave, onClose }: {
  /** The field's visible label: *Why did you stop?* */
  label: string;
  /** What the field opens on: the book's note, or null for none. */
  initial: string | null;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const errorId = useId();

  useEffect(() => {
    field.current?.focus();
  }, []);

  async function save() {
    if (saving) return;
    // Nothing changed is nothing to write: *Save* then closes as *Skip* does.
    if (text.trim() === (initial ?? "").trim()) {
      onClose();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      await onSave(text);
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="closing-card" onKeyDown={(e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }}>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label htmlFor={fieldId} className="closing-label">{label}</label>
        <input id={fieldId} ref={field} className="txt" type="text" value={text} autoComplete="off"
          maxLength={10000} aria-describedby={failed ? errorId : undefined}
          onChange={(e) => { setText(e.target.value); setFailed(false); }} />
        <div className="btnrow closing-actions">
          <button type="submit" className="btn sec sm" aria-disabled={saving || undefined}>
            {saving ? "Saving…" : failed ? "Retry" : "Save"}
          </button>
          <button type="button" className="btn sec sm" onClick={onClose}>Skip</button>
        </div>
      </form>
      {failed && (
        <p id={errorId} className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> The reason didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
