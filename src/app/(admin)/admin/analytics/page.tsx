import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventDetail, type Page, type Payout } from "@/lib/api-types";
import {
  countPayoutsByStatus,
  countRecordByStatus,
  topEventsBySales,
} from "@/lib/admin-analytics";
import { formatDateTime, formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Analytics" };

/** Platform rollup. Shape is local: the backend has not specified it. */
interface PlatformOverview {
  users: { total: number; byRole: Record<string, number> };
  events: { total: number; byStatus: Record<string, number> };
  tickets: { sold: number; checkedIn: number };
  revenuePaise: number;
  pendingPayouts: number;
  openReports: number;
  flaggedHosts: number;
}

const EVENT_SAMPLE_LIMIT = 50;

/** Platform analytics, derived from endpoints the admin portal already uses (layout gates role). */
export default async function AdminAnalyticsPage() {
  let platform: PlatformOverview | null = null;
  let events: EventDetail[] = [];
  let payouts: Payout[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [platformRes, eventRes, payoutRes] = await Promise.all([
      api.get<PlatformOverview>("admin/overview").catch(() => null),
      api
        .get<Page<EventDetail>>("admin/events", { query: { page: 1, limit: EVENT_SAMPLE_LIMIT } })
        .catch(() => null),
      api
        .get<unknown>("admin/payouts", { query: { page: 1, limit: EVENT_SAMPLE_LIMIT } })
        .catch(() => [] as unknown),
    ]);
    platform = platformRes;
    events = eventRes?.data ?? [];
    payouts = toList<Payout>(payoutRes);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  if (failure) {
    return (
      <main>
        <h1 className="font-display text-3xl">Analytics</h1>
        <div className="mt-6">
          <ErrorState title={failure.title} body={failure.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </div>
      </main>
    );
  }

  const statusRows = platform ? countRecordByStatus(platform.events.byStatus) : [];
  const statusMax = Math.max(1, ...statusRows.map((row) => row.count));
  const topEvents = topEventsBySales(events);
  const payoutRows = countPayoutsByStatus(payouts);

  return (
    <main>
      <h1 className="font-display text-3xl">Analytics</h1>
      <p className="mt-1 text-sm text-stone-600">
        Platform-wide totals and top events. Status totals come from the platform overview;
        top events rank the latest {EVENT_SAMPLE_LIMIT} events.
      </p>

      {platform ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Users</p>
            <p className="mt-1 font-display text-4xl text-brand-900">{platform.users.total}</p>
            <p className="mt-1 text-sm text-stone-600">
              {platform.users.byRole.host ?? 0} hosts · {platform.users.byRole.user ?? 0} attendees ·{" "}
              {platform.users.byRole.event_staff ?? 0} staff
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Events</p>
            <p className="mt-1 font-display text-4xl text-brand-900">{platform.events.total}</p>
            <p className="mt-1 text-sm text-stone-600">
              {(platform.events.byStatus.live ?? 0) + (platform.events.byStatus.on_sale ?? 0)} live
              or on sale
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Tickets sold</p>
            <p className="mt-1 font-display text-4xl text-brand-900">{platform.tickets.sold}</p>
            <p className="mt-1 text-sm text-stone-600">{platform.tickets.checkedIn} checked in</p>
          </div>
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Booking revenue</p>
            <p className="mt-1 font-display text-2xl text-brand-900">
              {formatPaise(platform.revenuePaise)}
            </p>
            <p className="mt-1 text-sm text-stone-600">Confirmed orders, incl. GST</p>
          </div>
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Pending payouts</p>
            <p className="mt-1 font-display text-4xl text-brand-900">{platform.pendingPayouts}</p>
            <p className="mt-1 text-sm text-stone-600">
              <Link href="/admin/payouts" className="font-semibold text-brand-800 hover:underline">
                Review payouts →
              </Link>
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="font-semibold">Attention needed</p>
            <p className="mt-1 font-display text-4xl text-brand-900">
              {platform.openReports + platform.flaggedHosts}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {platform.openReports} open reports · {platform.flaggedHosts} flagged hosts
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm text-stone-500">
          Platform totals are unavailable — the overview endpoint did not respond.
        </p>
      )}

      <section aria-label="Events by status" className="mt-8">
        <h2 className="font-display text-xl">Events by status</h2>
        <div className="mt-3">
          {statusRows.length > 0 ? (
            <dl className="flex flex-col gap-2">
              {statusRows.map((row) => (
                <div
                  key={row.status}
                  className="grid grid-cols-[110px_1fr_64px] items-center gap-2 text-sm"
                >
                  <dt className="text-stone-600">{row.status}</dt>
                  <dd aria-hidden="true" className="h-3 overflow-hidden rounded bg-stone-100">
                    <div
                      className="h-full rounded bg-brand-600"
                      style={{ width: `${Math.max(2, Math.round((row.count / statusMax) * 100))}%` }}
                    />
                  </dd>
                  <dd className="text-right font-bold">{row.count}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-stone-500">No status data for this range.</p>
          )}
        </div>
      </section>

      <section aria-label="Top events" className="mt-8">
        <h2 className="font-display text-xl">Top events by tickets sold</h2>
        <div className="mt-3">
          {topEvents.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {topEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 hover:border-brand-400"
                  >
                    <span>
                      <span className="font-semibold">{event.title}</span>
                      <span className="mt-0.5 block text-sm text-stone-500">
                        {[event.city, formatDateTime(event.startAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-stone-500">{event.soldCount} sold</span>
                      <StatusBadge status={event.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No event data for this range.</p>
          )}
        </div>
      </section>

      <section aria-label="Payouts by status" className="mt-8">
        <h2 className="font-display text-xl">Payouts by status</h2>
        <div className="mt-3">
          {payoutRows.length > 0 ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {payoutRows.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3"
                >
                  <dt className="text-stone-600">{row.status}</dt>
                  <dd className="font-bold">{row.count}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-stone-500">No payout data for this range.</p>
          )}
        </div>
      </section>
    </main>
  );
}
