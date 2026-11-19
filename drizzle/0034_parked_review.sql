ALTER TABLE "reading_settings" ADD COLUMN "parked_review" text DEFAULT 'quarterly' NOT NULL;--> statement-breakpoint
ALTER TABLE "reading_settings" ADD COLUMN "parked_reviewed_on" date;--> statement-breakpoint
ALTER TABLE "reading_settings" ADD CONSTRAINT "reading_settings_parked_review_check" CHECK ("reading_settings"."parked_review" IN ('monthly', 'quarterly', 'never'));