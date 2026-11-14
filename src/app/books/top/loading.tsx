import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so
// nothing jumps when the year arrives. The heading, the year control and its
// count, the rules line, then ten rows as `.qrow` draws them: handle, cover,
// title and line, the ⋯.
export default function Loading() {
  return (
    <LoadingMain>
      <div className="top-page" aria-hidden="true">
        <Bar w="11rem" className="sk-h1 top-head" />
        <div className="top-ctl">
          <div className="ctl"><Bar w="5rem" className="sk-select" /><Bar w="6rem" className="sk-line" /></div>
          <Bar w="16rem" className="sk-line" />
        </div>
        <ol className="queue top-list">
          {Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="qrow">
              <span className="drag" />
              <span className="topcv"><span className="cv" /></span>
              <span className="qbody"><Bar w={`${9 + (i % 4)}rem`} className="sk-line" /><Bar w="7rem" className="sk-line" /></span>
            </li>
          ))}
        </ol>
      </div>
    </LoadingMain>
  );
}
