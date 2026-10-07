export interface PerfRoute {
  id: string;
  path: string;
  signedIn: boolean;
  tap: { from: string; selector?: string; login?: boolean };
}
export const ROUTES: PerfRoute[];
