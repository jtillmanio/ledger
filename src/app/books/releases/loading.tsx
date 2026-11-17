import { Bar, LoadingMain } from "@/components/Skeleton";

// Painted the moment a tap lands (task 0.9): the loaded geometry in --sunk, so nothing jumps when the list
// arrives (task 5.7). The heading, then two groups as the page draws them: a group head, and rows of cover,
// title and sub-line, and the Got it's box. `.sk-bookrow`, not `.book-row`: a test counting the loaded rows
// must not count these.
export default function Loading() {
  return (
    <LoadingMain>
      <Bar w="9rem" className="sk-h1" />
      {[3, 2].map((rows, g) => (
        <section key={g} aria-hidden="true">
          <Bar w={g === 0 ? "5rem" : "7rem"} className="sk-head rel-sk-head" />
          <div className="rows">
            {Array.from({ length: rows }, (_, n) => (
              <div key={n} className="row sk-bookrow rel-sk-row">
                <span className="sk rcv" />
                <span className="rb">
                  <Bar w={`${50 + (((n + g) * 17) % 35)}%`} className="sk-title" />
                  <Bar w={`${35 + (((n + g) * 23) % 30)}%`} className="sk-sub" />
                </span>
                <span className="sk sk-gotit" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </LoadingMain>
  );
}
