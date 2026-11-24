import { issueCoverText, Pending } from "@/components/Cover";
import CoverImage from "@/components/CoverImage";
import { IssueRecord, MoreCredits } from "@/components/IssueRecord";
import { SheetHeading } from "@/components/RouteSheet";
import { Bar } from "@/components/Skeleton";
import type { IssueCredit, IssueDetail as Issue } from "@/db/queries";
import { readWhen } from "@/lib/format";

type Role = IssueCredit["role"];

/** A role's names in the order the query gave them (by name), joined: *Chris Claremont, John Byrne*. */
function names(credits: IssueCredit[], role: Role): string | null {
  const of = credits.filter((c) => c.role === role).map((c) => c.name);
  return of.length > 0 ? of.join(", ") : null;
}

/**
 * The credits the sheet shows (the roadmap's 3.5; mockup `issuedetail`): what you choose a comic by.
 * Writer and Penciller (role `artist`), Inker only when the issue has one, and Cover only when its
 * artists aren't the penciller's; Colorist and Letterer go under *More credits*. All six roles stay
 * in `issue_credits`; only the sheet is selective.
 */
export function selectCredits(credits: IssueCredit[]) {
  const penciller = names(credits, "artist");
  const cover = names(credits, "cover");
  const shown: [string, string | null][] = [
    ["Writer", names(credits, "writer")],
    ["Penciller", penciller],
    ["Inker", names(credits, "inker")],
    ["Cover", cover !== penciller ? cover : null],
  ];
  const more: [string, string | null][] = [["Colorist", names(credits, "colorist")], ["Letterer", names(credits, "letterer")]];
  const known = (rows: [string, string | null][]) => rows.filter((r): r is [string, string] => r[1] !== null);
  return { shown: known(shown), more: known(more) };
}

/**
 * The *Dates* group (spine v2): the cover date in `Mon YYYY`, and the on-sale date only when it falls
 * in another month (a same-month date would read the same twice). Both are catalogue facts, grey.
 * An issue with neither has no group at all, never a `—`.
 */
export function issueDates(i: Pick<Issue, "cover_date" | "store_date">): [string, string][] {
  const cover = readWhen(i.cover_date, "exact");
  const published = readWhen(i.store_date, "exact");
  const rows: [string, string][] = [];
  if (cover) rows.push(["Cover date", cover]);
  if (published && published !== cover) rows.push(["Published", published]);
  return rows;
}

function Fact({ k, v, muted = false }: { k: string; v: string; muted?: boolean }) {
  return <div className="frow"><span className="k">{k}</span><span className={muted ? "v mono muted" : "v"}>{v}</span></div>;
}

/**
 * An issue's detail while it loads (UX floor, STYLE_GUIDE § 9): the hero's cover box and lines, then
 * *Dates*, *Credits* and *Your record* at their loaded places, in `--sunk`. Its heading says *Loading
 * issue* to a screen reader, and in a sheet takes focus until the issue's arrives.
 */
export function IssueDetailSkeleton({ as }: { as: "sheet" | "page" }) {
  const H = as === "sheet" ? "h3" : "h2";
  const rows = (n: number) => Array.from({ length: n }, (_, i) => (
    <div key={i} className="frow"><Bar w="4.5rem" className="sk-sub" /><Bar w={`${40 + ((i * 17) % 30)}%`} className="sk-sub" /></div>
  ));
  return (
    <div className="detail" data-detail={as} aria-busy="true">
      <div className="detail-hero">
        <span className="detail-cover cv sk" aria-hidden="true" />
        <div className="detail-meta">
          <SheetHeading className="detail-title"><span className="sr-only">Loading issue</span><Bar w="70%" className="sk-title" /></SheetHeading>
          <Bar w="55%" className="sk-sub" />
          <Bar w="40%" className="sk-sub" />
        </div>
      </div>
      <H className="s">Dates</H>
      <div className="group" aria-hidden="true">{rows(1)}</div>
      <H className="s">Credits</H>
      <div className="group" aria-hidden="true">{rows(3)}</div>
      <H className="s">Your record</H>
      <div className="group" aria-hidden="true">{rows(2)}</div>
    </div>
  );
}

/**
 * An issue's detail (task 3.5, F-29; docs/04-design.md § 13, mockup
 * `issuedetail`): drawn in the route sheet over a run's spine (`as="sheet"`,
 * under its `h2`) and as the full page on a direct load (`as="page"`, under an
 * `h1`), from `/comics/[runId]/issue/[issueId]`.
 *
 * - **The hero**: the cover, the label, the story title and the cover date, a
 *   tag per story arc and how many runs place it.
 * - **Dates** (`issueDates`) and **Credits** (`selectCredits`); a fact the
 *   issue doesn't have is left out, never a `—`.
 * - **Your record** (`IssueRecord`): every run that places it, its position and
 *   its read state there, each with its own toggle. Read state is the
 *   placement's (data model 2.14), so there is no *mark all*.
 *
 * *Collected in* waits for `edition_issues` (5.6): nothing says which editions
 * collect an issue yet, so the section isn't drawn.
 */
export default function IssueDetail({ issue: i, as }: { issue: Issue; as: "sheet" | "page" }) {
  const H = as === "sheet" ? "h3" : "h2";
  const cover = readWhen(i.cover_date, "exact");
  const dates = issueDates(i);
  const credits = selectCredits(i.credits);
  const arcs = (i.story_arc ?? "").split(";").map((a) => a.trim()).filter(Boolean);
  const by = [i.story_title, cover].filter(Boolean).join(" · ");
  const text = <span className="detail-initials">{issueCoverText(i.label)}</span>;
  const placeholder = (
    <span className="detail-cover cv" aria-hidden="true" data-enrich={i.pending ? "pending" : undefined}>{text}</span>
  );

  return (
    <div className="detail" data-detail={as}>
      <div className="detail-hero">
        {i.cover_url && !i.pending
          ? <CoverImage url={i.cover_url} box="detail-cover cv" width={112} height={168} fallback={placeholder} />
          : placeholder}
        <div className="detail-meta">
          <SheetHeading className="detail-title">{i.label}</SheetHeading>
          {by && <p className="detail-by">{by}</p>}
          {i.pending && <p className="detail-place"><Pending /></p>}
          <p className="detail-tags">
            {arcs.map((a) => <span key={a} className="tag">{`arc · ${a}`}</span>)}
            <span className="tag">{`in ${i.placements.length} ${i.placements.length === 1 ? "run" : "runs"}`}</span>
          </p>
        </div>
      </div>

      {dates.length > 0 && (
        <>
          <H className="s">Dates</H>
          <div className="group issue-dates">{dates.map(([k, v]) => <Fact key={k} k={k} v={v} muted />)}</div>
        </>
      )}

      {credits.shown.length + credits.more.length > 0 && (
        <>
          <H className="s">Credits</H>
          {credits.shown.length > 0 && (
            <div className="group issue-credits">{credits.shown.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</div>
          )}
          {credits.more.length > 0 && (
            <MoreCredits>{credits.more.map(([k, v]) => <Fact key={k} k={k} v={v} />)}</MoreCredits>
          )}
        </>
      )}

      <IssueRecord heading={H} label={i.label} placements={i.placements} />
    </div>
  );
}
