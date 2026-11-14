/**
 * The Library's sorts (task 2.2e, D-110): the names, each one's natural
 * direction, the words for each direction, and the URL they live in. The order
 * itself is SQL in `listBooks`; nothing here touches a row.
 *
 * `dir` is the direction of the sort's key, so `length` is `desc` by default
 * (longest first) and `dir=asc` reverses it. A book with no value for the key
 * comes last in either direction (`.claude/rules/schema.md`).
 */
export const SORTS = ["series", "title", "author", "length", "published", "finished", "plan"] as const;
export type Sort = (typeof SORTS)[number];
export type Dir = "asc" | "desc";

type SortInfo = {
  /** The option's name in the Sort select. */
  name: string;
  /** The direction a sort opens in. */
  dir: Dir;
  /** What each direction reads as, in the link that reverses it. */
  words: Record<Dir, string>;
};

export const SORT_INFO: Record<Sort, SortInfo> = {
  series: { name: "Series", dir: "asc", words: { asc: "A–Z", desc: "Z–A" } },
  title: { name: "Title", dir: "asc", words: { asc: "A–Z", desc: "Z–A" } },
  author: { name: "Author", dir: "asc", words: { asc: "A–Z", desc: "Z–A" } },
  length: { name: "Length", dir: "desc", words: { desc: "Longest first", asc: "Shortest first" } },
  published: { name: "Published", dir: "desc", words: { desc: "Newest first", asc: "Oldest first" } },
  finished: { name: "Finished", dir: "desc", words: { desc: "Most recent first", asc: "Oldest first" } },
  plan: { name: "Plan order", dir: "asc", words: { asc: "First to last", desc: "Last to first" } },
};

export const DEFAULT_SORT: { sort: Sort; dir: Dir } = { sort: "series", dir: "asc" };

/**
 * `?sort=` and `?dir=` as the Library reads them. A missing `dir` is the
 * sort's own; an unknown `sort` or `dir` is the default order, never an error
 * (a hand-edited or stale link still opens the list).
 */
export function parseSort(sort?: unknown, dir?: unknown): { sort: Sort; dir: Dir } {
  const known = SORTS.find((s) => s === sort);
  if (sort !== undefined && !known) return DEFAULT_SORT;
  if (dir !== undefined && dir !== "asc" && dir !== "desc") return DEFAULT_SORT;
  const chosen = known ?? DEFAULT_SORT.sort;
  return { sort: chosen, dir: dir ?? SORT_INFO[chosen].dir };
}

export const otherDir = (dir: Dir): Dir => (dir === "asc" ? "desc" : "asc");

/** The sort's name for a direction: *Longest first*. */
export const dirWords = (sort: Sort, dir: Dir) => SORT_INFO[sort].words[dir];

/** The reverse link's name: it says which way the list runs now and where it would go. */
export function reverseName(sort: Sort, dir: Dir): string {
  const to = dirWords(sort, otherDir(dir));
  // "Shortest first" reads mid-sentence in lower case; "A–Z" keeps its capitals.
  const mid = /^[A-Z][a-z]/.test(to) ? to.charAt(0).toLowerCase() + to.slice(1) : to;
  return `${dirWords(sort, dir)}; reverse to ${mid}`;
}

export type LibraryParams = {
  status?: string; level?: string; year?: string; genre?: string; q?: string; series?: string;
  sort?: Sort; dir?: Dir;
};

/**
 * A link into the Library: only what is set, in one fixed order, with the
 * sort and direction left out when they are the defaults, so a plain link
 * stays `/books/list`. Every filter link and the search box build theirs here,
 * so none drops the sort.
 */
export function libraryHref(params: LibraryParams): string {
  const qs = new URLSearchParams();
  for (const k of ["status", "level", "year", "genre", "q", "series"] as const) {
    if (params[k]) qs.set(k, params[k]);
  }
  const { sort, dir } = parseSort(params.sort, params.dir);
  if (sort !== DEFAULT_SORT.sort) qs.set("sort", sort);
  if (dir !== SORT_INFO[sort].dir) qs.set("dir", dir);
  const search = qs.toString();
  return search ? `/books/list?${search}` : "/books/list";
}

/**
 * A genre chip's link (task 4.5b, D-124): the genre on top of the status and
 * the To read level already chosen, so *To read · On deck* then *Fantasy*
 * lists Fantasy's On deck books instead of the whole Library. The sort rides
 * along as on every chip; the year and the search, which a genre chip has
 * always replaced, still go.
 */
export function genreChipHref(current: Pick<LibraryParams, "status" | "level" | "sort" | "dir">, genre: string): string {
  const { status, level, sort, dir } = current;
  return libraryHref({ status, level, genre, sort, dir });
}
