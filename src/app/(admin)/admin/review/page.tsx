import type { Metadata } from "next";
import { serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { Page, ReviewQueueItem } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { ReviewRow } from "@/components/admin/review-row";

export const metadata: Metadata = { title: "Review queue" };

const LIMIT = 10;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Event approval queue (layout gates super_admin; backend re-checks). */
export default async function ReviewQueuePage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(first(params.page)) || 1);
  const highlight = first(params.highlight);

  let queue: Page<ReviewQueueItem> | null = null;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    queue = await api.get<Page<ReviewQueueItem>>("admin/events/review-queue", {
      query: { page, limit: LIMIT },
    });
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main>
      <h1 className="font-display text-3xl">Review queue</h1>
      <div className="mt-6">
        {failure || !queue ? (
          <>
            <ErrorState title={failure?.title ?? "Queue unavailable."} body={failure?.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : queue.data.length > 0 ? (
          <>
            <ul className="flex flex-col gap-3">
              {queue.data.map((event) => (
                <ReviewRow key={event.id} event={event} open={event.id === highlight} />
              ))}
            </ul>
            <div className="mt-6">
              <Pagination
                page={page}
                total={queue.total}
                limit={LIMIT}
                makeHref={(p) => (p > 1 ? `/admin/review?page=${p}` : "/admin/review")}
              />
            </div>
          </>
        ) : (
          <EmptyState title="Queue is clear" body="No events are waiting for review." />
        )}
      </div>
    </main>
  );
}
