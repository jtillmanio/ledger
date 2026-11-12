/**
 * The plan rail's key. The loading skeleton draws it too (same text, same wrap), so the rail's arrival shifts
 * nothing; `hidden` is that one, out of the accessibility tree like the rest of the skeleton.
 *
 * Its own module, with no `"use client"`, on purpose: `Skeleton` is on every route's loading boundary, and
 * importing the legend from `PlanRail` (a client component since task 2.3) would put the whole rail into
 * each of those routes' bundles (Lighthouse: +5.7 KB and a request on every page with a skeleton).
 */
export default function RailLegend({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="qlegend" aria-hidden={hidden || undefined}>
      <li><i className="lg est" aria-hidden="true" /><span className="mono">~</span> estimated</li>
      <li><i className="lg ovr" aria-hidden="true" /> over capacity</li>
      <li><i className="lg stk" aria-hidden="true" /><span className="mono">+N</span> merged under 24px, or folded past the top</li>
      <li><i className="lg nqt" aria-hidden="true" /> year, no quarter</li>
    </ul>
  );
}
