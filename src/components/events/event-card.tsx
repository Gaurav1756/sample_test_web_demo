import Link from "next/link";
import type { EventCard as EventCardData } from "@/lib/api-types";
import { formatDate, formatPaise } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";
import { SaveButton } from "./save-button";

/** Short day/month pair for the cover date badge; null when unparseable. */
function dayMonth(iso: string): { day: string; mon: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-IN", { day: "numeric" }),
    mon: d.toLocaleDateString("en-IN", { month: "short" }),
  };
}

/** Shared event discovery card. All content is backend data. */
export function EventCard({ event }: { event: EventCardData }) {
  const dm = dayMonth(event.startAt);
  const place = event.city || event.venue;
  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-stone-200/70 bg-white shadow-sm transition-shadow hover:shadow-lg hover:shadow-brand-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="relative aspect-[4/3] bg-brand-100">
        {event.coverImage ? (
          // Plain img: cover hosts are backend-controlled and cannot be
          // allow-listed for next/image remote optimization.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-white p-6 text-center">
            <span className="font-display text-xl font-semibold text-brand-800">
              {event.category || "Pegwin Circle"}
            </span>
          </div>
        )}
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          {dm ? (
            <span className="rounded-2xl bg-white/95 px-3 py-1.5 text-center shadow-sm backdrop-blur">
              <span className="block text-base font-bold leading-none text-ink-900">{dm.day}</span>
              <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                {dm.mon}
              </span>
            </span>
          ) : (
            <span />
          )}
          <SaveButton kind="event" id={event.id} initialSaved={event.isSaved} />
        </div>
        <div className="absolute bottom-3 left-3 flex gap-2">
          {event.status === "live" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Live
            </span>
          ) : (
            <StatusBadge status={event.status} />
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {event.category ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
            {event.category}
          </p>
        ) : null}
        <h3 className="mt-1 font-display text-lg font-semibold leading-snug text-ink-900 group-hover:text-brand-700">
          {event.title}
        </h3>
        <p className="mt-1.5 text-sm text-ink-600">
          {[place, formatDate(event.startAt)].filter(Boolean).join(" · ")}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
          <div>
            <p className="text-base font-bold text-ink-900">
              {event.minPrice === 0 ? "Free" : `From ${formatPaise(event.minPrice)}`}
            </p>
            <p className="mt-0.5 text-xs font-medium text-ink-500">
              {event.avgRating != null ? `★ ${event.avgRating.toFixed(1)} · ` : ""}
              {event.goingCount} going
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white"
          >
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
