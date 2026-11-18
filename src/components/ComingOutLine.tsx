import Link from "next/link";
import type { WantedRelease } from "@/db/queries";

/** What the line counts: wanted books out now, and those due later this month. */
export type ComingOutCounts = { out: number; month: number };

/**
 * The line's two counts, from the rows `/books/releases` lists (`wantedReleases`, task 5.7), so the two can't
 * disagree: *out now* is the page's *Out now* group, *coming this month* its group for `today`'s month (the
 * Eastern day, D-67), which holds only days after today.
 */
export function comingOutCounts(rows: Pick<WantedRelease, "grp">[], today: string): ComingOutCounts {
  const month = today.slice(0, 7);
  return {
    out: rows.filter((r) => r.grp === "out").length,
    month: rows.filter((r) => r.grp === month).length,
  };
}

/**
 * *Notify me*, in the app (task 5.7, D-35; mockup `bdash`): one grey line in the books dashboard's rollup slot,
 * *2 out now · 3 coming this month →*, linking to Coming out. A zero part is left out, and with both zero
 * there is no line (owner, at TASK-100's plan gate). Never a state colour.
 */
export default function ComingOutLine({ out, month }: ComingOutCounts) {
  const parts = [out > 0 && `${out} out now`, month > 0 && `${month} coming this month`].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <p className="coming-out">
      <Link href="/books/releases" prefetch={false}>{parts.join(" · ")} <span aria-hidden="true">→</span></Link>
    </p>
  );
}
