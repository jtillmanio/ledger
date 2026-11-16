import { BookDetailSkeleton } from "@/components/BookDetail";
import { LoadingMain } from "@/components/Skeleton";

// Painted the moment a direct load lands (task 3.5): the book page's geometry in --sunk.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="book-page"><BookDetailSkeleton as="page" /></div>
    </LoadingMain>
  );
}
