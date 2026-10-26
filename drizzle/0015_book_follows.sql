CREATE TABLE "author_follows" (
	"user_id" text NOT NULL,
	"author_id" text NOT NULL,
	"state" text DEFAULT 'tracking' NOT NULL,
	CONSTRAINT "author_follows_user_id_author_id_pk" PRIMARY KEY("user_id","author_id"),
	CONSTRAINT "author_follows_state_check" CHECK ("author_follows"."state" IN ('tracking', 'reading'))
);
--> statement-breakpoint
CREATE TABLE "book_universes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "series_follows" (
	"user_id" text NOT NULL,
	"series_id" text NOT NULL,
	"state" text DEFAULT 'tracking' NOT NULL,
	CONSTRAINT "series_follows_user_id_series_id_pk" PRIMARY KEY("user_id","series_id"),
	CONSTRAINT "series_follows_state_check" CHECK ("series_follows"."state" IN ('tracking', 'reading'))
);
--> statement-breakpoint
CREATE TABLE "universe_follows" (
	"user_id" text NOT NULL,
	"universe_id" text NOT NULL,
	"state" text DEFAULT 'tracking' NOT NULL,
	CONSTRAINT "universe_follows_user_id_universe_id_pk" PRIMARY KEY("user_id","universe_id"),
	CONSTRAINT "universe_follows_state_check" CHECK ("universe_follows"."state" IN ('tracking', 'reading'))
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "universe_id" text;--> statement-breakpoint
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_follows" ADD CONSTRAINT "series_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series_follows" ADD CONSTRAINT "series_follows_series_id_book_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."book_series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_follows" ADD CONSTRAINT "universe_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universe_follows" ADD CONSTRAINT "universe_follows_universe_id_book_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."book_universes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_universe_id_book_universes_id_fk" FOREIGN KEY ("universe_id") REFERENCES "public"."book_universes"("id") ON DELETE no action ON UPDATE no action;