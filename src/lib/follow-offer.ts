import type { OfferChip, UndoEntry } from "@/components/Undo";
import type { FinishOffer, Grouping } from "@/db/queries";
import type { FollowKind, FollowState } from "@/db/writes";

/**
 * Following from the client (task 2.2c, D-108): the *Follow…* sheet's radios
 * and the finish toast's *Keep going?* chips write through here, and each
 * write's undo puts back the state the route answered, row or no row. The
 * books dashboard's *✓ finished* (2.2) carries the same offer.
 */

/** Sets a follow (`null`: *Not following*) and answers the state it had. Rejects when it didn't save. */
export async function postFollow(kind: FollowKind, id: string, state: FollowState | null): Promise<FollowState | null> {
  const res = await fetch("/api/follows", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, id, state }),
  });
  if (!res.ok) throw new Error("follow failed");
  return ((await res.json()) as { prior: FollowState | null }).prior;
}

const WORDS: Record<FollowState, string> = { reading: "Reading", tracking: "Tracking" };
const was = (s: FollowState | null) => (s ? `was ${s}` : "was not followed");

/**
 * A follow write's toast: *Reading Mistborn*, *series · was not followed*. Its Undo
 * puts `prior` back; `then` runs after either way, for a screen that shows the state.
 */
export function followEntry(
  g: Pick<Grouping, "kind" | "id" | "name">, state: FollowState | null, prior: FollowState | null,
  then?: (state: FollowState | null) => void,
): UndoEntry {
  return {
    label: state ? `${WORDS[state]} ${g.name}` : `Not following ${g.name}`,
    detail: `${g.kind} · ${was(prior)}`,
    undo: async () => {
      await postFollow(g.kind, g.id, prior);
      then?.(prior);
    },
  };
}

/** A universe and an author are named alone; a series and a shelf carry their kind (mockup `finishoffer`). */
const shownKind = (k: FollowKind) => (k === "series" || k === "shelf" ? k : undefined);

/**
 * A finish's offer as toast chips: *Done with <name>* first (it sets *Tracking*;
 * D-43, the app asks), then each grouping to set *Reading*. None, no chips.
 */
export function offerChips(offer: FinishOffer | null | undefined): OfferChip[] {
  if (!offer) return [];
  const chip = (g: Grouping, state: FollowState, label: string, kind?: string): OfferChip => ({
    label, kind,
    take: async () => followEntry(g, state, await postFollow(g.kind, g.id, state)),
  });
  return [
    ...offer.done.map((g) => chip(g, "tracking", `Done with ${g.name}`)),
    ...offer.take.map((g) => chip(g, "reading", g.name, shownKind(g.kind))),
  ];
}
