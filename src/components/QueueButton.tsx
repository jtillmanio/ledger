"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUndo } from "@/components/Undo";
import { QUEUE_HREF } from "@/lib/status-tabs";


/**
 * One call to `/api/queue` (task 1.10). Resolves with the run's ordinal, and
 * rejects when the write didn't save, so the caller can say so and offer Retry.
 */
export async function queueCall(
  method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>,
): Promise<{ ordinal: number; added?: boolean }> {
  const res = await fetch("/api/queue", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`queue ${method} ${res.status}`);
  return res.json();
}

/**
 * *+ Up next* (appends) and, with `top`, *Read next* (goes to the top): the run
 * detail offers both, a run-list row and a *Ready when you are* row offer the
 * first. A run already queued shows *In Up next · #N* instead, a link to the
 * queue. Adding pushes an undo entry whose inverse takes it off again.
 */
export default function QueueButton({ runId, title, ordinal, top = false }: {
  runId: string; title: string; ordinal: number | null; top?: boolean;
}) {
  const router = useRouter();
  const undo = useUndo();
  const [at, setAt] = useState<number | null>(ordinal);
  const [busy, setBusy] = useState(false);
  // A refresh brings the server's ordinal; until it lands, the one the write answered.
  const shown = ordinal ?? at;

  async function add(where: "end" | "top") {
    setBusy(true);
    try {
      const { ordinal: placed } = await queueCall("POST", { runId, at: where });
      setAt(placed);
      undo.push({
        label: `${title} in Up next`, detail: `#${placed}`,
        undo: async () => {
          await queueCall("DELETE", { runId });
          setAt(null);
          router.refresh();
        },
      });
      router.refresh();
    } catch {
      undo.fail({ label: `Couldn't add ${title} to Up next.`, retry: () => void add(where) });
    } finally {
      setBusy(false);
    }
  }

  if (shown !== null) {
    return (
      <Link href={QUEUE_HREF} className="queued">
        In Up next · <span className="mono">#{shown}</span>
      </Link>
    );
  }
  return (
    <span className="queue-verbs">
      <button type="button" className="btn sec sm" aria-disabled={busy || undefined}
              aria-label={`Add ${title} to Up next`} onClick={() => !busy && void add("end")}>
        + Up next
      </button>
      {top && (
        <button type="button" className="btn sec sm" aria-disabled={busy || undefined}
                aria-label={`Read ${title} next`} onClick={() => !busy && void add("top")}>
          Read next
        </button>
      )}
    </span>
  );
}
