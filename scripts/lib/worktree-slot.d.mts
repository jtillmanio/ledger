export const FIRST_SLOT: number;
export const LAST_SLOT: number;
export type Slot = { n: number; db: string; url: string; port: number };
export function slotFor(baseUrl: string, n: number): Slot;
export function envValue(text: string | undefined, key: string): string | undefined;
export function claimSlot(args: { mainEnv: string; otherClaims: string[]; existing: string[] }):
  | { slot: Slot; text: string; error?: undefined }
  | { error: string; slot?: undefined; text?: undefined };
export function renderClaim(slot: Slot): string;
