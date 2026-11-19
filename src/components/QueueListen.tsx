"use client";

import { useQueueListen } from "@/lib/listen-queue";

/**
 * *Queue to listen* as a button of its own (task 5.14): the book sheet's
 * *Listen next* line in *Your record*. The same write, toast and undo as the
 * Library row's `⋯` (`useQueueListen`); a book already queued stays where it is.
 */
export default function QueueListen({ bookId, title }: { bookId: string; title: string }) {
  const queue = useQueueListen();
  return (
    <button type="button" className="btn sec sm" aria-label={`Queue to listen: ${title}`}
      onClick={() => void queue(bookId, title)}>
      Queue to listen
    </button>
  );
}
