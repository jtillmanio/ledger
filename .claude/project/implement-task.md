# implement-task: Ledger

- **Phase 6: don't ask before pushing.** In attended mode too, push the task
  branch and open the draft PR as soon as the close-out commit is made: skip
  the "Push and open a draft PR?" question (owner, 2026-10-09;
  `.claude/rules/git.md` § *Push and open the PR*). Then go straight into the
  Phase 7 ready gates. The floor is unchanged: never push to or merge into
  `main`, never force-push, never start Release.
- **ui-verifier runs against the development database without asking.** The
  dev server (`npm run dev`) reads `.env` `DATABASE_URL`. The owner allows the
  ticks, unticks and undos a UI check makes there, as long as it leaves the data
  as it found it (CLAUDE.md, *Stop and ask before*). Production is never touched.
- **Before Phase 2, check the model (attended only).** Compare the task's
  `model:` front matter with the model this session runs on (the system prompt
  names it). If they differ, stop before writing any code and say:
  "TASK-### is `model: <x>`; this session is <y>. Run `/clear`, `/model <x>`,
  then `/implement-task TASK-###`." The plan is already saved in the task file,
  so the new session skips Phase 1. Carry on only if the owner says to. The
  check matters most for `sonnet` tasks in an Opus session: implementing on
  Sonnet is the cheaper path the field exists for. Unattended sessions skip it:
  `dispatch-approved.ps1` already starts them on the task's model.
