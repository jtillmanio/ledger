"use client";

import { useEffect, useRef, useState } from "react";

/** When the button turns green, and when the next label arrives (STYLE_GUIDE §14.3). */
export const CONFIRM_MS = 120;
export const NEXT_MS = 1300;

type Phase = "idle" | "press" | "confirm" | "next";

/**
 * The thumb bar's mark verb, which answers back (task 1.8b, P2, FP-D7). It owns
 * four states and calls the existing optimistic mark; it adds no write path.
 *
 * | t     | state    | what the button shows                                  |
 * | 0     | press    | scale .97, brightness .88; the write goes out          |
 * | 120ms | confirm  | `--ready` / `--on-ready`, "✓ #141 read"                |
 * | 1.3s  | next     | `--brand` again, the next label sliding in             |
 *
 * The green holds from 120ms to 1.3s, which keeps the 600ms `--dur-hold` the
 * guide asks for and then some: it is information, not motion, so it runs under
 * `prefers-reduced-motion` on the same clock and only the movement goes.
 *
 * The label is captured at the press: the page behind moves to the next issue
 * at once, and the button must not follow it until the confirmation is over.
 * Taps before *next* are ignored. A write that fails returns the button to
 * rest at once, so the green never outlasts the revert; the error toast
 * (1.8d) says what happened.
 */
export default function MarkButton({ idle, done, onMark, disabled }: {
  /** The verb at rest: "Mark #141 read". */
  idle: string;
  /** What the confirmation reads: "✓ #141 read". */
  done: string;
  /** Sends the write; resolves to whether it saved. */
  onMark: () => Promise<boolean> | boolean;
  /** Nothing to mark: the button stays, `aria-disabled`. */
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [shown, setShown] = useState({ idle, done });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const turn = useRef(0);

  function clear() {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
  }
  useEffect(() => clear, []);

  function press() {
    if (disabled || phase === "press" || phase === "confirm") return;
    clear();
    const mine = ++turn.current;
    setShown({ idle, done });
    setPhase("press");
    timers.current = [
      setTimeout(() => setPhase("confirm"), CONFIRM_MS),
      setTimeout(() => setPhase("next"), NEXT_MS),
    ];
    const revert = () => {
      if (turn.current !== mine) return;
      clear();
      setPhase("idle");
    };
    Promise.resolve(onMark()).then((ok) => { if (!ok) revert(); }, revert);
  }

  const text = phase === "press" ? shown.idle : phase === "confirm" ? shown.done : idle;
  return (
    <button
      type="button"
      className="btn mark"
      data-state={phase}
      aria-disabled={disabled || undefined}
      aria-label={text}
      title={text}
      onClick={press}
    >
      {/* A new key restarts the slide when the next label arrives. */}
      <span key={phase === "next" ? "next" : "rest"} className="mark-label">{text}</span>
    </button>
  );
}
