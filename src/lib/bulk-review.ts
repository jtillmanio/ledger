/**
 * The review table's logic (task 1.3c): what each pasted line will do, why, and
 * what the user still has to decide, before anything is written. Pure, like the
 * parser it sits on: the screen hands it the parsed lines, the run's
 * placements, the catalog matches the dry run found and the choices made so far,
 * and gets back the rows to draw, the labels to write and the real count.
 *
 * A row's decisions are radiogroups (design §11, *Review tables*). The safe
 * choice is the default: a line already in the run is skipped, a broken range is
 * dropped, and nothing that needs a choice (an ambiguous volume, a new series,
 * a freeform line the catalog doesn't know) is written until it gets one. A
 * freeform line is the user's own label; choosing *Keep as typed* is the
 * explicit accept (CLAUDE.md).
 */
import { labelFor, parseBulk, type BulkLine, type KnownSeries } from "./bulk-parse";

/** One of the run's placements, live or removed (soft-deleted). */
export type Placement = { id: number; sequence: number; label: string; removed: boolean };

/** An `issues` row the dry run found for a label: what it is called and how many live runs hold it. */
export type CatalogMatch = { issueId: string; label: string; runs: number };

/** Catalog matches keyed by `labelKey(label)`; a key mapped to null was looked up and isn't there. */
export type Catalog = Map<string, CatalogMatch | null>;

export type Option = { id: string; label: string; destructive?: boolean };
export type Group = { key: string; name: string; options: Option[]; choice: string | null };

/** What one placement in the insert will be: a new or reused issue placed, or a removed placement restored. */
export type Write = { label: string; restore: boolean };

export type ReviewRow = {
  key: string;
  line: number;
  /** The glyph: `✓` ok, `!` needs a choice, `×` error. */
  kind: BulkLine["kind"];
  text: string;
  why: string;
  /**
   * The check column: `in catalog`, `new series`, `new volume`, `on Metron`
   * for a line a Metron search staged, `id taken` for a new label whose id
   * another label holds (D-15, D-59), or `unverified` for a typed line.
   */
  check: string;
  groups: Group[];
  /** The line failed its check: `aria-invalid` on its decision. */
  invalid: boolean;
  /** A group still has no choice, so nothing can be added yet. */
  needsChoice: boolean;
  writes: Write[];
};

export type Review = {
  rows: ReviewRow[];
  /** The insert, in order: one per placement written, repeats in the paste counted once. */
  writes: Write[];
  /** How many rows still need a choice. */
  unresolved: number;
  /** Every label the rows depend on that the catalog hasn't been asked about. */
  lookups: string[];
};

/** Choices by group key. */
export type Choices = Record<string, string>;

/** Labels match case-insensitively (D-54). */
export const labelKey = (label: string) => label.toLowerCase();

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n: number) => NUMBER_WORDS[n] ?? String(n);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A line's designator before expansion: `337-340` for a range, else the one row's. */
function designatorOf(line: BulkLine): string {
  const { rows } = line;
  return rows.length > 1 ? `${rows[0].designator}-${rows.at(-1)!.designator}` : rows[0]?.designator ?? "";
}

/** What a line comes to once its choices are applied. */
type Decided = {
  groups: Group[];
  why: string[];
  check: string | null;
  pending: boolean;
  dropped: boolean;
  /** Candidate labels in order, before the run and the paste are checked. */
  labels: string[];
};

type Ctx = {
  parse: (text: string) => BulkLine;
  choices: Choices;
  catalog: Catalog;
  known: Map<string, number[]>;
  lookups: Set<string>;
};

const DROP: Option = { id: "drop", label: "Drop", destructive: true };

function group(key: string, name: string, options: Option[], ctx: Ctx, fallback: string | null = null): Group {
  const picked = ctx.choices[key];
  const choice = options.some((o) => o.id === picked) ? picked : fallback;
  return { key, name, options, choice };
}

/**
 * Apply a line's choices. `nested` is a line rewritten by a choice (a picked
 * year, a picked series, *Use that*): its parent already offers Drop, so an ok
 * nested line adds no group of its own.
 */
function decide(line: BulkLine, key: string, ctx: Ctx, nested = false): Decided {
  const flag = line.flags[0];
  const out: Decided = { groups: [], why: [], check: null, pending: false, dropped: false, labels: [] };
  const follow = (text: string, subKey: string) => {
    const sub = decide(ctx.parse(text), subKey, ctx, true);
    out.groups.push(...sub.groups);
    out.why.push(...sub.why);
    out.check = sub.check;
    out.pending ||= sub.pending;
    out.labels = sub.labels;
  };
  const settle = (g: Group) => {
    out.groups.push(g);
    if (g.choice === null) out.pending = true;
    // Skip drops nothing: the line is already in the run, and the label check below says so.
    if (g.choice === "drop") out.dropped = true;
    return g.choice;
  };

  if (flag?.type === "unparseable") {
    const known = ctx.catalog.get(labelKey(line.normalized));
    if (known === undefined) ctx.lookups.add(line.normalized);
    if (flag.suggestion) {
      out.why.push(`Missing the #. Did you mean ${flag.suggestion}?`);
      const choice = settle(group(key, "Decision", [
        { id: "use", label: "Use that" }, { id: "keep", label: "Keep as typed" }, DROP], ctx, "use"));
      if (choice === "use") follow(flag.suggestion, `${key}>use`);
      if (choice === "keep") out.labels = [line.normalized];
    } else {
      out.why.push(known ? "Not in the label grammar, but in your catalog." : "Not in the label grammar. Keep it as typed, or drop it.");
      // A freeform label the catalog already holds (one of the 302) is no surprise.
      const choice = settle(group(key, "Decision", [{ id: "keep", label: "Keep as typed" }, DROP], ctx,
        known ? "keep" : null));
      if (choice === "keep") out.labels = [line.normalized];
    }
    return out;
  }

  if (flag?.type === "bad_range") {
    const { from, to } = flag;
    out.why.push(to < from ? `#${from}-${to} runs backwards. Write it #${to}-${from}.`
      : to === from ? `#${from}-${to} is one issue. Write it #${from}.`
        : `#${from}-${to} is ${to - from + 1} issues; a range stops at 500. Check it.`);
    settle(group(key, "Decision", [DROP], ctx, "drop"));
    return out;
  }

  const designator = designatorOf(line);
  if (flag?.type === "ambiguous_volume") {
    out.why.push(`${count(flag.years.length)} volumes of ${line.title}. Pick one:`);
    const choice = settle(group(key, "Volume year",
      [...flag.years.map((y) => ({ id: `year:${y}`, label: String(y) })), DROP], ctx));
    if (choice?.startsWith("year:")) follow(labelFor(line.title!, Number(choice.slice(5)), designator), `${key}>${choice}`);
    return out;
  }

  if (flag?.type === "new_series") {
    const { suggestions } = flag;
    out.why.push(`No series called ${line.title} in your catalog.${suggestions.length ? " Did you mean one of these?" : ""}`);
    const choice = settle(group(key, "Series", [
      ...suggestions.map((s) => ({ id: `series:${s.title}`, label: `Use ${s.title}` })),
      { id: "keep", label: "Keep as typed" }, DROP], ctx));
    if (choice?.startsWith("series:")) follow(labelFor(choice.slice(7), line.year, designator), `${key}>${choice}`);
    if (choice === "keep") {
      out.labels = line.rows.map((r) => r.label);
      out.check = "new series";
    }
    return out;
  }

  // ok: every row parsed against a known series, some perhaps already in the run.
  out.labels = line.rows.map((r) => r.label);
  if (line.yearFilled) out.why.push("Volume year filled from your map.");
  const years = ctx.known.get(labelKey(line.title ?? ""));
  if (years && line.year !== null && !years.includes(line.year)) {
    out.why.push(`No ${line.title} (${line.year}) in your catalog yet.`);
    out.check = "new volume";
  }
  if (!nested) {
    const allHere = line.rows.every((r) => r.decision === "skip");
    settle(allHere
      ? group(key, "Decision", [{ id: "skip", label: "Skip" }], ctx, "skip")
      : group(key, "Decision", [{ id: "add", label: "Add" }, DROP], ctx, "add"));
  }
  return out;
}

/** `#337` for a numbered label, the whole label otherwise. */
function short(label: string): string {
  const m = /( Annual)? #([^#]+)$/.exec(label);
  return m ? `${m[1] ? "Annual " : ""}#${m[2]}` : label;
}

function listed(labels: string[]): string {
  return labels.map(short).join(", ");
}

/**
 * Build the review. `placements` is every placement of the run (removed ones
 * too); a label live there is skipped, one removed there is restored.
 */
export function buildReview(
  lines: BulkLine[],
  { knownSeries, placements, catalog, choices, metron = new Set(), taken = new Set() }: {
    knownSeries: KnownSeries[]; placements: Placement[]; catalog: Catalog; choices: Choices;
    /** Label keys a Metron search answered with (task 1.3b): Metron says they exist. */
    metron?: Set<string>;
    /** Label keys whose id another label already holds: the insert would give them `-2`. */
    taken?: Set<string>;
  },
): Review {
  const runLabels = placements.filter((p) => !p.removed).map((p) => p.label);
  const here = new Map(placements.map((p) => [labelKey(p.label), p]));
  const ctx: Ctx = {
    parse: (text) => parseBulk(text, { knownSeries, runLabels })[0],
    choices, catalog, lookups: new Set(),
    known: new Map(knownSeries.map((s) => [labelKey(s.title), s.years])),
  };

  const seen = new Map<string, number>(); // label key → the line that writes it
  const writes: Write[] = [];
  const rows: ReviewRow[] = lines.map((line) => {
    const key = `${line.line}:${line.normalized}`;
    const d = decide(line, key, ctx);
    const why = [...d.why];
    const rowWrites: Write[] = [];

    if (!d.dropped && !d.pending) {
      const inRun: string[] = [], again: [string, number][] = [], restored: string[] = [];
      for (const label of d.labels) {
        const k = labelKey(label);
        const placed = here.get(k);
        if (placed && !placed.removed) inRun.push(label);
        else if (seen.has(k)) again.push([label, seen.get(k)!]);
        else {
          seen.set(k, line.line);
          if (placed?.removed) restored.push(label);
          rowWrites.push({ label: placed?.label ?? catalog.get(k)?.label ?? label, restore: !!placed?.removed });
        }
        if (catalog.get(k) === undefined && !placed) ctx.lookups.add(label);
      }
      const total = d.labels.length;
      const matched = rowWrites.filter((w) => !w.restore && catalog.get(labelKey(w.label)));
      if (total === 1) {
        if (inRun.length) why.unshift("Already in this run.");
        else if (again.length) why.unshift(`Also on line ${again[0][1]}.`);
        else if (restored.length) why.unshift("Restore — was removed.");
        else if (matched.length) {
          const runs = catalog.get(labelKey(matched[0].label))!.runs;
          why.unshift(runs ? `Already in ${plural(runs, "run")}.` : "In your catalog.");
        }
      } else if (total > 1) {
        const parts = [`${total} issues`];
        const notes: string[] = [];
        if (inRun.length) notes.push(`${listed(inRun)} ${inRun.length === 1 ? "is" : "are"} already in this run`);
        for (const [label, at] of again) notes.push(`${short(label)} is also on line ${at}`);
        if (restored.length) notes.push(`${listed(restored)} ${restored.length === 1 ? "comes" : "come"} back — was removed`);
        if (rowWrites.length < total) parts[0] += `, ${rowWrites.length} to add`;
        let lead = parts[0] + (notes.length ? `: ${notes.join("; ")}` : "") + ".";
        if (matched.length) lead += ` ${matched.length === total ? "All" : matched.length} already in your catalog.`;
        why.unshift(lead);
      }
      writes.push(...rowWrites);
    }

    const known = (l: string) => here.has(labelKey(l)) || !!catalog.get(labelKey(l));
    const allKnown = d.labels.length > 0 && d.labels.every(known);
    const clash = d.labels.filter((l) => !known(l) && taken.has(labelKey(l)));
    if (clash.length) {
      why.push(`Another label already has the id ${clash.length === 1 ? "this one" : listed(clash)} would get, `
        + "so it would be saved with -2. Two comics can't share a label's id (D-15): rename one.");
    }
    // A line a search staged is Metron's word, even while it waits for a choice (a new series).
    const vouched = metron.has(labelKey(line.normalized))
      || (d.labels.length > 0 && d.labels.every((l) => known(l) || metron.has(labelKey(l))));
    if (vouched && !allKnown && rowWrites.length && why.length === 0) why.push("New from Metron, with its cover date and cover.");
    return {
      key, line: line.line, kind: line.kind, text: line.normalized,
      why: why.join(" "),
      check: clash.length ? "id taken" : d.check ?? (allKnown ? "in catalog" : vouched ? "on Metron" : "unverified"),
      groups: d.groups,
      invalid: line.kind === "error",
      needsChoice: d.pending,
      writes: rowWrites,
    };
  });

  return {
    rows, writes,
    unresolved: rows.filter((r) => r.needsChoice).length,
    lookups: [...ctx.lookups],
  };
}

/** `Thor (1966) #338–340, Balder the Brave #1–4`: consecutive numbers of one series collapsed, for the preview. */
export function summarize(labels: string[]): string {
  const out: string[] = [];
  let run: { prefix: string; from: number; to: number } | null = null;
  const flush = () => {
    if (run) out.push(run.from === run.to ? `${run.prefix} #${run.from}` : `${run.prefix} #${run.from}–${run.to}`);
    run = null;
  };
  for (const label of labels) {
    const m = /^(.*) #(\d+)$/.exec(label);
    if (m && run && run.prefix === m[1] && Number(m[2]) === run.to + 1) {
      run.to++;
      continue;
    }
    flush();
    if (m) run = { prefix: m[1], from: Number(m[2]), to: Number(m[2]) };
    else out.push(label);
  }
  flush();
  return out.join(", ");
}
