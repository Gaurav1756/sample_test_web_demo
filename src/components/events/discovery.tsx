import Link from "next/link";
import type { Community, EventCard as EventCardData } from "@/lib/api-types";
import { formatDate, formatPaise } from "@/lib/format";
import { EventCard } from "./event-card";
import { CommunityCard } from "../communities/community-card";

/** Section heading row: bold title left, "See all" link right (Figma). */
export function SectionHeader({
  title,
  href,
  linkLabel = "See all",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="font-display text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Explore hero: headline + search (plain GET form, no JS needed) +
 * category chips from GET /meta/categories.
 */
export function ExploreHero({
  heading,
  sub,
  search,
  categories,
  activeCategory,
}: {
  heading: string;
  sub: string;
  search: string;
  categories: string[];
  activeCategory?: string;
}) {
  return (
    <section className="overflow-hidden rounded-[2rem] bg-brand-950 px-6 py-10 text-white sm:px-10 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-300">
        Pegwin Circle
      </p>
      <h1 className="mt-2 max-w-xl font-display text-3xl font-bold leading-tight sm:text-4xl">
        {heading}
      </h1>
      <p className="mt-2 max-w-xl text-brand-100">{sub}</p>
      <form action="/explore" method="get" role="search" className="mt-6 max-w-xl">
        <div className="flex items-center gap-2 rounded-full bg-white p-2 pl-5 shadow-lg shadow-black/20">
          <span aria-hidden="true" className="text-lg text-stone-400">
            ⌕
          </span>
          <label htmlFor="explore-search" className="sr-only">
            Search events
          </label>
          <input
            id="explore-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search events, venues, cities…"
            className="h-10 w-full bg-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none"
          />
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Search
          </button>
        </div>
      </form>
      {categories.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Browse by category">
          {categories.slice(0, 10).map((c) => {
            const active = activeCategory === c;
            return (
              <li key={c}>
                <Link
                  href={`/explore?category=${encodeURIComponent(c)}`}
                  aria-current={active ? "true" : undefined}
                  className={`inline-block rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-white text-brand-900"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {c}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

const TILE_TONES = [
  "bg-rose-100 text-rose-900",
  "bg-sky-100 text-sky-900",
  "bg-amber-100 text-amber-900",
  "bg-emerald-100 text-emerald-900",
  "bg-brand-100 text-brand-900",
  "bg-orange-100 text-orange-900",
];

/** Category tiles linking to pre-filtered explore results. */
export function CategoryTiles({ categories }: { categories: string[] }) {
  const shown = categories.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Explore by category">
      <SectionHeader title="Explore by category" href="/explore" linkLabel="All events" />
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((c, i) => (
          <li key={c}>
            <Link
              href={`/explore?category=${encodeURIComponent(c)}`}
              className={`flex min-h-24 flex-col justify-between rounded-3xl p-4 transition-shadow hover:shadow-md ${TILE_TONES[i % TILE_TONES.length]}`}
            >
              <span aria-hidden="true" className="text-2xl font-bold opacity-60">
                {c.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-sm font-bold">{c}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Interest tiles (Figma "explore by mood"). Interests come from
 * GET /meta/interests and link to a real event search — no invented
 * mood-to-category mapping.
 */
export function InterestTiles({ interests }: { interests: string[] }) {
  const shown = interests.slice(0, 6);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Explore by interest">
      <SectionHeader title="Explore by interest" href="/explore" linkLabel="All events" />
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((interest, i) => (
          <li key={interest}>
            <Link
              href={`/explore?search=${encodeURIComponent(interest)}`}
              className={`flex min-h-24 flex-col justify-between rounded-3xl p-4 transition-shadow hover:shadow-md ${TILE_TONES[(i + 3) % TILE_TONES.length]}`}
            >
              <span aria-hidden="true" className="text-2xl font-bold opacity-60">
                {interest.charAt(0).toUpperCase()}
              </span>
              <span className="truncate text-sm font-bold">{interest}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Horizontal snap carousel of event cards (CSS scroll, no JS). */
export function EventCarousel({ events, label }: { events: EventCardData[]; label: string }) {
  if (events.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {events.map((event) => (
        <li key={event.id} className="w-64 shrink-0 snap-start sm:w-72">
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  );
}

/** Horizontal snap carousel of community cards (CSS scroll, no JS). */
export function CommunityCarousel({ communities }: { communities: Community[] }) {
  if (communities.length === 0) return null;
  return (
    <ul
      aria-label="Communities"
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
    >
      {communities.map((c) => (
        <li key={c.id} className="w-72 shrink-0 snap-start sm:w-80">
          <CommunityCard community={c} />
        </li>
      ))}
    </ul>
  );
}

/** Banner linking to the nearby map (Figma map strip). */
export function MapStrip({ count }: { count: number }) {
  return (
    <Link
      href="/explore/map"
      className="group flex items-center justify-between gap-4 overflow-hidden rounded-[2rem] border border-stone-200/70 bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8"
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Nearby
        </p>
        <p className="mt-1 font-display text-2xl font-bold text-ink-900">
          {count > 0 ? `${count} events near you` : "See what's around you"}
        </p>
        <p className="mt-1 text-sm text-ink-600">
          Open the map to browse events by location.
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 group-hover:bg-brand-700">
        View on map →
      </span>
    </Link>
  );
}

/** Wide feature card for Spotlight rows. All content is backend data. */
export function SpotlightCard({ event }: { event: EventCardData }) {
  const place = [event.venue, event.city].filter(Boolean).join(", ");
  return (
    <Link
      href={`/events/${event.id}`}
      className="group relative block overflow-hidden rounded-[2rem] bg-brand-950 text-white shadow-sm transition-shadow hover:shadow-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <div className="relative aspect-[16/10] sm:aspect-[21/9]">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-6 sm:p-8">
          <div className="min-w-0">
            {event.category ? (
              <p className="inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                {event.category}
              </p>
            ) : null}
            <p className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
              {event.title}
            </p>
            <p className="mt-1 text-sm text-white/85">
              {[formatDate(event.startAt), place].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 text-sm font-semibold">
              {event.minPrice === 0 ? "Free entry" : `From ${formatPaise(event.minPrice)}`}
              {event.goingCount > 0 ? ` · ${event.goingCount} going` : ""}
            </p>
          </div>
          <span className="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-ink-900 group-hover:bg-brand-100">
            Explore
          </span>
        </div>
      </div>
    </Link>
  );
}
