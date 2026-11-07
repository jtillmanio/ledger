"use client";

import { useEffect, useRef, useState } from "react";
import Stepper from "@/components/Stepper";
import { useUndo } from "@/components/Undo";
import {
  averageNovels, formatWords, SETTING_BOUNDS, SETTING_KEYS, wordsPerYear, type ReadingSettings, type SettingKey,
} from "@/lib/settings";

const SAVE_AFTER_MS = 500;

const ROWS: { key: SettingKey; label: string }[] = [
  { key: "minutesPerDay", label: "Minutes a day" },
  { key: "wordsPerMinute", label: "Words a minute" },
  { key: "wordsPerPage", label: "Words per page" },
];

/**
 * *Reading pace* (task 2.0, F-21): the three steppers and the card that turns them into words a
 * year. A press, a hold or a typed value changes the number at once; one save goes out 500 ms after the last change, with
 * only the fields that changed, and any press still waiting is sent when the page is left. Saves
 * go out one at a time, so an older answer never lands over a newer one. A save that fails puts
 * the steppers back to what is stored and raises the app's failed-write line with Retry.
 */
export default function PaceSettings({ initial, year }: { initial: ReadingSettings; year: number }) {
  const undo = useUndo();
  const [values, setValues] = useState(initial);
  const latest = useRef(initial);
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const gone = useRef(false);

  function show(next: ReadingSettings) {
    latest.current = next;
    setValues(next);
  }

  async function send() {
    const sending = latest.current;
    const changed = SETTING_KEYS.filter((k) => sending[k] !== saved.current[k]);
    if (changed.length === 0) return;
    const body = Object.fromEntries(changed.map((k) => [k, sending[k]]));
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body), keepalive: true,
      });
      if (!res.ok) throw new Error(`settings PATCH ${res.status}`);
      saved.current = { ...saved.current, ...body };
    } catch {
      show({ ...latest.current, ...Object.fromEntries(changed.map((k) => [k, saved.current[k]])) });
      undo.fail({
        label: "Couldn't save your reading pace. It's back to what it was.",
        retry: () => { show({ ...latest.current, ...body }); save(); },
      });
    }
  }

  function save() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    queue.current = queue.current.then(send);
  }

  function change(key: SettingKey, next: number) {
    show({ ...latest.current, [key]: next });
    if (timer.current) clearTimeout(timer.current);
    // A typed draft is committed as the page is hidden or the screen goes (2.0b), after the flush
    // below has run: there is nothing left to wait for, so it is sent at once.
    if (gone.current || document.visibilityState === "hidden") { save(); return; }
    timer.current = setTimeout(save, SAVE_AFTER_MS);
  }

  // A press inside the 500 ms window is sent when the tab is hidden or the screen unmounts.
  useEffect(() => {
    gone.current = false;
    const flush = () => { if (timer.current) save(); };
    window.addEventListener("pagehide", flush);
    return () => { gone.current = true; window.removeEventListener("pagehide", flush); flush(); };
    // save only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const words = wordsPerYear(values, year);
  const novels = averageNovels(words);
  return (
    <>
      <div className="group">
        {ROWS.map(({ key, label }) => (
          <div key={key} className="frow">
            <span className="k">{label}</span>
            <Stepper label={label} value={values[key]} {...SETTING_BOUNDS[key]} onChange={(next) => change(key, next)} />
          </div>
        ))}
      </div>
      <div className="group pace-card">
        <p className="frow">
          At {values.minutesPerDay} {values.minutesPerDay === 1 ? "minute" : "minutes"} a day you can read about{" "}
          <b className="mono">{formatWords(words)}</b> words a year &mdash; roughly{" "}
          <b>{novels}</b> average {novels === 1 ? "novel" : "novels"}.
        </p>
      </div>
    </>
  );
}
