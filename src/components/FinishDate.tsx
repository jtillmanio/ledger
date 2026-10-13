"use client";

import type { FinishChoice, FinishMode } from "@/lib/finish-date";
import type { Precision } from "@/lib/format";

/** The control's state: the chosen mode, and the day and year it holds for
 * Pick a date and Year only, kept while another mode is chosen. */
export type FinishValue = { mode: FinishMode; date: string; year: number };

const OPTIONS: { mode: FinishMode; label: string }[] = [
  { mode: "today", label: "Today" },
  { mode: "date", label: "Pick a date" },
  { mode: "year", label: "Year only" },
  { mode: "none", label: "No date" },
];
const EARLIEST_YEAR = 1900;

/** Today as a calendar day where the reader is, `YYYY-MM-DD`: the picker's max. */
export function localToday() {
  return new Date().toLocaleDateString("en-CA");
}

const longDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "11 March 2024". */
export function dayName(day: string) {
  return longDay.format(new Date(`${day}T00:00:00Z`));
}

/** Where the control starts: on the finish already stored, if there is one. A
 * July 1st that is `approximate` is a Year only; anything else dated is a day. */
export function initialFinish(
  current: { on: string | null; precision: Precision } | null, start: FinishMode = "today",
): FinishValue {
  const today = localToday();
  const base = { date: today, year: Number(today.slice(0, 4)) };
  if (!current) return { mode: start, ...base };
  if (current.precision === "none") return { mode: "none", ...base };
  const on = current.on!;
  if (current.precision === "approximate" && on.endsWith("-07-01")) {
    return { mode: "year", ...base, year: Number(on.slice(0, 4)) };
  }
  return { mode: "date", ...base, date: on };
}

/** What the server is sent (`src/lib/finish-date.ts` resolves it). */
export function toChoice(v: FinishValue): FinishChoice {
  if (v.mode === "date") return { mode: "date", date: v.date };
  if (v.mode === "year") return { mode: "year", year: v.year };
  return { mode: v.mode };
}

/** Why the value can't be saved yet, shown under the Save (UX-N18), or null. */
export function finishReason(v: FinishValue): string | null {
  if (v.mode === "date" && !v.date) return "Pick the day you finished.";
  if (v.mode === "date" && v.date > localToday()) return "That day hasn't happened yet.";
  return null;
}

/** What the toast says was saved: "11 March 2024", "2022, approximate", "no date". */
export function finishWords(v: FinishValue): string {
  switch (v.mode) {
    case "today": return dayName(localToday());
    case "date": return v.date ? dayName(v.date) : "";
    case "year": return `${v.year}, approximate`;
    case "none": return "no date";
  }
}

/**
 * The finish-date control (task 1.5, mockup `blist` second frame, M-13):
 * *Finished* — **Today · Pick a date · Year only · No date**, as named radio
 * inputs. Today and Pick a date store an exact day; Year only stores that
 * year's July 1st as `approximate` and says so; No date stores none. The book
 * row's *Read* and a spine row's *Change date…* both use it, and 3.5's detail
 * sheets will. There is no Spread: that is for ranges of issues.
 *
 * Controlled: the caller holds the value and owns Save and Cancel.
 */
export default function FinishDate({ value, onChange, name }: {
  value: FinishValue; onChange: (v: FinishValue) => void; name: string;
}) {
  const today = localToday();
  const thisYear = Number(today.slice(0, 4));
  const set = (patch: Partial<FinishValue>) => onChange({ ...value, ...patch });
  const step = (by: number) => {
    const year = value.year + by;
    if (year >= EARLIEST_YEAR && year <= thisYear) set({ year });
  };

  return (
    <div className="finish">
      <fieldset className="opts">
        <legend className="finish-legend">Finished</legend>
        {OPTIONS.map((o) => (
          <label key={o.mode} className="opt">
            <input type="radio" name={name} value={o.mode} checked={value.mode === o.mode}
              onChange={() => set({ mode: o.mode })} />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>
      <div className="finish-fields">
        {value.mode === "date" && (
          <label className="frow">
            <span className="k">Finished on</span>
            <input className="v mono" type="date" value={value.date} max={today}
              onChange={(e) => set({ date: e.target.value })} />
          </label>
        )}
        {value.mode === "year" && (
          <div className="frow">
            <span className="k">Year</span>
            <span className="stepper" role="group" aria-label="Year finished">
              <button type="button" aria-label="Earlier" aria-disabled={value.year <= EARLIEST_YEAR || undefined}
                onClick={() => step(-1)}>−</button>
              <output className="val" aria-live="polite">{value.year}</output>
              <button type="button" aria-label="Later" aria-disabled={value.year >= thisYear || undefined}
                onClick={() => step(1)}>+</button>
            </span>
          </div>
        )}
      </div>
      <p className="lede finish-note">
        {value.mode === "today" && <>Saved as <b>{dayName(today)}</b>.</>}
        {value.mode === "date" && value.date && <>Saved as <b>{dayName(value.date)}</b>.</>}
        {value.mode === "year" && (
          <>Saved as <b>1 July {value.year}, approximate</b>: it counts toward {value.year}, never as a real day.</>
        )}
        {value.mode === "none" && <>Saved with no date: it counts as read, in no year.</>}
      </p>
    </div>
  );
}
