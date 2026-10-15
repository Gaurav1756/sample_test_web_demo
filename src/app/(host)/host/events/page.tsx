import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventCard as EventCardData, type Page } from "@/lib/api-types";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { RehostButton } from "@/components/host/rehost-button";

export const metadata: Metadata = { title: "My events" };

const LIMIT = 12;
const TABS = ["live", "upcoming", "drafts", "completed"] as const;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Host event lifecycle lists (FIG p22-p25) over GET /hosts/me/events. */
export default async function HostEventsPage({ searchParams }: Props) {
  await requireSession(["host", "super_admin"]);
  const params = (await searchParams) ?? {};
  const tab = (TABS as readonly string[]).includes(first(params.tab))
    ? first(params.tab)
    : "live";
  const page = Math.max(1, Number(first(params.page)) || 1);

  let events: EventCardData[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<EventCardData>>("hosts/me/events", {
      query: { status: tab, page, limit: LIMIT },
    });
    events = toList<EventCardData>(res);
    total = (res as Page<EventCardData>).total ?? events.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">My events</h1>
        <Link
          href="/host/events/new/1"
          className="inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
        >
          + New event
        </Link>
      </div>
      <div className="mt-4">
        <Tabs
          label="Event lifecycle"
          items={TABS.map((t) => ({
            label: t.charAt(0).toUpperCase() + t.slice(1),
            href: `/host/events?tab=${t}`,
            active: tab === t,
          }))}
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
          <>
            <ul className="flex flex-col gap-3">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/host/events/${event.id}`}
                      className="font-semibold hover:text-brand-800 hover:underline"
                    >
                      {event.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-stone-600">
                      {[event.city, formatDate(event.startAt)].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={event.status} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {tab === "live" ? (
                      <Link
                        href={`/host/scanner?eventId=${event.id}`}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
                      >
                        QR check-in
                      </Link>
                    ) : null}
                    {tab === "drafts" ? (
                      <Link
                        href={`/host/events/new/1?draft=${event.id}`}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
                      >
                        Continue
                      </Link>
                    ) : null}
                    {tab === "completed" ? (
                      <RehostButton eventId={event.id} title={event.title} />
                    ) : null}
                    <Link
                      href={`/host/events/${event.id}`}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 hover:bg-stone-100"
                    >
                      Manage
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                makeHref={(p) => {
                  const q = new URLSearchParams({ tab });
                  if (p > 1) q.set("page", String(p));
                  return `/host/events?${q.toString()}`;
                }}
              />
            </div>
          </>
        ) : (
          <EmptyState
            title={`No ${tab} events`}
            body={
              tab === "drafts"
                ? "Start a new event to see your drafts here."
                : "Events in this state will appear here."
            }
          />
        )}
      </div>
    </main>
  );
}
