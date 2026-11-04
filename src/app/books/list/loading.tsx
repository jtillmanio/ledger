import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9).
// Chip lines: status (and its Sort), years, genres.
export default function Loading() {
  return <ListSkeleton search sort filters={[1, 2, 3]} />;
}
