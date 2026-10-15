import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type CommunityReport,
  type FlaggedHost,
  type Page,
  type ReviewQueueItem,
} from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";

export const metadata: Metadata = { title: "Admin overview" };

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

/** Super Admin dashboard: queues, platform health, recent items (layout gates role). */
export default async function AdminOverviewPage() {
  let review: Page<ReviewQueueItem> | null = null;
  let flagged: FlaggedHost[] = [];
  let reports: CommunityReport[] = [];
  let platform: PlatformOverview | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [reviewRes, flaggedRes, reportRes, platformRes] = await Promise.all([
      api.get<Page<ReviewQueueItem>>("admin/events/review-queue", { query: { limit: 5 } }),
      api.get<unknown>("admin/hosts/flagged").catch(() => [] as unknown),
      api.get<unknown>("admin/reports", { query: { status: "open", limit: 5 } }).catch(() => [] as unknown),
      api.get<PlatformOverview>("admin/overview").catch(() => null),
    ]);
    review = reviewRes;
    flagged = toList<FlaggedHost>(flaggedRes);
    reports = toList<CommunityReport>(reportRes);
    platform = platformRes;
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
        <h1 className="font-display text-3xl">Overview</h1>
        <div className="mt-6">
          <ErrorState title={failure.title} body={failure.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </div>
      </main>
    );
  }

  const cards = [
    {
      title: "Review queue",
      count: review?.total ?? review?.data.length ?? 0,
      href: "/admin/review",
      body: "Events awaiting approval.",
    },
    {
      title: "Flagged hosts",
      count: flagged.length,
      href: "/admin/hosts",
      body: "Hosts with ≥3 cancellations or violations.",
    },
    {
      title: "Open reports",
      count: reports.length,
      href: "/admin/moderation",
      body: "Platform moderation queue.",
    },
  ];

  return (
    <main>
      <h1 className="font-display text-3xl">Overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-xl border border-stone-200 p-5 hover:border-brand-400"
          >
            <p className="font-display text-4xl text-brand-900">{card.count}</p>
            <p className="mt-1 font-semibold">{card.title}</p>
            <p className="mt-0.5 text-sm text-stone-600">{card.body}</p>
          </Link>
        ))}
      </div>
      {platform ? (
        <div className="mt-8">
          <h2 className="font-display text-xl">Platform health</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Users</dt>
              <dd className="mt-1 font-display text-4xl text-brand-900">{platform.users.total}</dd>
              <dd className="mt-1 text-sm text-stone-600">
                {platform.users.byRole.host ?? 0} hosts · {platform.users.byRole.user ?? 0} attendees ·{" "}
                {platform.users.byRole.event_staff ?? 0} staff
              </dd>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Events live now</dt>
              <dd className="mt-1 font-display text-4xl text-brand-900">
                {(platform.events.byStatus.live ?? 0) + (platform.events.byStatus.on_sale ?? 0)}
              </dd>
              <dd className="mt-1 text-sm text-stone-600">{platform.events.total} total events</dd>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Tickets sold</dt>
              <dd className="mt-1 font-display text-4xl text-brand-900">{platform.tickets.sold}</dd>
              <dd className="mt-1 text-sm text-stone-600">{platform.tickets.checkedIn} checked in</dd>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Booking revenue</dt>
              <dd className="mt-1 font-display text-2xl text-brand-900">{formatPaise(platform.revenuePaise)}</dd>
              <dd className="mt-1 text-sm text-stone-600">Confirmed orders, incl. GST</dd>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Pending payouts</dt>
              <dd className="mt-1 font-display text-4xl text-brand-900">{platform.pendingPayouts}</dd>
              <dd className="mt-1 text-sm text-stone-600">
                <Link href="/admin/payouts" className="font-semibold text-brand-800 hover:underline">
                  Review payouts →
                </Link>
              </dd>
            </div>
            <div className="rounded-xl border border-stone-200 p-5">
              <dt className="font-semibold">Attention needed</dt>
              <dd className="mt-1 font-display text-4xl text-brand-900">
                {platform.openReports + platform.flaggedHosts}
              </dd>
              <dd className="mt-1 text-sm text-stone-600">
                {platform.openReports} open reports · {platform.flaggedHosts} flagged hosts
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <div className="mt-8">
        <h2 className="font-display text-xl">Awaiting review</h2>
        {review && review.data.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {review.data.map((event) => (
              <li key={event.id}>
                <Link
                  href={`/admin/review?highlight=${event.id}`}
                  className="block rounded-xl border border-stone-200 p-4 font-medium hover:border-brand-400"
                >
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-500">Queue is clear.</p>
        )}
      </div>
    </main>
  );
}
