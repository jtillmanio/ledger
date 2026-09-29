import { sql } from "drizzle-orm";
import {
  boolean, check, date, doublePrecision, index, integer, pgTable, primaryKey,
  real, serial, text, timestamp, unique,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Identity
 *
 * Single user today, but every progress table carries user_id so that
 * adding a second reader is a row insert rather than a migration.
 * ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ *
 * Comics catalog
 * ------------------------------------------------------------------ */

export const tracks = pgTable("tracks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  publisher: text("publisher").notNull().default("Marvel"),
});

// A block is a numbered stretch of a track: "avengers block 2". Numbers are
// scoped per track, so block 2 of avengers and block 2 of x-men are different
// blocks. The id is the deterministic slug "<track>-b<number>", which keeps a
// re-run of etl/extract.py byte-identical instead of churning surrogate keys.
export const blocks = pgTable("blocks", {
  id: text("id").primaryKey(),              // "avengers-b2"
  trackId: text("track_id").notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),      // order within the track
  name: text("name"),                       // null today; named later
}, (t) => ({ uq: unique().on(t.trackId, t.number) }));

// The series-and-issues text ("Fantastic Four (1961) #570-588; FF #1-23") and
// the start/end years are not columns. They are summaries of the run's issues,
// so they live in the run_span view (etl/views.sql) and change the moment an
// issue is added, removed or dated.
export const runs = pgTable("runs", {
  id: text("id").primaryKey(),              // your existing slug: "hickman-ff"
  title: text("title").notNull(),
  // No writer or artists columns: a run's credit line is derived from its
  // issues' credits by the run_credit_line view (etl/views.sql).
  tier: integer("tier"),                    // 1-5, your priority ranking
  blockId: text("block_id").references(() => blocks.id),
  sequence: integer("sequence"),            // position within the block
  spine: boolean("spine").notNull().default(false),
  rating: integer("rating"),                // filled in after reading
  why: text("why"),                         // 2-4 sentences: importance, premise, creators, legacy
  // hand   = written or edited by Justin; nothing automated may overwrite it
  // claude = a Claude draft accepted as-is; may be re-proposed, never silently replaced
  whySource: text("why_source").notNull().default("hand"),
  notes: text("notes"),
  placeholder: boolean("placeholder").notNull().default(false),
}, (t) => ({
  whySource: check("runs_why_source_check", sql`${t.whySource} IN ('hand', 'claude')`),
}));

export const runTracks = pgTable("run_tracks", {
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  trackId: text("track_id").notNull().references(() => tracks.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.runId, t.trackId] }) }));

// One row per comic. The same issue in four runs is one row here and four in
// run_issues, so reading it once marks it read everywhere it appears. The id is
// a slug of the label ("fantastic-four-1961-570"), not a run position, so
// inserting an issue into a reading order renumbers nothing.
export const issues = pgTable("issues", {
  id: text("id").primaryKey(),              // "fantastic-four-1961-570"
  label: text("label").notNull().unique(),  // "Fantastic Four (1961) #570"
  // Publication facts. Each value travels with its provenance: metron or hand.
  coverDate: date("cover_date", { mode: "string" }),
  coverDateSource: text("cover_date_source"), // metron | hand; null when undated
  storyTitle: text("story_title"),          // Metron story names joined with "; "
  storyTitleSource: text("story_title_source"), // metron | hand; null when untitled
  coverUrl: text("cover_url"),              // Metron image URL; never hand-entered
  // Not unique: before label review, two spellings of one comic can both match.
  metronId: integer("metron_id"),
}, (t) => ({
  // A value and its provenance travel together: no unsourced value, no source
  // without a value. Written with IS NULL on both sides because a CHECK passes
  // on NULL: a bare `source IN (...)` would let a value through with no source.
  coverDateSource: check("issues_cover_date_source_check", sql`
    (${t.coverDate} IS NULL) = (${t.coverDateSource} IS NULL)
    AND (${t.coverDateSource} IS NULL OR ${t.coverDateSource} IN ('metron', 'hand'))`),
  storyTitleSource: check("issues_story_title_source_check", sql`
    (${t.storyTitle} IS NULL) = (${t.storyTitleSource} IS NULL)
    AND (${t.storyTitleSource} IS NULL OR ${t.storyTitleSource} IN ('metron', 'hand'))`),
}));

// Where an issue sits in a run's reading order. Type and notes belong to the
// placement: an issue can be core in one run and optional in another (213 are).
// One placement per (run, issue) — D-R2-1. The sheet's 13 repeated pairs were a
// block entered twice, not rereads; extract drops them. Rereads return
// deliberately with per-placement progress (task 0.8), which drops this UNIQUE.
export const runIssues = pgTable("run_issues", {
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),  // 1-based reading position within the run
  issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("core"), // core | recommended | optional
  notes: text("notes"),
}, (t) => ({
  pk: primaryKey({ columns: [t.runId, t.sequence] }),
  onePlacementPerRun: unique("run_issues_run_id_issue_id_unique").on(t.runId, t.issueId),
  byIssue: index("run_issues_issue_id_idx").on(t.issueId),
}));

// People credited on issues. The id is a slug of the name, so a hand-entered
// "Jonathan Hickman" and Metron's Jonathan Hickman are the same row.
export const creators = pgTable("creators", {
  id: text("id").primaryKey(),              // "jonathan-hickman"
  name: text("name").notNull(),
  metronId: integer("metron_id").unique(),
});

// Who did what on an issue. Metron's many role names collapse to six; editors
// and everything else are not stored.
export const issueCredits = pgTable("issue_credits", {
  issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  creatorId: text("creator_id").notNull().references(() => creators.id, { onDelete: "cascade" }),
  role: text("role").notNull(),             // writer | artist | inker | colorist | letterer | cover
  source: text("source").notNull(),         // metron | hand
}, (t) => ({
  pk: primaryKey({ columns: [t.issueId, t.creatorId, t.role] }),
  byCreator: index("issue_credits_creator_id_idx").on(t.creatorId),
  role: check("issue_credits_role_check",
    sql`${t.role} IN ('writer', 'artist', 'inker', 'colorist', 'letterer', 'cover')`),
  source: check("issue_credits_source_check", sql`${t.source} IN ('metron', 'hand')`),
}));

export const prereqs = pgTable("prereqs", {
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  prereqRunId: text("prereq_run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
  type: text("type").notNull(),             // hard | soft
}, (t) => ({ pk: primaryKey({ columns: [t.runId, t.prereqRunId] }) }));

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  year: integer("year"),
  verdict: text("verdict"),                 // read-it | tie-ins-only | summary-is-fine (CHECK from task 0.3)
  homeRunId: text("home_run_id").references(() => runs.id),
  note: text("note"),
});

export const eventRuns = pgTable("event_runs", {
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  runId: text("run_id").notNull().references(() => runs.id, { onDelete: "cascade" }),
}, (t) => ({ pk: primaryKey({ columns: [t.eventId, t.runId] }) }));

/** Trades and omnibuses — what you physically own, separate from what you've read. */
export const editions = pgTable("editions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  bookType: text("book_type"),              // Trade Paperback | Omnibus | Epic Collection
  author: text("author"),
  character: text("character"),
  year: integer("year"),
  issuesText: text("issues_text"),
  notes: text("notes"),
});

/* ------------------------------------------------------------------ *
 * Books catalog
 * ------------------------------------------------------------------ */

export const authors = pgTable("authors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

export const bookSeries = pgTable("book_series", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  authorId: text("author_id").references(() => authors.id),
  totalBooks: integer("total_books"),
});

export const books = pgTable("books", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  authorId: text("author_id").references(() => authors.id),
  seriesId: text("series_id").references(() => bookSeries.id),
  seriesPosition: real("series_position"),
  genre: text("genre"),
  bookType: text("book_type").notNull().default("Novel"),
  wordCount: integer("word_count"),
  publishedYear: integer("published_year"),
});

export const releases = pgTable("releases", {
  bookId: text("book_id").primaryKey().references(() => books.id, { onDelete: "cascade" }),
  releaseDate: text("release_date"),        // ISO date; null means announced but undated
});

/** Titles from the old To-Read tab that aren't clean book records yet. */
export const wishlist = pgTable("wishlist", {
  id: serial("id").primaryKey(),
  genre: text("genre"),
  rawEntry: text("raw_entry").notNull(),
  bookId: text("book_id").references(() => books.id),
});

/** BookTube and similar year-end lists, kept as source material. */
export const externalLists = pgTable("external_lists", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  year: integer("year"),
  rank: integer("rank"),                    // null for honorable mentions
  rawTitle: text("raw_title").notNull(),
  bookId: text("book_id").references(() => books.id),
});

/* ------------------------------------------------------------------ *
 * Progress — the only tables that are per-user
 * ------------------------------------------------------------------ */

export const issueProgress = pgTable("issue_progress", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  issueId: text("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }),
  // Nullable, because a read with no date is a real state (D-R3-1): the 76
  // workbook reads have none, and the range sheet's "No date" mode writes none.
  // Precision travels with the value: 'none' exactly when completed_at is NULL.
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
  completedAtPrecision: text("completed_at_precision").notNull().default("exact"), // exact | approximate | none
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.issueId] }),
  precision: check("issue_progress_completed_at_precision_check", sql`
    ${t.completedAtPrecision} IN ('exact', 'approximate', 'none')
    AND (${t.completedAt} IS NULL) = (${t.completedAtPrecision} = 'none')`),
}));

export const editionProgress = pgTable("edition_progress", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  editionId: text("edition_id").notNull().references(() => editions.id, { onDelete: "cascade" }),
  collected: boolean("collected").notNull().default(false),
  read: boolean("read").notNull().default(false),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.editionId] }) }));

export const bookStatus = pgTable("book_status", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("to_read"), // to_read | reading | read | dnf
  finishedYear: integer("finished_year"),
  yearRank: integer("year_rank"),           // your top-10 position for that year
  rating: doublePrecision("rating"),
  // A real date since migration 0004 (it was text and 100% NULL). Same rule as
  // issue_progress: precision 'none' exactly when the date is NULL. A finish
  // known only by its year is stored as that year's July 1st with precision
  // 'approximate', never 'exact' (ARCHITECTURE 2.17). finishedYear goes in task
  // 1.5 and the year is derived from finishedOn (D-21).
  finishedOn: date("finished_on", { mode: "string" }),
  finishedOnPrecision: text("finished_on_precision").notNull().default("none"), // exact | approximate | none
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.bookId] }),
  precision: check("book_status_finished_on_precision_check", sql`
    ${t.finishedOnPrecision} IN ('exact', 'approximate', 'none')
    AND (${t.finishedOn} IS NULL) = (${t.finishedOnPrecision} = 'none')`),
}));

export const readingPlan = pgTable("reading_plan", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bookId: text("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  plannedYear: integer("planned_year").notNull(),
  plannedQuarter: integer("planned_quarter"),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.bookId, t.plannedYear] }) }));
