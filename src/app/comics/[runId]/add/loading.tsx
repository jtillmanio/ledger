/**
 * Add issues while its queries answer (task 1.3c; UX floor): the loaded
 * geometry in --sunk — title, run chip, the Search · Type it control, the
 * textarea, the review heading and its empty slate — so nothing jumps.
 */
export default function Loading() {
  return (
    <main className="add" aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="add-2up" aria-hidden="true">
        <div>
          <span className="sk sk-h1" style={{ width: "9rem" }} />
          <span className="sk sk-line" style={{ width: "14rem" }} />
          <span className="sk sk-chip" style={{ width: "10rem" }} />
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
