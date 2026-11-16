import Link from "next/link";
import { syncLine } from "@/lib/calibre-log";

/**
 * The books dashboard's one plain line when the last Calibre sync is old (task 4.4, D-133):
 * *Calibre last synced 9 days ago*, a link to the *Calibre* page, once the last run is more than
 * seven Eastern days back. Nothing at seven days or fewer, and nothing before any run. Grey, never
 * red (nothing on a dashboard is, design § 10): it says a thing is late, it doesn't raise an alarm.
 */
export default function CalibreSyncLine({ ranAt, now }: { ranAt: string | null; now?: Date }) {
  const line = syncLine(ranAt, now);
  if (!line) return null;
  return (
    <p className="sync-line">
      <Link href="/settings/calibre" prefetch={false} className="sync-link">{line}</Link>
    </p>
  );
}
