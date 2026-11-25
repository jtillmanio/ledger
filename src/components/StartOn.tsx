"use client";

import { useState } from "react";
import ChipMenu from "@/components/ChipMenu";
import { useUndo } from "@/components/Undo";
import { MEDIA, writeStartCookie, type StartChoice } from "@/lib/last-medium";

const WORDS: Record<StartChoice, string> = { last: "Last used", comics: "Comics", books: "Books", watch: "Watch" };
/** *Last used*, then one per built medium: music and games join when 9.0 and 10.0 add them to `MEDIA`. */
const CHOICES: StartChoice[] = ["last", ...MEDIA];

/**
 * *Start on* (task 6.25, TASK-147, MR-D7, D-178; mockup `settings`, Appearance, frame E17): where `/` opens.
 * *Last used* (the default) follows the medium you visited last; a medium always opens there. A dropdown chip
 * that names its choice, the stored one `aria-current` in the list. Per device, in the `ledger_start` cookie
 * (src/lib/last-medium.ts), read by the server so the chip draws right on the first paint (`initial`) and by
 * `/` (src/app/route.ts). A choice shows at once and writes the cookie synchronously, as *Show covers* does;
 * a cookie that doesn't read back puts the chip back and raises the app's failed-write line with Retry. Nothing
 * goes to the database.
 */
export default function StartOn({ initial }: { initial: StartChoice }) {
  const undo = useUndo();
  const [choice, setChoice] = useState<StartChoice>(initial);

  function set(next: StartChoice, before: StartChoice) {
    setChoice(next);
    if (writeStartCookie(next)) return;
    setChoice(before);
    undo.fail({
      label: "Couldn't save Start on. It's back to what it was.",
      retry: () => set(next, before),
    });
  }

  return (
    <div className="frow">
      <span className="k">Start on</span>
      <span style={{ marginLeft: "auto" }}>
        <ChipMenu text={WORDS[choice]} name={`Start on: ${WORDS[choice]}`} group="Start on" align="end"
          choices={CHOICES.map((c) => ({ label: WORDS[c], current: c === choice, onSelect: () => set(c, choice) }))} />
      </span>
    </div>
  );
}
