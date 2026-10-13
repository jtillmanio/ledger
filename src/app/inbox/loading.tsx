// Painted the moment a tap lands, from the prefetched shell (task 0.9): the
// inbox's loaded geometry in --sunk, the capture field, its kind control and
// Save, then the unresolved notes, so nothing jumps when they arrive.
export default function Loading() {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="inbox-2up">
        <div>
          <span className="sk sk-h1" style={{ width: "8rem" }} />
          <span className="sk sk-line" style={{ width: "12rem" }} />
          <span className="sk sk-capture" aria-hidden="true" />
          <div className="capture-ctl" aria-hidden="true">
            <span className="sk sk-seg" />
            <span className="sk sk-save" />
          </div>
        </div>
        <div aria-hidden="true">
          <span className="sk sk-line sk-head" style={{ width: "6rem" }} />
          <div className="group notes">
            {[70, 85, 60, 75].map((w, n) => (
              <div key={n} className="row note">
                <span className="rb">
                  <span className="sk sk-title" style={{ width: `${w}%` }} />
                  <span className="sk sk-sub" style={{ width: "40%" }} />
                </span>
                <span className="sk sk-btn" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
