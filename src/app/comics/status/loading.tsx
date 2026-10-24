import { Bar, LoadingMain, RunRowsSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9, 1.9): the title, the tab strip, then
// In flight's rows, at the loaded size so nothing moves when the page arrives.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="11rem" className="sk-h1" />
      <span className="sk sk-tabs" aria-hidden="true" />
      <RunRowsSkeleton rows={4} />
    </LoadingMain>
  );
}
