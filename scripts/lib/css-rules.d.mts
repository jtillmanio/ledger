export interface CssRule {
  selectors: string[];
  decls: Record<string, string>;
  media: string[];
  keyframes?: boolean;
  body?: string;
}
export function splitTop(text: string, sep: string): string[];
export function parseDecls(body: string): Record<string, string>;
export function parseCss(css: string): CssRule[];
export function styleBlocks(html: string): string;
export function compounds(selector: string): string[];
