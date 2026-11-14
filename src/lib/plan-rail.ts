// The plan rail's layout (task 2.2b, F-22, D-37, D-38, M-07; docs/04-design.md § 6). No React and no
// database: given a quarter's books in your order, it says where each block sits along its column
// (or along the strip), how much of it is past the capacity rule, and which small neighbours fold
// into one stack. Sizes are CSS px at `length`, the drawing the phone makes; the component turns
// them into fractions of the column, so the same markup scales between 230px and 300px.
import { quarterName } from "@/lib/format";

/** Words as the rail says them: `615k`, `1.2M`. */
export function kWords(words: number): string {
  return words >= 1_000_000 ? `${(words / 1_000_000).toFixed(1).replace(/\.0$/, "")}M` : `${Math.round(words / 1000)}k`;
}

/** A book that counts against a period, as the rail draws it. */
export type RailBook = {
  id: string;
  title: string;
  words: number;
  /** The count rests on an estimate (pages at your words per page), not a stated one. */
  estimated: boolean;
  /** `2027-Q1`, or `2027` for the fifth lane. */
  period: string;
  /** Its top-level genres (task 4.5): `book_genre_levels` at depth 1, Calibre's; empty for none. */
  genres: string[];
  status: "to_read" | "reading" | "read";
};

/** Nothing interactive is smaller than this (the UX floor, docs/04-design.md § 10). */
export const MIN_HIT = 24;
/** The phone's column, and the words that fill it: 1000k a column. */
export const PHONE_COLUMN = 230;
export const COLUMN_WORDS = 1_000_000;
/** The dashboard strip's length at 360px: the card's inner width. Merging is decided here. */
export const STRIP_LENGTH = 296;

type Placed = {
  /** Words before it, as px along the rail. */
  start: number;
  /** Its own words, as px: its drawn length. */
  size: number;
  /** The px of it past the capacity rule, at its far end. */
  overSize: number;
  over: boolean;
  /** For a block the rule runs through: px from its start to the rule. Null otherwise. */
  split: number | null;
  /**
   * For a lone block drawn under `min` px: the share of its missing px its 24px hit area takes below it
   * (the rest above). Set by `layoutColumn`; absent means an even split.
   */
  lift?: number;
};

export type RailBlock = Placed & { kind: "block"; book: RailBook };
/**
 * Two or more adjacent blocks each under `min` px, merged into one button; or, with `fold`, every book that
 * would run past the top of the column, folded into one `+N more` button standing at the top.
 */
export type RailStack = Placed & { kind: "stack"; books: RailBook[]; count: number; words: number; fold: boolean };
export type RailItem = RailBlock | RailStack;

export type ColumnOptions = {
  /** The px the rail is drawn along, on the phone. */
  length: number;
  /** The words that fill `length`. */
  scale: number;
  /** The words the rule marks; `Infinity` for a lane that counts against none. */
  capacity: number;
  /** A block under this many px is too small to tap (24, the UX floor). */
  min?: number;
};

/**
 * Lays a column out. `books` are in the order the plan holds them, from the foot up: the running
 * total of words decides each block's place, so the capacity rule falls exactly where the words
 * cross it. A block is over when it ends past capacity, and only the part past capacity is over.
 */
export function layoutColumn(books: RailBook[], { length, scale, capacity, min = MIN_HIT }: ColumnOptions): RailItem[] {
  const perWord = length / scale;
  const place = (group: RailBook[], startWords: number) => {
    const words = group.reduce((n, b) => n + b.words, 0);
    const endWords = startWords + words;
    const over = endWords > capacity;
    const overWords = over ? endWords - Math.max(startWords, capacity) : 0;
    const straddles = over && startWords < capacity;
    const size = words * perWord;
    return {
      words,
      endWords,
      placed: {
        start: startWords * perWord,
        size,
        overSize: overWords * perWord,
        over,
        split: straddles ? (capacity - startWords) * perWord : null,
      } satisfies Placed,
    };
  };

  const items: RailItem[] = [];
  let at = 0;
  let run: RailBook[] = [];
  let runStart = 0;
  // A run of small blocks is held until something larger ends it.
  const flush = () => {
    if (run.length === 1) {
      items.push({ kind: "block", book: run[0], ...place(run, runStart).placed });
    } else if (run.length > 1) {
      const { words, placed } = place(run, runStart);
      items.push({ kind: "stack", books: run, count: run.length, words, fold: false, ...placed });
    }
    run = [];
  };
  for (const book of books) {
    if (book.words * perWord < min) {
      if (run.length === 0) runStart = at;
      run.push(book);
    } else {
      flush();
      items.push({ kind: "block", book, ...place([book], at).placed });
    }
    at += book.words;
  }
  flush();
  return liftSmall(foldOverflow(items, { length, perWord, scale, capacity }), min);
}

/**
 * A lone block under `min` px gets a `min`px hit area that reaches into its neighbours. Rather than an
 * even split, the missing px come from the side with room: the column's foot or top, or a neighbour's px
 * beyond its own `min` and a px of slack (`HIT_SLACK`). Both sides tight (a 30k book between two 110k ones at 230px) is the even split.
 */
export function hitLift(missing: number, room: { below: number; above: number }): number {
  let below = missing / 2;
  let above = missing - below;
  if (below > room.below) { below = room.below; above = missing - below; }
  else if (above > room.above) { above = room.above; below = missing - above; }
  return below > room.below + 1e-9 || above > room.above + 1e-9 ? 0.5 : below / missing;
}

/** A neighbour keeps a px beyond its `min`: a browser's hit test snaps to device pixels and would take it. */
export const HIT_SLACK = 1;

function liftSmall(items: RailItem[], min: number): RailItem[] {
  const spare = (item: RailItem | undefined) => (item ? Math.max(0, item.size - min - HIT_SLACK) : Infinity);
  return items.map((item, i) => (item.kind === "block" && item.size < min
    ? { ...item, lift: hitLift(min - item.size, { below: spare(items[i - 1]), above: spare(items[i + 1]) }) }
    : item));
}

/** The desktop rail is this many times as tall as the phone's (230px → 300px). */
export const DESK_SCALE = 300 / PHONE_COLUMN;
/** A block shows its words from this drawn height, and its title above them from `TITLE_PX` (the plan page's full-size rail, D-135, D-138). */
const WORDS_PX = 14;
const TITLE_PX = 32;

/** What a block of `size` px (at the phone's height) says about itself: 0 nothing, 1 its words, 2 its title and words. */
export type Fit = 0 | 1 | 2;
export function labelFit(size: number): { phone: Fit; desk: Fit } {
  const at = (px: number): Fit => (px >= TITLE_PX ? 2 : px >= WORDS_PX ? 1 : 0);
  return { phone: at(size), desk: at(size * DESK_SCALE) };
}

/** The shape of a `plan_capacity` quarter that the room line reads. */
export type QuarterRoom = { quarter: number | null; capacity: number; plannedWords: number; books: number };

/**
 * The plan page's one empty state (task 2.10): the room across the quarters still ahead that are not over
 * (this quarter and later for this year, all four for a later year, none for a past one), named as a range
 * when they run on (*Q2–Q4*), else as a list (*Q2 and Q4*). Null when no quarter ahead has room.
 */
export function roomAhead(quarters: QuarterRoom[], year: number, today: string): { words: number; quarters: number[]; text: string } | null {
  const thisYear = Number(today.slice(0, 4));
  const thisQuarter = Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1;
  const ahead = quarters.filter((q): q is QuarterRoom & { quarter: number } =>
    q.quarter !== null && (year > thisYear || (year === thisYear && q.quarter >= thisQuarter)));
  const open = ahead.filter((q) => q.plannedWords <= q.capacity && q.capacity > q.plannedWords);
  if (open.length === 0) return null;
  const nums = open.map((q) => q.quarter);
  const words = open.reduce((n, q) => n + q.capacity - q.plannedWords, 0);
  const names = nums.map((n) => `Q${n}`);
  const run = nums.length > 1 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
  const where = nums.length === 1 ? `in ${names[0]}`
    : run ? `across ${names[0]}–${names[names.length - 1]}`
    : `across ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return { words, quarters: nums, text: `${kWords(words)} of room ${where}` };
}

/** The year the page shows: `?year=` when it is this year or one of the next four, else this year. */
export function planYear(raw: string | string[] | undefined, today: string): number {
  const thisYear = Number(today.slice(0, 4));
  const year = typeof raw === "string" && /^\d{4}$/.test(raw) ? Number(raw) : NaN;
  return year >= thisYear && year < thisYear + 5 ? year : thisYear;
}

/**
 * A column holds `scale` words: the scale and the rule never move for what a plan holds. The first book
 * that would end past the top, and every book after it, fold into one stack that runs from where that
 * book starts to the top; one book alone stays a block, clipped there (owner, at review). Only what is
 * drawn of it can be over.
 */
function foldOverflow(items: RailItem[], { length, perWord, scale, capacity }: { length: number; perWord: number; scale: number; capacity: number }): RailItem[] {
  const at = items.findIndex((i) => i.start + i.size > length + 1e-6);
  if (at < 0) return items;
  const rest = items.slice(at);
  const books = rest.flatMap((i) => (i.kind === "block" ? [i.book] : i.books));
  const words = books.reduce((n, b) => n + b.words, 0);
  const startWords = rest[0].start / perWord;
  const overWords = Math.max(0, Math.min(startWords + words, scale) - Math.max(startWords, capacity));
  const placed = {
    start: rest[0].start, size: length - rest[0].start, overSize: overWords * perWord, over: overWords > 0,
    split: overWords > 0 && startWords < capacity ? (capacity - startWords) * perWord : null,
  } satisfies Placed;
  // One book alone past the top is not a stack to fold: it stays its own block (its name, its tap),
  // drawn from where its words start to the top of the column.
  if (rest.length === 1 && rest[0].kind === "block") return [...items.slice(0, at), { ...rest[0], ...placed }];
  const fold: RailStack = { kind: "stack", books, count: books.length, words, fold: true, ...placed };
  return [...items.slice(0, at), fold];
}

/** The fifth lane: bare-year books have no order (D-37), so the largest stands at the foot. */
export function layoutLane(books: RailBook[], options: Omit<ColumnOptions, "capacity">): RailItem[] {
  const bySize = [...books].sort((a, b) => b.words - a.words || a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  return layoutColumn(bySize, { ...options, capacity: Infinity });
}

/** `Q1 2027`, or `2027` for a bare year. */
export function periodName(period: string): string {
  return quarterName(period);
}

/** A block's accessible name: *Piranesi, 65k words, estimated, Q1 2027*. A stated count says nothing of it. */
export function railName(book: RailBook): string {
  return [book.title, `${kWords(book.words)} words`, ...(book.estimated ? ["estimated"] : []), periodName(book.period)].join(", ");
}

/** A stack's accessible name: *3 books, 84k words*. */
export function stackName(books: RailBook[]): string {
  return `${books.length} books, ${kWords(books.reduce((n, b) => n + b.words, 0))} words`;
}

/**
 * What a stack's face says: `+3 · 84k`, or `+4 more · 545k` for the books folded off the top. `short` drops
 * the words, for a stack too narrow to carry them beside its neighbour (its name still says them).
 */
export function stackLabel(stack: Pick<RailStack, "count" | "words" | "fold">, short = false): string {
  const [head, tail] = stackLabelParts(stack);
  return short ? head : head + tail;
}

/**
 * A stack's label in two parts, for a lane too narrow for all of it on the phone: `+3` and ` · 84k`, or
 * `+4` and ` more · 545k` when `narrow` (the fifth lane), where the head is only the count. The parts
 * always join to `stackLabel`.
 */
export function stackLabelParts(stack: Pick<RailStack, "count" | "words" | "fold">, narrow = false): [string, string] {
  const more = stack.fold ? " more" : "";
  const words = ` · ${kWords(stack.words)}`;
  return narrow ? [`+${stack.count}`, more + words] : [`+${stack.count}${more}`, words];
}

/**
 * The genre families and their hues (task 4.5, the owner's table at its plan gate; D-98): a top-level
 * genre in Calibre, in any case, onto `--g1`…`--g6`. Every other genre, and one added to Calibre later,
 * is `--g7`. Hue identifies data and nothing else (docs/04-design.md § 3).
 */
export const GENRE_FAMILIES: readonly (readonly string[])[] = [
  ["Fantasy"],
  ["Science Fiction"],
  ["Young Adult", "Childrens"],
  ["Thriller", "Mystery", "Crime"],
  ["Horror", "Paranormal"],
  ["History", "Science", "Biography", "Autobiography", "Nonfiction", "Politics", "Business", "Religion", "Christian",
    "Psychology", "Philosophy", "Sociology", "Ecomonics", "Health", "Food", "Travel", "Sports", "Popular Culture",
    "Games", "Video Games", "Survival"],
];

const FAMILY_OF = new Map(GENRE_FAMILIES.flatMap((names, i) => names.map((n) => [n.toLowerCase(), i] as const)));

/**
 * One book, one hue: the first family in `--g1`…`--g7` order among its top-level genres, whatever order
 * they come in, so a Young Adult fantasy is `--g1`; `--g7` for a genre in no family, `--g8` for a book
 * with no genre. Case and spacing don't matter.
 */
export function genreHue(genres: readonly string[]): string {
  const keys = genres.map((g) => g.trim().toLowerCase()).filter((g) => g !== "");
  if (keys.length === 0) return "--g8";
  const family = Math.min(...keys.map((k) => FAMILY_OF.get(k) ?? GENRE_FAMILIES.length));
  return `--g${family + 1}`;
}

/** A year against its capacity and its acceptance (task 2.7): what the plan page's card and the rail's hatch say. */
export type DecisionState = "fits" | "over" | "settled";

/**
 * A year's decision (task 2.7, F-23; R3-14): `fits` at or under capacity; over it, `settled` while its planned
 * words stay at or under the figure accepted, and `over` when nothing is accepted or it has grown past that.
 * One rule for `planDecision`, the plan page and the dashboard's strip, so none of them disagrees.
 */
export function decisionState(year: { plannedWords: number; capacity: number }, acceptedTotal: number | null): DecisionState {
  if (year.plannedWords <= year.capacity) return "fits";
  return acceptedTotal !== null && year.plannedWords <= acceptedTotal ? "settled" : "over";
}

/**
 * *Even out the quarters* (task 2.7, D-37): given the year's quarter books Q1 to Q4, each quarter in its order,
 * the quarter (1–4) each goes to: the one its words' midpoint falls in at a quarter of the total each. The order
 * never changes and no quarter is skipped mid-run, so every book ahead of another stays ahead of it.
 * `evenOutQuarters` writes it and the rebalance sheet previews it, from this one function.
 */
export function evenQuarters(words: number[]): number[] {
  const total = words.reduce((n, w) => n + w, 0);
  if (total === 0) return words.map(() => 1);
  const share = total / 4;
  let run = 0;
  return words.map((w) => {
    const quarter = Math.min(3, Math.floor((run + w / 2) / share)) + 1;
    run += w;
    return quarter;
  });
}

/** Where a dragged block would land (task 2.10, 2 of 2): a quarter with its capacity, or the fifth lane with none. */
export type DropTarget = { period: string; quarter: number | null; plannedWords: number; capacity: number | null };

/**
 * The drag's live readout (Plan Rail Spec A4.4, STYLE_GUIDE §3 *Drag (desktop)*): *Q3 +118k → 533k / 760k*, the
 * target's total after the drop against its capacity, from the same `plannedWords` its footer and summary row print.
 * The fifth lane counts against nothing (*2027 +118k → 1.3M*), and the book's own period takes nothing.
 */
export function dropReadout(book: Pick<RailBook, "words" | "period">, target: DropTarget): string {
  const name = target.quarter === null ? target.period : `Q${target.quarter}`;
  if (book.period === target.period) return `${name} · already here`;
  const after = `${name} +${kWords(book.words)} → ${kWords(target.plannedWords + book.words)}`;
  return target.capacity === null ? after : `${after} / ${kWords(target.capacity)}`;
}
