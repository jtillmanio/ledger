import type { FollowChip, UndoEntry } from "@/components/Undo";
import type { FinishOffer, Grouping } from "@/db/queries";
import type { FollowKind, FollowState, FollowValue } from "@/db/writes";

/**
 * Following from the client (task 2.2c, D-108; 2.2h, D-117): the *Follow…*
 * sheet's radios and the finish toast's chips write through here, and each
 * write's undo puts back the state the route answered, row or no row. The
 * books dashboard's *✓ finished* (2.2) carries the same offer.
 */

/** What a finish follows for you (D-117), so its *Not following* is a stored `off`. Mirrors `AUTO_KINDS`. */
const AUTO: readonly FollowKind[] = ["series", "subseries", "universe"];

/** *Not following* as stored for `kind`: `off` where a finish follows for you, so none does again;
 * no row (`null`) for an author or a shelf. */
export const notFollowing = (kind: FollowKind): FollowValue | null => (AUTO.includes(kind) ? "off" : null);

/** Sets a follow (`null` deletes its row) and answers the state it had. Rejects when it didn't save. */
export async function postFollow(kind: FollowKind, id: string, state: FollowValue | null): Promise<FollowValue | null> {
  const res = await fetch("/api/follows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, id, state }),
  });
  if (!res.ok) throw new Error("follow failed");
  return ((await res.json()) as { prior: FollowValue | null }).prior;
}

const WORDS: Record<FollowState, string> = { reading: "Reading", tracking: "Tracking" };
/** `off` and no row are both *Not following* to you. */
const was = (s: FollowValue | null) => (s && s !== "off" ? `was ${s}` : "was not followed");

/** How the sheet shows a stored follow: `off` is *Not following*, as no row is (`null`). */
export const shown = (s: FollowValue | null): FollowState | null => (s === "off" ? null : s);

/**
 * A follow write's toast: *Reading Mistborn*, *series · was not followed*. Its Undo
 * puts `prior` back; `then` runs after either way, for a screen that shows the state.
 */
export function followEntry(
  g: Pick<Grouping, "kind" | "id" | "name">, state: FollowValue | null, prior: FollowValue | null,
  then?: (state: FollowState | null) => void,
): UndoEntry {
  const to = shown(state);
  return {
    label: to ? `${WORDS[to]} ${g.name}` : `Not following ${g.name}`,
    detail: `${g.kind} · ${was(prior)}`,
    undo: async () => {
      await postFollow(g.kind, g.id, prior);
      then?.(shown(prior));
    },
  };
}

/** A universe and an author are named alone; a series, a subseries and a shelf carry their kind (mockup `finishoffer`). */
const shownKind = (k: FollowKind) => (k === "series" || k === "subseries" || k === "shelf" ? k : undefined);

/**
 * A finish's offer as chips (task 2.2c; 2.2h). *Now reading* first: one chip
 * per thing the finish followed for you, each turning that one to *Not
 * following* (`off`), its undo putting *Reading* back. Then *Keep going?*:
 * *Done with <name>* (it sets *Tracking*; D-43, the app asks), then each grouping
 * to set *Reading*. None, no chips. Each names its grouping (`of`), and its
 * take shows the state it wrote, and its undo the state put back (the sheet's row).
 */
export function offerChips(offer: FinishOffer | null | undefined): FollowChip[] {
  if (!offer) return [];
  const chip = (g: Grouping, state: FollowValue, label: string, kind?: string, row?: "now"): FollowChip => ({
    label, kind, row, of: { kind: g.kind, id: g.id },
    take: async (show) => {
      const prior = await postFollow(g.kind, g.id, state);
      show?.(shown(state));
      return followEntry(g, state, prior, show);
    },
  });
  return [
    ...(offer.now ?? []).map((g) => chip(g, "off", g.name, shownKind(g.kind), "now")),
    ...offer.done.map((g) => chip(g, "tracking", `Done with ${g.name}`)),
    ...offer.take.map((g) => chip(g, "reading", g.name, shownKind(g.kind))),
  ];
}

/** Narrowest first: what the toast keeps of what a finish followed (6.24; E10's note). */
const NARROW: readonly string[] = ["subseries", "series", "universe"];
const narrowness = (c: FollowChip) => {
  const at = NARROW.indexOf(c.of?.kind ?? "");
  return at < 0 ? NARROW.length : at;
};

/**
 * The finish toast's share of its follow chips, and the *Follow…* sheet's (task 6.24, MR-D17,
 * frame E10): the toast keeps one *Now reading* chip, the narrowest thing the finish followed
 * (a subseries, else the series, else the universe); the sheet holds the rest, the other
 * follows first and then every *Keep going?* offer, in their order. `hidden.length` is the
 * toast's *+N*.
 */
export function toastShare(chips: FollowChip[]): { kept: FollowChip | null; hidden: FollowChip[] } {
  const now = chips.filter((c) => c.row === "now");
  const kept = now.reduce<FollowChip | null>((best, c) => (!best || narrowness(c) < narrowness(best) ? c : best), null);
  return {
    kept,
    hidden: [...now.filter((c) => c !== kept), ...chips.filter((c) => c.row !== "now")],
  };
}
