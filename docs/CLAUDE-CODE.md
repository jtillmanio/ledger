# Claude Code — technique reference

**This is not a sequence.** `START-HERE.md` tells you *what* to build and when;
this file tells you *how* to drive Claude Code while you do it. Read it once
before your first build session, then come back to specific sections.

No installation steps or build ordering here — both live in `START-HERE.md`
Part 1 and Part 3.

---

## Contents

1. [The principle everything follows from](#1-the-principle)
2. [What's already in the repo](#2-whats-already-in-the-repo)
3. [The four-phase loop, worked](#3-the-four-phase-loop)
4. [Session hygiene](#4-session-hygiene)
5. [PC and Android](#5-pc-and-android)
6. [Review standards](#6-review-standards)
7. [Failure patterns](#7-failure-patterns)
8. [Prompt patterns worth reusing](#8-prompt-patterns)

---

## 1. The principle

**Claude stops when the work looks done.** Without a check it can run, "looks
done" is the only signal available — and you become the verification loop, where
every mistake waits for you to notice it.

Give it something that returns pass or fail and the loop closes on its own:
Claude does the work, runs the check, reads the result, and iterates until it
passes. That is the difference between supervising and reviewing.

Three consequences:

1. **Tasks 0.1 and 0.2 come first**, even though they build nothing visible.
   Every task in `TASKS.md` carries an acceptance check; they're worthless until
   there's a test runner and a CI job.
2. **Ask for evidence, not assertions.** "Show me the test output and the
   command you ran" is faster to review than re-running it yourself, and it
   works for sessions you weren't watching.
3. **Scope every task to one session.** A task that doesn't fit in a context
   window produces a plausible-looking half-implementation, and the review cost
   exceeds the writing cost.

---

## 2. What's already in the repo

| Path | Purpose |
|---|---|
| `CLAUDE.md` | Loads at the start of every session. Holds what Claude can't infer from code |
| `.claude/skills/verify/SKILL.md` | `/verify` — typecheck, lint, test, build, in order |
| `.claude/agents/schema-reviewer.md` | Subagent that reviews schema and query diffs in a fresh context |
| `.claude/rules/schema.md`, `ui.md` | Rule sheets the subagent and the UI work read |
| `.claude/hooks/guard-large-reads.js` | PreToolUse hook on `Read`, so a huge file can't flood the context |
| `.github/workflows/ci.yml` | One job, eight steps, on every PR: `tsc`, lint, `test:db:reset`, vitest, `test:views`, the Python ETL tests, `build` — against a Postgres 16 service container with `TEST_DATABASE_URL` and deliberately no `DATABASE_URL` |
| `.github/workflows/backup.yml` | Nightly `pg_dump` to `backups/` |
| `design/mockups.html` | 40 annotated screens. Authoritative for layout and copy |

### Why CLAUDE.md stays short

A bloated `CLAUDE.md` means Claude ignores half of it, because the rules that
matter get buried. For each line, ask whether removing it would cause a mistake.
If not, cut it.

The file has since grown well past the table below — the reviews of Sept 2026
added the authority hierarchy, the per-run read-state rule, the queue and era
rules, and the design tokens. The table is the original core, kept because it is
the clearest statement of the test each line has to pass, not a full inventory.
Every one of these survives it:

| Rule | Why it can't be inferred from the code |
|---|---|
| Derived data lives in views, never columns | The schema looks like it's missing denormalized counts |
| Catalog and progress are separate tables | Adding `completed` to `issues` looks natural and is wrong |
| `postgres.js` needs `prepare: false` | Neon transaction-pooler requirement, invisible in code |
| Run IDs are hand-authored slugs | They look auto-generatable |
| `placeholder = true` runs are forward-declared | Otherwise they look like bad data to clean up |
| Soft delete only | A cascade from `runs` silently takes issues and prereq edges |
| Enrichment never overwrites hand-entered values | Looks like a normal upsert otherwise |
| AI output passes parser + Metron + explicit accept | The most important safety rule in the app |
| `design/mockups.html` is authoritative | A reviewed decision beats an inferred one |

If Claude keeps skipping one instruction, mark **that single line** `IMPORTANT`.
Emphasize several and none of them stands out.

---

## 3. The four-phase loop

Per task. Do not skip to phase 3.

### Phase 1 — Explore

`Shift+Tab` until the status bar shows `⏸ plan mode on`, or start with
`claude --permission-mode plan`. Claude reads and answers without writing.

```
read @docs/TASKS.md task 1.3, @src/db/schema.ts, @src/components/IssueRow.tsx,
and the "Bulk add" section of @design/mockups.html.

how does the existing optimistic-update pattern work, and where would the
bulk-add route and its parser live?
```

### Phase 2 — Plan

Still in plan mode:

```
write a plan for task 1.3. the six validation rules and their order are in
the task. the pipeline shape is DIAGRAMS.md section 6. the UI is the
"Bulk add" screen in design/mockups.html — match its states and copy.

name every file you'll create or change, and say what's out of scope.
```

`Ctrl+G` opens the plan in your editor. **Edit it there before approving.** The
most common correction is scope — Claude will often fold in a refactor you
didn't ask for.

### Phase 3 — Implement

Approve the plan, or `Shift+Tab` out of plan mode.

```
implement the plan.

write the parser tests first, against a fixture covering all six validation
rules including the Captain America eight-volume case and a freeform label
like "Dark Reign: The Cabal".

run the tests and fix failures. address root causes — do not loosen
assertions to make a test pass.
```

### Phase 4 — Review and commit

```
use the schema-reviewer subagent to review this diff against task 1.3's
acceptance criteria. report gaps affecting correctness, not style.
```

Then `/verify`, then:

```
tick task 1.3 in TASKS.md, commit with a descriptive message, and open a PR
```

### When to skip plan mode

Scope is clear and the change is small — a typo, a log line, a rename, a
one-line copy change from the mockups. **If you could describe the diff in one
sentence, just ask for it.**

---

## 4. Session hygiene

Context is the binding constraint. Performance degrades as it fills, and Claude
starts forgetting earlier instructions.

| Situation | Do this |
|---|---|
| Finished a task | `/clear` before starting the next |
| Corrected the same issue twice | `/clear` and rewrite the prompt with what you learned. A clean session with a better prompt beats a long one full of failed approaches |
| Need broad exploration | "use subagents to investigate X" — they read in a separate context and report a summary |
| Claude went off track | `Esc` to stop, context preserved. `Esc Esc` or `/rewind` to restore code and conversation |
| Multi-sitting task | `/rename` the session (`task-1.3-bulk-entry`), resume with `claude --resume` |
| Quick side question | `/btw` — the answer never enters conversation history |
| Screenshot won't paste | `Alt+V`, or drag the file in. `Ctrl+V` is unreliable on Windows |

**One task per session is the default.** The moment you find yourself asking
about something unrelated, `/clear`.

### Parallel work with worktrees

When two tasks don't touch the same files:

```powershell
git worktree add ../rt-enrich task/4.1-metron
cd ../rt-enrich
claude
```

Good pairs: Phase 4 enrichment scripts alongside Phase 3 editing. Bad pairs:
anything that both touch `src/db/schema.ts`.

---

## 5. PC and Android

### On the PC

- **Windows Terminal** running `claude` in the repo root — the main loop.
- **VS Code** alongside it. Claude Code integrates directly with VS Code on a
  native Windows install.
- **Two sessions, writer and reviewer**, for anything in Phase 1 or 3. A fresh
  context reviews better because it isn't biased toward code it just wrote.
- Effort **xhigh** for implementation, **high** for planning and review.

### On the Android phone

- **Claude Code is reachable remotely from the Claude mobile app.** Kick off or
  check on a task away from the desk — useful for the long ones. Start task 1.3,
  do something else, read the result on your phone.
- **The app under test.** Chrome → three-dot menu → Add to Home screen.
- Effort **high**. The phone is for reviewing and conversation, not
  implementation.

### The workflow that suits this setup

Plan a task on the phone in the Claude app during the day, paste the agreed plan
into Claude Code on the PC that evening. **The expensive part of a task is
deciding what it should do, and that part doesn't need a keyboard.**

---

## 6. Review standards

What to actually look at, in the order it matters.

### Always check yourself

1. **Does the test exist, and would it have failed before?** Ask Claude to show
   the test running against the old code. A test written afterward that passes
   immediately proves nothing.
2. **Does the diff match the plan you approved?** Scope creep is the most common
   silent problem.
3. **Any new column that duplicates a view?** The subagent catches most, but
   this is the architectural rule most likely to be quietly violated.

### Let the subagent handle

- `deleted_at IS NULL` filters on new queries
- `etl/views.sql` updated to match a schema change
- Unparameterized SQL
- Table scans on `issues`

### Don't bother reviewing

- Formatting — lint handles it
- Test naming
- Comment wording

### A trap worth naming

A reviewer subagent asked to find gaps **will** find some, because that's what
you asked for. Chasing every finding produces defensive code and tests for cases
that can't happen. The subagent is instructed to flag only correctness issues;
treat anything beyond that as optional.

---

## 7. Failure patterns

| Pattern | What it looks like | Fix |
|---|---|---|
| **Kitchen-sink session** | One task, then something unrelated, then back. Context full of noise | `/clear` between tasks |
| **Correction spiral** | Two failed corrections on the same point | `/clear`, better prompt. Don't try a third time in the same session |
| **Trust-then-verify gap** | Plausible implementation that misses edge cases | If you can't verify it, don't ship it. Demand the test output |
| **Infinite exploration** | "Investigate the books schema" and it reads eighty files | Scope it, or delegate to a subagent |
| **Over-specified CLAUDE.md** | Claude keeps violating a written-down rule | The file is too long. Prune, or convert the rule to a hook |
| **Assertion-loosening** | A failing test "fixed" by weakening what it checks | Say explicitly: address root causes, don't loosen assertions |
| **Schema drift** | A new column a view already computes | Run the `schema-reviewer` subagent on every schema PR |
| **Mockup drift** | A screen built from the task text, ignoring the reviewed design | Attach the mockup section during explore, not after |

---

## 8. Prompt patterns

Reusable shapes. Adjust the specifics.

**Starting a task**

```
read @docs/TASKS.md task <id> and the <screen name> section of
@design/mockups.html. explain what this task needs to touch and what's
already in place. don't write anything yet.
```

**Constraining scope**

```
implement only what the plan says. if you find something else worth fixing,
list it at the end instead of doing it.
```

**Demanding evidence**

```
show me the commands you ran and their output. don't summarize.
```

**Reviewing work you didn't watch**

```
summarize what changed in this branch, which acceptance criteria from
TASKS.md are met, and which aren't. be specific about what's missing.
```

**After a failed approach**

```
that didn't work. before trying again: what assumption was wrong?
```

**Schema changes**

```
this changes the schema. update etl/views.sql to match, regenerate the
migration, and confirm the existing tests still pass against the new shape.
```

**Picking up in a fresh conversation**

```
read @docs/HANDOFF.md for project context and @docs/START-HERE.md for where I am.
I'm on step <n>. don't write anything until I confirm the plan.
```
