"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { useUndo } from "@/components/Undo";
import type { Rebalance } from "@/app/api/plan/rebalance/route";

/** What a peer posts: `next`, `on_deck`, `even` or `accept` (`POST /api/plan/rebalance`, TASK-066). */
type Action = "next" | "on_deck" | "even" | "accept";

/** Words as the sheet prints them, `2,279k` (the mockup's, and the plan picker's). */
const k = (words: number) => `${Math.round(words / 1000).toLocaleString("en-US")}k`;
/** A quarter's words in the even-out line, `892`: the line says `k` once, at its end. */
const n = (words: number) => Math.round(words / 1000).toLocaleString("en-US");
const books = (count: number) => `${count} ${count === 1 ? "book" : "books"}`;

const JSON_HEADERS = { "content-type": "application/json" };

/**
 * *Accept it as a stretch year* (task 2.7, F-23): one `plan_acceptance` row with today's date and the year's
 * planned words. The answer is an error line to show, or null when it worked.
 */
export async function acceptYear(year: number): Promise<string | null> {
  try {
    const res = await fetch("/api/plan/rebalance", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ action: "accept", year }) });
    if (res.ok) return null;
    return res.status === 409 ? `${year} fits its capacity now: there is nothing to accept.` : "Couldn't accept it. Nothing was saved.";
  } catch {
    return "Couldn't accept it. Nothing was saved.";
  }
}

/** *Undo* on a settled year (task 2.7): its row goes and the year reads over again. An error line, or null. */
export async function undoAccept(year: number): Promise<string | null> {
  try {
    const res = await fetch("/api/plan/rebalance", {
      method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ undo: { kind: "accept", year } }),
    });
    return res.ok ? null : "Couldn't undo it. Nothing changed.";
  } catch {
    return "Couldn't undo it. Nothing changed.";
  }
}

/**
 * *Rebalance 2027* (task 2.7, F-23; mockup `rebalance`; docs/04-design.md § 12 → Over-commitment is a decision,
 * not an error): a button that opens the Rebalance sheet over the shared `Sheet`. The plan page's capacity card
 * carries it; *Place them*'s closing card swaps its own sheet to `RebalanceBody` instead (D-34).
 */
export default function RebalanceButton({ year, className = "btn sm" }: { year: number; className?: string }) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" className={className} data-rebalance={year} onClick={(e) => setOpener(e.currentTarget)}>
        Rebalance {year}
      </button>
      {opener && (
        <Sheet heading={`Rebalance ${year}`} opener={opener} onClose={() => setOpener(null)}>
          <RebalanceBody year={year} />
        </Sheet>
      )}
    </>
  );
}

/**
 * The sheet's body, inside a `Sheet` the caller owns (headed *Rebalance 2027*): four peers, never three ways to
 * shrink the plan. Each is a row with what it does in numbers (the before/after delta, from
 * `GET /api/plan/rebalance`) and one button, all four of one class and one size, so none reads as the
 * recommended one. A move or an even-out pushes its Undo; any of the four refreshes the page and closes the
 * sheet. Amber is the page's; nothing here is red, and nothing says *behind*.
 */
export function RebalanceBody({ year }: { year: number }) {
  const close = useSheetClose();
  const router = useRouter();
  const { push } = useUndo();
  const id = useId();
  const [data, setData] = useState<Rebalance | "failed" | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/plan/rebalance?year=${year}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("rebalance failed"))))
      .then((body: Rebalance) => { if (live) setData(body); })
      .catch(() => { if (live) setData("failed"); });
    return () => { live = false; };
  }, [year]);

  if (data === null) return <p className="small muted" role="status">Loading…</p>;
  if (data === "failed" || data.decision.state === "fits") {
    return (
      <>
        <p className={data === "failed" ? "neutral-error small" : "lede"} role={data === "failed" ? "alert" : "status"}>
          {data === "failed"
            ? <><span aria-hidden="true">×</span> Couldn&apos;t work out {year}&apos;s figures. Close and try again.</>
            : `${year} fits its capacity: there is nothing to rebalance.`}
        </p>
        <div className="btnrow"><button type="button" className="btn sec" onClick={close}>Close</button></div>
      </>
    );
  }

  const { decision, overage, quarters, next, even } = data;
  const byId = new Map(overage.books.map((b) => [b.id, b]));
  const count = overage.books.length;
  const moving = overage.books.reduce((s, b) => s + (b.words ?? 0), 0);
  const after = decision.plannedWords - moving;
  const longest = overage.longestFirst.map((bookId) => byId.get(bookId)!).filter(Boolean);
  const quarterTotal = quarters.reduce((s, q) => s + q.plannedWords, 0);
  const none = "Nothing past a quarter’s rule is still to read: a started book stays where it is.";

  async function act(action: Action) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try {
      if (action === "accept") {
        const problem = await acceptYear(year);
        if (problem) { setError(problem); return; }
      } else {
        const res = await fetch("/api/plan/rebalance", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ action, year }) });
        if (!res.ok) {
          const said = res.status === 409 ? ((await res.json().catch(() => ({}))) as { error?: string }).error : undefined;
          setError(said ?? "Couldn't do that. Nothing was changed.");
          return;
        }
        const { undo } = await res.json() as { undo: unknown };
        push({
          label: action === "even" ? `Evened out ${year}’s quarters` : `Moved ${books(count)} to ${action === "next" ? next.year : "On deck"}`,
          undo: async () => {
            const back = await fetch("/api/plan/rebalance", { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ undo }) });
            if (!back.ok) throw new Error(String(back.status));
            router.refresh();
          },
        });
      }
      router.refresh();
      close();
    } catch {
      setError("Couldn't do that. Nothing was changed.");
    } finally {
      setBusy(null);
    }
  }

  const peers: { action: Action; title: string; delta: string; go: string; reason?: string }[] = [
    {
      action: "next", title: `Move the overage into ${next.year}`,
      delta: count ? `${year} ${k(decision.plannedWords)} → ${k(after)}. ${next.year} then holds ${books(next.books + count)}.` : none,
      go: `Move ${k(moving)}`, reason: count ? undefined : none,
    },
    {
      action: "on_deck", title: "Move it to On deck",
      delta: count
        ? `Longest first: ${longest[0].title}${longest[0].words === null ? "" : ` (${k(longest[0].words)})`}${count > 1 ? ` and ${count - 1} more` : ""}. ${year} → ${k(after)}. Nothing is deleted.`
        : none,
      go: `Drop ${books(count)}`, reason: count ? undefined : none,
    },
    {
      action: "even", title: "Even out the quarters",
      delta: `Q1–Q4: ${quarters.map((q) => n(q.plannedWords)).join(" · ")} → ${even.map(n).join(" · ")}. Same books, same ${k(quarterTotal)}.`,
      go: "Even out",
    },
    {
      action: "accept", title: `Accept ${year} as a stretch year`,
      delta: `Nothing moves. The amber clears, and stays cleared until the plan grows past ${k(decision.plannedWords)}.`,
      go: "Accept",
    },
  ];

  return (
    <div className="rb">
      <p className="lede">{year} is {k(decision.plannedWords)} against {k(decision.capacity)} a year: over by {k(decision.plannedWords - decision.capacity)}.</p>
      <ul className="rb-opts">
        {peers.map((p) => (
          <li key={p.action} className="rb-opt" data-action={p.action}>
            <div className="rb-text">
              <p className="rb-title" id={`${id}-${p.action}-t`}>{p.title}</p>
              <p className="rb-delta" id={`${id}-${p.action}-d`}>{p.delta}</p>
            </div>
            <button type="button" className="btn sec sm rb-go" data-action={p.action}
              aria-describedby={`${id}-${p.action}-t ${id}-${p.action}-d`}
              aria-disabled={p.reason || busy ? true : undefined}
              onClick={() => { if (!p.reason) void act(p.action); }}>
              {busy === p.action ? "Saving…" : p.go}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="neutral-error small" role="alert"><span aria-hidden="true">×</span> {error}</p>}
      <div className="btnrow"><button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button></div>
    </div>
  );
}
