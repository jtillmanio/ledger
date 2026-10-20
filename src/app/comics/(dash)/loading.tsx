import { ListSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9). The
// (dash) group keeps this boundary off /comics/[runId], which has its own.
// Task 1.8d draws the dashboard's own geometry; until then the list's will do.
export default function Loading() {
  return <ListSkeleton filters={[1]} />;
}
