# spec-reviewer: Ledger checks

Roadmap mode (`workflow.roadmap` = `docs/TASKS.md`) already covers the task's **Check:** line, its checkbox, and the rule that a task file ranks below `docs/TASKS.md`. Run these on top of that. The numbered rules are `CLAUDE.md` § Hard rules.

1. **Nothing derived is stored (rule 2), keyed progress (rule 3).** Any new column in `src/db/schema.ts` that is a count, percentage, rollup, status, span, credit line, or finish or plan year is a violation; it belongs in `etl/views.sql`. Any new comics read-state column or key on `issues.id` instead of `run_issues.id` is a violation, and so is a per-user boolean on a catalog table.
2. **Soft delete (rule 4).** Every new read in `src/db/queries.ts`, `src/app/**` or `etl/views.sql` filters `deleted_at IS NULL`; removing a placement is an `UPDATE … SET deleted_at`, never a `DELETE`.
3. **Test isolation (rule 5).** No new test, fixture or script that truncates reads `DATABASE_URL` or `.env.live`, or falls back to either when `TEST_DATABASE_URL` is unset.
4. **Styling (rule 6).** In changed `.css` and `.tsx` files: no literal hex or `#fff` outside `src/app/globals.css`, no Tailwind class names, no `--danger` on a dashboard, every meter filled with `--ready`. For UI tasks also: the feel-pass or mockup frame the task names was followed; no progress drawn against the catalog; the mark verb names the issue by its label. (The UX floor and the `design/mockups.html` redraw of standing rule 6 are the kit's UI-task step, through the **UX floor** role and `ui.redrawFiles`.)
5. **Same-PR obligations (rule 7).** A new `pgTable` is in `src/db/export-tables.ts`; a migration that drops, retypes or merges a column has `drizzle/down/<tag>.sql` and an up → down → up test.
