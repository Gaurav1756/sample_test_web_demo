import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { EventDetail, Tier } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CheckoutFlow } from "@/components/booking/checkout-flow";

export const metadata: Metadata = { title: "Checkout" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CheckoutPage({ params }: Props) {
  await requireSession();
  const { id } = await params;

  let event: EventDetail | null = null;
  let tiers: Tier[] = [];
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    const [ev, tierList] = await Promise.all([
      api.get<EventDetail>(`events/${id}`),
      api.get<Tier[]>(`events/${id}/tiers`).catch(() => null),
    ]);
    event = ev;
    tiers = tierList ?? ev.tiers ?? [];
  } catch (e) {
    if (e instanceof ApiError && (e.code === "EVENT_NOT_FOUND" || e.status === 404)) {
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
    <main>
      <p className="text-sm">
        <Link href={`/events/${id}`} className="font-semibold text-brand-800 hover:underline">
          ← Back to event
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Checkout</h1>
      <div className="mt-6">
        {failure || !event ? (
          <>
            <ErrorState
              title={failure?.title ?? "Event unavailable."}
              body={failure?.body}
            />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : event.status !== "on_sale" && event.status !== "live" ? (
          <ErrorState
            title="Tickets aren't on sale for this event."
            body="Booking opens when the event goes on sale."
          />
        ) : tiers.length === 0 ? (
          <ErrorState
            title="No ticket tiers yet."
            body="The host hasn't published ticket tiers for this event."
          />
        ) : (
          <CheckoutFlow event={event} tiers={tiers} />
        )}
      </div>
    </main>
  );
}
