// What every preview measures (task 0.10): the routes task 0.9 measured, each
// with the tap that reaches it. .github/workflows/lighthouse.yml measures this
// list and nothing else, and scripts/perf/budget.json holds one budget per id.
//
// A task that adds a top-level screen adds its URL here, and its budget, in the
// same PR (test/perf.test.ts fails on a top-level page with no route here).
//
//   id       stable name, the key in budget.json and in the PR comment
//   path     what Lighthouse loads; a run is named by its hand-authored slug,
//            which a preview's Neon branch (copied from live) always has
//   signedIn false for a page measured signed out (/login)
//   tap      where the tap starts and what it taps; `login` types the passcode
//            and submits instead
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
  // The books list, until 2.2 builds the books dashboard at /books. Not /books itself:
  // Lighthouse sends the session as a Cookie header, which a redirect drops.
  { id: "books", path: "/books/list", signedIn: true, tap: { from: "/comics", selector: 'nav a[href="/books/list"]' } },
  // The status screens (task 1.9): In flight, the tab a bare visit opens, for each medium. Comics' Status is in the
  // rail and the sidebar and not on the phone bar, so the tap clicks the first match, hidden or not.
  { id: "comics-status", path: "/comics/status", signedIn: true, tap: { from: "/comics", selector: 'a[href="/comics/status"]' } },
  { id: "books-status", path: "/books/status", signedIn: true, tap: { from: "/books/list", selector: 'a[href="/books/status"]' } },
  // Inbox is in the rail and the sidebar and not on the phone bar: the tap clicks the first match, hidden or not.
  { id: "inbox", path: "/inbox", signedIn: true, tap: { from: "/books/list", selector: 'nav a[href="/inbox"]' } },
  // The watch shell (task 1.8): the nav's link, with the slate and nothing more until 8.x.
  { id: "watch", path: "/watch", signedIn: true, tap: { from: "/comics", selector: 'nav a[href="/watch"]' } },
];
