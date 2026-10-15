import type { Metadata } from "next";
import Link from "next/link";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { EventDetail, Page } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

export const metadata: Metadata = { title: "All events" };

const LIMIT = 12;
const STATUSES = ["draft", "review", "published", "on_sale", "live", "completed", "cancelled", "rescheduled"];

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Platform event browser (§11): every status, searchable (layout gates role). */
export default async function AdminEventsPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const search = first(params.search).slice(0, 100);
  const status = STATUSES.includes(first(params.status)) ? first(params.status) : "";
  const page = Math.max(1, Number(first(params.page)) || 1);

  let events: EventDetail[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<EventDetail>>("admin/events", {
      query: { ...(search ? { search } : {}), ...(status ? { status } : {}), page, limit: LIMIT },
    });
    events = res.data;
    total = res.total;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  const makeHref = (next: number) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    q.set("page", String(next));
    return `/admin/events?${q.toString()}`;
  };

  return (
    <main>
      <h1 className="font-display text-3xl">Events</h1>
      <p className="mt-1 text-sm text-stone-600">
        Every event on the platform, in any status. Open one for attendees and team.
      </p>
      <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <Field label="Search" htmlFor="search">
            <Input name="search" defaultValue={search} maxLength={100} placeholder="Title, city, venue…" />
          </Field>
        </div>
        <div>
          <Field label="Status" htmlFor="status">
            <Select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
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
            <ul className="flex flex-col gap-2">
              {events.map((event) => (
                <li key={event.id}>
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 hover:border-brand-400"
                  >
                    <span>
                      <span className="font-semibold">{event.title}</span>
                      <span className="mt-0.5 block text-sm text-stone-500">
                        {[event.host?.name, event.city, formatDateTime(event.startAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-sm text-stone-500">{event.soldCount} sold</span>
                      <StatusBadge status={event.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Pagination page={page} total={total} limit={LIMIT} makeHref={makeHref} />
            </div>
          </>
        ) : (
          <EmptyState title="No events found" body="Try clearing the search or status filter." />
        )}
      </div>
    </main>
  );
}
