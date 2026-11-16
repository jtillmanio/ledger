import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookDetail from "@/components/BookDetail";
import { bookDetail } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const book = await bookDetail(await requireUserId(), id);
  return { title: book ? `${book.title} · Ledger` : "Ledger" };
}

/**
 * A book's full page (task 3.5; docs/04-design.md § 13): `/book/{id}` on a
 * direct load, a refresh or a new tab, with the same content as the sheet a
 * list opens and no sheet chrome. An unknown or removed book is not found.
 */
export default async function BookPage({ params }: Params) {
  const { id } = await params;
  const book = await bookDetail(await requireUserId(), id);
  if (!book) notFound();
  return (
    <main className="book-page">
      <BookDetail book={book} as="page" />
    </main>
  );
}
