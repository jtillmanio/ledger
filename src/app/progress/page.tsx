import type { Metadata } from "next";
import Link from "next/link";
import OnHold from "@/components/OnHold";
import ProgressRows, { ProgressEmpty } from "@/components/ProgressRows";
import Tablist from "@/components/Tablist";
import { progressRows } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import {
  byMedium, MEDIUMS, parseMedium, parseProgressTab, progressHref, type MediumChip, type ProgressTab,
} from "@/lib/progress";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Progress · Ledger" };

const TAB_NAMES: Record<ProgressTab, string> = { middle: "In the middle of", completed: "Completed" };
const CHIP_NAMES: Record<MediumChip, string> = { all: "All", books: "Books", comics: "Comics" };

/**
 * Progress (task 5.12; mockup `progress`; F-69, D-109): everything you are in the middle of and everything you
 * have completed, books and comics together or one medium at a time (*All · Books · Comics*), the bigger things
 * with their parts nested beneath them (D-119). The tab (`?tab=`) and the chip (`?medium=`) are real links, so a
 * reload keeps both. *On hold* (D-118) is a collapsed group under *In the middle of*. One read, nothing stored
 * (hard rule 2): the rows are `progressRows`, each `read / total` its progress view's.
 */
export default async function ProgressPage({ searchParams }: {
  searchParams: Promise<{ tab?: string | string[]; medium?: string | string[] }>;
}) {
  const [{ tab: askedTab, medium: askedMedium }, userId] = await Promise.all([searchParams, requireUserId()]);
  const tab = parseProgressTab(askedTab);
  const medium = parseMedium(askedMedium);
  const all = await progressRows(userId);
  const middle = byMedium(all.middle, medium);
  const onHold = byMedium(all.onHold, medium);
  const completed = byMedium(all.completed, medium);

  const tabs = (["middle", "completed"] as const).map((t) => ({
    key: t, name: TAB_NAMES[t], href: progressHref(t, medium), count: t === "middle" ? middle.length : completed.length,
  }));

  return (
    <main className="progress-page">
      <div className="series-head">
        <h1>Progress</h1>
        <p className="lede">What you are in the middle of, and what you have finished</p>
      </div>
      <Tablist tabs={tabs} selected={tab} label="Progress" panelId="progress-panel">
        {/* Real links, so the chip is in the URL and keeps the tab; the chosen one carries aria-current. */}
        <div className="filters genre-row prog-chips" role="group" aria-label="Medium">
          {MEDIUMS.map((m) => (
            <Link key={m} prefetch={false} href={progressHref(tab, m)} className="chip" aria-current={m === medium || undefined}>
              {CHIP_NAMES[m]}
            </Link>
          ))}
        </div>
        {tab === "middle" && (
          <>
            {middle.length === 0 ? (
              <ProgressEmpty tab="middle" medium={medium} />
            ) : (
              <ProgressRows rows={middle} tab="middle" label="In the middle of" />
            )}
            {onHold.length > 0 && (
              <OnHold count={onHold.length}>
                <ProgressRows rows={onHold} tab="middle" label="On hold" />
              </OnHold>
            )}
          </>
        )}
        {tab === "completed" && (
          completed.length === 0 ? (
            <ProgressEmpty tab="completed" medium={medium} />
          ) : (
            <ProgressRows rows={completed} tab="completed" label="Completed" />
          )
        )}
      </Tablist>
    </main>
  );
}
