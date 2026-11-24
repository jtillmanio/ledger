import type { Metadata } from "next";
import { notFound } from "next/navigation";
import IssueDetail from "@/components/IssueDetail";
import { issueDetail } from "@/db/queries";
import { requireUserId } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ runId: string; issueId: string }> };

async function load({ params }: Params) {
  const { runId, issueId } = await params;
  return issueDetail(await requireUserId(), decodeURIComponent(runId), decodeURIComponent(issueId));
}

export async function generateMetadata(p: Params): Promise<Metadata> {
  const issue = await load(p);
  return { title: issue ? `${issue.label} · Ledger` : "Ledger" };
}

/**
 * An issue's full page (task 3.5, TASK-080; docs/04-design.md § 13):
 * `/comics/{runId}/issue/{issueId}` on a direct load, a refresh or a new tab,
 * with the same content as the sheet a run's spine opens and no sheet chrome.
 * `runId` is the run it was opened from (*this run*). An unknown or removed
 * issue, or a run that doesn't place it, is not found.
 */
export default async function IssuePage(p: Params) {
  const issue = await load(p);
  if (!issue) notFound();
  return (
    <main className="book-page">
      <IssueDetail issue={issue} as="page" />
    </main>
  );
}
