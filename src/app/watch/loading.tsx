// Painted the moment a tap lands (task 0.9): the title and the slate's geometry in --sunk.
export default function Loading() {
  return (
    <main aria-busy="true">
      <span className="sr-only" role="status">Loading</span>
      <span className="sk sk-h1" style={{ width: "6rem" }} />
      <div className="slate" aria-hidden="true">
        <span className="sk sk-line" style={{ width: "80%" }} />
        <span className="sk sk-line" style={{ width: "55%" }} />
      </div>
    </main>
  );
}
