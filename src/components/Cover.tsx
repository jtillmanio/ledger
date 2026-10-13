/**
 * A row's cover (UX floor; STYLE_GUIDE § 9). Three states:
 *
 * - **metadata pending** (`data-enrich="pending"`): a record typed by hand or
 *   pasted, with no external record yet, so a dashed `--muted` outline. Its row
 *   also carries `<Pending />`. Backfill (4.1, 4.2) fills it in later (task 1.4c).
 * - a cover: the image as it comes, decorative beside the title (`alt=""`).
 * - no cover: the neutral placeholder.
 *
 * Real covers on every row, their sizes and the *Show covers* setting are 4.3's.
 */
export default function Cover({ url, pending }: { url: string | null; pending: boolean }) {
  if (pending) return <span className="cv" data-enrich="pending" aria-hidden="true" />;
  if (url) {
    // An Open Library or Metron CDN thumbnail, drawn as it comes.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="cv" src={url} alt="" width={40} height={60} loading="lazy" decoding="async" />;
  }
  return <span className="cv none" aria-hidden="true" />;
}

/** The italic line a pending row carries beside its dashed cover. */
export function Pending() {
  return <span className="enrich">metadata pending</span>;
}
