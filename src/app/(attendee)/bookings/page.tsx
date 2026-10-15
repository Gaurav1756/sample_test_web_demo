import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Order, type Ticket } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "My bookings" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Orders + tickets. Order list items are assumed to be Order objects
 * (CQ-24); ticket tabs use the documented status filter (§3).
 */
export default async function BookingsPage({ searchParams }: Props) {
  await requireSession();
  const tab = first((await searchParams)?.tab);
  const ticketStatus = ["active", "used", "expired"].includes(tab) ? tab : "active";

  let orders: Order[] = [];
  let tickets: Ticket[] = [];
  let cancelledEvents = new Set<string>();
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [orderRes, ticketRes] = await Promise.all([
      api.get<unknown>("users/me/orders"),
      api.get<unknown>("users/me/tickets", { query: { status: ticketStatus } }),
    ]);
    orders = toList<Order>(orderRes);
    tickets = toList<Ticket>(ticketRes);
    // Cancelled-event notices: best-effort status lookup per unique event.
    const eventIds = [
      ...new Set([...orders.map((o) => o.eventId), ...tickets.map((t) => t.event.id)]),
    ].slice(0, 20);
    const statuses = await Promise.all(
      eventIds.map((eventId) =>
        api
          .get<{ status?: string }>(`events/${eventId}`)
          .then((e) => ({ eventId, status: e.status }))
          .catch(() => null),
      ),
    );
    cancelledEvents = new Set(
      statuses.filter((s) => s?.status === "cancelled").map((s) => (s as { eventId: string }).eventId),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">My bookings</h1>
      {!failure && cancelledEvents.size > 0 ? (
        <p role="alert" className="mt-4 rounded-xl bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-900">
          An event you booked was cancelled by the host. Eligible refunds are issued
          automatically per the event&apos;s refund policy.
        </p>
      ) : null}
      {failure ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure.title} body={failure.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <>
          <h2 className="mt-8 font-display text-xl">Orders</h2>
          <div className="mt-3">
            {orders.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/events/${order.eventId}`}
                        className="font-semibold hover:text-brand-800 hover:underline"
                      >
                        {order.items.map((i) => `${i.qty} × ${i.tierName}`).join(", ")}
                      </Link>
                      <p className="mt-0.5 text-sm text-stone-600">
                        {formatPaise(order.amounts.finalPayable)} · {formatDateTime(order.createdAt)}
                      </p>
                      {cancelledEvents.has(order.eventId) ? (
                        <p className="mt-1 text-sm font-semibold text-amber-800">
                          Event cancelled — refund issued per policy.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} />
                      <Link
                        href={`/bookings/${order.id}`}
                        className="text-sm font-semibold text-brand-800 hover:underline"
                      >
                        Details
                      </Link>
                      {(order.status === "pending" || order.status === "confirmed") && (
                        <Link
                          href={`/bookings/${order.id}/cancel`}
                          className="text-sm font-semibold text-red-700 hover:underline"
                        >
                          Cancel
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No orders yet" body="Events you book will appear here." />
            )}
          </div>

          <h2 className="mt-10 font-display text-xl">My tickets</h2>
          <div className="mt-3">
            <Tabs
              label="Ticket status"
              items={[
                { label: "Active", href: "/bookings?tab=active", active: ticketStatus === "active" },
                { label: "Used", href: "/bookings?tab=used", active: ticketStatus === "used" },
                { label: "Expired", href: "/bookings?tab=expired", active: ticketStatus === "expired" },
              ]}
            />
          </div>
          <div className="mt-4">
            {tickets.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {tickets.map((ticket) => (
                  <li key={ticket.ticketCode}>
                    <Link
                      href={`/tickets/${ticket.ticketCode}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 hover:border-brand-400"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{ticket.event.title}</p>
                        <p className="mt-0.5 font-mono text-sm text-stone-600">
                          {ticket.ticketCode}
                        </p>
                        {cancelledEvents.has(ticket.event.id) ? (
                          <p className="mt-1 text-sm font-semibold text-amber-800">
                            Event cancelled
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={`No ${ticketStatus} tickets`}
                body="Tickets for your bookings will appear here."
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
