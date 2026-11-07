"use client";

import { useEffect, useId, useRef, useState } from "react";

/** A held button waits this long, then repeats; the gap shortens after a second. Both gaps stay
 *  under PaceSettings's 500 ms wait, so a hold is one save (task 2.0b). */
const HOLD_DELAY_MS = 400;
const SLOW_GAP_MS = 300;
const FAST_GAP_MS = 120;
const SPEED_UP_AFTER_MS = 1000;

/**
 * A number you step, or type (STYLE_GUIDE § 9, changed by D-123): a named group of a − button,
 * the number and a + button. The number is a button named for its row; a tap swaps it for a
 * numeric input, so a phone opens its numpad. Enter or leaving the field commits, Esc puts the
 * old value back, and anything that isn't a whole number changes nothing. Holding − or + repeats
 * after 400 ms and speeds up; a tap or a key press is one step. At a bound the button stays a
 * real, focusable `<button>` marked `aria-disabled="true"` and points at a visible reason, so a
 * keyboard or screen-reader user is told why it does nothing; it is never a bare `disabled`.
 */
export default function Stepper({ label, value, min, max, step, onChange }: {
  /** The row's name: the group is named for it, and the buttons *Decrease* / *Increase* / *Edit* it. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const why = useId();
  const atMin = value <= min;
  const atMax = value >= max;
  const noun = label.toLowerCase();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const numberBtn = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const draftRef = useRef("");
  const closing = useRef(false);
  const refocus = useRef(false);

  // What a repeat or a commit steps from: the latest value, not the one a press captured.
  const current = useRef(value);
  const latest = useRef({ min, max, step, onChange });
  useEffect(() => {
    current.current = value;
    latest.current = { min, max, step, onChange };
  });

  function apply(next: number) {
    const { min: lo, max: hi, onChange: emit } = latest.current;
    const clamped = Math.min(hi, Math.max(lo, next));
    if (clamped === current.current) return false;
    current.current = clamped;
    emit(clamped);
    return true;
  }

  // ---- typing ----------------------------------------------------------------------------
  function commitDraft() {
    const text = draftRef.current.trim();
    if (/^\d+$/.test(text)) apply(Number(text));
  }

  function finish(commit: boolean, back: boolean) {
    if (closing.current) return;
    closing.current = true;
    if (commit) commitDraft();
    refocus.current = back;
    setEditing(false);
  }

  function startEditing() {
    closing.current = false;
    draftRef.current = String(value);
    setDraft(String(value));
    setEditing(true);
  }

  useEffect(() => {
    if (editing) {
      field.current?.focus();
      field.current?.select();
    } else if (refocus.current) {
      refocus.current = false;
      numberBtn.current?.focus();
    }
  }, [editing]);

  // A draft still open when the page is hidden or the screen goes is saved, as leaving the field is.
  useEffect(() => {
    if (!editing) return;
    const leave = () => { if (!closing.current) { closing.current = true; commitDraft(); } };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); leave(); };
    // commitDraft only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  // ---- holding ---------------------------------------------------------------------------
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => stop, []);

  function startHold(dir: 1 | -1) {
    stop();
    repeated.current = false;
    const began = Date.now();
    const tick = () => {
      const { step: by, min: lo, max: hi } = latest.current;
      const next = Math.min(hi, Math.max(lo, current.current + dir * by));
      if (!apply(next)) { stop(); return; }
      repeated.current = true;
      if (next <= lo || next >= hi) { stop(); return; }
      timer.current = setTimeout(tick, Date.now() - began >= SPEED_UP_AFTER_MS ? FAST_GAP_MS : SLOW_GAP_MS);
    };
    timer.current = setTimeout(tick, HOLD_DELAY_MS);
  }

  /** The click that closes a hold adds no step; any other click (a tap, a key press) is one. A key
   *  press has no pointer (detail 0), so a hold that ended without its click can't swallow it. */
  function click(dir: 1 | -1, blocked: boolean, detail: number) {
    if (detail === 0) repeated.current = false;
    if (repeated.current) { repeated.current = false; return; }
    if (!blocked) apply(current.current + dir * step);
  }

  function press(e: React.PointerEvent, dir: 1 | -1, blocked: boolean) {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    if (blocked) repeated.current = false;
    else startHold(dir);
  }

  return (
    <span className="stepper-wrap">
      <span role="group" aria-label={label} className="stepper">
        <button type="button" aria-label={`Decrease ${noun}`} aria-disabled={atMin || undefined}
                aria-describedby={atMin ? why : undefined}
                onPointerDown={(e) => press(e, -1, atMin)} onPointerUp={() => stop()} onPointerLeave={() => stop()}
                onPointerCancel={() => stop()} onContextMenu={(e) => e.preventDefault()} onClick={(e) => click(-1, atMin, e.detail)}>
          &minus;
        </button>
        {editing ? (
          <input ref={field} className="val" type="text" inputMode="numeric" enterKeyHint="go" autoComplete="off"
                 aria-label={label} value={draft}
                 onChange={(e) => { draftRef.current = e.target.value; setDraft(e.target.value); }}
                 onKeyDown={(e) => {
                   if (e.key === "Enter") { e.preventDefault(); finish(true, true); }
                   else if (e.key === "Escape") { e.preventDefault(); finish(false, true); }
                 }}
                 onBlur={() => finish(true, false)} />
        ) : (
          <button ref={numberBtn} type="button" className="val" aria-label={`Edit ${noun}`} onClick={startEditing}>
            {value}
          </button>
        )}
        {/* The number's button is named for its row, so its value is announced from here. */}
        <output className="sr-only">{value}</output>
        <button type="button" aria-label={`Increase ${noun}`} aria-disabled={atMax || undefined}
                aria-describedby={atMax ? why : undefined}
                onPointerDown={(e) => press(e, 1, atMax)} onPointerUp={() => stop()} onPointerLeave={() => stop()}
                onPointerCancel={() => stop()} onContextMenu={(e) => e.preventDefault()} onClick={(e) => click(1, atMax, e.detail)}>
          +
        </button>
      </span>
      {(atMin || atMax) && (
        <span id={why} className="small muted stepper-why">{atMin ? `The lowest is ${min}` : `The highest is ${max}`}</span>
      )}
    </span>
  );
}
