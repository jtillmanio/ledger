"use client";

import { useEffect, useId, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  /** Called after the menu closes; `trigger` is the button that opened it, so
   * a sheet opened from an item can hand focus back to it (R1-11). */
  onSelect: (trigger: HTMLButtonElement) => void;
};

/**
 * A button that opens a short list of actions (`role="menu"`): the run hero's
 * `⋯` and a spine row's `⋯` (task 1.1). Arrow keys move between items, Esc and
 * Tab close it, and focus goes back to the button. A click anywhere else closes it.
 */
export default function Menu({ label, className, items, children }: {
  label: string; className?: string; items: MenuItem[]; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    function away(e: PointerEvent) {
      const t = e.target as Node;
      if (!list.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  function close() {
    setOpen(false);
    trigger.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      all[(at + step + all.length) % all.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? all[0] : all.at(-1))?.focus();
    }
  }

  return (
    <span className="menu-wrap">
      <button
        ref={trigger}
        type="button"
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </button>
      {open && (
        <div ref={list} id={id} className="menu" role="menu" aria-label={label} onKeyDown={onKeyDown}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="opt"
              tabIndex={-1}
              onClick={() => {
                close();
                item.onSelect(trigger.current!);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}
