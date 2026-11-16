// Painted the moment a tap lands (task 0.9; task 4.4): the Calibre page's loaded geometry in --sunk,
// the heading, the lede, a few run rows and the *Not in Calibre* row, so nothing jumps when the log arrives.
export default function Loading() {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <span className="sk sk-h1" style={{ width: "6rem" }} />
      <span className="sk sk-line" style={{ width: "14rem" }} />
      <div aria-hidden="true">
        <span className="sk sk-line sk-head" style={{ width: "5rem" }} />
        <div className="group">
          {[0, 1, 2].map((n) => (
            <div key={n} className="crun crun-flat">
              <div className="csum">
                <span className="cmeta">
                  <span className="sk sk-val" style={{ width: "7rem" }} />
                  <span className="sk sk-cnt" style={{ width: "10.5rem" }} />
                </span>
              </div>
            </div>
          ))}
        </div>
        <span className="sk sk-line sk-head" style={{ width: "6rem" }} />
        <div className="group">
          <div className="crun crun-flat">
            <div className="csum">
              <span className="cmeta cmeta-one">
                <span className="sk sk-val" style={{ width: "9rem" }} />
                <span className="sk sk-cnt" style={{ width: "1.5rem" }} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
