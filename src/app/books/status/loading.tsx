import { Bar, LoadingMain, RunRowsSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands (task 1.9): the title, the tab strip, then a
// group's rows, at the loaded size so nothing moves when the plan arrives.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="9rem" className="sk-h1" />
      <span className="sk sk-tabs" aria-hidden="true" />
      <RunRowsSkeleton rows={5} />
    </LoadingMain>
  );
}
