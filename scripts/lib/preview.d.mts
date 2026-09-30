type Env = Record<string, string | undefined>;
export function endpointId(urlOrHost: string | undefined): string | null;
export function previewDbProblem(env: Env): string | null;
export function buildSteps(env: Env): ("migrate" | "views" | "next build")[];
