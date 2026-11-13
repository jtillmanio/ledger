CREATE TABLE "plan_acceptance" (
	"year" integer PRIMARY KEY NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_total" bigint NOT NULL
);
