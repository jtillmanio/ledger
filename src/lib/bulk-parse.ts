/**
 * The bulk-entry parser (task 1.3): a pasted block of issue labels, one per
 * line, becomes a checked list for 1.3c's review table. It is the first of the
 * three gates every typed or AI-proposed label passes (CLAUDE.md), and it is
 * pure: the caller hands it the known series and the run's labels, so it reads
 * no database and calls nothing (R3-12).
 *
 *   label   := title [ " (" year ")" ] ( " #" designator | " Annual #" number )
 *   desig   := number | number "." number | number "-" number (a range)
 *
 * An annual is written `Thor (1966) Annual #13` (D-55); `Thor (1966) #Annual 13`
 * is read too and written the same way. Numbers lose leading zeros.
 *
 * Fraction (`#1⁄2`, D-24a) and suffixed (`#16.HU`) designators are outside the
 * grammar on purpose: they fall to *unparseable* and a manual accept.
 */

/** pg_trgm's default `similarity_threshold`: no new-series suggestion below it (D-54). */
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

/**
 * One approved row of the volume map (`volume_rules`, task 1.12): which year a
 * bare series name means. `runId` null is any run, `issueFrom` / `issueTo` null
 * is no floor / no ceiling. An annual's series is `<Title> Annual`.
 */
export type VolumeRule = {
  series: string;
  runId: string | null;
  issueFrom: number | null;
  issueTo: number | null;
  year: number;
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
  /** The input left the year out and the series has one known year, so it was filled in. */
  yearFilled: boolean;
  rows: BulkRow[];
  flags: BulkFlag[];
};

// NFKC spells `½` as `1⁄2` (with the fraction slash), so `#1½` would read as
// eleven halves. extract's clean() puts the glyph back, and so does this (D-24a).
const FRACTION_RE = /(?:1⁄2|1⁄4|3⁄4)(?![0-9])/g;
export const FRACTION_GLYPHS: Record<string, string> = { "1⁄2": "½", "1⁄4": "¼", "3⁄4": "¾" };

/** extract's FRACTION_RE substitution: `#1⁄2` → `#½`, `#11⁄2` → `#1½`. */
export function restoreFractions(s: string): string {
  return s.replace(FRACTION_RE, (m) => FRACTION_GLYPHS[m]);
}

/**
 * NFKC, trim, collapse internal whitespace, en and em dash to a hyphen: extract's
 * `clean()`, fraction glyphs included (`#1⁄2` is `#½`, D-24a), so a typed label
 * is the label extract would load (task 1.3c).
 */
export function normalizeLine(s: string): string {
  return restoreFractions(s.normalize("NFKC")).trim().replace(/\s+/g, " ").replace(/[–—]/g, "-");
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
  // `#01` is `#1`: no catalog label has a leading zero, and the duplicate check compares labels.
  return { title, year, designator: designator.replace(/(^|[ -])0+(?=\d)/g, "$1") };
}

function suggestTitles(title: string, known: KnownSeries[]) {
  return known
    .map((k) => ({ title: k.title, similarity: trigramSimilarity(title, k.title) }))
    .filter((s) => s.similarity >= SUGGEST_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity || a.title.localeCompare(b.title))
    .slice(0, MAX_SUGGESTIONS);
}

type RuleContext = { rules: VolumeRule[]; runId: string | null };

/**
 * The year an approved rule gives a bare line, matched as extract's
 * `apply_volume_year` matches: this run's rules and another run's are told
 * apart, the most specific rule first (run + range, run, range, series-wide),
 * and the range tested on the line's first number. A range line takes the
 * rule only when it covers the last number too.
 */
function ruleYear(p: Parsed, { rules, runId }: RuleContext): number | null {
  const annual = /^Annual (\d+)$/.test(p.designator);
  const series = key(annual ? `${p.title} Annual` : p.title);
  const nums = (annual ? p.designator.slice(7) : p.designator).split("-").map((n) => parseInt(n, 10));
  const first = nums[0];
  const last = nums[nums.length - 1];
  const covers = (r: VolumeRule, n: number) =>
    (r.issueFrom === null || n >= r.issueFrom) && (r.issueTo === null || n <= r.issueTo);
  const mine = rules
    .filter((r) => key(r.series) === series && (r.runId === null || r.runId === runId))
    .sort(
      (a, b) =>
        Number(a.runId === null) - Number(b.runId === null) ||
        Number(a.issueFrom === null && a.issueTo === null) -
          Number(b.issueFrom === null && b.issueTo === null),
    );
  const hit = mine.find((r) => covers(r, first));
  return hit && covers(hit, last) ? hit.year : null;
}

/** Resolve the series and its volume year against what the catalog knows. */
function resolve(
  p: Parsed,
  known: Map<string, KnownSeries>,
  flags: BulkFlag[],
  all: KnownSeries[],
  ctx: RuleContext,
) {
  const series = known.get(key(p.title));
  if (!series) {
    flags.push({ type: "new_series", suggestions: suggestTitles(p.title, all) });
    return { title: p.title, year: p.year, yearFilled: false };
  }
  if (p.year !== null) return { title: series.title, year: p.year, yearFilled: false };
  const ruled = ruleYear(p, ctx);
  if (ruled !== null) return { title: series.title, year: ruled, yearFilled: true };
  const years = [...new Set(series.years)].sort((a, b) => a - b);
  if (years.length > 1) {
    flags.push({ type: "ambiguous_volume", years });
    return { title: series.title, year: null, yearFilled: false };
  }
  return { title: series.title, year: years[0] ?? null, yearFilled: years.length === 1 };
}

/** Parse one normalised line into its flags and rows. */
function parseOne(
  text: string,
  known: Map<string, KnownSeries>,
  all: KnownSeries[],
  inRun: Set<string>,
  ctx: RuleContext,
): Pick<BulkLine, "title" | "year" | "yearFilled" | "rows" | "flags"> {
  const flags: BulkFlag[] = [];
  const parsed = matchGrammar(text, known);
  if (!parsed) {
    flags.push({ type: "unparseable", text, suggestion: missingHash(text, known, all, ctx) });
    return { title: null, year: null, yearFilled: false, rows: [], flags };
  }

  const { title, year, yearFilled } = resolve(parsed, known, flags, all, ctx);

  let designators = [parsed.designator];
  const range = /^(\d+)-(\d+)$/.exec(parsed.designator);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (to <= from || to - from + 1 > MAX_RANGE) {
      flags.push({ type: "bad_range", from, to });
      return { title, year, yearFilled, rows: [], flags };
    }
    designators = Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
  }

  const rows: BulkRow[] = designators.map((designator) => {
    const label = labelFor(title, year, designator);
    return { label, designator, decision: inRun.has(key(label)) ? "skip" : "add" };
  });
  const dupes = rows.filter((r) => r.decision === "skip").map((r) => r.label);
  if (dupes.length) flags.push({ type: "duplicate", labels: dupes });
  return { title, year, yearFilled, rows, flags };
}

/** `Thor Annual 13` → `Thor (1966) Annual #13`: the label a missing `#` would make, if any. */
function missingHash(
  text: string,
  known: Map<string, KnownSeries>,
  all: KnownSeries[],
  ctx: RuleContext,
): string | null {
  const m = /^(.*\S) (\d+(?:-\d+)?)$/.exec(text);
  if (!m) return null;
  const parsed = matchGrammar(`${m[1]} #${m[2]}`, known);
  if (!parsed) return null;
  const { title, year } = resolve(parsed, known, [], all, ctx);
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
 * Blank lines are skipped; every other line comes back, in order. `rules` are
 * the approved volume rules, `runId` the target run (task 1.12): a bare series
 * a rule covers takes its year and is not flagged.
 */
export function parseBulk(
  text: string,
  {
    knownSeries,
    runLabels,
    rules = [],
    runId = null,
  }: { knownSeries: KnownSeries[]; runLabels: string[]; rules?: VolumeRule[]; runId?: string | null },
): BulkLine[] {
  const known = new Map(knownSeries.map((s) => [key(s.title), s]));
  const inRun = new Set(runLabels.map(key));
  const ctx = { rules, runId };
  const out: BulkLine[] = [];
  text.split(/\r?\n/).forEach((input, i) => {
    const normalized = normalizeLine(input);
    if (!normalized) return;
    const parsed = parseOne(normalized, known, knownSeries, inRun, ctx);
    out.push({ line: i + 1, input, normalized, kind: kindOf(parsed.flags), ...parsed });
  });
  return out;
}
