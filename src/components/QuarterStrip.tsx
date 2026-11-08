import type { PeriodCapacity, QuarterBlock } from "@/db/queries";
import { quarterName } from "@/lib/format";

/** Words as the strip says them: `615k`, `1.2M`. */
export function kWords(words: number): string {
  return words >= 1_000_000 ? `${(words / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : `${Math.round(words / 1000)}k`;
}

/** A block narrower than this share of the strip keeps its words to its name: the label won't fit. */
const LABEL_MIN = 0.07;

/**
 * *This quarter* (FP-D8; §14.1 Position; task 2.2): the single-quarter strip. One block per book
 * that counts against the quarter, its width its words against the quarter's capacity; read books
 * fill with `--ready`, the book in hand is outlined in `--brand`, the rest wait in `--sunk`. The
 * dashed rule is capacity. The figures are 2.1's (`planCapacity`): *3 of 7 read · 615k planned ·
 * 760k a quarter*. Past capacity the scale stretches to the plan, the rule moves in, and the
 * figure turns `--blocked` amber with *52k over*: a decision, never red, never "behind" (§12).
 *
 * 2.2b replaces this with its rail component, one quarter wide (M-07): the markup is a rail of
 * one column, `.qrail > .qcol > .qstack > .qcell`, so the swap is the component, not the page.
 */
export default function QuarterStrip({ cap, blocks, inHand }: {
  cap: PeriodCapacity; blocks: QuarterBlock[]; inHand: string | null;
}) {
  const name = quarterName(cap.period);
  const scale = Math.max(cap.plannedWords, cap.capacity) || 1;
  const over = cap.plannedWords > cap.capacity;
  const past = cap.plannedWords - cap.capacity;
  const summary = cap.books === 0
    ? `${name}: nothing planned, ${kWords(cap.capacity)} a quarter`
    : `${name}: ${cap.readBooks} of ${cap.books} books read, ${kWords(cap.plannedWords)} of ${kWords(cap.capacity)} words planned${over ? `, ${kWords(past)} over` : ""}`;
  return (
    <section className="quarter-slot" aria-labelledby="quarter-head" data-slot="position">
      <div className="slot-head"><h2 id="quarter-head">This quarter</h2></div>
      <div className="qcard">
        <div className="qhead">
          <b>{name}</b>
          {cap.books > 0 && <span className="mono">{cap.readBooks} of {cap.books} read</span>}
        </div>
        <div className="qrail" role="img" aria-label={summary} data-over={over || undefined}>
          <div className="qcol">
            <div className="qstack" aria-hidden="true">
              {blocks.map((b) => {
                const share = b.words / scale;
                return (
                  <span key={b.id} className="qcell" data-state={b.id === inHand ? "head" : b.status === "read" ? "read" : undefined}
                    style={{ flexBasis: `calc(${(share * 100).toFixed(3)}% - 2px)` }}>
                    {share >= LABEL_MIN && <span className="mono">{kWords(b.words)}</span>}
                  </span>
                );
              })}
            </div>
            <i className="qcap" style={{ left: `${((cap.capacity / scale) * 100).toFixed(3)}%` }} aria-hidden="true" />
          </div>
        </div>
        <div className="qfigs mono">
          <span className={over ? "qfig over" : "qfig"}>
            {cap.books === 0 ? "Nothing planned yet" : `${kWords(cap.plannedWords)} planned`}
            {over && <span className="bdg bl">{kWords(past)} over</span>}
          </span>
          <span>{kWords(cap.capacity)} a quarter</span>
        </div>
      </div>
    </section>
  );
}
