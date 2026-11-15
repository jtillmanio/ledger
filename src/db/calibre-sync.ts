/**
 * The Calibre sync, the app's side (task 4.4, F-33; D-83, D-87, D-89, D-90,
 * D-130, D-133). `npm run calibre:sync` (TASK-082) reads the owner's library
 * and posts it to `POST /api/calibre/sync`; this applies it and answers what
 * the Ledger holds for each Calibre book, which the command writes back.
 *
 * Calibre → Ledger, Calibre winning (D-87). Each record is matched as 1.18
 * matches (`src/lib/calibre-match.ts`, calibre.py's twin):
 * - matched: Calibre's title, author, series and index, subseries and index,
 *   universe and position, genres, and its `stated` word count (where it has
 *   one) replace the Ledger's; a field the payload leaves out is left alone,
 *   and null clears it. The page count (Hardcover's first, D-130) and the reads
 *   (the Ledger's from the books cutover, D-133) are never touched.
 * - new: created at Unlisted (D-83), or Read with its one `read_events` row
 *   (`format = 'text'`) when Calibre marks it read or dates it, as 1.18 loads
 *   one (owner, at 4.4's plan gate). Its page count follows D-130: Hardcover's
 *   book-level count, else the matched edition's, else Calibre's `#pages` when
 *   Hardcover answered with none; when Hardcover couldn't be asked it stays
 *   NULL for the backfill (`src/db/backfill.ts`), which never replaces a count.
 * - a near spelling, or one title under another author, waits for a decision
 *   (`calibre_decisions`, `decideCalibrePair`); a stored `merge` renames that
 *   Ledger book to Calibre's spelling and gives it the id, a `separate` creates
 *   the book. Two Calibre books on one Ledger book wait too.
 * - a comic is skipped (the Ledger keeps comics as issues), as is a book the
 *   Ledger removed; a record repeating an earlier one's title and author is
 *   skipped, as calibre.py skips it.
 * - a Ledger book whose Calibre id has left Calibre stays live and is listed.
 * Tags and ISBN are accepted and not stored: `books` has no column for them
 * yet (owner, at 4.4's plan gate).
 *
 * Ledger → Calibre: for every Calibre book the Ledger has, whether it has a
 * read, the latest read's finish and precision, the status and the owned
 * formats (5.17); for each record sent, the writes where Calibre's `#read`,
 * `#date_read`, `#ledger_status` or `#owned` differs. A column the command says
 * the library lacks is named and skipped. The same before and after the books
 * cutover (1.26): what is written into Calibre is the command's.
 *
 * One transaction, one log row (`calibre_syncs`) per run; a run with nothing
 * in and nothing out logs empty lists. It takes the add flows' lock, so an add
 * and a sync never create one book twice.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  db, authors, books, bookGenres, bookSeries, bookStatus, bookSubseries, bookUniverses, calibreDecisions, calibreSyncs,
  readEvents,
} from "@/db";
import { hardcoverAsker, lookUpBook, Stop, wait, type Lookup } from "@/db/backfill";
import { addLock, createBooks, type BookRow, type Tx } from "@/db/writes";
import { cleanKey } from "@/lib/book-match";
import { normalizeLine } from "@/lib/bulk-parse";
import { LedgerIndex, type CalibreMatch, type LedgerBook } from "@/lib/calibre-match";
import { slug } from "@/lib/issue-slug";

/** The Calibre columns the Ledger writes back (D-133). */
export const CALIBRE_COLUMNS = ["#read", "#date_read", "#ledger_status", "#owned"] as const;
export type CalibreColumn = (typeof CALIBRE_COLUMNS)[number];
/** New books looked up on Hardcover in one run, at about a second each; the rest wait for the backfill. */
export const MAX_LOOKUPS = 20;
/** Records one request may carry: well over the owner's library. */
export const MAX_RECORDS = 20_000;
const PRECISIONS = ["exact", "approximate", "none"] as const;
type Precision = (typeof PRECISIONS)[number];

/** One Calibre book as the command reads it (`etl/calibre.py`'s reading). */
export type CalibreRecord = {
  calibreId: number;
  title: string;
  authors: string[];
  series?: string | null; seriesIndex?: number | null;
  subseries?: string | null; subseriesIndex?: number | null;
  /** `#superseries`: the universe (D-90). */
  superseries?: string | null; superseriesIndex?: number | null;
  genres?: string[];
  /** Accepted, not stored yet. */
  tags?: string[];
  /** Accepted, not stored yet; the command passes it to the backfill, and the sync's Hardcover lookup reads it. */
  isbn?: string | null;
  words?: number | null;
  pages?: number | null;
  /** `#type`: Book, Comic, Fan Fiction (D-88). */
  type?: string | null;
  /** Calibre's `#read`, `#date_read` (an Eastern day, or a year) and its precision, `#ledger_status`, `#owned`. */
  read?: boolean | null;
  dateRead?: string | null;
  precision?: Precision | null;
  ledgerStatus?: string | null;
  owned?: string[] | null;
};

export type SyncPayload = {
  records: CalibreRecord[];
  /** Every Calibre id in the library: a Ledger book whose id isn't here has left Calibre. */
  calibreIds: number[];
  /** Write-back columns the library lacks: named in the log and skipped. */
  missingColumns: CalibreColumn[];
};

/** What the Ledger holds for one Calibre book. */
export type Holding = {
  calibreId: number; bookId: string;
  read: boolean; finishedOn: string | null; precision: Precision;
  status: string | null;
  /** 5.17's formats (`audio`, `physical`), sorted; the ebook is the Calibre book itself. */
  owned: string[];
};

type FieldChange = { field: string; from: unknown; to: unknown };
export type InChange = {
  kind: "created" | "updated"; calibreId: number; bookId: string; title: string; changes: FieldChange[];
};
export type OutWrite = { calibreId: number; bookId: string; title: string; column: CalibreColumn; from: unknown; to: unknown };
export type Waiting = {
  kind: "near spelling" | "same title" | "two calibre books"; calibreId: number; title: string; author: string;
  bookId: string; bookTitle: string; similarity?: number;
};
export type SyncReport = {
  in: InChange[];
  out: OutWrite[];
  waiting: Waiting[];
  gone: { bookId: string; title: string; calibreId: number }[];
  skipped: { reason: "comic" | "removed in the Ledger" | "repeats a title and author"; calibreId: number; title: string }[];
  skippedColumns: CalibreColumn[];
  notes: string[];
};
export type SyncResult = { id: number; ranAt: string; holdings: Holding[]; report: SyncReport };

export type SyncOptions = {
  sleep?: (ms: number) => Promise<void>;
  /** New books looked up on Hardcover, at most; MAX_LOOKUPS when absent. */
  maxLookups?: number;
  /** Epoch ms: a 429 that can't be waited out by then stops the lookups. */
  deadline?: number;
};

// ---------------------------------------------------------------------------
// the payload
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const optStr = (v: unknown) => v === undefined || v === null || typeof v === "string";
const optNum = (v: unknown) => v === undefined || v === null || (typeof v === "number" && Number.isFinite(v));
const optStrs = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.every((s) => typeof s === "string"));

/** `YYYY`, or a `YYYY-MM-DD` that is a day on the calendar (no February 31st), from the year 1 (Postgres has no year 0). */
function isCalendarDate(s: string): boolean {
  const m = /^(\d{4})(?:-(\d{2})-(\d{2}))?$/.exec(s);
  if (!m || Number(m[1]) < 1) return false;
  if (m[2] === undefined) return true;
  const [y, mo, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const d = new Date(0);
  d.setUTCFullYear(y, mo, day); // not Date.UTC, which reads 0001–0099 as 1901–1999
  return d.getUTCFullYear() === y && d.getUTCMonth() === mo && d.getUTCDate() === day;
}

/** The request body as a payload, or what is wrong with it. */
export function parseSyncPayload(raw: unknown): SyncPayload | { error: string } {
  if (!isObj(raw)) return { error: "the body must be a JSON object" };
  const { records, calibreIds, missingColumns = [] } = raw;
  if (!Array.isArray(records)) return { error: "records must be an array" };
  if (records.length > MAX_RECORDS) return { error: `at most ${MAX_RECORDS} records` };
  if (!Array.isArray(calibreIds) || !calibreIds.every(isId)) return { error: "calibreIds must be an array of Calibre ids" };
  if (!Array.isArray(missingColumns) || !missingColumns.every((c) => (CALIBRE_COLUMNS as readonly unknown[]).includes(c))) {
    return { error: `missingColumns may name only ${CALIBRE_COLUMNS.join(", ")}` };
  }
  const library = new Set(calibreIds);
  const sent = new Set<number>();
  for (const [i, r] of records.entries()) {
    const at = `records[${i}]`;
    if (!isObj(r)) return { error: `${at} must be an object` };
    if (!isId(r.calibreId)) return { error: `${at}.calibreId must be a Calibre id` };
    if (!library.has(r.calibreId)) return { error: `${at}.calibreId is not in calibreIds` };
    // Two records with one id would both be created onto books.calibre_id's unique key.
    if (sent.has(r.calibreId)) return { error: `${at}.calibreId ${r.calibreId} is sent twice` };
    sent.add(r.calibreId);
    if (typeof r.title !== "string") return { error: `${at}.title must be text` };
    if (!Array.isArray(r.authors) || !r.authors.every((a) => typeof a === "string")) return { error: `${at}.authors must be a list of names` };
    for (const f of ["series", "subseries", "superseries", "isbn", "type", "dateRead", "ledgerStatus"]) {
      if (!optStr(r[f])) return { error: `${at}.${f} must be text or null` };
    }
    for (const f of ["seriesIndex", "subseriesIndex", "superseriesIndex", "words", "pages"]) {
      if (!optNum(r[f])) return { error: `${at}.${f} must be a number or null` };
    }
    for (const f of ["genres", "tags", "owned"]) {
      if (!optStrs(r[f])) return { error: `${at}.${f} must be a list of text` };
    }
    if (!(r.read === undefined || r.read === null || typeof r.read === "boolean")) return { error: `${at}.read must be true, false or null` };
    if (!(r.precision === undefined || r.precision === null || (PRECISIONS as readonly unknown[]).includes(r.precision))) {
      return { error: `${at}.precision must be exact, approximate or none` };
    }
    if (typeof r.dateRead === "string" && r.dateRead !== "" && !isCalendarDate(r.dateRead)) {
      return { error: `${at}.dateRead must be a real date, YYYY-MM-DD, or a year, YYYY` };
    }
  }
  return { records: records as CalibreRecord[], calibreIds, missingColumns: missingColumns as CalibreColumn[] };
}

// ---------------------------------------------------------------------------
// matching a run
// ---------------------------------------------------------------------------

type LedgerRow = LedgerBook & { authorId: string | null; deleted: boolean };
type Decision = { decision: string; bookId: string | null };

type Plan =
  | { kind: "skip"; reason: SyncReport["skipped"][number]["reason"] }
  | { kind: "match"; book: LedgerRow; author: string; takeId: boolean }
  | { kind: "wait"; waiting: Waiting }
  | { kind: "create"; author: string };

async function loadLedger(tx: Tx | typeof db) {
  const rows = await tx.select({
    id: books.id, title: books.title, author: authors.name, authorId: books.authorId, calibreId: books.calibreId,
    deletedAt: books.deletedAt,
  }).from(books).leftJoin(authors, eq(authors.id, books.authorId));
  const ledger: LedgerRow[] = rows.map((r) => ({
    id: r.id, title: r.title, author: r.author ?? "", authorId: r.authorId, calibreId: r.calibreId, deleted: r.deletedAt !== null,
  }));
  const decisions = new Map<number, Decision>((await tx.select().from(calibreDecisions))
    .map((d) => [d.calibreId, { decision: d.decision, bookId: d.bookId }]));
  return { ledger, decisions };
}

/** What a run does with each record: pure, so the lookups before the transaction and the writes in it agree. */
function planRun(records: CalibreRecord[], library: ReadonlySet<number>, ledger: LedgerRow[], decisions: Map<number, Decision>) {
  const live = ledger.filter((b) => !b.deleted);
  const index = new LedgerIndex(live);
  const byId = new Map(live.map((b) => [b.id, b]));
  const removed = new Set(ledger.filter((b) => b.deleted && b.calibreId != null).map((b) => b.calibreId!));
  const separate = new Set([...decisions].filter(([, d]) => d.decision === "separate").map(([id]) => id));
  const seen = new Set<string>();
  // Ledger books a record of this run has already matched: a second Calibre book on one waits (two merges into one book).
  const claimed = new Set<string>();
  const plans = new Map<CalibreRecord, Plan>();

  for (const rec of records) {
    if (!normalizeLine(rec.title)) continue;
    if ((rec.type ?? "").trim().toLowerCase() === "comic") {
      plans.set(rec, { kind: "skip", reason: "comic" });
      continue;
    }
    if (removed.has(rec.calibreId)) {
      plans.set(rec, { kind: "skip", reason: "removed in the Ledger" });
      continue;
    }
    let m: CalibreMatch = index.match(rec, separate);
    const merge = decisions.get(rec.calibreId);
    const mergeInto = merge?.decision === "merge" && merge.bookId ? byId.get(merge.bookId) : undefined;
    if (mergeInto && !index.byCalibreId(rec.calibreId)) {
      m = { status: "matched", author: m.author, book: mergeInto, renamed: true };
    }
    const k = `${cleanKey(rec.title)}\u0000${cleanKey(m.author)}`;
    if (seen.has(k)) {
      plans.set(rec, { kind: "skip", reason: "repeats a title and author" });
      continue;
    }
    seen.add(k);

    if (m.status === "matched" && m.book) {
      const book = byId.get(m.book.id)!;
      if (claimed.has(book.id) || (book.calibreId != null && book.calibreId !== rec.calibreId && library.has(book.calibreId))) {
        plans.set(rec, { kind: "wait", waiting: {
          kind: "two calibre books", calibreId: rec.calibreId, title: normalizeLine(rec.title), author: m.author,
          bookId: book.id, bookTitle: book.title,
        } });
        continue;
      }
      claimed.add(book.id);
      plans.set(rec, { kind: "match", book, author: m.author, takeId: book.calibreId !== rec.calibreId });
    } else if (m.status === "proposed" && m.book) {
      const sameTitle = cleanKey(m.book.title) === cleanKey(rec.title);
      plans.set(rec, { kind: "wait", waiting: {
        kind: sameTitle ? "same title" : "near spelling", calibreId: rec.calibreId, title: normalizeLine(rec.title),
        author: m.author, bookId: m.book.id, bookTitle: m.book.title, similarity: Math.round((m.similarity ?? 0) * 100) / 100,
      } });
    } else {
      plans.set(rec, { kind: "create", author: m.author });
    }
  }
  return plans;
}

// ---------------------------------------------------------------------------
// names: authors, series, subseries, universes, found by extract's key()
// ---------------------------------------------------------------------------

const keySql = (col: unknown) => sql`regexp_replace(lower(${col}), '[^a-z0-9]', '', 'g')`;

class Names {
  private authorIds = new Map<string, string>();
  private seriesIds = new Map<string, string>();
  private universeIds = new Map<string, string>();
  private subseries = new Map<string, { id: string; seriesId: string }>();
  constructor(private tx: Tx) {}

  async load() {
    for (const r of await this.tx.select({ id: authors.id, k: keySql(authors.name) }).from(authors)) this.authorIds.set(String(r.k), r.id);
    for (const r of await this.tx.select({ id: bookSeries.id, k: keySql(bookSeries.name) }).from(bookSeries)) this.seriesIds.set(String(r.k), r.id);
    for (const r of await this.tx.select({ id: bookUniverses.id, k: keySql(bookUniverses.name) }).from(bookUniverses)) this.universeIds.set(String(r.k), r.id);
    for (const r of await this.tx.select({ id: bookSubseries.id, seriesId: bookSubseries.seriesId, k: keySql(bookSubseries.name) }).from(bookSubseries)) {
      this.subseries.set(String(r.k), { id: r.id, seriesId: r.seriesId });
    }
  }

  /** A fresh id: the name's slug, with `-x` while another row holds it. */
  private async freshId(table: typeof authors | typeof bookSeries | typeof bookUniverses | typeof bookSubseries, name: string) {
    let id = slug(name);
    for (;;) {
      const [hit] = await this.tx.select({ id: table.id }).from(table).where(eq(table.id, id));
      if (!hit) return id;
      id += "-x";
    }
  }

  async author(name: string): Promise<string> {
    const k = cleanKey(name) || name;
    let id = this.authorIds.get(k);
    if (!id) {
      id = await this.freshId(authors, name);
      await this.tx.insert(authors).values({ id, name });
      this.authorIds.set(k, id);
    }
    return id;
  }

  /** The series by this name, created under `authorId` when new. */
  async series(name: string, authorId: string): Promise<string> {
    const k = cleanKey(name) || name;
    let id = this.seriesIds.get(k);
    if (!id) {
      id = await this.freshId(bookSeries, name);
      await this.tx.insert(bookSeries).values({ id, name, authorId });
      this.seriesIds.set(k, id);
    }
    return id;
  }

  async universe(name: string): Promise<string> {
    const k = cleanKey(name) || name;
    let id = this.universeIds.get(k);
    if (!id) {
      id = await this.freshId(bookUniverses, name);
      await this.tx.insert(bookUniverses).values({ id, name });
      this.universeIds.set(k, id);
    }
    return id;
  }

  /** The subseries under this series, or null when the name already lives under another (extract's rule). */
  async subseriesUnder(name: string, seriesId: string): Promise<string | null> {
    const k = cleanKey(name) || name;
    const hit = this.subseries.get(k);
    if (hit) return hit.seriesId === seriesId ? hit.id : null;
    const id = await this.freshId(bookSubseries, name);
    await this.tx.insert(bookSubseries).values({ id, name, seriesId });
    this.subseries.set(k, { id, seriesId });
    return id;
  }
}

// ---------------------------------------------------------------------------
// the run
// ---------------------------------------------------------------------------

/** Calibre's genres as calibre.py lists them: cleaned, once whatever the case, sorted. */
function genreList(values: string[]): string[] {
  const out = new Map<string, string>();
  for (const v of values) {
    const g = normalizeLine(v);
    if (g && !out.has(g.toLowerCase())) out.set(g.toLowerCase(), g);
  }
  return [...out.keys()].sort().map((k) => out.get(k)!);
}

/** Calibre's read as the Ledger stores one: a year alone is its July 1st, `approximate` (data model 2.17). */
function calibreRead(rec: CalibreRecord): { read: boolean; finishedOn: string | null; precision: Precision } {
  const day = rec.dateRead ? (rec.dateRead.length === 4 ? `${rec.dateRead}-07-01` : rec.dateRead) : null;
  const precision: Precision = day ? (rec.dateRead!.length === 4 ? "approximate" : rec.precision === "approximate" ? "approximate" : "exact") : "none";
  return { read: rec.read === true || day !== null, finishedOn: day, precision };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export async function syncCalibre(userId: string, payload: SyncPayload, opts: SyncOptions = {}): Promise<SyncResult> {
  const library = new Set(payload.calibreIds);

  // Hardcover first, outside the transaction: the books this run will create.
  const lookups = new Map<number, Lookup | "unasked">();
  {
    const { ledger, decisions } = await loadLedger(db);
    const plans = planRun(payload.records, library, ledger, decisions);
    const ask = hardcoverAsker(opts.sleep ?? wait, opts.deadline ?? Date.now() + 60_000);
    let budget = Math.max(0, opts.maxLookups ?? MAX_LOOKUPS);
    let stopped = false;
    for (const [rec, plan] of plans) {
      if (plan.kind !== "create") continue;
      if (budget === 0 || stopped) {
        lookups.set(rec.calibreId, "unasked");
        continue;
      }
      budget--;
      try {
        lookups.set(rec.calibreId, await lookUpBook(ask, normalizeLine(rec.title), plan.author, rec.isbn));
      } catch (e) {
        if (!(e instanceof Stop)) throw e;
        stopped = true;
        lookups.set(rec.calibreId, "unasked");
      }
    }
  }

  return db.transaction(async (tx) => {
    await addLock(tx);
    const { ledger, decisions } = await loadLedger(tx);
    const plans = planRun(payload.records, library, ledger, decisions);
    const names = new Names(tx);
    await names.load();
    const report: SyncReport = {
      in: [], out: [], waiting: [], gone: [], skipped: [],
      skippedColumns: CALIBRE_COLUMNS.filter((c) => payload.missingColumns.includes(c)), notes: [],
    };

    // Books Calibre has, created.
    const toCreate: { rec: CalibreRecord; row: BookRow }[] = [];
    for (const [rec, plan] of plans) {
      if (plan.kind === "skip") report.skipped.push({ reason: plan.reason, calibreId: rec.calibreId, title: normalizeLine(rec.title) });
      if (plan.kind === "wait") report.waiting.push(plan.waiting);
      if (plan.kind !== "create") continue;
      const title = normalizeLine(rec.title);
      const authorName = plan.author || "Unknown";
      const authorId = await names.author(authorName);
      const seriesName = rec.series ? normalizeLine(rec.series) : null;
      const seriesId = seriesName ? await names.series(seriesName, authorId) : null;
      const subseriesId = rec.subseries && seriesId ? await names.subseriesUnder(normalizeLine(rec.subseries), seriesId) : null;
      if (rec.subseries && !subseriesId) report.notes.push(`${title}: subseries ${rec.subseries} ${seriesId ? "lives under another series" : "has no series"}, not set`);
      const universeId = rec.superseries ? await names.universe(normalizeLine(rec.superseries)) : null;
      const looked = lookups.get(rec.calibreId);
      let pages: number | null = null;
      let hardcover: Partial<BookRow> = {};
      if (looked && looked !== "unasked" && looked.outcome !== "failed") {
        const f = looked.found;
        pages = f?.pages ?? rec.pages ?? null;
        if (f) hardcover = { hardcoverId: f.hardcoverId, coverUrl: f.coverUrl, year: f.year };
      } else {
        report.notes.push(`${title}: Hardcover wasn't asked, so its page count waits for the backfill`);
      }
      const type = (rec.type ?? "").trim();
      toCreate.push({ rec, row: {
        title, author: authorName, authorId, series: seriesName, seriesId, position: seriesId ? rec.seriesIndex ?? null : null,
        calibreId: rec.calibreId, bookType: type && type.toLowerCase() !== "book" ? type : undefined,
        universeId, universePosition: universeId ? rec.superseriesIndex ?? null : null,
        subseriesId, subseriesPosition: subseriesId ? rec.subseriesIndex ?? null : null,
        wordCount: rec.words ?? null, wordCountSource: rec.words != null ? "stated" : null,
        pages, ...hardcover,
      } });
    }
    const ids = await createBooks(tx, toCreate.map((c) => c.row));
    for (const [i, { rec, row }] of toCreate.entries()) {
      const bookId = ids[i];
      const read = calibreRead(rec);
      await tx.insert(bookStatus).values({
        userId, bookId, status: read.read ? "read" : "unlisted", finishedOn: read.finishedOn, finishedOnPrecision: read.precision,
      });
      if (read.read) {
        await tx.insert(readEvents).values({
          userId, bookId, finishedOn: read.finishedOn, finishedOnPrecision: read.precision, format: "text",
        });
      }
      const genres = genreList(rec.genres ?? []);
      if (genres.length) await tx.insert(bookGenres).values(genres.map((genre) => ({ bookId, genre })));
      report.in.push({ kind: "created", calibreId: rec.calibreId, bookId, title: row.title, changes: [
        { field: "status", from: null, to: read.read ? "read" : "unlisted" },
        ...(read.read ? [{ field: "read", from: null, to: { finishedOn: read.finishedOn, precision: read.precision } }] : []),
      ] });
    }

    // Books the Ledger has, given Calibre's values.
    const matched = [...plans].filter((e): e is [CalibreRecord, Extract<Plan, { kind: "match" }>] => e[1].kind === "match");
    const current = matched.length === 0 ? [] : await tx.select().from(books).where(inArray(books.id, matched.map(([, p]) => p.book.id)));
    const byId = new Map(current.map((b) => [b.id, b]));
    const genresNow = new Map<string, string[]>();
    if (matched.length) {
      for (const g of await tx.select().from(bookGenres).where(inArray(bookGenres.bookId, matched.map(([, p]) => p.book.id)))) {
        genresNow.set(g.bookId, [...(genresNow.get(g.bookId) ?? []), g.genre]);
      }
    }
    const authorNames = new Map((await tx.select({ id: authors.id, name: authors.name }).from(authors)).map((a) => [a.id, a.name]));
    for (const [rec, plan] of matched) {
      const b = byId.get(plan.book.id)!;
      const set: Partial<typeof books.$inferInsert> = {};
      const changes: FieldChange[] = [];
      const change = <K extends keyof typeof books.$inferInsert>(field: string, column: K, from: unknown, to: (typeof books.$inferInsert)[K]) => {
        if (same(from, to)) return;
        set[column] = to;
        changes.push({ field, from: from ?? null, to: to ?? null });
      };
      const title = normalizeLine(rec.title);
      change("title", "title", b.title, title);
      if (plan.author && cleanKey(plan.author) !== cleanKey(plan.book.author)) {
        const authorId = await names.author(plan.author);
        if (authorId !== b.authorId) {
          set.authorId = authorId;
          changes.push({ field: "author", from: plan.book.author || null, to: authorNames.get(authorId) ?? plan.author });
        }
      }
      const authorId = set.authorId ?? b.authorId ?? (await names.author(plan.author || "Unknown"));
      let seriesId = b.seriesId;
      if (rec.series !== undefined) {
        seriesId = rec.series ? await names.series(normalizeLine(rec.series), authorId) : null;
        change("series", "seriesId", b.seriesId, seriesId);
        change("series index", "seriesPosition", b.seriesPosition, seriesId ? rec.seriesIndex ?? null : null);
      }
      if (rec.subseries !== undefined || (rec.series !== undefined && seriesId !== b.seriesId)) {
        const name = rec.subseries === undefined ? null : rec.subseries;
        const subId = name && seriesId ? await names.subseriesUnder(normalizeLine(name), seriesId) : null;
        if (name && !subId) report.notes.push(`${title}: subseries ${name} ${seriesId ? "lives under another series" : "has no series"}, not set`);
        change("subseries", "subseriesId", b.subseriesId, subId);
        change("subseries index", "subseriesPosition", b.subseriesPosition, subId ? rec.subseriesIndex ?? null : null);
      }
      if (rec.superseries !== undefined) {
        const uniId = rec.superseries ? await names.universe(normalizeLine(rec.superseries)) : null;
        change("universe", "universeId", b.universeId, uniId);
        change("universe position", "universePosition", b.universePosition, uniId ? rec.superseriesIndex ?? null : null);
      }
      if (rec.words != null && (rec.words !== b.wordCount || b.wordCountSource !== "stated")) {
        set.wordCount = rec.words;
        set.wordCountSource = "stated";
        changes.push({ field: "word count", from: b.wordCount, to: rec.words });
      }
      if (plan.takeId) change("calibre id", "calibreId", b.calibreId, rec.calibreId);
      // No other book holds an id this book takes: planRun matched a live one by it first, and
      // skipped a record whose id a removed book holds.
      if (Object.keys(set).length) await tx.update(books).set(set).where(eq(books.id, b.id));
      if (rec.genres !== undefined) {
        const want = genreList(rec.genres ?? []);
        const have = genreList(genresNow.get(b.id) ?? []);
        if (!same(want, have)) {
          await tx.delete(bookGenres).where(eq(bookGenres.bookId, b.id));
          if (want.length) await tx.insert(bookGenres).values(want.map((genre) => ({ bookId: b.id, genre })));
          changes.push({ field: "genres", from: have, to: want });
        }
      }
      if (changes.length) report.in.push({ kind: "updated", calibreId: rec.calibreId, bookId: b.id, title, changes });
    }

    // Books gone from Calibre stay books, listed.
    for (const b of await tx.select({ id: books.id, title: books.title, calibreId: books.calibreId }).from(books)
      .where(and(isNull(books.deletedAt), sql`${books.calibreId} IS NOT NULL`))) {
      if (!library.has(b.calibreId!)) report.gone.push({ bookId: b.id, title: b.title, calibreId: b.calibreId! });
    }

    // What the Ledger holds, and what differs from Calibre's.
    const holdings = await holdingsFor(tx, userId, payload.calibreIds);
    const byCalibre = new Map(holdings.map((h) => [h.calibreId, h]));
    const titles = new Map((await tx.select({ id: books.id, title: books.title }).from(books)
      .where(inArray(books.id, holdings.length ? holdings.map((h) => h.bookId) : [""]))).map((b) => [b.id, b.title]));
    for (const rec of payload.records) {
      const h = byCalibre.get(rec.calibreId);
      const plan = plans.get(rec);
      if (!h || !plan || plan.kind === "skip" || plan.kind === "wait") continue;
      const theirs = calibreRead(rec);
      const title = titles.get(h.bookId) ?? normalizeLine(rec.title);
      const out = (column: CalibreColumn, from: unknown, to: unknown) => {
        if (report.skippedColumns.includes(column) || same(from, to)) return;
        report.out.push({ calibreId: rec.calibreId, bookId: h.bookId, title, column, from: from ?? null, to: to ?? null });
      };
      out("#read", rec.read ?? false, h.read);
      out("#date_read", theirs.finishedOn, h.finishedOn);
      out("#ledger_status", rec.ledgerStatus ?? null, h.status);
      out("#owned", [...(rec.owned ?? [])].sort(), h.owned);
    }

    const [row] = await tx.insert(calibreSyncs).values({ report }).returning({ id: calibreSyncs.id, ranAt: calibreSyncs.ranAt });
    return { id: row.id, ranAt: row.ranAt.toISOString(), holdings, report };
  });
}

/** What the Ledger holds for each live book with one of these Calibre ids. */
async function holdingsFor(tx: Tx, userId: string, calibreIds: number[]): Promise<Holding[]> {
  if (calibreIds.length === 0) return [];
  const rows = await tx.execute<{
    book_id: string; calibre_id: number; status: string | null;
    lr_on: string | null; lr_p: string | null; has_lr: boolean; bs_on: string | null; bs_p: string | null; owned: string[];
  }>(sql`
    SELECT b.id AS book_id, b.calibre_id, bs.status,
           lr.finished_on::text AS lr_on, lr.finished_on_precision AS lr_p, lr.id IS NOT NULL AS has_lr,
           bs.finished_on::text AS bs_on, bs.finished_on_precision AS bs_p,
           coalesce((SELECT array_agg(o.format ORDER BY o.format) FROM owned_copies o WHERE o.book_id = b.id), '{}') AS owned
    FROM books b
    LEFT JOIN book_status bs ON bs.book_id = b.id AND bs.user_id = ${userId}
    LEFT JOIN LATERAL (
      SELECT r.id, r.finished_on, r.finished_on_precision FROM read_events r
      WHERE r.book_id = b.id AND r.user_id = ${userId} ORDER BY r.id DESC LIMIT 1
    ) lr ON true
    WHERE b.deleted_at IS NULL
      AND b.calibre_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(calibreIds)}::jsonb)::int)
    ORDER BY b.calibre_id`);
  return [...rows].map((r) => {
    const read = r.has_lr || r.status === "read";
    const finishedOn = r.has_lr ? r.lr_on : read ? r.bs_on : null;
    const precision = (r.has_lr ? r.lr_p : read ? r.bs_p : "none") as Precision;
    return {
      calibreId: r.calibre_id, bookId: r.book_id, read, finishedOn, precision: finishedOn ? precision : "none",
      status: r.status, owned: r.owned,
    };
  });
}
