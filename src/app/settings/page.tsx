import type { Metadata } from "next";
import PaceSettings from "@/components/PaceSettings";
import { readingSettings, volumeMapCounts } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { easternYear } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · Ledger" };

/**
 * Settings (task 2.0, F-21; mockup `settings`): *Reading pace*, whose minutes a day and words a
 * minute drive every capacity figure, and *Data*: the volume map's size and *Export everything*,
 * which moved here from the nav. Pace on the left and data on the right from 1024px. Both reads go
 * out together and neither is cached, so an edit shows on the next render with no redeploy. The
 * volume map's *Edit* is 3.9's.
 */
export default async function Settings() {
  const userId = await requireUserId();
  const [settings, volume] = await Promise.all([readingSettings(userId), volumeMapCounts()]);

  return (
    <main className="settings">
      <div className="settings-2up">
        <div>
          <h1 className="t">Settings</h1>
          <h2 className="s">Reading pace</h2>
          <PaceSettings initial={settings} year={easternYear()} />
        </div>
        <div>
          <h2 className="s">Data</h2>
          <div className="group">
            <div className="frow">
              <span className="k">Volume map</span>
              <span className="v">{volume.rules} {volume.rules === 1 ? "rule" : "rules"} &middot; {volume.series} series</span>
            </div>
            <div className="frow">
              <span className="kv">
                <span className="k">Export everything</span>
                <span className="small faint">JSON, all tables</span>
              </span>
              {/* A route handler: a plain <a>, never a <Link>, whose prefetch would build the export (task 0.9). */}
              <a href="/api/export" className="btn sec sm" aria-label="Download everything as JSON">Download</a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
