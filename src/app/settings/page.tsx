import type { Metadata } from "next";
import { cookies } from "next/headers";
import PaceSettings from "@/components/PaceSettings";
import SettingsLink from "@/components/SettingsLink";
import ShowCovers from "@/components/ShowCovers";
import { lastCalibreSync, readingSettings, volumeMapCounts } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { lastSyncedRow } from "@/lib/calibre-log";
import { COVERS_COOKIE, coversOn } from "@/lib/covers";
import { easternYear } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings · Ledger" };

/**
 * Settings (task 2.0, F-21; mockup `settings`): *Reading pace*, whose minutes a day and words a
 * minute drive every capacity figure, *Appearance* (task 4.3: *Show covers*, a per-device cookie read
 * here so the switch draws right on the first paint; Theme and Density are 6.11's), and *Data*: the volume map's size, *Calibre* (task 4.4: when it
 * last synced, a link to the log) and *Export everything*, which moved here from the nav. Pace on the
 * left and data on the right from 1024px. The reads go out together and none is cached, so an edit
 * shows on the next render with no redeploy. The volume map's *Edit* is 3.9's.
 */
export default async function Settings() {
  const userId = await requireUserId();
  const [settings, volume, synced, jar] = await Promise.all([
    readingSettings(userId), volumeMapCounts(), lastCalibreSync(), cookies(),
  ]);

  return (
    <main className="settings">
      <div className="settings-2up">
        <div>
          <h1 className="t">Settings</h1>
          <h2 className="s">Reading pace</h2>
          <PaceSettings initial={settings} year={easternYear()} />
          <h2 className="s">Appearance</h2>
          <div className="group">
            <ShowCovers initial={coversOn(jar.get(COVERS_COOKIE)?.value)} />
          </div>
        </div>
        <div>
          <h2 className="s">Data</h2>
          <div className="group">
            <div className="frow">
              <span className="k">Volume map</span>
              <span className="v">{volume.rules} {volume.rules === 1 ? "rule" : "rules"} &middot; {volume.series} series</span>
            </div>
            <SettingsLink href="/settings/calibre" name="Calibre" sub={lastSyncedRow(synced)} />
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
