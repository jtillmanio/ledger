---
id: TASK-020
title: 1.11 Slow down failed sign-ins
status: Ready
depends_on: [TASK-019]
size: S
model: sonnet
autonomy: attended
ui: false
plan_status: none
planned_at_commit:
---

# TASK-020 — 1.11 Slow down failed sign-ins

## Goal

A wrong passcode takes a second to be refused, so guessing it one try at a time is slow. The right passcode signs in instantly.

## Context

- Roadmap: `docs/05-roadmap.md` § 1.11 Slow down failed sign-ins (sitting 7, last; built before cutover, because from Step 14 the database is the only record). The roadmap entry and its **Check:** are the contract.
- Code: `src/app/api/login/route.ts` compares the passcode and answers at once. `src/lib/auth.ts` holds the session helpers. `src/proxy.ts` is the passcode gate. It is Next.js 16, so read `node_modules/next/dist/docs/` before changing the route handler.
- Behaviour: a failed sign-in waits one second before its `303` to `/login?error=1`. The wait is the same for a wrong, an empty and a wrong-length passcode. A correct one is never delayed. **Stateless**: the wait lives in the route handler, never in an in-memory counter, which a serverless instance doesn't keep and another instance never sees.
- Decisions: D-23 (a four-or-more-word passphrase is the defence against parallel guesses, and stays a Step 14 gate), D-36 (the owner asked for this delay; a per-client lockout would need a table, so it is not part of this task), R2-12. 6.13 replaces the passcode later and keeps the delay.
- Don't assume Vercel Authentication (START-HERE 10e) stays on in front of production.
- `depends_on` TASK-019 records the sitting's build order, not a data dependency.

## Acceptance criteria

- [ ] AC-1 (roadmap **Check:**, verbatim): a vitest drives the route handler with fake timers. A wrong passcode's response is still pending at 999 ms and resolves at 1000 ms, to `/login?error=1` with no `rt_session` cookie. An empty one and a wrong-length one behave the same. A right passcode resolves without advancing the timers and sets the cookie. No test waits on a real clock.
- [ ] AC-2: The comparison stays constant-time (`timingSafeEqual`, as today). The delay is applied after the comparison and before the response for every failure path, including a malformed body. A malformed body still answers `303` to `/login?error=1`, never a 500.
- [ ] AC-3: Nothing outside the request is kept: no module-level counter, map or timestamp is added (a test or review of the diff confirms the handler holds no state between requests), and no schema change is made.

## Out of scope

- A per-client or per-IP lockout. That needs a table: ask first, and it isn't this task.
- Replacing the passcode with real sign-in (6.13).
- Rate limiting any other route.
- Vercel firewall or Authentication settings.

## Files likely touched

- `src/app/api/login/route.ts`: the one-second wait on every failure path.
- `test/login-delay.test.ts` (new): the fake-timer tests.

## Verification

- Automated: `test/login-delay.test.ts` with fake timers covers wrong, empty, wrong-length and malformed failures pending at 999 ms and resolving at 1000 ms without a cookie, and the right passcode resolving at once with the cookie (AC-1, AC-2). Diff review for statelessness (AC-3).
- Manual: `npm run dev`, sign in with a wrong passcode → expected: about a one-second pause, then *wrong passcode*. Sign in with the right one → expected: immediate.

## Plan

_Written by /plan-batch or /implement-task Phase 1. Approved by the user (plan_status: approved) before any code is written._

## Review log

_Filled by /implement-task. One line per round._

## Blocked

_Only if status is Blocked: what failed, what was tried, best hypothesis, decision needed._

## Metrics

- Verify rounds:
- Review rounds:
- First-pass AC FAILs:
- Plan revisions after approval:
