"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { useUndo } from "@/components/Undo";

/** What a save answers: the write's own undo. Rejects when it didn't save. */
export type TextSave = (text: string) => Promise<{ undo: () => Promise<void> }>;

/**
 * A text edited where it is shown (task 5.1, written to 3.1's pattern: click
 * the text, type, blur saves; no modal, no Save button). At rest it is a button
 * holding the text, named *<label>: <text>*, or, with no text, a quiet
 * *<add>* button: never an empty line. Tapping either swaps in a textarea
 * named `label`. Blur or Enter saves (Shift+Enter is a new line), Esc leaves it
 * as it was; Enter and Esc put focus back on the text. The new text shows at
 * once; a save that fails puts the old one back and says so, with *Retry*
 * (R1-07). A save pushes its undo, which puts the old text back (task 1.2).
 * Whitespace is trimmed and an empty text clears it, as the write does.
 *
 * `textClass` is the class of the at-rest text itself (`shelf-note`,
 * `shelf-desc`), so a screen styles it as its own line and a test reads only
 * the visible words. 3.1 can use this for its allow-listed fields.
 */
export default function InlineText({ value, label, add, save, saved, textClass = "", multiline = true }: {
  value: string | null;
  /** The field's name: *Note on Wizard and Glass*. */
  label: string;
  /** The button with no text: *Add a note on Wizard and Glass* (visible *Add a note*, the rest for screen readers). */
  add: { text: string; context?: string };
  save: TextSave;
  /** The toast's line: *Saved the note on Wizard and Glass*. */
  saved: string;
  textClass?: string;
  multiline?: boolean;
}) {
  const router = useRouter();
  const undo = useUndo();
  const [shown, setShown] = useState(value);
  const [editing, setEditing] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const rest = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  const done = useRef(false);

  // A refresh brings the stored text; take it unless the field is open.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (!editing) setShown(value);
  }

  useLayoutEffect(() => {
    if (editing) {
      const el = field.current!;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    } else if (refocus.current) {
      refocus.current = false;
      rest.current?.focus();
    }
  }, [editing]);

  async function commit(text: string | null, prior: string | null) {
    setShown(text);
    try {
      const own = await save(text ?? "");
      undo.push({
        label: saved,
        undo: async () => {
          await own.undo();
          setShown(prior);
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      setShown(prior);
      undo.fail({ label: `Couldn't save. ${label} is as it was.`, retry: () => void commit(text, prior) });
    }
  }

  function finish(keep: boolean, focusBack: boolean) {
    if (done.current) return;
    done.current = true;
    const typed = field.current?.value.trim() ?? "";
    const text = typed === "" ? null : typed;
    refocus.current = focusBack;
    setEditing(false);
    if (keep && text !== shown) void commit(text, shown);
  }

  if (editing) {
    return (
      <textarea
        ref={field}
        className={`inline-field${multiline ? "" : " one"}`}
        aria-label={label}
        defaultValue={shown ?? ""}
        rows={multiline ? 2 : 1}
        maxLength={10_000}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false, true);
          } else if (e.key === "Enter" && (!multiline || !e.shiftKey)) {
            e.preventDefault();
            finish(true, true);
          }
        }}
      />
    );
  }

  function open() {
    done.current = false;
    setEditing(true);
  }

  return shown ? (
    <button ref={rest} type="button" className="inline-text" onClick={open}>
      <span className="sr-only">{label}: </span><span className={textClass || undefined}>{shown}</span>
    </button>
  ) : (
    <button ref={rest} type="button" className="inline-add" onClick={open}>
      {add.text}{add.context && <span className="sr-only"> {add.context}</span>}
    </button>
  );
}
