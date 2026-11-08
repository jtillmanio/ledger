import { Bar, BooksNowSkeleton, LoadingMain, QuarterStripSkeleton, ShelfSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9). The books dashboard's own
// geometry (task 2.2): the title and lede, Now, the Up next shelf and the quarter strip, in --sunk.
// /books/list, /books/status and /books/add have their own boundaries.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="6rem" className="sk-h1" />
      <Bar w="60%" className="sk-line" />
      <div className="dash-cols">
        <div className="dash-main">
          <BooksNowSkeleton />
          <ShelfSkeleton cards={3} />
          <QuarterStripSkeleton />
        </div>
      </div>
    </LoadingMain>
  );
}
