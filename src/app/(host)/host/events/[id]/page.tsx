import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type AnalyticsOverview,
  type CheckinRecord,
  type EventDetail,
  type TeamMember,
  type Tier,
} from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { EventActions } from "@/components/host/event-actions";
import { TierManager } from "@/components/host/tier-manager";
import { AgendaEditor } from "@/components/host/agenda-editor";
import { TeamManager } from "@/components/host/team-manager";
import { PoliciesForm } from "@/components/host/policies-form";
import { CheckinsTable } from "@/components/host/checkins-table";
import { AnalyticsView } from "@/components/host/analytics-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const { id } = await params;
    const api = await serverApi();
    const event = await api.get<EventDetail>(`events/${id}`);
    return { title: `Manage ${event.title}` };
  } catch {
    return { title: "Manage event" };
  }
}

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const RANGES = ["7_days", "30_days", "3_months", "12_months"] as const;

/** Single-event management: tiers, agenda, team, policies, check-ins, analytics. */
export default async function HostEventDetailPage({ params, searchParams }: Props) {
  await requireSession(["host", "super_admin"]);
  const { id } = await params;
  const range = (RANGES as readonly string[]).includes(first((await searchParams)?.range))
    ? first((await searchParams)?.range)
    : "30_days";

  let event: EventDetail | null = null;
  let tiers: Tier[] = [];
  let team: TeamMember[] = [];
  let checkins: CheckinRecord[] | null = [];
  let analytics: AnalyticsOverview | null = null;
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    event = await api.get<EventDetail>(`events/${id}`);
    const [tierRes, teamRes, checkinRes, analyticsRes] = await Promise.all([
      api.get<unknown>(`events/${id}/tiers`).catch(() => [] as unknown),
      api.get<unknown>(`events/${id}/team`).catch(() => [] as unknown),
      api.get<unknown>(`events/${id}/checkins`).catch(() => null),
      api
        .get<AnalyticsOverview>(`events/${id}/analytics`, { query: { range } })
        .catch(() => null),
    ]);
    tiers = toList<Tier>(tierRes);
    team = toList<TeamMember>(teamRes);
    checkins = checkinRes === null ? null : toList<CheckinRecord>(checkinRes);
    analytics = analyticsRes;
  } catch (e) {
    if (e instanceof ApiError && (e.code === "EVENT_NOT_FOUND" || e.status === 404)) {
      missing = true;
    } else {
      const g =
        e instanceof ApiError
          ? e.guidance()
          : { message: "Something went wrong.", recovery: "Please try again." };
      failure = { title: g.message, body: g.recovery };
    }
  }

  if (missing) notFound();

  return (
    <main>
      <p className="text-sm">
        <Link href="/host/events" className="font-semibold text-brand-800 hover:underline">
          ← My events
        </Link>
      </p>
      {failure || !event ? (
        <>
          <div className="mt-6">
            <ErrorState title={failure?.title ?? "Event unavailable."} body={failure?.body} />
          </div>
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl">{event.title}</h1>
              <p className="mt-1 text-stone-600">
                {formatDateTime(event.startAt)} → {formatDateTime(event.endAt)}
              </p>
              <div className="mt-2">
                <StatusBadge status={event.status} />
              </div>
            </div>
            <EventActions eventId={event.id} status={event.status} />
          </div>

          <section aria-label="Tiers" className="mt-8">
            <h2 className="font-display text-xl">Ticket tiers</h2>
            <div className="mt-3">
              <TierManager eventId={event.id} initial={tiers} />
            </div>
          </section>

          <section aria-label="Agenda" className="mt-8">
            <h2 className="font-display text-xl">Agenda</h2>
            <div className="mt-3 max-w-2xl">
              <AgendaEditor eventId={event.id} initial={event.agenda ?? []} />
            </div>
          </section>

          <section aria-label="Team" className="mt-8">
            <h2 className="font-display text-xl">Team</h2>
            <div className="mt-3">
              <TeamManager eventId={event.id} initial={team} />
            </div>
          </section>

          <section aria-label="Policies" className="mt-8">
            <h2 className="font-display text-xl">Policies</h2>
            <div className="mt-3">
              <PoliciesForm
                eventId={event.id}
                initial={{
                  refundPolicy: event.policies?.refundPolicy ?? "",
                  entryRules: event.policies?.entryRules ?? "",
                }}
              />
            </div>
          </section>

          <section aria-label="Check-ins" className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">Check-ins</h2>
              <Link
                href={`/host/scanner?eventId=${event.id}`}
                className="text-sm font-semibold text-brand-800 hover:underline"
              >
                Open scanner →
              </Link>
            </div>
            <div className="mt-3">
              {checkins === null ? (
                <p className="text-sm text-stone-500">Check-ins couldn&apos;t be loaded right now.</p>
              ) : checkins.length > 0 ? (
                <CheckinsTable rows={checkins} />
              ) : (
                <EmptyState title="No check-ins yet" body="Scanned tickets will appear here." />
              )}
            </div>
          </section>

          <section aria-label="Analytics" className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">Analytics</h2>
              <nav aria-label="Range" className="flex gap-1 text-sm font-semibold">
                {RANGES.map((r) => (
                  <Link
                    key={r}
                    href={`/host/events/${event.id}?range=${r}`}
                    aria-current={range === r ? "page" : undefined}
                    className={`rounded-lg px-2.5 py-1 ${range === r ? "bg-brand-700 text-white" : "bg-stone-100 hover:bg-stone-200"}`}
                  >
                    {r.replace(/_/g, " ")}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="mt-3">
              {analytics ? (
                <AnalyticsView overview={analytics} />
              ) : (
                <p className="text-sm text-stone-500">Analytics couldn&apos;t be loaded right now.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
