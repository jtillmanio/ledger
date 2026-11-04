// Painted the moment a tap lands (task 0.9): Settings' loaded geometry in --sunk, the three
// stepper rows and the card, then the two data rows, so nothing jumps when the values arrive.
export default function Loading() {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <div className="settings-2up">
        <div>
          <span className="sk sk-h1" style={{ width: "8rem" }} />
          <span className="sk sk-line sk-head" style={{ width: "7rem" }} />
          <div className="group" aria-hidden="true">
            {[7, 7.5, 7].map((w, n) => (
              <div key={n} className="frow">
                <span className="sk sk-title" style={{ width: `${w}rem` }} />
                <span className="sk sk-stepper" />
              </div>
            ))}
          </div>
          <div className="group pace-card" aria-hidden="true">
            <div className="frow sk-card">
              <span className="sk sk-title" style={{ width: "100%" }} />
              <span className="sk sk-title" style={{ width: "70%" }} />
            </div>
          </div>
        </div>
        <div aria-hidden="true">
          <span className="sk sk-line sk-head" style={{ width: "4rem" }} />
          <div className="group">
            {/* Volume map has a line and no button; Export everything has its Download. */}
            <div className="frow">
              <span className="sk sk-val" style={{ width: "6rem" }} />
              <span className="sk sk-val" style={{ width: "7rem", marginLeft: "auto" }} />
            </div>
            <div className="frow">
              <span className="kv">
                <span className="sk sk-k" style={{ width: "9rem" }} />
                <span className="sk sk-k" style={{ width: "7rem" }} />
              </span>
              <span className="sk sk-btn" style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
