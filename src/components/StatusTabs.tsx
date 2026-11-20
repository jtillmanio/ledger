"use client";

import { TABS, type StatusTab } from "@/lib/status-tabs";
import Tablist from "./Tablist";

/** One count per tab: the rows that tab draws (task 1.9), never a number of its own. */
export type TabCounts = Record<StatusTab, number>;

const NAMES: Record<StatusTab, string> = { inflight: "In flight", next: "Up next", done: "Done" };

/**
 * The three-tab status screen's strip and its panel (task 1.9; design §11.2, STYLE_GUIDE §9 *Status tablist*),
 * the same for every medium: *In flight · Up next · Done*, in that order and under those names, each with its
 * row count in mono. The tabs are links, so the tab is in the URL (`?tab=`); the strip itself is `Tablist`
 * (shared with `/progress`, task 5.12).
 */
export default function StatusTabs({ base, tab, counts, children }: {
  base: string; tab: StatusTab; counts: TabCounts; children: React.ReactNode;
}) {
  const tabs = TABS.map((t) => ({ key: t, name: NAMES[t], href: `${base}?tab=${t}`, count: counts[t] }));
  return <Tablist tabs={tabs} selected={tab} label="Status" panelId="status-panel">{children}</Tablist>;
}
