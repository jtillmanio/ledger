"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { coversServerSnapshot, coversSnapshot, subscribeCovers } from "@/lib/covers";

/**
 * The one component that may draw a cover's `<img>` (task 4.3, F-33). The server HTML is always the
 * `fallback` (the neutral placeholder, no `<img>`): the server can't see `prefers-reduced-data`. After
 * hydration the image replaces it only when *Show covers* is on and the device isn't asking for
 * reduced data, so with covers off, or data reduced, no image is ever requested (not hidden: absent).
 * An image that fails to load falls back to the placeholder too. `box`, when given, is the class of
 * the wrapper the image sits in (`cv rcv`); the placeholder keeps the same geometry, so none of the
 * states moves a row.
 */
export default function CoverImage({ url, width, height, className, box, fallback }: {
  url: string;
  width: number;
  height: number;
  className?: string;
  box?: string;
  fallback: ReactNode;
}) {
  const allowed = useSyncExternalStore(subscribeCovers, coversSnapshot, coversServerSnapshot);
  const [broken, setBroken] = useState<string | null>(null);
  if (!allowed || broken === url) return <>{fallback}</>;
  const img = (
    // A Hardcover, Open Library or Metron CDN thumbnail, drawn as it comes (D-94).
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={url} alt="" width={width} height={height} loading="lazy" decoding="async"
      onError={() => setBroken(url)} />
  );
  return box ? <span className={box}>{img}</span> : img;
}
