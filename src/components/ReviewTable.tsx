"use client";

import type { ReactNode } from "react";
import type { ReviewRow } from "@/lib/bulk-review";

const GLYPH = { ok: "✓", choice: "!", error: "×" } as const;
const NAME = { ok: "OK", choice: "Needs a choice", error: "Error" } as const;
const TONE = { ok: "ok", choice: "wn", error: "er" } as const;

/** What the table draws of a row: the issue review's rows, and the book review's (task 1.4). */
export type ReviewTableRow = Pick<ReviewRow, "key" | "line" | "kind" | "text" | "why" | "check" | "groups" | "invalid"> & Partial<Pick<ReviewRow, "rule">>;

/**
 * The review table (design §11, *Review tables*), shared by both halves of
 * Add issues (1.3c, 1.3b) and by Add books' *Paste a list* (1.4): per line, the
 * kind glyph, the parsed line, one line of why, the check, and the decision as
 * a radiogroup. Stacked, as the mockup draws it at every width. Glyph and text,
 * never colour alone; a line that failed its check marks its decision
 * `aria-invalid` and points at the why.
 *
 * The wishlist review (1.4d) draws one table per genre: `label` names each, and
 * `extra` adds a control under a row's decision (its *Edit*).
 */
export default function ReviewTable<R extends ReviewTableRow = ReviewTableRow>({ rows, checking, onChoose, label = "Review", extra }: {
  rows: R[];
  /** The catalog check is out: an unverified check may still change. */
  checking: boolean;
  onChoose: (group: string, option: string) => void;
  label?: string;
  extra?: (row: R) => ReactNode;
}) {
  return (
    <ol className="group review" aria-label={label}>
      {rows.map((row) => {
        const whyId = `why-${row.line}`;
        return (
          <li key={row.key} className="vrow" data-kind={row.kind}>
            <span className={`vd ${TONE[row.kind]}`} role="img" aria-label={NAME[row.kind]}>{GLYPH[row.kind]}</span>
            <div className="vbody">
              <div className="vhead">
                <span className="vl">{row.text}</span>
                <span className="vcheck mono">{checking && row.check === "unverified" ? "checking…" : row.check}</span>
              </div>
              {row.why && <div className="vm" id={whyId}>{row.why}</div>}
              {row.groups.map((g) => (
                <div key={g.key} role="radiogroup" className="opts" aria-label={`${g.name}, line ${row.line}`}
                  aria-invalid={row.invalid || undefined} aria-describedby={row.why ? whyId : undefined}>
                  {g.options.map((o) => (
                    <label key={o.id} className={`opt${o.destructive ? " no" : ""}`}>
                      <input type="radio" name={g.key} value={o.id} checked={g.choice === o.id}
                        onChange={() => onChoose(g.key, o.id)} />
                      {o.label}
                    </label>
                  ))}
                </div>
              ))}
              {row.rule && (
                <button type="button" role="switch" aria-checked={row.rule.on} className="switch"
                  onClick={() => onChoose(row.rule!.key, row.rule!.on ? "off" : `year:${row.rule!.year}`)}>
                  <b aria-hidden="true" />
                  Always use {row.rule.year} for {row.rule.series}
                </button>
              )}
              {extra?.(row)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
