/**
 * The wishlist review (task 1.4d, D-39): what each line left from the old
 * To-Read tab will do, why, and what is still yours to decide, before anything
 * is written. Pure, like the paste review it sits beside (`book-review.ts`),
 * and built on the same types: the screen hands it the lines, what the library
 * check answered, the choices so far and the edits, and gets back the rows
 * `ReviewTable` draws, the accepts and dismissals to send, and the counts.
 *
 * Only the same title and author is the same book (D-25); a title within
 * similarity 0.4 of a book you have is flagged with it and defaults to *Create
 * new*, never a merge. A line that names a series is flagged *series?* and
 * writes nothing until it is edited into a book or dismissed. *Dismiss* removes
 * a staging line, not a book, so it is grey, not red. An edited line is a new
 * line to the library check: its match is re-run before it can be accepted.
 */
import { bookKey, parseBookLine, seriesLike, type BookLine } from "./book-parse";
import type { Group, Option } from "./bulk-review";
import type { BookAnswers, Choices } from "./book-review";
import type { ReviewTableRow } from "@/components/ReviewTable";

/** One unresolved `wishlist` row: `raw_entry` is the sheet's text, `genre` its column. */
export type WishlistLine = { id: number; genre: string | null; text: string };

/** What an accept sends: the line, and a book to create or a library book to link. */
export type WishlistItem =
  | { id: number; title: string; author: string; series: string | null; position: number | null }
  | { id: number; use: string };

export type WishlistRow = ReviewTableRow & {
  id: number;
  genre: string | null;
  /** The text was changed on this screen; `raw_entry` itself is never rewritten. */
  edited: boolean;
  /** The text the Edit field starts from. */
  source: string;
};

export type WishlistReview = {
  rows: WishlistRow[];
  accepts: WishlistItem[];
  /** Wishlist ids to delete. */
  dismisses: number[];
  /** Books the accepts will create, and books of yours they will link. */
  creates: number;
  links: number;
  /** Rows waiting on the library check (never asked, or edited since). */
  pending: number;
  /** Title and author pairs the library hasn't been asked about, once each. */
  unchecked: { title: string; author: string | null }[];
};

const STATUS: Record<string, string> = { to_read: "to read", reading: "reading", read: "read", dnf: "did not finish" };
const ADD: Option = { id: "add", label: "Add" };
const LINK: Option = { id: "link", label: "Link" };
const CREATE: Option = { id: "create", label: "Create new" };
const USE: Option = { id: "use", label: "Use that" };
const LEAVE: Option = { id: "leave", label: "Leave" };
// Grey on purpose: it deletes a staging line, never a book (D-39).
const DISMISS: Option = { id: "dismiss", label: "Dismiss" };

const named = (b: { title: string; author: string | null }) => (b.author ? `${b.title} - ${b.author}` : b.title);

export function buildWishlistReview(
  lines: WishlistLine[],
  { answers, choices, edits, seriesNames }: {
    answers: BookAnswers; choices: Choices; edits: Record<number, string>;
    /** Lower-cased names in `book_series`. */
    seriesNames: Iterable<string>;
  },
): WishlistReview {
  const series = new Set(seriesNames);
  const unchecked = new Map<string, { title: string; author: string | null }>();
  const accepts: WishlistItem[] = [];
  const dismisses: number[] = [];
  let creates = 0;
  let links = 0;
  let pending = 0;

  const rows = lines.map((l): WishlistRow => {
    const text = edits[l.id] ?? l.text;
    const parsed: BookLine | null = parseBookLine(text, l.id);
    const shown = parsed?.text ?? "";
    const key = `${l.id}:${shown}`;
    const row: WishlistRow = {
      key, id: l.id, genre: l.genre, line: l.id, kind: "ok", text: shown, why: "", check: "unverified",
      groups: [], invalid: false, edited: text !== l.text, source: parsed?.text ?? text,
    };
    const decide = (options: Option[], fallback: string | null) => {
      const picked = choices[key];
      const choice = options.some((o) => o.id === picked) ? picked : fallback;
      row.groups.push({ key, name: "Decision", options, choice } satisfies Group);
      if (choice === "dismiss") dismisses.push(l.id);
      return choice;
    };

    if (!parsed || parsed.flag === "no_title" || parsed.flag === "too_long") {
      row.kind = "error";
      row.invalid = true;
      row.check = "malformed";
      row.why = !parsed || parsed.flag === "no_title" ? "No title: edit the line, or dismiss it."
        : "Longer than any title or author: check the line.";
      decide([LEAVE, DISMISS], "leave");
      return row;
    }

    const answer = answers.get(bookKey(parsed.title, parsed.author));
    const hasMatch = answer?.match != null;
    if (seriesLike(parsed.title) || (series.has(parsed.title.toLowerCase()) && answer !== undefined && !hasMatch)) {
      row.kind = "choice";
      row.check = "series?";
      row.why = "This names a series, not a book. Edit it to one book, or dismiss it.";
      decide([LEAVE, DISMISS], "leave");
      return row;
    }

    if (answer === undefined) {
      pending++;
      // Not a green tick: it can't be accepted until the library has been asked.
      row.kind = "choice";
      const k = bookKey(parsed.title, parsed.author);
      if (!unchecked.has(k)) unchecked.set(k, { title: parsed.title, author: parsed.author });
      if (parsed.flag === "no_author") {
        row.why = "No author. Add one after a dash: Title - Author.";
      } else {
        row.why = row.edited ? "Edited: check it against your library." : "Not checked against your library yet.";
      }
      return row;
    }

    const { match, near } = answer;
    if (match) {
      row.check = "in library";
      if (match.status) {
        row.why = `Already in your library (${STATUS[match.status] ?? match.status}): links this line, and your status stays.`;
      } else {
        row.why = "In your library, not on your list yet: links this line and adds it to Someday.";
      }
      if (decide([LINK, DISMISS], "link") === "link") {
        accepts.push({ id: l.id, use: match.bookId });
        links++;
      }
      return row;
    }

    row.check = near ? `similar ${near.similarity.toFixed(2)}` : "new";
    const why: string[] = [];
    if (parsed.flag === "no_author") why.push("No author, so it can't be added as new: edit it to add one after a dash.");
    if (near) {
      row.kind = "choice";
      why.push(`Close to ${named(near)} in your library (similarity ${near.similarity.toFixed(2)}).`);
    } else if (parsed.flag === "no_author") {
      row.kind = "choice";
    } else {
      why.push(`New: creates the book at Someday${parsed.series ? `, in ${parsed.series} at #${parsed.position}` : ""}.`);
    }
    row.why = why.join(" ");

    const options = parsed.flag === "no_author" ? (near ? [USE, LEAVE, DISMISS] : [LEAVE, DISMISS])
      : near ? [CREATE, USE, DISMISS] : [ADD, DISMISS];
    const choice = decide(options, parsed.flag === "no_author" ? "leave" : near ? "create" : "add");
    if ((choice === "add" || choice === "create") && parsed.author !== null) {
      accepts.push({ id: l.id, title: parsed.title, author: parsed.author, series: parsed.series, position: parsed.position });
      creates++;
    } else if (choice === "use" && near) {
      accepts.push({ id: l.id, use: near.bookId });
      links++;
    }
    return row;
  });

  return { rows, accepts, dismisses, creates, links, pending, unchecked: [...unchecked.values()] };
}
