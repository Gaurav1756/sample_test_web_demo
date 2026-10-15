import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { EventCard as EventCardData, Page } from "@/lib/api-types";
import { exploreQuery, parseExploreParams } from "@/lib/search-params";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EventCard } from "@/components/events/event-card";
import { LocateButton } from "@/components/events/locate-button";
import { NearbyForm } from "@/components/events/nearby-form";

export const metadata: Metadata = { title: "Nearby events" };

const LIMIT = 12;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Proximity discovery over GET /events?lat,lng,radiusKm (API §4; Figma
 * p139-p141). Visual map tiles stay client-side per the spec, and the tile
 * provider is still TBD (CQ-05), so results render as a list for now.
 */
export default async function NearbyPage({ searchParams }: Props) {
  const filters = parseExploreParams((await searchParams) ?? {});
  const hasGeo = filters.lat !== undefined && filters.lng !== undefined;
  const hasCity = filters.city !== undefined && filters.city.length > 0;

  let events: EventCardData[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  if (hasGeo || hasCity) {
    try {
      const api = await serverApi();
      const res = await api.get<Page<EventCardData>>("events", {
        query: { ...filters, limit: LIMIT },
      });
      events = res.data;
      total = res.total;
    } catch (e) {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Nearby events</h1>
      <p className="mt-1 text-stone-600">
        Search by location or within a radius of where you are.
      </p>
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <NearbyForm city={filters.city ?? ""} radiusKm={filters.radiusKm ?? 25} />
        </div>
        <LocateButton />
      </div>
      <p className="mt-3 text-sm text-stone-500">
        Map tiles are not enabled yet; nearby results are listed below.
      </p>
      <div className="mt-6">
        {!hasGeo && !hasCity ? (
          <EmptyState
            title="Choose a location"
            body="Enter a city or use your location to find events near you."
          />
        ) : failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : events.length > 0 ? (
          <>
            <p className="mb-4 text-stone-600">
              {total} event{total === 1 ? "" : "s"} found.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={filters.page}
                total={total}
                limit={LIMIT}
                makeHref={(page) => `/explore/map?${exploreQuery({ ...filters, page })}`}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="No events nearby"
            body="Try a larger radius or another city."
          />
        )}
      </div>
    </main>
  );
}
