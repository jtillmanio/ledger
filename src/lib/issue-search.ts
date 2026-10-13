/**
 * Add issues, the *Search* half (task 1.3b): what a search box query asks for,
 * and what Metron's answer becomes before it is staged. Pure, like the parser
 * it hands each result to: the route reads the catalog and Metron, this shapes
 * them.
 *
 *   query := title [ " (" year ")" ] [ [ "#" ] number [ "-" number ] ]
 *
 * `thor 337-340`, `Thor (1966) #337`, `balder the brave`. A title alone asks for
 * the series' first page.
 */
import { normalizeLine, parseBulk, type KnownSeries } from "./bulk-parse";

/** One search asks Metron at most this many numbers: half its 20 a minute (owner, 2026-10-12). */
export const MAX_SEARCH_NUMBERS = 10;

export type SearchQuery = { title: string; year: number | null; numbers: string[] };

export type ParsedQuery =
  | { ok: true; query: SearchQuery }
  | { ok: false; reason: "empty" | "too_many" | "bad_range" };

const QUERY_RE = /^(.*?)(?: \((\d{4})\))?(?: #? ?(\d+(?:\.\d+)?)(?: ?- ?(\d+))?)?$/;

/** The query a search box line asks for. */
export function parseSearch(text: string): ParsedQuery {
  const q = normalizeLine(text).replace(/\s*#\s*/, " #").trim();
  const m = QUERY_RE.exec(q);
  const title = (m?.[1] ?? "").replace(/[#\s]+$/, "").trim();
  if (!m || !title) return { ok: false, reason: "empty" };
  const year = m[2] ? Number(m[2]) : null;
  if (!m[3]) return { ok: true, query: { title, year, numbers: [] } };
  // A leading zero is no part of a number (`#01` is `#1`), as in the parser.
  const from = m[3].replace(/^0+(?=\d)/, "");
  if (!m[4]) return { ok: true, query: { title, year, numbers: [from] } };
  const lo = Number(from), hi = Number(m[4]);
  if (!Number.isInteger(lo) || hi <= lo) return { ok: false, reason: "bad_range" };
  if (hi - lo + 1 > MAX_SEARCH_NUMBERS) return { ok: false, reason: "too_many" };
  return { ok: true, query: { title, year, numbers: Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)) } };
}

/** One entry of a Metron issue list (`issue/?…`), the fields the search reads. */
export type MetronIssue = {
  id: number;
  series?: { id?: number; name?: string; year_began?: number | null };
  number?: string;
  issue?: string;
  cover_date?: string | null;
  image?: string | null;
};

export type MetronPage = { count?: number; next?: string | null; results?: MetronIssue[] };

/** A search result as the screen draws it. */
export type SearchResult = {
  /** `labelKey(label)`: what the review keys on. */
  key: string;
  label: string;
  /** The catalog row, when the catalog holds this comic. */
  issueId: string | null;
  metronId: number | null;
  coverDate: string | null;
  coverUrl: string | null;
  /** Live runs placing it; 0 for a comic only Metron has. */
  runs: number;
  /** Their titles: *in 1 run · Thor Tales*. */
  runTitles: string[];
  inThisRun: boolean;
  /** Metron's label fell outside the grammar: staged with that flag, never inserted silently (AC-3). */
  unparseable: boolean;
  /** A new label whose id another label already holds (D-15, D-59): it would get `-2`. */
  idTaken: boolean;
  /** A catalog row with no Metron record yet: *metadata pending* until 4.1 fills it (task 1.4c). */
  pending?: boolean;
};

/**
 * Metron's label in the bulk-entry grammar (ARCHITECTURE 2.15): normalised as a
 * typed line is, and spelled with the catalog's series title when the parser
 * knows it. A label the grammar can't read comes back as Metron wrote it, flagged.
 *
 * An annual stays as Metron writes it, `Thor Annual (1966) #13`: its own series,
 * which is how every annual in the catalog is labelled, and D-55 lets the known
 * series win. Rewriting it as an annual of `Thor` would add a second copy.
 */
export function normalizeMetronLabel(issue: string, knownSeries: KnownSeries[]): { label: string; unparseable: boolean } {
  const text = normalizeLine(issue);
  const [line] = parseBulk(text, { knownSeries, runLabels: [] });
  if (!line || line.flags.some((f) => f.type === "unparseable" || f.type === "bad_range") || line.rows.length !== 1) {
    return { label: text, unparseable: true };
  }
  return { label: line.rows[0].label, unparseable: false };
}

/**
 * A loose series-name key, `etl/enrich_comics.py`'s `name_key`: case, accents,
 * punctuation, `&`, a leading *The* and a trailing `(1998)` don't count.
 */
export function nameKey(name: string): string {
  return name.normalize("NFKD").replace(/[^\x00-\x7f]/g, "").toLowerCase()
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replaceAll("&", " and ")
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Every issue on these pages once, in the order the numbers were asked, then by
 * volume year. Metron matches `series_name` word by word (`thor` finds *Thorn*
 * and *Lex Luthor*), so only series named what you typed are kept (owner,
 * 2026-10-12): `thor` is every *Thor* volume, `thor annual` its annuals.
 */
export function metronIssues(pages: MetronPage[], title: string, numbers: string[]): MetronIssue[] {
  const want = nameKey(title);
  const seen = new Set<number>();
  const all: MetronIssue[] = [];
  for (const page of pages) {
    for (const r of page.results ?? []) {
      if (typeof r?.id !== "number" || seen.has(r.id) || !r.issue) continue;
      if (nameKey(r.series?.name ?? r.issue.replace(/ #[^#]*$/, "")) !== want) continue;
      seen.add(r.id);
      all.push(r);
    }
  }
  const rank = (r: MetronIssue) => {
    const at = numbers.indexOf(String(r.number ?? ""));
    return at < 0 ? numbers.length : at;
  };
  return all
    .map((r, i) => ({ r, i }))
    .sort((a, b) => rank(a.r) - rank(b.r)
      || (a.r.series?.year_began ?? 0) - (b.r.series?.year_began ?? 0) || a.i - b.i)
    .map(({ r }) => r);
}

/** `Nov 1983` from Metron's `1983-11-01`: a cover date is a month. */
export function coverMonth(date: string | null): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m[2]) - 1];
  return month ? `${month} ${m[1]}` : m[1];
}
