import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the series
// arrives. The way back, the name and the author line; the count, meter and follow control; then rows as
// `SeriesBooks` draws them: cover, `#n` and title, the status line.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="series-detail" aria-hidden="true">
        <div className="sp-head">
          <p className="shelf-back"><Bar w="4.5rem" className="sk-line" /></p>
          <Bar w="12rem" className="sk-h1" />
          <Bar w="9rem" className="sk-line" />
        </div>
        <div className="sp-side">
          <Bar w="5rem" className="sk-line" />
          <span className="meter" />
          <Bar w="18rem" className="sk-shelfopts" />
        </div>
        <div className="sp-main">
          <ul className="group series-rows sp-rows">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="row sp-row">
                <span className="cv rcv none" />
                {/* Each bar sits in the line the loaded text sits in, so the line, not the bar, sets the height. */}
                <div className="rb">
                  <span className="rh"><span className="rt"><Bar w={`${9 + (i % 4)}rem`} className="sk-rt" /></span></span>
                  <div className="rs sp-status"><span><Bar w="6rem" className="sk-rs" /></span></div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </LoadingMain>
  );
}
