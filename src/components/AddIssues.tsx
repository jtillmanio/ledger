"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import InsertPreview, { type After } from "@/components/InsertPreview";
import ReviewTable from "@/components/ReviewTable";
import RunChip from "@/components/RunChip";
import { useUndo } from "@/components/Undo";
import { parseBulk, type KnownSeries } from "@/lib/bulk-parse";
import { buildReview, labelKey, type Catalog, type Choices, type Placement } from "@/lib/bulk-review";

export type AddContext = { run: { id: string; title: string }; placements: Placement[] };

type Insert = { after: number; created: number[]; restored: { id: number; sequence: number }[]; revived: string[] };

const api = (runId: string) => `/api/runs/${encodeURIComponent(runId)}/issues`;
const issues = (n: number) => `${n} ${n === 1 ? "issue" : "issues"}`;
const labelCount = (n: number) => `${n} ${n === 1 ? "label" : "labels"}`;

/** The catalog check waits for typing to pause. */
const CHECK_MS = 300;

/**
 * Add issues, the *Type it* half (task 1.3c). The paste is parsed as it is
 * typed (the parser is pure), the catalog is asked about the labels once
 * typing pauses (a dry run that writes nothing), and nothing is written until
 * the confirm, which writes exactly what the header counts, in one transaction.
 * Its undo goes on the app's one stack (task 1.2).
 */
export default function AddIssues({ initial, knownSeries, runs }: {
  initial: AddContext; knownSeries: KnownSeries[]; runs: { id: string; title: string }[];
}) {
  const [ctx, setCtx] = useState(initial);
  const [text, setText] = useState("");
  const [choices, setChoices] = useState<Choices>({});
  const [after, setAfter] = useState<After>(null);
  const [catalog, setCatalog] = useState<Catalog>(() => new Map());
  const [checkFailed, setCheckFailed] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const { push, notify } = useUndo();

  const live = useMemo(() => ctx.placements.filter((p) => !p.removed), [ctx]);
  const lines = useMemo(
    () => parseBulk(text, { knownSeries, runLabels: live.map((p) => p.label) }), [text, knownSeries, live]);
  const review = useMemo(
    () => buildReview(lines, { knownSeries, placements: ctx.placements, catalog, choices }),
    [lines, knownSeries, ctx, catalog, choices]);

  // The catalog check: only labels it hasn't answered, once typing pauses.
  const lookupKey = review.lookups.join("\n");
  const checking = review.lookups.length > 0 && checkFailed !== lookupKey;
  useEffect(() => {
    if (!lookupKey) return;
    const labels = lookupKey.split("\n");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(api(ctx.run.id), {
          method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal,
          body: JSON.stringify({ labels, dryRun: true }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const { matches } = await res.json() as { matches: { key: string; issue_id: string; label: string; runs: number }[] };
        setCatalog((prev) => {
          const next = new Map(prev);
          for (const label of labels) if (!next.has(labelKey(label))) next.set(labelKey(label), null);
          for (const m of matches) next.set(m.key, { issueId: m.issue_id, label: m.label, runs: m.runs });
          return next;
        });
      } catch {
        if (!controller.signal.aborted) setCheckFailed(lookupKey);
      }
    }, CHECK_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [lookupKey, ctx.run.id, retry]);

  const count = review.writes.length;
  const reason = saving ? "Adding…"
    : review.unresolved > 0 ? `Resolve ${review.unresolved} ${review.unresolved === 1 ? "line" : "lines"} to add`
      : count === 0 ? (lines.length ? "Nothing new to add" : "Type or paste issues to add") : null;

  function choose(group: string, option: string) {
    setChoices((c) => ({ ...c, [group]: option }));
  }

  async function confirm() {
    if (reason) {
      reasonRef.current?.focus();
      return;
    }
    const { id: runId, title } = ctx.run;
    setSaving(true);
    setFailed(null);
    try {
      const res = await fetch(api(runId), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ labels: review.writes.map((w) => w.label), after }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const done = await res.json() as Insert & { skipped: string[]; context: AddContext };
      setCtx(done.context);
      setText("");
      setChoices({});
      setAfter(null);
      const n = done.created.length + done.restored.length;
      if (n === 0) {
        notify("Nothing added: they were already in this run", title);
        return;
      }
      const insert: Insert = { after: done.after, created: done.created, restored: done.restored, revived: done.revived };
      // A stale tab (D-9): what another tab had already placed is left alone, and said so.
      const skipped = done.skipped.length ? ` · ${done.skipped.length} already there` : "";
      push({
        label: `${issues(n)} added`,
        detail: `to ${title}${skipped}`,
        undo: async () => {
          const r = await fetch(api(runId), {
            method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify(insert),
          });
          if (!r.ok) throw new Error(String(r.status));
          const { context } = await r.json() as { context: AddContext };
          setCtx((c) => (c.run.id === runId ? context : c));
        },
      });
    } catch {
      setFailed("Couldn't add them. Nothing was written; your lines are still here.");
    } finally {
      setSaving(false);
    }
  }

  async function pickRun(runId: string) {
    setSwitching(true);
    setFailed(null);
    try {
      const res = await fetch(api(runId));
      if (!res.ok) throw new Error(String(res.status));
      const next = await res.json() as AddContext;
      setCtx(next);
      setAfter(null);
      // The URL follows the run, so a reload or Back lands where you are (Next 16 keeps it in step).
      window.history.replaceState(null, "", `/comics/${encodeURIComponent(next.run.id)}/add`);
    } catch {
      setFailed(`Couldn't open that run. Still adding to ${ctx.run.title}.`);
    } finally {
      setSwitching(false);
    }
  }

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip.trim()) setText(clip);
    } catch {
      // No clipboard permission: the textarea is the way in.
    }
    textarea.current?.focus();
  }

  return (
    <>
      <div className="add-2up">
        <div>
          <h1 className="t">Add issues</h1>
          <RunChip title={ctx.run.title} runs={runs} current={ctx.run.id} busy={switching} onPick={pickRun} />
          <div className="seg" role="group" aria-label="Add by">
            <button type="button" aria-pressed="false" aria-disabled="true" aria-describedby="search-soon">Search</button>
            <button type="button" aria-pressed="true">Type it</button>
          </div>
          <p id="search-soon" className="small muted seg-note">Metron search is coming.</p>
          <label htmlFor="bulk-text" className="add-label">One per line, ranges allowed</label>
          <textarea id="bulk-text" ref={textarea} className="txt" rows={8} spellCheck={false}
            autoCapitalize="off" autoComplete="off" placeholder={"Thor #337-340\nBalder the Brave #1-4"}
            value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div>
          <h2 className="s">Review<span className="more">{`${count} will be added`}</span></h2>
          {lines.length === 0 ? (
            <div className="slate">
              <p>Nothing to review yet. Type or paste labels, one per line: <span className="mono">Thor #337-340</span>.</p>
              <button type="button" className="btn" onClick={paste}>Paste from clipboard</button>
            </div>
          ) : (
            <>
              <p className="small muted review-status" role="status">
                {checking ? `Checking ${labelCount(review.lookups.length)} against your catalog…` : ""}
              </p>
              {checkFailed === lookupKey && lookupKey && (
                <p className="neutral-error">
                  <span aria-hidden="true">×</span> Couldn&apos;t check your catalog. Your lines are still here.{" "}
                  <button type="button" className="linkbtn" onClick={() => { setCheckFailed(null); setRetry((n) => n + 1); }}>
                    Try again
                  </button>
                </p>
              )}
              <ReviewTable rows={review.rows} checking={checking} onChoose={choose} />
            </>
          )}
          <InsertPreview placements={live} after={after} adding={review.writes.map((w) => w.label)} onAfter={setAfter} />
        </div>
      </div>
      <div className="actionbar add-bar">
        {failed && <p className="neutral-error add-failed" role="alert"><span aria-hidden="true">×</span> {failed}</p>}
        {reason && <p ref={reasonRef} id="add-reason" className="small muted add-reason" tabIndex={-1}>{reason}</p>}
        <div className="add-buttons">
          <Link prefetch={false} href={`/comics/${encodeURIComponent(ctx.run.id)}`} className="btn sec">Cancel</Link>
          <button type="button" className="btn" aria-disabled={reason ? true : undefined}
            aria-describedby={reason ? "add-reason" : undefined} onClick={confirm}>
            {`Add ${issues(count)}`}
          </button>
        </div>
      </div>
    </>
  );
}
