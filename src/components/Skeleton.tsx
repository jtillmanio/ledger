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
 * rows start where the loaded rows will. `sort` ends the first group with the
 * Library's Sort control. */
export function ListSkeleton({ rows = 8, filters = [1], search = false, sort = false }:
  { rows?: number; filters?: number[]; search?: boolean; sort?: boolean }) {
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
          {/* The Library's Sort, which ends its first group (task 2.2e): the same wrapper, so it wraps where the control does. */}
          {sort && g === 0 && <span className="sort"><Bar w="12.5rem" className="sk-sort" /></span>}
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
 * stack of blocks over its footer. The stack is the rail's height (230px on the phone,
 * 300px on desktop: `--rail-h`), its blocks standing from the foot. */
export function PlanRailSkeleton() {
  const stacks = [[26, 28, 34, 28, 54, 72], [27, 28, 26, 38, 40], [14, 9, 20, 48], [34, 27], [44, 48, 108]];
  return (
    <div className="planrail sk-planrail" aria-hidden="true">
      {stacks.map((blocks, q) => (
        <div key={q} className={q === stacks.length - 1 ? "qcol nq" : "qcol"}>
          <div className="qstack">
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

/**
 * The books dashboard's Now (task 2.2): the hero's own box, its cover and lines in --sunk, so it
 * holds the loaded hero's size (`now-hero`, `now-band`, `now-cover`, `now-foot`). It stands for
 * *Between books* too, which the loading screen can't know is coming.
 */
export function BooksNowSkeleton() {
  return (
    <section className="now-hero sk-now" aria-hidden="true">
      <div className="now-band">
        <span className="now-cover"><span className="sk sk-fill" /></span>
        <div className="now-body">
          <Bar w="6rem" className="sk-now-kick" />
          <Bar w="80%" className="sk-now-name" />
          <Bar w="50%" className="sk-now-by" />
          <span className="grow" />
          <Bar w="7rem" className="sk-now-pages" />
        </div>
      </div>
      {/* The status control's badge (task 1.17b) holds its row's height. */}
      <div className="now-status"><Bar w="5rem" className="sk-now-status" /></div>
      {/* The foot wraps to two lines on a phone, and fits one from the tablet up. */}
      <p className="now-foot"><Bar w="85%" className="sk-now-foot" /><Bar w="45%" className="sk-now-foot two" /></p>
    </section>
  );
}

/** A cover shelf (comics' Up next, books' *Up next in Qn*): the slot head and `n` cards. */
export function ShelfSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <section className="shelf-slot" aria-hidden="true">
      <div className="slot-head"><Bar w="7rem" className="sk-head" /></div>
      <ul className="shelf">
        {Array.from({ length: cards }, (_, n) => (
          <li key={n} className="card">
            <span className="cover"><span className="sk sk-fill" /></span>
            <Bar w="90%" className="sk-card-title" />
            <Bar w="60%" className="sk-card-meta" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** *This quarter*'s card: its head, the strip and the foot, at the loaded card's size. */
export function QuarterStripSkeleton() {
  return (
    <section className="quarter-slot" aria-hidden="true">
      <div className="slot-head"><Bar w="6rem" className="sk-head" /></div>
      <div className="qcard">
        <div className="qhead"><Bar w="4.5rem" className="sk-qhead" /></div>
        <span className="sk planrail strip" />
        <div className="qfigs"><Bar w="6rem" className="sk-qfigs" /><Bar w="6rem" className="sk-qfigs" /></div>
      </div>
    </section>
  );
}

/** Add books in its sheet while its code loads (task 1.30: it loads when the
 * sheet opens, not with the page). The sheet's frame and heading are already
 * drawn and focused; this is the body's loaded geometry, Search open: the
 * *Search · Paste a list · By hand* control, Add to's chips (wrapping as they
 * do), the search box and its note, *Or paste a list* with its box, *Review*
 * and its empty slate, and the sticky Cancel · Add bar. It is as tall as the
 * loaded body, so the sheet does not jump when the code arrives. */
export function AddBooksSheetSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div aria-hidden="true">
        <span className="sk" style={{ width: "14rem", maxWidth: "100%", height: "2.125rem", marginTop: ".75rem", borderRadius: "var(--r-md)" }} />
        <div className="addto">
          {["2.75rem", "5.25rem", "4.5rem", "7.5rem", "4.25rem"].map((w, i) => (
            <span key={w} className="sk sk-chip" style={{ width: w, height: i === 0 ? ".8125rem" : "2rem" }} />
          ))}
        </div>
        <span className="sk sk-title" style={{ width: "6rem", margin: "1rem 0 .375rem" }} />
        <span className="sk" style={{ height: "2.75rem", borderRadius: "var(--r-md)" }} />
        <Bar w="100%" className="sk-line" />
        <Bar w="40%" className="sk-line" />
        <span className="sk sk-title" style={{ width: "7rem", margin: "1.5rem 0 .5rem" }} />
        <span className="sk sk-title" style={{ width: "100%", margin: "1rem 0 .25rem" }} />
        <span className="sk sk-title" style={{ width: "50%", margin: "0 0 .375rem" }} />
        <span className="sk add-sk-text" style={{ height: "10.25rem", borderRadius: "var(--r-md)" }} />
        <Bar w="100%" className="sk-line" />
        <Bar w="30%" className="sk-line" />
        <span className="sk sk-title" style={{ width: "5rem", margin: "1.5rem 0 .5rem" }} />
        <span className="sk add-sk-slate" style={{ height: "9.6875rem" }} />
        {/* Outside .addb, so the sheet's own margin for it (globals.css .sheet .addb .add-bar) is given here. */}
        <div className="actionbar add-bar" style={{ margin: "1.25rem -.875rem 0" }}>
          <div className="add-buttons">
            <span className="sk" style={{ width: "5rem", height: "2.75rem", borderRadius: "var(--r-md)" }} />
            <span className="sk" style={{ flex: 1, height: "2.75rem", borderRadius: "var(--r-md)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
