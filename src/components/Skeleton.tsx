/**
 * Loading states for the routes' loading.tsx (task 0.9). A navigation paints
 * one of these at once, from the prefetched shell, instead of holding the old
 * screen until every query has answered; a cold Neon wake shows the skeleton,
 * not a frozen page. Each is the loaded geometry in --sunk (STYLE_GUIDE §9),
 * so nothing jumps when the content arrives. Server components, no state.
 */

function Bar({ w, className = "" }: { w: string; className?: string }) {
  return <span className={`sk ${className}`} style={{ width: w }} />;
}

/** A list screen: title, count line, its filter chip groups, then rows of title
 * + sub-line. `filters` is how many lines of chips each group wraps to, so the
 * rows start where the loaded rows will. */
export function ListSkeleton({ rows = 8, filters = [1], search = false }:
  { rows?: number; filters?: number[]; search?: boolean }) {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
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
      <div className="rows" aria-hidden="true">
        {Array.from({ length: rows }, (_, n) => (
          <div key={n} className="row">
            <Bar w={`${55 + ((n * 17) % 35)}%`} className="sk-title" />
            <Bar w={`${35 + ((n * 23) % 30)}%`} className="sk-sub" />
          </div>
        ))}
      </div>
    </main>
  );
}

/** The run page: back link, title, credit line, series text, the why, the
 * read count, then the spine. Header heights vary too much to match (the spine
 * starts anywhere from 450px to 8,700px down at 412px wide, mostly because
 * blocked runs list their prerequisites first), so this is a typical first
 * screen: four lines of series text and nine of why. */
export function RunSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
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
    </main>
  );
}
