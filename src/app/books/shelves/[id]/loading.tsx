import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the
// shelf arrives. The way back, the name and its description line; the count, meter, follow control and
// + Add to shelf; then rows as `ShelfBooks` draws them: handle, cover, title, author and note lines, the ⋯.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="shelf-page" aria-hidden="true">
        <div className="shelf-head">
          <p className="shelf-back"><Bar w="4.5rem" className="sk-line" /></p>
          <Bar w="12rem" className="sk-h1" />
          <div className="shelf-headtext"><Bar w="16rem" className="sk-line" /></div>
        </div>
        <div className="shelf-side">
          <Bar w="5rem" className="sk-line" />
          <span className="meter" />
          <Bar w="18rem" className="sk-shelfopts" />
          <Bar w="9rem" className="sk-shelfbtn" />
        </div>
        <div className="shelf-main shelf-books">
          <ol className="queue">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="qrow">
                <span className="drag" />
                <span className="cv" />
                {/* Each bar sits in the line the loaded text sits in, so the line, not the bar, sets the height. */}
                <span className="qbody">
                  <span className="qtitle"><Bar w={`${9 + (i % 4)}rem`} className="sk-in" /></span>
                  {/* .qmeta is a flex row: the bar's own span is the item, so it keeps a text line. */}
                  <span className="qmeta"><span><Bar w="6rem" className="sk-in" /></span></span>
                  <span className="inline-add"><Bar w="5rem" className="sk-in" /></span>
                </span>
                <span className="rowmenu-btn" />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </LoadingMain>
  );
}
