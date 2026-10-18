"use client";

import { useId, useState } from "react";
import Sheet, { useSheetClose } from "@/components/Sheet";
import type { RangeMode } from "@/db/writes";
import { today } from "@/lib/finish-date";

export type RangeRow = { placement_id: number; label: string; type: string };
export type RangeChoice = { mode: RangeMode; date?: string; from?: string; to?: string };

const OPTIONS: { mode: RangeMode; label: string }[] = [
  { mode: "today", label: "Today" },
  { mode: "date", label: "Pick a date" },
  { mode: "spread", label: "Spread over a range" },
  { mode: "none", label: "No date" },
];
// The fifth option exists only from Adopt (docs/TASKS.md 1.1).
const ORIGINAL = { mode: "original" as const, label: "Original dates" };

/**
 * The range sheet (task 1.1, mockup `range`): how a range of placements is
 * dated before it is marked. It says how many placements the range holds and
 * how many are optional, because optional ones are included (*96 issues · 4
 * optional*). From Adopt it adds *Original dates* and starts on it.
 *
 * `onConfirm` resolves when the write has landed and rejects when it didn't;
 * the sheet stays open on a failure and says so.
 */
export default function RangeSheet({ rows, adopt, opener, onClose, onConfirm }: {
  rows: RangeRow[]; adopt: boolean; opener: HTMLElement | null;
  onClose: () => void; onConfirm: (choice: RangeChoice) => Promise<void>;
}) {
  const n = rows.length;
  return (
    <Sheet heading={`Mark ${n} ${n === 1 ? "issue" : "issues"} read`} opener={opener} onClose={onClose}>
      <RangeForm rows={rows} adopt={adopt} onConfirm={onConfirm} />
    </Sheet>
  );
}

function RangeForm({ rows, adopt, onConfirm }: {
  rows: RangeRow[]; adopt: boolean; onConfirm: (choice: RangeChoice) => Promise<void>;
}) {
  const close = useSheetClose();
  const [mode, setMode] = useState<RangeMode>(adopt ? "original" : "today");
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(today);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const reasonId = useId();
  const options = adopt ? [...OPTIONS, ORIGINAL] : OPTIONS;

  const n = rows.length;
  const optional = rows.filter((r) => r.type === "optional").length;
  const first = rows[0], last = rows.at(-1)!;

  // Why the confirm can't go yet, shown under it (UX-N18).
  const reason =
    mode === "date" && !date ? "Pick the day you finished them."
      : mode === "spread" && !from ? "Pick the day you started."
        : mode === "spread" && !to ? "Pick the day you finished."
          : mode === "spread" && to < from ? "The end is before the start."
            : null;
  const blocked = reason !== null || saving;

  async function confirm() {
    if (blocked) return;
    setSaving(true);
    setFailed(false);
    try {
      await onConfirm({
        mode,
        ...(mode === "date" && { date }),
        ...(mode === "spread" && { from, to }),
      });
      close();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  return (
    <>
      <p className="lede">
        {adopt ? "Unread here, read in another run" : n === 1 ? first.label : `${first.label} through ${last.label}`}
      </p>
      <p className="mono small muted range-count">
        {n} {n === 1 ? "issue" : "issues"}{optional > 0 && ` · ${optional} optional`}
      </p>
      <fieldset className="opts">
        <legend className="sr-only">When you read them</legend>
        {options.map((o) => (
          <label key={o.mode} className="opt">
            <input type="radio" name="mode" value={o.mode} checked={mode === o.mode}
              onChange={() => setMode(o.mode)} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="group sheet-fields">
        {mode === "today" && (
          <div className="frow"><span className="k">Finished on</span><span className="v mono">{today()}</span></div>
        )}
        {mode === "date" && (
          <label className="frow">
            <span className="k">Finished on</span>
            <input className="v mono" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </label>
        )}
        {mode === "spread" && (
          <>
            <label className="frow">
              <span className="k">Started on</span>
              <input className="v mono" type="date" value={from} max={to || today()}
                onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="frow">
              <span className="k">Finished on</span>
              <input className="v mono" type="date" value={to} max={today()} onChange={(e) => setTo(e.target.value)} />
            </label>
          </>
        )}
        {mode === "none" && (
          <p className="frow k">They count as read and stay out of pace.</p>
        )}
        {mode === "original" && (
          <p className="frow k">Each keeps the date of its earliest read in another run.</p>
        )}
      </div>
      <div className="btnrow">
        <button type="button" className="btn" aria-disabled={blocked || undefined}
          aria-describedby={reason ? reasonId : undefined} onClick={confirm}>
          {saving ? "Marking…" : `Mark ${n} read`}
        </button>
        <button type="button" className="btn sec sheet-cancel" onClick={close}>Cancel</button>
      </div>
      {reason && <p id={reasonId} className="small muted sheet-reason">{reason}</p>}
      {failed && (
        <p className="small sheet-reason sheet-error" role="alert">
          <span aria-hidden="true">×</span> That didn&apos;t save. Check your connection and try again.
        </p>
      )}
    </>
  );
}
