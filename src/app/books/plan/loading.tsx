import { Bar, LoadingMain, PlanRailSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands, from the prefetched shell (task 0.9): the page's heading, its year
// chips, the rail with its legend, and the quarters' rows, at the loaded geometry (task 2.10).
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="4rem" className="sk-h1" />
      <Bar w="9rem" className="sk-line" />
      <div className="filters" aria-hidden="true">
        {Array.from({ length: 5 }, (_, n) => <Bar key={n} w="3.5rem" className="sk-chip" />)}
      </div>
      <PlanRailSkeleton />
      <div className="plan-quarters" aria-hidden="true">
        {Array.from({ length: 3 }, (_, n) => <span key={n} className="sk plan-sum-sk" />)}
      </div>
    </LoadingMain>
  );
}
