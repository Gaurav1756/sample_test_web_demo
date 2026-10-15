import type { Metadata } from "next";
import { connection } from "next/server";
import { getSessionUser, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { EventCard as EventCardData, Page } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { EventCard } from "@/components/events/event-card";
import { ExploreHero, SectionHeader, SpotlightCard } from "@/components/events/discovery";

export const metadata: Metadata = { title: "Home" };

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Attendee home: greeting + spotlight + today + upcoming over live GET /events data. */
export default async function AttendeeHomePage() {
  // Live feed: render at request time (also scopes the date window below).
  await connection();
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  let userName: string | null = null;
  let today: EventCardData[] = [];
  let upcoming: EventCardData[] = [];
  let categories: string[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [todayRes, upcomingRes, sessionUser, cats] = await Promise.all([
      api.get<Page<EventCardData>>("events", {
        query: { dateFrom: start.toISOString(), dateTo: end.toISOString(), limit: 4 },
      }),
      api.get<Page<EventCardData>>("events", { query: { limit: 8 } }),
      getSessionUser().catch(() => null),
      api.get<string[]>("meta/categories", { auth: false }).catch(() => [] as string[]),
    ]);
    today = todayRes.data;
    upcoming = upcomingRes.data;
    userName = sessionUser?.name ?? null;
    categories = cats;
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
        <h1 className="font-display text-3xl font-bold text-ink-900">Home</h1>
        <div className="mt-6">
          <ErrorState title={failure.title} body={failure.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </div>
      </main>
    );
  }

  const [spotlight, ...rest] = upcoming;

  return (
    <main className="space-y-10">
      <ExploreHero
        heading={`${greeting(now.getHours())}${userName ? `, ${userName}` : ""} — what are you in the mood for?`}
        sub={
          today.length > 0
            ? `${today.length} event${today.length === 1 ? "" : "s"} happening today.`
            : "Search events, venues and cities."
        }
        search=""
        categories={categories}
      />

      {spotlight ? (
        <section aria-label="Spotlight">
          <SectionHeader title="Spotlight" href="/explore" linkLabel="All events" />
          <div className="mt-4">
            <SpotlightCard event={spotlight} />
          </div>
        </section>
      ) : null}

      <section aria-label="Happening today">
        <SectionHeader title="Happening today" href="/explore" linkLabel="All events" />
        <div className="mt-4">
          {today.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {today.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing today" body="Check upcoming events below instead." />
          )}
        </div>
      </section>

      <section aria-label="Upcoming">
        <SectionHeader title="Upcoming" href="/explore" linkLabel="All events" />
        <div className="mt-4">
          {rest.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rest.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No upcoming events" body="New events will appear here." />
          )}
        </div>
      </section>
    </main>
  );
}
