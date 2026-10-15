import type { Metadata } from "next";
import Link from "next/link";
import { getSessionUser, requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventCard, type LedgerTransaction, type Page } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EventRow } from "@/components/events/event-row";

export const metadata: Metadata = { title: "Host overview" };

/**
 * Host overview (Figma p15-p16): status counts, create banner, on-sale
 * events, recent sales. All sections degrade independently.
 */
export default async function HostOverviewPage() {
  await requireSession(["host", "super_admin"]);
  const user = await getSessionUser();

  let counts: Record<string, number | null> = { live: null, on_sale: null, draft: null, completed: null };
  let live: EventCard[] = [];
  let onSale: EventCard[] = [];
  let sales: LedgerTransaction[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const totalOf = async (status: string) => {
      try {
        const res = await api.get<Page<EventCard>>("hosts/me/events", {
          query: { status, limit: 1 },
        });
        return typeof res.total === "number" ? res.total : null;
      } catch {
        return null;
      }
    };
    const [cLive, cSale, cDraft, cDone, liveRes, saleRes, txRes] = await Promise.all([
      totalOf("live"),
      totalOf("on_sale"),
      totalOf("draft"),
      totalOf("completed"),
      api.get<Page<EventCard>>("hosts/me/events", { query: { status: "live", limit: 5 } }),
      api
        .get<unknown>("hosts/me/events", { query: { status: "on_sale", limit: 5 } })
        .catch(() => null),
      api
        .get<unknown>("hosts/me/transactions", { query: { type: "sale", limit: 5 } })
        .catch(() => null),
    ]);
    counts = { live: cLive, on_sale: cSale, draft: cDraft, completed: cDone };
    live = liveRes.data;
    onSale = saleRes ? toList<EventCard>(saleRes) : [];
    sales = txRes ? toList<LedgerTransaction>(txRes) : [];
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
        <h1 className="font-display text-3xl">Welcome{user ? `, ${user.name}` : ""}</h1>
        <div className="mt-6">
          <ErrorState title={failure.title} body={failure.body} />
        </div>
        <div className="mt-4 flex justify-center">
          <RefreshButton />
        </div>
      </main>
    );
  }

  const stats = [
    { label: "Live", value: counts.live, href: "/host/events?tab=live" },
    { label: "On sale", value: counts.on_sale, href: "/host/events?tab=upcoming" },
    { label: "Drafts", value: counts.draft, href: "/host/events?tab=drafts" },
    { label: "Completed", value: counts.completed, href: "/host/events?tab=completed" },
  ];

  return (
    <main className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Welcome{user ? `, ${user.name}` : ""}</h1>
        <p className="mt-1 text-stone-600">Here&apos;s what&apos;s happening with your events.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <dt className="text-sm font-medium text-stone-600">{s.label}</dt>
            <dd className="mt-1 font-display text-3xl font-bold">{s.value ?? "—"}</dd>
          </Link>
        ))}
      </dl>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] bg-brand-600 px-6 py-6 text-white shadow-lg shadow-brand-600/25 sm:px-8">
        <div>
          <p className="font-display text-xl font-bold">Create a new event</p>
          <p className="mt-1 text-sm text-brand-100">Set up tickets in a few minutes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/host/events/new/1"
            className="rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-900 hover:bg-brand-100"
          >
            + New event
          </Link>
          <Link
            href="/host/communities/new"
            className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
          >
            New community
          </Link>
        </div>
      </div>

      <section aria-label="Live events">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Live now</h2>
          <Link
            href="/host/events?tab=live"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            See all →
          </Link>
        </div>
        <div className="mt-4">
          {live.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {live.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </ul>
          ) : (
            <EmptyState title="No live events" body="Events you publish will appear here." />
          )}
        </div>
      </section>

      {onSale.length > 0 ? (
        <section aria-label="On sale">
          <div className="flex items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">On sale</h2>
            <Link
              href="/host/events?tab=upcoming"
              className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            >
              See all →
            </Link>
          </div>
          <ul className="mt-4 flex flex-col gap-3">
            {onSale.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Recent sales">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Recent sales</h2>
          <Link
            href="/host/finance"
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Finance →
          </Link>
        </div>
        <div className="mt-4">
          {sales.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {sales.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-sm"
                >
                  <div>
                    <p className="font-medium">{t.label}</p>
                    <p className="text-stone-500">{formatDateTime(t.createdAt)}</p>
                  </div>
                  <span className="font-bold text-brand-900">{formatPaise(t.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No sales yet" body="Ticket sales will appear here." />
          )}
        </div>
      </section>
    </main>
  );
}
