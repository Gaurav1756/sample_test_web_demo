import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventCard as EventCardData } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { EventCard } from "@/components/events/event-card";

export const metadata: Metadata = { title: "My events" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const FILTERS = ["hosted", "attended", "booked", "past"] as const;
const RANGES = ["this_week", "last_month", "3_months", "1_year"] as const;

/** Hosted/attended/booked/past event history (§3). */
export default async function ProfileEventsPage({ searchParams }: Props) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const filter = (FILTERS as readonly string[]).includes(first(params.filter))
    ? first(params.filter)
    : "attended";
  const range = (RANGES as readonly string[]).includes(first(params.range))
    ? first(params.range)
    : undefined;

  let events: EventCardData[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    events = toList<EventCardData>(
      await api.get<unknown>("users/me/events", {
        query: { filter, ...(range ? { range } : {}) },
      }),
    );
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  const href = (f: string, r?: string) => {
    const q = new URLSearchParams({ filter: f });
    if (r) q.set("range", r);
    return `/profile/events?${q.toString()}`;
  };

  return (
    <main>
      <h1 className="font-display text-3xl">My events</h1>
      <div className="mt-4">
        <Tabs
          label="Event history"
          items={FILTERS.map((f) => ({
            label: f.charAt(0).toUpperCase() + f.slice(1),
            href: href(f, range),
            active: filter === f,
          }))}
        />
      </div>
      <div className="mt-3">
        <Tabs
          label="Time range"
          items={[
            { label: "All time", href: href(filter), active: !range },
            ...RANGES.map((r) => ({
              label: r.replace(/_/g, " "),
              href: href(filter, r),
              active: range === r,
            })),
          ]}
        />
      </div>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : events.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing here" body="Events in this list will appear here." />
        )}
      </div>
    </main>
  );
}
