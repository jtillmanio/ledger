import CoverImage from "@/components/CoverImage";
import { issueName } from "@/lib/format";

/**
 * A cover for the surfaces that draw one at their own size (the Add search
 * results, the dashboards). Three states:
 *
 * - **metadata pending** (`data-enrich="pending"`): a record typed by hand or
 *   pasted, with no external record yet, so a dashed `--muted` outline. Its row
 *   also carries `<Pending />`. Backfill (4.1, 4.2) fills it in later (task 1.4c).
 * - a cover: the image as it comes, decorative beside the title (`alt=""`).
 * - no cover: the neutral placeholder.
 *
 * A spine row, a Library row and the next-issue strip draw `RowCover` instead.
 */
export default function Cover({ url, pending }: { url: string | null; pending: boolean }) {
  if (pending) return <span className="cv" data-enrich="pending" aria-hidden="true" />;
  const none = <span className="cv none" aria-hidden="true" />;
  if (!url) return none;
  // A Hardcover or Metron CDN thumbnail, drawn as it comes: by CoverImage, which draws
  // it only when Show covers is on and data isn't reduced (task 4.3). Otherwise the placeholder.
  return <CoverImage url={url} className="cv" width={40} height={60} fallback={none} />;
}

/**
 * The cover in a row (task 4.3; STYLE_GUIDE § 9 *Cover in a row*): a fixed box,
 * 28×42 and 20×30 in compact (`--cv-row-w` / `--cv-row-h`), the same box whether
 * a cover has arrived or not, so a cover arriving moves no row. With a url it
 * holds the image, decorative beside the row's label (`alt=""`); without one it
 * holds `text` in the neutral placeholder (the issue number, a book's initials);
 * pending keeps the dashed outline and carries the same text. The image is
 * hotlinked as it comes (D-94), never tinted and never glowing.
 */
export function RowCover({ url, pending = false, text }: { url: string | null; pending?: boolean; text: string }) {
  if (pending) {
    return <span className="cv rcv" data-enrich="pending" aria-hidden="true">{text}</span>;
  }
  const none = <span className="cv rcv none" aria-hidden="true">{text}</span>;
  if (!url) return none;
  return <CoverImage url={url} box="cv rcv" width={28} height={42} fallback={none} />;
}

/**
 * A cover on the dashboards (task 4.3; STYLE_GUIDE § 4.2, § 7): the hero, the shelf, the On deck and queue
 * rows. One 2:3 `.cv` box either way, sized by its slot's CSS (`--cover-hero`, `--cover-shelf`,
 * `--cover-row`), so a cover arriving moves nothing. With a url it holds the image, decorative beside the
 * title (`alt=""`), lazy, with `width` and `height` for `w` (its slot's width in px, so the browser
 * reserves the box before it loads); without one, the neutral placeholder. Hotlinked as it comes
 * (D-94), never tinted, never glowing.
 */
export function ArtCover({ url, w }: { url: string | null; w: number }) {
  const none = <span className="cv none" aria-hidden="true" />;
  if (!url) return none;
  return <CoverImage url={url} box="cv art" width={w} height={w * 1.5} fallback={none} />;
}

/** What stands in for a comic's cover: the issue number (`141`), else the label's first three letters. */
export function issueCoverText(label: string): string {
  const number = issueName(label, true);
  return number.startsWith("#") ? number.slice(1) : label.slice(0, 3).toUpperCase();
}

/** What stands in for a book's cover: the first letters of its words, a leading The, A or An dropped, at most three. */
export function bookInitials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  const rest = words.length > 1 && /^(the|an?)$/i.test(words[0]) ? words.slice(1) : words;
  return rest.slice(0, 3).map((w) => [...w][0]).join("").toUpperCase();
}

/** The italic line a pending row carries beside its dashed cover. */
export function Pending() {
  return <span className="enrich">metadata pending</span>;
}
