import type { EventCard } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/badge";

/** Compact event row used by portal overview shells. Links arrive with event detail pages (Phase 2). */
export function EventRow({ event }: { event: EventCard }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-semibold">{event.title}</p>
        <p className="mt-0.5 text-sm text-stone-600">
          {[event.city, formatDate(event.startAt)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <StatusBadge status={event.status} />
    </li>
  );
}
