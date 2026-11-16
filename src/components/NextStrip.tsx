import { issueCoverText, RowCover } from "@/components/Cover";

/**
 * The next-issue strip in the spine hero (task 1.6, STYLE_GUIDE §9): a tonal
 * --raise well holding the next placement's cover, the kicker *Next · n / N*,
 * its full label and its placement note. It is one link, named the way a screen
 * reader should hear the row, and it carries no blue: the only --brand in the
 * hero is *Resume*. Until the issue sheet exists (3.5) it links to the row.
 *
 * The cover is the spine row's (task 4.3): the same box, the real image when the
 * issue has one, its number when it has none.
 *
 * No state: RunSpine renders it from its rows, so it moves with every mark.
 */
export default function NextStrip({ label, notes, ordinal, total, href, cover, pending = false }: {
  label: string; notes: string | null; ordinal: number; total: number; href: string;
  cover: string | null; pending?: boolean;
}) {
  const name = [`Next: ${ordinal} of ${total}`, label, notes].filter(Boolean).join(", ");
  return (
    <a className="nextis" href={href} aria-label={name}>
      <RowCover url={cover} pending={pending} text={issueCoverText(label)} />
      <span className="nb">
        <span className="nk mono">{`Next · ${ordinal} / ${total}`}</span>
        <span className="lbl">{label}</span>
        {notes && <span className="inote">{notes}</span>}
      </span>
    </a>
  );
}
