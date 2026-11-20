// The /progress page's pure parts (task 5.12, 2 of 2; D-109, D-119): the tab and the medium chip, both in the
// URL; a row's page where one exists; the nesting; the finish's month. Nothing here reads the database: the rows
// are `progressRows` (TASK-104).
import type { ProgressRow } from "@/db/queries";

export const PROGRESS_TABS = ["middle", "completed"] as const;
export type ProgressTab = (typeof PROGRESS_TABS)[number];

/** The chips *All · Books · Comics*; *Watch*, *Music* and *Games* join with their rows (8.8, 9.6, 10.3). */
export const MEDIUMS = ["all", "books", "comics"] as const;
export type MediumChip = (typeof MEDIUMS)[number];

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The tab `?tab=` names; anything unknown, or none, is *In the middle of*. */
export function parseProgressTab(value: string | string[] | undefined): ProgressTab {
  return PROGRESS_TABS.find((t) => t === first(value)) ?? "middle";
}

/** The chip `?medium=` names; anything unknown, or none, is *All*. */
export function parseMedium(value: string | string[] | undefined): MediumChip {
  return MEDIUMS.find((m) => m === first(value)) ?? "all";
}

/** `/progress` with the tab and the chip, each named only when it isn't the default, so a link keeps the other. */
export function progressHref(tab: ProgressTab, medium: MediumChip): string {
  const params = new URLSearchParams();
  if (tab !== "middle") params.set("tab", tab);
  if (medium !== "all") params.set("medium", medium);
  const query = params.toString();
  return query ? `/progress?${query}` : "/progress";
}

/** The rows the chip keeps: *All* every one, *Books* the books rows, *Comics* the comics rows. */
export function byMedium(rows: ProgressRow[], medium: MediumChip): ProgressRow[] {
  return medium === "all" ? rows : rows.filter((r) => r.medium === medium);
}

/** A row and the rows nested beneath it (D-119). */
export type ProgressNode = { row: ProgressRow; children: ProgressNode[] };

const keyOf = (kind: string, id: string) => `${kind}:${id}`;

/**
 * The rows as a tree (D-119): a row sits under the row its `parentKind`/`parentId` name when that one is in
 * the list, a subseries under its series, which may itself sit under a universe. A row whose parent isn't
 * listed stands on its own. Roots and children keep the list's order (newest read first); a child may sort
 * ahead of its parent, so this is built from the ids, never from adjacency. A parent is matched by kind as
 * well as id, and a row is never its own ancestor.
 */
export function nestRows(rows: ProgressRow[]): ProgressNode[] {
  const nodes = new Map(rows.map((row) => [keyOf(row.kind, row.id), { row, children: [] as ProgressNode[] }]));
  const roots: ProgressNode[] = [];
  for (const row of rows) {
    const node = nodes.get(keyOf(row.kind, row.id))!;
    const parent = row.parentKind && row.parentId ? nodes.get(keyOf(row.parentKind, row.parentId)) : undefined;
    if (parent && parent !== node && !isUnder(parent, node, nodes)) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** Whether `node` is an ancestor of `of`: the guard that keeps a malformed parent chain from looping. */
function isUnder(of: ProgressNode, node: ProgressNode, nodes: Map<string, ProgressNode>): boolean {
  const seen = new Set<ProgressNode>();
  let at: ProgressNode | undefined = of;
  while (at && !seen.has(at)) {
    if (at === node) return true;
    seen.add(at);
    const up: ProgressRow = at.row;
    at = up.parentKind && up.parentId ? nodes.get(keyOf(up.parentKind, up.parentId)) : undefined;
  }
  return false;
}

/**
 * Where a row opens, or null where no page exists yet (5.2's track page, a subseries' page): such a row is
 * text, not a link. A run opens at its resume pointer's row on *In the middle of* (`#p-n`, task 1.6).
 */
export function rowHref(row: ProgressRow, tab: ProgressTab): string | null {
  const id = encodeURIComponent(row.id);
  switch (row.kind) {
    case "series": return `/books/series/${id}`;
    case "universe": return `/books/universes/${id}`;
    case "author": return `/books/authors/${id}`;
    case "shelf": return `/books/shelves/${id}`;
    case "run": return tab === "middle" && row.next?.ordinal != null ? `/comics/${id}#p-${row.next.ordinal}` : `/comics/${id}`;
    default: return null;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-03` as *finished Mar 2026*; null with no dated read. The month is already the Eastern one (TASK-104). */
export function finishedLabel(month: string | null): string | null {
  const match = month && /^(\d{4})-(\d{2})$/.exec(month);
  return match ? `finished ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : null;
}
