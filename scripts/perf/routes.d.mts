export interface PerfRoute {
  id: string;
  path: string;
  signedIn: boolean;
  tap: { from: string; selector?: string; login?: boolean; paints?: string };
  resolve?: { from: string; selector: string };
}
export const ROUTES: PerfRoute[];
