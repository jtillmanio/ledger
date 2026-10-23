/**
 * The readiness badge on an Up next card or row (task 1.10), unchanged from
 * the run's own (design §11.4): glyph plus text, never colour alone, and the
 * glyph hidden so a screen reader hears the words. A queued run here is
 * unstarted, so it is one of the three prerequisite states; `blocked` is the
 * only amber one, because wanting to read it next is legitimate and the badge
 * says what that costs (data model 2.16). `blockedBy` is the direct hard
 * prerequisites still unread; the transitive count arrives with 2.6, and the
 * five-state `<RunStateBadge>` with 2.4.
 */
export default function QueueBadge({ readiness, blockedBy, softLeft }: {
  readiness: "blocked" | "ready_hard" | "ready_all"; blockedBy: number; softLeft: number;
}) {
  if (readiness === "blocked") {
    return (
      <span className="bdg bl"><span aria-hidden="true">⊘</span> {blockedBy} {blockedBy === 1 ? "run" : "runs"} first</span>
    );
  }
  if (readiness === "ready_hard") {
    return <span className="bdg rd out"><span aria-hidden="true">○</span> ready · {softLeft} soft unread</span>;
  }
  return <span className="bdg rd"><span aria-hidden="true">●</span> ready</span>;
}
