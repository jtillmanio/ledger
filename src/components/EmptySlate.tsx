import Link from "next/link";

/**
 * An empty tab (task 1.9; STYLE_GUIDE §9 *Empty slate*, design §14): a `--raise`
 * panel with a title, the reason, and exactly one primary action, never a bare
 * "nothing here". The action is a link, or a sheet's opener passed as `action`.
 */
export default function EmptySlate({ title, children, href, label, action }: {
  title: string; children: React.ReactNode;
} & ({ href: string; label: string; action?: never } | { action: React.ReactNode; href?: never; label?: never })) {
  return (
    <div className="slate">
      <b>{title}</b>
      <p>{children}</p>
      {href !== undefined
        ? <Link prefetch={false} href={href} className="btn sm">{label}</Link>
        : action}
    </div>
  );
}
