import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventDetail, type TeamMember } from "@/lib/api-types";
import { formatDateTime, formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Event detail" };

type Props = {
  params: Promise<{ id: string }>;
};

/** Per-buyer rollup. Shape is local: the backend has not specified it. */
interface AttendeeRow {
  user: { id: string; name: string; username: string };
  orders: number;
  tickets: number;
  checkedIn: number;
  spentPaise: number;
}

/** Single-event oversight (§11): facts, attendee rollup, team roster. */
export default async function AdminEventDetailPage({ params }: Props) {
  const { id } = await params;

  let event: EventDetail | null = null;
  let attendees: AttendeeRow[] = [];
  let team: TeamMember[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    event = await api.get<EventDetail>(`events/${id}`);
    const [attendeeRes, teamRes] = await Promise.all([
      api.get<unknown>(`admin/events/${id}/attendees`).catch(() => [] as unknown),
      api.get<unknown>(`admin/events/${id}/team`).catch(() => [] as unknown),
    ]);
    attendees = toList<AttendeeRow>(attendeeRes);
    team = toList<TeamMember>(teamRes);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  if (failure || !event) {
    return (
      <main>
        <p className="text-sm">
          <Link href="/admin/events" className="font-semibold text-brand-800 hover:underline">
            ← All events
          </Link>
        </p>
        <div className="mt-6">
          <ErrorState title={failure?.title ?? "Event unavailable."} body={failure?.body} />
          <div className="mt-4 flex justify-center">
            <RefreshButton />
          </div>
        </div>
      </main>
    );
  }

  const facts: Array<[string, string]> = [
    ["Host", event.host?.name ?? "—"],
    ["Status", event.status],
    ["Schedule", `${formatDateTime(event.startAt)} → ${formatDateTime(event.endAt)}`],
    ["Venue", [event.venue, event.city].filter(Boolean).join(", ") || "—"],
    ["Sold", `${event.soldCount} · going ${event.goingCount}`],
    ["Rating", event.avgRating != null ? String(event.avgRating) : "—"],
  ];

  return (
    <main>
      <p className="text-sm">
        <Link href="/admin/events" className="font-semibold text-brand-800 hover:underline">
          ← All events
        </Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl">{event.title}</h1>
        <StatusBadge status={event.status} />
      </div>
      <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
        {facts.map(([term, value]) => (
          <div key={term} className="rounded-xl border border-stone-200 px-4 py-3">
            <dt className="text-stone-500">{term}</dt>
            <dd className="mt-0.5 font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Attendees" className="mt-8">
        <h2 className="font-display text-xl">
          Attendees
          <span className="ml-2 text-base font-normal text-stone-500">
            {attendees.length} buyer{attendees.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="mt-3">
          {attendees.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {attendees.map((row) => (
                <li
                  key={row.user.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold">{row.user.name}</span>
                    <span className="text-stone-500"> @{row.user.username}</span>
                  </span>
                  <span className="text-stone-600">
                    {row.tickets} ticket{row.tickets === 1 ? "" : "s"} · {row.checkedIn} checked in ·{" "}
                    <span className="font-semibold text-ink-900">{formatPaise(row.spentPaise)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No attendees yet" body="Buyers appear here once orders are placed." />
          )}
        </div>
      </section>

      <section aria-label="Event team" className="mt-8">
        <h2 className="font-display text-xl">Event team</h2>
        <div className="mt-3">
          {team.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {team.map((member, i) => {
                const who = member.user?.name ?? member.userId ?? member.memberId ?? `Member ${i + 1}`;
                return (
                  <li
                    key={member.userId ?? member.memberId ?? i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm"
                  >
                    <span className="font-semibold">{who}</span>
                    <span className="text-stone-600">{(member.permissions ?? []).join(", ") || "no permissions"}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No team members assigned.</p>
          )}
        </div>
      </section>
    </main>
  );
}
