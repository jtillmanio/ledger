"use client";

import { useRef, useState } from "react";
import type { HandItem } from "@/db/writes";
import { addTo, MAX_PAGES, MAX_POSITION, MAX_WORDS, type Target } from "@/lib/book-add";
import { MAX_FIELD } from "@/lib/book-parse";

type Field = "title" | "author" | "series" | "position" | "pages" | "words";
type Values = Record<Field, string>;
const EMPTY: Values = { title: "", author: "", series: "", position: "", pages: "", words: "" };

/** A whole number from 1 to max, null when blank, or undefined when it is something else. */
function whole(s: string, max: number): number | null | undefined {
  const t = s.replace(/[,\s]/g, "");
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n >= 1 && n <= max ? n : undefined;
}

/** The form as an item, or the message under each field that is wrong. */
export function checkHand(v: Values): { item: HandItem } | { errors: Partial<Record<Field, string>> } {
  const errors: Partial<Record<Field, string>> = {};
  const title = v.title.trim().replace(/\s+/g, " ");
  const author = v.author.trim().replace(/\s+/g, " ");
  const series = v.series.trim().replace(/\s+/g, " ");
  if (!title) errors.title = "Title is required";
  else if (title.length > MAX_FIELD) errors.title = `Title is at most ${MAX_FIELD} characters`;
  if (!author) errors.author = "Author is required";
  else if (author.length > MAX_FIELD) errors.author = `Author is at most ${MAX_FIELD} characters`;
  if (series.length > MAX_FIELD) errors.series = `Series is at most ${MAX_FIELD} characters`;
  const p = v.position.trim();
  const position = p === "" ? null : Number(p);
  if (position !== null && !(Number.isFinite(position) && position >= 0 && position <= MAX_POSITION)) {
    errors.position = "Position is a number, like 2 or 2.5";
  } else if (position !== null && !series) errors.position = "Position needs a series";
  const pages = whole(v.pages, MAX_PAGES);
  if (pages === undefined) errors.pages = "Pages is a whole number";
  const words = whole(v.words, MAX_WORDS);
  if (words === undefined) errors.words = "Words is a whole number";
  if (Object.keys(errors).length) return { errors };
  return { item: { title, author, series: series || null, position, pages: pages!, words: words! } };
}

const ORDER: Field[] = ["title", "author", "series", "position", "pages", "words"];

/**
 * Add books, *By hand* (task 1.4c; data model 2.15). Title and author are
 * required; series, position, pages and words are optional. A word count you
 * type is saved as `stated`; pages alone are estimated. Nothing is sent until
 * every field is right: a missing title or author says so under the field,
 * and focus goes to the first one wrong. The button names the destination.
 */
export default function ByHand({ target, title: carried, onSubmit, cancel }: {
  target: Target;
  /** A search carried over by *Add it by hand*: the caller remounts the form (a new `key`) to carry another. */
  title: string;
  /** Sends the book; true once it is added, and the form clears. */
  onSubmit: (item: HandItem) => Promise<boolean>;
  cancel: React.ReactNode;
}) {
  const [v, setV] = useState<Values>({ ...EMPTY, title: carried });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const checked = checkHand(v);
    if ("errors" in checked) {
      setErrors(checked.errors);
      refs.current[ORDER.find((f) => checked.errors[f])!]?.focus();
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (await onSubmit(checked.item)) {
        setV(EMPTY);
        refs.current.title?.focus();
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (f: Field, label: string, opts: { required?: boolean; numeric?: boolean; hint?: string } = {}) => (
    <div className={`hfield hf-${f}`}>
      <label htmlFor={`hand-${f}`} className="add-label">{label}{opts.required ? "" : <span className="opt"> optional</span>}</label>
      <input id={`hand-${f}`} ref={(el) => { refs.current[f] = el; }} className="txt" autoComplete="off"
        inputMode={opts.numeric ? (f === "position" ? "decimal" : "numeric") : undefined}
        aria-required={opts.required || undefined} aria-invalid={errors[f] ? true : undefined}
        aria-describedby={errors[f] ? `hand-${f}-err` : undefined}
        value={v[f]} onChange={(e) => setV((now) => ({ ...now, [f]: e.target.value }))} />
      {errors[f] && <p id={`hand-${f}-err`} className="field-err"><span aria-hidden="true">!</span> {errors[f]}</p>}
    </div>
  );

  return (
    <form className="byhand" onSubmit={submit} noValidate>
      {field("title", "Title", { required: true })}
      {field("author", "Author", { required: true })}
      <div className="hrow">
        {field("series", "Series")}
        {field("position", "#", { numeric: true })}
      </div>
      <div className="hrow">
        {field("pages", "Pages", { numeric: true })}
        {field("words", "Words", { numeric: true })}
      </div>
      <p className="small muted hand-note">
        Saved as you type it. A word count is kept as stated; pages alone are estimated. Backfill fills in the rest later and never overwrites you.
      </p>
      <div className="actionbar add-bar">
        <div className="add-buttons">
          {cancel}
          <button type="submit" className="btn" aria-disabled={saving || undefined}>{saving ? "Adding…" : addTo(target)}</button>
        </div>
      </div>
    </form>
  );
}
