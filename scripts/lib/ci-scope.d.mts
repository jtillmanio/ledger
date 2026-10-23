export function needsBrowserAndBuild(files: string[]): boolean;
export const FULL_E2E_LABEL: string;
export function e2eScope(
  eventName: string | undefined,
  payload: { pull_request?: { draft?: boolean; labels?: { name: string }[] } } | null | undefined,
): "core" | "full";
