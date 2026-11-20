import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the rows
// arrive. The title and its line, the tab strip, the three chips, then rows as `ProgressRows` draws them: the
// glyph, the name and the count, the meter and the next line.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="progress-page" aria-hidden="true">
        <div className="series-head"><Bar w="6rem" className="sk-h1" /><Bar w="19rem" className="sk-line" /></div>
        <span className="sk sk-tabs" />
        <div className="filters genre-row prog-chips">
          {["3rem", "4rem", "4.5rem"].map((w) => <Bar key={w} w={w} className="sk-chip" />)}
        </div>
        <ul className="group prog-rows">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="prog-li">
              <div className="row prog-item">
                <span className="prog-glyph"><span className="sk sk-glyph" /></span>
                <div className="rb">
                  <span className="rh">
                    <span className="rt prog-name"><Bar w={`${7 + (i % 3) * 2}rem`} className="sk-rt" /></span>
                    <span className="rm"><Bar w="2.5rem" className="sk-rm" /></span>
                  </span>
                  <span className="emeter" />
                  <div className="rs prog-next"><Bar w="10rem" className="sk-rs" /></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LoadingMain>
  );
}
