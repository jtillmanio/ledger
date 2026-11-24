import { IssueDetailSkeleton } from "@/components/IssueDetail";
import { LoadingMain } from "@/components/Skeleton";

// Painted the moment a direct load lands (task 3.5): the issue page's geometry in --sunk.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="book-page"><IssueDetailSkeleton as="page" /></div>
    </LoadingMain>
  );
}
