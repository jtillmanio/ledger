import { Bar, LoadingMain, SeasonRowsSkeleton } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9). Season rows are Watch's list
// geometry (task 1.8d); 8.7 builds the real ones and re-measures this.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="6rem" className="sk-h1" />
      <Bar w="55%" className="sk-line" />
      <SeasonRowsSkeleton />
    </LoadingMain>
  );
}
