ALTER TABLE "event_tracks" RENAME TO "event_runs";--> statement-breakpoint
ALTER TABLE "event_runs" RENAME COLUMN "track_id" TO "run_id";--> statement-breakpoint
ALTER TABLE "event_runs" DROP CONSTRAINT "event_tracks_event_id_events_id_fk";
--> statement-breakpoint
ALTER TABLE "event_runs" DROP CONSTRAINT "event_tracks_track_id_tracks_id_fk";
--> statement-breakpoint
ALTER TABLE "event_runs" DROP CONSTRAINT "event_tracks_event_id_track_id_pk";--> statement-breakpoint
ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_event_id_run_id_pk" PRIMARY KEY("event_id","run_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_runs" ADD CONSTRAINT "event_runs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
