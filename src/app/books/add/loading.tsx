/**
 * Add books while the page answers (task 1.4; UX floor): the loaded geometry in
 * --sunk — title, the textarea, the review heading and its empty slate — so
 * nothing jumps.
 */
export default function Loading() {
  return (
    <main className="add" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="add-2up" aria-hidden="true">
        <div>
          <span className="sk sk-h1" style={{ width: "9rem" }} />
          <span className="sk sk-title" style={{ width: "6rem" }} />
          <span className="sk sk-input add-sk-text" />
        </div>
        <div>
          <span className="sk sk-title" style={{ width: "6rem" }} />
          <span className="sk add-sk-slate" />
        </div>
      </div>
    </main>
  );
}
