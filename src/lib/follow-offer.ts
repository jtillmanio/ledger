import type { OfferChip, UndoEntry } from "@/components/Undo";
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
 * A finish's offer as toast chips (task 2.2c; 2.2h). *Now reading* first: one
 * chip per thing the finish followed for you, each turning that one to *Not
 * following* (`off`), its undo putting *Reading* back. Then *Keep going?*:
 * *Done with <name>* (it sets *Tracking*; D-43, the app asks), then each grouping
 * to set *Reading*. None, no chips.
 */
export function offerChips(offer: FinishOffer | null | undefined): OfferChip[] {
  if (!offer) return [];
  const chip = (g: Grouping, state: FollowValue, label: string, kind?: string, row?: "now"): OfferChip => ({
    label, kind, row,
    take: async () => followEntry(g, state, await postFollow(g.kind, g.id, state)),
  });
  return [
    ...(offer.now ?? []).map((g) => chip(g, "off", g.name, shownKind(g.kind), "now")),
    ...offer.done.map((g) => chip(g, "tracking", `Done with ${g.name}`)),
    ...offer.take.map((g) => chip(g, "reading", g.name, shownKind(g.kind))),
  ];
}
