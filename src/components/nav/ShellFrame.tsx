"use client";

import { usePathname } from "next/navigation";
import { mediumOf } from "@/lib/last-medium";
import { IconSprite } from "./Icons";
import MediaBar from "./MediaBar";
import NavRail from "./NavRail";
import Sidebar from "./Sidebar";
import SyncPill from "./SyncPill";

// The chrome around every screen but sign-in: a signed-out visitor can open
// none of these links, and each <Link> prefetches its route, which the passcode
// gate answers with a redirect back to /login, so the sign-in page fetched pages
// it could not show (and went over its Lighthouse budget).
//
// Which of the three navs shows is CSS alone (media queries in globals.css), so
// nothing flashes at hydration and the server sends all three. `data-medium`
// sets --m, the medium's accent, for the current-item bar and the media underline.
export default function ShellFrame({ inbox, children }: { inbox: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;
  return (
    <div className="app" data-medium={mediumOf(pathname) ?? undefined}>
      <IconSprite />
      <MediaBar />
      <SyncPill strip />
      <NavRail inbox={inbox} />
      <Sidebar inbox={inbox} />
      <div className="content">{children}</div>
    </div>
  );
}
