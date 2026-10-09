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
