/**
 * The *Paste a list* review for books (task 1.4): what each pasted line will
 * do, why, and what is still yours to decide, before anything is written. Pure,
 * like the issue review: the screen hands it the parsed lines, what the
 * library check answered and the choices so far, and gets back the rows the
 * shared `ReviewTable` draws, the writes, and the real count.
 *
 * Only the same title and author is the same book (D-25). A title within
 * `pg_trgm` similarity 0.4 of a book you have is flagged with that book and
 * defaults to *Create new*: nothing is merged without your *Use that*. A new
 * book lands at Someday (D-37); a book you have keeps the status it has, except
 * an Unlisted one, which joins Someday as a book with no status does (task 1.21).
 */
import { bookKey, type BookCells, type BookLine } from "./book-parse";
import type { Group, Option } from "./bulk-review";

/** A library book, as the check names it. `status` is yours, null when it has none. */
export type LibraryBook = { bookId: string; title: string; author: string | null; status: string | null };

/** What the library check said about one title and author. */
export type BookAnswer = {
  /** The same title and author. */
  match: LibraryBook | null;
  /** Otherwise, the closest title at similarity ≥ 0.4. */
  near: (LibraryBook & { similarity: number }) | null;
};

/** Answers keyed by `bookKey`; a key not there hasn't been checked. */
export type BookAnswers = Map<string, BookAnswer>;

/** A line to create (or, if the library has it by now, reuse), or a library book to point it at. */
export type BookWrite =
  | { line: number; title: string; author: string; series: string | null; position: number | null }
  | { line: number; use: string };

export type BookRow = {
  key: string;
  line: number;
  kind: "ok" | "choice" | "error";
  text: string;
  why: string;
  /** What the Title and Author cells show (task 1.4e). */
  cells: BookCells;
  /** The reason an empty Author cell gives, worded for the cell; "" when it has an author. */
  authorWhy: string;
  check: string;
  groups: Group[];
  invalid: boolean;
  needsChoice: boolean;
};

export type BookReview = {
  rows: BookRow[];
  /** What the confirm sends, one per line that writes. */
  writes: BookWrite[];
  /** What *Add N books* counts: books created, and books of yours that join Someday. */
  count: number;
  /** Rows still waiting on a choice. */
  unresolved: number;
  /** Title and author pairs the library hasn't been asked about, once each. */
  unchecked: { title: string; author: string | null }[];
};

export type Choices = Record<string, string>;

export const THRESHOLD = 0.4;

const STATUS: Record<string, string> = { to_read: "to read", reading: "reading", read: "read", dnf: "did not finish" };
const ADD: Option = { id: "add", label: "Add" };
const CREATE: Option = { id: "create", label: "Create new" };
const USE: Option = { id: "use", label: "Use that" };
const SKIP: Option = { id: "skip", label: "Skip" };
const DROP: Option = { id: "drop", label: "Drop", destructive: true };

/** A row's key: the line and the text as pasted, so it holds while its cells are edited. */
export const rowKey = (line: { line: number; text: string }) => `${line.line}:${line.text}`;

const NO_AUTHOR = "No author. Type one in this cell.";
const NO_AUTHOR_NEW = "No author, so it can't be added as new: type one, or use your book.";

const named = (b: { title: string; author: string | null }) => (b.author ? `${b.title} - ${b.author}` : b.title);

export function buildBookReview(
  lines: BookLine[],
  { answers, choices }: { answers: BookAnswers; choices: Choices },
): BookReview {
  const unchecked = new Map<string, { title: string; author: string | null }>();
  const writes: BookWrite[] = [];
  const seen = new Map<string, number>(); // book key → the line that writes or keeps it
  const used = new Set<string>(); // library books already counted
  let count = 0;

  const rows = lines.map((line): BookRow => {
    const key = rowKey(line);
    const row: BookRow = {
      key, line: line.line, kind: "ok", text: line.text, why: "", cells: line.cells, authorWhy: "", check: "unverified",
      groups: [], invalid: false, needsChoice: false,
    };
    const decide = (options: Option[], fallback: string | null) => {
      const picked = choices[key];
      const choice = options.some((o) => o.id === picked) ? picked : fallback;
      row.groups.push({ key, name: "Decision", options, choice });
      if (choice === null) row.needsChoice = true;
      return choice;
    };

    if (line.flag === "no_title" || line.flag === "too_long") {
      row.kind = "error";
      row.invalid = true;
      row.check = "malformed";
      row.why = line.flag === "no_title" ? "No title before the author." : "Longer than any title or author: check the line.";
      decide([DROP], "drop");
      return row;
    }

    const bk = bookKey(line.title, line.author);
    if (seen.has(bk)) {
      row.why = `Also on line ${seen.get(bk)}.`;
      row.check = "repeat";
      decide([SKIP], "skip");
      return row;
    }

    const answer = answers.get(bk);
    if (answer === undefined) {
      if (!unchecked.has(bk)) unchecked.set(bk, { title: line.title, author: line.author });
      if (line.flag === "no_author") {
        row.kind = "choice";
        row.authorWhy = NO_AUTHOR;
      } else {
        row.why = "Not checked against your library yet.";
      }
      return row;
    }

    const { match, near } = answer;
    if (match) {
      row.check = "in library";
      seen.set(bk, line.line);
      // An Unlisted book (task 1.21) is in your library but not on your list: it joins Someday.
      if (match.status && match.status !== "unlisted") {
        row.why = `Already in your library (${STATUS[match.status] ?? match.status}).`;
        decide([SKIP], "skip");
      } else {
        row.why = "In your library, not on your list yet: adds it to Someday.";
        if (decide([ADD, DROP], "add") === "add") {
          writes.push({ line: line.line, use: match.bookId });
          if (!used.has(match.bookId)) count++;
          used.add(match.bookId);
        } else seen.delete(bk);
      }
      return row;
    }

    row.check = near ? `similar ${near.similarity.toFixed(2)}` : "new";
    const why: string[] = [];
    if (line.flag === "no_author") row.authorWhy = NO_AUTHOR_NEW;
    if (near) {
      row.kind = "choice";
      why.push(`Close to ${named(near)} in your library (similarity ${near.similarity.toFixed(2)}).`);
    } else if (line.flag === "no_author") {
      row.kind = "choice";
    } else {
      why.push(`New: creates the book${line.series ? `, in ${line.series} at #${line.position}` : ""}.`);
    }
    row.why = why.join(" ");

    const options = line.flag === "no_author" ? (near ? [USE, DROP] : [DROP])
      : near ? [CREATE, USE, DROP] : [ADD, DROP];
    const choice = decide(options, line.flag === "no_author" ? null : near ? "create" : "add");
    if ((choice === "add" || choice === "create") && line.author !== null) {
      writes.push({ line: line.line, title: line.title, author: line.author, series: line.series, position: line.position });
      count++;
      seen.set(bk, line.line);
    } else if (choice === "use" && near) {
      writes.push({ line: line.line, use: near.bookId });
      if ((!near.status || near.status === "unlisted") && !used.has(near.bookId)) count++;
      used.add(near.bookId);
      seen.set(bk, line.line);
    }
    return row;
  });

  return {
    rows, writes, count,
    unresolved: rows.filter((r) => r.needsChoice).length,
    unchecked: [...unchecked.values()],
  };
}
