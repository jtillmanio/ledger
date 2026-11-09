import PlanRail from "@/components/PlanRail";
import type { PeriodCapacity, QuarterBlock } from "@/db/queries";
import { quarterName } from "@/lib/format";
import { kWords } from "@/lib/plan-rail";

/**
 * *This quarter* (FP-D8; §14.1 Position; task 2.2, 2.2b): the plan rail laid on its side, one
 * quarter wide (M-07). One block per book that counts against the quarter, its width its words
 * against the quarter's capacity; read books fill with `--ready`, the book in hand is outlined in
 * `--brand`, the rest wait in `--sunk`. The dashed rule is capacity, and the part of a block past
 * it is hatched. The figures are 2.1's (`planCapacity`): *3 of 7 read · 615k planned · 760k a
 * quarter*. Past capacity the scale stretches to the plan, the rule moves in, and the figure turns
 * `--blocked` amber with *52k over*: a decision, never red, never "behind" (§12).
 */
export default function QuarterStrip({ cap, blocks, inHand }: {
  cap: PeriodCapacity; blocks: QuarterBlock[]; inHand: string | null;
}) {
  const name = quarterName(cap.period);
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
        <PlanRail axis="row" year={cap.year} quarters={[cap]} inHand={inHand} label={summary}
          books={blocks.map((b) => ({ ...b, period: cap.period }))} />
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
