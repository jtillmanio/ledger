import Link from "next/link";

/**
 * The dashboard's `.actionbar`: the same place, with one verb that already
 * exists. Until 1.8b builds the thumb bar (mark, batch, the issue named) it
 * holds Resume or Pick a run on comics and Save to inbox on watch (owner,
 * 2026-10-19). 1.8b replaces the contents, not the element.
 */
export default function DashboardBar({ verb }: { verb: { label: string; href: string } }) {
  return (
    <div className="actionbar dash">
      <Link href={verb.href} className="btn">{verb.label}</Link>
    </div>
  );
}
