import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type Community, type EventCard as EventCardData } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Tabs } from "@/components/ui/tabs";
import { EventCard } from "@/components/events/event-card";
import { CommunityCard } from "@/components/communities/community-card";

export const metadata: Metadata = { title: "Saved" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const WHEN = ["all", "upcoming", "this_week", "this_month"] as const;

/** Saved events and communities (§12a) with time filters for events. */
export default async function SavedPage({ searchParams }: Props) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const tab = first(params.tab) === "communities" ? "communities" : "events";
  const when = (WHEN as readonly string[]).includes(first(params.when))
    ? first(params.when)
    : "all";

  let events: EventCardData[] = [];
  let communities: Community[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    if (tab === "events") {
      events = toList<EventCardData>(await api.get<unknown>("users/me/saved-events", { query: { when } }));
    } else {
      communities = toList<Community>(await api.get<unknown>("users/me/saved-communities"));
    }
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Saved</h1>
      <div className="mt-4">
        <Tabs
          label="Saved"
          items={[
            { label: "Events", href: "/saved?tab=events", active: tab === "events" },
            { label: "Communities", href: "/saved?tab=communities", active: tab === "communities" },
          ]}
        />
      </div>
      {tab === "events" ? (
        <div className="mt-4">
          <Tabs
            label="Time filter"
            items={WHEN.map((w) => ({
              label: w.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()),
              href: `/saved?tab=events&when=${w}`,
              active: when === w,
            }))}
          />
        </div>
      ) : null}
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : tab === "events" ? (
          events.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <li key={event.id}>
                  <EventCard event={event} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No saved events"
              body="Tap the heart on any event to save it here."
            />
          )
        ) : communities.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => (
              <li key={community.id}>
                <CommunityCard community={community} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No saved communities"
            body="Save communities to find them quickly later."
          />
        )}
      </div>
    </main>
  );
}
