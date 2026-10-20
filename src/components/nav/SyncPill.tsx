"use client";

import { useSyncExternalStore } from "react";

// Whether the browser thinks it has a network. `online` and `offline` are the
// only states: `queued` and its per-row tag arrive with the offline queue (6.4)
// and are not faked before then (R1-07).
const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};
const snapshot = () => navigator.onLine;
// The server and the first client render agree on online, so nothing mismatches.
const serverSnapshot = () => true;

/**
 * A 6px dot (`--ready` online, `--blocked` offline) and --ink-2 text: never green text on glass.
 * `strip` is the phone's form: empty while online, a line under the bar when offline
 * (mockups-index "Not shown" #7). Both are a status, so a change is announced.
 */
export default function SyncPill({ strip = false }: { strip?: boolean }) {
  const online = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const state = online ? "online" : "offline";
  if (strip) {
    return (
      <div role="status" className="sync-strip" data-state={state}>
        {online ? null : <><i aria-hidden="true" /><span>offline</span></>}
      </div>
    );
  }
  return (
    <span role="status" className="sync" data-state={state}>
      <i aria-hidden="true" /><span className="nl">{state}</span>
    </span>
  );
}
