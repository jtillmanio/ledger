import { db, bookStatus } from "./index";

export type BookStatusInput = {
  bookId: string;
  status: string;
  /** undefined = leave as is; null = clear it. */
  finishedYear?: number | null;
  rating?: number | null;
};

/**
 * Upsert a book's status. Only fields present in the input are written: a bare
 * status change must not wipe an existing rating or finish year (R0-C1).
 */
export async function saveBookStatus(userId: string, input: BookStatusInput) {
  const { bookId, status, finishedYear, rating } = input;
  const optional = {
    ...(finishedYear !== undefined && { finishedYear }),
    ...(rating !== undefined && { rating }),
  };
  await db
    .insert(bookStatus)
    .values({ userId, bookId, status, ...optional })
    .onConflictDoUpdate({
      target: [bookStatus.userId, bookStatus.bookId],
      set: { status, ...optional },
    });
}
