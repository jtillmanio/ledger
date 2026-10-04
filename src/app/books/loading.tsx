import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9).
// Chip lines: status, years, genres.
export default function Loading() {
  return <ListSkeleton search filters={[1, 2, 3]} />;
}
