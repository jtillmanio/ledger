# new-task: Ledger

Roadmap mode (`workflow.roadmap` is `docs/05-roadmap.md`). On top of the kit's
roadmap-mode steps:

- **Convert by milestone.** `docs/06-tasklist.md` puts the roadmap IDs into
  milestones in build order. Convert one milestone, or the rest of one, at a
  time, in that order. A roadmap ID that is in no milestone is a bug in the
  tasklist: stop and ask which milestone it belongs to.
- **Write the task ID into the tasklist.** In the same commit as the task
  files, append each new file's `TASK-###` to the `#` cell of its row in
  `docs/06-tasklist.md` (`1.4f → TASK-040`; the bare ID, not a link:
  `archive-done.ps1` moves Done files later). Roadmap mode writes nothing back
  by itself, so this rule is what lets `/implement-task` tick the row's Done
  cell. Leave Done blank. Change nothing else there: not the order, a title,
  a note or a dependency.
- **The UX floor** is `docs/04-design.md` § 10. A `ui: true` task's UX-floor
  criterion cites it.
