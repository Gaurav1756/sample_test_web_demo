import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { Order } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { CancelBookingForm } from "@/components/booking/cancel-booking-form";

export const metadata: Metadata = { title: "Cancel booking" };

type Props = {
  params: Promise<{ orderId: string }>;
};

export default async function CancelBookingPage({ params }: Props) {
  await requireSession();
  const { orderId } = await params;

  let order: Order | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    order = await api.get<Order>(`orders/${orderId}`);
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

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/bookings" className="font-semibold text-brand-800 hover:underline">
          ← All bookings
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Cancel booking</h1>
      <div className="mt-6">
        {failure || !order ? (
          <>
            <ErrorState title={failure?.title ?? "Order unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : order.status !== "pending" && order.status !== "confirmed" ? (
          <ErrorState
            title={`This order is ${order.status} and cannot be cancelled.`}
            body="Only pending or confirmed bookings can be cancelled."
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4">
              <div>
                <p className="font-semibold">
                  {order.items.map((i) => `${i.qty} × ${i.tierName}`).join(", ")}
                </p>
                <p className="mt-0.5 text-sm text-stone-600">
                  {formatPaise(order.amounts.finalPayable)} · {formatDateTime(order.createdAt)}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <CancelBookingForm orderId={order.id} />
          </>
        )}
      </div>
    </main>
  );
}
