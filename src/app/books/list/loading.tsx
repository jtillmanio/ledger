import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9).
// Chip lines: status, then the Owned and Sort dropdown chips (tasks 5.17, 6.24), then genres.
export default function Loading() {
  return <ListSkeleton search dropdowns book filters={[2, 3]} />;
}
