"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import Sheet, { useSheetClose } from "@/components/Sheet";
import type { Medium } from "@/lib/last-medium";
import { Icon } from "./Icons";
import { inGroup, type NavItem } from "./items";

/**
 * *Switch medium* (6.25, D-178, frame A6): the phone bar's medium button opens it. The shared
 * `Sheet` (R1-11): labelled by its heading, which takes focus; Tab stays inside; Esc and Back close
 * it and focus returns to the button. Loaded when it is first opened (`MediaBar`), so the code
 * every route loads doesn't carry it.
 */
export default function MediumSheet({ items, medium, pathname, opener, onClose }: {
  items: NavItem[]; medium: Medium | null; pathname: string; opener: HTMLElement | null; onClose: () => void;
}) {
  return (
    <Sheet heading="Switch medium" opener={opener} onClose={onClose}>
      <MediumList items={items} medium={medium} pathname={pathname} />
    </Sheet>
  );
}

/**
 * A row per built medium (the enabled `media` items, in nav order): its icon and name, a link to its
 * dashboard. The current medium is `aria-current` (`page` on its dashboard) with a grey check, never
 * a colour. Each medium's Now in a few words and its count (A6) are a later roadmap item: they need
 * every medium's data in the shell.
 */
export function MediumList({ items, medium, pathname }: { items: NavItem[]; medium: Medium | null; pathname: string }) {
  const close = useSheetClose();
  const router = useRouter();
  const going = useRef(false);

  function choose(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    // A new tab or window is the browser's to open; the sheet stays.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (href === pathname) {
      close();
      return;
    }
    // The sheet's close pops its history entry; the medium's URL is pushed once that has landed,
    // or it would be popped with it, and Back would then have a dead press (RunChip does the same).
    const go = () => {
      if (going.current) return;
      going.current = true;
      router.push(href);
    };
    window.addEventListener("popstate", () => setTimeout(go, 0), { once: true });
    setTimeout(go, 400);
    close();
  }

  return (
    <>
      <ul className="medlist">
        {inGroup(items, "media").map((m) => {
          const here = m.medium === medium;
          return (
            <li key={m.id}>
              <Link href={m.href} className="medrow" onClick={(e) => choose(e, m.href)}
                aria-current={here ? (pathname === m.href ? "page" : "true") : undefined}>
                <Icon name={m.icon} />
                <span className="medrow-name">{m.label}</span>
                {here && <Icon name="check" />}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* A6's line, with Settings → Start on (6.25, TASK-147), which can name the medium / opens. */}
      <p className="medfoot">
        Each medium opens on its dashboard. <span className="mono">/</span> opens the one you used last, unless Settings → Start on names one.
      </p>
    </>
  );
}
