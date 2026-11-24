import { notFound } from "next/navigation";
import IssueDetail from "@/components/IssueDetail";
import { issueDetail } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ runId: string; issueId: string }> };

/** The issue sheet's content (task 3.5, TASK-080): the same `IssueDetail` the full page draws, under the sheet's `h2`. */
export default async function IssueSheet({ params }: Params) {
  const { runId, issueId } = await params;
  const issue = await issueDetail(await requireUserId(), decodeURIComponent(runId), decodeURIComponent(issueId));
  if (!issue) notFound();
  return <IssueDetail issue={issue} as="sheet" />;
}
