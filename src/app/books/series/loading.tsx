import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the
// series arrive. The title and its line, then rows as `SeriesList` draws them: the name and its count,
// the author, the Next up line, the meter.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="series-page" aria-hidden="true">
        <div className="series-head"><Bar w="6rem" className="sk-h1" /><Bar w="16rem" className="sk-line" /></div>
        <ul className="group series-rows series-list">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="row series-row">
              <div className="rb">
                {/* Each bar sits in the line the loaded text sits in, so the line, not the bar, sets the height. */}
                <span className="rh">
                  <span className="rt"><Bar w={`${8 + (i % 3) * 2}rem`} className="sk-rt" /></span>
                  <span className="rm"><Bar w="2.5rem" className="sk-rm" /></span>
                </span>
                <div className="rs"><Bar w="7rem" className="sk-rs" /></div>
                <div className="rs"><Bar w="12rem" className="sk-rs" /></div>
                <span className="meter" />
              </div>
              <span className="chev" />
            </li>
          ))}
        </ul>
      </div>
    </LoadingMain>
  );
}
