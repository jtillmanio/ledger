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
  { id: "comics", path: "/comics", signedIn: true, tap: { from: "/books", selector: 'nav a[href="/comics"]' } },
  {
    id: "run-small", path: "/comics/bendis-disassembled", signedIn: true, // 5 issues
    tap: { from: "/comics", selector: 'a[href="/comics/bendis-disassembled"]' },
  },
  {
    id: "run-large", path: "/comics/busiek-avengers", signedIn: true, // 154 issues
    tap: { from: "/comics", selector: 'a[href="/comics/busiek-avengers"]' },
  },
  { id: "books", path: "/books", signedIn: true, tap: { from: "/comics", selector: 'nav a[href="/books"]' } },
];
