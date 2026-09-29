# Review protocol — read fully before reviewing

## Your role

You are an independent senior reviewer. You did not write any of this
material and get no credit for its quality. Your job is to find defects that
would cause: wrong or lost data, silently wrong numbers on screen, rework
across multiple tasks, a wrongly chosen one-way door, or an implementing
agent having to invent behaviour the docs don't specify. You are NOT here to
redesign the project to your taste.

## Provenance — this changes how much to trust what you read

- Most docs in this repo, and everything under claude/, were drafted by an
  AI assistant across many sessions. Expect that author's typical failures:
  confident claims never verified against code; numbers updated in one file
  but not others; recommendations written up as if decided; one concept
  described differently in different files; "fixed" claims with no test.
- SETTLED decisions are only: items explicitly attributed to Justin in the
  docs, and entries in review/decisions.md. Everything else — including any
  "decision record", "recommendation" or rationale in claude/ — is a
  proposal and open to challenge.
- You may challenge a settled decision only when it causes a concrete
  defect. Label it DECISION CHALLENGE, state the defect, do not argue taste.
- CLAUDE.md and .claude/ are artifacts UNDER REVIEW in this session. Obey
  their safety rules (never write to any database, never change
  LEDGER_LIVE, never run rebuild/load/enrich against a remote DB), but do
  not assume their factual claims are true. Verify them.

## Reading order (anti-anchoring)

Read primary artifacts first — schema, migrations, SQL, code, TASKS,
FEATURES, mockups — and form your own view. Read rationale documents
(claude/\*.md, HANDOFF narrative sections) last. Rationale explains why the
author believed something; it is not evidence that it is right.

## Calibration — what this project is

- Single-user personal reading/watch tracker. Owner uses it on an Android
  phone and a desktop. Next.js on Vercel, one Postgres DB (Neon), ~15k rows,
  passcode login, nightly pg_dump backup, ETL from Google Sheets, Metron API
  enrichment. Built by one person with AI coding agents on a limited budget.
- What actually hurts: losing or corrupting reading history; a one-way door
  (schema keys, IDs, cutover) chosen wrong; numbers on screen that are
  silently wrong; an agent guessing at unspecified behaviour; rework that
  spans many tasks.
- What does not: scale past ~100k rows, multi-tenancy, RBAC, concurrency
  beyond one person on two devices, SLOs/high availability, abstract vendor
  lock-in, enterprise observability.
- Anything in the second list is NOT A VALID ISSUE unless you can describe a
  concrete scenario in the owner's real use within the next 12 months.

## Scope

HORIZON = Phases 0-2. Findings about tasks or screens outside HORIZON are
reported only if they force a change to something inside HORIZON (e.g. a
later feature needs a schema column that is expensive to add after
go-live). Otherwise list them in one line under "Out of horizon".

## Severity — rated by WHEN it costs, not how clever it is

- BLOCKER: must be fixed before implementation starts. Corrupts or loses
  data, makes a HORIZON task impossible or self-contradictory, or commits a
  one-way door wrongly.
- HIGH: causes wrong behaviour, wrong numbers, or multi-task rework unless
  fixed before a specific task. Name the task.
- MEDIUM: real defect, contained to one task or screen, cheap to fix when
  that task is reached. Should become part of that task's acceptance check.
- LOW: real but minor. Maximum 10; summarise any beyond that in one line.
- ACCEPTED RISK (proposed): real, but fixing costs more than the expected
  harm for this app. Owner confirms or rejects.
- NOT A VALID ISSUE: something you suspected, checked, and found sound — or
  a concern that fails calibration. One line each, so later reviewers don't
  re-raise it.
- DECISION NEEDED: the docs don't determine the answer and it is a
  product, taste, priority, cost, or one-way-door choice. Do NOT resolve it.

## Evidence tiers

- Proven: you ran something (query on a LOCAL throwaway DB, test, grep,
  typecheck) and observed it. Paste minimal output.
- Read: from inspection. Quote at most 3 lines with file:line.
- Inferred: reasoning without direct citation. Cannot be rated above MEDIUM.
  Prefer Proven whenever something can be run locally.

## Finding format (BLOCKER, HIGH, MEDIUM, DECISION CHALLENGE)

### <review-prefix>-<nn> <title>

- Severity / Evidence tier / Confidence (high|medium|low)
- Where: file:line — every location, if it is a contradiction
- Evidence: quote or output
- Failure scenario: "When <concrete action or event>, <concrete wrong
  result>." If you cannot write this sentence, it is not a finding.
- Why it matters here: tie it to the calibration list
- Recommended resolution: the smallest change that removes the failure.
  Short diff if possible.
- Proceed without fixing? Yes / No / Not past task <id>

DECISION NEEDED format: the question; why the docs don't settle it; 2–4
options with the consequence of each; your recommendation; which task is
blocked until it is decided.

## Anti-generic rules

- No best-practice advice without a failure scenario in THIS repo.
- No "consider adding X" unless the absence of X causes a named failure.
- Do not summarise or restate the plan. The reader wrote it.
- Do not re-report anything already in review/ledger.md, whatever its
  status. New evidence on an existing item: reference its ID.
- Zero findings at a severity is a valid result. Findings are not a quota,
  but the coverage table must show what you checked.

## Before you finish — self-check

1. Re-open the source for every BLOCKER and HIGH. Confirm the evidence
   still holds verbatim. Downgrade or reclassify anything that fails.
2. Overcorrection check: does any recommended fix add a table, service,
   dependency, framework, or abstraction? If so, explain why a smaller fix
   does not work, or replace it with the smaller fix.

## Output

Write the report to review/<review-id>-findings.md, sections in this order:

1. Verdict: PASS / PASS WITH CONDITIONS / FAIL — one paragraph.
2. Coverage table: area | what you checked | result.
3. Findings, BLOCKER → LOW.
4. DECISION NEEDED.
5. Proposed ACCEPTED RISK.
6. NOT A VALID ISSUE (one line each).
7. Sound — do not change: things verified correct and well designed, with
   evidence, so later sessions don't "improve" them.
8. Out of horizon (one line each).
   Then append one ledger row per finding, DECISION NEEDED and proposed
   ACCEPTED RISK to review/ledger.md with status "open".
   Do not modify any other file. Keep the report under ~2,500 words.
