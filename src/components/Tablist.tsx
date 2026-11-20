"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";

/** One tab of a `Tablist`: its key, its name, the URL that opens it and the count of rows it draws. */
export type TabSpec = { key: string; name: string; href: string; count: number };

/**
 * A strip of tabs and its panel (STYLE_GUIDE §9 *Status tablist*), the one the status screens (task 1.9) and
 * `/progress` (task 5.12) share: each tab a link, so the tab is in the URL and a reload or the back button
 * keeps it; ←/→/Home/End move focus along the strip and open that tab. Each tab names its row count in mono.
 * Only the selected tab has a panel (the page sends that tab's rows as `children`), so only it names its
 * panel. One 2px underline in the medium's hue is a single element that slides between tabs by `--i`, one
 * tab's width being `100% / --n`; under reduced motion `--dur-2` is 0 and it just moves.
 */
export default function Tablist({ tabs, selected, label, panelId, children }: {
  tabs: readonly TabSpec[]; selected: string; label: string; panelId: string; children: React.ReactNode;
}) {
  const router = useRouter();
  const links = useRef(new Map<string, HTMLAnchorElement>());

  function onKeyDown(e: React.KeyboardEvent, at: number) {
    const to = e.key === "ArrowRight" ? (at + 1) % tabs.length
      : e.key === "ArrowLeft" ? (at + tabs.length - 1) % tabs.length
        : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = tabs[to];
    links.current.get(next.key)?.focus();
    router.replace(next.href, { scroll: false });
  }

  const at = Math.max(0, tabs.findIndex((t) => t.key === selected));
  return (
    <>
      <div className="tabs" role="tablist" aria-label={label} style={{ "--i": at, "--n": tabs.length } as React.CSSProperties}>
        {tabs.map((t, i) => (
          <Link
            key={t.key}
            ref={(el) => { if (el) links.current.set(t.key, el); else links.current.delete(t.key); }}
            prefetch={false}
            href={t.href}
            replace
            scroll={false}
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={t.key === selected}
            aria-controls={t.key === selected ? panelId : undefined}
            tabIndex={t.key === selected ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {t.name} <span className="n mono">{t.count}</span>
          </Link>
        ))}
        <span className="tab-ink" aria-hidden="true" />
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={`tab-${selected}`}>{children}</div>
    </>
  );
}
