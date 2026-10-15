import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import {
  toList,
  type AnalyticsOverview,
  type Community,
  type EventCard,
  type Page,
  type TopEventRow,
} from "@/lib/api-types";
import { formatPaise } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { AnalyticsView } from "@/components/host/analytics-view";
import { AnalyticsPicker } from "@/components/host/analytics-picker";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = ["7_days", "30_days", "3_months", "12_months"] as const;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Host analytics (§12b): overview per scope + top events. */
export default async function AnalyticsPage({ searchParams }: Props) {
  await requireSession(["host", "super_admin"]);
  const query = (await searchParams) ?? {};
  const scope = first(query.scope) === "community" ? "community" : "event";
  const scopeId = first(query.scopeId);
  const range = (RANGES as readonly string[]).includes(first(query.range))
    ? first(query.range)
    : "30_days";

  let events: EventCard[] = [];
  let communities: Community[] = [];
  let overview: AnalyticsOverview | null = null;
  let top: TopEventRow[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [eventRes, communityRes] = await Promise.all([
      api.get<Page<EventCard>>("hosts/me/events", { query: { limit: 50 } }),
      api.get<unknown>("users/me/communities"),
    ]);
    events = toList<EventCard>(eventRes);
    communities = toList<Community>(communityRes);
    const [overviewRes, topRes] = await Promise.all([
      scopeId
        ? api
            .get<AnalyticsOverview>("hosts/me/analytics/overview", {
              query: { scope, scopeId, range },
            })
            .catch(() => null)
        : Promise.resolve(null),
      api.get<unknown>("hosts/me/analytics/top-events", { query: { range } }).catch(() => [] as unknown),
    ]);
    overview = overviewRes;
    top = toList<TopEventRow>(topRes);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Analytics</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <>
            <AnalyticsPicker
              scope={scope}
              scopeId={scopeId}
              range={range}
              events={events}
              communities={communities}
            />
            <div className="mt-6">
              {overview ? (
                <AnalyticsView overview={overview} />
              ) : (
                <EmptyState
                  title={scopeId ? "No analytics yet" : "Choose a scope"}
                  body={
                    scopeId
                      ? "Metrics will appear once there is activity to report."
                      : "Pick an event or community above to view its analytics."
                  }
                />
              )}
            </div>
            <h2 className="mt-10 font-display text-xl">Top events</h2>
            <div className="mt-3">
              {top.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {top.map((row) => (
                    <li
                      key={row.eventId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm"
                    >
                      <span className="font-semibold">{row.title}</span>
                      <span className="text-stone-600">
                        {row.attendees} attendees · {row.capacityPct}% full ·{" "}
                        {formatPaise(row.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-stone-500">No top-event data for this range.</p>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
