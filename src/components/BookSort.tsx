"use client";

import ChipMenu from "@/components/ChipMenu";
import {
  ownedChipText, ownedChoices, sortChipName, sortChipText, sortChoices, type Dir, type LibraryParams, type Sort,
} from "@/lib/library-sort";

/**
 * The Library's *Sort* (task 2.2e, D-110; a dropdown chip since task 6.24, MR-D20): a chip that says how the list
 * runs (*Sort: Length*, named *Sort: Length, longest first*) and opens the seven sorts and the sort's two
 * directions. Every choice is a link through `libraryHref`, so every filter and the search stay in the URL and the
 * order survives a reload. A new sort opens in its own direction; a direction keeps the sort.
 */
export default function BookSort({ params, sort, dir }: { params: LibraryParams; sort: Sort; dir: Dir }) {
  return (
    <ChipMenu text={sortChipText(sort)} name={sortChipName(sort, dir)} group="Sort" align="end"
      choices={sortChoices(params, sort, dir)} />
  );
}

/**
 * The Library's *Owned* filter (task 5.17, D-121, D-132; a dropdown chip since task 6.24): *Owned: Any* until one of
 * *Physical · Audiobook · Ebook · Not owned* is chosen. Every other filter, the search and the order ride along.
 */
export function BookOwned({ params }: { params: LibraryParams }) {
  return <ChipMenu text={ownedChipText(params.owned)} group="Owned" choices={ownedChoices(params)} />;
}
