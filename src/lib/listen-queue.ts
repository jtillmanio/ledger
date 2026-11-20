"use client";

import { useRouter } from "next/navigation";
import { useUndo } from "@/components/Undo";
import { LISTEN_NEXT } from "@/lib/status-tabs";

/**
 * The listen queue from the screen (task 5.14, F-59): one call to
 * `/api/listen-queue` (TASK-106) and the *Queue to listen* verb, which the
 * Library row's `⋯`, Add books' results and the book sheet share.
 */

/** One call; answers the body. Rejects when it didn't save. */
export async function listenCall(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
  const res = await fetch("/api/listen-queue", {
    method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`listen-queue ${method} ${res.status}`);
  return (await res.json()) as { position: number; added?: boolean; from?: number };
}

/**
 * *Queue to listen*: the book joins the end of *Listen next*, the toast says
 * *Added to Listen next* with the title, and its Undo takes it off again. A book
 * already queued stays where it is: *Already in Listen next*, nothing to undo.
 * The page is refreshed either way, so an open Up next redraws. The toast never
 * prints the stored position: a soft-deleted book's row may hold a place the
 * screen doesn't draw (TASK-106).
 */
export function useQueueListen() {
  const router = useRouter();
  const { push, notify, fail } = useUndo();
  return async function queue(bookId: string, title: string) {
    try {
      const { added } = await listenCall("POST", { bookId });
      router.refresh();
      if (!added) {
        notify(`Already in ${LISTEN_NEXT}`, title);
        return;
      }
      push({
        label: `Added to ${LISTEN_NEXT}`,
        detail: title,
        undo: async () => {
          await listenCall("DELETE", { bookId });
          router.refresh();
        },
      });
    } catch {
      fail({ label: `Couldn't queue ${title}. Nothing changed.`, retry: () => void queue(bookId, title) });
    }
  };
}
