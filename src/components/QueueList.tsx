"use client";

import Link from "next/link";
import QueueBadge from "@/components/QueueBadge";
import { queueCall } from "@/components/QueueButton";
import ReorderList from "@/components/ReorderList";
import type { QueueRow } from "@/db/queries";

/**
 * The reorderable Up next queue (task 1.10; mockup `queue`): the comics half of
 * `ReorderList`, the one queue row the dashboard's *Reorder* and the status
 * screen's Up next tab share (M-08). A row is the cover placeholder, the title,
 * its readiness badge and credits, and *Start* on the first. *Remove* is a hard
 * delete of the queue row whose undo puts the run back at its old ordinal.
 */
export default function QueueList({ rows }: { rows: QueueRow[] }) {
  return (
    <ReorderList
      rows={rows}
      move={async (id, to) => { await queueCall("PATCH", { runId: id, to }); }}
      remove={{
        label: "Remove from Up next",
        toast: (title) => `Removed ${title} from Up next`,
        run: async (id) => {
          const { ordinal } = await queueCall("DELETE", { runId: id });
          return async () => { await queueCall("POST", { runId: id, restore: ordinal }); };
        },
      }}
      renderBody={(r, i) => (
        <>
          <span className="cv none" aria-hidden="true" />
          <span className="qbody">
            <Link href={`/comics/${r.id}`} className="qtitle">{r.title}</Link>
            <span className="qmeta">
              <QueueBadge readiness={r.readiness} blockedBy={r.blocked_by} softLeft={r.soft_left} />
              {r.writers && <span className="mono">{r.writers}</span>}
            </span>
          </span>
          {i === 0 && (
            <Link href={`/comics/${r.id}#p-1`} className="btn sec sm" aria-label={`Start ${r.title}`}>Start</Link>
          )}
        </>
      )}
    />
  );
}
