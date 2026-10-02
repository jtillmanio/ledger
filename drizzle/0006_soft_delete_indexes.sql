CREATE INDEX "books_live_series_idx" ON "books" USING btree ("series_id","series_position") WHERE "books"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "issues_live_label_idx" ON "issues" USING btree ("label") WHERE "issues"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "run_issues_live_run_seq_idx" ON "run_issues" USING btree ("run_id","sequence") WHERE "run_issues"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "runs_live_block_seq_idx" ON "runs" USING btree ("block_id","sequence") WHERE "runs"."deleted_at" IS NULL;