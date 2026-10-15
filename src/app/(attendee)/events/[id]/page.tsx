import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { AgendaSlot, AttendeesResponse, EventDetail } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { SaveButton } from "@/components/events/save-button";
import { ShareButton } from "@/components/events/share-button";
import { RateEvent } from "@/components/events/rate-event";
import { ReportButton } from "@/components/communities/report-button";
import { Button } from "@/components/ui/button";

type Props = {
  params: Promise<{ id: string }>;
};

async function loadEvent(id: string): Promise<
  | { event: EventDetail; agenda: AgendaSlot[]; attendees: AttendeesResponse }
  | { notFound: true }
  | { failure: { title: string; body: string } }
> {
  try {
    const api = await serverApi();
    const [event, agendaRes, attendeesRes] = await Promise.all([
      api.get<EventDetail>(`events/${id}`),
      api
        .get<{ slots: AgendaSlot[] }>(`events/${id}/agenda`)
        .then((r) => r.slots)
        .catch((): AgendaSlot[] => []),
      api.get<AttendeesResponse>(`events/${id}/attendees`).catch((): AttendeesResponse => ({
        attendees: [],
        goingCount: 0,
      })),
      // Record the detail view for the analytics funnel (§4); best-effort.
      api.post(`events/${id}/views`).catch(() => null),
    ]);
    const agenda = agendaRes.length > 0 ? agendaRes : (event.agenda ?? []);
    return { event, agenda, attendees: attendeesRes };
  } catch (e) {
    if (e instanceof ApiError && (e.code === "EVENT_NOT_FOUND" || e.status === 404)) {
      return { notFound: true };
    }
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    return { failure: { title: g.message, body: g.recovery } };
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadEvent(id);
  if ("event" in loaded) {
    return {
      title: loaded.event.title,
      description: loaded.event.description.slice(0, 160),
    };
  }
  return { title: "Event" };
}

/** Event detail: schedule, venue, host, community, policies, tiers. */
export default async function EventDetailPage({ params }: Props) {
  const { id } = await params;
  const loaded = await loadEvent(id);
  if ("notFound" in loaded) notFound();
  if ("failure" in loaded) {
    return (
      <main>
        <ErrorState title={loaded.failure.title} body={loaded.failure.body} />
        <div className="mt-4 flex justify-center">
          <RefreshButton />
        </div>
      </main>
    );
  }

  const { event, agenda, attendees } = loaded;
  const mapsUrl =
    event.latitude != null && event.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`
      : null;

  return (
    <main>
      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-xl bg-brand-50">
            {event.coverImage ? (
              // Plain img: cover hosts are backend-controlled and cannot be
              // allow-listed for next/image remote optimization.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverImage} alt="" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center">
                <span className="font-display text-2xl text-brand-800">
                  {event.category || "Pegwin Circle"}
                </span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <StatusBadge status={event.status} />
            {event.category ? (
              <span className="text-sm font-medium text-stone-600">{event.category}</span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 font-display text-3xl sm:text-4xl">{event.title}</h1>
            <div className="flex items-center gap-2">
              <SaveButton kind="event" id={event.id} initialSaved={event.isSaved} />
              <ShareButton title={event.title} text={`Join me at ${event.title} on Pegwin Circle`} />
              <ReportButton targetType="event" targetId={event.id} variant="outline" />
            </div>
          </div>
          <p className="mt-2 text-stone-600">
            {formatDateTime(event.startAt)} → {formatDateTime(event.endAt)}
          </p>
          {(event.venue || event.address || event.city) && (
            <p className="mt-1 text-stone-600">
              {[event.venue, event.address, event.city].filter(Boolean).join(", ")}
            </p>
          )}

          <section aria-label="About" className="mt-8">
            <h2 className="font-display text-xl">About</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-stone-700">
              {event.description}
            </p>
          </section>

          {agenda.length > 0 ? (
            <section aria-label="Agenda" className="mt-8">
              <h2 className="font-display text-xl">Agenda</h2>
              <ol className="mt-3 flex flex-col gap-2">
                {agenda.map((slot, i) => (
                  <li
                    key={`${slot.time}-${i}`}
                    className="flex gap-4 rounded-lg border border-stone-200 px-4 py-2.5"
                  >
                    <span className="w-20 shrink-0 font-semibold text-brand-900">{slot.time}</span>
                    <span>{slot.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {event.policies && (event.policies.refundPolicy || event.policies.entryRules || event.policies.ageRestriction) ||
          event.language ||
          event.targetAudience ||
          event.maxAttendees != null ? (
            <section aria-label="Policies" className="mt-8">
              <h2 className="font-display text-xl">Good to know</h2>
              <dl className="mt-3 flex flex-col gap-3 rounded-xl border border-stone-200 p-4 text-sm">
                {event.language ? (
                  <div>
                    <dt className="font-semibold">Language</dt>
                    <dd className="text-stone-600">{event.language}</dd>
                  </div>
                ) : null}
                {event.targetAudience ? (
                  <div>
                    <dt className="font-semibold">Good for</dt>
                    <dd className="text-stone-600">{event.targetAudience}</dd>
                  </div>
                ) : null}
                {event.maxAttendees != null ? (
                  <div>
                    <dt className="font-semibold">Capacity</dt>
                    <dd className="text-stone-600">{event.maxAttendees} attendees</dd>
                  </div>
                ) : null}
                {event.policies?.ageRestriction ? (
                  <div>
                    <dt className="font-semibold">Age</dt>
                    <dd className="text-stone-600">{event.policies.ageRestriction}</dd>
                  </div>
                ) : null}
                {event.policies?.entryRules ? (
                  <div>
                    <dt className="font-semibold">Entry</dt>
                    <dd className="text-stone-600">{event.policies.entryRules}</dd>
                  </div>
                ) : null}
                {event.policies?.refundPolicy ? (
                  <div>
                    <dt className="font-semibold">Refunds</dt>
                    <dd className="text-stone-600">{event.policies.refundPolicy}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}

          {event.status === "completed" ? (
            <section aria-label="Rate this event" className="mt-8">
              <RateEvent eventId={event.id} avgRating={event.avgRating} />
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-stone-200 p-5">
            <p className="text-sm text-stone-600">Tickets from</p>
            <p className="font-display text-3xl">
              {event.minPrice === 0 ? "Free" : formatPaise(event.minPrice)}
            </p>
            <div className="mt-4">
              {event.status === "on_sale" || event.status === "live" ? (
                <Button asChild className="w-full">
                  <Link href={`/events/${event.id}/checkout`}>Book tickets</Link>
                </Button>
              ) : (
                <>
                  <Button disabled className="w-full">
                    Book tickets
                  </Button>
                  <p className="mt-2 text-center text-sm text-stone-500">
                    Booking opens when tickets go on sale.
                  </p>
                </>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-100 pt-4 text-center text-sm">
              <div>
                <dt className="text-stone-500">Going</dt>
                <dd className="font-bold">{event.going ?? attendees.goingCount}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Attended</dt>
                <dd className="font-bold">{event.attended ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Sold</dt>
                <dd className="font-bold">{event.sold ?? event.soldCount}</dd>
              </div>
            </dl>
          </div>

          {event.tiers && event.tiers.length > 0 ? (
            <div className="rounded-xl border border-stone-200 p-5">
              <h2 className="font-display text-lg">Ticket tiers</h2>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {event.tiers.map((tier) => (
                  <li key={tier.id} className="flex items-center justify-between gap-2">
                    <span className="font-medium">{tier.name}</span>
                    <span className="text-stone-600">
                      {formatPaise(tier.price)} · {tier.availableCount} left
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {event.host ? (
            <div className="rounded-xl border border-stone-200 p-5">
              <h2 className="font-display text-lg">Hosted by</h2>
              <p className="mt-1 font-semibold">
                <Link
                  href={`/hosts/${event.host.id}`}
                  className="text-brand-800 hover:underline"
                >
                  {event.host.name}
                </Link>
              </p>
              {event.host.bio ? (
                <p className="mt-1 text-sm text-stone-600">{event.host.bio}</p>
              ) : null}
              {event.host.eventsHostedCount != null ? (
                <p className="mt-2 text-sm text-stone-600">
                  {event.host.eventsHostedCount} events hosted
                  {event.host.avgRating != null ? ` · ★ ${event.host.avgRating.toFixed(1)}` : ""}
                </p>
              ) : null}
            </div>
          ) : null}

          {event.community ? (
            <div className="rounded-xl border border-stone-200 p-5">
              <h2 className="font-display text-lg">Community</h2>
              <p className="mt-1 font-semibold">{event.community.name}</p>
            </div>
          ) : null}

          {(event.address || mapsUrl) && (
            <div className="rounded-xl border border-stone-200 p-5">
              <h2 className="font-display text-lg">Location</h2>
              {event.address ? (
                <p className="mt-1 text-sm text-stone-600">{event.address}</p>
              ) : null}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-brand-800 hover:underline"
                >
                  View on map →
                </a>
              ) : null}
            </div>
          )}

          {attendees.attendees.length > 0 ? (
            <div className="rounded-xl border border-stone-200 p-5">
              <h2 className="font-display text-lg">Who&apos;s going</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {attendees.attendees.slice(0, 12).map((a) => (
                  <li key={a.id} title={a.name}>
                    <Link
                      href={`/users/${a.id}`}
                      aria-label={a.name}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-900 hover:underline"
                    >
                      {a.name.charAt(0).toUpperCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
