"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Choice } from "@/lib/library-sort";

/**
 * A dropdown chip (task 6.24, MR-D20, frame E7): a chip that names its current choice (*Owned: Any*) and opens a
 * short list of links, one per choice, the current one marked `aria-current`. A disclosure of links, not a
 * `role="menu"`: every choice is a plain navigation, so the URL carries it and a reload keeps it (the Library's
 * filters are all links). The list is drawn only while it is open, so it is not in the page's HTML.
 *
 * Enter, Space and ArrowDown open it and put focus on the current choice; the arrows, Home and End move between
 * choices and Tab walks them as links; Esc closes it and returns focus to the chip; a click or tap outside, or
 * Tab past the last choice, closes it too. `name` is the chip's name for assistive tech when its text isn't enough
 * (*Sort: Length, longest first*); the list is a group named `group` (*Sort*).
 */
export default function ChipMenu({ text, name, group, choices, align = "start" }: {
  text: string; name?: string; group: string; choices: Choice[]; align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const links = wrap.current?.querySelectorAll<HTMLElement>(".chipmenu a");
    (wrap.current?.querySelector<HTMLElement>('.chipmenu a[aria-current="true"]') ?? links?.[0])?.focus();
    function away(e: PointerEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    const all = [...(wrap.current?.querySelectorAll<HTMLElement>(".chipmenu a") ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      all[(at + (e.key === "ArrowDown" ? 1 : -1) + all.length) % all.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? all[0] : all.at(-1))?.focus();
    } else if (e.key === "Tab" && at === (e.shiftKey ? 0 : all.length - 1)) {
      // Tab past the last choice (or Shift+Tab back out of the first) leaves the dropdown: close it, and let focus go on.
      setOpen(false);
    }
  }

  return (
    <span ref={wrap} className="menu-wrap">
      <button ref={trigger} type="button" className="chip dd" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={name} onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}>
        {text}
        <svg className="caret" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div id={id} className={`menu chipmenu${align === "end" ? " end" : ""}`} role="group" aria-label={group} onKeyDown={onListKeyDown}>
          {choices.map((c) => (
            <Link key={c.label} prefetch={false} href={c.href} className={c.divider ? "opt div" : "opt"}
              aria-current={c.current || undefined} onClick={() => setOpen(false)}>
              {c.label}
            </Link>
          ))}
        </div>
      )}
    </span>
  );
}
