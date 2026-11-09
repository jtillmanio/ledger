import { useId, type CSSProperties } from "react";
import type { PeriodCapacity } from "@/db/queries";
import {
  COLUMN_WORDS, MIN_HIT, PHONE_COLUMN, STRIP_LENGTH, genreHue, kWords, layoutColumn, layoutLane, railName, stackLabelParts, stackName,
  type RailBook, type RailItem, type RailStack,
} from "@/lib/plan-rail";

/** A label shows when its block is drawn at least this big, on the phone: the text must fit. */
const LABEL_PX = 16;
/** On the strip, a block narrower than this share of it keeps its words to its name. */
const LABEL_SHARE = 0.07;
/** On the strip, a stack narrower than this many px (at the phone's 296px) says how many books, not their words. */
const STACK_WORDS_PX = 56;
/** Why a stack does nothing yet: the reason shown beside it, until 2.3's list sheet exists (UX floor). */
const STACK_REASON = "A stack opens its list with the plan editor.";

/** A number for a custom property: enough places to be exact at 300px, few enough to read. */
const num = (n: number) => String(Math.round(n * 100_000) / 100_000);

/**
 * The plan rail (task 2.2b, F-22, D-37, D-38, M-07; docs/04-design.md § 6): one markup for every
 * place the plan is drawn. As a rail, each quarter is a column and each book a block sized by its
 * words and stacked in your order from the foot; the dashed rule is the quarter's capacity, and
 * only the part of a block past it is hatched, so the books past capacity are the ones you ranked
 * last. A fifth lane holds the bare-year books, largest at the foot. With `axis="row"` and one
 * quarter it is the dashboard's *This quarter* strip, the same markup laid on its side.
 *
 * Every block is a `<button>` with a name and a 24px hit area; a block opens its Library row until
 * 2.3's picker sheet exists. Nothing here sets a fill: a block's place and size are custom
 * properties (`--at`, `--sz`, `--ov`) and its hue `--hue` (Hard rule 6).
 */
export default function PlanRail({ year, books, quarters, axis = "column", inHand = null, label }: {
  year: number;
  books: RailBook[];
  quarters: PeriodCapacity[];
  axis?: "column" | "row";
  /** The book being read or listened to: the strip outlines it (D-40). */
  inHand?: string | null;
  /** The strip's own summary, as its accessible name. */
  label?: string;
}) {
  const note = useId();
  const inPeriod = (period: string) => books.filter((b) => b.period === period);

  if (axis === "row") {
    const cap = quarters[0];
    const scale = Math.max(cap.plannedWords, cap.capacity) || 1;
    const items = layoutColumn(inPeriod(cap.period), { length: STRIP_LENGTH, scale, capacity: cap.capacity });
    return (
      <>
      <div className="planrail strip" role="group" aria-label={label ?? `Plan ${cap.period}`}
        data-over={cap.plannedWords > cap.capacity || undefined}>
        <div className="qcol" data-period={cap.period}>
          <div className="qstack">
            {items.map((item) => (
              <Item key={itemKey(item)} item={item} length={STRIP_LENGTH} axis="row" inHand={inHand} note={note} />
            ))}
          </div>
          <i className="caprule" style={{ "--cap": num(cap.capacity / scale) } as CSSProperties} aria-hidden="true" />
        </div>
      </div>
      {items.some((i) => i.kind === "stack") && <p id={note} className="qnote">{STACK_REASON}</p>}
      </>
    );
  }

  const columns = quarters.map((cap) => ({ cap, books: inPeriod(cap.period) }));
  const lane = inPeriod(String(year));
  const total = (list: RailBook[]) => list.reduce((n, b) => n + b.words, 0);
  // 1000k fills a column, always: the rule never moves for what a plan holds, and books past the top of a
  // column or the lane fold into one +N more button there (layoutColumn).
  const scale = COLUMN_WORDS;
  const capacity = quarters[0]?.capacity ?? 0;

  return (
    <>
    <div className="planrail" role="group" aria-label={`Plan ${year}`} style={{ "--cap": num(Math.min(1, capacity / scale)) } as CSSProperties}>
      {columns.map(({ cap, books: list }) => {
        const items = layoutColumn(list, { length: PHONE_COLUMN, scale, capacity: cap.capacity });
        const over = cap.plannedWords - cap.capacity;
        return (
          <div key={cap.period} className="qcol" data-period={cap.period}>
            <div className="qstack">
              {items.map((item) => (
                <Item key={itemKey(item)} item={item} length={PHONE_COLUMN} axis="column" inHand={inHand} note={note} />
              ))}
            </div>
            <div className="qfoot">
              <b>Q{cap.quarter}</b>
              <span className="mono">
                {kWords(cap.plannedWords)}
                <span className="desk"> / {kWords(cap.capacity)}</span>
              </span>
              {over > 0 ? (
                <>
                  <span className="bdg bl phone">+{kWords(over)}</span>
                  <span className="bdg bl desk">over {kWords(over)}</span>
                </>
              ) : (
                <span className="bdg dn desk">{kWords(-over)} room</span>
              )}
            </div>
          </div>
        );
      })}
      <div className="qcol nq" data-period={String(year)}>
        <div className="qstack">
          {layoutLane(lane, { length: PHONE_COLUMN, scale }).map((item) => (
            <Item key={itemKey(item)} item={item} length={PHONE_COLUMN} axis="column" lane inHand={inHand} note={note} />
          ))}
        </div>
        <div className="qfoot">
          <b>{year}<span className="desk"> · no quarter</span></b>
          <span className="mono">{kWords(total(lane))}</span>
          {lane.length > 0 && <span className="bdg bl">{lane.length} {lane.length === 1 ? "book" : "books"}</span>}
        </div>
      </div>
      <span className="caprule" aria-hidden="true"><em>{kWords(capacity)}</em></span>
    </div>
    <ul className="qlegend">
      <li><i className="lg est" aria-hidden="true" /><span className="mono">~</span> estimated</li>
      <li><i className="lg ovr" aria-hidden="true" /> over capacity</li>
      <li id={note}><i className="lg stk" aria-hidden="true" /><span className="mono">+N</span> merged under 24px, or folded past the top. {STACK_REASON}</li>
      <li><i className="lg nqt" aria-hidden="true" /> year, no quarter</li>
    </ul>
    </>
  );
}

/** A stack's face. On the phone the fifth lane has room for the count only (45px): its tail shows from 1024px. */
function StackLabel({ stack, short, lane }: { stack: RailStack; short: boolean; lane: boolean }) {
  const [head, tail] = stackLabelParts(stack, lane);
  return (
    <span className="ql mono">
      {head}
      {!short && <span className={lane ? "lt" : undefined}>{tail}</span>}
    </span>
  );
}

const cls = (...names: (string | false)[]) => names.filter(Boolean).join(" ");
const itemKey = (item: RailItem) => (item.kind === "block" ? item.book.id : `stack-${item.books[0].id}`);

/** One block or stack, placed along its column by custom properties alone. */
function Item({ item, length, axis, lane = false, inHand, note }: {
  item: RailItem; length: number; axis: "column" | "row"; lane?: boolean; inHand: string | null; note: string;
}) {
  const style = {
    "--at": num(item.start / length),
    "--sz": num(item.size / length),
    // How much of the block's own length is past the rule, at its far end.
    "--ov": num(item.size > 0 ? item.overSize / item.size : 0),
  } as CSSProperties;
  // A block drawn under 24px on the phone gets a 24px hit area from CSS and stands above its neighbours.
  const small = item.size < MIN_HIT;
  const body = (
    <>
      {item.over && <i className="ov" aria-hidden="true" />}
      {item.kind === "block" && item.book.estimated && <i className="qe" aria-hidden="true" />}
    </>
  );

  if (item.kind === "stack") {
    return (
      <button type="button" className={cls("qb", "stack", item.over && "over", small && "sm")} style={style}
        aria-label={stackName(item.books)} aria-disabled="true" aria-describedby={note}>
        {body}
        {/* On the strip a stack under 24px would cover its neighbour's label: its name says the count. */}
        {!(axis === "row" && small) && <StackLabel stack={item} short={axis === "row" && item.size < STACK_WORDS_PX} lane={lane} />}
      </button>
    );
  }

  const { book } = item;
  const fits = axis === "row" ? item.size / length >= LABEL_SHARE : item.size >= LABEL_PX;
  const state = book.id === inHand ? "head" : book.status === "read" ? "read" : undefined;
  const classes = cls("qb", item.over && "over", lane && "un", small && "sm");
  return (
    // Until 2.3's picker sheet, a block opens the book's Library row: a GET form, no script.
    <form action="/books/list" className="qf">
      <input type="hidden" name="q" value={book.title} />
      <button type="submit" className={classes} data-book={book.id} data-wc={book.estimated ? "estimated" : undefined}
        data-state={state} aria-label={railName(book)}
        style={{ ...style, "--hue": `var(${genreHue(book.genre)})` } as CSSProperties}>
        {body}
        {fits && <span className="ql mono">{book.estimated ? "~" : ""}{kWords(book.words)}</span>}
      </button>
    </form>
  );
}
