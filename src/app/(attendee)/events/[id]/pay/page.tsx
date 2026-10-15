import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { isMockData } from "@/lib/data-source";
import { ApiError } from "@/lib/api-errors";
import type { Order } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { PayForm } from "@/components/booking/pay-form";

export const metadata: Metadata = { title: "Pay" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function PayPage({ params, searchParams }: Props) {
  await requireSession();
  const { id } = await params;
  const orderId = first((await searchParams)?.order);

  if (!orderId) {
    return (
      <main>
        <EmptyState
          title="No order to pay for"
          body="Place an order from checkout first, then return here to pay."
        />
      </main>
    );
  }

  let order: Order | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    order = await api.get<Order>(`orders/${orderId}`);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <p className="text-sm">
        <Link href={`/events/${id}`} className="font-semibold text-brand-800 hover:underline">
          ← Back to event
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Pay</h1>
      <div className="mt-6">
        {failure || !order ? (
          <>
            <ErrorState title={failure?.title ?? "Order unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <PayForm order={order} simulated={isMockData()} />
        )}
      </div>
    </main>
  );
}
