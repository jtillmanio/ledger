import { Bar, LoadingMain, RunRowsSkeleton, TelecardSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9). The
// (dash) group keeps this boundary off /comics/[runId], which has its own.
// The dashboard's own geometry (task 1.8d): the telecard, then the run rows.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="9rem" className="sk-h1" />
      <Bar w="60%" className="sk-line" />
      <TelecardSkeleton />
      <RunRowsSkeleton rows={3} />
    </LoadingMain>
  );
}
