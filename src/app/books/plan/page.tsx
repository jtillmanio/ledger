import Link from "next/link";
import PlanQuarterRows from "@/components/PlanQuarterRows";
import PlanRail from "@/components/PlanRail";
import { planCapacity, planRail, planRows, readingSettings } from "@/db/queries";
import { requireUserId } from "@/lib/auth";
import { today } from "@/lib/finish-date";
import { kWords, planYear, roomAhead } from "@/lib/plan-rail";

export const dynamic = "force-dynamic";

/**
 * Plan (task 2.10, F-23; mockup `plan`, STYLE_GUIDE §14 → Plan): the year as the full-size rail, every
 * book a legible block in its quarter, the quarter in focus listed with **Move** on each row, and one
 * honest line about the room left. The rail and the dashboard's strip read the same query
 * (`plan_capacity` through `planCapacity`), so their totals agree. This year by default, `?year=` for
 * the next four (the picker's five). The focus starts on this quarter, and on Q1 in a later year.
 */
export default async function Plan({ searchParams }: { searchParams: Promise<{ year?: string | string[] }> }) {
  const userId = await requireUserId();
  const day = today();
  const thisYear = Number(day.slice(0, 4));
  const year = planYear((await searchParams).year, day);

  // One wave (architecture § Operational posture): none of the reads waits on another. Your pace starts
  // with them, so a year nothing is planned in (its capacity at your settings) costs no second round trip.
  const pace = readingSettings(userId);
  const [capacity, books, rows] = await Promise.all([
    planCapacity(userId, year, pace),
    planRail(userId, year),
    planRows(userId, year),
    pace,
  ]);

  const focus = year === thisYear ? Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1 : 1;
  const room = roomAhead(capacity.quarters, year, day);
  const { year: total } = capacity;

  return (
    <main className="plan-page">
      <h1>Plan</h1>
      <p className="muted small mono plan-total">
        {total.books === 0 ? `${year}: nothing planned` : `${total.books} ${total.books === 1 ? "book" : "books"} · ${kWords(total.plannedWords)} of ${kWords(total.capacity)}`}
      </p>
      {/* A query-string chip is not prefetched, as the Library's are: a tap re-renders this same route. */}
      <nav className="filters" aria-label="Year">
        {Array.from({ length: 5 }, (_, i) => thisYear + i).map((y) => (
          <Link key={y} prefetch={false} href={y === thisYear ? "/books/plan" : `/books/plan?year=${y}`} className="chip"
            aria-current={y === year}>{y}</Link>
        ))}
      </nav>

      <PlanRail year={year} books={books} quarters={capacity.quarters} />
      <PlanQuarterRows key={year} quarters={capacity.quarters} rows={rows} focus={focus} room={room?.text ?? null} />
    </main>
  );
}
