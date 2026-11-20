import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the review
// arrives (task 5.15, TASK-111). The heading and the *Last reviewed* line, a group head, then rows of cover,
// title, sub-line and age beside the three verbs' box, then *Done reviewing*. `.sk-bookrow`, not
// `.book-row`: a test counting the loaded rows must not count these.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="7rem" className="sk-h1" />
      <Bar w="9rem" className="sk-sub" />
      <section aria-hidden="true">
        <Bar w="5rem" className="sk-head rel-sk-head" />
        <div className="rows">
          {Array.from({ length: 3 }, (_, n) => (
            <div key={n} className="row sk-bookrow parked-sk-row">
              <span className="sk rcv" />
              <span className="rb">
                <Bar w={`${50 + ((n * 17) % 35)}%`} className="sk-title" />
                <Bar w={`${35 + ((n * 23) % 30)}%`} className="sk-sub" />
              </span>
              <span className="sk sk-verbs" />
            </div>
          ))}
        </div>
      </section>
      <span className="sk sk-done" aria-hidden="true" />
    </LoadingMain>
  );
}
