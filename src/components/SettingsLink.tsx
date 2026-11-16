import Link from "next/link";

/**
 * A Settings row that opens another settings page (task 4.4: *Calibre*): the name over one grey line,
 * and a chevron. A component of its own so `src/app/settings/page.tsx` stays free of `next/link`:
 * its *Export everything* is a plain `<a>`, since a prefetch of a route handler builds the export
 * (task 0.9), and the page is checked for that. This row's target is a page, so it prefetches nothing.
 */
export default function SettingsLink({ href, name, sub }: { href: string; name: string; sub: string }) {
  return (
    <Link href={href} prefetch={false} className="frow set-link">
      <span className="kv">
        <span className="k">{name}</span>
        <span className="small faint">{sub}</span>
      </span>
      <span className="set-chev" aria-hidden="true">›</span>
    </Link>
  );
}
