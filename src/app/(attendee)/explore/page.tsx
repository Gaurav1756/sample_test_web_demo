import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community, type EventCard as EventCardData, type Page } from "@/lib/api-types";
import { exploreQuery, parseExploreParams } from "@/lib/search-params";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EventCard } from "@/components/events/event-card";
import { ExploreFilters } from "@/components/events/explore-filters";
import {
  CategoryTiles,
  CommunityCarousel,
  EventCarousel,
  ExploreHero,
  InterestTiles,
  MapStrip,
  SectionHeader,
} from "@/components/events/discovery";

export const metadata: Metadata = { title: "Explore events" };

const LIMIT = 12;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Event discovery (Figma p132). Without filters it renders discovery
 * sections over documented GET /events + /communities queries; with any
 * filter/search it renders the focused results view. Section variants use
 * only documented §4 filters (date windows, pricingModel) or client-side
 * splits of the returned status field — never invented query params.
 */
export default async function ExplorePage({ searchParams }: Props) {
  const filters = parseExploreParams((await searchParams) ?? {});
  const hasQuery =
    filters.page > 1 ||
    [
      filters.search,
      filters.city,
      filters.category,
      filters.mode,
      filters.eventType,
      filters.pricingModel,
      filters.dateFrom,
      filters.dateTo,
      filters.priceMin,
      filters.priceMax,
      filters.lat,
      filters.lng,
      filters.radiusKm,
    ].some((v) => v !== undefined);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  let events: EventCardData[] = [];
  let total = 0;
  let categories: string[] = [];
  let interests: string[] = [];
  let live: EventCardData[] = [];
  let trending: EventCardData[] = [];
  let freeEvents: EventCardData[] = [];
  let weekEvents: EventCardData[] = [];
  let communities: Community[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [list, cats, ints] = await Promise.all([
      api.get<Page<EventCardData>>("events", {
        query: { ...filters, limit: LIMIT },
      }),
      api.get<string[]>("meta/categories", { auth: false }).catch(() => [] as string[]),
      api.get<string[]>("meta/interests", { auth: false }).catch(() => [] as string[]),
    ]);
    events = list.data;
    total = list.total;
    categories = cats;
    interests = ints;

    if (!hasQuery) {
      const [pool, freeRes, weekRes, commRes] = await Promise.all([
        api.get<Page<EventCardData>>("events", { query: { limit: 24 } }).catch(() => null),
        api
          .get<Page<EventCardData>>("events", { query: { pricingModel: "free", limit: 8 } })
          .catch(() => null),
        api
          .get<Page<EventCardData>>("events", {
            query: { dateFrom: weekStart.toISOString(), dateTo: weekEnd.toISOString(), limit: 8 },
          })
          .catch(() => null),
        api.get<Page<Community>>("communities", { query: { limit: 6 } }).catch(() => null),
      ]);
      const poolEvents = pool?.data ?? [];
      live = poolEvents.filter((e) => e.status === "live").slice(0, 8);
      trending = [...poolEvents].sort((a, b) => b.goingCount - a.goingCount).slice(0, 8);
      freeEvents = freeRes?.data ?? [];
      weekEvents = weekRes?.data ?? [];
      communities = commRes ? toList<Community>(commRes) : [];
    }
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  if (failure) {
    return (
      <main>
        <h1 className="font-display text-3xl font-bold text-ink-900">Explore events</h1>
        <div className="mt-6">
          <ErrorState title={failure.title} body={failure.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </div>
      </main>
    );
  }

  if (!hasQuery) {
    const weekHref = `/explore?dateFrom=${weekStart.toISOString().slice(0, 10)}&dateTo=${weekEnd.toISOString().slice(0, 10)}`;
    return (
      <main className="space-y-10">
        <ExploreHero
          heading="Find your crowd. Book your weekend."
          sub="Live events, new communities, and hidden gems — picked from this week's listings."
          search={filters.search ?? ""}
          categories={categories}
        />
        <CategoryTiles categories={categories} />
        <InterestTiles interests={interests} />
        {live.length > 0 ? (
          <section aria-label="Live now">
            <SectionHeader title="Live now" href="/explore" linkLabel="All events" />
            <div className="mt-4">
              <EventCarousel events={live} label="Live events" />
            </div>
          </section>
        ) : null}
        <MapStrip count={total} />
        {trending.length > 0 ? (
          <section aria-label="Trending">
            <SectionHeader title="Trending" href="/explore" linkLabel="All events" />
            <div className="mt-4">
              <EventCarousel events={trending} label="Trending events" />
            </div>
          </section>
        ) : null}
        {weekEvents.length > 0 ? (
          <section aria-label="Coming up this week">
            <SectionHeader title="Coming up this week" href={weekHref} />
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {weekEvents.slice(0, 4).map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {freeEvents.length > 0 ? (
          <section aria-label="Free entry">
            <SectionHeader title="Free entry" href="/explore?pricingModel=free" />
            <div className="mt-4">
              <EventCarousel events={freeEvents} label="Free events" />
            </div>
          </section>
        ) : null}
        {communities.length > 0 ? (
          <section aria-label="Explore communities">
            <SectionHeader title="Explore communities" href="/communities" />
            <div className="mt-4">
              <CommunityCarousel communities={communities} />
            </div>
          </section>
        ) : null}
        <section aria-label="All events">
          <SectionHeader title="All events" href="#filters" linkLabel="Filters" />
          <div id="filters" className="mt-4 scroll-mt-24">
            <ExploreFilters initial={filters} categories={categories} />
          </div>
          {events.length > 0 ? (
            <>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  makeHref={(page) => `/explore?${exploreQuery({ ...filters, page })}`}
                />
              </div>
            </>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No events yet"
                body="New events will appear here once hosts publish them."
              />
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-900">Explore events</h1>
          <p className="mt-1 text-ink-600">
            {total} event{total === 1 ? "" : "s"} found.
          </p>
        </div>
        <Link
          href="/explore"
          className="rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          ← Back to discovery
        </Link>
      </div>
      <div className="mt-6">
        <ExploreFilters initial={filters} categories={categories} />
      </div>
      <div className="mt-6">
        {events.length > 0 ? (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                makeHref={(page) => `/explore?${exploreQuery({ ...filters, page })}`}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title="No events match these filters"
            body="Try widening the dates, clearing the search, or choosing another city."
          />
        )}
      </div>
    </main>
  );
}
