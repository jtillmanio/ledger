import Link from "next/link";
import type { ParkedReview } from "@/db/queries";

/**
 * The parked review's reminder, in the app (task 5.15, TASK-111, D-105; owner, 2026-11-02; mockup `bdash`):
 * one grey line in the books dashboard's rollup slot, *Review 9 parked →*, linking to `/parked`, drawn only
 * when the review is due (`reviewDue`, through `parkedReview`). No nudge copy, never a state colour: it sits
 * after *Coming out*'s line and before the progress link, as the frame draws it.
 */
export default function ParkedReviewLine({ review }: { review: Pick<ParkedReview, "due" | "parked"> }) {
  if (!review.due) return null;
  return (
    <p className="parked-line">
      <Link href="/parked" prefetch={false}>Review {review.parked.toLocaleString()} parked <span aria-hidden="true">→</span></Link>
    </p>
  );
}
