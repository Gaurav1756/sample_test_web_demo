import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { EventDetail } from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { CancelEventForm } from "@/components/host/cancel-event-form";

export const metadata: Metadata = { title: "Cancel event" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function HostCancelEventPage({ params }: Props) {
  await requireSession(["host", "super_admin"]);
  const { id } = await params;

  let event: EventDetail | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    event = await api.get<EventDetail>(`events/${id}`);
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
        <Link href={`/host/events/${id}`} className="font-semibold text-brand-800 hover:underline">
          ← Back to event
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Cancel event</h1>
      <div className="mt-6">
        {failure || !event ? (
          <>
            <ErrorState title={failure?.title ?? "Event unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : event.status === "cancelled" ? (
          <ErrorState title="Already cancelled." body="This event is already cancelled." />
        ) : (
          <>
            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
              Only the date is wrong?{" "}
              <Link
                href={`/host/events/${event.id}`}
                className="font-semibold text-brand-800 hover:underline"
              >
                Reschedule instead
              </Link>{" "}
              — holders keep their tickets and no refunds are issued.
            </div>
            <dl className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
                <dt className="text-sm text-stone-500">Tickets sold</dt>
                <dd className="font-display text-xl font-bold">{event.sold ?? event.soldCount}</dd>
              </div>
              <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
                <dt className="text-sm text-stone-500">Going</dt>
                <dd className="font-display text-xl font-bold">{event.going ?? event.goingCount}</dd>
              </div>
              <div className="rounded-lg border border-stone-200 px-4 py-3 text-center">
                <dt className="text-sm text-stone-500">Starting from</dt>
                <dd className="font-display text-xl font-bold">
                  {event.minPrice === 0 ? "Free" : formatPaise(event.minPrice)}
                </dd>
              </div>
            </dl>
            {event.tiers && event.tiers.length > 0 ? (
              <ul className="mt-4 flex max-w-2xl flex-col gap-2 text-sm">
                {event.tiers.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-stone-600">
                      {formatPaise(t.price)} · {t.soldCount} sold
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-6">
              <CancelEventForm eventId={event.id} title={event.title} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
