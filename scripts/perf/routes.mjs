// What every preview measures (task 0.10): the routes task 0.9 measured, each
// with the tap that reaches it. .github/workflows/lighthouse.yml measures this
// list and nothing else, and scripts/perf/budget.json holds one budget per id.
//
// A task that adds a page, at any depth, adds its URL here and its budget in
// the same PR, or lists it as unmeasured with a reason in test/perf.test.ts,
// which fails on any page.tsx that is neither (task 0.14c).
//
//   id       stable name, the key in budget.json and in the PR comment
//   path     what Lighthouse loads; a run is named by its hand-authored slug,
//            which a preview's Neon branch (copied from live) always has
//   signedIn false for a page measured signed out (/login)
//   tap      where the tap starts and what it taps; `login` types the passcode
//            and submits instead; `paints` is what the tap waits for when the
//            page's <h1> doesn't change (a sheet over a list), else a new <h1>
//   resolve  for a page whose id is the owner's data (a shelf, a book): `path`
//            is its pattern, and measure.mjs measures the first link
//            `selector` matches on `from` (resolvedPath), and logs which
export const ROUTES = [
  { id: "login", path: "/login", signedIn: false, tap: { from: "/login", login: true } },
  // The comics dashboard (task 1.8c); `/` redirects to it or to the medium last touched.
  { id: "comics", path: "/comics", signedIn: true, tap: { from: "/books/list", selector: 'nav a[href="/comics"]' } },
  // The run list, one level down: the screen "comics" measured before 1.8c.
  { id: "runs", path: "/comics/runs", signedIn: true, tap: { from: "/comics", selector: 'a[href="/comics/runs"]' } },
  {
    id: "run-small", path: "/comics/bendis-disassembled", signedIn: true, // 5 issues
    tap: { from: "/comics/runs", selector: 'a[href="/comics/bendis-disassembled"]' },
  },
  {
    id: "run-large", path: "/comics/busiek-avengers", signedIn: true, // 154 issues
    tap: { from: "/comics/runs", selector: 'a[href="/comics/busiek-avengers"]' },
  },
  // The books dashboard (task 2.2): the media switch's Books.
  { id: "books", path: "/books", signedIn: true, tap: { from: "/comics", selector: 'nav a[href="/books"]' } },
  // The Library (task 2.2e), what "books" measured before 2.2. Its item is the books medium's, so the tap
  // starts on the dashboard: the tab row's on a phone, the rail's or the sidebar's from 768px.
  { id: "library", path: "/books/list", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/list"]' } },
  // The plan page (task 2.10), the books medium's Plan item: the tap starts on the dashboard, as the Library's does.
  { id: "plan", path: "/books/plan", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/plan"]' } },
  // The status screens (task 1.9): In flight, the tab a bare visit opens, for each medium. Comics' Status is in the
  // rail, the sidebar and (since 2.2i) the phone's tab row, so the tap clicks the first match, the tab row's on a phone.
  { id: "comics-status", path: "/comics/status", signedIn: true, tap: { from: "/comics", selector: 'a[href="/comics/status"]' } },
  { id: "books-status", path: "/books/status", signedIn: true, tap: { from: "/books/list", selector: 'a[href="/books/status"]' } },
  // Inbox is in the rail, the sidebar and (since 2.2i) the phone's tab row: the tap clicks the first match, the tab row's on a phone.
  { id: "inbox", path: "/inbox", signedIn: true, tap: { from: "/books/list", selector: 'nav a[href="/inbox"]' } },
  // Progress (task 5.12) sits beside Inbox: the rail, the sidebar and the phone's tab row, so the tap clicks the first match.
  { id: "progress", path: "/progress", signedIn: true, tap: { from: "/books/list", selector: 'nav a[href="/progress"]' } },
  // The parked review (task 5.15, TASK-111) has no nav item: the Library's Parked filter always carries its
  // *Review parked →* link, whatever is parked, so the tap starts there.
  { id: "parked", path: "/parked", signedIn: true, tap: { from: "/books/list?status=parked", selector: 'a[href="/parked"]' } },
  // Settings (task 2.0): the rail's and sidebar's foot and the phone bar's gear; the tap clicks the first match, the gear's on a phone.
  { id: "settings", path: "/settings", signedIn: true, tap: { from: "/comics", selector: 'a[href="/settings"]' } },
  // The watch shell (task 1.8): the nav's link, with the slate and nothing more until 8.x.
  { id: "watch", path: "/watch", signedIn: true, tap: { from: "/comics", selector: 'nav a[href="/watch"]' } },
  // Task 0.14c: the pages drawn under /books, /book, a run and /settings that the top-level check never saw.
  // Each books item below is the books medium's nav: the tab row's on a phone, the rail's or the sidebar's
  // from 768px, so the tap starts on the dashboard, as the Library's does.
  { id: "releases", path: "/books/releases", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/releases"]' } },
  { id: "shelves", path: "/books/shelves", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/shelves"]' } },
  // A shelf's id is yours, not authored: the first shelf /books/shelves lists, which the tap opens too. Live with
  // no shelf fails the route as not measured (resolvedPath), never skips it.
  {
    id: "shelf", path: "/books/shelves/[id]", signedIn: true,
    resolve: { from: "/books/shelves", selector: 'a[href^="/books/shelves/"]' },
    tap: { from: "/books/shelves", selector: 'a[href^="/books/shelves/"]' },
  },
  { id: "books-add", path: "/books/add", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/add"]' } },
  { id: "top", path: "/books/top", signedIn: true, tap: { from: "/books", selector: 'a[href="/books/top"]' } },
  // A book's page: the Library's first book. The Lighthouse load is the full page (a direct load: a reload or a
  // shared link); the tap is what a tap does, the sheet over the Library through the @modal intercept, which
  // keeps the Library's <h1>, so it waits for the sheet's heading, drawn once the book has loaded.
  {
    id: "book", path: "/book/[id]", signedIn: true,
    resolve: { from: "/books/list", selector: '.book-row a[href^="/book/"]' },
    tap: { from: "/books/list", selector: '.book-row a[href^="/book/"]', paints: '[role="dialog"] [data-sheet-heading]' },
  },
  // A run's Add (task 1.3c), from the run's own *Add issues*; the small run, by its authored slug.
  {
    id: "run-add", path: "/comics/bendis-disassembled/add", signedIn: true,
    tap: { from: "/comics/bendis-disassembled", selector: 'a[href="/comics/bendis-disassembled/add"]' },
  },
  // Calibre sync (task 4.4), from Settings' *Calibre* row.
  { id: "calibre", path: "/settings/calibre", signedIn: true, tap: { from: "/settings", selector: 'a[href="/settings/calibre"]' } },
];
