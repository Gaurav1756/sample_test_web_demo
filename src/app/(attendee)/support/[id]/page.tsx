import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, serverApi } from "@/lib/session";
import { ApiError } from "@/lib/api-errors";
import type { CursorPage, SupportMessage } from "@/lib/api-types";
import { ErrorState } from "@/components/ui/states";
import { RefreshButton } from "@/components/ui/refresh-button";
import { SupportThread } from "@/components/support/support-thread";

export const metadata: Metadata = { title: "Support conversation" };

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SupportThreadPage({ params }: Props) {
  const { user } = await requireSession();
  const { id } = await params;

  let messages: SupportMessage[] = [];
  let failure: { title: string; body: string } | null = null;
  let missing = false;

  try {
    const api = await serverApi();
    const res = await api.get<CursorPage<SupportMessage>>(`support/conversations/${id}/messages`);
    messages = res.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm">
        <Link href="/support" className="font-semibold text-brand-800 hover:underline">
          ← Support
        </Link>
      </p>
      <h1 className="mt-2 font-display text-3xl">Conversation</h1>
      <div className="mt-6">
        {failure ? (
          <>
            <ErrorState title={failure.title} body={failure.body} />
            <div className="mt-4 flex justify-center">
              <RefreshButton />
            </div>
          </>
        ) : (
          <SupportThread conversationId={id} initial={messages} userId={user.id} />
        )}
      </div>
    </main>
  );
}
