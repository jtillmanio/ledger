"use client";

import { useId, useState } from "react";
import { useUndo } from "@/components/Undo";
import { COVERS_EVENT, writeCoversCookie } from "@/lib/covers";

/**
 * *Show covers* (task 4.3, F-33; mockup `settings`, Appearance): a real switch, on by default, stored
 * per device in the `ledger_covers` cookie (src/lib/covers.ts). `initial` is what the server read
 * from that cookie. A press flips it at once, as the pace steppers do, writes the cookie and tells
 * every cover on the page (`ledger:covers`) to look again. The write is synchronous, so there is no
 * saving state; a cookie that doesn't read back puts the switch back and raises the app's
 * failed-write line with Retry. The knob's side shows the state, not the colour alone.
 */
export default function ShowCovers({ initial }: { initial: boolean }) {
  const undo = useUndo();
  const id = useId();
  const [on, setOn] = useState(initial);

  function set(next: boolean) {
    setOn(next);
    if (writeCoversCookie(next)) {
      window.dispatchEvent(new Event(COVERS_EVENT));
      return;
    }
    setOn(!next);
    undo.fail({
      label: "Couldn't save Show covers. It's back to what it was.",
      retry: () => set(next),
    });
  }

  return (
    <div className="frow">
      <span className="k" id={id}>Show covers</span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={id} className="switch"
        style={{ marginLeft: "auto" }} onClick={() => set(!on)}>
        <b />
      </button>
    </div>
  );
}
