import { IssueDetailSkeleton } from "@/components/IssueDetail";

// The sheet rises at once over the spine, the issue's geometry in --sunk until it arrives (task 3.5, UX floor).
export default function Loading() {
  return (
    <>
      <span className="sr-only" role="status">Loading</span>
      <IssueDetailSkeleton as="sheet" />
    </>
  );
}
