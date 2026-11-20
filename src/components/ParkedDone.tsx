"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";

/**
 * *Done reviewing* (task 5.15, TASK-111, D-105; mockup `parked`): records the review on today's Eastern day
 * through TASK-110's `POST /api/parked/review`, whatever is left parked, so the dashboard's line and the
 * Inbox's row go until the cadence comes round. Its Undo sends the answer back (`DELETE`), which puts the
 * last review before back. A failed save says so in a neutral line, never red, with **Retry**.
 */
export default function ParkedDone({ parked }: { parked: number }) {
  const router = useRouter();
  const { push } = useUndo();
  const [phase, setPhase] = useState<"idle" | "saving" | "failed">("idle");

  async function done() {
    if (phase === "saving") return;
    setPhase("saving");
    try {
      const res = await fetch("/api/parked/review", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const { change } = await res.json() as { change: unknown };
      push({
        label: "Review done", detail: parked === 0 ? "Nothing left parked" : `${parked.toLocaleString()} still parked`,
        undo: async () => {
          const back = await fetch("/api/parked/review", {
            method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ change }),
          });
          if (!back.ok) throw new Error(String(back.status));
          router.refresh();
        },
      });
      setPhase("idle");
      router.refresh();
    } catch {
      setPhase("failed");
    }
  }

  return (
    <div className="parked-done">
      <button type="button" className="btn" aria-disabled={phase === "saving" || undefined} onClick={() => void done()}>
        {phase === "saving" ? "Saving…" : "Done reviewing"}
      </button>
      {phase === "failed" && (
        <p className="neutral-error" role="alert">
          <span aria-hidden="true">×</span> Couldn&apos;t record the review. Nothing changed.{" "}
          <button type="button" className="btn sec sm" onClick={() => void done()}>Retry</button>
        </p>
      )}
    </div>
  );
}
