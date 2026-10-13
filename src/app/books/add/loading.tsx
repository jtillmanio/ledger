/**
 * Add books while the page answers (tasks 1.4, 1.4c; UX floor): the loaded
 * geometry in --sunk — title, the Search · Paste a list · By hand control, the
 * Add to chips and the search box, then the paste box and its empty slate
 * (beside them from 1024px) — so nothing jumps.
 */
export default function Loading() {
  return (
    <main className="add" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div aria-hidden="true">
        <span className="sk sk-h1" style={{ width: "9rem" }} />
        <span className="sk sk-chip" style={{ display: "block", width: "16rem", margin: ".75rem 0 0", borderRadius: "9px" }} />
        <span className="sk sk-chip" style={{ width: "100%", maxWidth: "22rem", margin: ".75rem 0 0" }} />
        <div className="add-2up">
          <div>
            <span className="sk sk-title" style={{ width: "6rem", marginTop: "1rem" }} />
            <span className="sk sk-input" />
          </div>
          <div>
            <span className="sk sk-title" style={{ width: "6rem", marginTop: "1rem" }} />
            <span className="sk sk-input add-sk-text" />
            <span className="sk add-sk-slate" />
          </div>
        </div>
      </div>
    </main>
  );
}
