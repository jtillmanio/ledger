import RouteSheet from "@/components/RouteSheet";

/**
 * `/comics/[runId]/issue/[issueId]` arrived at from a run's spine (task 3.5,
 * TASK-080; docs/04-design.md § 13): the issue as a sheet over it. The route has
 * an `issue` segment of its own, so it never catches `/comics/[runId]/add`
 * (D-157). The sheet is the layout, so it stays put while its skeleton gives way
 * to the issue, and its focus and motion run once.
 */
export default function IssueSheetLayout({ children }: { children: React.ReactNode }) {
  return <RouteSheet label="Issue">{children}</RouteSheet>;
}
