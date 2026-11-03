ALTER TABLE "book_status" ADD COLUMN "started_on" date;--> statement-breakpoint
ALTER TABLE "book_status" ADD COLUMN "started_on_precision" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "read_events" ADD COLUMN "started_on" date;--> statement-breakpoint
ALTER TABLE "read_events" ADD COLUMN "started_on_precision" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "book_status" ADD CONSTRAINT "book_status_started_on_precision_check" CHECK (
    "book_status"."started_on_precision" IN ('exact', 'approximate', 'none')
    AND ("book_status"."started_on" IS NULL) = ("book_status"."started_on_precision" = 'none'));--> statement-breakpoint
ALTER TABLE "read_events" ADD CONSTRAINT "read_events_started_on_precision_check" CHECK (
    "read_events"."started_on_precision" IN ('exact', 'approximate', 'none')
    AND ("read_events"."started_on" IS NULL) = ("read_events"."started_on_precision" = 'none'));