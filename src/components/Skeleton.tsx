/**
 * Loading states for the routes' loading.tsx (task 0.9). A navigation paints
 * one of these at once, from the prefetched shell, instead of holding the old
 * screen until every query has answered; a cold Neon wake shows the skeleton,
 * not a frozen page. Each is the loaded geometry in --sunk (STYLE_GUIDE §9),
 * so nothing jumps when the content arrives. Server components, no state.
 *
 * Task 1.8d adds the pieces a dashboard is drawn from: `TelecardSkeleton`,
 * `RunRowsSkeleton`, `PlanRailSkeleton` and `SeasonRowsSkeleton`. They are
 * aria-hidden; the route's `loading.tsx` wraps them in `LoadingMain`, which is
 * busy for assistive tech and announces once. The telecard, plan rail and
 * season rows have no loaded component yet (2.5b, 2.2b, 8.7), so these are
 * measured against test/e2e/fixtures/*.html; the task that builds each one
 * re-measures its skeleton.
 */

/** The page a `loading.tsx` paints: busy, and one "Loading" for a screen reader. */
export function LoadingMain({ children }: { children: React.ReactNode }) {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      {children}
    </main>
  );
}

export function Bar({ w, className = "" }: { w: string; className?: string }) {
  return <span className={`sk ${className}`} style={{ width: w }} />;
}

/** A list screen: title, count line, its filter chip groups, then rows of title
 * + sub-line. `filters` is how many lines of chips each group wraps to, so the
 * rows start where the loaded rows will. */
export function ListSkeleton({ rows = 8, filters = [1], search = false }:
  { rows?: number; filters?: number[]; search?: boolean }) {
  return (
    <LoadingMain>
      <Bar w="9rem" className="sk-h1" />
      <Bar w="7rem" className="sk-line" />
      {search && <span className="sk sk-input" />}
      {filters.map((lines, g) => (
        <div key={g} className="filters" aria-hidden="true">
          {Array.from({ length: lines * 3 }, (_, n) => (
            <Bar key={n} w={`${5.5 + ((n * 7 + g) % 4) * 0.5}rem`} className="sk-chip" />
          ))}
        </div>
      ))}
      <RunRowsSkeleton rows={rows} />
    </LoadingMain>
  );
}

/** Run rows: a title and a sub-line, as /comics/runs and the dashboard's lists draw them. */
export function RunRowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="row sk-row">
          <Bar w={`${55 + ((n * 17) % 35)}%`} className="sk-title" />
          <Bar w={`${35 + ((n * 23) % 30)}%`} className="sk-sub" />
        </div>
      ))}
    </div>
  );
}

/** The dashboard's telecard: kicker, name, byline, the telescope's svg box, its
 * caption and the three-line ladder. The svg keeps the telescope's 344:354
 * ratio, so it scales with the card instead of holding one width's pixels. */
export function TelecardSkeleton() {
  return (
    <div className="telecard sk-telecard" aria-hidden="true">
      <Bar w="40%" className="sk-kick" />
      <Bar w="70%" className="sk-name" />
      <Bar w="50%" className="sk-by" />
      <span className="sk sk-tele" />
      <div className="sk-telecap">
        {["100%", "96%", "62%"].map((w, n) => <Bar key={n} w={w} className="sk-text" />)}
      </div>
      <div className="ladder">
        {[["60%", ""], ["75%", ""], ["85%", " two"]].map(([w, two], n) => (
          <div key={n}><Bar w={w} className={`sk-ladder${two}`} /></div>
        ))}
      </div>
    </div>
  );
}

/** The books plan rail: four quarter columns and the no-quarter column, each a
 * stack of blocks over its footer. The stack is 192px tall, as the rail draws it. */
export function PlanRailSkeleton() {
  const stacks = [[11, 11, 21, 19, 27, 74], [22, 22, 21, 31, 32], [12, 7, 16, 39], [27, 22], [36, 39, 88]];
  return (
    <div className="planrail sk-planrail" aria-hidden="true">
      {stacks.map((blocks, q) => (
        <div key={q} className={q === stacks.length - 1 ? "qcol nq" : "qcol"}>
          <div className="qstack" style={{ height: 192 }}>
            {blocks.map((h, n) => <i key={n} className="sk" style={{ height: h }} />)}
          </div>
          <div className="qfoot">
            <Bar w="1.5rem" className="sk-qb" />
            <Bar w="2rem" className="sk-qm" />
            <Bar w="2.5rem" className="sk-qd" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Watch season rows: a 50×75 cover, a title, its line and a tag, and the verb. */
export function SeasonRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="group" aria-hidden="true">
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="row">
          <span className="sk sk-cover" />
          <div className="rb sk-rb">
            <Bar w={`${45 + ((n * 19) % 30)}%`} className="sk-rt" />
            <Bar w="90%" className="sk-rs first" />
            <Bar w={`${40 + ((n * 13) % 25)}%`} className="sk-rs" />
            <Bar w="4rem" className="sk-tag" />
          </div>
          <span className="sk sk-verb" />
        </div>
      ))}
    </div>
  );
}

/** The run page: back link, title, credit line, series text, the why, the
 * read count, then the spine. Header heights vary too much to match (the spine
 * starts anywhere from 450px to 8,700px down at 412px wide, mostly because
 * blocked runs list their prerequisites first), so this is a typical first
 * screen: four lines of series text and nine of why. */
export function RunSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <LoadingMain>
      <Bar w="4.5rem" className="sk-line" />
      <Bar w="14rem" className="sk-h1" />
      <Bar w="70%" className="sk-line" />
      <div aria-hidden="true">
        {["95%", "90%", "93%", "60%"].map((w, n) => <Bar key={n} w={w} className="sk-mono" />)}
      </div>
      <div className="sk-para" aria-hidden="true">
        {["100%", "96%", "98%", "94%", "97%", "99%", "95%", "98%", "55%"].map((w, n) => <Bar key={n} w={w} className="sk-text" />)}
      </div>
      <Bar w="6rem" className="sk-line" />
      <h2>Issues</h2>
      <div className="group" aria-hidden="true">
        {Array.from({ length: rows }, (_, n) => (
          <div key={n} className="iss">
            <span className="chk"><i className="sk-dot" /></span>
            <span className="ib"><Bar w={`${45 + ((n * 19) % 40)}%`} className="sk-title" /></span>
            <Bar w="1.25rem" className="sk-sub" />
          </div>
        ))}
      </div>
    </LoadingMain>
  );
}
