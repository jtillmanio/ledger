import { BookDetailSkeleton } from "@/components/BookDetail";

// The sheet rises at once over the list, the book's geometry in --sunk until it arrives (task 3.5, UX floor).
export default function Loading() {
  return (
    <>
      <span className="sr-only" role="status">Loading</span>
      <BookDetailSkeleton as="sheet" />
    </>
  );
}
