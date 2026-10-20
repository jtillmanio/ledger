import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9). Static,
// so no (group) is needed to keep this boundary off /comics/[runId].
// Chip lines: the state filters, then the track chips (37 tracks, ~13 lines).
export default function Loading() {
  return <ListSkeleton filters={[1, 13]} />;
}
