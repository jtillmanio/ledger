"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { mediumOf, type Medium } from "@/lib/last-medium";
import { IconSprite } from "./Icons";
import { NAV_ITEMS, withLastRun } from "./items";
import MediaBar from "./MediaBar";
import NavRail from "./NavRail";
import Sidebar from "./Sidebar";
import SyncPill from "./SyncPill";

// The run comics Add lands on (1.19). The server's cookie read streams in
// (`remembered`, from LastRun), and an insert on Add issues says so at once
// (`added`): the root layout isn't drawn again on a client navigation, so the
// cookie alone would leave the link stale until a reload. An add wins over a
// read that streams in after it.
type LastRunApi = { remembered: (runId: string) => void; added: (runId: string) => void };
const LastRunContext = createContext<LastRunApi>({ remembered: () => {}, added: () => {} });

/** Tells the nav which run was just added to, so comics Add lands on it. */
export const useLastRunAdded = () => useContext(LastRunContext).added;

/** The server's remembered run, handed to the nav once it streams in. Draws nothing. */
export function RememberRun({ runId }: { runId: string }) {
  const { remembered } = useContext(LastRunContext);
  useEffect(() => remembered(runId), [remembered, runId]);
  return null;
}

// The medium the tab row draws on a screen with none (/inbox, /settings; 2.2i). The server's
// cookie read streams in (`RememberMedium`); the medium you visited since the page loaded wins
// over it, because the root layout isn't drawn again on a client navigation.
const LastMediumContext = createContext<(medium: Medium) => void>(() => {});

/** The server's last medium, handed to the nav once it streams in. Draws nothing. */
export function RememberMedium({ medium }: { medium: Medium }) {
  const remember = useContext(LastMediumContext);
  useEffect(() => remember(medium), [remember, medium]);
  return null;
}

// The chrome around every screen but sign-in: a signed-out visitor can open
// none of these links, and each <Link> prefetches its route, which the passcode
// gate answers with a redirect back to /login, so the sign-in page fetched pages
// it could not show (and went over its Lighthouse budget).
//
// Which of the three navs shows is CSS alone (media queries in globals.css), so
// nothing flashes at hydration and the server sends all three. `data-medium`
// sets --m, the medium's accent, for the current-item bar and the media underline.
export default function ShellFrame({ inbox, lastRun, lastMedium, children }: {
  inbox: React.ReactNode; lastRun?: React.ReactNode; lastMedium?: React.ReactNode; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [cookieMedium, setCookieMedium] = useState<Medium | null>(null);
  const [visited, setVisited] = useState<Medium | null>(null);
  const here = mediumOf(pathname);
  if (here && here !== visited) setVisited(here);
  const [run, setRun] = useState<{ id: string | null; added: boolean }>({ id: null, added: false });
  const remembered = useCallback((id: string) => setRun((r) => (r.added ? r : { id, added: false })), []);
  const added = useCallback((id: string) => setRun({ id, added: true }), []);
  const api = useMemo(() => ({ remembered, added }), [remembered, added]);
  const items = useMemo(() => withLastRun(NAV_ITEMS, run.id), [run.id]);
  return (
    <LastRunContext.Provider value={api}>
      <LastMediumContext.Provider value={setCookieMedium}>
      {pathname === "/login" ? children : (
        <div className="app" data-medium={mediumOf(pathname) ?? undefined}>
          <IconSprite />
          {lastRun}
          {lastMedium}
          <MediaBar items={items} lastMedium={visited ?? cookieMedium} />
          <SyncPill strip />
          <NavRail items={items} inbox={inbox} />
          <Sidebar items={items} inbox={inbox} />
          <div className="content">{children}</div>
        </div>
      )}
      </LastMediumContext.Provider>
    </LastRunContext.Provider>
  );
}
