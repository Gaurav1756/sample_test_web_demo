import type { AnalyticsOverview } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";

/** Server-computed analytics overview (§12b). Bars are pure CSS, no chart lib. */
export function AnalyticsView({ overview }: { overview: AnalyticsOverview }) {
  const funnel = overview.funnel;
  const funnelMax = Math.max(1, funnel.views, funnel.saved, funnel.purchases, funnel.attendees);
  const bar = (value: number) => `${Math.max(2, Math.round((value / funnelMax) * 100))}%`;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Members" value={String(overview.members.total)} sub={`${signed(overview.members.deltaPct)}%`} />
        <Stat label="Events hosted" value={String(overview.eventsHosted)} />
        <Stat label="Tickets sold" value={String(overview.revenue.ticketsSold)} />
        <Stat label="Revenue" value={formatPaise(overview.revenue.total)} sub={`${signed(overview.revenue.deltaPct)}%`} />
      </div>

      <section aria-label="Funnel">
        <h3 className="font-display text-lg">Funnel</h3>
        <dl className="mt-2 flex flex-col gap-2">
          {(
            [
              ["Views", funnel.views],
              ["Saved", funnel.saved],
              ["Purchases", funnel.purchases],
              ["Attendees", funnel.attendees],
            ] as Array<[string, number]>
          ).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-sm">
              <dt className="text-stone-600">{label}</dt>
              <dd aria-hidden="true" className="h-3 overflow-hidden rounded bg-stone-100">
                <div className="h-full rounded bg-brand-600" style={{ width: bar(value) }} />
              </dd>
              <dd className="text-right font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section aria-label="Audience">
          <h3 className="font-display text-lg">Audience</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">New members</dt>
              <dd className="font-bold">{overview.audience.newMembers}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Returning</dt>
              <dd className="font-bold">{overview.audience.returningPct}%</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Avg events / attendee</dt>
              <dd className="font-bold">{overview.audience.avgEventsPerAttendee}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Top interests</dt>
              <dd className="font-bold">{overview.audience.topInterests.slice(0, 3).join(", ") || "—"}</dd>
            </div>
          </dl>
        </section>
        <section aria-label="Engagement">
          <h3 className="font-display text-lg">Engagement</h3>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Active</dt>
              <dd className="font-bold">{overview.engagement.activePct}%</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Posts</dt>
              <dd className="font-bold">{overview.engagement.posts}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Comments</dt>
              <dd className="font-bold">{overview.engagement.comments}</dd>
            </div>
            <div className="rounded-lg border border-stone-200 p-3">
              <dt className="text-stone-500">Discussions</dt>
              <dd className="font-bold">{overview.engagement.discussions}</dd>
            </div>
          </dl>
        </section>
      </div>

      {overview.insights.length > 0 ? (
        <section aria-label="Insights">
          <h3 className="font-display text-lg">Insights</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {overview.insights.map((insight, i) => (
              <li key={i} className="rounded-xl border border-accent-500 bg-accent-100 p-4">
                <p className="font-semibold">{insight.title}</p>
                <p className="mt-0.5 text-sm">{insight.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 font-display text-2xl">
        {value} {sub ? <span className="text-sm font-normal text-stone-500">{sub}</span> : null}
      </p>
    </div>
  );
}
