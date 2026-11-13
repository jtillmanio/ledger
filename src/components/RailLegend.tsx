/**
 * The plan rail's key. The loading skeleton draws it too (same text, same wrap), so the rail's arrival shifts
 * nothing; `hidden` is that one, out of the accessibility tree like the rest of the skeleton.
 *
 * Its own module, with no `"use client"`, on purpose: `Skeleton` is on every route's loading boundary, and
 * importing the legend from `PlanRail` (a client component since task 2.3) would put the whole rail into
 * each of those routes' bundles (Lighthouse: +5.7 KB and a request on every page with a skeleton).
 *
 * A year accepted as a stretch year (task 2.7, `settled`) keys its grey hatch as *over, accepted (settled)*
 * (Plan Rail Spec A4.2): the overage is still drawn, and the key says what it now means.
 */
export default function RailLegend({ hidden = false, settled = false }: { hidden?: boolean; settled?: boolean }) {
  return (
    <ul className="qlegend" aria-hidden={hidden || undefined}>
      <li><i className="lg est" aria-hidden="true" /><span className="mono">~</span> estimated</li>
      {settled
        ? <li><i className="lg ovr settled" aria-hidden="true" /> over, accepted (settled)</li>
        : <li><i className="lg ovr" aria-hidden="true" /> over capacity</li>}
      <li><i className="lg stk" aria-hidden="true" /><span className="mono">+N</span> merged under 24px, or folded past the top</li>
      <li><i className="lg nqt" aria-hidden="true" /> year, no quarter</li>
    </ul>
  );
}
