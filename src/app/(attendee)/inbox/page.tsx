import type { Metadata } from "next";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type NotificationItem, type Page } from "@/lib/api-types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RefreshButton } from "@/components/ui/refresh-button";
import { InboxList } from "@/components/inbox/inbox-list";

export const metadata: Metadata = { title: "Inbox" };

const LIMIT = 20;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function InboxPage({ searchParams }: Props) {
  await requireSession();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(first(params.page)) || 1);
  const unreadOnly = first(params.unread) === "1";

  let items: NotificationItem[] = [];
  let total = 0;
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const res = await api.get<Page<NotificationItem>>("users/me/notifications", {
      query: { page, limit: LIMIT, ...(unreadOnly ? { unreadOnly: true } : {}) },
    });
    items = toList<NotificationItem>(res);
    total = (res as Page<NotificationItem>).total ?? items.length;
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl">Inbox</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : items.length > 0 ? (
          <>
            <InboxList initial={items} />
            <div className="mt-6">
              <Pagination
                page={page}
                total={total}
                limit={LIMIT}
                makeHref={(p) => {
                  const q = new URLSearchParams();
                  if (unreadOnly) q.set("unread", "1");
                  if (p > 1) q.set("page", String(p));
                  return `/inbox?${q.toString()}`;
                }}
              />
            </div>
          </>
        ) : (
          <EmptyState title="No notifications" body="Updates will appear here." />
        )}
      </div>
    </main>
  );
}
