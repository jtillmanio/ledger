import { notFound } from "next/navigation";
import BookDetail from "@/components/BookDetail";
import { bookDetail } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The book sheet's content (task 3.5): the same `BookDetail` the full page draws, under the sheet's `h2`. */
export default async function BookSheet({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const book = await bookDetail(await requireUserId(), id);
  if (!book) notFound();
  return <BookDetail book={book} as="sheet" />;
}
