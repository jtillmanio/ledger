import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the
// universes arrive. The title and its line, the tab row, the chips, then rows as `UniversesList` draws them:
// the name and its count, the series-and-follow line, the meter.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="series-page" aria-hidden="true">
        <div className="series-head"><Bar w="7rem" className="sk-h1" /><Bar w="18rem" className="sk-line" /></div>
        <Bar w="100%" className="sk-tabs" />
        <div className="filters genre-row series-chips">
          {/* `sk-dd` is 44px below 768px and 1.85rem above, as the loaded chips are. */}
          {["5.5rem", "4.5rem"].map((w) => <Bar key={w} w={w} className="sk-chip sk-dd" />)}
        </div>
        <ul className="group series-rows series-list">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="row series-row">
              <div className="rb">
                {/* Each bar sits in the line the loaded text sits in, so the line, not the bar, sets the height. */}
                <span className="rh">
                  <span className="rt"><Bar w={`${8 + (i % 3) * 2}rem`} className="sk-rt" /></span>
                  <span className="rm"><Bar w="2.5rem" className="sk-rm" /></span>
                </span>
                <div className="rs"><Bar w="8rem" className="sk-rs" /></div>
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
