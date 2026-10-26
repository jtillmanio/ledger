/**
 * The wishlist while your library answers (task 1.4d; UX floor): the loaded
 * geometry in --sunk — title, the lede, a genre head and a few review rows with
 * their decisions — so nothing jumps when the lines arrive.
 */
export default function WishlistLoading() {
  return (
    <div className="addb wishlist" aria-busy="true">
      <span className="sr-only" role="status">Loading your wishlist</span>
      <div aria-hidden="true">
        <span className="sk sk-h1" style={{ width: "9rem" }} />
        <span className="sk sk-line" style={{ width: "100%", maxWidth: "28rem" }} />
        <span className="sk sk-title" style={{ width: "6rem", marginTop: "1.5rem" }} />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="vrow">
            <span className="sk" style={{ width: 22, height: 22 }} />
            <div>
              <span className="sk sk-title" style={{ width: "70%" }} />
              <span className="sk sk-sub" style={{ width: "50%" }} />
              <span className="sk sk-chip" style={{ width: "9rem", margin: ".5rem 0 0" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
