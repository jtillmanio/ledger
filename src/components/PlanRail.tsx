"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useBlockPopover } from "@/components/BlockPopover";
import { useRailDrag } from "@/components/RailDrag";
import RailLegend from "@/components/RailLegend";
import type { PeriodCapacity } from "@/db/queries";
import {
  COLUMN_WORDS, MIN_HIT, PHONE_COLUMN, STRIP_LENGTH, genreHue, kWords, labelFit, layoutColumn, layoutLane, railName,
  stackLabelParts, stackName,
  type DropTarget, type Fit, type RailBook, type RailItem, type RailStack,
} from "@/lib/plan-rail";

/** On the strip, a block narrower than this share of it keeps its words to its name. */
const LABEL_SHARE = 0.07;
/** On the strip, a stack narrower than this many px (at the phone's 296px) says how many books, not their words. */
const STACK_WORDS_PX = 56;
// Loaded on the first tap, as the Library's and the plan page's Move load the picker: the page carries none
// of either sheet until a block or a stack is pressed.
const PlanPickerSheet = dynamic(() => import("@/components/PlanPicker"), { ssr: false });
const RailStackSheet = dynamic(() => import("@/components/RailStackSheet"), { ssr: false });

/** A column block's pointer routes on the desktop (task 2.10, 2 of 2): drag, hover, and which block is lifted. */
type Pointer = {
  down: (e: React.PointerEvent<HTMLElement>, book: RailBook) => void;
  enter: (e: React.PointerEvent<HTMLElement>, book: RailBook) => void;
  leave: () => void;
  lifted: string | null;
  /** False for the click a drag leaves behind. */
  isClick: () => boolean;
};

/** What is open: the picker for one book, or the list of a stack's books. `key` names the control it came from. */
type Open = { key: string; opener: HTMLElement; book?: RailBook; books?: RailBook[] };
/** How long, after a sheet closes, the rail remembers where focus should return if a refresh removes that place. */
const REFOCUS_MS = 3000;

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
 * Every block is a `<button>` with a name and a 24px hit area. A block opens the plan picker for its book
 * and a `+N` stack the list of its books (task 2.3, D-137 superseded): both sheets are the rail's own, so
 * the dashboard's strip and the plan page share them. When a sheet closes, focus goes back to the control
 * it came from; if a move took that control away, to the same book where it now stands, else to the rail
 * itself, whose name carries the new summary. Nothing here sets a fill: a block's place and size are
 * custom properties (`--at`, `--sz`, `--ov`) and its hue `--hue` (Hard rule 6).
 *
 * On the column rail, with a mouse or a trackpad, a block can also be dragged to another quarter or the fifth lane
 * (`useRailDrag`) and hovered for its name and words (`useBlockPopover`; task 2.10, 2 of 2, D-33). Touch and the
 * keyboard keep the press to the picker. The strip has neither.
 */
export default function PlanRail({ year, books, quarters, axis = "column", inHand = null, label, settled = false }: {
  year: number;
  books: RailBook[];
  quarters: PeriodCapacity[];
  axis?: "column" | "row";
  /** The book being read or listened to: the strip outlines it (D-40). */
  inHand?: string | null;
  /** The strip's own summary, as its accessible name. */
  label?: string;
  /**
   * The year is accepted as a stretch year (task 2.7): the overage is still drawn, but hatched in grey
   * (`--hatch-settled`) and its badges grey, and the legend says so. Only the held state clears.
   */
  settled?: boolean;
}) {
  const inPeriod = (period: string) => books.filter((b) => b.period === period);
  const total = (list: RailBook[]) => list.reduce((n, b) => n + b.words, 0);
  const root = useRef<HTMLDivElement>(null);
  const lane = inPeriod(String(year));
  // What a drop would make of each column: a quarter's own `plannedWords` (its footer's figure), the lane's sum.
  const targets: DropTarget[] = [
    ...quarters.map((q) => ({ period: q.period, quarter: q.quarter, plannedWords: q.plannedWords, capacity: q.capacity })),
    { period: String(year), quarter: null, plannedWords: total(lane), capacity: null },
  ];
  const drag = useRailDrag(root, targets);
  const pop = useBlockPopover();
  const lifted = drag.drag;
  const pointer: Pointer = {
    down: (e, book) => { pop.leave(); drag.onPointerDown(e, book); },
    enter: pop.enter, leave: pop.leave, lifted: lifted?.book.id ?? null, isClick: drag.isClick,
  };
  /** The column a drag would land in, when it is not the book's own. */
  const dropOn = (period: string) => (lifted && lifted.over === period && lifted.book.period !== period) || undefined;
  const [open, setOpen] = useState<Open | null>(null);
  /** The control the last sheet came from, until focus is settled or REFOCUS_MS has passed. */
  const back = useRef<string | null>(null);
  const press = (key: string, opener: HTMLElement, what: Pick<Open, "book" | "books">) => setOpen({ key, opener, ...what });
  function close() {
    if (open) {
      back.current = open.key;
      setTimeout(() => { back.current = null; }, REFOCUS_MS);
    }
    setOpen(null);
  }

  // `Sheet` puts focus back on the control that opened it. A move can take that control away, and the page
  // redraws a moment after the sheet has gone: when the new props arrive with focus lost, it goes to the
  // same book where it now stands, else to the rail, whose name says the new total.
  useEffect(() => {
    const key = back.current;
    if (!key || open) return;
    const at = document.activeElement;
    if (at && at !== document.body) return;
    const target = key.startsWith("stack-")
      ? root.current?.querySelector<HTMLElement>(`[data-stack="${CSS.escape(key.slice(6))}"]`)
      : root.current?.querySelector<HTMLElement>(`[data-book="${CSS.escape(key)}"]`);
    (target ?? root.current)?.focus();
    back.current = null;
  }, [open, books, quarters]);

  const sheets = (
    <>
      {open?.book && <PlanPickerSheet bookId={open.book.id} title={open.book.title} opener={open.opener} onClose={close} />}
      {open?.books && <RailStackSheet books={open.books} opener={open.opener} onClose={close} />}
    </>
  );

  if (axis === "row") {
    const cap = quarters[0];
    const scale = Math.max(cap.plannedWords, cap.capacity) || 1;
    const items = layoutColumn(inPeriod(cap.period), { length: STRIP_LENGTH, scale, capacity: cap.capacity });
    return (
      <>
      <div ref={root} tabIndex={-1} className="planrail strip" role="group" aria-label={label ?? `Plan ${cap.period}`}
        data-over={cap.plannedWords > cap.capacity || undefined} data-settled={settled || undefined}>
        <div className="qcol" data-period={cap.period}>
          <div className="qstack">
            {items.map((item) => (
              <Item key={itemKey(item)} item={item} length={STRIP_LENGTH} axis="row" inHand={inHand} onPress={press} />
            ))}
          </div>
          <i className="caprule" style={{ "--cap": num(cap.capacity / scale) } as CSSProperties} aria-hidden="true" />
        </div>
      </div>
      {sheets}
      </>
    );
  }

  const columns = quarters.map((cap) => ({ cap, books: inPeriod(cap.period) }));
  // 1000k fills a column, always: the rule never moves for what a plan holds, and books past the top of a
  // column or the lane fold into one +N more button there (layoutColumn).
  const scale = COLUMN_WORDS;
  const capacity = quarters[0]?.capacity ?? 0;

  return (
    <>
    {drag.layer}
    {!lifted && pop.popover}
    <div ref={root} tabIndex={-1} className="planrail" role="group" data-dragging={lifted ? true : undefined} data-settled={settled || undefined} aria-label={`Plan ${year}`} style={{ "--cap": num(Math.min(1, capacity / scale)) } as CSSProperties}>
      {columns.map(({ cap, books: list }) => {
        const items = layoutColumn(list, { length: PHONE_COLUMN, scale, capacity: cap.capacity });
        const over = cap.plannedWords - cap.capacity;
        return (
          <div key={cap.period} className="qcol" data-period={cap.period} data-drop={dropOn(cap.period)}>
            <div className="qstack">
              {items.map((item) => (
                <Item key={itemKey(item)} item={item} length={PHONE_COLUMN} axis="column" inHand={inHand} onPress={press} pointer={pointer} />
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
                  {/* Accepted, the overage is still said, in grey: a decision made, not one held (task 2.7). */}
                  <span className={settled ? "bdg dn phone" : "bdg bl phone"}>+{kWords(over)}</span>
                  <span className={settled ? "bdg dn desk" : "bdg bl desk"}>over {kWords(over)}</span>
                </>
              ) : (
                <span className="bdg dn desk">{kWords(-over)} room</span>
              )}
            </div>
          </div>
        );
      })}
      <div className="qcol nq" data-period={String(year)} data-drop={dropOn(String(year))}>
        <div className="qstack">
          {layoutLane(lane, { length: PHONE_COLUMN, scale }).map((item) => (
            <Item key={itemKey(item)} item={item} length={PHONE_COLUMN} axis="column" lane inHand={inHand} onPress={press} pointer={pointer} />
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
    <RailLegend settled={settled} />
    {sheets}
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
function Item({ item, length, axis, lane = false, inHand, onPress, pointer }: {
  item: RailItem; length: number; axis: "column" | "row"; lane?: boolean; inHand: string | null;
  /** The column rail's drag and hover; the strip passes none. */
  pointer?: Pointer;
  /** A press: the control's key (a book id, or `stack-<first id>`), the control, and what it opens. */
  onPress: (key: string, opener: HTMLElement, what: Pick<Open, "book" | "books">) => void;
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
        data-stack={item.books[0].id} aria-label={stackName(item.books)}
        onClick={(e) => onPress(itemKey(item), e.currentTarget, { books: item.books })}>
        {body}
        {/* On the strip a stack under 24px would cover its neighbour's label: its name says the count. */}
        {!(axis === "row" && small) && <StackLabel stack={item} short={axis === "row" && item.size < STACK_WORDS_PX} lane={lane} />}
      </button>
    );
  }

  const { book } = item;
  // The strip shows a block's words when its share of the strip fits them; a column says what its height
  // fits, at the phone's height and at the desktop's (`data-p`, `data-d`: 1 its words, 2 its title above them).
  const fit = axis === "row"
    ? ((item.size / length >= LABEL_SHARE ? 1 : 0) as Fit)
    : null;
  const { phone, desk } = fit === null ? labelFit(item.size) : { phone: fit, desk: fit };
  const state = book.id === inHand ? "head" : book.status === "read" ? "read" : undefined;
  const classes = cls("qb", item.over && "over", lane && "un", small && "sm");
  const place = (axis === "column" && item.lift !== undefined ? { ...style, "--lift": num(item.lift) } : style) as CSSProperties;
  return (
    <button type="button" className={classes} data-book={book.id} data-wc={book.estimated ? "estimated" : undefined}
      data-state={state} aria-label={railName(book)} data-p={phone || undefined} data-d={desk || undefined}
      style={{ ...place, "--hue": `var(${genreHue(book.genre)})` } as CSSProperties}
      data-lifted={pointer?.lifted === book.id || undefined}
      onPointerDown={pointer && ((e) => pointer.down(e, book))}
      onPointerEnter={pointer && ((e) => pointer.enter(e, book))}
      onPointerLeave={pointer?.leave}
      onClick={(e) => { if (!pointer || pointer.isClick()) onPress(book.id, e.currentTarget, { book }); }}>
      {body}
      {(phone > 0 || desk > 0) && (
        <>
          {/* The title only on a column, and only the part of it that fits: CSS ellipsises it. */}
          {axis === "column" && (phone === 2 || desk === 2) && <span className="qt">{book.title}</span>}
          <span className="ql mono">{book.estimated ? "~" : ""}{kWords(book.words)}</span>
        </>
      )}
    </button>
  );
}
