"use client";

import { createContext, useContext, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BatchSheet, { type Upcoming } from "@/components/BatchSheet";
import MarkButton from "@/components/MarkButton";
import type { RangeChoice } from "@/components/RangeSheet";
import { useUndo } from "@/components/Undo";
import { Icon } from "@/components/nav/Icons";
import { NAV_ITEMS } from "@/components/nav/items";
import { issueName } from "@/lib/format";
import { markPlacement, markRangeRead } from "@/lib/mark";

export type { Upcoming };

/**
 * What the three slots hold (D-25, task 1.8b). Slot 1 is the medium's mark
 * verb, primary; slot 2 its second verb; slot 3 search, or `+` Add issues on the
 * run detail. What differs between media is what fills a slot, not the slot.
 */
export type BarConfig =
  /** A comics dashboard with a run in hand: Mark #141 read · + batch · Search. */
  | { kind: "comics"; runId: string; title: string; read: number; total: number; upcoming: Upcoming[]; single: boolean }
  /** The run detail: Mark #141 read · Mark through… · + (Add issues). The page owns the rows, so it owns the writes. */
  | {
    kind: "run"; runId: string; title: string; upcoming: Upcoming[]; single: boolean;
    onMark: () => Promise<boolean>;
    onRange: (ids: number[], choice: RangeChoice) => Promise<void>;
  }
  /** Nothing in hand: Search · Start {next}, with no batch or finish verb. */
  | { kind: "empty"; verb: { label: string; href: string } }
  /** Books (2.2): Log progress · ✓ finished. Built here, drawn by the dashboard that 2.2 adds. */
  | { kind: "books" }
  /** Watch (8.7): Mark S2 watched · + Add. Built here, drawn by the dashboard that 8.7 adds. */
  | { kind: "watch" };

type Sheet = { start: "batch" | "through"; opener: HTMLElement | null };
type Api = { slots: (where: "bar" | "header") => { primary: React.ReactNode; second: React.ReactNode; third: React.ReactNode } };

const VerbsContext = createContext<Api | null>(null);

function useVerbs() {
  const ctx = useContext(VerbsContext);
  if (!ctx) throw new Error("HeaderVerbs and ThumbBar need a <VerbsProvider> above them");
  return ctx;
}

/** The mark verb for the next unread placement: what it says at rest and once marked. */
export function markVerb(next: Upcoming | undefined, single: boolean) {
  if (!next) return { idle: "All read", done: "All read" };
  const name = issueName(next.label, single);
  return { idle: `Mark ${name} read`, done: `✓ ${name} read` };
}

// Search is 6.1: until the item is enabled the slot is drawn and says why it does nothing.
const SEARCH = NAV_ITEMS.find((i) => i.id === "search");

function SearchVerb() {
  if (SEARCH?.enabled) {
    return (
      <Link href={SEARCH.href} className="iconbtn" aria-label="Search (Ctrl K)" title="Search (Ctrl K)">
        <Icon name="search" />
      </Link>
    );
  }
  return (
    <button type="button" className="iconbtn" aria-label="Search (Ctrl K)" aria-disabled="true" title="Search isn't built yet">
      <Icon name="search" />
    </button>
  );
}

/** A verb whose screen doesn't exist yet: drawn in its slot, `aria-disabled`, with the reason as its title. */
function Waiting({ label, reason, secondary }: { label: string; reason: string; secondary?: boolean }) {
  return (
    <button type="button" className={secondary ? "btn sec" : "btn"} aria-disabled="true" title={reason}>
      <span className="verb-text">{label}</span>
    </button>
  );
}

/**
 * One owner of the verbs for a screen, read by two places: the page header from
 * 1024px (`HeaderVerbs`) and the bottom bar below it (`ThumbBar`). Both are in
 * the markup and CSS chooses (D-77), so the state, the batch sheet and the
 * mark's writes are kept once, here. A dashboard wraps its `main` and its bar
 * in one; the run detail does the same around its spine.
 */
export function VerbsProvider({ config, refresh = () => {}, children }: {
  config: BarConfig;
  /** Fetches the page again after a write lands or is undone: a dashboard's counts follow the mark. */
  refresh?: () => void;
  children: React.ReactNode;
}) {
  const undo = useUndo();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const open = (start: Sheet["start"]) => (e: React.MouseEvent<HTMLButtonElement>) =>
    setSheet({ start, opener: e.currentTarget });

  const live = config.kind === "comics" || config.kind === "run" ? config : null;
  const first = live?.upcoming[0];
  const verb = live ? markVerb(first, live.single) : null;

  async function onMark() {
    if (config.kind === "run") return config.onMark();
    if (config.kind !== "comics" || !first) return false;
    const name = issueName(first.label, config.single);
    return markPlacement({
      placementId: first.placement_id, completed: true,
      label: `${name} read`, detail: `${config.read + 1} of ${config.total} in ${config.title}`,
      onSaved: refresh, onUndone: refresh,
    }, undo);
  }

  function range(ids: number[], choice: object) {
    if (config.kind === "run") return config.onRange(ids, choice as RangeChoice);
    if (config.kind !== "comics") return Promise.reject(new Error("no run"));
    return markRangeRead({
      runId: config.runId, ids, choice, title: config.title, read: config.read, total: config.total,
      onChange: refresh,
    }, undo);
  }

  const slots: Api["slots"] = (where) => {
    // Books name the same two verbs differently in the header than on the bar (design 14.6).
    const header = where === "header";
    switch (config.kind) {
      case "comics":
      case "run":
        return {
          primary: <MarkButton idle={verb!.idle} done={verb!.done} onMark={onMark} disabled={!first} />,
          second: config.kind === "comics"
            ? (
              <button type="button" className="btn sec" aria-haspopup="dialog" onClick={open("batch")}>
                <span className="verb-text">+ batch</span>
              </button>
            )
            : (
              <button type="button" className="btn sec" aria-haspopup="dialog" onClick={open("through")}>
                <span className="verb-text">Mark through…</span>
              </button>
            ),
          third: config.kind === "comics"
            ? <SearchVerb />
            // No prefetch: the add screen's queries wait for the tap (task 1.3c).
            : (
              <Link prefetch={false} href={`/comics/${encodeURIComponent(config.runId)}/add`} className="iconbtn" aria-label="Add issues" title="Add issues">
                <Icon name="plus" />
              </Link>
            ),
        };
      case "empty":
        return {
          primary: (
            <Link href={config.verb.href} className="btn" title={config.verb.label} aria-label={config.verb.label}>
              <span className="verb-text">{config.verb.label}</span>
            </Link>
          ),
          second: null,
          third: <SearchVerb />,
        };
      case "books":
        return {
          primary: <Waiting label={header ? "Log pages" : "Log progress"} reason="The books dashboard arrives in 2.2" />,
          second: <Waiting secondary label={header ? "Finished it" : "✓ finished"} reason="The books dashboard arrives in 2.2" />,
          third: <SearchVerb />,
        };
      case "watch":
        return {
          primary: <Waiting label="Mark S2 watched" reason="Watch arrives in 8.7" />,
          second: <Waiting secondary label="+ Add" reason="Watch arrives in 8.7" />,
          third: <SearchVerb />,
        };
    }
  };

  return (
    <VerbsContext.Provider value={{ slots }}>
      {children}
      {sheet && live && (
        <BatchSheet
          start={sheet.start}
          title={live.title}
          upcoming={live.upcoming}
          single={live.single}
          opener={sheet.opener}
          onClose={() => setSheet(null)}
          onNext={(ids) => range(ids, { mode: "today" })}
          onThrough={range}
        />
      )}
    </VerbsContext.Provider>
  );
}

/** `VerbsProvider` for a server-rendered dashboard: its data is the page's, so a mark refreshes the page. */
export function DashboardVerbs({ config, children }: { config: BarConfig; children: React.ReactNode }) {
  const router = useRouter();
  return <VerbsProvider config={config} refresh={() => router.refresh()}>{children}</VerbsProvider>;
}

/**
 * The page header's verbs from 1024px (STYLE_GUIDE §14.6): the same three slots
 * in the reverse order, primary last, so *Search · + batch · Mark #141 read*.
 * Hidden below 1024px by CSS, where the bottom bar has them.
 */
export function HeaderVerbs() {
  const { primary, second, third } = useVerbs().slots("header");
  return <div className="headverbs">{third}{second}{primary}</div>;
}

/**
 * The thumb bar (task 1.8b): fixed at the bottom of every dashboard and the run
 * detail, 44px targets, the mark verb first. A dashboard shows it from phone to
 * tablet and the header takes over at 1024px; the run detail keeps it at every
 * width (D-25, D-33). `variant` is that difference for CSS.
 */
export function ThumbBar({ variant }: { variant: "dash" | "run" }) {
  const { primary, second, third } = useVerbs().slots("bar");
  return <div className={`actionbar thumb ${variant}`}>{primary}{second}{third}</div>;
}
