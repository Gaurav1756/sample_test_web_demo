import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type EventDetail, type TeamMember } from "@/lib/api-types";
import { splitEventTeam, teamMemberKey, teamMemberName } from "@/lib/admin-team";
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

/** Single-event oversight (§11): facts, attendee rollup, hosts, and event staff. */
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

  const { hosts, staff } = splitEventTeam(team);
  const primaryHostId = event.host?.id;
  const coHosts = primaryHostId
    ? hosts.filter((member) => (member.user?.id ?? member.userId) !== primaryHostId)
    : hosts;

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
                    {row.orders} order{row.orders === 1 ? "" : "s"} · {row.tickets} ticket
                    {row.tickets === 1 ? "" : "s"} · {row.checkedIn} checked in ·{" "}
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

      <section aria-label="Hosts" className="mt-8">
        <h2 className="font-display text-xl">
          Hosts
          <span className="ml-2 text-base font-normal text-stone-500">
            {event.host || coHosts.length > 0
              ? `${(event.host ? 1 : 0) + coHosts.length} host${(event.host ? 1 : 0) + coHosts.length === 1 ? "" : "s"}`
              : "none listed"}
          </span>
        </h2>
        <div className="mt-3">
          {event.host || coHosts.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {event.host ? (
                <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm">
                  <span className="font-semibold">{event.host.name}</span>
                  <span className="text-stone-600">Primary host</span>
                </li>
              ) : null}
              {coHosts.map((member, i) => (
                <li
                  key={teamMemberKey(member, i)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{teamMemberName(member, `Co-host ${i + 1}`)}</span>
                  <span className="text-stone-600">
                    {(member.permissions ?? []).join(", ") || "manage_event"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">No hosts listed for this event.</p>
          )}
        </div>
      </section>

      <section aria-label="Event staff" className="mt-8">
        <h2 className="font-display text-xl">
          Event staff
          <span className="ml-2 text-base font-normal text-stone-500">
            {staff.length} member{staff.length === 1 ? "" : "s"}
          </span>
        </h2>
        <div className="mt-3">
          {staff.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {staff.map((member, i) => (
                <li
                  key={teamMemberKey(member, i)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 px-4 py-3 text-sm"
                >
                  <span className="font-semibold">{teamMemberName(member, `Staff ${i + 1}`)}</span>
                  <span className="text-stone-600">
                    {(member.permissions ?? []).join(", ") || "no permissions"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">
              No staff assigned — team members with ticket-scanning duty appear here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
