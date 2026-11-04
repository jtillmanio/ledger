"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  dirWords, libraryHref, otherDir, reverseName, SORTS, SORT_INFO, type Dir, type LibraryParams, type Sort,
} from "@/lib/library-sort";

/**
 * The Library's *Sort* (task 2.2e, D-110): a native select, so the phone gets
 * its own picker, and beside it the way the list runs now (*↓ Longest first*),
 * which is the link that reverses it. Both go through `libraryHref`, so every
 * filter and the search stay in the URL and the order survives a reload. A new
 * sort opens in its own direction; the reverse keeps the sort.
 */
export default function BookSort({ params, sort, dir }: { params: LibraryParams; sort: Sort; dir: Dir }) {
  const router = useRouter();
  return (
    <span className="sort">
      <label htmlFor="library-sort" className="small muted">Sort</label>
      <select id="library-sort" value={sort}
        onChange={(e) => {
          const next = e.target.value as Sort;
          router.push(libraryHref({ ...params, sort: next, dir: SORT_INFO[next].dir }));
        }}>
        {SORTS.map((s) => <option key={s} value={s}>{SORT_INFO[s].name}</option>)}
      </select>
      <Link prefetch={false} className="chip" aria-label={reverseName(sort, dir)}
            href={libraryHref({ ...params, sort, dir: otherDir(dir) })}>
        <span aria-hidden="true">{dir === "asc" ? "↑" : "↓"}</span> {dirWords(sort, dir)}
      </Link>
    </span>
  );
}
