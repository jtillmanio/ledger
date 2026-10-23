"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RangeForm, type RangeChoice } from "@/components/RangeSheet";
import Sheet, { useSheetClose } from "@/components/Sheet";
import { issueName } from "@/lib/format";

/** An unread placement the thumb bar can reach, in reading order. */
export type Upcoming = { placement_id: number; label: string; type: string; notes: string | null };

/** The most the stepper offers: the thumb bar loads this many ahead (nextUnread). */
export const BATCH_MAX = 50;
const START = 5;

type Step = "batch" | "pick" | "range";

/** "#141–145" on a single-series run, otherwise "A through B": the range the stepper would mark. */
export function rangeText(rows: Upcoming[], single: boolean) {
  const first = rows[0], last = rows.at(-1);
  if (!first || !last) return "";
  const a = issueName(first.label, single), b = issueName(last.label, single);
  if (rows.length === 1) return a;
  return single ? `${a}–${b.replace("#", "")}` : `${a} through ${b}`;
}

/**
 * The batch sheet (task 1.8b, mockup `batch`): three ways to mark more than one
 * issue, at equal weight. *Mark the next N* is a stepper over the next unread
 * placements with the range it would mark beneath; one request, one undo.
 * *Mark through…* picks the last issue read, then dates the range as the range
 * sheet does. *Log a session* waits for reading sessions (2.1b) and says so.
 *
 * The run detail opens this at `start="through"`: its bar's second verb is
 * *Mark through…* and nothing else. The steps swap inside one `Sheet` because a
 * second sheet opened as the first closes would race its history entry (D-34).
 */
export default function BatchSheet({ start = "batch", title, upcoming, single, opener, onClose, onNext, onThrough }: {
  start?: "batch" | "through";
  title: string;
  upcoming: Upcoming[];
  single: boolean;
  opener: HTMLElement | null;
  onClose: () => void;
  /** Marks these placements read today, in one request. */
  onNext: (ids: number[]) => Promise<void>;
  /** Marks these placements read as the range sheet chose. */
  onThrough: (ids: number[], choice: RangeChoice) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>(start === "through" ? "pick" : "batch");
  const [through, setThrough] = useState(0);
  const opened = useRef(false);

  // A step swaps the controls under focus: the heading takes it, as it does when the sheet opens.
  useEffect(() => {
    if (opened.current) document.querySelector<HTMLElement>(".sheet h2")?.focus();
    opened.current = true;
  }, [step]);

  const range = upcoming.slice(0, through + 1);
  const heading = step === "batch" ? "Batch"
    : step === "pick" ? "Mark through…"
      : `Mark ${range.length} ${range.length === 1 ? "issue" : "issues"} read`;

  return (
    <Sheet heading={heading} opener={opener} onClose={onClose}>
      {step === "batch" && (
        <BatchBody title={title} upcoming={upcoming} single={single} onNext={onNext} onChoose={() => setStep("pick")} />
      )}
      {step === "pick" && (
        <Pick upcoming={upcoming} onBack={start === "batch" ? () => setStep("batch") : null}
          onPick={(at) => { setThrough(at); setStep("range"); }} />
      )}
      {step === "range" && (
        <RangeForm rows={range} adopt={false} onConfirm={(choice) => onThrough(range.map((r) => r.placement_id), choice)} />
      )}
    </Sheet>
  );
}

function BatchBody({ title, upcoming, single, onNext, onChoose }: {
  title: string; upcoming: Upcoming[]; single: boolean;
  onNext: (ids: number[]) => Promise<void>; onChoose: () => void;
}) {
  const close = useSheetClose();
  const max = Math.min(upcoming.length, BATCH_MAX);
  const [n, setN] = useState(Math.min(START, max));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const sessionReason = useId();
  const next = upcoming.slice(0, n);

  async function markNext() {
    if (saving || n === 0) return;
    setSaving(true);
    setFailed(false);
    try {
      await onNext(next.map((r) => r.placement_id));
      close();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <>
      <p className="lede">
        {upcoming[0] ? `${title} · next unread is ${issueName(upcoming[0].label, single)}` : `${title} · nothing unread`}
      </p>
      <div className="group sheet-fields">
        <div className="frow batch-row">
          <span className="k batch-k">
            Mark the next
            <span className="lede batch-sub">{rangeText(next, single)}</span>
          </span>
          <span className="stepper" role="group" aria-label="How many issues">
            <button type="button" aria-label="Fewer" aria-disabled={n <= 1 || undefined}
              onClick={() => setN((v) => Math.max(1, v - 1))}>−</button>
            <output className="val">{n}</output>
            <button type="button" aria-label="More" aria-disabled={n >= max || undefined}
              onClick={() => setN((v) => Math.min(max, v + 1))}>+</button>
          </span>
          <button type="button" className="btn sm" aria-disabled={saving || n === 0 || undefined} onClick={markNext}>
            {saving ? "Marking…" : `Mark ${n} read`}
          </button>
        </div>
        <div className="frow">
          <span className="k batch-k">
            Mark through…
            <span className="lede batch-sub">Pick the last issue you read</span>
          </span>
          <button type="button" className="btn sec sm" onClick={onChoose}>Choose</button>
        </div>
        <div className="frow">
          <span className="k batch-k">
            Log a session
            <span id={sessionReason} className="lede batch-sub">Sessions aren&apos;t here yet.</span>
          </span>
          <button type="button" className="btn sec sm" aria-disabled="true" aria-describedby={sessionReason}>Log</button>
        </div>
      </div>
      {failed && (
        <p className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
        </p>
      )}
      <div className="btnrow">
        <button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button>
      </div>
    </>
  );
}

/** The unread rows, in reading order: the one tapped is the last the range reaches. */
function Pick({ upcoming, onBack, onPick }: {
  upcoming: Upcoming[]; onBack: (() => void) | null; onPick: (at: number) => void;
}) {
  const close = useSheetClose();
  return (
    <>
      <p className="lede">Pick the last issue you read. Everything unread before it is marked too.</p>
      <ul className="pick group sheet-fields">
        {upcoming.map((r, at) => (
          <li key={r.placement_id}>
            <button type="button" className="pick-row" onClick={() => onPick(at)}>
              <span className="pick-label">{r.label}</span>
              {r.notes && <span className="pick-note">{r.notes}</span>}
            </button>
          </li>
        ))}
      </ul>
      {upcoming.length === 0 && <p className="small muted sheet-reason">Nothing unread here.</p>}
      <div className="btnrow">
        {onBack && <button type="button" className="btn sec sheet-cancel" onClick={onBack}>Back</button>}
        <button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button>
      </div>
    </>
  );
}
