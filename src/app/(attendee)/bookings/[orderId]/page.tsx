import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type EventDetail,
  type Order,
  type Receipt,
  type Refund,
  type Ticket,
} from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Badge } from "@/components/ui/badge";
import { RefundTracker } from "@/components/booking/refund-tracker";
import { AddToCalendarButton } from "@/components/booking/add-to-calendar";

export const metadata: Metadata = { title: "Order details" };

type Props = { params: Promise<{ orderId: string }> };

/** Order detail (§7): order, receipt, and the order's tickets. */
export default async function OrderDetailPage({ params }: Props) {
  const { orderId } = await params;
  await requireSession();

  let order: Order | null = null;
  let tickets: Ticket[] = [];
  let receipt: Receipt | null = null;
  let refunds: Refund[] | null = null;
  let event: EventDetail | null = null;
  let missing = false;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    order = await api.get<Order>(`orders/${orderId}`);
    const payment = order?.payment as { paymentId?: unknown; id?: unknown } | null | undefined;
    const pid = typeof payment?.paymentId === "string" ? payment.paymentId : undefined;
    const [ticketRes, receiptRes, refundRes, eventRes] = await Promise.allSettled([
      api.get<unknown>(`orders/${orderId}/tickets`),
      order.status === "confirmed" ? api.get<Receipt>(`orders/${orderId}/receipt`) : null,
      pid && (order.status === "cancelled" || order.status === "refunded")
        ? api.get<unknown>(`payments/${pid}/refunds`)
        : null,
      api.get<EventDetail>(`events/${order.eventId}`),
    ]);
    if (ticketRes.status === "fulfilled") tickets = toList<Ticket>(ticketRes.value);
    if (receiptRes.status === "fulfilled" && receiptRes.value) receipt = receiptRes.value;
    if (refundRes.status === "fulfilled" && refundRes.value) {
      refunds = toList<Refund>(refundRes.value);
    }
    if (eventRes.status === "fulfilled") event = eventRes.value;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      missing = true;
    } else {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  if (missing) notFound();

  // Order.payment shape is unstated; read a payment reference tolerantly.
  const payment = order?.payment as { paymentId?: unknown; id?: unknown } | null | undefined;
  const paymentId =
    typeof payment?.paymentId === "string"
      ? payment.paymentId
      : typeof payment?.id === "string"
        ? payment.id
        : undefined;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-sm">
        <Link href="/bookings" className="font-semibold text-brand-800 hover:underline">
          ← My bookings
        </Link>
      </p>
      {failure || !order ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Order unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl">Order</h1>
            <Badge tone={order.status === "confirmed" ? "success" : "neutral"}>{order.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Placed {formatDateTime(order.createdAt)} ·{" "}
            <Link href={`/events/${order.eventId}`} className="font-semibold text-brand-800 hover:underline">
              View event
            </Link>
          </p>
          {event ? (
            <div className="mt-3">
              <AddToCalendarButton
                event={{
                  title: event.title,
                  startAt: event.startAt,
                  endAt: event.endAt,
                  location:
                    [event.venue, event.address, event.city].filter(Boolean).join(", ") || null,
                  uid: `${order.id}@pegwin.circle`,
                }}
                filename={event.title}
              />
            </div>
          ) : null}

          <h2 className="mt-8 font-display text-xl">Items</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {order.items.map((item) => (
              <li
                key={item.tierId}
                className="flex items-center justify-between rounded-xl border border-soft bg-surface-card p-3 text-sm"
              >
                <span>
                  {item.tierName} × {item.qty}
                </span>
                <span className="font-semibold">{formatPaise(item.unitPrice * item.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-right text-sm">
            Total paid: <strong>{formatPaise(order.amounts.finalPayable)}</strong>
          </p>

          {receipt ? (
            <div className="mt-8">
              <h2 className="font-display text-xl">Receipt</h2>
              <p className="mt-2 text-sm">
                {receipt.paymentMethod} · {formatPaise(receipt.amount)} · Txn {receipt.transactionId}
              </p>
              <p className="mt-1 text-sm">
                <a
                  href={receipt.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-800 hover:underline"
                >
                  Download receipt
                </a>
              </p>
            </div>
          ) : null}

          {paymentId && (order.status === "cancelled" || order.status === "refunded") ? (
            <div className="mt-8">
              <RefundTracker paymentId={paymentId} initial={refunds} />
            </div>
          ) : null}

          <div className="mt-8">
            <h2 className="font-display text-xl">Tickets</h2>
            {tickets.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {tickets.map((t) => (
                  <li
                    key={t.ticketCode}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-soft bg-surface-card p-3 text-sm"
                  >
                    <span>
                      <strong>{t.attendee.name}</strong> · {t.tierName}
                    </span>
                    <Link
                      href={`/tickets/${t.ticketCode}`}
                      className="font-semibold text-brand-800 hover:underline"
                    >
                      View ticket →
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3">
                <EmptyState
                  title="No tickets yet"
                  body="Tickets appear here once the order is confirmed."
                />
              </div>
            )}
          </div>

          {order.status === "confirmed" ? (
            <p className="mt-8 text-sm">
              <Link
                href={`/bookings/${order.id}/cancel`}
                className="font-semibold text-brand-800 hover:underline"
              >
                Cancel this order
              </Link>
            </p>
          ) : null}
        </>
      )}
    </main>
  );
}
