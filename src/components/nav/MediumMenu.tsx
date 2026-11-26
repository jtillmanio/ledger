"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { Medium } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { inGroup, type NavItem } from "./items";

/**
 * The icon rail's medium switch, 1024–1279px (6.25, D-178, MR-D5, frame A10): five media don't fit
 * a 64px well, so the current medium is one 48 × 44 button, its icon and a chevron, that opens a
 * menu of every built medium. The menu is `Menu`'s (task 1.1) with links for items: focus goes to
 * the first on opening, the arrows, Home and End move, Esc closes and gives focus back to the
 * button, and Tab or a press anywhere else closes it. The current medium is `aria-current` with a
 * grey check, never a colour. Hidden by CSS at every other width (the sidebar draws the media as a
 * list from 1280px), so nothing flashes at hydration.
 */
export default function MediumMenu({ items, medium, pathname }: { items: NavItem[]; medium: Medium; pathname: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const media = inGroup(items, "media");
  const current = media.find((m) => m.medium === medium);
  const label = current?.label ?? "Media";

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

  function onKeyDown(e: React.KeyboardEvent) {
    const all = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
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
    <div className="medmenu-wrap">
      {/* Named by aria-label, as the phone's medium button: "Books, switch medium". */}
      <button ref={trigger} type="button" className="medswitch" data-tip="Switch medium"
        aria-label={`${label}, switch medium`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}>
        <Icon name={current?.icon ?? "layout-dashboard"} />
        <Icon name="chevron-down" />
      </button>
      {open && (
        <div ref={list} id={id} className="menu medmenu" role="menu" aria-label="Switch medium" onKeyDown={onKeyDown}>
          {media.map((m) => {
            const here = m.medium === medium;
            return (
              <Link key={m.id} href={m.href} role="menuitem" tabIndex={-1} className="opt"
                aria-current={here ? (pathname === m.href ? "page" : "true") : undefined}
                onClick={() => setOpen(false)}>
                <Icon name={m.icon} />
                <span className="medmenu-name">{m.label}</span>
                {here && <Icon name="check" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
