import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type CheckinRecord, type EventCard, type Page } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ScannerClient } from "@/components/host/scanner-client";

export const metadata: Metadata = { title: "Scanner" };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** QR gate scanner (§10): event context, verify, offline bundle/sync, monitor. */
export default async function ScannerPage({ searchParams }: Props) {
  await requireSession(["host", "super_admin", "event_staff"]);
  const eventId = first((await searchParams)?.eventId);

  let events: EventCard[] = [];
  let recent: CheckinRecord[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<EventCard>>("hosts/me/events", {
      query: { status: "live", limit: 50 },
    });
    events = toList<EventCard>(res);
    if (eventId) {
      recent = toList<CheckinRecord>(
        await api.get<unknown>(`events/${eventId}/checkins`).catch(() => [] as unknown),
      );
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
      <h1 className="font-display text-3xl">Scanner</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <ScannerClient
            key={eventId || "none"}
            events={events}
            eventId={eventId || null}
            recent={recent}
          />
        )}
      </div>
    </main>
  );
}
