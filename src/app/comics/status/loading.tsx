import { Bar, LoadingMain, RunRowsSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the queue's rows, then Ready, not queued.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="7rem" className="sk-h1" />
      <RunRowsSkeleton rows={4} />
      <RunRowsSkeleton rows={3} />
    </LoadingMain>
  );
}
