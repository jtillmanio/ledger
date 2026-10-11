/**
 * The bulk-entry parser (task 1.3): a pasted block of issue labels, one per
 * line, becomes a checked list for 1.3c's review table. It is the first of the
 * three gates every typed or AI-proposed label passes (CLAUDE.md), and it is
 * pure: the caller hands it the known series and the run's labels, so it reads
 * no database and calls nothing (R3-12).
 *
 *   label   := title [ " (" year ")" ] " #" designator
 *   desig   := number | number "." number | number "-" number (a range)
 *            | "Annual " number, written `Title (Year) Annual #N`
 *
 * Fraction (`#1⁄2`, D-24a) and suffixed (`#16.HU`) designators are outside the
 * grammar on purpose: they fall to *unparseable* and a manual accept.
 */

/** pg_trgm's default `similarity_threshold`: no new-series suggestion below it. */
export const SUGGEST_THRESHOLD = 0.3;
/** At most this many suggestions for a new series. */
export const MAX_SUGGESTIONS = 5;
/** A range longer than this is a typo, not a run (`#1-5000`). */
export const MAX_RANGE = 500;

export type KnownSeries = {
  title: string;
  /** The distinct volume years the catalog has for this title; empty if it is never written with one. */
  years: number[];
};

export type BulkRow = {
  label: string;
  designator: string;
  /** `skip` when the label is already in the run: a placement is unique per (run, issue). */
  decision: "add" | "skip";
};

export type BulkFlag =
  | { type: "unparseable"; text: string; suggestion: string | null }
  | { type: "bad_range"; from: number; to: number }
  | { type: "new_series"; suggestions: { title: string; similarity: number }[] }
  | { type: "ambiguous_volume"; years: number[] }
  | { type: "duplicate"; labels: string[] };

export type BulkLine = {
  /** 1-based line number in the pasted text, blank lines counted. */
  line: number;
  input: string;
  normalized: string;
  /** The review table's glyph: `✓` ok, `!` needs a choice, `×` error. */
  kind: "ok" | "choice" | "error";
  title: string | null;
  year: number | null;
  rows: BulkRow[];
  flags: BulkFlag[];
};

/** NFKC, trim, collapse internal whitespace, en and em dash to a hyphen. */
export function normalizeLine(s: string): string {
  return s.normalize("NFKC").trim().replace(/\s+/g, " ").replace(/[–—]/g, "-");
}

/** The label for one designator, in the catalog's form. */
export function labelFor(title: string, year: number | null, designator: string): string {
  const vol = year === null ? "" : ` (${year})`;
  const annual = /^Annual (\d+)$/.exec(designator);
  return annual ? `${title}${vol} Annual #${annual[1]}` : `${title}${vol} #${designator}`;
}

function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (!word) continue;
    const padded = `  ${word} `;
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/** pg_trgm's `similarity()`: shared trigrams over all trigrams, words padded. */
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const all = ta.size + tb.size - shared;
  return all === 0 ? 0 : shared / all;
}

const key = (s: string) => normalizeLine(s).toLowerCase();

type Parsed = { title: string; year: number | null; designator: string };

/** The grammar alone, before any lookup. Null when the line doesn't fit it. */
function matchGrammar(text: string, known: Map<string, KnownSeries>): Parsed | null {
  const m = /^(.+?)(?: \((\d{4})\))? #(.+)$/.exec(text);
  if (!m) return null;
  let title = m[1];
  let year = m[2] ? Number(m[2]) : null;
  let designator = m[3];

  const annualDesig = /^Annual (\d+)$/.exec(designator);
  // `Thor (1966) Annual #13`: the year sits inside what the lazy title took.
  const annualAfterYear = year === null ? /^(.+) \((\d{4})\) Annual$/.exec(title) : null;
  // `Thor Annual #13`: an annual of Thor, unless `Thor Annual` is itself a known series.
  const annualTitle =
    year === null && !known.has(key(title)) ? /^(.+) Annual$/.exec(title) : null;

  if (annualDesig) {
    designator = `Annual ${annualDesig[1]}`;
  } else if (annualAfterYear) {
    title = annualAfterYear[1];
    year = Number(annualAfterYear[2]);
    designator = `Annual ${designator}`;
  } else if (annualTitle && known.has(key(annualTitle[1]))) {
    title = annualTitle[1];
    designator = `Annual ${designator}`;
  }

  if (!/^(\d+(\.\d+)?|\d+-\d+|Annual \d+)$/.test(designator)) return null;
  return { title, year, designator };
}

function suggestTitles(title: string, known: KnownSeries[]) {
  return known
    .map((k) => ({ title: k.title, similarity: trigramSimilarity(title, k.title) }))
    .filter((s) => s.similarity >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title))
    .slice(0, MAX_SUGGESTIONS);
}

/** Resolve the series and its volume year against what the catalog knows. */
function resolve(p: Parsed, known: Map<string, KnownSeries>, flags: BulkFlag[], all: KnownSeries[]) {
  const series = known.get(key(p.title));
  if (!series) {
    flags.push({ type: "new_series", suggestions: suggestTitles(p.title, all) });
    return { title: p.title, year: p.year };
  }
  if (p.year !== null) return { title: series.title, year: p.year };
  const years = [...new Set(series.years)].sort((a, b) => a - b);
  if (years.length > 1) {
    flags.push({ type: "ambiguous_volume", years });
    return { title: series.title, year: null };
  }
  return { title: series.title, year: years[0] ?? null };
}

/** Parse one normalised line into its flags and rows. */
function parseOne(
  text: string,
  known: Map<string, KnownSeries>,
  all: KnownSeries[],
  inRun: Set<string>,
): Pick<BulkLine, "title" | "year" | "rows" | "flags"> {
  const flags: BulkFlag[] = [];
  const parsed = matchGrammar(text, known);
  if (!parsed) {
    flags.push({ type: "unparseable", text, suggestion: missingHash(text, known, all) });
    return { title: null, year: null, rows: [], flags };
  }

  const { title, year } = resolve(parsed, known, flags, all);

  let designators = [parsed.designator];
  const range = /^(\d+)-(\d+)$/.exec(parsed.designator);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to <= from || to - from + 1 > MAX_RANGE) {
      flags.push({ type: "bad_range", from, to });
      return { title, year, rows: [], flags };
    }
    designators = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  }

  const rows: BulkRow[] = designators.map((designator) => {
    const label = labelFor(title, year, designator);
    return { label, designator, decision: inRun.has(key(label)) ? "skip" : "add" };
  });
  const dupes = rows.filter((r) => r.decision === "skip").map((r) => r.label);
  if (dupes.length) flags.push({ type: "duplicate", labels: dupes });
  return { title, year, rows, flags };
}

/** `Thor Annual 13` → `Thor (1966) Annual #13`: the label a missing `#` would make, if any. */
function missingHash(text: string, known: Map<string, KnownSeries>, all: KnownSeries[]): string | null {
  const m = /^(.*\S) (\d+(?:-\d+)?)$/.exec(text);
  if (!m) return null;
  const parsed = matchGrammar(`${m[1]} #${m[2]}`, known);
  if (!parsed) return null;
  const { title, year } = resolve(parsed, known, [], all);
  return labelFor(title, year, parsed.designator);
}

function kindOf(flags: BulkFlag[]): BulkLine["kind"] {
  if (flags.some((f) => f.type === "unparseable" || f.type === "bad_range")) return "error";
  if (flags.some((f) => f.type === "new_series" || f.type === "ambiguous_volume")) return "choice";
  return "ok";
}

/**
 * Parse a pasted block. `knownSeries` is every series title in the catalog with
 * its volume years; `runLabels` the labels already placed in the target run.
 * Blank lines are skipped; every other line comes back, in order.
 */
export function parseBulk(
  text: string,
  { knownSeries, runLabels }: { knownSeries: KnownSeries[]; runLabels: string[] },
): BulkLine[] {
  const known = new Map(knownSeries.map((s) => [key(s.title), s]));
  const inRun = new Set(runLabels.map(key));
  const out: BulkLine[] = [];
  text.split(/\r?\n/).forEach((input, i) => {
    const normalized = normalizeLine(input);
    if (!normalized) return;
    const parsed = parseOne(normalized, known, knownSeries, inRun);
    out.push({ line: i + 1, input, normalized, kind: kindOf(parsed.flags), ...parsed });
  });
  return out;
}
