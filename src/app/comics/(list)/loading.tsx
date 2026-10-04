import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9). The
// (list) group keeps this boundary off /comics/[runId], which has its own.
// Chip lines: the state filters, then the track chips (37 tracks, ~13 lines).
export default function Loading() {
  return <ListSkeleton filters={[1, 13]} />;
}
