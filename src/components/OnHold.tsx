"use client";

import { useState } from "react";

/**
 * *On hold* (task 5.12, D-118): the things followed *Tracking* that are part-read, a collapsed group under
 * *In the middle of* with its count. A real button with `aria-expanded` opens it; the rows come from the
 * server as `children`, so closed they are `hidden`, not absent, and not read as part of the page.
 */
export default function OnHold({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="prog-hold" aria-labelledby="hold-head" data-hold={open ? "open" : "closed"}>
      <h2 id="hold-head" className="group-head">
        <button type="button" className="prog-hold-btn" aria-expanded={open} aria-controls="hold-rows"
                onClick={() => setOpen((o) => !o)}>
          <span className="prog-hold-chev" aria-hidden="true">&#8250;</span>
          On hold <span className="mono n">{count}</span>
        </button>
      </h2>
      <div id="hold-rows" hidden={!open}>{children}</div>
    </section>
  );
}
