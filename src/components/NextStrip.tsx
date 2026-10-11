import { issueName } from "@/lib/format";

/**
 * The next-issue strip in the spine hero (task 1.6, STYLE_GUIDE §9): a tonal
 * --raise well holding the next placement's cover, the kicker *Next · n / N*,
 * its full label and its placement note. It is one link, named the way a screen
 * reader should hear the row, and it carries no blue: the only --brand in the
 * hero is *Resume*. Until the issue sheet exists (3.5) it links to the row.
 *
 * No state: RunSpine renders it from its rows, so it moves with every mark.
 */
export default function NextStrip({ label, notes, ordinal, total, href }: {
  label: string; notes: string | null; ordinal: number; total: number; href: string;
}) {
  const name = [`Next: ${ordinal} of ${total}`, label, notes].filter(Boolean).join(", ");
  // Real covers arrive with 4.3; until then the issue number stands in.
  const number = issueName(label, true);
  const cover = number.startsWith("#") ? number.slice(1) : label.slice(0, 3).toUpperCase();
  return (
    <a className="nextis" href={href} aria-label={name}>
      <span className="cv" aria-hidden="true">{cover}</span>
      <span className="nb">
        <span className="nk mono">{`Next · ${ordinal} / ${total}`}</span>
        <span className="lbl">{label}</span>
        {notes && <span className="inote">{notes}</span>}
      </span>
    </a>
  );
}
