"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { TABS, type StatusTab } from "@/lib/status-tabs";

/** One count per tab: the rows that tab draws (task 1.9), never a number of its own. */
export type TabCounts = Record<StatusTab, number>;

const NAMES: Record<StatusTab, string> = { inflight: "In flight", next: "Up next", done: "Done" };

/**
 * The three-tab status screen's strip and its panel (task 1.9; design §11.2,
 * STYLE_GUIDE §9 *Status tablist*), the same for every medium: *In flight · Up
 * next · Done*, in that order and under those names, each with its row count in
 * mono. The tabs are links, so the tab is in the URL (`?tab=`) and a reload or
 * the back button keeps it; ←/→/Home/End move focus along the strip and open
 * that tab. Only the selected tab has a panel (the page sends that tab's rows
 * as `children`), so only it names its panel. One 2px underline in the medium's
 * hue is a single element that slides between tabs; under reduced motion
 * `--dur-2` is 0 and it just moves.
 */
export default function StatusTabs({ base, tab, counts, children }: {
  base: string; tab: StatusTab; counts: TabCounts; children: React.ReactNode;
}) {
  const router = useRouter();
  const links = useRef(new Map<StatusTab, HTMLAnchorElement>());
  const href = (t: StatusTab) => `${base}?tab=${t}`;

  function onKeyDown(e: React.KeyboardEvent, at: number) {
    const to = e.key === "ArrowRight" ? (at + 1) % TABS.length
      : e.key === "ArrowLeft" ? (at + TABS.length - 1) % TABS.length
        : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    const next = TABS[to];
    links.current.get(next)?.focus();
    router.replace(href(next), { scroll: false });
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Status" style={{ "--i": TABS.indexOf(tab) } as React.CSSProperties}>
        {TABS.map((t, i) => (
          <Link
            key={t}
            ref={(el) => { if (el) links.current.set(t, el); else links.current.delete(t); }}
            prefetch={false}
            href={href(t)}
            replace
            scroll={false}
            role="tab"
            id={`tab-${t}`}
            aria-selected={t === tab}
            aria-controls={t === tab ? "status-panel" : undefined}
            tabIndex={t === tab ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {NAMES[t]} <span className="n mono">{counts[t]}</span>
          </Link>
        ))}
        <span className="tab-ink" aria-hidden="true" />
      </div>
      <div id="status-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>{children}</div>
    </>
  );
}
