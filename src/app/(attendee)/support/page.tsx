import type { Metadata } from "next";
import Link from "next/link";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import { toList, type SupportConversation } from "@/lib/api-types";
import { formatDateTime } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { StatusBadge } from "@/components/ui/badge";
import { NewSupportForm } from "@/components/support/new-support-form";

export const metadata: Metadata = { title: "Support" };

/** Support threads: user↔support team only (never user↔user). */
export default async function SupportPage() {
  await requireSession();

  let topics: string[] = [];
  let threads: SupportConversation[] = [];
  let failure: { title: string; body: string } | null = null;

  try {
    const api = await serverApi();
    const [topicRes, threadRes] = await Promise.all([
      api.get<string[]>("support/topics").catch(() => [] as string[]),
      api.get<unknown>("support/conversations"),
    ]);
    topics = topicRes;
    threads = toList<SupportConversation>(threadRes);
  } catch (e) {
    const g =
      e instanceof ApiError
        ? e.guidance()
        : { message: "Something went wrong.", recovery: "Please try again." };
    failure = { title: g.message, body: g.recovery };
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl">Support</h1>
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
            <NewSupportForm topics={topics} />
            <h2 className="mt-8 font-display text-xl">Your conversations</h2>
            <div className="mt-3">
              {threads.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/support/${t.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 hover:border-brand-400"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{t.topic}</p>
                          <p className="text-sm text-stone-500">
                            Updated {formatDateTime(t.updatedAt)}
                          </p>
                        </div>
                        <StatusBadge status={t.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No conversations" body="Start one above." />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
