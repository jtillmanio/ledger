"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchAnswer } from "@/app/api/metron/search/route";
import InsertPreview, { type After } from "@/components/InsertPreview";
import IssueSearch, { type IssueSearchHandle } from "@/components/IssueSearch";
import ReviewTable from "@/components/ReviewTable";
import RunChip from "@/components/RunChip";
import { useUndo } from "@/components/Undo";
import { parseBulk, type KnownSeries, type VolumeRule } from "@/lib/bulk-parse";
import { buildReview, labelKey, type Catalog, type Choices, type Placement } from "@/lib/bulk-review";
import type { SearchResult } from "@/lib/issue-search";

export type AddContext = { run: { id: string; title: string }; placements: Placement[] };

type Insert = { after: number; created: number[]; restored: { id: number; sequence: number }[]; revived: string[] };

const api = (runId: string) => `/api/runs/${encodeURIComponent(runId)}/issues`;
const issues = (n: number) => `${n} ${n === 1 ? "issue" : "issues"}`;
const labelCount = (n: number) => `${n} ${n === 1 ? "label" : "labels"}`;

/** The catalog check waits for typing to pause. */
const CHECK_MS = 300;

/** A search result tapped **Add**: its label, and Metron's id when only Metron has it. */
type Staged = { key: string; label: string; metronId: number | null };

/**
 * Add issues (tasks 1.3b, 1.3c): *Search*, the default half, and *Type it*.
 * Search stages results (`IssueSearch`); Type it parses the paste as it is
 * typed (the parser is pure). Either way the lines go through the same review:
 * the catalog is asked about labels it hasn't answered once typing pauses (a
 * dry run that writes nothing), and nothing is written until the confirm,
 * which writes exactly what the header counts, in one transaction. Its undo
 * goes on the app's one stack (task 1.2).
 *
 * Opened from an inbox note's **Resolve** (task 1.4b), Search starts with the
 * note's text in it, and the first insert that goes through resolves the note
 * into the run it went to, in its own transaction; its undo reopens the note.
 */
export default function AddIssues({ initial, knownSeries, rules: initialRules = [], runs, query = "", note = null }: {
  initial: AddContext; knownSeries: KnownSeries[]; runs: { id: string; title: string }[];
  /** The approved volume rules: a bare series one covers takes its year (task 1.12). */
  rules?: VolumeRule[];
  /** Search's starting text. */
  query?: string;
  /** The inbox note this add resolves. */
  note?: number | null;
}) {
  const [ctx, setCtx] = useState(initial);
  const [rules, setRules] = useState(initialRules);
  const [noteId, setNoteId] = useState(note);
  const [mode, setMode] = useState<"search" | "type">("search");
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<Staged[]>([]);
  const [metron, setMetron] = useState<Set<string>>(() => new Set());
  const [taken, setTaken] = useState<Set<string>>(() => new Set());
  const searchRef = useRef<IssueSearchHandle>(null);
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
  // The review reads the half you are on: what Search staged, one line each, or what you typed.
  const source = mode === "search" ? staged.map((s) => s.label).join("\n") : text;
  const lines = useMemo(
    () => parseBulk(source, { knownSeries, runLabels: live.map((p) => p.label), rules, runId: ctx.run.id }),
    [source, knownSeries, live, rules, ctx.run.id]);
  const review = useMemo(
    () => buildReview(lines, {
      knownSeries, placements: ctx.placements, catalog, choices, metron, taken, rules, runId: ctx.run.id,
    }),
    [lines, knownSeries, ctx, catalog, choices, metron, taken, rules]);
  const stagedKeys = useMemo(() => new Set(staged.map((s) => s.key)), [staged]);

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
        const { matches, taken: clash = [] } = await res.json() as {
          matches: { key: string; issue_id: string; label: string; runs: number }[]; taken?: string[];
        };
        if (clash.length) setTaken((prev) => new Set([...prev, ...clash]));
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
      : count === 0 ? (lines.length ? "Nothing new to add"
        : mode === "search" ? "Search, then tap Add on the issues you want" : "Type or paste issues to add") : null;

  /** A search answered: what it found is what the review knows about those labels. */
  function answered(answer: SearchAnswer) {
    setCatalog((prev) => {
      const next = new Map(prev);
      for (const r of answer.catalog) next.set(r.key, { issueId: r.issueId!, label: r.label, runs: r.runs });
      for (const r of answer.metron) if (!next.get(r.key)) next.set(r.key, null);
      return next;
    });
    if (answer.metron.length) setMetron((prev) => new Set([...prev, ...answer.metron.map((r) => r.key)]));
    const clash = answer.metron.filter((r) => r.idTaken).map((r) => r.key);
    if (clash.length) setTaken((prev) => new Set([...prev, ...clash]));
  }

  function toggle(r: SearchResult) {
    setStaged((list) => list.some((s) => s.key === r.key) ? list.filter((s) => s.key !== r.key)
      : [...list, { key: r.key, label: r.label, metronId: r.issueId === null ? r.metronId : null }]);
  }

  function typeInstead(query: string) {
    setMode("type");
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")}\n${query}` : query));
    // The textarea mounts with the switch; focus it once it is there.
    requestAnimationFrame(() => textarea.current?.focus());
  }

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
      // A Metron result's id goes with its label: the server writes Metron's own answer for it (2.15).
      const fromMetron = new Map(mode === "search"
        ? staged.filter((s) => s.metronId !== null).map((s) => [s.key, s.metronId]) : []);
      const metronIds = review.writes.map((w) => fromMetron.get(labelKey(w.label)) ?? null);
      const res = await fetch(api(runId), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          labels: review.writes.map((w) => w.label), after,
          ...(metronIds.some((m) => m !== null) && { metronIds }),
          ...(noteId !== null && { note: noteId }),
          ...(review.rules.length && { rules: review.rules }),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const done = await res.json() as Insert & {
        skipped: string[]; context: AddContext; note: number | null; rules: { series: string; year: number }[];
      };
      setCtx(done.context);
      // What the insert wrote stands for the next paste without a reload. Undo leaves it (changing a rule is 3.9's).
      if (done.rules?.length) {
        setRules((r) => [...r, ...done.rules.map((w) => ({ ...w, runId: null, issueFrom: null, issueTo: null }))]);
      }
      // A note is resolved once: later adds here are plain adds.
      setNoteId(null);
      const fromNote = done.note == null ? "" : " · inbox note resolved";
      if (mode === "search") {
        setStaged([]);
        searchRef.current?.rerun();
      } else {
        setText("");
      }
      setChoices({});
      setAfter(null);
      const n = done.created.length + done.restored.length;
      if (n === 0) {
        notify("Nothing added: they were already in this run", `${title}${fromNote}`);
        return;
      }
      const insert: Insert = { after: done.after, created: done.created, restored: done.restored, revived: done.revived };
      // A stale tab (D-9): what another tab had already placed is left alone, and said so.
      const skipped = done.skipped.length ? ` · ${done.skipped.length} already there` : "";
      push({
        label: `${issues(n)} added`,
        detail: `to ${title}${skipped}${fromNote}`,
        undo: async () => {
          const r = await fetch(api(runId), {
            method: "DELETE", headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...insert, ...(done.note != null && { note: done.note }) }),
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
            <button type="button" aria-pressed={mode === "search"} onClick={() => setMode("search")}>Search</button>
            <button type="button" aria-pressed={mode === "type"} onClick={() => setMode("type")}>Type it</button>
          </div>
          {/* Search stays mounted on Type it, so its results are still there when you come back. */}
          <div hidden={mode !== "search"}>
            <IssueSearch ref={searchRef} runId={ctx.run.id} staged={stagedKeys} initialQuery={query}
              onToggle={toggle} onAnswer={answered} onTypeInstead={typeInstead} />
          </div>
          {mode === "type" && (
            <>
              <label htmlFor="bulk-text" className="add-label">One per line, ranges allowed</label>
              <textarea id="bulk-text" ref={textarea} className="txt" rows={8} spellCheck={false}
                autoCapitalize="off" autoComplete="off" placeholder={"Thor #337-340\nBalder the Brave #1-4"}
                value={text} onChange={(e) => setText(e.target.value)} />
            </>
          )}
        </div>
        <div>
          <h2 className="s">{mode === "search" ? "Staged" : "Review"}<span className="more">{`${count} will be added`}</span></h2>
          {lines.length === 0 ? (
            mode === "search" ? (
              <div className="slate"><p>Nothing staged yet. Search, then tap <b>Add</b> on the issues you want.</p></div>
            ) : (
              <div className="slate">
                <p>Nothing to review yet. Type or paste labels, one per line: <span className="mono">Thor #337-340</span>.</p>
                <button type="button" className="btn" onClick={paste}>Paste from clipboard</button>
              </div>
            )
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
